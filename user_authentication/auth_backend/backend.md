# Auth Backend - built and tested, ready to merge in

I built this so you don't have to also build auth on top of everything
else - it matches the frontend's contract exactly (from `AUTH_README.md`
and `backend_guide.md`). Should be close to drop-in, not a rewrite.

## What's actually been tested (not just "looks right")

I ran 15 real tests against the live route logic (real JWT signing/
verification, real bcrypt hashing, real Express request/response cycles) -
just with the database calls mocked, since I don't have a real MongoDB to
connect to here. All 15 passed:

- Sending a code, verifying the right one, rejecting a wrong one
- **Codes are one-time use** - trying the same code twice fails the second time
- Signup rejects a fake/missing verification token (can't skip email verification)
- Signup blocks duplicate emails
- **The password is never echoed back in any response** - checked explicitly
- Login accepts correct password, rejects wrong password, rejects unknown email
- `/me` correctly rejects missing tokens, garbage tokens, and accepts valid ones

**What's NOT tested here**: actual MongoDB behavior (schema validation, real
network calls, index behavior) and actually sending a real email - both need
real credentials I don't have. Worth a real end-to-end test together once
you've got a MongoDB URI and email credentials plugged in.

## What you need to add (3 things)

1. **A MongoDB connection string** - Atlas (free tier) or local, whatever
   you're already using for the rest of the project.
2. **Email credentials** - see `.env.example` for the Gmail app-password
   route, or swap in whatever SMTP/service you're already using elsewhere
   if you've got one.
3. **A JWT secret** - any long random string, generator command is in
   `.env.example`.

Copy `.env.example` to `.env` and fill those in.

## How this merges into your existing backend

**If you don't have a server yet**: `server.example.js` is a complete,
runnable reference - copy its contents into your actual `server.js`.

**If you already have your own Express app going**: don't run this as a
second server - just copy 3 things into your existing file:
```js
const authRoutes = require("./routes/auth");
app.use(cors({ origin: process.env.FRONTEND_URL }));  // if not already there
app.use("/api/auth", authRoutes);
```
Everything else (models, middleware, the route logic itself) is fully
self-contained and doesn't touch/depend on anything else in your project.

## Testing it yourself once it's running

```bash
# Should send a real code to this email:
curl -X POST http://localhost:5000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"youremail@example.com"}'

# Then, with the code you actually received:
curl -X POST http://localhost:5000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email":"youremail@example.com","code":"123456"}'
```

## Files

| File | Purpose |
|---|---|
| `models/User.js` | Mongoose schema - name, email, hashed password |
| `models/VerificationCode.js` | Mongoose schema - codes auto-expire after 10 min (MongoDB TTL index, no cleanup job needed) |
| `middleware/requireAuth.js` | Verifies the JWT on protected routes |
| `utils/sendEmail.js` | Sends the verification code email (Nodemailer) |
| `routes/auth.js` | All 6 endpoints - the actual logic |
| `server.example.js` | Reference for wiring it all together |
| `.env.example` | Template for the 3 things you need to fill in |

## One thing to double check together

I used a **JWT as the verification_token** too (not just the session
token) - a short-lived (15 min) signed token proving the email was just
verified, checked again in `complete-signup`. Same `JWT_SECRET` for both,
distinguished by a `purpose` field in the payload. If you'd rather store
verification state in MongoDB instead, that's a reasonable alternative -
just flag it and I can adjust.