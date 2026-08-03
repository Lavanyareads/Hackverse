# Backend Integration Guide — Auth System

Hey! This is everything you need to build the backend for the sign in / sign up page. The frontend is already built and tested — it just can't actually create accounts or log anyone in yet because there's no backend behind it. This doc explains what the frontend does, what it expects from you, and exactly what to build so our two sides match up.

---

## 1. What the frontend already does

It's a single login page (`index.html`) with two tabs: **Sign In** and **Sign Up**. Plain HTML/CSS/JS, no framework.

### Sign In tab
Simple form: email + password → one API call → done.

### Sign Up tab
This is a **3-step wizard**, not a single form:

1. **Step 1 — Email.** User types their email, clicks "Send Verification Code." We call your API to send a 6-digit code to that email.
2. **Step 2 — Verify code.** User types the 6-digit code they received. We call your API to check it. There's also a "Resend code" button (30s cooldown) and a "Change email" button that goes back to step 1.
3. **Step 3 — Set password.** User enters their name + password (+ confirm). We call your API to actually create the account.

Why 3 steps instead of one form? So we confirm the email is real and reachable *before* creating an account with it — standard email-verification flow.

There's also a **Google Sign-In** button (optional, lower priority — see section 4).

### After login
Once signed in, we save two things in the browser (`localStorage`):
- `auth_token` — whatever token string your backend returns
- `auth_user` — a JSON object `{ id, name, email }`

Then we redirect to `app.html`. Every future API call that needs to know who's asking will send this token in the `Authorization` header, like:
```
Authorization: Bearer <token>
```

---

## 2. The exact API contract

This is the important part — **please match these request/response shapes exactly**, since the frontend is already written against them and I'd rather not go rewrite JS if we can help it. Happy to adjust together if something's awkward on your end though — just flag it.

All requests are `POST` with JSON bodies (except the last one), all responses are JSON.

### `POST /api/auth/send-code`
Sends a 6-digit verification code to an email.

**Request body:**
```json
{ "email": "user@example.com" }
```
**Success response:**
```json
{ "message": "Code sent" }
```
**Failure response** (e.g. email already has an account):
```json
{ "message": "Email already registered" }
```

**What you need to build:**
- Generate a random 6-digit code.
- Store it somewhere tied to that email (DB or cache like Redis), with a short expiry — **10 minutes** is what the frontend assumes.
- Actually **send the email**. This needs a real email-sending service wired up — this is the one piece of real infrastructure in here, not just a code change, so it's worth starting early. Options: Nodemailer + an SMTP provider, or a hosted service like Resend or SendGrid. You'll likely need to sign up for an account/API key somewhere.

### `POST /api/auth/verify-code`
Checks whether the code the user typed matches what you sent.

**Request body:**
```json
{ "email": "user@example.com", "code": "123456" }
```
**Success response:**
```json
{ "verified": true, "verification_token": "some-short-lived-token" }
```
**Failure response:**
```json
{ "message": "Invalid or expired code" }
```

**What you need to build:**
- Look up the code you stored for this email, check it matches and hasn't expired.
- If it's valid, issue a **short-lived token** (e.g. ~15 minutes) — this can be a JWT with the email embedded and a short `exp`, or just a random token stored server-side, whichever's easier for you.
- This `verification_token` is what proves "yes, this email was just verified" — it gets passed into the next step, so nobody can skip straight to creating an account without actually checking their email.

