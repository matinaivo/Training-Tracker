if(!window.CSS)window.CSS={};if(!CSS.escape)CSS.escape=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c);
const STORAGE_KEY='trainingTrackerV14CleanFromV11'; // ab V14/V15 dauerhaft beibehalten
const LEGACY_STORAGE_KEYS=[
 'trainingTrackerGenericV12',
 'trainingTrackerRookieIvoV1',
 'trainingTrackerV14Generic',
 'trainingTrackerStableV1'
];
const defaultCategories={
 'BH':['Fußarbeit','180° Kehrtwendung','Winkel links','Winkel rechts','Grundstellung','Anhalten mit Grundstellung','Vorsitz','Abrufen mit Hier','Sitz','Platz','Steh','Sitz aus der Bewegung','Platz aus der Bewegung','Steh aus der Bewegung','Ablage','Gruppe'],
 'IGP':['Voraus','Apport ebenerdig','Apport Sprung','Apport Kletterwand','Hürde','Schrägwand'],
 'Schutzdienst':['Revieren','Verbellen','Helferfokus','Rückentransport','Seitentransport','Kurze Flucht','Lange Flucht','Angriff aus Bewachung','Überfall aus Transport','Aus'],
 'Obedience':['Distanzkontrolle','Box','Richtungsapport','Pylon','Positionswechsel','Identifikation'],
 'Nasenarbeit':['Fährte','Fährte Abgang','Verlorensuche','Anzeige','Geruchsdifferenzierung','Banknotensuche'],
 'Trainingsmethoden':['Futtertreiben','Clicker-Konditionierung','Nasentarget','Vorderpfotentarget / Vorne','Hinterpfotentarget / Hinten','Ganz drauf','Vier Pfoten','Fokus Training Futter','Fokus Training Objekt'],
 'Fitness':['Laufband','Togo Ball','Wackelbrett','Propriozeptionsbälle','Cavaletti','Slalomstangen','Pylonen','Balancekissen','Balancieren'],
 'Tricks':['Pfote','Pfote links','Pfote rechts','Männchen','Schlafen','Zurück'],
 'Basics':['Sitzen','Liegen','Down','Leg dich hin','Rückruf','Zu mir','Gib es mir','Links','Rechts'],
 'Spaziergang':['Besitzerorientierung','Leinenführigkeit kurze Leine','Leinenführigkeit Schleppleine','Raus / Auf den Weg'],
 'Medical Training':['Kooperationssignal','Maulkorbtraining','Hochheben','Fiebermessen','Krallen schneiden','Tablettengabe','Bürsten','Augentropfen','Ohrensäubern'],
 'Entspannung':['Ruhetraining','Boxentraining','Deckentraining','Entspannungssignal','Anbinden','Alleine bleiben','Warten']
};

const categoryBlocks=[
 {name:'Hundesport',categories:['BH','IGP','Schutzdienst','Obedience','Nasenarbeit']},
 {name:'Training & Aufbau',categories:['Trainingsmethoden','Fitness','Tricks','Basics']},
 {name:'Alltag & Management',categories:['Spaziergang','Medical Training','Entspannung']}
];
function blockForCategory(cat){
 const b=categoryBlocks.find(x=>x.categories.includes(cat));
 return b?b.name:'Weitere';
}

const rules={'Laufband':1,'Togo Ball':2,'Wackelbrett':1,'Propriozeptionsbälle':1,'Balancekissen':1,'Cavaletti':1,'Slalomstangen':1,'Pylonen':1,'Fährte':1,'Fährte Abgang':1,'Verloren Suche':1,'Anzeige':1,'Geruchsdifferenzierung':1,'Banknotensuche':1,'Hürde':1,'Schrägwand':2};
const clubSubs=new Set(['Revieren','Hürde','Schrägwand','Verbellen']);
const frequencyOptions=[
 {value:'daily',label:'täglich',days:1},
 {value:'paused',label:'pausiert',days:999999},
 {value:'2d',label:'alle 2 Tage',days:2},
 {value:'3d',label:'alle 3 Tage',days:3},
 {value:'2w',label:'2× pro Woche',days:4},
 {value:'1w',label:'1× pro Woche',days:7},
 {value:'14d',label:'alle 14 Tage',days:14},
 {value:'1m',label:'1× pro Monat',days:30}
];
function freqDays(value){return (frequencyOptions.find(f=>f.value===value)||frequencyOptions[0]).days}
function freqLabel(value){return (frequencyOptions.find(f=>f.value===value)||frequencyOptions[0]).label}

let data=load(), currentMonth=new Date(), selectedDay=null, editingId=null;
let returnViewAfterEdit='today';
let returnDogAfterEdit=null;
let pendingDeleteId=null;
const UI_STATE_KEY='trainingTrackerV27UiState';

function appConfirm({title,message,confirmText='OK',danger=false}){
 return new Promise(resolve=>{
   const modal=document.getElementById('appModal');
   const titleEl=document.getElementById('appModalTitle');
   const bodyEl=document.getElementById('appModalBody');
   const cancelBtn=document.getElementById('appModalCancel');
   const confirmBtn=document.getElementById('appModalConfirm');
   if(!modal||!titleEl||!bodyEl||!cancelBtn||!confirmBtn){
     resolve(confirm((title||'Bestätigen')+'\n\n'+(message||'')));
     return;
   }
   titleEl.textContent=title||'Bestätigen';
   bodyEl.innerHTML=String(message||'').split('\n').map(line=>`<p>${esc(line)}</p>`).join('');
   confirmBtn.textContent=confirmText||'OK';
   confirmBtn.classList.toggle('danger',!!danger);
   modal.classList.remove('hidden');
   const cleanup=(val)=>{
     modal.classList.add('hidden');
     confirmBtn.onclick=null;
     cancelBtn.onclick=null;
     modal.onclick=null;
     resolve(val);
   };
   confirmBtn.onclick=()=>cleanup(true);
   cancelBtn.onclick=()=>cleanup(false);
   modal.onclick=(e)=>{if(e.target===modal)cleanup(false)};
 });
}

function getUiState(){try{return JSON.parse(localStorage.getItem(UI_STATE_KEY)||'{}')}catch{return {}}}
function setUiState(patch){const s={...getUiState(),...patch};localStorage.setItem(UI_STATE_KEY,JSON.stringify(s));}
function rememberSelect(id){const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>setUiState({[id]:el.value}));}
function restoreSelect(id){const el=document.getElementById(id), s=getUiState(); if(el && s[id] && [...el.options].some(o=>o.value===s[id])) el.value=s[id];}
function dogGroupKey(date,dog){return 'dogGroup_'+date+'_'+dog}
function isDogGroupCollapsed(date,dog){return !!getUiState()[dogGroupKey(date,dog)]}
function toggleDogGroup(date,dog){
 if(date)selectedDay=date;
 const key=dogGroupKey(date,dog);
 const s=getUiState();
 setUiState({[key]:!s[key]});
 renderDayDetails();
}

function syncDogSelection(sourceId){
 const source=document.getElementById(sourceId);
 if(!source)return;
 const val=source.value;
 if(!val || val==='__all__')return;
 setUiState({currentDog:val, entryDog:val, todayDog:val, balanceDog:val, calendarDog:val});
 ['entryDog','todayDog','balanceDog','calendarDog'].forEach(id=>{
   const el=document.getElementById(id);
   if(el && [...el.options].some(o=>o.value===val)) el.value=val;
 });
 renderToday();renderBalance();renderExercises();renderCalendar();
}
function restoreGlobalDog(){
 const s=getUiState();
 const val=s.currentDog;
 if(!val || !data.dogs.includes(val))return;
 ['entryDog','todayDog','balanceDog','calendarDog'].forEach(id=>{
   const el=document.getElementById(id);
   if(el && [...el.options].some(o=>o.value===val)) el.value=val;
 });
}


function load(){
 const raw=localStorage.getItem(STORAGE_KEY);
 if(!raw) return normalize({});
 let parsed=null;
 try{
   parsed=JSON.parse(raw);
 }catch(err){
   console.error('Training Tracker: Speicher kann nicht gelesen werden.', err);
   window.__storageLoadError=true;
   return normalize({});
 }
 try{
   return normalize(parsed);
 }catch(err){
   console.error('Training Tracker: Migration/Normalisierung ist fehlgeschlagen. App startet im Reparaturmodus.', err);
   window.__repairMode=true;
   return normalize({});
 }
}
function normalize(x){
 let d={dogs:[],categories:structuredClone(defaultCategories),profiles:{},entries:[],...x};
 if(!Array.isArray(d.dogs))d.dogs=[];
 if(!d.profiles || typeof d.profiles!=='object')d.profiles={};
 if(!Array.isArray(d.entries))d.entries=[];
 if(!d.categories || typeof d.categories!=='object')d.categories=structuredClone(defaultCategories);

 // Kategorien/Einträge migrieren, aber Hunde/Profile nicht verlieren.
 migrateCategoriesAndEntries(d);

 // WICHTIG: Beim ersten Laden darf nicht ensureProfile() genutzt werden,
 // weil die globale Variable data zu diesem Zeitpunkt noch nicht initialisiert ist.
 d.dogs.forEach(dog=>ensureProfileInDataObject(d,dog));
 migrateV78GibEsMirProfiles(d);
 cleanupV77Profiles(d);
 return d;
}


