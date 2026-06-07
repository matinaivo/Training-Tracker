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
 'Trainingsmethoden':['Futtertreiben','Clicker-Konditionierung','Nasentarget','Vorderpfotentarget / Vorne','Hinterpfotentarget / Hinten','Ganz drauf','Vier Pfoten'],
 'Fitness':['Laufband','Togo Ball','Wackelbrett','Propriozeptionsbälle','Cavaletti','Slalomstangen','Pylonen','Balancekissen','Balancieren'],
 'Tricks':['Pfote','Pfote links','Pfote rechts','Männchen','Schlafen','Zurück'],
 'Basics':['Sitzen','Liegen','Down','Leg dich hin','Rückruf','Zu mir','Gib\'s mir','Links','Rechts'],
 'Spaziergang':['Besitzerorientierung','Leinenführigkeit kurze Leine','Leinenführigkeit Schleppleine','Raus / Auf den Weg'],
 'Medical Training':['Kooperationssignal','Fokus Training Futter','Fokus Training Objekt','Maulkorbtraining','Hochheben','Fiebermessen','Krallen schneiden','Tablettengabe','Bürsten','Augentropfen','Ohrensäubern'],
 'Entspannung':['Ruhetraining','Boxentraining','Deckentraining','Entspannungssignal','Anbinden','Alleine bleiben','Warten']
};

const categoryBlocks=[
 {name:'Hundesport',categories:['BH','IGP','Schutzdienst','Obedience','Nasenarbeit']},
 {name:'Training & Aufbau',categories:['Trainingsmethoden','Fitness','Tricks']},
 {name:'Alltag & Management',categories:['Basics','Spaziergang','Medical Training','Entspannung']}
];
function blockForCategory(cat){
 const b=categoryBlocks.find(x=>x.categories.includes(cat));
 return b?b.name:'Weitere';
}