### `POST /api/auth/complete-signup`
Actually creates the account. Final step of sign-up.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "user@example.com",
  "password": "plaintext-password-from-the-form",
  "verification_token": "the-token-from-verify-code"
}
```
**Success response:**
```json
{
  "token": "jwt-here",
  "user": { "id": "123", "name": "Jane Doe", "email": "user@example.com" }
}
```
**Failure response:**
```json
{ "message": "Verification expired, please restart" }
```

**What you need to build:**
- Check `verification_token` is valid and matches the email (this is your proof the email step actually happened).
- Hash the password before storing it — **never store plain-text passwords**. Use `bcrypt` (or `argon2`).
- Create the user record in the DB.
- Issue a real JWT (see section 3 below on what should go in it) and return it as `token`, along with the `user` object.

### `POST /api/auth/login`
**Request body:**
```json
{ "email": "user@example.com", "password": "plaintext-password-from-the-form" }
```
**Success response:**
```json
{
  "token": "jwt-here",
  "user": { "id": "123", "name": "Jane Doe", "email": "user@example.com" }
}
```
**Failure response:**
```json
{ "message": "Invalid email or password" }
```

**What you need to build:**
- Look up the user by email, compare the submitted password against the stored bcrypt hash.
- If it matches, issue a JWT the same way as `complete-signup` and return it.

### `POST /api/auth/google` (lower priority — see section 4)
**Request body:**
```json
{ "credential": "google-id-token-string" }
```
**Success/failure shape:** same as `/login` above.

### `GET /api/auth/me`
Used to check "is this token still valid?" — called automatically when the page loads, to skip straight to the app if someone's already logged in.

**Request:** no body, just a header:
```
Authorization: Bearer <token>
```
**Success (200):**
```json
{ "user": { "id": "123", "name": "Jane Doe", "email": "user@example.com" } }
```
**Failure (401):** any shape is fine — the frontend only checks the status code, not the body.

---

## 3. About the JWT specifically

The frontend treats `token` as an opaque string — it doesn't decode or inspect it, just stores it and sends it back in the `Authorization: Bearer <token>` header on every request that needs to know who's asking. So the internal format is entirely up to you, but here's what I'd suggest:

- **Payload:** at minimum the user's `id`. Email is fine to include too, but avoid putting anything sensitive (like the password hash) in there — JWT payloads are base64-encoded, not encrypted, so anyone can read them.
- **Expiry:** pick something reasonable (a common pattern is a short-lived access token, e.g. 1 hour, but honestly for a first version a longer expiry like 7 days is totally fine too — we can add refresh tokens later if needed).
- **Verifying `GET /api/auth/me`:** this endpoint needs middleware that reads the `Authorization` header, verifies the JWT signature + expiry, looks up the user by the `id` in the payload, and returns their info (or 401 if anything's invalid/expired).
- **Secret:** keep the JWT signing secret in an environment variable, not hardcoded.

If you'd rather use sessions/cookies instead of JWT, that's a bigger conversation since the frontend currently assumes a bearer token in `localStorage` — let's talk before switching approaches.

---

## 4. Priority order / what to build first

1. **Email + password auth** (`send-code`, `verify-code`, `complete-signup`, `login`, `me`) — this is the whole login experience, build this first.
2. **Google Sign-In** (`/api/auth/google`) — deprioritized. The frontend already has the Google button wired up, but until there's a real Google Client ID configured, the button just doesn't render — so email/password works fine on its own in the meantime. No rush on this one.

---

## 5. Quick sanity checklist

- [ ] Passwords are hashed with bcrypt before hitting the DB — never store plain text
- [ ] `verification_token` actually gets checked in `complete-signup`, not just accepted
- [ ] Codes expire (10 min) and get invalidated after one successful use
- [ ] JWT secret lives in an environment variable
- [ ] `GET /api/auth/me` returns 401 (not a crash) for missing/invalid/expired tokens
- [ ] CORS is set up so the frontend's origin can actually call your API — you'll hit this immediately when you test, so worth setting up early

---

## 6. Testing it together

Once you've got endpoints running, the easiest way to plug them in:

1. In `auth.js`, there's a `CONFIG` object at the top — set `API_BASE_URL` to wherever your backend is running (e.g. `http://localhost:5000`).
2. Serve the frontend with a local server (not by opening the HTML file directly): `python -m http.server 5500`, then visit `http://localhost:5500`.
3. Try signing up with a real email you can check — you should get the code, be able to enter it, and land on `app.html` logged in.

If anything about the request/response shape above needs to change on your end, just message me before changing it — happy to adjust the frontend to match rather than you contorting the backend to fit exactly what's written here.