function migrateV78GibEsMirProfiles(target){
 Object.values(target.profiles||{}).forEach(p=>{
   ['active','frequency','mastered'].forEach(bucket=>{
     if(!p[bucket])return;
     const oldKey="Basics||Gib's mir";
     const newKey="Basics||Gib es mir";
     if(Object.prototype.hasOwnProperty.call(p[bucket],oldKey)){
       if(!Object.prototype.hasOwnProperty.call(p[bucket],newKey))p[bucket][newKey]=p[bucket][oldKey];
       delete p[bucket][oldKey];
     }
   });
 });
}
function cleanupV77Profiles(target){
 Object.values(target.profiles||{}).forEach(p=>{
   ['active','frequency','mastered'].forEach(bucket=>{
     if(!p[bucket])return;
     Object.keys(p[bucket]).forEach(key=>{
       if(key.startsWith('Sonstiges||')||key==='Medical Training||Fokus Training Futter'||key==='Medical Training||Fokus Training Objekt'){
         delete p[bucket][key];
       }
     });
   });
 });
}
function ensureProfileInDataObject(target,dog){
 if(!dog)return;
 if(!target.profiles[dog])target.profiles[dog]={active:{},frequency:{},mastered:{}};
 if(!target.profiles[dog].active)target.profiles[dog].active={};
 if(!target.profiles[dog].frequency)target.profiles[dog].frequency={};
 if(!target.profiles[dog].mastered)target.profiles[dog].mastered={};
 Object.entries(target.categories).flatMap(([cat,subs])=>(Array.isArray(subs)?subs:[]).map(sub=>({cat,sub}))).forEach(({cat,sub})=>{
   const kk=cat+'||'+sub;
   if(typeof target.profiles[dog].active[kk]!=='boolean')target.profiles[dog].active[kk]=false;
   if(!target.profiles[dog].frequency[kk])target.profiles[dog].frequency[kk]='1w';
   if(typeof target.profiles[dog].mastered[kk]!=='boolean')target.profiles[dog].mastered[kk]=false;
 });
}
function migrateCategoriesAndEntries(d){
 const removedSubs=new Set(['Schutzdienst Technik','Schutzdienst aktiv','Schutzdiensttechnik']);
 const renameSub={
  'Abrufen / Rückruf':'Rückruf',
  'Hier':'Abrufen mit Hier',
  'Grundposition':'Grundstellung',
  'Kehrtwendungen':'180° Kehrtwendung',
  'Apport':'Apport ebenerdig',
  'Apport ebenerdig':'Apport ebenerdig',
  'Gegenstandssuche':'Verlorensuche',
  'Verloren Suche':'Verlorensuche',
  'Technik':null,
  'Aktiver Schutzdienst':null,
  'Dehnen / Mobilisation':null,
  'Box':'Boxentraining',
  'Decke':'Deckentraining',
  'Bett':null,
  'Ruhiges Warten':'Ruhetraining',
  'Impulskontrolle':'Impulskontrolle im Alltag',
  'Focus':'Fokus Training Futter',
  'Fokus':'Fokus Training Futter',
  "Gib's mir":'Gib es mir',
  'Gib es mir':'Gib es mir'
 };
 const moveCat={
  'Fußarbeit':'BH','180° Kehrtwendung':'BH','Winkel links':'BH','Winkel rechts':'BH','Grundstellung':'BH','Anhalten mit Grundstellung':'BH','Vorsitz':'BH','Abrufen mit Hier':'BH','Sitz':'BH','Platz':'BH','Steh':'BH','Sitz aus der Bewegung':'BH','Platz aus der Bewegung':'BH','Steh aus der Bewegung':'BH','Ablage':'BH','Gruppe':'BH',
  'Voraus':'IGP','Apport ebenerdig':'IGP','Apport Sprung':'IGP','Apport Kletterwand':'IGP','Hürde':'IGP','Schrägwand':'IGP',
  'Revieren':'Schutzdienst','Verbellen':'Schutzdienst','Helferfokus':'Schutzdienst','Rückentransport':'Schutzdienst','Seitentransport':'Schutzdienst','Kurze Flucht':'Schutzdienst','Lange Flucht':'Schutzdienst','Angriff aus Bewachung':'Schutzdienst','Überfall aus Transport':'Schutzdienst','Aus':'Schutzdienst',
  'Distanzkontrolle':'Obedience','Box':'Obedience','Richtungsapport':'Obedience','Pylon':'Obedience','Positionswechsel':'Obedience','Identifikation':'Obedience',
  'Fährte':'Nasenarbeit','Fährte Abgang':'Nasenarbeit','Verlorensuche':'Nasenarbeit','Anzeige':'Nasenarbeit','Geruchsdifferenzierung':'Nasenarbeit','Banknotensuche':'Nasenarbeit',
  'Futtertreiben':'Trainingsmethoden','Clicker-Konditionierung':'Trainingsmethoden','Nasentarget':'Trainingsmethoden','Vorderpfotentarget / Vorne':'Trainingsmethoden','Hinterpfotentarget / Hinten':'Trainingsmethoden','Ganz drauf':'Trainingsmethoden','Vier Pfoten':'Trainingsmethoden','Fokus Training Futter':'Trainingsmethoden','Fokus Training Objekt':'Trainingsmethoden','Focus':'Trainingsmethoden','Fokus':'Trainingsmethoden',
  'Laufband':'Fitness','Togo Ball':'Fitness','Wackelbrett':'Fitness','Propriozeptionsbälle':'Fitness','Cavaletti':'Fitness','Slalomstangen':'Fitness','Pylonen':'Fitness','Balancekissen':'Fitness','Balancieren':'Fitness',
  'Pfote':'Tricks','Pfote links':'Tricks','Pfote rechts':'Tricks','Männchen':'Tricks','Schlafen':'Tricks','Zurück':'Tricks',
  'Sitzen':'Basics','Liegen':'Basics','Down':'Basics','Leg dich hin':'Basics','Rückruf':'Basics','Zu mir':'Basics',"Gib es mir":'Basics','Links':'Basics','Rechts':'Basics',
  'Besitzerorientierung':'Spaziergang','Leinenführigkeit kurze Leine':'Spaziergang','Leinenführigkeit Schleppleine':'Spaziergang','Raus / Auf den Weg':'Spaziergang',
  'Kooperationssignal':'Medical Training','Medical Training':'Medical Training','Maulkorbtraining':'Medical Training','Hochheben':'Medical Training','Fiebermessen':'Medical Training','Krallen schneiden':'Medical Training','Tablettengabe':'Medical Training','Bürsten':'Medical Training','Augentropfen':'Medical Training','Ohrensäubern':'Medical Training',
  'Ruhetraining':'Entspannung','Boxentraining':'Entspannung','Deckentraining':'Entspannung','Entspannungssignal':'Entspannung','Anbinden':'Entspannung','Alleine bleiben':'Entspannung','Warten':'Entspannung'
 };
 d.entries=(d.entries||[]).map(e=>{
   e.exercises=(e.exercises||[]).map(ex=>{
     let sub=renameSub.hasOwnProperty(ex.subcategory)?renameSub[ex.subcategory]:ex.subcategory;
     if(!sub||removedSubs.has(sub))return null;
     let cat=moveCat[sub]||ex.category;
     return {...ex,category:cat,subcategory:sub};
   }).filter(Boolean);
   if(e.exercises.length){e.category=e.exercises[0].category}
   return e;
 }).filter(e=>e.exercises&&e.exercises.length);
 const merged=structuredClone(defaultCategories);
 Object.entries(d.categories||{}).forEach(([cat,subs])=>{
   (subs||[]).forEach(sub=>{
     const renamed=renameSub.hasOwnProperty(sub)?renameSub[sub]:sub;
     if(!renamed||removedSubs.has(renamed))return;
     const targetCat=moveCat[renamed]||cat;
     if(!merged[targetCat])merged[targetCat]=[];
     if(!merged[targetCat].includes(renamed))merged[targetCat].push(renamed);
   });
 });
 d.categories=merged;
 if(d.categories['Trainingsmethoden']){
   ['Fokus Training Futter','Fokus Training Objekt'].forEach(sub=>{
     if(!d.categories['Trainingsmethoden'].includes(sub))d.categories['Trainingsmethoden'].push(sub);
   });
 }
 if(d.categories['Medical Training']){
   d.categories['Medical Training']=d.categories['Medical Training'].filter(sub=>!['Fokus Training Futter','Fokus Training Objekt'].includes(sub));
 }

 d.entries=(d.entries||[]).map(e=>{
   e.exercises=(e.exercises||[]).filter(ex=>!removedSubs.has(ex.subcategory));
   if(e.exercises.length)e.category=e.exercises[0].category;
   return e;
 }).filter(e=>e.exercises&&e.exercises.length);
 Object.values(d.profiles||{}).forEach(p=>{
   ['active','frequency','mastered'].forEach(bucket=>{
     Object.keys(p[bucket]||{}).forEach(key=>{
       if([...removedSubs].some(sub=>key.endsWith('||'+sub)))delete p[bucket][key];
     });
   });
 });
 Object.keys(d.categories||{}).forEach(cat=>{
   d.categories[cat]=(d.categories[cat]||[]).filter(sub=>!removedSubs.has(sub));
 });
 delete d.categories['Sonstiges'];
}
function save(){
 try{
   const serialized=JSON.stringify(data);
   localStorage.setItem(STORAGE_KEY,serialized);
   const check=localStorage.getItem(STORAGE_KEY);
   if(check!==serialized){
     throw new Error('localStorage verification failed');
   }
   window.__lastSaveOk=true;
   return true;
 }catch(err){
   console.error('Training Tracker: Speichern fehlgeschlagen.', err);
   window.__lastSaveOk=false;
   alert('Speichern fehlgeschlagen. Der Browser verhindert offenbar die lokale Speicherung. Bitte Backup exportieren und Browser/Privatmodus prüfen.');
   return false;
 }
}
function toast(msg,type='ok'){
 let t=document.getElementById('toast');
 if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}
 t.textContent=msg;t.className='show '+type;
 clearTimeout(window.__toastTimer);
 window.__toastTimer=setTimeout(()=>{t.className=''},1800);
}
function isoDate(dt){return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}
function today(){return isoDate(new Date())}
function daysBetween(a,b=today()){return Math.floor((new Date(b+'T12:00')-new Date(a+'T12:00'))/86400000)}
function allSubs(){return Object.entries(data.categories).flatMap(([cat,subs])=>subs.map(sub=>({cat,sub})))}
function k(cat,sub){return cat+'||'+sub}
function ensureProfile(dog){
 if(!dog)return;
 if(!data.profiles[dog])data.profiles[dog]={active:{},frequency:{},mastered:{}};
 if(!data.profiles[dog].active)data.profiles[dog].active={};
 if(!data.profiles[dog].frequency)data.profiles[dog].frequency={};
 if(!data.profiles[dog].mastered)data.profiles[dog].mastered={};
 allSubs().forEach(x=>{
   const kk=k(x.cat,x.sub);
   if(typeof data.profiles[dog].active[kk]!=='boolean')data.profiles[dog].active[kk]=false;
   if(!data.profiles[dog].frequency[kk])data.profiles[dog].frequency[kk]='1w';
   if(typeof data.profiles[dog].mastered[kk]!=='boolean')data.profiles[dog].mastered[kk]=false;
 });
}
function active(dog,cat,sub){ensureProfile(dog); return !!data.profiles[dog]?.active?.[k(cat,sub)]}
function mastered(dog,cat,sub){ensureProfile(dog); return !!data.profiles[dog]?.mastered?.[k(cat,sub)]}
function setActive(dog,cat,sub,val){
 ensureProfile(dog);
 const kk=k(cat,sub);
 data.profiles[dog].active[kk]=!!val;
 if(!val)data.profiles[dog].mastered[kk]=false;
 save();
}
function setMastered(dog,cat,sub,val){
 ensureProfile(dog);
 const kk=k(cat,sub);
 data.profiles[dog].mastered[kk]=!!val;
 if(val)data.profiles[dog].active[kk]=true;
 save();
}
function getFrequency(dog,cat,sub){ensureProfile(dog); return data.profiles[dog].frequency?.[k(cat,sub)]||'1w'}
function setFrequency(dog,cat,sub,val){ensureProfile(dog); data.profiles[dog].frequency[k(cat,sub)]=val||'1w'; save()}
function trainingStatus(dog,cat,sub){
 if(!active(dog,cat,sub))return'inactive';
 if(mastered(dog,cat,sub))return'mastered';
 if(getFrequency(dog,cat,sub)==='paused')return'paused';
 return'active';
}
function statusCountsForCategory(dog,cat){
 return (data.categories[cat]||[]).reduce((acc,sub)=>{
   const st=trainingStatus(dog,cat,sub);
   if(st==='active')acc.active++;
   else if(st==='paused')acc.paused++;
   else if(st==='mastered')acc.mastered++;
   return acc;
 },{active:0,paused:0,mastered:0});
}
function addCounts(a,b){a.active+=b.active;a.paused+=b.paused;a.mastered+=b.mastered;return a}
function statusCountsForBlock(dog,block){
 return block.categories.reduce((acc,cat)=>addCounts(acc,statusCountsForCategory(dog,cat)),{active:0,paused:0,mastered:0});
}
function statusCountsForDog(dog){
 return Object.keys(data.categories||{}).reduce((acc,cat)=>addCounts(acc,statusCountsForCategory(dog,cat)),{active:0,paused:0,mastered:0});
}
function statusBadgeHTML(counts){
 return `<span class="status-badges" title="🔄 aktiv im Training · ⏸ pausiert · ✅ beherrscht"><span>🔄${counts.active}</span><span>⏸${counts.paused}</span><span>✅${counts.mastered}</span></span>`;
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function attr(s){return esc(s).replace(/'/g,'&#39;')}

document.addEventListener('DOMContentLoaded',()=>{
 if(data.__loadError){setTimeout(()=>alert('Die gespeicherten App-Daten konnten nicht gelesen werden. Es wurde NICHT absichtlich gelöscht. Bitte Backup importieren oder Screenshot senden.'),300)}
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>show(b.dataset.tab));
 entryDate.value=today();
 bind();
 refresh();
 ['entryDog','todayDog','balanceDog','calendarDog'].forEach(rememberSelect);
 const s=getUiState();
 ['entryDog','todayDog','balanceDog','calendarDog'].forEach(restoreSelect);
 restoreGlobalDog();
 const tab=s.lastTab && document.getElementById(s.lastTab) ? s.lastTab : (data.dogs.length?'today':'dogs');
 show(tab);
});
function bind(){
 addDogBtn.onclick=addDog;
 todayDog.onchange=()=>syncDogSelection('todayDog'); balanceDog.onchange=()=>syncDogSelection('balanceDog'); calendarDog.onchange=()=>{ if(calendarDog.value==='__all__'){setUiState({calendarDog:'__all__'}); renderCalendar(); if(selectedDay)renderDayDetails();} else {syncDogSelection('calendarDog'); if(selectedDay)renderDayDetails();} };
 entryDog.onchange=()=>syncDogSelection('entryDog'); entryCategory.onchange=renderExercises; trainingForm.onsubmit=saveEntry;
 addTreadmillBlock.onclick=()=>addTmBlock(); prevMonth.onclick=()=>{currentMonth.setMonth(currentMonth.getMonth()-1);renderCalendar()}; nextMonth.onclick=()=>{currentMonth.setMonth(currentMonth.getMonth()+1);renderCalendar()};
 addCategoryBtn.onclick=addCategory; addSubcategoryBtn.onclick=addSubcategory; backupBtn.onclick=backup; importFile.onchange=importBackup; clearAllBtn.onclick=clearAll;
}
function show(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));if(id!=='add')setUiState({lastTab:id});refresh()}
function refresh(){fillSelects();renderDogList();renderProfile();renderExercises();renderToday();renderCalendar();renderBalance();renderSettings();renderStorageStatus()}
function renderStorageStatus(){
 const box=document.getElementById('storageStatus');
 const debug=document.getElementById('storageDebug');
 if(!box&&!debug)return;
 let raw=null, parsed=null, parseError=null;
 try{
   raw=localStorage.getItem(STORAGE_KEY);
   if(raw) parsed=JSON.parse(raw);
 }catch(e){parseError=e.message || String(e);}
 let testBefore=localStorage.getItem('trainingTrackerStorageTest');
 try{localStorage.setItem('trainingTrackerStorageTest',String(Date.now()));}catch(e){}
 let testAfter=localStorage.getItem('trainingTrackerStorageTest');
 if(box){
   box.textContent=raw
    ? `Speicher aktiv · Rohdaten: ${raw.length} Zeichen · Hunde im Speicher: ${(parsed?.dogs||[]).length} · Einträge im Speicher: ${(parsed?.entries||[]).length}`
    : 'Kein gespeicherter Rohdatensatz für diese App gefunden.';
 }
 if(debug){
   debug.innerHTML=`<b>Speicherdiagnose</b><br>
   Speicher-Schlüssel: <code>${STORAGE_KEY}</code><br>
   Aktuelle App-Daten: Hunde ${data.dogs.length}, Einträge ${data.entries.length}<br>
   Rohdaten vorhanden: ${raw?'ja':'nein'}<br>
   JSON lesbar: ${parseError?'nein ('+parseError+')':'ja'}<br>
   Browser-Speichertest: ${testAfter?'ok':'fehlgeschlagen'}${testBefore?'<br>Testwert war vor Reload vorhanden: ja':'<br>Testwert war vor Reload vorhanden: nein/erstmalig'}`;
 }
}
function fillSelects(){
 ['entryDog','todayDog','balanceDog'].forEach(id=>{let s=document.getElementById(id),old=s.value||getUiState()[id];s.innerHTML='';data.dogs.forEach(d=>s.add(new Option(d,d)));if(old&&data.dogs.includes(old))s.value=old});
 let cal=document.getElementById('calendarDog');
 if(cal){
   let old=cal.value || getUiState().calendarDog || '__all__';
   cal.innerHTML='';
   cal.add(new Option('Alle Hunde','__all__'));
   data.dogs.forEach(d=>cal.add(new Option(d,d)));
   if(old==='__all__' || data.dogs.includes(old)) cal.value=old;
 }
 ['entryCategory','subcategoryCategory'].forEach(id=>{let s=document.getElementById(id),old=s.value;s.innerHTML='';Object.keys(data.categories).forEach(c=>s.add(new Option(c,c)));if(old&&data.categories[old])s.value=old});

 restoreGlobalDog();
}
function addDog(){let n=newDogName.value.trim(); if(!n)return; if(data.dogs.includes(n)){toast('Diesen Hund gibt es schon.','warn');return} data.dogs.push(n); ensureProfile(n); if(!save())return; newDogName.value=''; refresh(); show('dogs'); toast('Hund gespeichert.');renderStorageStatus()}