const rules={'Laufband':1,'Togo Ball':2,'Wackelbrett':1,'Propriozeptionsbälle':1,'Balancekissen':1,'Cavaletti':1,'Slalomstangen':1,'Pylonen':1,'Fährte':1,'Fährte Abgang':1,'Verloren Suche':1,'Anzeige':1,'Geruchsdifferenzierung':1,'Banknotensuche':1,'Schutzdienst aktiv':2,'Hürde':1,'Schrägwand':2};
const clubSubs=new Set(['Schutzdienst Technik','Schutzdienst aktiv','Revieren','Hürde','Schrägwand','Verbellen']);
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
let pendingDeleteId=null;
const UI_STATE_KEY='trainingTrackerV27UiState';
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
 try{
   return normalize(JSON.parse(raw));
 }catch(err){
   console.error('Training Tracker: gespeicherte Daten konnten nicht gelesen werden.', err, raw);
   window.__storageLoadError=true;
   return {dogs:[],categories:structuredClone(defaultCategories),profiles:{},entries:[],__loadError:true};
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
 return d;
}
function ensureProfileInDataObject(target,dog){
 if(!dog)return;
 if(!target.profiles[dog])target.profiles[dog]={active:{},frequency:{}};
 if(!target.profiles[dog].active)target.profiles[dog].active={};
 if(!target.profiles[dog].frequency)target.profiles[dog].frequency={};
 Object.entries(target.categories).flatMap(([cat,subs])=>subs.map(sub=>({cat,sub}))).forEach(({cat,sub})=>{
   const kk=cat+'||'+sub;
   if(typeof target.profiles[dog].active[kk]!=='boolean')target.profiles[dog].active[kk]=true;
   if(!target.profiles[dog].frequency[kk])target.profiles[dog].frequency[kk]='daily';
 });
}
function migrateCategoriesAndEntries(d){
 const renameSub={
  'Abrufen / Rückruf':'Rückruf',
  'Hier':'Abrufen mit Hier',
  'Grundposition':'Grundstellung',
  'Kehrtwendungen':'180° Kehrtwendung',
  'Apport':'Apport ebenerdig',
  'Apport ebenerdig':'Apport ebenerdig',
  'Gegenstandssuche':'Verlorensuche',
  'Verloren Suche':'Verlorensuche',
  'Technik':'Schutzdienst Technik',
  'Aktiver Schutzdienst':'Schutzdienst aktiv',
  'Dehnen / Mobilisation':null,
  'Box':'Boxentraining',
  'Decke':'Deckentraining',
  'Bett':null,
  'Ruhiges Warten':'Ruhetraining',
  'Impulskontrolle':'Impulskontrolle im Alltag'
 };
 const moveCat={
  'Fußarbeit':'BH','180° Kehrtwendung':'BH','Winkel links':'BH','Winkel rechts':'BH','Grundstellung':'BH','Anhalten mit Grundstellung':'BH','Vorsitz':'BH','Abrufen mit Hier':'BH','Sitz':'BH','Platz':'BH','Steh':'BH','Sitz aus der Bewegung':'BH','Platz aus der Bewegung':'BH','Steh aus der Bewegung':'BH','Ablage':'BH','Gruppe':'BH',
  'Voraus':'IGP','Apport ebenerdig':'IGP','Apport Sprung':'IGP','Apport Kletterwand':'IGP','Hürde':'IGP','Schrägwand':'IGP',
  'Revieren':'Schutzdienst','Verbellen':'Schutzdienst','Helferfokus':'Schutzdienst','Rückentransport':'Schutzdienst','Seitentransport':'Schutzdienst','Kurze Flucht':'Schutzdienst','Lange Flucht':'Schutzdienst','Angriff aus Bewachung':'Schutzdienst','Überfall aus Transport':'Schutzdienst','Aus':'Schutzdienst','Schutzdienst Technik':'Schutzdienst','Schutzdienst aktiv':'Schutzdienst',
  'Distanzkontrolle':'Obedience','Box':'Obedience','Richtungsapport':'Obedience','Pylon':'Obedience','Positionswechsel':'Obedience','Identifikation':'Obedience',
  'Fährte':'Nasenarbeit','Fährte Abgang':'Nasenarbeit','Verlorensuche':'Nasenarbeit','Anzeige':'Nasenarbeit','Geruchsdifferenzierung':'Nasenarbeit','Banknotensuche':'Nasenarbeit',
  'Futtertreiben':'Trainingsmethoden','Clicker-Konditionierung':'Trainingsmethoden','Nasentarget':'Trainingsmethoden','Vorderpfotentarget / Vorne':'Trainingsmethoden','Hinterpfotentarget / Hinten':'Trainingsmethoden','Ganz drauf':'Trainingsmethoden','Vier Pfoten':'Trainingsmethoden',
  'Laufband':'Fitness','Togo Ball':'Fitness','Wackelbrett':'Fitness','Propriozeptionsbälle':'Fitness','Cavaletti':'Fitness','Slalomstangen':'Fitness','Pylonen':'Fitness','Balancekissen':'Fitness','Balancieren':'Fitness',
  'Pfote':'Tricks','Pfote links':'Tricks','Pfote rechts':'Tricks','Männchen':'Tricks','Schlafen':'Tricks','Zurück':'Tricks',
  'Sitzen':'Basics','Liegen':'Basics','Down':'Basics','Leg dich hin':'Basics','Rückruf':'Basics','Zu mir':'Basics',"Gib's mir":'Basics','Links':'Basics','Rechts':'Basics',
  'Besitzerorientierung':'Spaziergang','Leinenführigkeit kurze Leine':'Spaziergang','Leinenführigkeit Schleppleine':'Spaziergang','Raus / Auf den Weg':'Spaziergang',
  'Kooperationssignal':'Medical Training','Medical Training':'Medical Training','Fokus Training Futter':'Medical Training','Fokus Training Objekt':'Medical Training','Maulkorbtraining':'Medical Training','Hochheben':'Medical Training','Fiebermessen':'Medical Training','Krallen schneiden':'Medical Training','Tablettengabe':'Medical Training','Bürsten':'Medical Training','Augentropfen':'Medical Training','Ohrensäubern':'Medical Training',
  'Ruhetraining':'Entspannung','Boxentraining':'Entspannung','Deckentraining':'Entspannung','Entspannungssignal':'Entspannung','Anbinden':'Entspannung','Alleine bleiben':'Entspannung','Warten':'Entspannung'
 };
 d.entries=(d.entries||[]).map(e=>{
   e.exercises=(e.exercises||[]).map(ex=>{
     let sub=renameSub.hasOwnProperty(ex.subcategory)?renameSub[ex.subcategory]:ex.subcategory;
     if(!sub)return null;
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
     if(!renamed)return;
     const targetCat=moveCat[renamed]||cat;
     if(!merged[targetCat])merged[targetCat]=[];
     if(!merged[targetCat].includes(renamed))merged[targetCat].push(renamed);
   });
 });
 d.categories=merged;
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
 if(!data.profiles[dog])data.profiles[dog]={active:{},frequency:{}};
 if(!data.profiles[dog].active)data.profiles[dog].active={};
 if(!data.profiles[dog].frequency)data.profiles[dog].frequency={};
 allSubs().forEach(x=>{
   const kk=k(x.cat,x.sub);
   if(typeof data.profiles[dog].active[kk]!=='boolean')data.profiles[dog].active[kk]=true;
   if(!data.profiles[dog].frequency[kk])data.profiles[dog].frequency[kk]='daily';
 });
}
function active(dog,cat,sub){ensureProfile(dog); return !!data.profiles[dog]?.active?.[k(cat,sub)]}
function setActive(dog,cat,sub,val){ensureProfile(dog); data.profiles[dog].active[k(cat,sub)]=!!val; save()}
function getFrequency(dog,cat,sub){ensureProfile(dog); return data.profiles[dog].frequency?.[k(cat,sub)]||'daily'}
function setFrequency(dog,cat,sub,val){ensureProfile(dog); data.profiles[dog].frequency[k(cat,sub)]=val||'daily'; save()}
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
function renderDogList(){
 dogList.innerHTML=data.dogs.length?data.dogs.map(d=>`<div class="card"><div class="dog-head"><h2>${esc(d)}</h2><button class="danger" onclick="deleteDog('${attr(d)}')">Löschen</button></div><div class="row"><label>Umbenennen<input id="rename-${attr(d)}" value="${attr(d)}"></label><button class="secondary" onclick="renameDog('${attr(d)}')">Ändern</button></div><p class="small">${entries(d).length} Einträge</p>${renderInlineProfile(d)}</div>`).join(''):'<div class="card"><h2>Noch kein Hund</h2><p>Lege zuerst einen Hund an. Danach erscheint hier automatisch das Trainingsprofil.</p></div>';
}
function renderInlineProfile(d){
 ensureProfile(d);
 return `<div class="inline-profile"><h3>Trainingsprofil</h3><p class="small">Öffne einen Oberbereich und aktiviere die Übungen, die für diesen Hund relevant sind.</p>${categoryBlocks.map(block=>`<details class="profile-block"><summary>${esc(block.name)}</summary>${block.categories.filter(cat=>data.categories[cat]).map(cat=>`<details class="profile-details"><summary>${esc(cat)}</summary><div class="profile-category-actions"><button type="button" class="secondary profile-action" onclick="toggleCategoryForDog('${attr(d)}','${attr(cat)}',true)">Alle aktivieren</button><button type="button" class="secondary profile-action" onclick="toggleCategoryForDog('${attr(d)}','${attr(cat)}',false)">Alle deaktivieren</button></div>${(data.categories[cat]||[]).map(sub=>`<div class="profile-row profile-row-frequency"><label><input type="checkbox" class="profile-sub" data-dog="${attr(d)}" data-cat="${attr(cat)}" data-sub="${attr(sub)}" ${active(d,cat,sub)?'checked':''} onchange="toggleProfile('${attr(d)}','${attr(cat)}','${attr(sub)}',this.checked)"> ${esc(sub)}</label><select class="frequency-select" onchange="changeFrequency('${attr(d)}','${attr(cat)}','${attr(sub)}',this.value)">${frequencyOptions.map(f=>`<option value="${f.value}" ${getFrequency(d,cat,sub)===f.value?'selected':''}>${f.label}</option>`).join('')}</select></div>`).join('')}</details>`).join('')}</details>`).join('')}</div>`;
}

