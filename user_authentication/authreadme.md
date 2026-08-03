# Auth Frontend

Sign in / sign up page with email+password and Google Sign-In, built in plain
HTML/CSS/JS. Redirects to `app.html` on success; `app.html` redirects back to
`index.html` if there's no valid session (so it also works as your "gate" for
the rest of the site).

## Setup - 2 things to fill in

Both are in `auth.js`, right at the top:

```js
const CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  API_BASE_URL: "http://localhost:5000",
};
```

**1. `API_BASE_URL`** - wherever your friend's backend actually runs.

**2. `GOOGLE_CLIENT_ID`** - from Google Cloud Console:
1. Go to the Google Auth Platform → Clients page, create/select a project
2. Create an OAuth client, type = **Web application**
3. Under Authorized JavaScript origins, add `http://localhost` and whatever
   port you're serving on (e.g. `http://localhost:5500`)
4. Copy the Client ID into `CONFIG.GOOGLE_CLIENT_ID`

Until you set the real Client ID, the Google buttons just don't render -
email/password sign in and sign up still work fine on their own.

## Important: don't open index.html directly

Google Identity Services requires a real `http://` origin - opening the file
directly (`file://...`) will silently break the Google button. Serve it with
any simple local server, e.g.:
```bash
python -m http.server 5500
```
then visit `http://localhost:5500`. VS Code's "Live Server" extension works
too.

## API contract - send this to your backend teammate

Your frontend expects exactly these 5 endpoints. Sign-up is now a 3-step
flow: send a code, verify it, then set a password.

```
POST /api/auth/send-code
  body: { email }
  success: { message: "Code sent" }
  failure: { message: "..." }  (e.g. "Email already registered")

  Backend should: generate a 6-digit code, store it against this email with
  a short expiry (e.g. 10 min), and actually email it - needs an email
  service wired in (e.g. Nodemailer + an SMTP provider, or a service like
  Resend/SendGrid). This is real infrastructure, not just a code change -
  worth setting up early since it may need account signup/API keys.

POST /api/auth/verify-code
  body: { email, code }
  success: { verified: true, verification_token: "..." }
  failure: { message: "..." }  (e.g. "Invalid or expired code")

  verification_token should be short-lived (~15 min) proof that this email
  was just verified - required by complete-signup below, so no one can skip
  straight to account creation without passing the code check.

POST /api/auth/complete-signup
  body: { name, email, password, verification_token }
  success: { token, user: { id, name, email } }
  failure: { message: "..." }  (e.g. "Verification expired, please restart")

POST /api/auth/login
  body: { email, password }
  success: { token, user: { id, name, email } }
  failure: { message: "..." }  (e.g. "Invalid email or password")

POST /api/auth/google
  body: { credential }   // the Google ID token string, verify server-side
                          // with a library like google-auth-library (Node)
  success: { token, user: { id, name, email } }
  failure: { message: "..." }

GET /api/auth/me
  header: Authorization: Bearer <token>
  success (200): { user: { id, name, email } }
  failure (401): anything - frontend just checks status code
```

`token` should be something your backend can verify on future requests (a
JWT is the standard choice). Passwords must be hashed (e.g. bcrypt) before
being stored - never store them plain in MongoDB. The Google flow is wired
up in the frontend but deprioritized for now - basic email auth first.

## Handing off to your frontend teammate (same-site setup)

Since her app lives in the same project, integration is one script tag, not
a rewrite:

1. **In her app's main HTML file**, add near the top:
   ```html
   <script src="auth-guard.js"></script>
   ```
   This automatically redirects to `index.html` (the login page) if no one's
   logged in - so it doubles as the "must be signed in" gate for the whole
   site.

2. **She can then use:**
   - `window.currentUser` → `{ id, name, email }` of whoever's logged in
   - `logout()` → wire this to any logout button
   - `authFetch(url, options)` → same as `fetch()`, but automatically attaches
     the auth token - use this for any call to a backend that needs to know
     who's asking

3. **One thing to coordinate directly with her**: only one file can be named
   `index.html` at the site root, and it needs to be the login page (per
   "shows whenever someone visits the site"). If she already built her own
   `index.html` for the main app, rename it (e.g. to `app.html`, replacing
   the placeholder one here) and update `LOGIN_PAGE` in `auth-guard.js` and
   the `window.location.href = "app.html"` redirects in `auth.js` to match
   wherever her real entry file ends up living.

`app.html` in this repo is a working example of all of this - a real,
tested reference for her to copy the pattern from, not just docs to read.

| File | Purpose |
|---|---|
| `index.html` | Sign in / sign up page |
| `style.css` | Styling |
| `auth.js` | All the logic - forms, Google Sign-In, API calls, session check |
| `auth-guard.js` | Include in any page that requires login - handles the redirect gate, `window.currentUser`, `logout()`, `authFetch()` |
| `app.html` | Placeholder post-login page - replace with your real app UI, or use as a reference for the auth-guard.js pattern |