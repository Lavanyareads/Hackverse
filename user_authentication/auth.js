// ============================================================
// CONFIG - fill these in once you have them
// ============================================================
const CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // from Google Cloud Console
  API_BASE_URL: "http://localhost:5000", // your friend's backend URL
};

// ============================================================
// Helpers
// ============================================================
function showMessage(text, type) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = "message " + (type || "");
}

function saveSession(token, user) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
}

async function apiPost(path, body) {
  const response = await fetch(CONFIG.API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

// ============================================================
// On page load: if already signed in, skip straight to the app
// ============================================================
async function checkExistingSession() {
  const token = localStorage.getItem("auth_token");
  if (!token) return;

  try {
    const response = await fetch(CONFIG.API_BASE_URL + "/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (response.ok) {
      window.location.href = "app.html";
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
  } catch (e) {
    // backend unreachable - let them sign in manually rather than blocking the page
  }
}
checkExistingSession();

// ============================================================
// Tab toggling
// ============================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".form").forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "-form").classList.add("active");
    showMessage("", "");
  });
});

// ============================================================
// Sign In
// ============================================================
document.getElementById("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  try {
    const data = await apiPost("/api/auth/login", { email, password });
    saveSession(data.token, data.user);
    showMessage("Signed in - redirecting...", "success");
    window.location.href = "app.html";
  } catch (err) {
    showMessage(err.message, "error");
  }
});

// ============================================================
// Sign Up - 3-step wizard: email -> verify code -> set password
// ============================================================
let signupState = {
  step: 1,
  email: "",
  verificationToken: null,
};

function goToStep(step) {
  signupState.step = step;
  document.querySelectorAll("#signup-form .step").forEach((s) => s.classList.remove("active"));
  document.getElementById("step-" + step).classList.add("active");

  document.querySelectorAll("#step-indicator .step-dot").forEach((dot) => {
    const dotStep = Number(dot.dataset.step);
    dot.classList.toggle("active", dotStep === step);
    dot.classList.toggle("done", dotStep < step);
  });
  showMessage("", "");
}

// --- OTP box behavior: auto-advance, backspace-to-previous, paste support ---
const otpBoxes = Array.from(document.querySelectorAll("#otp-inputs .otp-box"));

otpBoxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    box.value = box.value.replace(/[^0-9]/g, "");
    if (box.value && i < otpBoxes.length - 1) {
      otpBoxes[i + 1].focus();
    }
  });

  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && i > 0) {
      otpBoxes[i - 1].focus();
    }
  });

  box.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
    if (pasted.length === otpBoxes.length) {
      e.preventDefault();
      otpBoxes.forEach((b, idx) => (b.value = pasted[idx]));
      otpBoxes[otpBoxes.length - 1].focus();
    }
  });
});

function getOtpCode() {
  return otpBoxes.map((b) => b.value).join("");
}

function clearOtpBoxes() {
  otpBoxes.forEach((b) => (b.value = ""));
}

// --- Resend cooldown ---
let resendCooldown = 0;
let resendTimer = null;

function startResendCooldown() {
  const btn = document.getElementById("resend-code-btn");
  resendCooldown = 30;
  btn.disabled = true;
  btn.textContent = "Resend code (" + resendCooldown + "s)";
  resendTimer = setInterval(() => {
    resendCooldown -= 1;
    if (resendCooldown <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = "Resend code";
    } else {
      btn.textContent = "Resend code (" + resendCooldown + "s)";
    }
  }, 1000);
}

// --- Step submit handler (one form, behavior depends on current step) ---
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (signupState.step === 1) {
    const email = document.getElementById("signup-email").value;
    try {
      await apiPost("/api/auth/send-code", { email });
      signupState.email = email;
      document.getElementById("otp-email-display").textContent = email;
      clearOtpBoxes();
      goToStep(2);
      startResendCooldown();
      otpBoxes[0].focus();
    } catch (err) {
      showMessage(err.message, "error");
    }
    return;
  }

  if (signupState.step === 2) {
    const code = getOtpCode();
    if (code.length !== 6) {
      showMessage("Enter all 6 digits.", "error");
      return;
    }
    try {
      const data = await apiPost("/api/auth/verify-code", { email: signupState.email, code });
      signupState.verificationToken = data.verification_token;
      goToStep(3);
    } catch (err) {
      showMessage(err.message, "error");
    }
    return;
  }

  if (signupState.step === 3) {
    const name = document.getElementById("signup-name").value;
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    if (password !== confirm) {
      showMessage("Passwords don't match.", "error");
      return;
    }

    try {
      const data = await apiPost("/api/auth/complete-signup", {
        name,
        email: signupState.email,
        password,
        verification_token: signupState.verificationToken,
      });
      saveSession(data.token, data.user);
      showMessage("Account created - redirecting...", "success");
      window.location.href = "app.html";
    } catch (err) {
      showMessage(err.message, "error");
    }
  }
});

document.getElementById("resend-code-btn").addEventListener("click", async () => {
  try {
    await apiPost("/api/auth/send-code", { email: signupState.email });
    clearOtpBoxes();
    otpBoxes[0].focus();
    startResendCooldown();
    showMessage("Code resent.", "success");
  } catch (err) {
    showMessage(err.message, "error");
  }
});

document.getElementById("change-email-btn").addEventListener("click", () => {
  clearInterval(resendTimer);
  clearOtpBoxes();
  goToStep(1);
});

// ============================================================
// Google Sign-In
// ============================================================
async function handleGoogleCredential(response) {
  try {
    const data = await apiPost("/api/auth/google", { credential: response.credential });
    saveSession(data.token, data.user);
    showMessage("Signed in - redirecting...", "success");
    window.location.href = "app.html";
  } catch (err) {
    showMessage(err.message, "error");
  }
}

window.onload = function () {
  if (!window.google || CONFIG.GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
    // Google Client ID not set up yet - skip silently rather than showing a broken button
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
  });

  google.accounts.id.renderButton(document.getElementById("google-btn-signin"), {
    theme: "filled_black",
    size: "large",
    width: 300,
  });
  google.accounts.id.renderButton(document.getElementById("google-btn-signup"), {
    theme: "filled_black",
    size: "large",
    width: 300,
    text: "signup_with",
  });
};