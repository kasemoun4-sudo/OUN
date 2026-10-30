'use strict';
// Run in Firebase Functions (trusted server), never in the public GitHub Pages site.
const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db=admin.firestore();
const validKinds = new Set(['period','fertile','ovulation']);

function currentLocalParts(now, tz) {
  const parts=new Intl.DateTimeFormat('en-US', {
    timeZone:tz, hourCycle:'h23', hour:'2-digit', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(now);
  const data=Object.fromEntries(parts.map(({type,value})=>[type,value]));
  return {date:`${data.year}-${data.month}-${data.day}`,hour:Number(data.hour)};
}

exports.sendHealthReminders = onSchedule({
  schedule:'0 * * * *', timeZone:'UTC',region:'europe-west1',
  retryCount:0, timeoutSeconds:540, memory:'256MiB'
}, async () => {
  const now=new Date();
  const stream=db.collection('reminderSubscriptions').where('enabled','==',true).stream();
  let checked=0,sent=0,failed=0;
  for await (const doc of stream) {
    checked++;
    const subscription=doc.data();
    if(!subscription || typeof subscription.timeZone!=='string')continue;
    let local;
    try {local=currentLocalParts(now,subscription.timeZone);} catch {continue;}
    // 9:00 local time, with 10:00 and 11:00 used to retry failed deliveries.
    if(local.hour<9 || local.hour>11)continue;
    const events=Array.isArray(subscription.events) ? subscription.events.slice(0,40) : [];
    const due=events.filter(e=>e && e.date===local.date && validKinds.has(e.kind) && subscription.kinds?.[e.kind]===true).slice(0,7);
    for (const event of due) {
      const marker=doc.ref.collection('sent').doc(`${event.kind}_${event.date}`);
      let currentToken='';
      try {
        const claimed=await db.runTransaction(async tx=>{
          const [parent,done]=await Promise.all([tx.get(doc.ref),tx.get(marker)]);
          if(done.exists || !parent.exists)return false;
          const current=parent.data();
          if(!current?.enabled || !current.kinds?.[event.kind] || !Array.isArray(current.events) ||
            !current.events.some(e=>e?.date===event.date && e?.kind===event.kind) || typeof current.token!=='string')return false;
          currentToken=current.token;
          tx.create(marker,{claimedAt:admin.firestore.FieldValue.serverTimestamp()});
          return true;
        });
        if(!claimed)continue;
        // Generic notification text avoids exposing period or fertility details on lock screen.
        await admin.messaging().send({
          token:currentToken,
          data:{title:'تذكير من عيادات عون',body:'لديك تذكير صحي اليوم. افتحي قسم صحتي للاطلاع على التفاصيل.',url:'./#health'},
          webpush:{headers:{TTL:'86400'}}
        });
        sent++;
        await marker.update({sentAt:admin.firestore.FieldValue.serverTimestamp()}).catch(
          error=>console.warn('Sent but could not update marker',doc.id,error.message)
        );
      }catch(err){
        failed++;
        console.error('Failed health reminder delivery',doc.id,event.kind,err.code||String(err));
        const badToken=['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(err.code);
        if(badToken)await doc.ref.update({enabled:false}).catch(()=>{});
        // Permit retries on later hourly runs in case of transient send failure.
        await marker.delete().catch(()=>{});
      }
    }
  }
  console.log('Health reminders batch', {checked,sent,failed});
});
