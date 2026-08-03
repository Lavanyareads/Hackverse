const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const VerificationCode = require("../models/VerificationCode");
const requireAuth = require("../middleware/requireAuth");
const { sendVerificationCode } = require("../utils/sendEmail");

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

function issueSessionToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ------------------------------------------------------------
// POST /api/auth/send-code
// ------------------------------------------------------------
router.post("/send-code", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const code = generateCode();
    await VerificationCode.deleteMany({ email }); // clear any old codes for this email first
    await VerificationCode.create({ email, code });
    await sendVerificationCode(email, code);

    res.json({ message: "Code sent" });
  } catch (e) {
    console.error("send-code error:", e);
    res.status(500).json({ message: "Could not send verification code" });
  }
});

// ------------------------------------------------------------
// POST /api/auth/verify-code
// ------------------------------------------------------------
router.post("/verify-code", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const code = (req.body.code || "").trim();

    const record = await VerificationCode.findOne({ email, code });
    if (!record) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // One-time use: delete it now that it's been used
    await VerificationCode.deleteOne({ _id: record._id });

    const verification_token = jwt.sign(
      { email, purpose: "signup" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ verified: true, verification_token });
  } catch (e) {
    console.error("verify-code error:", e);
    res.status(500).json({ message: "Could not verify code" });
  }
});

// ------------------------------------------------------------
// POST /api/auth/complete-signup
// ------------------------------------------------------------
router.post("/complete-signup", async (req, res) => {
  try {
    const { name, email, password, verification_token } = req.body;

    if (!name || !email || !password || !verification_token) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let payload;
    try {
      payload = jwt.verify(verification_token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: "Verification expired, please restart" });
    }

    if (payload.purpose !== "signup" || payload.email !== email.toLowerCase().trim()) {
      return res.status(400).json({ message: "Verification token doesn't match this email" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase().trim(), passwordHash });

    const token = issueSessionToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (e) {
    console.error("complete-signup error:", e);
    res.status(500).json({ message: "Could not create account" });
  }
});

// ------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const password = req.body.password || "";

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = issueSessionToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (e) {
    console.error("login error:", e);
    res.status(500).json({ message: "Could not log in" });
  }
});

// ------------------------------------------------------------
// POST /api/auth/google
// ------------------------------------------------------------
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Missing credential" });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase().trim();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name: payload.name, email });
    }

    const token = issueSessionToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (e) {
    console.error("google auth error:", e);
    res.status(400).json({ message: "Google sign-in failed" });
  }
});

// ------------------------------------------------------------
// GET /api/auth/me
// ------------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    res.status(401).json({ message: "Invalid session" });
  }
});

module.exports = router;