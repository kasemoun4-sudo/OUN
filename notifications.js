/* OUN Clinics — opt-in for web push notifications */
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
  const VAPID_KEY = "BJV9_LlvM7N1DoYt3YsNFAlTWirQtjEJVJB6aLcdlKJj-DmI_JkRSbWG2uXlMkG3cTWmkfOcAS2pqpxdcXLj51o";
  const BASE = "https://www.gstatic.com/firebasejs/10.14.1/";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("تعذر تحميل Firebase SDK"));
      document.head.appendChild(script);
    });
  }

  async function messagingService() {
    if (!window.firebase) await loadScript(BASE + "firebase-app-compat.js");
    if (!window.firebase.messaging) await loadScript(BASE + "firebase-messaging-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    return firebase.messaging();
  }

  window.ounEnableNotifications = async function () {
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        alert("المتصفح لا يدعم إشعارات الويب المطلوبة.");
        return;
      }
      if (Notification.permission === "denied") {
        alert("الإشعارات محظورة من إعدادات المتصفح. اسمح بها من إعدادات الموقع.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("لم يتم السماح بالإشعارات.");
        return;
      }

      const registration = await navigator.serviceWorker.register("./sw.js", {
        updateViaCache: "none"
      });
      await navigator.serviceWorker.ready;

      const messaging = await messagingService();
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (!token) throw new Error("لم يتم الحصول على رمز FCM.");

      // The token is intentionally not sent to any database yet.
      console.log("OUN FCM token for local testing:", token);
      alert("تم تفعيل الإشعارات على هذا الجهاز. لم يتم ربطه بعد بخدمة الإرسال الآلي.");

      return token;
    } catch (error) {
      console.error("OUN notification setup failed:", error);
      alert("تعذر تفعيل الإشعارات: " + (error.message || String(error)));
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    #ounNotifyLauncher {
      position:fixed; bottom:calc(78px + env(safe-area-inset-bottom,0px));
      left:10px; z-index:10000; border:1px solid #d7e2e3; border-radius:999px;
      padding:10px 13px; min-height:40px; background:#fff; color:#123C52;
      box-shadow:0 4px 16px #0002; font:700 13px/1.25 system-ui,sans-serif;
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.id = "ounNotifyLauncher";
  button.type = "button";
  button.textContent = "تفعيل الإشعارات";
  button.addEventListener("click", () => window.ounEnableNotifications());
  document.body.appendChild(button);
})();
