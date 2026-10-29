/* OUN Clinics — show the admin entry only to the approved Firebase account */
(async function () {
  "use strict";

  const CONFIG = {
    apiKey: "AIzaSyDbALT5BOoLx0UNh6G_wChUld2wcOynmWU",
    authDomain: "oun-clinics.firebaseapp.com",
    projectId: "oun-clinics",
    storageBucket: "oun-clinics.firebasestorage.app",
    messagingSenderId: "329841110348",
    appId: "1:329841110348:web:c93d3e575764a0ec6df3e9",
    measurementId: "G-C1ZW4E6RZR"
  };
  const ADMIN_EMAIL = "kasemoun4@gmail.com";
  const BASE = "https://www.gstatic.com/firebasejs/10.14.1/";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("تعذر تحميل خدمة تسجيل الدخول."));
      document.head.appendChild(script);
    });
  }

  function addUI() {
    const style = document.createElement("style");
    style.textContent = `
      #ounAdminLauncher,#ounAdminLogout {
        position:fixed; bottom:calc(78px + env(safe-area-inset-bottom,0px));
        z-index:10000; border:0; border-radius:999px; padding:10px 13px;
        box-shadow:0 4px 16px #0002; font:700 13px/1.25 system-ui,sans-serif;
        cursor:pointer; min-height:40px;
      }
      #ounAdminLauncher { right:10px; background:#123C52; color:#fff; }
      #ounAdminLogout { right:126px; background:#fff; color:#123C52; border:1px solid #d7e2e3; }
      #ounAdminLauncher[hidden],#ounAdminLogout[hidden] { display:none!important; }
      @media (max-width:360px) {
        #ounAdminLauncher,#ounAdminLogout { font-size:12px; padding:9px 10px; }
        #ounAdminLogout { right:116px; }
      }
    `;
    document.head.appendChild(style);

    const launcher = document.createElement("button");
    launcher.id = "ounAdminLauncher";
    launcher.type = "button";
    launcher.textContent = "لوحة التحكم";
    launcher.hidden = true;
    launcher.setAttribute("aria-label", "فتح لوحة تحكم عيادات عون");

    const logout = document.createElement("button");
    logout.id = "ounAdminLogout";
    logout.type = "button";
    logout.textContent = "خروج المسؤول";
    logout.hidden = true;

    document.body.append(launcher, logout);
    return { launcher, logout };
  }

  try {
    if (!window.firebase) await loadScript(BASE + "firebase-app-compat.js");
    if (!window.firebase.auth) await loadScript(BASE + "firebase-auth-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);

    const auth = firebase.auth();
    const { launcher, logout } = addUI();

    function updateUI(user) {
      const isAdmin = !!user && String(user.email || "").trim().toLowerCase() === ADMIN_EMAIL;
      launcher.hidden = !isAdmin;
      logout.hidden = !isAdmin;
    }

    auth.onAuthStateChanged(updateUI, error => {
      console.error("OUN admin auth state error:", error);
      updateUI(null);
    });

    launcher.addEventListener("click", () => {
      location.href = new URL("./admin.html", location.href).href;
    });

    logout.addEventListener("click", async () => {
      try {
        await auth.signOut();
        updateUI(null);
      } catch (error) {
        console.error("OUN admin sign-out error:", error);
        alert("تعذر تسجيل الخروج. حاول مرة أخرى.");
      }
    });
  } catch (error) {
    console.error("OUN admin access setup failed:", error);
    // Fail closed: no admin controls are shown if Firebase Auth cannot initialize.
  }
})();
