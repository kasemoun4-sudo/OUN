OUN Clinics — private admin access + notification setup

Files in this package:
- index.html: full app page based on the supplied OUN-main 2.zip, with Firebase SDK and feature modules included before </body>.
- admin.html: existing admin page with an additional Firebase Authentication gate for kasemoun4@gmail.com.
- admin-access.js: adds an entry button on the app; after the approved Firebase account signs in, the button changes to "لوحة التحكم".
- notifications.js: opt-in button for Web Push and FCM token generation on the device.
- sw.js: Firebase Messaging background handler added while retaining offline cache/book support.

Before uploading:
1. Download/keep a backup of the current GitHub repository files.
2. Replace the repository-root files index.html, admin.html, and sw.js with the matching files here.
3. Upload admin-access.js and notifications.js to the same repository root.
4. Commit changes.
5. In Firebase Console > Authentication > Settings > Authorized domains, make sure kasemoun4-sudo.github.io is listed.
6. Test the site over HTTPS. Sign in with kasemoun4@gmail.com and the Firebase password you created. The existing admin page may still ask for its GitHub personal access token and PIN.

Security note:
- This adds a client-side Firebase email allowlist gate to the admin UI. Static GitHub Pages cannot enforce authorization by itself; the existing GitHub PAT remains the permission that allows publishing. Keep the PAT private, scoped only to repository OUN, and never embed it in files.
- This does not yet provide server-side notification sending, per-patient scheduling, or secure token registration. The notification button only requests permission and obtains a device token; it logs the token locally in the browser console and does not upload it.
- Firebase Web API key and VAPID public key are client-side configuration, not server secrets. Never publish a Firebase service-account private key.
- The full index.html and admin.html are based on the uploaded ZIP; if GitHub has newer unrelated edits that are not in that ZIP, reconcile them before replacing.