window.renameDog=(old)=>{let neu=document.getElementById('rename-'+old).value.trim(); if(!neu||neu===old)return; if(data.dogs.includes(neu)){toast('Name existiert bereits.','warn');return} data.dogs=data.dogs.map(d=>d===old?neu:d); data.profiles[neu]=data.profiles[old]; delete data.profiles[old]; data.entries.forEach(e=>{if(e.dog===old)e.dog=neu}); save(); refresh()}
window.deleteDog=(d)=>{let c=entries(d).length;if(!confirm(`Hund "${d}" löschen?${c?`\n\n${c} Einträge werden mit gelöscht.`:''}`))return;if(c&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;data.dogs=data.dogs.filter(x=>x!==d);delete data.profiles[d];data.entries=data.entries.filter(e=>e.dog!==d);save();refresh()}

function renderProfile(){renderDogList()}
window.toggleProfile=(d,cat,sub,val)=>{
 setActive(d,cat,sub,val);
 renderExercises();renderToday();renderBalance();
 toast('Profil automatisch gespeichert.');
}
window.changeFrequency=(d,cat,sub,val)=>{
 setFrequency(d,cat,sub,val);
 renderToday();renderBalance();
 toast('Trainingshäufigkeit gespeichert.');
}
window.toggleCategoryForDog=(d,cat,val)=>{
 (data.categories[cat]||[]).forEach(sub=>setActive(d,cat,sub,val));
 renderDogList();renderExercises();renderToday();renderBalance();
 toast('Profil automatisch gespeichert.');
}
function setAll(val){/* Profile-Reiter entfernt */}

function renderExercises(){
 let d=entryDog.value||data.dogs[0];
 if(!d){exerciseList.innerHTML='<p>Bitte zuerst Hund anlegen.</p>';return}
 const blocks=categoryBlocks.map(block=>{
   const cats=block.categories.filter(cat=>(data.categories[cat]||[]).some(s=>active(d,cat,s)));
   if(!cats.length)return '';
   return `<details class="entry-block"><summary>${esc(block.name)}</summary>${cats.map(cat=>{
     const subs=(data.categories[cat]||[]).filter(s=>active(d,cat,s));
     return `<details class="entry-category"><summary>${esc(cat)}</summary>${subs.map(s=>`<label class="exercise-row"><input type="checkbox" class="ex" data-cat="${attr(cat)}" data-sub="${attr(s)}" onchange="toggleTreadmill()"> ${esc(s)}</label>`).join('')}</details>`;
   }).join('')}</details>`;
 }).filter(Boolean);
 exerciseList.innerHTML=blocks.length?blocks.join(''):'<p>Für diesen Hund sind keine Übungen aktiv.</p>';
 toggleTreadmill();
}
window.toggleTreadmill=()=>{let on=[...document.querySelectorAll('.ex:checked')].some(x=>x.dataset.sub==='Laufband'); treadmillBox.classList.toggle('hidden',!on); if(on&&!document.querySelector('.tm-block'))addTmBlock()}
function addTmBlock(min='',speed=''){let div=document.createElement('div');div.className='tm-block';div.innerHTML=`<label>Minuten<input class="tm-min" type="number" min="0" step="1" value="${attr(min)}"></label><label>km/h<input class="tm-speed" type="number" min="0" step="0.1" value="${attr(speed)}"></label><button type="button" class="secondary" onclick="this.parentElement.remove()">Entfernen</button>`;treadmillBlocks.appendChild(div)}
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
     const cat=cats[0];
     let payload={dog:entryDog.value,date:entryDate.value,category:cat,duration:entryDuration.value,club:false,exercises:groups[cat],treadmill:treadmillData,note:entryNote.value.trim()};
     data.entries[i]={...data.entries[i],...payload,updatedAt:new Date().toISOString()};
     if(!save())return;
     toast('Eintrag aktualisiert.');
     resetForm();
     selectedDay=payload.date;
     renderToday();renderCalendar();renderBalance();renderDogList();show(returnViewAfterEdit||'calendar');if(selectedDay)renderDayDetails();
     return;
   }
 }
 cats.forEach(cat=>{
   data.entries.push({id:crypto.randomUUID(),dog:entryDog.value,date:entryDate.value,category:cat,duration:entryDuration.value,club:false,exercises:groups[cat],treadmill:groups[cat].some(x=>x.subcategory==='Laufband')?treadmillData:[],note:entryNote.value.trim(),createdAt:new Date().toISOString()});
 });
 if(!save())return;
 toast(cats.length===1?'Einheit gespeichert.':`${cats.length} Kategorien gespeichert.`);
 resetForm();
 selectedDay=keepDate;
 renderToday();renderCalendar();renderBalance();renderDogList();
 show(returnViewAfterEdit||'today');if(selectedDay&&returnViewAfterEdit==='calendar')renderDayDetails();
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
 document.querySelectorAll('.ex').forEach(cb=>{
   cb.checked=(e.exercises||[]).some(x=>x.category===cb.dataset.cat&&x.subcategory===cb.dataset.sub);
   const details=cb.closest('details');
   if(cb.checked && details) details.open=true;
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
   const details=cb.closest('details');
   if(cb.checked && details) details.open=true;
 });
 toggleTreadmill();
}

