// This is a REFERENCE showing how everything wires together.
// If you already have your own server.js/app.js for the rest of the
// project's backend, don't run this file separately - just copy the
// pieces below (dotenv, mongoose.connect, cors, the auth router mount)
// into your existing app instead of running two servers.

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5500" }));
app.use(express.json());

app.use("/api/auth", authRoutes);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 5000, () => {
      console.log("Server running on port " + (process.env.PORT || 5000));
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });