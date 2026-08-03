const nodemailer = require("nodemailer");

// Works with Gmail (needs an "app password", not your regular password -
// generate one at myaccount.google.com/apppasswords) or any SMTP provider
// by swapping the transport config below.
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationCode(toEmail, code) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Your verification code",
    text: "Your verification code is: " + code + "\nThis code expires in 10 minutes.",
    html: "<p>Your verification code is: <strong>" + code + "</strong></p><p>This code expires in 10 minutes.</p>",
  });
}

module.exports = { sendVerificationCode };