function renderCalendar(){let y=currentMonth.getFullYear(),m=currentMonth.getMonth();monthLabel.textContent=currentMonth.toLocaleDateString('de-DE',{month:'long',year:'numeric'});calendarGrid.innerHTML='';['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(w=>calendarGrid.insertAdjacentHTML('beforeend',`<div class="weekday">${w}</div>`));let first=new Date(y,m,1),off=(first.getDay()+6)%7,start=new Date(y,m,1-off);for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let iso=isoDate(d),es=calendarEntries().filter(e=>e.date===iso),cats=[...new Set(es.map(e=>e.category))];let div=document.createElement('div');div.className='day'+(d.getMonth()!==m?' other':'')+(iso===today()?' today':'')+(iso===selectedDay?' selected':'');div.innerHTML=`<div class="day-num">${d.getDate()}</div><div class="calendar-cats">${cats.slice(0,4).map(c=>`<span class="cat-chip ${catClass(c)}">${shortCat(c)}</span>`).join('')}</div>`;div.onclick=()=>{selectedDay=iso;renderCalendar();renderDayDetails()};calendarGrid.appendChild(div)} if(selectedDay)renderDayDetails()}
function renderDayDetails(){
 if(!selectedDay){dayDetails.classList.add('hidden');return}
 let es=calendarEntries().filter(e=>e.date===selectedDay).sort((a,b)=>(a.dog||'').localeCompare(b.dog||'')||(a.category||'').localeCompare(b.category||''));
 dayDetails.classList.remove('hidden');
 let head=`<div class="detail-head"><h2>${new Date(selectedDay+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h2><button class="secondary" onclick="closeDay()">Zur Monatsübersicht</button></div><div class="actions"><button type="button" onclick="startNewEntryForDate('${selectedDay}')">Training hinzufügen</button></div>`;
 if(!es.length){dayDetails.innerHTML=head+'<p>Kein Training.</p>';return}
 const byDog={};
 es.forEach(e=>{(byDog[e.dog]||(byDog[e.dog]=[])).push(e)});
 dayDetails.innerHTML=head+Object.entries(byDog).map(([dog,items])=>{
   const collapsed=(typeof isDogGroupCollapsed==='function')?isDogGroupCollapsed(selectedDay,dog):false;
   const body=collapsed?'':`<div class="dog-group-body">${items.map(renderEntry).join('')}</div>`;
   return `<section class="dog-day-group"><button type="button" class="dog-group-head" onclick="toggleDogGroup('${selectedDay}','${attr(dog)}')"><span>🐕 ${esc(dog)}</span><span class="dog-count">${items.length} Eintrag${items.length===1?'':'e'}</span><span>${collapsed?'⌄':'⌃'}</span></button>${body}</section>`;
 }).join('');
}
window.closeDay=()=>{selectedDay=null;dayDetails.classList.add('hidden');renderCalendar()}
function renderEntry(e){
 const typeInfo=e.trainingType==='walk'
   ? '<span class="entry-meta">🚶 Spaziergang</span>'
   : (e.trainingType==='session'&&e.duration
      ? `<span class="entry-meta">⏱ ${esc(e.duration)} Min.</span>`
      : (e.duration?`<span class="entry-meta">⏱ ${esc(e.duration)} Min.</span>`:''));
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
 allSubs().filter(x=>active(d,x.cat,x.sub)&&!clubSubs.has(x.sub)).forEach(x=>{
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
 let chip='', detail='';
 if(mode==='due'){
   chip=x.days===999?'neu':(x.overdue>0?`+${x.overdue} T.`:'fällig');
   detail=`${last} · Wunsch: ${esc(freqLabel(x.freq))}`;
   return `<button type="button" class="score-row clickable-row" onclick="startNewEntryForExercise(today(),todayDog.value,'${attr(x.cat)}','${attr(x.sub)}')"><span><b>${esc(x.sub)}</b><br><span class="tiny">${detail}</span></span><span class="pill green">${chip}</span></button>`;
 }
 const dueText=x.dueIn===1?'morgen':`in ${x.dueIn} Tagen`;
 detail=`${last} · Wunsch: ${esc(freqLabel(x.freq))}`;
 return `<button type="button" class="score-row clickable-row" onclick="startNewEntryForExercise(today(),todayDog.value,'${attr(x.cat)}','${attr(x.sub)}')"><span><b>${esc(x.sub)}</b><br><span class="tiny">${detail}</span></span><span class="pill blue">fällig ${dueText}</span></button>`;
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

function renderSettings(){categoryList.innerHTML=Object.entries(data.categories).map(([cat,subs])=>`<div class="card"><div class="manage-head"><h2>${esc(cat)}</h2><button class="danger" onclick="deleteCategory('${attr(cat)}')">Kategorie löschen</button></div><div class="sub-list">${subs.map(s=>`<span class="pill">${esc(s)}<button class="mini-delete" onclick="deleteSub('${attr(cat)}','${attr(s)}')">×</button></span>`).join('')}</div></div>`).join('')}
function addCategory(){let c=newCategoryName.value.trim();if(!c)return;if(data.categories[c]){toast('Kategorie existiert bereits.','warn');return}data.categories[c]=[];data.dogs.forEach(ensureProfile);newCategoryName.value='';save();refresh()}
function addSubcategory(){let c=subcategoryCategory.value,s=newSubcategoryName.value.trim();if(!s)return;if(data.categories[c].includes(s)){toast('Unterkategorie existiert bereits.','warn');return}data.categories[c].push(s);data.dogs.forEach(d=>{ensureProfile(d);data.profiles[d].active[k(c,s)]=true});newSubcategoryName.value='';save();refresh()}
window.deleteCategory=c=>{let cnt=data.entries.filter(e=>e.category===c||e.exercises.some(x=>x.category===c)).length;if(!confirm(`Kategorie "${c}" löschen?${cnt?`\n\n${cnt} Einträge nutzen sie.`:''}`))return;if(cnt&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;delete data.categories[c];Object.values(data.profiles).forEach(p=>Object.keys(p.active).forEach(key=>{if(key.startsWith(c+'||'))delete p.active[key]}));save();refresh()}
window.deleteSub=(c,s)=>{let cnt=data.entries.filter(e=>e.exercises.some(x=>x.category===c&&x.subcategory===s)).length;if(!confirm(`Unterkategorie "${s}" löschen?${cnt?`\n\n${cnt} Einträge nutzen sie.`:''}`))return;if(cnt&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;data.categories[c]=data.categories[c].filter(x=>x!==s);Object.values(data.profiles).forEach(p=>delete p.active[k(c,s)]);save();refresh()}

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
 a.download=`training-tracker-backup_${stamp}.json`;
 a.click();
 URL.revokeObjectURL(a.href);
}
function importBackup(ev){let f=ev.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{data=normalize(JSON.parse(r.result));save();refresh();toast('Backup importiert.')}catch{toast('Backup konnte nicht gelesen werden.','warn')}};r.readAsText(f)}
function clearAll(){
 if(!confirm('Alle Daten löschen?'))return;
 if(prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;
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
function catClass(c){if(c==='IGP Sonstiges'||c==='IGP')return'cat-IGP';if(c==='Basics')return'cat-Basics';return 'cat-'+String(c||'default').replace(/\s+/g,'-').replace(/[^\wäöüÄÖÜß-]/g,'')}
function shortCat(c){return c==='Unterordnung'?'UO':(c==='IGP Sonstiges'||c==='IGP')?'IGP':c}

function getTrainingType(){
 const el=document.querySelector('input[name="trainingType"]:checked');
 return el?el.value:'session';
}
document.addEventListener('change',e=>{
 if(e.target&&e.target.name==='trainingType'){
   const d=document.getElementById('entryDuration');
   if(d){
     d.style.display=(getTrainingType()==='walk')?'none':'';
   }
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
 show(returnViewAfterEdit||'today');
 if(returnViewAfterEdit==='calendar' && selectedDay)renderDayDetails();
}

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
