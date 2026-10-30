/* OUN Clinics — patient-controlled health sharing and cycle reminder preferences.
 * All clinical notes remain local unless the patient explicitly opens WhatsApp.
 */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  if (!el('healthContact') || !el('healthReminders')) return;
  const KEY = 'oun-health-reminder-prefs';
  const PHONE = '201022014744'; // Existing OUN clinic WhatsApp number.
  const KINDS = ['period', 'fertile', 'ovulation'];
  const LABELS = { period: 'الدورة الشهرية المتوقعة', fertile: 'يوم خصوبة متوقع', ovulation: 'يوم التبويض المتوقع' };
  const pad = n => String(n).padStart(2, '0');
  const dateString = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateFromString = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(Number(s.slice(0,4)), Number(s.slice(5,7))-1, Number(s.slice(8)), 12) : new Date(NaN);
  const validDate = s => !Number.isNaN(dateFromString(s).getTime()) && dateString(dateFromString(s)) === s;
  const shift = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const diff = (a, b) => Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()) - Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())) / 86400000);
  const pretty = s => validDate(s) ? new Intl.DateTimeFormat('ar-EG', { day:'numeric', month:'long', year:'numeric' }).format(dateFromString(s)) : 'غير محدد';
  const get = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem('oun-'+key)); return value ?? fallback; } catch { return fallback; } };
  const safe = (value, max=500) => String(value ?? '').trim().slice(0, max);
  const prefs = () => Object.fromEntries(KINDS.map(k => [k, !!el(({period:'hrPeriod',fertile:'hrFertile',ovulation:'hrOvulation'})[k]).checked]));

  function cycleModel() {
    const today = dateFromString(dateString(new Date()));
    const cycles = (Array.isArray(get('cycle-cycles',[])) ? get('cycle-cycles',[]) : [])
      .filter(x => x && validDate(x.start) && x.start <= dateString(today))
      .sort((a,b) => a.start.localeCompare(b.start));
    const settings = get('cycle-settings', {}) || {};
    const intervals = cycles.slice(1).map((x,i) => diff(dateFromString(x.start), dateFromString(cycles[i].start))).filter(n => n >= 20 && n <= 45);
    const recent = intervals.slice(-6);
    const manual = Number(settings.length);
    const length = recent.length ? Math.round(recent.reduce((a,b)=>a+b,0)/recent.length) : (Number.isInteger(manual) && manual>=20 && manual<=45 ? manual : 28);
    const durations = cycles.filter(c => validDate(c.end) && c.end >= c.start).map(c => diff(dateFromString(c.end),dateFromString(c.start))+1).filter(n=>n>0 && n<=12).slice(-6);
    const periodLength = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : Math.max(2,Math.min(10,Number(settings.periodLength)||5));
    const last = cycles.at(-1) || null;
    const stale = !last || diff(today,dateFromString(last.start)) > length+45;
    const events = [];
    if (last && !stale) {
      const start = dateFromString(last.start);
      for (let i=1; i<=4; i++) {
        const next = shift(start, length*i), ov = shift(next,-14);
        const add = (day,kind) => { const date = dateString(day); if (date >= dateString(today) && diff(day,today) <= 125) events.push({date,kind}); };
        add(next,'period');
        for(let j=-5; j<0; j++) add(shift(ov,j),'fertile');
        add(ov,'ovulation');
      }
    }
    events.sort((a,b)=>a.date.localeCompare(b.date) || KINDS.indexOf(a.kind)-KINDS.indexOf(b.kind));
    return {today:dateString(today), cycles, last, length, periodLength, stale, events};
  }
  const filteredEvents = () => cycleModel().events.filter(x=>prefs()[x.kind]);

  function buildMessage() {
    const model = cycleModel(), name = safe(el('hcName').value,70), question=safe(el('hcMessage').value,600);
    const parts = [`السلام عليكم يا دكتور قاسم،${name ? `\nالاسم: ${name}` : ''}`, question || 'أرغب في مراجعة بياناتي الصحية مع حضرتك.'];
    let sections = 0;
    if (el('hcPeriod').checked) {
      sections++;
      const c = model.cycles.slice(-6).reverse();
      const lines = ['*بيانات الدورة الشهرية*'];
      if (!c.length) lines.push('لم يتم تسجيل دورات بعد.');
      else {
        lines.push(`متوسط طول الدورة: ${model.length} يوم`, `مدة النزول المعتادة: ${model.periodLength} أيام`);
        for(const r of c) lines.push(`• بدأت: ${pretty(r.start)}${r.end && validDate(r.end)?` — انتهت: ${pretty(r.end)}`:''}${r.notes?` — ملاحظة: ${safe(r.notes,180)}`:''}`);
        const next=model.events.find(e=>e.kind==='period');
        if (next) lines.push(`موعد الدورة القادمة المتوقع: ${pretty(next.date)}`);
        else lines.push('لا يوجد توقع موثوق حاليًا؛ يُرجى مراجعة انتظام الدورة مع الطبيب.');
      }
      parts.push(lines.join('\n'));
    }
    if(el('hcFertile').checked) {
      sections++;
      const upcoming = model.events.filter(e=>e.kind==='ovulation').slice(0,2);
      parts.push('*توقعات الخصوبة (تقديرية)*\n'+(upcoming.length?upcoming.map(e=>`• تبويض متوقع: ${pretty(e.date)} — الخصوبة تبدأ تقريبًا قبل 5 أيام`).join('\n'):'لا توجد توقعات صالحة حاليًا.'));
    }
    if(el('hcSymptoms').checked) {
      sections++;
      const cutoff=dateString(shift(dateFromString(model.today),-30));
      const days=(Array.isArray(get('cycle-days',[]))?get('cycle-days',[]):[]).filter(d=>d && validDate(d.date) && d.date>=cutoff && d.date<=model.today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
      const translateFlow={none:'لا يوجد نزول',spotting:'تنقيط',light:'خفيف',medium:'متوسط',heavy:'غزير'};
      parts.push('*الأعراض والتسجيلات اليومية (آخر 30 يومًا)*\n'+(days.length?days.map(d=>`• ${pretty(d.date)}: ${translateFlow[d.flow]||safe(d.flow,25)||'غير محدد'}؛ ألم ${Number(d.pain)||0}/10${Array.isArray(d.sym)&&d.sym.length?`؛ ${d.sym.slice(0,6).join('، ')}`:''}${d.symptoms?`؛ ${safe(d.symptoms,140)}`:''}`).join('\n'):'لا توجد تسجيلات حديثة.'));
    }
    if(el('hcPlan').checked) {
      sections++;
      const plan=get('fertility-plan',null);
      const followups=Array.isArray(get('fertility-followups',[]))?get('fertility-followups',[]):[];
      if (plan && typeof plan==='object') {
        const lines=['*الخطة العلاجية كما دوّنتها المريضة*',`العنوان: ${safe(plan.name,100)}`,`تعليمات الطبيب: ${safe(plan.instructions,1500)}`];
        if(plan.meds) lines.push(`الأدوية/الجرعات المكتوبة: ${safe(plan.meds,700)}`);
        if(validDate(plan.start)) lines.push(`بداية الخطة: ${pretty(plan.start)}`);
        if(validDate(plan.review)) lines.push(`موعد المراجعة: ${pretty(plan.review)}`);
        const status={done:'نُفذت',partial:'نُفذت جزئيًا',missed:'تعذر التنفيذ',review:'تحتاج مراجعة'};
        followups.filter(x=>x&&validDate(x.date)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4)
          .forEach(x=>lines.push(`• متابعة ${pretty(x.date)}: ${status[x.status]||'غير محدد'}${x.notes?` — ${safe(x.notes,160)}`:''}`));
        parts.push(lines.join('\n'));
      } else parts.push('*الخطة العلاجية*: لم تُسجل خطة بعد.');
    }
    if(sections) parts.push('هذه البيانات أدخلتها المريضة والتواريخ المستقبلية تقديرية، وتحتاج مراجعة الطبيب.');
    return {text:parts.join('\n\n'), valid:sections>0 || !!question};
  }

  function updateContact() {
    const {text,valid}=buildMessage(); el('hcPreview').value=text;
    el('hcSend').href=valid?'https://wa.me/'+PHONE+'?text='+encodeURIComponent(text):'#';
    el('hcSend').setAttribute('aria-disabled',String(!valid));
    el('hcCopy').disabled=!valid;
  }
  const storedName=get('name','');if(typeof storedName==='string') el('hcName').value=storedName.slice(0,70);
  el('healthContact').addEventListener('input',updateContact);
  el('healthContact').addEventListener('change',updateContact);
  el('hcSend').addEventListener('click',e=>{if(!buildMessage().valid) e.preventDefault();});
  el('hcCopy').addEventListener('click',async()=>{
    if(!buildMessage().valid)return;
    try {
      if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(el('hcPreview').value);
      else { el('hcPreview').select(); if(!document.execCommand('copy')) throw new Error('copy'); }
      el('hcCopy').textContent='تم نسخ الرسالة ✓';setTimeout(()=>el('hcCopy').textContent='نسخ الرسالة',2500);
    } catch { el('hcCopy').textContent='حددي النص وانسخيه يدويًا'; }
  });

  const defaults={period:true,fertile:true,ovulation:true};
  const saved=get('health-reminder-prefs', defaults);
  for(const [kind,id] of [['period','hrPeriod'],['fertile','hrFertile'],['ovulation','hrOvulation']]) el(id).checked=saved[kind]!==false;
  const isEnabled=()=>localStorage.getItem('oun-health-reminder-enabled')==='true';
  function updateReminders() {
    const model=cycleModel();
    const nextPeriod=model.events.find(e=>e.kind==='period');
    const nextOv=model.events.find(e=>e.kind==='ovulation');
    el('hrNext').textContent=!model.last?'سجلي أول يوم من آخر دورة لعرض المواعيد وتفعيل التنبيهات.':model.stale?'مر وقت طويل على آخر دورة مسجلة؛ سجلي دورة جديدة قبل تفعيل التذكيرات.':`الدورة القادمة: ${nextPeriod?pretty(nextPeriod.date):'غير متاحة'} | التبويض المتوقع: ${nextOv?pretty(nextOv.date):'غير متاح'}`;
    el('hrEnable').hidden=isEnabled();
    el('hrDisable').hidden=!isEnabled();
    el('hrCalendar').disabled=!filteredEvents().length;
    if(!isEnabled()) el('hrStatus').textContent='التنبيهات الفورية غير مفعّلة على هذا الجهاز. يمكن استخدام تذكيرات التقويم.';
    else el('hrStatus').textContent=typeof Notification!=='undefined' && Notification.permission==='granted'?'التنبيهات مفعّلة على هذا الجهاز؛ يلزم تشغيل الإرسال المجدول على Firebase لاستلامها والتطبيق مغلق.':'تم حفظ اختيار التفعيل، لكن إذن إشعارات المتصفح غير متاح حاليًا.';
  }
  let pendingSync=null;
  const sync=async()=>{
    if(!isEnabled()||!window.ounSyncReminders)return;
    try { await window.ounSyncReminders(filteredEvents(),prefs()); }
    catch(e) { console.warn('OUN reminder resync failed',e); el('hrStatus').textContent='تعذر تحديث مواعيد الإشعارات على الخادم؛ استخدمي التقويم مؤقتًا.'; }
  };
  const refresh=()=>{updateContact();updateReminders();};
  const scheduleRefresh=()=>{clearTimeout(pendingSync);pendingSync=setTimeout(()=>{refresh();sync();},600);};
  el('healthReminders').addEventListener('change',()=>{
    localStorage.setItem(KEY,JSON.stringify(prefs())); refresh(); scheduleRefresh();
  });
  el('hrEnable').addEventListener('click',async()=>{
    const model=cycleModel(), events=filteredEvents();
    if(!model.last || model.stale) {el('hrStatus').textContent='سجلي تاريخ دورة حديثة أولًا.';return;}
    if(!events.length){el('hrStatus').textContent='اختاري نوع تنبيه واحدًا على الأقل.';return;}
    const button=el('hrEnable');button.disabled=true;button.textContent='جاري تفعيل التنبيهات…';
    try {
      if(!window.ounEnableNotifications) throw new Error('خدمة الإشعارات غير متاحة حاليًا.');
      await window.ounEnableNotifications(events,prefs());
      localStorage.setItem('oun-health-reminder-enabled','true');
      updateReminders();el('hrStatus').textContent='تم تسجيل الجهاز ومواعيد التذكير مع خدمة الإشعارات. ستصل التذكيرات بعد نشر وظيفة الإرسال المجدول على Firebase.';
    } catch(e) {el('hrStatus').textContent= e.message||'تعذر تفعيل التنبيهات. يمكنك استخدام تقويم الهاتف.';}
    finally {button.disabled=false;button.textContent='تفعيل التنبيهات';}
  });
  el('hrDisable').addEventListener('click',async()=>{
    const button=el('hrDisable');button.disabled=true;
    try {
      if(!window.ounDisableNotifications)throw new Error('تعذر الاتصال بخدمة الإشعارات لإيقاف الاشتراك.');
      await window.ounDisableNotifications();
      localStorage.removeItem('oun-health-reminder-enabled');
      updateReminders();el('hrStatus').textContent='تم إيقاف الاشتراك في إشعارات هذا الجهاز.';
    }catch(e) {el('hrStatus').textContent='تعذر إيقاف الاشتراك على الخادم: '+(e.message||'خطأ في الاتصال')+'؛ حظري إشعارات الموقع من إعدادات المتصفح إذا لزم.';}
    finally{button.disabled=false;}
  });
  function icsEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');}
  el('hrCalendar').addEventListener('click',()=>{
    const events=filteredEvents();if(!events.length)return;
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//OUN Clinics//Health Reminders//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEscape('تذكيرات صحتي')];
    for(const e of events){
      const day=e.date.replace(/-/g,'');
      lines.push('BEGIN:VEVENT',`UID:oun-${e.kind}-${day}@oun-clinics`,`DTSTAMP:${stamp}`,`DTSTART:${day}T090000`,`DTEND:${day}T091000`,'SUMMARY:'+icsEscape(LABELS[e.kind]),'DESCRIPTION:'+icsEscape('موعد تقديري من مفكرة صحتي. لا يستخدم وحده لتحديد الخصوبة أو منع الحمل.'),'BEGIN:VALARM','TRIGGER:-PT0M','ACTION:DISPLAY','DESCRIPTION:'+icsEscape('تذكير من عيادات عون'),'END:VALARM','END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='oun-health-reminders.ics';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
    el('hrStatus').textContent='تم تجهيز ملف مواعيد التقويم. افتحيه وأضيفي المواعيد مع السماح بتنبيهات تطبيق التقويم. إذا تغيّرت الدورة حمّلي ملفًا جديدًا؛ المواعيد السابقة لا تُحدّث تلقائيًا.';
  });
  // Original app persists cycle updates in its own handlers. Refresh after the save completes.
  ['cyStartForm','cycleForm','dayForm','planForm','followupForm'].forEach(id => el(id)?.addEventListener('submit',scheduleRefresh));
  ['cyPeriodBtn','cyHistory','dayClear','followupHistory','usualCycle','usualPeriod'].forEach(id=>el(id)?.addEventListener('click',scheduleRefresh));
  ['usualCycle','usualPeriod'].forEach(id=>el(id)?.addEventListener('change',scheduleRefresh));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) { refresh();sync(); }});
  window.addEventListener('pageshow',refresh);
  refresh();
  if(isEnabled() && typeof Notification!=='undefined' && Notification.permission==='granted') sync();
})();
