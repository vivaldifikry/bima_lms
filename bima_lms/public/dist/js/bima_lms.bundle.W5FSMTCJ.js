(() => {
  // ../bima_lms/bima_lms/public/js/login.js
  console.log("Bima LMS login script loaded");
  frappe.ready(function() {
    console.log("Frappe ready, customizing login...");
    if ($("#login-page").length) {
      console.log("Login page detected");
      $("#login-form").on("submit", function(e) {
        e.preventDefault();
        var email = $("#login-email").val();
        var password = $("#login-password").val();
        console.log("Attempting login for:", email);
        frappe.call({
          method: "bima_lms.api.auth.login_via_postgres",
          args: {
            usr: email,
            pwd: password
          },
          callback: function(r) {
            console.log("Login response:", r);
            var resp = r.message;
            if (typeof resp === "string") {
              $("#login-error").text(resp).show();
              frappe.msgprint(resp);
              return;
            }
            if (resp && resp.http_status_code === 200) {
              window.location.href = resp.redirect_to || "/app";
            } else {
              var error_msg = resp && resp.message || "Login gagal";
              $("#login-error").text(error_msg).show();
              frappe.msgprint(error_msg);
            }
          },
          error: function(err) {
            console.error("Login error:", err);
            $("#login-error").text("Terjadi kesalahan sistem").show();
          }
        });
      });
    }
  });
})();
//# sourceMappingURL=bima_lms.bundle.W5FSMTCJ.js.map
