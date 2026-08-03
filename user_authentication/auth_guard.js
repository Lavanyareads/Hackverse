// ============================================================
// auth-guard.js
// ------------------------------------------------------------
// Drop this into ANY page that should only be visible to logged-in
// users. It runs immediately on load.
//
// Usage: add this near the top of your page (in <head> or just
// before your own scripts):
//   <script src="auth-guard.js"></script>
//
// After it runs, you get:
//   window.currentUser        -> { id, name, email }
//   logout()                  -> clears session, sends them to the login page
//   authFetch(url, options)   -> like fetch(), but auto-attaches the auth token
//
// If there's no valid session, it redirects to LOGIN_PAGE below
// before your page's own content/scripts matter.
// ============================================================

const LOGIN_PAGE = "index.html"; // change if your login page lives at a different path

(function () {
  const token = localStorage.getItem("auth_token");
  const userRaw = localStorage.getItem("auth_user");

  if (!token || !userRaw) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    window.currentUser = JSON.parse(userRaw);
  } catch (e) {
    window.location.href = LOGIN_PAGE;
  }
})();

function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  window.location.href = LOGIN_PAGE;
}

function authFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({}, options.headers, {
    Authorization: "Bearer " + localStorage.getItem("auth_token"),
  });
  return fetch(url, options);
}