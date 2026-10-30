/* OUN Clinics — private, opt-in Firebase Cloud Messaging subscription.
 * No raw cycle logs, medication notes, or treatment plans are uploaded.
 * Requires deployment of the accompanying scheduled Firebase Function and rules.
 */
(() => {
  'use strict';
  const CONFIG = {
    apiKey: 'AIzaSyDbALT5BOoLx0UNh6G_wChUld2wcOynmWU',
    authDomain: 'oun-clinics.firebaseapp.com',
    projectId: 'oun-clinics',
    storageBucket: 'oun-clinics.firebasestorage.app',
    messagingSenderId: '329841110348',
    appId: '1:329841110348:web:c93d3e575764a0ec6df3e9',
    measurementId: 'G-C1ZW4E6RZR'
  };
  const VAPID_KEY = 'BJV9_LlvM7N1DoYt3YsNFAlTWirQtjEJVJB6aLcdlKJj-DmI_JkRSbWG2uXlMkG3cTWmkfOcAS2pqpxdcXLj51o';
  const BASE='https://www.gstatic.com/firebasejs/10.14.1/';
  const loadScript=src=>new Promise((resolve,reject)=>{
    const elem=document.createElement('script');elem.src=src;elem.onload=resolve;
    elem.onerror=()=>reject(new Error('تعذر تحميل خدمات Firebase؛ تأكدي من الاتصال بالإنترنت.'));
    document.head.appendChild(elem);
  });
  let services=null;
  async function setup() {
    if(services)return services;
    if(!window.firebase)await loadScript(BASE+'firebase-app-compat.js');
    if(!firebase.auth)await loadScript(BASE+'firebase-auth-compat.js');
    if(!firebase.firestore)await loadScript(BASE+'firebase-firestore-compat.js');
    if(!firebase.messaging)await loadScript(BASE+'firebase-messaging-compat.js');
    const app=firebase.apps.find(a=>a.name==='oun-health-reminders') || firebase.initializeApp(CONFIG,'oun-health-reminders');
    const auth=firebase.auth(app), db=firebase.firestore(app), messaging=firebase.messaging(app);
    messaging.onMessage(async payload=>{
      if(Notification.permission!=='granted')return;
      try {
        const reg=await navigator.serviceWorker.ready;
        await reg.showNotification('تذكير من عيادات عون',{
          body:'لديك تذكير صحي اليوم. افتحي قسم صحتي للاطلاع على التفاصيل.',
          icon:'./icon-192.png',badge:'./icon-192.png',tag:'oun-health-reminder',
          data:{url:'./#health'}
        });
      }catch(error){console.warn('OUN foreground notification:',error);}
    });
    services={auth,db,messaging};
    return services;
  }
  async function signedInUser(auth){
    if(!auth.currentUser) await auth.signInAnonymously();
    return auth.currentUser;
  }
  function basicSupport(){
    if(!('Notification' in window)||!('serviceWorker' in navigator)||!window.isSecureContext)
      throw new Error('يجب فتح التطبيق عبر HTTPS على متصفح يدعم إشعارات الويب.');
    if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches)
      throw new Error('على الآيفون، أضيفي التطبيق إلى الشاشة الرئيسية وافتحيه من الأيقونة لتفعيل إشعارات الويب، أو استخدمي تذكيرات التقويم.');
    if(Notification.permission==='denied')throw new Error('الإشعارات محظورة من إعدادات الجهاز. اسمحي بإشعارات موقع عيادات عون أولًا.');
  }
  async function supported(){
    basicSupport();
    if(window.firebase?.messaging?.isSupported && !(await firebase.messaging.isSupported()))
      throw new Error('هذا المتصفح لا يدعم Firebase Push؛ استخدمي التذكيرات عبر التقويم.');
  }
  async function context(){
    await supported();
    const services=await setup(),user=await signedInUser(services.auth);
    if(!user)throw new Error('تعذر إنشاء اشتراك خاص بهذا الجهاز.');
    return {...services,user};
  }
  function validateEvents(events){
    if(!Array.isArray(events)||events.length>40)throw new Error('بيانات المواعيد غير صالحة.');
    const today=new Date();today.setHours(0,0,0,0);
    const max=new Date(today);max.setDate(max.getDate()+126);
    return events.map(event=>{
      if(!event || !/^\d{4}-\d{2}-\d{2}$/.test(String(event.date)) || !['period','fertile','ovulation'].includes(event.kind))
        throw new Error('تاريخ تنبيه غير صالح.');
      const d=new Date(event.date+'T12:00:00');
      if(Number.isNaN(d.getTime())||d<today||d>max)throw new Error('تنبيه بتاريخ خارج المدة المسموحة.');
      return {date:event.date,kind:event.kind};
    });
  }
  async function subscribe(events,prefs,{requestPermission=false,allowEmpty=false}={}) {
    if(!Array.isArray(events)||(!events.length&&!allowEmpty))throw new Error('لا توجد مواعيد متوقعة للتنبيه؛ سجلي دورة حديثة أولًا.');
    const schedule=validateEvents(events);
    if(requestPermission){
      // Request from the original click gesture; do not await SDK loading first.
      basicSupport();
      if(Notification.permission!=='granted'){
        const result=await Notification.requestPermission();
        if(result!=='granted')throw new Error('لم تتم الموافقة على إشعارات الجهاز.');
      }
    }else if(Notification.permission!=='granted')throw new Error('إذن الإشعارات غير متاح.');
    const {auth,db,messaging,user}=await context();
    const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    const token=await messaging.getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
    if(!token)throw new Error('لم يتم استخراج رمز الإشعارات من Firebase.');
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Cairo';
    // This is the only information uploaded: anonymous device token, time zone,
    // reminder types and future event dates. Health notes never leave localStorage.
    await db.collection('reminderSubscriptions').doc(user.uid).set({
      enabled:true,
      token,
      timeZone:tz,
      kinds:{period:!!prefs.period,fertile:!!prefs.fertile,ovulation:!!prefs.ovulation},
      events:schedule,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }
  window.ounEnableNotifications=async (events,prefs)=>subscribe(events,prefs,{requestPermission:true});
  window.ounSyncReminders=async (events,prefs)=>{
    if(localStorage.getItem('oun-health-reminder-enabled')!=='true')return false;
    // Empty schedules must also be saved, so deleting a cycle stops old reminders.
    return subscribe(events,prefs,{requestPermission:false,allowEmpty:true});
  };
  window.ounDisableNotifications=async()=>{
    // Do not erase local enabled flag until the server subscription is deleted.
    const {auth,db,messaging}=await setup();
    if(auth.currentUser) {
      await db.collection('reminderSubscriptions').doc(auth.currentUser.uid).delete();
    } else {
      await new Promise((resolve,reject)=>{
        const unsub=auth.onAuthStateChanged(()=>{unsub();resolve();},reject);
      });
      if(auth.currentUser)await db.collection('reminderSubscriptions').doc(auth.currentUser.uid).delete();
    }
    try{await messaging.deleteToken();}catch(e){console.warn('FCM token removal failed',e);}
    return true;
  };
})();
