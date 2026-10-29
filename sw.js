/*! عيادات عون — offline support */
const PREFIX="oun-",SHELL_CACHE=PREFIX+"shell-v11",BOOK_CACHE=PREFIX+"book-v1",SHELL=["./","./index.html","./manifest.webmanifest"],IS_ASSET=/\.(bin|webp|png|jpg)$/,IS_BOOK=/\/book-\d+\.bin$/;self.addEventListener("install",c=>{c.waitUntil(caches.open(SHELL_CACHE).then(e=>Promise.all([e.addAll(SHELL.map(a=>new Request(a,{cache:"reload"}))),e.add(new Request("./news.json",{cache:"reload"})).catch(()=>{})])).then(()=>self.skipWaiting()))}),self.addEventListener("activate",c=>{c.waitUntil((async()=>{const a=(await caches.keys()).filter(n=>n.startsWith(PREFIX)&&n!==SHELL_CACHE&&n!==BOOK_CACHE),o=await caches.open(BOOK_CACHE);for(const n of a.filter(t=>/^oun-v\d+$/.test(t))){const t=await caches.open(n);for(const i of await t.keys())if(IS_ASSET.test(new URL(i.url).pathname)&&!await o.match(i)){const s=await t.match(i);s&&await o.put(i,s)}}await Promise.all(a.map(n=>caches.delete(n))),await self.clients.claim(),a.length&&(await self.clients.matchAll({type:"window"})).forEach(n=>{n.navigate&&n.navigate(n.url).catch(()=>{})})})())});function save(c,e,a){if(a&&a.ok){const o=a.clone();caches.open(c).then(n=>n.put(e,o))}return a}self.addEventListener("fetch",c=>{const e=c.request;if(e.method!=="GET")return;const a=new URL(e.url);if(a.origin!==self.location.origin||/\.(mp4|webm|mov|m4v)$/i.test(a.pathname))return;if(a.pathname.endsWith("/news.json")){c.respondWith(fetch(e.url,{cache:"no-cache",credentials:"same-origin"}).then(t=>save(SHELL_CACHE,e,t)).catch(()=>caches.match(e,{ignoreSearch:!0})));return}if(IS_BOOK.test(a.pathname)){c.respondWith(caches.match(e,{ignoreSearch:!0}).then(t=>t||fetch(e).then(i=>save(BOOK_CACHE,e,i))));return}if(/\.(webp|png|jpg)$/.test(a.pathname)){c.respondWith((async()=>{const t=await(await caches.open(SHELL_CACHE)).match(e,{ignoreSearch:!0}),i=fetch(e,{cache:"no-cache"}).then(s=>save(SHELL_CACHE,e,s));if(t)return c.waitUntil(i.catch(()=>{})),t;try{return await i}catch{return await caches.match(e,{ignoreSearch:!0})||Response.error()}})());return}const o=fetch(e.mode==="navigate"?e.url:e,{cache:"no-cache",credentials:"same-origin"}).then(t=>(t.ok&&save(SHELL_CACHE,e,t),t));c.waitUntil(o.catch(()=>{}));const n=async()=>await caches.match(e,{ignoreSearch:!0})||(e.mode==="navigate"?await caches.match("./index.html"):void 0);c.respondWith(new Promise(t=>{let i=!1;const s=r=>{i||(i=!0,clearTimeout(h),t(r))},h=setTimeout(async()=>{const r=await n();r&&s(r)},4e3);o.then(s).catch(async()=>s(await n()||Response.error()))}))});

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyDbALT5BOoLx0UNh6G_wChUld2wcOynmWU",
    authDomain: "oun-clinics.firebaseapp.com",
    projectId: "oun-clinics",
    storageBucket: "oun-clinics.firebasestorage.app",
    messagingSenderId: "329841110348",
    appId: "1:329841110348:web:c93d3e575764a0ec6df3e9",
    measurementId: "G-C1ZW4E6RZR"
  });
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "عيادات عون";
  const options = {
    body: payload.notification?.body || "لديك إشعار جديد من عيادات عون",
    icon: "./apple-touch-icon.png"
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }

      return clients.openWindow(
        new URL("./", self.location.href).href
      );
    })
  );
});
