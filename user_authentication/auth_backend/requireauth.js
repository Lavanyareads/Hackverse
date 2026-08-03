const jwt = require("jsonwebtoken");

// Protects any route: reads the Authorization header, verifies the JWT,
// and attaches req.userId for the route handler to use.
// On failure (missing/invalid/expired token), responds 401 - never crashes.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = requireAuth;