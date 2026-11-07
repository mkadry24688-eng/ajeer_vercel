    window.addEventListener("DOMContentLoaded", () => {
      const user = localStorage.getItem("portal_logged_in_user");
      if (user) {
        window.location.href = "/index.html";
      }
    });

    document
      .getElementById("loginForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById("username").value.trim();
        const passwordInput = document.getElementById("password").value;

        try {
          let loggedInSessionPayload = null;

          // Authenticate via MongoDB endpoint
          try {
            const srvRes = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });
            if (srvRes.ok) {
              const srvData = await srvRes.json();
              if (srvData && srvData.success && srvData.user) {
                loggedInSessionPayload = srvData.user;
              }
            }
          } catch (errSrv) {
            console.warn("MongoDB auth endpoint warning:", errSrv);
          }

          if (!loggedInSessionPayload) {
            Swal.fire("خطأ", "اسم المستخدم أو كلمة المرور غير صحيحة", "error");
            return;
          }

          // Establish HTTP session cookie on the server
          try {
            await fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user: loggedInSessionPayload })
            });
          } catch (errSession) {
            console.warn("Failed to set session cookie:", errSession);
          }

          localStorage.setItem(
            "portal_logged_in_user",
            JSON.stringify(loggedInSessionPayload)
          );

          localStorage.setItem(
            "ajeer_logged_in_user",
            JSON.stringify(loggedInSessionPayload)
          );

          Swal.fire({
            icon: "success",
            title: "تم تسجيل الدخول!",
            text: `مرحباً ${loggedInSessionPayload.full_name || loggedInSessionPayload.username}`,
            showConfirmButton: false,
            timer: 1500,
          }).then(() => {
            window.location.href = "/index.html";
          });
        } catch (err) {
          console.error("Login error:", err);
          Swal.fire("خطأ", "حدث خطأ أثناء تسجيل الدخول", "error");
        }
      });