let editingDogName=null;
function setEditingDog(d){
 editingDogName=d;
 const el=document.getElementById('dog-card-'+d);
 if(el)el.open=true;
 rememberOpenDogCard(d,true);
 renderDogList();
}
function clearEditingDog(){
 editingDogName=null;
 renderDogList();
}
function rememberOpenDogCard(d, open){
 const s=getUiState();
 if(open){
   document.querySelectorAll('.dog-collapse-card').forEach(el=>{
     if(el.id!=='dog-card-'+d) el.open=false;
   });
   setUiState({openDogCard:d});
 }else if(s.openDogCard===d){
   setUiState({openDogCard:null});
 }
}
function restoreOpenDogCard(){
 const d=getUiState().openDogCard;
 if(!d)return;
 const el=document.getElementById('dog-card-'+d);
 if(el)el.open=true;
}

function activeCountForCategory(d,cat){
 const c=statusCountsForCategory(d,cat);
 return c.active+c.paused+c.mastered;
}
function activeCountForBlock(d,block){
 const c=statusCountsForBlock(d,block);
 return c.active+c.paused+c.mastered;
}
function blockIcon(name){
 if(name==='Hundesport')return '🏃';
 if(name==='Training & Aufbau')return '📈';
 if(name==='Alltag & Management')return '🏠';
 return '📌';
}
function renderDogProfileOverview(d){
 ensureProfile(d);
 return `<div class="inline-profile compact-profile"><h3>Trainingsprofil</h3><div class="status-legend"><span>🔄 aktiv im Training</span><span>⏸ pausiert</span><span>✅ beherrscht</span></div>${categoryBlocks.map(block=>{
   const blockCounts=statusCountsForBlock(d,block);
   return `<details class="profile-block dog-profile-block settings-category-card compact-settings-card" data-profile-open-key="${attr(d)}||block||${attr(block.name)}"><summary class="settings-category-head compact-settings-head compact-profile-head"><div class="settings-title-wrap compact-settings-title"><h2><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${blockIcon(block.name)} ${esc(block.name)}</h2></div>${statusBadgeHTML(blockCounts)}</summary>${block.categories.filter(cat=>data.categories[cat]).map(cat=>{
     const catCounts=statusCountsForCategory(d,cat);
     const subs=(data.categories[cat]||[]);
     const activeCount=subs.filter(sub=>active(d,cat,sub)).length;
     const allChecked=subs.length>0&&activeCount===subs.length;
     return `<details class="profile-details dog-profile-category compact-profile-subcategory" data-profile-open-key="${attr(d)}||cat||${attr(cat)}"><summary class="settings-sub-row compact-settings-sub-row compact-profile-sub-head"><span><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${esc(cat)}</span>${statusBadgeHTML(catCounts)}</summary><div class="profile-select-all-row"><label><input type="checkbox" ${allChecked?'checked':''} onchange="toggleCategoryForDog('${attr(d)}','${attr(cat)}',this.checked)"> Alle auswählen</label></div><div class="compact-profile-list">${subs.map(sub=>{
       const st=trainingStatus(d,cat,sub);
       return `<div class="profile-row profile-row-frequency compact-profile-row status-${st}"><label class="profile-check-label"><input type="checkbox" class="profile-sub" data-dog="${attr(d)}" data-cat="${attr(cat)}" data-sub="${attr(sub)}" ${active(d,cat,sub)?'checked':''} onchange="toggleProfile('${attr(d)}','${attr(cat)}','${attr(sub)}',this.checked)"> <span>${statusIcon(st)} ${esc(sub)}</span></label><select class="frequency-select compact-frequency-select" onchange="changeFrequency('${attr(d)}','${attr(cat)}','${attr(sub)}',this.value)">${frequencyOptions.map(f=>`<option value="${f.value}" ${getFrequency(d,cat,sub)===f.value?'selected':''}>${f.label}</option>`).join('')}</select><button type="button" class="mastered-toggle ${mastered(d,cat,sub)?'is-mastered':''}" title="Beherrscht" aria-label="Beherrscht" onclick="toggleMastered('${attr(d)}','${attr(cat)}','${attr(sub)}')">✅</button></div>`;
     }).join('')}</div></details>`;
   }).join('')}</details>`;
 }).join('')}</div>`;
}
function statusIcon(st){
 if(st==='mastered')return'✅';
 if(st==='paused')return'⏸';
 if(st==='active')return'🔄';
 return'❌';
}
function renderDogList(){
 dogList.innerHTML=data.dogs.length?data.dogs.map(d=>{
   const counts=statusCountsForDog(d);
   const editing=editingDogName===d;
   return `<details class="dog-collapse-card dog-manage-card settings-category-card compact-settings-card ${editing?'is-editing':''}" id="dog-card-${attr(d)}" ontoggle="rememberOpenDogCard('${attr(d)}',this.open)">
     <summary class="dog-collapse-summary dog-manage-summary settings-category-head compact-settings-head compact-dog-head">
       <div class="dog-title settings-title-wrap compact-settings-title"><h2><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> 🐕 ${esc(d)}</h2></div>
       ${statusBadgeHTML(counts)}
       ${editing
         ? `<button type="button" class="icon-btn edit compact-edit-btn" aria-label="Schließen" onclick="clearEditingDog();event.stopPropagation();">❌</button>`
         : `<button type="button" class="icon-btn edit compact-edit-btn" aria-label="Training hinzufügen" onclick="startNewEntryForDog('${attr(d)}');event.stopPropagation();">➕</button><button type="button" class="icon-btn edit compact-edit-btn" aria-label="Bearbeiten" onclick="setEditingDog('${attr(d)}');event.stopPropagation();">✏️</button>`}
     </summary>
     <div class="dog-collapse-body dog-manage-body">
       ${editing?`<div class="dog-edit-panel compact-dog-edit">
         <input id="rename-${attr(d)}" value="${attr(d)}" aria-label="Hundename">
         <div class="dog-edit-actions"><button type="button" class="icon-action soft-primary" onclick="renameDog('${attr(d)}')">💾 Speichern</button><button type="button" class="icon-action danger-soft" onclick="deleteDog('${attr(d)}')">🗑 Löschen</button><button type="button" class="icon-action secondary" onclick="clearEditingDog()">❌ Schließen</button></div>
       </div>`:renderDogProfileOverview(d)}
     </div>
   </details>`;
 }).join(''):'<div class="card"><h2>Noch kein Hund</h2><p>Lege zuerst einen Hund an. Danach erscheint hier automatisch das Trainingsprofil.</p></div>';
 setTimeout(restoreOpenDogCard,0);
}
function startNewEntryForDog(d){
 returnViewAfterEdit='dogs';
 returnDogAfterEdit=d;
 show('add');
 formTitle.textContent='Training hinzufügen';
 saveEntryBtn.textContent='Speichern';
 editingId=null;
 trainingForm.reset();
 const sessionRadio=document.querySelector('input[name="trainingType"][value="session"]'); if(sessionRadio)sessionRadio.checked=true; updateDurationVisibility();
 fillSelects();
 if(data.dogs.includes(d))entryDog.value=d;
 setUiState({currentDog:d,entryDog:d,todayDog:d,balanceDog:d,calendarDog:d});
 entryDate.value=today();
 treadmillBlocks.innerHTML='';
 treadmillBox.classList.add('hidden');
 renderExercises();
}
function closeDogCard(d){
 const el=document.getElementById('dog-card-'+d);
 if(el)el.open=false;
 rememberOpenDogCard(d,false);
 if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderInlineProfile(d){
 ensureProfile(d);
 return `<div class="inline-profile"><h3>Trainingsprofil</h3><p class="small">Öffne einen Oberbereich und aktiviere die Übungen, die für diesen Hund relevant sind.</p>${categoryBlocks.map(block=>`<details class="profile-block"><summary>${esc(block.name)}</summary>${block.categories.filter(cat=>data.categories[cat]).map(cat=>`<details class="profile-details"><summary>${esc(cat)}</summary><div class="profile-category-actions"><button type="button" class="secondary profile-action" onclick="toggleCategoryForDog('${attr(d)}','${attr(cat)}',true)">Alle aktivieren</button><button type="button" class="secondary profile-action" onclick="toggleCategoryForDog('${attr(d)}','${attr(cat)}',false)">Alle deaktivieren</button></div>${(data.categories[cat]||[]).map(sub=>`<div class="profile-row profile-row-frequency"><label><input type="checkbox" class="profile-sub" data-dog="${attr(d)}" data-cat="${attr(cat)}" data-sub="${attr(sub)}" ${active(d,cat,sub)?'checked':''} onchange="toggleProfile('${attr(d)}','${attr(cat)}','${attr(sub)}',this.checked)"> ${esc(sub)}</label><select class="frequency-select" onchange="changeFrequency('${attr(d)}','${attr(cat)}','${attr(sub)}',this.value)">${frequencyOptions.map(f=>`<option value="${f.value}" ${getFrequency(d,cat,sub)===f.value?'selected':''}>${f.label}</option>`).join('')}</select></div>`).join('')}</details>`).join('')}</details>`).join('')}</div>`;
}

window.renameDog=(old)=>{
 let neu=document.getElementById('rename-'+old)?.value.trim();
 if(!neu||neu===old)return;
 if(data.dogs.includes(neu)){toast('Name existiert bereits.','warn');return}
 data.dogs=data.dogs.map(d=>d===old?neu:d);
 data.profiles[neu]=data.profiles[old];
 delete data.profiles[old];
 data.entries.forEach(e=>{if(e.dog===old)e.dog=neu});
 editingDogName=null;
 setUiState({openDogCard:neu,currentDog:neu,entryDog:neu,todayDog:neu,balanceDog:neu,calendarDog:neu});
 save();
 refresh();
 toast('Hund umbenannt.');
}
window.deleteDog=async(d)=>{
 let c=entries(d).length;
 const ok=await appConfirm({title:'Hund löschen?',message:`${d}\n\n${c?`${c} ${c===1?'Eintrag wird':'Einträge werden'} mit gelöscht.`:'Keine Einträge vorhanden.'}`,confirmText:'Löschen',danger:true});
 if(!ok)return;
 data.dogs=data.dogs.filter(x=>x!==d);
 delete data.profiles[d];
 data.entries=data.entries.filter(e=>e.dog!==d);
 if(editingDogName===d)editingDogName=null;
 const s=getUiState();
 if(s.openDogCard===d)setUiState({openDogCard:null});
 save();
 refresh();
 toast('Hund gelöscht.');
}


function collectOpenProfileState(dog){
 const root=document.getElementById('dog-card-'+dog);
 return {
   scrollY:window.scrollY,
   openKeys:root?[...root.querySelectorAll('details[data-profile-open-key][open]')].map(el=>el.dataset.profileOpenKey):[]
 };
}
function restoreOpenProfileState(state){
 if(!state)return;
 const apply=()=>{
   (state.openKeys||[]).forEach(key=>{
     const el=document.querySelector(`details[data-profile-open-key="${CSS.escape(key)}"]`);
     if(el)el.open=true;
   });
   if(typeof state.scrollY==='number')window.scrollTo(0,state.scrollY);
 };
 requestAnimationFrame(()=>{
   apply();
   requestAnimationFrame(apply);
   setTimeout(apply,40);
   setTimeout(apply,120);
 });
}
function renderDogListPreservingProfileState(dog){
 const state=collectOpenProfileState(dog);
 renderDogList();
 restoreOpenProfileState(state);
}

function renderProfile(){renderDogList()}
window.toggleProfile=(d,cat,sub,val)=>{
 setActive(d,cat,sub,val);
 renderDogListPreservingProfileState(d);renderExercises();renderToday();renderBalance();
 toast('Profil automatisch gespeichert.');
}
window.changeFrequency=(d,cat,sub,val)=>{
 setFrequency(d,cat,sub,val);
 renderDogListPreservingProfileState(d);renderToday();renderBalance();
 toast('Trainingshäufigkeit gespeichert.');
}
window.toggleMastered=(d,cat,sub)=>{
 setMastered(d,cat,sub,!mastered(d,cat,sub));
 renderDogListPreservingProfileState(d);renderExercises();renderToday();renderBalance();
 toast(mastered(d,cat,sub)?'Als beherrscht markiert.':'Beherrscht-Markierung entfernt.');
}
window.toggleCategoryForDog=(d,cat,val)=>{
 (data.categories[cat]||[]).forEach(sub=>{
   ensureProfile(d);
   const kk=k(cat,sub);
   data.profiles[d].active[kk]=!!val;
   if(!val)data.profiles[d].mastered[kk]=false;
 });
 save();
 renderDogListPreservingProfileState(d);renderExercises();renderToday();renderBalance();
 toast('Profil automatisch gespeichert.');
}
function setAll(val){/* Profile-Reiter entfernt */}

function renderExercises(){
 let d=entryDog.value||data.dogs[0];
 if(!d){exerciseList.innerHTML='<p>Bitte zuerst Hund anlegen.</p>';return}
 const blocks=categoryBlocks.map(block=>{
   const cats=block.categories.filter(cat=>(data.categories[cat]||[]).some(s=>active(d,cat,s)));
   if(!cats.length)return '';
   return `<details class="entry-block settings-category-card compact-settings-card compact-entry-block"><summary class="settings-category-head compact-settings-head compact-entry-head"><div class="settings-title-wrap compact-settings-title"><h2><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${blockIcon(block.name)} ${esc(block.name)}</h2></div><span class="count-badge settings-count-badge">${cats.length}</span></summary>${cats.map(cat=>{
     const subs=(data.categories[cat]||[]).filter(s=>active(d,cat,s));
     return `<details class="entry-category compact-entry-category"><summary class="settings-sub-row compact-settings-sub-row compact-entry-sub-head"><span><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${esc(cat)}</span><span class="count-badge settings-count-badge">${subs.length}</span></summary><div class="compact-exercise-list">${subs.map(s=>`<label class="exercise-row compact-exercise-row"><input type="checkbox" class="ex" data-cat="${attr(cat)}" data-sub="${attr(s)}" onchange="toggleTreadmill()"> <span>${esc(s)}</span></label>`).join('')}</div></details>`;
   }).join('')}</details>`;
 }).filter(Boolean);
 exerciseList.innerHTML=blocks.length?blocks.join(''):'<p>Für diesen Hund sind keine Übungen aktiv.</p>';
 toggleTreadmill();
}
window.toggleTreadmill=()=>{let on=[...document.querySelectorAll('.ex:checked')].some(x=>x.dataset.sub==='Laufband'); treadmillBox.classList.toggle('hidden',!on); if(on&&!document.querySelector('.tm-block'))addTmBlock()}
function addTmBlock(min='',speed=''){let div=document.createElement('div');div.className='tm-block';div.innerHTML=`<label>Minuten<input class="tm-min" type="number" min="0" step="1" value="${attr(min)}"></label><label>km/h<input class="tm-speed" type="number" min="0" step="0.1" value="${attr(speed)}"></label><button type="button" class="secondary" onclick="this.parentElement.remove()">Entfernen</button>`;treadmillBlocks.appendChild(div)}
function selectedExercisesByCategory(){
 const groups={};
 document.querySelectorAll('.ex:checked').forEach(cb=>{
   const cat=cb.dataset.cat;
   const sub=cb.dataset.sub;
   if(!cat||!sub)return;
   (groups[cat]||(groups[cat]=[])).push({category:cat,subcategory:sub});
 });
 return groups;
}

function openParentDetails(el){
 let node=el;
 while(node){
   if(node.tagName && node.tagName.toLowerCase()==='details')node.open=true;
   node=node.parentElement;
 }
}

function saveEntry(ev){
 ev.preventDefault();
 const groups=selectedExercisesByCategory();
 const cats=Object.keys(groups);
 if(!cats.length){toast('Bitte Übung auswählen.','warn');return}
 let keepDate=entryDate.value;
 const treadmillData=[...document.querySelectorAll('.tm-block')].map(b=>({minutes:b.querySelector('.tm-min').value,speed:b.querySelector('.tm-speed').value})).filter(x=>x.minutes||x.speed);
 if(editingId){
   let i=data.entries.findIndex(e=>e.id===editingId);
   if(i>=0){
     const originalCat=data.entries[i].category;
     const primaryCat=cats.includes(originalCat)?originalCat:cats[0];
     let payload={dog:entryDog.value,date:entryDate.value,category:primaryCat,duration:entryDuration.value,trainingType:getTrainingType(),club:false,exercises:groups[primaryCat],treadmill:groups[primaryCat].some(x=>x.subcategory==='Laufband')?treadmillData:[],note:entryNote.value.trim()};
     data.entries[i]={...data.entries[i],...payload,updatedAt:new Date().toISOString()};
     cats.filter(cat=>cat!==primaryCat).forEach(cat=>{
       data.entries.push({id:crypto.randomUUID(),dog:entryDog.value,date:entryDate.value,category:cat,duration:payload.duration,trainingType:payload.trainingType,club:false,exercises:groups[cat],treadmill:groups[cat].some(x=>x.subcategory==='Laufband')?treadmillData:[],note:payload.note,createdAt:new Date().toISOString()});
     });
     if(!save())return;
     toast(cats.length===1?'Eintrag aktualisiert.':`Eintrag aktualisiert · ${cats.length-1} zusätzliche Kategorie${cats.length-1===1?'':'n'} gespeichert.`);
     resetForm();
     selectedDay=payload.date;
     renderToday();renderCalendar();renderBalance();renderDogList();if(!returnToDogIfNeeded()){show(returnViewAfterEdit||'calendar');if(selectedDay)renderDayDetails();}
     return;
   }
 }
 cats.forEach(cat=>{
   data.entries.push({id:crypto.randomUUID(),dog:entryDog.value,date:entryDate.value,category:cat,duration:entryDuration.value,trainingType:getTrainingType(),club:false,exercises:groups[cat],treadmill:groups[cat].some(x=>x.subcategory==='Laufband')?treadmillData:[],note:entryNote.value.trim(),createdAt:new Date().toISOString()});
 });
 if(!save())return;
 toast(cats.length===1?'Einheit gespeichert.':`${cats.length} Kategorien gespeichert.`);
 resetForm();
 selectedDay=keepDate;
 renderToday();renderCalendar();renderBalance();renderDogList();
 if(!returnToDogIfNeeded()){show(returnViewAfterEdit||'today');if(selectedDay&&returnViewAfterEdit==='calendar')renderDayDetails();}
}

function returnToDogIfNeeded(){
 if(returnViewAfterEdit==='dogs' && returnDogAfterEdit){
   const dog=returnDogAfterEdit;
   returnDogAfterEdit=null;
   setUiState({openDogCard:dog});
   show('dogs');
   setTimeout(()=>{
     const el=document.getElementById('dog-card-'+dog);
     if(el){
       el.open=true;
       el.scrollIntoView({behavior:'smooth',block:'start'});
     }
   },0);
   return true;
 }
 return false;
}
function resetForm(){editingId=null;formTitle.textContent='Training eintragen';saveEntryBtn.textContent='Speichern';trainingForm.reset();entryDate.value=today();treadmillBlocks.innerHTML='';treadmillBox.classList.add('hidden');fillSelects();renderExercises()}
function clearEntryDetailsKeepDogDate(keepDog, keepDate){
 editingId=null;
 formTitle.textContent='Training eintragen';
 saveEntryBtn.textContent='Speichern';
 entryDog.value=keepDog;
 entryDate.value=keepDate;
 entryDuration.value='';
 
 entryNote.value='';
 treadmillBlocks.innerHTML='';
 treadmillBox.classList.add('hidden');
 document.querySelectorAll('.ex').forEach(cb=>cb.checked=false);
 toggleTreadmill();
}


function currentActivePanel(){
 const p=document.querySelector('.panel.active');
 return p?p.id:(returnViewAfterEdit||'today');
}
function loadEntry(e,dup=false){
 returnViewAfterEdit=currentActivePanel();
 editingId=dup?null:e.id;
 show('add');
 formTitle.textContent=dup?'Eintrag duplizieren':'Eintrag bearbeiten';
 saveEntryBtn.textContent=dup?'Als neuen Eintrag speichern':'Änderungen speichern';
 entryDog.value=e.dog;
 setUiState({currentDog:e.dog, entryDog:e.dog, todayDog:e.dog, balanceDog:e.dog, calendarDog:e.dog});
 entryCategory.value=e.category;
 (e.exercises||[]).forEach(x=>{ if(!active(e.dog,x.category,x.subcategory)) setActive(e.dog,x.category,x.subcategory,true); });
 renderExercises();
 entryDate.value=dup?today():e.date;
 entryDuration.value=e.duration||'';
 entryNote.value=e.note||'';
 const type=e.trainingType||'session';
 const typeRadio=document.querySelector(`input[name="trainingType"][value="${type}"]`);
 if(typeRadio)typeRadio.checked=true;
 const dur=document.getElementById('entryDuration');
 if(dur)dur.style.display=(type==='session')?'':'none';
 document.querySelectorAll('.ex').forEach(cb=>{
   cb.checked=(e.exercises||[]).some(x=>x.category===cb.dataset.cat&&x.subcategory===cb.dataset.sub);
   if(cb.checked && typeof openParentDetails==='function') openParentDetails(cb);
 });
 treadmillBlocks.innerHTML='';
 (e.treadmill||[]).forEach(b=>addTmBlock(b.minutes,b.speed));
 toggleTreadmill();
}
function startNewEntryForDate(dateIso){
 returnViewAfterEdit=currentActivePanel();
 editingId=null;
 show('add');
 formTitle.textContent='Training hinzufügen';
 saveEntryBtn.textContent='Speichern';
 trainingForm.reset();
 const sessionRadio=document.querySelector('input[name="trainingType"][value="session"]'); if(sessionRadio)sessionRadio.checked=true; updateDurationVisibility();
 fillSelects();
 const calDog=document.getElementById('calendarDog')?.value || '__all__';
 if(calDog && calDog!=='__all__' && data.dogs.includes(calDog)) entryDog.value=calDog;
 else if(getUiState().currentDog && data.dogs.includes(getUiState().currentDog)) entryDog.value=getUiState().currentDog;
 else if(data.dogs.length) entryDog.value=data.dogs[0];
 setUiState({currentDog:entryDog.value, entryDog:entryDog.value, todayDog:entryDog.value, balanceDog:entryDog.value, calendarDog:entryDog.value});
 entryDate.value=dateIso || selectedDay || today();
 treadmillBlocks.innerHTML='';
 treadmillBox.classList.add('hidden');
 renderExercises();
}

function startNewEntryForExercise(dateIso,dogName,cat,sub){
 startNewEntryForDate(dateIso);
 if(dogName && data.dogs.includes(dogName)){
   entryDog.value=dogName;
   setUiState({currentDog:dogName,entryDog:dogName,todayDog:dogName,balanceDog:dogName,calendarDog:dogName});
   renderExercises();
 }
 document.querySelectorAll('.ex').forEach(cb=>{
   cb.checked=(cb.dataset.cat===cat && cb.dataset.sub===sub);
   if(cb.checked && typeof openParentDetails==='function') openParentDetails(cb);
 });
 toggleTreadmill();
}

function renderCalendar(){let y=currentMonth.getFullYear(),m=currentMonth.getMonth();monthLabel.textContent=currentMonth.toLocaleDateString('de-DE',{month:'long',year:'numeric'});calendarGrid.innerHTML='';['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(w=>calendarGrid.insertAdjacentHTML('beforeend',`<div class="weekday">${w}</div>`));let first=new Date(y,m,1),off=(first.getDay()+6)%7,start=new Date(y,m,1-off);for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let iso=isoDate(d),es=calendarEntries().filter(e=>e.date===iso),cats=[...new Set(es.map(e=>e.category))];let div=document.createElement('div');div.className='day'+(d.getMonth()!==m?' other':'')+(iso===today()?' today':'')+(iso===selectedDay?' selected':'');div.innerHTML=`<div class="day-num">${d.getDate()}</div><div class="calendar-cats">${cats.slice(0,4).map(c=>`<span class="cat-chip ${catClass(c)}">${shortCat(c)}</span>`).join('')}</div>`;div.onclick=()=>{selectedDay=iso;renderCalendar();renderDayDetails()};calendarGrid.appendChild(div)} if(selectedDay)renderDayDetails()}
function renderDayDetails(){
 if(!selectedDay){dayDetails.classList.add('hidden');return}
 let es=calendarEntries().filter(e=>e.date===selectedDay).sort((a,b)=>(a.dog||'').localeCompare(b.dog||'')||(blockForCategory(a.category)||'').localeCompare(blockForCategory(b.category)||'')||(a.category||'').localeCompare(b.category||''));
 dayDetails.classList.remove('hidden');
 let head=`<div class="detail-head"><h2>${new Date(selectedDay+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h2><button class="secondary" onclick="closeDay()">Zur Monatsübersicht</button></div><div class="actions"><button type="button" onclick="startNewEntryForDate('${selectedDay}')">Training hinzufügen</button></div>`;
 if(!es.length){dayDetails.innerHTML=head+'<p>Kein Training.</p>';return}
 const byDog={};
 es.forEach(e=>{(byDog[e.dog]||(byDog[e.dog]=[])).push(e)});
 const blockOrder=categoryBlocks.map(b=>b.name).concat(['Weitere']);
 dayDetails.innerHTML=head+Object.entries(byDog).map(([dog,items])=>{
   const collapsed=(typeof isDogGroupCollapsed==='function')?isDogGroupCollapsed(selectedDay,dog):false;
   let body='';
   if(!collapsed){
     const byBlock={};
     items.forEach(e=>{
       const block=blockForCategory(e.category);
       (byBlock[block]||(byBlock[block]=[])).push(e);
     });
     body=`<div class="dog-group-body grouped-day-body">${blockOrder.filter(block=>byBlock[block]&&byBlock[block].length).map(block=>{
       const blockItems=byBlock[block];
       const byCat={};
       blockItems.forEach(e=>{(byCat[e.category]||(byCat[e.category]=[])).push(e)});
       return `<section class="calendar-block-group"><h3>${esc(block)}</h3>${Object.entries(byCat).map(([cat,catItems])=>`<div class="calendar-category-group"><div class="calendar-category-title"><span class="cat-chip ${catClass(cat)}">${esc(cat)}</span><span class="small">${catItems.length} ${catItems.length===1?'Eintrag':'Einträge'}</span></div>${catItems.map(renderEntry).join('')}</div>`).join('')}</section>`;
     }).join('')}</div>`;
   }
   return `<section class="dog-day-group"><button type="button" class="dog-group-head" onclick="toggleDogGroup('${selectedDay}','${attr(dog)}')"><span>🐕 ${esc(dog)}</span><span class="dog-count">${items.length} Eintrag${items.length===1?'':'e'}</span><span>${collapsed?'⌄':'⌃'}</span></button>${body}</section>`;
 }).join('');
}
window.closeDay=()=>{selectedDay=null;dayDetails.classList.add('hidden');renderCalendar()}
function renderEntry(e){
 const typeInfo=e.trainingType==='walk'
   ? '<span class="entry-meta">🚶 Spaziergang</span>'
   : (e.trainingType==='everyday'
      ? '<span class="entry-meta">🏠 Im Alltag</span>'
      : (e.trainingType==='session'
         ? (e.duration?`<span class="entry-meta">⏱ ${esc(e.duration)} Min.</span>`:'<span class="entry-meta">⏱ Trainingseinheit</span>')
         : (e.duration?`<span class="entry-meta">⏱ ${esc(e.duration)} Min.</span>`:'')));
 const exercises=(e.exercises||[]).map(x=>esc(x.subcategory)).join(' · ');
 const note=e.note?`<div class="entry-note">📝 ${esc(e.note)}</div>`:'';
 const treadmill=e.treadmill?.length?`<div class="entry-note"><b>Laufband:</b> ${e.treadmill.map(b=>`${esc(b.minutes)} Min ${esc(b.speed)} km/h`).join(' · ')}</div>`:'';
 return `<div class="entry-card compact-entry">
   <div class="entry-card-head">
     <div class="entry-title-line"><span class="cat-chip ${catClass(e.category)}">${esc(e.category)}</span>${typeInfo}</div>
     <div class="entry-icon-actions">
       <button type="button" class="icon-btn edit" title="Bearbeiten" aria-label="Bearbeiten" onclick="editEntry(&quot;${e.id}&quot;)">✏️</button>
       <button type="button" class="icon-btn duplicate" title="Duplizieren" aria-label="Duplizieren" onclick="dupEntry(&quot;${e.id}&quot;)">⧉</button>
       <button type="button" class="icon-btn delete" title="Löschen" aria-label="Löschen" onclick="delEntry(&quot;${e.id}&quot;)">🗑️</button>
     </div>
   </div>
   ${exercises?`<div class="entry-exercises">${exercises}</div>`:''}
   ${treadmill}${note}
 </div>`;
}



function renderToday(){
 let d=todayDog.value||getUiState().currentDog||data.dogs[0]; 
 if(todayDog && d && todayDog.value!==d && data.dogs.includes(d)) todayDog.value=d; 
 if(!d){todayContent.innerHTML='<div class="card"><h2>Noch kein Hund</h2><p>Bitte lege zuerst einen Hund an.</p></div>';return}
 const due={}, notDue={}, paused={};
 allSubs().filter(x=>active(d,x.cat,x.sub)&&!mastered(d,x.cat,x.sub)&&!clubSubs.has(x.sub)).forEach(x=>{
   const freq=getFrequency(d,x.cat,x.sub);
   if(freq==='paused'){
     (paused[x.cat]||(paused[x.cat]=[])).push({...x,freq});
     return;
   }
   let l=last(d,x.sub), days=l?daysBetween(l.date):999, target=freqDays(freq);
   let item={...x,days,target,freq,overdue:days===999?999:days-target,dueIn:days===999?0:Math.max(0,target-days)};
   if(days===999 || days>=target){
     (due[x.cat]||(due[x.cat]=[])).push(item);
   }else{
     (notDue[x.cat]||(notDue[x.cat]=[])).push(item);
   }
 });
 const catOrder=Object.keys(data.categories);
 Object.values(due).forEach(list=>list.sort((a,b)=>b.overdue-a.overdue || b.days-a.days));
 Object.values(notDue).forEach(list=>list.sort((a,b)=>a.dueIn-b.dueIn || b.days-a.days));
 Object.values(paused).forEach(list=>list.sort((a,b)=>a.sub.localeCompare(b.sub)));
 const dueCount=countGrouped(due), notDueCount=countGrouped(notDue), pausedCount=countGrouped(paused);
 todayContent.innerHTML=`<div class="card today-card"><h2>Heute sinnvoll <span class="pill green">${dueCount}</span></h2><p class="small">Fällige aktive Übungen von ${esc(d)}, sortiert nach Dringlichkeit.</p>${renderTodayGroups(due,catOrder,'due','Aktuell ist nichts fällig.')}</div><div class="card today-card"><h2>Aktuell nicht fällig <span class="pill blue">${notDueCount}</span></h2><p class="small">Diese Übungen werden trainiert, sind nach deiner gewünschten Häufigkeit aber noch nicht dran.</p>${renderTodayGroups(notDue,catOrder,'notdue','Keine aktiven Übungen in automatischer Pause.')}</div><div class="card today-card"><h2>Aktiv pausiert <span class="pill muted-pill">${pausedCount}</span></h2><p class="small">Diese Übungen sind im Profil bewusst auf „pausiert“ gestellt.</p>${renderPausedGroups(paused,catOrder,'Keine aktiv pausierten Übungen.')}</div>`;
}

function countGrouped(groups){
 return Object.values(groups).reduce((sum,list)=>sum+list.length,0);
}
function renderTodayGroups(groups,catOrder,mode,emptyText){
 const cats=catOrder.filter(cat=>groups[cat]&&groups[cat].length);
 if(!cats.length)return `<p>${emptyText}</p>`;
 return cats.map(cat=>`<div class="today-group"><h3><span class="cat-chip ${catClass(cat)}">${esc(cat)}</span></h3><div class="score-list">${groups[cat].slice(0,6).map(x=>todayDashboardRow(x,mode)).join('')}</div></div>`).join('');
}
function todayDashboardRow(x,mode){
 const last=x.days===999?'noch nie':`vor ${x.days} Tag${x.days===1?'':'en'}`;
 const freq=freqLabel(x.freq);
 const info=mode==='due'
   ? (x.days===999?'neu':`${Math.max(0,x.overdue)} Tag${Math.max(0,x.overdue)===1?'':'e'} überfällig`)
   : `in ${x.dueIn} Tag${x.dueIn===1?'':'en'}`;
 return `<div class="score-row today-training-row">
   <div class="today-training-main">
     <button type="button" class="today-profile-link" onclick="openDogProfileAt('${attr(x.cat)}','${attr(x.sub)}')" title="Im Trainingsprofil öffnen">${esc(x.sub)}</button>
     <span class="small today-training-info">${last} · ${freq} · ${info}</span>
   </div>
   <button type="button" class="today-add-btn" onclick="startNewEntryFromTodayExercise('${attr(x.cat)}','${attr(x.sub)}')" title="Training eintragen" aria-label="Training eintragen">➕</button>
 </div>`;
}
function startNewEntryFromTodayExercise(cat,sub){
 const d=todayDog.value||getUiState().currentDog||data.dogs[0];
 if(!d)return;
 returnViewAfterEdit='today';
 returnDogAfterEdit=null;
 show('add');
 formTitle.textContent='Training hinzufügen';
 saveEntryBtn.textContent='Speichern';
 editingId=null;
 trainingForm.reset();
 const sessionRadio=document.querySelector('input[name="trainingType"][value="session"]');
 if(sessionRadio)sessionRadio.checked=true;
 updateDurationVisibility();
 fillSelects();
 if(data.dogs.includes(d))entryDog.value=d;
 setUiState({currentDog:d,entryDog:d,todayDog:d,balanceDog:d,calendarDog:d});
 entryDate.value=today();
 treadmillBlocks.innerHTML='';
 treadmillBox.classList.add('hidden');
 renderExercises();
 setTimeout(()=>{
   document.querySelectorAll('.ex').forEach(cb=>{
     cb.checked=(cb.dataset.cat===cat && cb.dataset.sub===sub);
   });
   toggleTreadmill();
 },0);
}
function openDogProfileAt(cat,sub){
 const d=todayDog.value||getUiState().currentDog||data.dogs[0];
 if(!d)return;
 setUiState({currentDog:d,entryDog:d,todayDog:d,balanceDog:d,calendarDog:d,openDogCard:d});
 show('dogs');
 setTimeout(()=>{
   const dogEl=document.getElementById('dog-card-'+d);
   if(dogEl)dogEl.open=true;
   const block=blockForCategory(cat);
   const blockKey=`${d}||block||${block}`;
   const catKey=`${d}||cat||${cat}`;
   [blockKey,catKey].forEach(key=>{
     const el=document.querySelector(`details[data-profile-open-key="${CSS.escape(key)}"]`);
     if(el)el.open=true;
   });
   const target=document.querySelector(`.profile-sub[data-dog="${CSS.escape(d)}"][data-cat="${CSS.escape(cat)}"][data-sub="${CSS.escape(sub)}"]`);
   const row=target?target.closest('.compact-profile-row'):null;
   if(row){
     row.classList.add('profile-jump-highlight');
     row.scrollIntoView({behavior:'smooth',block:'center'});
     setTimeout(()=>row.classList.remove('profile-jump-highlight'),1800);
   }else if(dogEl){
     dogEl.scrollIntoView({behavior:'smooth',block:'start'});
   }
 },0);
}
function renderPausedGroups(groups,catOrder,emptyText){
 const cats=catOrder.filter(cat=>groups[cat]&&groups[cat].length);
 if(!cats.length)return `<p>${emptyText}</p>`;
 return cats.map(cat=>`<div class="today-group paused-group"><h3><span class="cat-chip ${catClass(cat)}">${esc(cat)}</span></h3><div class="score-list">${groups[cat].map(x=>pausedRow(x)).join('')}</div></div>`).join('');
}
function pausedRow(x){
 return `<div class="score-row paused-row"><span><b>${esc(x.sub)}</b><br><span class="tiny">aktiv auf „pausiert“ gestellt</span></span><span class="pill muted-pill">pausiert</span></div>`;
}
function sug(x,cls){return `<div class="score-row"><span><b>${esc(x.sub)}</b><br><span class="tiny">${esc(x.cat)}</span></span><span class="pill ${cls}">${x.days===999?'noch nie':'vor '+x.days+' T.'}</span></div>`}

function renderBalance(){let d=balanceDog.value||data.dogs[0]; if(!d){balanceContent.innerHTML='<div class="card">Noch kein Hund.</div>';return} let order=[...categoryBlocks.flatMap(b=>b.categories),...Object.keys(data.categories).filter(c=>!categoryBlocks.flatMap(b=>b.categories).includes(c))]; balanceContent.innerHTML=order.filter(c=>data.categories[c]).map(c=>balanceCard(d,c,false)).join('')}
function balanceCard(d,cat,compact){let subs=(data.categories[cat]||[]).filter(s=>active(d,cat,s));if(!subs.length)return `<div class="card"><h2>${esc(cat)}</h2><p>Keine aktiven Übungen.</p></div>`;let since=new Date();since.setDate(since.getDate()-30);let si=isoDate(since);let rows=subs.map(s=>{let cnt=entries(d).filter(e=>e.date>=si&&e.exercises.some(x=>x.category===cat&&x.subcategory===s)).length,l=last(d,s),days=l?daysBetween(l.date):999;return{sub:s,cnt,days}}).sort((a,b)=>a.cnt-b.cnt||b.days-a.days);let max=Math.max(1,...rows.map(r=>r.cnt));if(compact)rows=rows.slice(0,6);return `<div class="card"><h2>${esc(cat)} <span class="pill">30 Tage</span></h2><div class="score-list">${rows.map(r=>`<div class="score-row"><span style="flex:1"><b>${esc(r.sub)}</b><br><span class="tiny">${r.cnt}× · zuletzt ${r.days===999?'noch nie':'vor '+r.days+' T.'}</span><div class="bar-wrap"><div class="bar" style="width:${Math.max(4,Math.round(r.cnt/max*100))}%"></div></div></span><span class="pill ${r.cnt===0?'red':r.cnt<=1?'yellow':'green'}">${r.cnt}×</span></div>`).join('')}</div></div>`}



let collapsedSettingsBlocks={};
let collapsedSettingsCategories={};
function toggleSettingsBlock(block){
 collapsedSettingsBlocks[block]=!collapsedSettingsBlocks[block];
 renderSettings();
}
function toggleSettingsCategory(cat){
 collapsedSettingsCategories[cat]=!collapsedSettingsCategories[cat];
 renderSettings();
}
let editingCategoryName=null;
function setEditingCategory(cat){
 editingCategoryName=cat;
 renderSettings();
}
function clearEditingCategory(){
 editingCategoryName=null;
 renderSettings();
}
function categoryEntryCount(cat){
 return data.entries.filter(e=>e.category===cat||(e.exercises||[]).some(x=>x.category===cat)).length;
}
function subEntryCount(cat,sub){
 return data.entries.filter(e=>(e.exercises||[]).some(x=>x.category===cat&&x.subcategory===sub)).length;
}
function renderSettings(){
 Object.keys(data.categories||{}).forEach(c=>{
   if(!(c in collapsedSettingsCategories)) collapsedSettingsCategories[c]=true;
 });
 const knownCats=new Set(categoryBlocks.flatMap(b=>b.categories));
 const blocks=categoryBlocks.map(block=>({
   name:block.name,
   categories:block.categories.filter(cat=>data.categories[cat])
 }));
 const customCats=Object.keys(data.categories||{}).filter(cat=>!knownCats.has(cat));
 if(customCats.length)blocks.push({name:'Weitere',categories:customCats});
 categoryList.innerHTML=blocks.map(block=>{
   if(!(block.name in collapsedSettingsBlocks))collapsedSettingsBlocks[block.name]=true;
   const blockExpanded=!collapsedSettingsBlocks[block.name];
   const catCount=block.categories.length;
   return `<section class="settings-block-card compact-settings-card">
     <div class="settings-category-head compact-settings-head settings-block-head">
       <div class="settings-title-wrap compact-settings-title" onclick="toggleSettingsBlock('${attr(block.name)}')">
         <h2><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${blockIcon(block.name)} ${esc(block.name)}</h2>
       </div>
       <span class="count-badge settings-count-badge">${catCount}</span>
     </div>
     ${blockExpanded?`<div class="settings-block-body">${block.categories.map(cat=>{
       const subs=data.categories[cat]||[];
       const editing=editingCategoryName===cat;
       const expanded=!collapsedSettingsCategories[cat];
       const subList=(Array.isArray(subs)?subs:[]);
       return `<section class="settings-category-card compact-settings-card ${editing?'is-editing':''}">
         <div class="settings-category-head compact-settings-head">
           <div class="settings-title-wrap compact-settings-title" onclick="toggleSettingsCategory('${attr(cat)}')">
             <h2><span class="arrow-closed">▶</span><span class="arrow-open">▼</span> ${esc(cat)}</h2>
           </div>
           <span class="count-badge settings-count-badge">${subList.length}</span>
           <button type="button" class="icon-btn edit compact-edit-btn" aria-label="${editing?'Schließen':'Bearbeiten'}" onclick="${editing?`clearEditingCategory()`:`setEditingCategory('${attr(cat)}')`}">${editing?'❌':'✏️'}</button>
         </div>
         ${expanded?`
         <div class="settings-sub-list compact-settings-sub-list">
           ${subList.map(s=>`<div class="settings-sub-row compact-settings-sub-row"><span>${esc(s)}</span>${editing?`<button type="button" class="icon-btn delete" title="Unterkategorie löschen" aria-label="Unterkategorie löschen" onclick="deleteSub('${attr(cat)}','${attr(s)}')">🗑️</button>`:''}</div>`).join('')}
         </div>
         ${editing?`<div class="settings-danger-zone compact-danger-zone"><button type="button" class="icon-action danger-soft" onclick="deleteCategory('${attr(cat)}')">🗑 Kategorie löschen</button></div>`:''}
         `:''}
       </section>`;
     }).join('')}</div>`:''}
   </section>`;
 }).join('');
}
function addCategory(){
 let c=newCategoryName.value.trim();
 if(!c)return;
 if(data.categories[c]){toast('Kategorie existiert bereits.','warn');return}
 data.categories[c]=[];
 data.dogs.forEach(ensureProfile);
 newCategoryName.value='';
 save();
 refresh();
}
function addSubcategory(){
 let c=subcategoryCategory.value,s=newSubcategoryName.value.trim();
 if(!s)return;
 if(data.categories[c].includes(s)){toast('Unterkategorie existiert bereits.','warn');return}
 data.categories[c].push(s);
 data.dogs.forEach(d=>{ensureProfile(d);data.profiles[d].active[k(c,s)]=false;data.profiles[d].frequency[k(c,s)]='1w'});
 newSubcategoryName.value='';
 save();
 refresh();
}
window.deleteCategory=async(c)=>{
 const cnt=categoryEntryCount(c);
 const ok=await appConfirm({title:'Kategorie löschen?',message:`„${c}“ und alle Unterkategorien werden entfernt.${cnt?`\n\n${cnt} ${cnt===1?'Eintrag nutzt':'Einträge nutzen'} diese Kategorie.`:''}`,confirmText:'Kategorie löschen',danger:true});
 if(!ok)return;
 delete data.categories[c];
 Object.values(data.profiles).forEach(p=>{
   Object.keys(p.active||{}).forEach(key=>{if(key.startsWith(c+'||'))delete p.active[key]});
   Object.keys(p.frequency||{}).forEach(key=>{if(key.startsWith(c+'||'))delete p.frequency[key]});
 });
 if(editingCategoryName===c)editingCategoryName=null;
 save();
 refresh();
 toast('Kategorie gelöscht.');
}
window.deleteSub=async(c,s)=>{
 const cnt=subEntryCount(c,s);
 const ok=await appConfirm({title:'Unterkategorie löschen?',message:`„${s}“ wird aus „${c}“ entfernt.${cnt?`\n\n${cnt} ${cnt===1?'Eintrag nutzt':'Einträge nutzen'} diese Unterkategorie.`:''}`,confirmText:'Löschen',danger:true});
 if(!ok)return;
 data.categories[c]=data.categories[c].filter(x=>x!==s);
 Object.values(data.profiles).forEach(p=>{
   if(p.active)delete p.active[k(c,s)];
   if(p.frequency)delete p.frequency[k(c,s)];
 });
 save();
 refresh();
 toast('Unterkategorie gelöscht.');
}

function entries(d){return data.entries.filter(e=>e.dog===d)}
function calendarEntries(){
 let selected=document.getElementById('calendarDog')?.value || '__all__';
 return selected==='__all__' ? data.entries : data.entries.filter(e=>e.dog===selected);
}

function last(d,sub){return entries(d).filter(e=>e.exercises.some(x=>x.subcategory===sub)).sort((a,b)=>b.date.localeCompare(a.date))[0]}
function backup(){
 let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');
 let stamp=new Date().toLocaleString('sv-SE').replace(' ','_').replaceAll(':','-');
 a.href=URL.createObjectURL(blob);
 a.download=`V97_backup_training-tracker_${stamp}.json`;
 a.click();
 URL.revokeObjectURL(a.href);
}
function validateImportedData(obj){
 if(!obj || typeof obj!=='object')throw new Error('Die Datei enthält kein gültiges Backup.');
 const cleaned={
   dogs:Array.isArray(obj.dogs)?obj.dogs.filter(Boolean):[],
   categories:obj.categories&&typeof obj.categories==='object'?obj.categories:structuredClone(defaultCategories),
   profiles:obj.profiles&&typeof obj.profiles==='object'?obj.profiles:{},
   entries:Array.isArray(obj.entries)?obj.entries:[]
 };
 const dogSet=new Set(cleaned.dogs);
 Object.keys(cleaned.profiles||{}).forEach(d=>d&&dogSet.add(d));
 cleaned.entries.forEach(e=>e&&e.dog&&dogSet.add(e.dog));
 cleaned.dogs=[...dogSet];
 if(!cleaned.dogs.length)throw new Error('Im Backup wurden keine Hunde gefunden.');
 if(!cleaned.categories || typeof cleaned.categories!=='object')cleaned.categories=structuredClone(defaultCategories);
 Object.entries(cleaned.categories).forEach(([cat,subs])=>{
   if(!Array.isArray(subs))cleaned.categories[cat]=[];
 });
 try{
   return normalize(cleaned);
 }catch(err){
   console.warn('Import-Normalisierung mit Migration fehlgeschlagen, lade defensiv.',err);
   const fallback={
     dogs:cleaned.dogs,
     categories:structuredClone(defaultCategories),
     profiles:cleaned.profiles,
     entries:cleaned.entries
   };
   fallback.dogs.forEach(d=>ensureProfileInDataObject(fallback,d));
   return fallback;
 }
}
function importBackup(ev){
 const f=ev.target.files[0];
 if(!f)return;
 const reader=new FileReader();
 reader.onload=async()=>{
   try{
     const imported=validateImportedData(JSON.parse(reader.result));
     const ok=await appConfirm({title:'Backup importieren?',message:`Das aktuelle Training, Hunde, Kategorien und Einstellungen werden überschrieben.\n\nBackup enthält: ${imported.dogs.length} Hunde und ${imported.entries.length} Einträge.`,confirmText:'Importieren',danger:false});
     if(!ok)return;
     data=imported;
     if(!save())return;
     refresh();
     show('dogs');
     toast(`Backup importiert: ${data.dogs.length} Hunde, ${data.entries.length} Einträge.`);
   }catch(err){
     console.error(err);
     alert('Backup konnte nicht importiert werden: '+(err.message||err));
   }finally{
     ev.target.value='';
   }
 };
 reader.readAsText(f);
}
async function clearAll(){
 const ok=await appConfirm({title:'Alle Daten löschen?',message:'Alle Hunde, Trainingsprofile, Kategorien und Einträge werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',confirmText:'Alles löschen',danger:true});
 if(!ok)return;
 localStorage.removeItem(STORAGE_KEY);
 if(typeof LEGACY_STORAGE_KEYS!=='undefined'){
   LEGACY_STORAGE_KEYS.forEach(k=>localStorage.removeItem(k));
 }
 data=normalize({});
 selectedDay=null;
 refresh();
 show('dogs');
 toast('Alle App-Daten gelöscht.');
}
const predefinedCategoryColors=new Set(['BH','IGP','Schutzdienst','Obedience','Nasenarbeit','Trainingsmethoden','Fitness','Tricks','Basics','Spaziergang','Medical Training','Entspannung']);
function safeCatClassName(c){return 'cat-'+String(c||'default').replace(/\s+/g,'-').replace(/[^\wäöüÄÖÜß-]/g,'')}
function catClass(c){
 if(c==='IGP Sonstiges'||c==='IGP')return'cat-IGP';
 return predefinedCategoryColors.has(c)?safeCatClassName(c):'cat-user';
}
function shortCat(c){return c==='Unterordnung'?'UO':(c==='IGP Sonstiges'||c==='IGP')?'IGP':c}


function updateDurationVisibility(){
 const wrap=document.getElementById('durationMinutesWrap');
 if(wrap)wrap.style.display=(getTrainingType()==='session')?'':'none';
 const d=document.getElementById('entryDuration');
 if(d && getTrainingType()!=='session')d.value='';
}
function getTrainingType(){
 const el=document.querySelector('input[name="trainingType"]:checked');
 return el?el.value:'session';
}
document.addEventListener('change',e=>{
 if(e.target&&e.target.name==='trainingType'){
   updateDurationVisibility();
 }
});

document.addEventListener('click',function(e){
 if(e.target && e.target.id==='cancelEntryBtn'){
   cancelEntry();
 }
});


window.editEntry=id=>{let e=data.entries.find(x=>x.id===id);if(e)loadEntry(e,false)}

window.dupEntry=id=>{let e=data.entries.find(x=>x.id===id);if(e)loadEntry(e,true)}

window.delEntry=id=>{openDeleteDialog(id)}

function cancelEntry(){
 resetForm();
 if(!returnToDogIfNeeded()){
   show(returnViewAfterEdit||'today');
   if(returnViewAfterEdit==='calendar' && selectedDay)renderDayDetails();
 }
}

window.cancelEntry=cancelEntry;

function openDeleteDialog(id){
 pendingDeleteId=id;
 const dlg=document.getElementById('deleteDialog');
 if(dlg)dlg.classList.remove('hidden');
}
function closeDeleteDialog(){
 pendingDeleteId=null;
 const dlg=document.getElementById('deleteDialog');
 if(dlg)dlg.classList.add('hidden');
}
function confirmDeleteDialog(){
 if(!pendingDeleteId)return;
 data.entries=data.entries.filter(e=>e.id!==pendingDeleteId);
 pendingDeleteId=null;
 save();
 renderCalendar();
 renderToday();
 renderBalance();
 if(selectedDay)renderDayDetails();
 closeDeleteDialog();
}
document.addEventListener('click',function(e){
 if(e.target && e.target.id==='cancelDeleteBtn')closeDeleteDialog();
 if(e.target && e.target.id==='confirmDeleteBtn')confirmDeleteDialog();
 if(e.target && e.target.id==='deleteDialog')closeDeleteDialog();
});


