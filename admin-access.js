/* OUN Clinics — admin-only entry button */
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
      #ounAdminLauncher,#ounAdminLogout,#ounNotifyLauncher {
        position:fixed; bottom:calc(78px + env(safe-area-inset-bottom,0px));
        z-index:10000; border:0; border-radius:999px; padding:10px 13px;
        box-shadow:0 4px 16px #0002; font:700 13px/1.25 system-ui,sans-serif;
        cursor:pointer; min-height:40px;
      }
      #ounAdminLauncher { right:10px; background:#123C52; color:#fff; }
      #ounAdminLogout { right:126px; background:#fff; color:#123C52; border:1px solid #d7e2e3; }
      #ounAdminDialog[hidden] { display:none!important; }
      #ounAdminDialog { position:fixed; inset:0; z-index:10001; display:grid;
        place-items:center; padding:18px; background:#071a20a8; direction:rtl; }
      #ounAdminDialog .oun-card { width:min(100%,420px); background:#fff; color:#123C52;
        border-radius:20px; padding:20px; box-shadow:0 12px 40px #0003; }
      #ounAdminDialog h2 { margin:0 0 8px; font-size:21px; }
      #ounAdminDialog p { margin:0 0 14px; color:#526d75; font-size:14px; }
      #ounAdminDialog label { display:grid; gap:5px; margin:10px 0; font-size:13px; font-weight:700; }
      #ounAdminDialog input { width:100%; min-height:46px; padding:10px 12px; border:1px solid #cbd9dc;
        border-radius:11px; font:16px system-ui,sans-serif; direction:ltr; text-align:left; }
      #ounAdminDialog button { min-height:44px; border-radius:11px; padding:9px 13px; font-weight:700; }
      #ounAdminSubmit { background:#168b87; color:#fff; border:0; width:100%; }
      #ounAdminClose { background:#fff; color:#123C52; border:1px solid #cbd9dc; width:100%; margin-top:8px; }
      #ounAdminError { color:#b3261e!important; margin-top:10px!important; }
      #ounAdminError[hidden] { display:none!important; }
      @media (max-width:360px) {
        #ounAdminLauncher,#ounAdminLogout { font-size:12px; padding:9px 10px; }
        #ounAdminLogout { right:116px; }
      }
    `;
    document.head.appendChild(style);

    const launcher = document.createElement("button");
    launcher.id = "ounAdminLauncher";
    launcher.type = "button";
    launcher.textContent = "دخول المسؤول";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-controls", "ounAdminDialog");

    const logout = document.createElement("button");
    logout.id = "ounAdminLogout";
    logout.type = "button";
    logout.textContent = "خروج";
    logout.hidden = true;

    const dialog = document.createElement("div");
    dialog.id = "ounAdminDialog";
    dialog.hidden = true;
    dialog.innerHTML = `
      <form class="oun-card" id="ounAdminForm" role="dialog" aria-modal="true" aria-labelledby="ounAdminTitle">
        <h2 id="ounAdminTitle">دخول مسؤول عيادات عون</h2>
        <p>تسجيل الدخول متاح للحساب الإداري المعتمد فقط.</p>
        <label>البريد الإلكتروني
          <input id="ounAdminEmail" type="email" autocomplete="username" required value="${ADMIN_EMAIL}">
        </label>
        <label>كلمة المرور
          <input id="ounAdminPassword" type="password" autocomplete="current-password" required>
        </label>
        <button id="ounAdminSubmit" type="submit">تسجيل الدخول</button>
        <button id="ounAdminClose" type="button">إلغاء</button>
        <p id="ounAdminError" hidden role="alert"></p>
      </form>
    `;

    document.body.append(launcher, logout, dialog);
    return { launcher, logout, dialog };
  }

  function showError(dialog, message) {
    const error = dialog.querySelector("#ounAdminError");
    error.textContent = message;
    error.hidden = false;
  }

  try {
    if (!window.firebase) await loadScript(BASE + "firebase-app-compat.js");
    if (!window.firebase.auth) await loadScript(BASE + "firebase-auth-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);

    const auth = firebase.auth();
    const { launcher, logout, dialog } = addUI();
    const form = dialog.querySelector("#ounAdminForm");
    const submit = dialog.querySelector("#ounAdminSubmit");
    const emailInput = dialog.querySelector("#ounAdminEmail");
    const passwordInput = dialog.querySelector("#ounAdminPassword");
    const error = dialog.querySelector("#ounAdminError");
    let isAdmin = false;

    function updateUI(user) {
      isAdmin = !!user && String(user.email || "").toLowerCase() === ADMIN_EMAIL;
      launcher.textContent = isAdmin ? "لوحة التحكم" : "دخول المسؤول";
      logout.hidden = !isAdmin;
    }

    auth.onAuthStateChanged(updateUI);

    launcher.addEventListener("click", () => {
      if (isAdmin) {
        location.href = new URL("./admin.html", location.href).href;
        return;
      }
      error.hidden = true;
      dialog.hidden = false;
      passwordInput.focus();
    });

    dialog.querySelector("#ounAdminClose").addEventListener("click", () => {
      dialog.hidden = true;
      form.reset();
      emailInput.value = ADMIN_EMAIL;
      error.hidden = true;
    });

    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.hidden = true;
    });

    logout.addEventListener("click", async () => {
      try {
        await auth.signOut();
        updateUI(null);
      } catch (e) {
        console.error("OUN admin sign-out error:", e);
      }
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = "جارٍ التحقق…";

      try {
        const email = emailInput.value.trim().toLowerCase();
        if (email !== ADMIN_EMAIL) {
          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة.");
        }

        const credential = await auth.signInWithEmailAndPassword(
          email,
          passwordInput.value
        );

        if (String(credential.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
          await auth.signOut();
          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة.");
        }

        updateUI(credential.user);
        dialog.hidden = true;
        form.reset();
        emailInput.value = ADMIN_EMAIL;
      } catch (e) {
        showError(dialog, e.code === "auth/invalid-credential" ||
          e.code === "auth/wrong-password" ||
          e.code === "auth/user-not-found"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : (e.message || "تعذر تسجيل الدخول. تحقق من إعدادات Firebase."));
      } finally {
        submit.disabled = false;
        submit.textContent = "تسجيل الدخول";
      }
    });
  } catch (error) {
    console.error("OUN admin access setup failed:", error);
    // Fail closed: do not show a working-looking control button if auth cannot initialize.
  }
})();
