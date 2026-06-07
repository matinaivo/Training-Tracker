const STORAGE_KEY='trainingTrackerV14CleanFromV11'; // ab V14/V15 dauerhaft beibehalten
const LEGACY_STORAGE_KEYS=[
 'trainingTrackerGenericV12',
 'trainingTrackerRookieIvoV1',
 'trainingTrackerV14Generic',
 'trainingTrackerStableV1'
];
const defaultCategories={
 'Unterordnung':['Fußarbeit','Sitz','Platz','Steh','Vorsitz','Grundposition','Positionswechsel','Kehrtwendungen','Hier'],
 'Basics':['Futtertreiben','Liegen','Rückruf','Box','Decke','Bett','Clicker-Konditionierung'],
 'Fitness':['Laufband','Togo Ball','Wackelbrett','Propriozeptionsbälle','Cavaletti','Slalomstangen','Pylonen','Balancekissen'],
 'Sonstiges':['Fokus','Medical Training','Maulkorbtraining','Impulskontrolle'],
 'Nasenarbeit':['Fährte','Fährte Abgang','Verloren Suche','Anzeige','Geruchsdifferenzierung','Banknotensuche'],
 'IGP':['Apport','Voraus','Revieren','Hürde','Schrägwand','Verbellen','Schutzdienst Technik','Schutzdienst aktiv'],
 'Tricks':['Tricks allgemein']
};
const rules={'Laufband':1,'Togo Ball':2,'Wackelbrett':1,'Propriozeptionsbälle':1,'Balancekissen':1,'Cavaletti':1,'Slalomstangen':1,'Pylonen':1,'Fährte':1,'Fährte Abgang':1,'Verloren Suche':1,'Anzeige':1,'Banknotensuche':1,'Geruchsdifferenzierung':1,'Schutzdienst aktiv':2,'Hürde':1,'Schrägwand':2};
const clubSubs=new Set(['Schutzdienst Technik','Schutzdienst aktiv','Revieren','Hürde','Schrägwand','Verbellen']);
let data=load(), currentMonth=new Date(), selectedDay=null, editingId=null;

function load(){
 try{
   let raw=localStorage.getItem(STORAGE_KEY);
   if(!raw){
     for(const legacyKey of LEGACY_STORAGE_KEYS){
       const legacy=localStorage.getItem(legacyKey);
       if(legacy){
         localStorage.setItem(STORAGE_KEY, legacy);
         raw=legacy;
         break;
       }
     }
   }
   return normalize(JSON.parse(raw||'{}'));
 }catch{
   return normalize({});
 }
}
function normalize(x){
 let d={dogs:[],categories:structuredClone(defaultCategories),profiles:{},entries:[],...x};
 if(!d.categories)d.categories=structuredClone(defaultCategories);
 // Struktur-Migration: neue Standardstruktur ergänzen und alte Bezeichnungen in Einträgen aktualisieren.
 d.categories={...structuredClone(defaultCategories), ...d.categories};
 migrateCategoriesAndEntries(d);
 if(!Array.isArray(d.dogs))d.dogs=[];
 if(!d.profiles)d.profiles={};
 if(!Array.isArray(d.entries))d.entries=[];
 d.dogs.forEach(ensureProfile);
 return d
}
function migrateCategoriesAndEntries(d){
 const renameSub={
  'Abrufen / Rückruf':'Rückruf',
  'Apport ebenerdig':'Apport',
  'Gegenstandssuche':'Verloren Suche',
  'Technik':'Schutzdienst Technik',
  'Aktiver Schutzdienst':'Schutzdienst aktiv',
  'Dehnen / Mobilisation':null
 };
 const moveCat={
  'Rückruf':'Basics',
  'Clicker-Konditionierung':'Basics',
  'Apport':'IGP','Voraus':'IGP','Revieren':'IGP','Hürde':'IGP','Schrägwand':'IGP','Verbellen':'IGP','Schutzdienst Technik':'IGP','Schutzdienst aktiv':'IGP'
 };
 d.entries=(d.entries||[]).map(e=>{
   e.exercises=(e.exercises||[]).map(ex=>{
     let sub=renameSub.hasOwnProperty(ex.subcategory)?renameSub[ex.subcategory]:ex.subcategory;
     if(!sub)return null;
     let cat=moveCat[sub]||ex.category;
     if(ex.category==='IGP Sonstiges'||ex.category==='Schutzdienst')cat='IGP';
     if(sub==='Verloren Suche'||sub==='Fährte Abgang'||sub==='Banknotensuche')cat='Nasenarbeit';
     return {...ex,category:cat,subcategory:sub};
   }).filter(Boolean);
   if(e.exercises.length){e.category=e.exercises[0].category}
   return e;
 }).filter(e=>e.exercises&&e.exercises.length);
 // Alte Kategorien entfernen und neue Reihenfolge festlegen.
 d.categories=structuredClone(defaultCategories);
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function isoDate(dt){return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}
function today(){return isoDate(new Date())}
function daysBetween(a,b=today()){return Math.floor((new Date(b+'T12:00')-new Date(a+'T12:00'))/86400000)}
function allSubs(){return Object.entries(data.categories).flatMap(([cat,subs])=>subs.map(sub=>({cat,sub})))}
function k(cat,sub){return cat+'||'+sub}
function ensureProfile(dog){if(!dog)return; if(!data.profiles[dog])data.profiles[dog]={active:{}}; if(!data.profiles[dog].active)data.profiles[dog].active={}; allSubs().forEach(x=>{if(typeof data.profiles[dog].active[k(x.cat,x.sub)]!=='boolean')data.profiles[dog].active[k(x.cat,x.sub)]=true})}
function active(dog,cat,sub){ensureProfile(dog); return !!data.profiles[dog]?.active?.[k(cat,sub)]}
function setActive(dog,cat,sub,val){ensureProfile(dog); data.profiles[dog].active[k(cat,sub)]=!!val; save()}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function attr(s){return esc(s).replace(/'/g,'&#39;')}

document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>show(b.dataset.tab));
 entryDate.value=today();
 bind();
 refresh();
 if(!data.dogs.length) show('dogs');
});
function bind(){
 addDogBtn.onclick=addDog;
 todayDog.onchange=renderToday; balanceDog.onchange=renderBalance; calendarDog.onchange=()=>{selectedDay=null;renderCalendar()};
 entryDog.onchange=renderExercises; entryCategory.onchange=renderExercises; trainingForm.onsubmit=saveEntry;
 addTreadmillBlock.onclick=()=>addTmBlock(); prevMonth.onclick=()=>{currentMonth.setMonth(currentMonth.getMonth()-1);renderCalendar()}; nextMonth.onclick=()=>{currentMonth.setMonth(currentMonth.getMonth()+1);renderCalendar()};
 addCategoryBtn.onclick=addCategory; addSubcategoryBtn.onclick=addSubcategory; backupBtn.onclick=backup; importFile.onchange=importBackup; clearAllBtn.onclick=clearAll;
}
function show(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));refresh()}
function refresh(){fillSelects();renderDogList();renderProfile();renderExercises();renderToday();renderCalendar();renderBalance();renderSettings()}
function fillSelects(){
 ['entryDog','todayDog','balanceDog'].forEach(id=>{let s=document.getElementById(id),old=s.value;s.innerHTML='';data.dogs.forEach(d=>s.add(new Option(d,d)));if(old&&data.dogs.includes(old))s.value=old});
 let cal=document.getElementById('calendarDog');
 if(cal){
   let old=cal.value || '__all__';
   cal.innerHTML='';
   cal.add(new Option('Alle Hunde','__all__'));
   data.dogs.forEach(d=>cal.add(new Option(d,d)));
   if(old==='__all__' || data.dogs.includes(old)) cal.value=old;
 }
 ['entryCategory','subcategoryCategory'].forEach(id=>{let s=document.getElementById(id),old=s.value;s.innerHTML='';Object.keys(data.categories).forEach(c=>s.add(new Option(c,c)));if(old&&data.categories[old])s.value=old});
}
function addDog(){let n=newDogName.value.trim(); if(!n)return; if(data.dogs.includes(n)){alert('Diesen Hund gibt es schon.');return} data.dogs.push(n); ensureProfile(n); newDogName.value=''; save(); refresh(); show('dogs')}
function renderDogList(){
 dogList.innerHTML=data.dogs.length?data.dogs.map(d=>`<div class="card"><div class="dog-head"><h2>${esc(d)}</h2><button class="danger" onclick="deleteDog('${attr(d)}')">Löschen</button></div><div class="row"><label>Umbenennen<input id="rename-${attr(d)}" value="${attr(d)}"></label><button class="secondary" onclick="renameDog('${attr(d)}')">Ändern</button></div><p class="small">${entries(d).length} Einträge</p>${renderInlineProfile(d)}</div>`).join(''):'<div class="card"><h2>Noch kein Hund</h2><p>Lege zuerst einen Hund an. Danach erscheint hier automatisch das Trainingsprofil.</p></div>';
}
function renderInlineProfile(d){
 ensureProfile(d);
 return `<div class="inline-profile"><h3>Trainingsprofil</h3><p class="small">Nur aktivierte Übungen erscheinen bei „Heute sinnvoll“ und in der Balance.</p><div class="actions"><button type="button" class="secondary" onclick="setAllForDog('${attr(d)}',true)">Alles aktivieren</button><button type="button" class="secondary" onclick="setAllForDog('${attr(d)}',false)">Alles deaktivieren</button></div>${Object.entries(data.categories).map(([cat,subs])=>`<details class="profile-details"><summary>${esc(cat)}</summary>${subs.map(sub=>`<label class="profile-row"><input type="checkbox" ${active(d,cat,sub)?'checked':''} onchange="toggleProfile('${attr(d)}','${attr(cat)}','${attr(sub)}',this.checked)"> ${esc(sub)}</label>`).join('')}</details>`).join('')}</div>`;
}
window.renameDog=(old)=>{let neu=document.getElementById('rename-'+old).value.trim(); if(!neu||neu===old)return; if(data.dogs.includes(neu)){alert('Name existiert bereits.');return} data.dogs=data.dogs.map(d=>d===old?neu:d); data.profiles[neu]=data.profiles[old]; delete data.profiles[old]; data.entries.forEach(e=>{if(e.dog===old)e.dog=neu}); save(); refresh()}
window.deleteDog=(d)=>{let c=entries(d).length;if(!confirm(`Hund "${d}" löschen?${c?`\n\n${c} Einträge werden mit gelöscht.`:''}`))return;if(c&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;data.dogs=data.dogs.filter(x=>x!==d);delete data.profiles[d];data.entries=data.entries.filter(e=>e.dog!==d);save();refresh()}

function renderProfile(){renderDogList()}
window.toggleProfile=(d,cat,sub,val)=>{setActive(d,cat,sub,val);renderExercises();renderToday();renderBalance()}
function setAll(val){/* profile tab removed */}
window.setAllForDog=(d,val)=>{allSubs().forEach(x=>setActive(d,x.cat,x.sub,val));renderDogList();renderExercises();renderToday();renderBalance()}

function renderExercises(){let d=entryDog.value||data.dogs[0],cat=entryCategory.value||Object.keys(data.categories)[0]; if(!d){exerciseList.innerHTML='<p>Bitte zuerst Hund anlegen.</p>';return} let subs=(data.categories[cat]||[]).filter(s=>active(d,cat,s)); exerciseList.innerHTML=subs.length?subs.map(s=>`<label class="exercise-row"><input type="checkbox" class="ex" data-cat="${attr(cat)}" data-sub="${attr(s)}" onchange="toggleTreadmill()"> ${esc(s)}</label>`).join(''):'<p>Keine aktive Übung in dieser Kategorie.</p>'; toggleTreadmill()}
window.toggleTreadmill=()=>{let on=[...document.querySelectorAll('.ex:checked')].some(x=>x.dataset.sub==='Laufband'); treadmillBox.classList.toggle('hidden',!on); if(on&&!document.querySelector('.tm-block'))addTmBlock()}
function addTmBlock(min='',speed=''){let div=document.createElement('div');div.className='row tm-block';div.innerHTML=`<label>Minuten<input class="tm-min" type="number" min="0" step="1" value="${attr(min)}"></label><label>km/h<input class="tm-speed" type="number" min="0" step="0.1" value="${attr(speed)}"></label><button type="button" class="secondary" onclick="this.parentElement.remove()">Entfernen</button>`;treadmillBlocks.appendChild(div)}
function saveEntry(ev){
 ev.preventDefault();
 let ex=[...document.querySelectorAll('.ex:checked')].map(x=>({category:x.dataset.cat,subcategory:x.dataset.sub}));
 if(!ex.length){alert('Bitte Übung auswählen.');return}
 let keepDog=entryDog.value, keepDate=entryDate.value;
 let payload={dog:entryDog.value,date:entryDate.value,category:entryCategory.value,duration:entryDuration.value,club:entryClub.checked,exercises:ex,treadmill:[...document.querySelectorAll('.tm-block')].map(b=>({minutes:b.querySelector('.tm-min').value,speed:b.querySelector('.tm-speed').value})).filter(x=>x.minutes||x.speed),note:entryNote.value.trim()};
 if(editingId){
   let i=data.entries.findIndex(e=>e.id===editingId);
   if(i>=0){
     data.entries[i]={...data.entries[i],...payload,updatedAt:new Date().toISOString()};
     save();
     alert('Eintrag aktualisiert.');
     resetForm();
     selectedDay=payload.date;
     renderToday();renderCalendar();renderBalance();renderDogList();show('calendar');renderDayDetails();
     return;
   }
 }
 data.entries.push({id:crypto.randomUUID(),...payload,createdAt:new Date().toISOString()});
 save();
 alert('Einheit gespeichert. Du kannst direkt eine weitere Kategorie für denselben Tag eintragen.');
 clearEntryDetailsKeepDogDate(keepDog, keepDate);
 renderToday();renderCalendar();renderBalance();renderDogList();
}
function resetForm(){editingId=null;formTitle.textContent='Training eintragen';saveEntryBtn.textContent='Speichern';trainingForm.reset();entryDate.value=today();treadmillBlocks.innerHTML='';treadmillBox.classList.add('hidden');fillSelects();renderExercises()}
function clearEntryDetailsKeepDogDate(keepDog, keepDate){
 editingId=null;
 formTitle.textContent='Training eintragen';
 saveEntryBtn.textContent='Speichern';
 entryDog.value=keepDog;
 entryDate.value=keepDate;
 entryDuration.value='';
 entryClub.checked=false;
 entryNote.value='';
 treadmillBlocks.innerHTML='';
 treadmillBox.classList.add('hidden');
 document.querySelectorAll('.ex').forEach(cb=>cb.checked=false);
 toggleTreadmill();
}

function loadEntry(e,dup=false){
 editingId=dup?null:e.id;
 formTitle.textContent=dup?'Eintrag duplizieren':'Eintrag bearbeiten';
 saveEntryBtn.textContent=dup?'Als neuen Eintrag speichern':'Änderungen speichern';
 entryDog.value=e.dog;
 entryCategory.value=e.category;
 // Falls eine Übung im Profil inzwischen deaktiviert wurde, für die Bearbeitung temporär wieder aktivieren.
 (e.exercises||[]).forEach(x=>{ if(!active(e.dog,x.category,x.subcategory)) setActive(e.dog,x.category,x.subcategory,true); });
 renderExercises();
 entryDate.value=dup?today():e.date;
 entryDuration.value=e.duration||'';
 entryClub.checked=!!e.club;
 entryNote.value=e.note||'';
 document.querySelectorAll('.ex').forEach(cb=>cb.checked=e.exercises.some(x=>x.category===cb.dataset.cat&&x.subcategory===cb.dataset.sub));
 treadmillBlocks.innerHTML='';
 (e.treadmill||[]).forEach(b=>addTmBlock(b.minutes,b.speed));
 toggleTreadmill();
 show('add');
}

function renderCalendar(){let y=currentMonth.getFullYear(),m=currentMonth.getMonth();monthLabel.textContent=currentMonth.toLocaleDateString('de-DE',{month:'long',year:'numeric'});calendarGrid.innerHTML='';['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(w=>calendarGrid.insertAdjacentHTML('beforeend',`<div class="weekday">${w}</div>`));let first=new Date(y,m,1),off=(first.getDay()+6)%7,start=new Date(y,m,1-off);for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let iso=isoDate(d),es=calendarEntries().filter(e=>e.date===iso),cats=[...new Set(es.map(e=>e.category))];let div=document.createElement('div');div.className='day'+(d.getMonth()!==m?' other':'')+(iso===today()?' today':'')+(iso===selectedDay?' selected':'');div.innerHTML=`<div class="day-num">${d.getDate()}</div><div class="calendar-cats">${cats.slice(0,4).map(c=>`<span class="cat-chip ${catClass(c)}">${shortCat(c)}</span>`).join('')}</div>`;div.onclick=()=>{selectedDay=iso;renderCalendar();renderDayDetails()};calendarGrid.appendChild(div)} if(selectedDay)renderDayDetails()}
function renderDayDetails(){
 let es=calendarEntries().filter(e=>e.date===selectedDay).sort((a,b)=>(a.dog||'').localeCompare(b.dog||'')||(a.category||'').localeCompare(b.category||''));
 dayDetails.classList.remove('hidden');
 let head=`<div class="detail-head"><h2>${new Date(selectedDay+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h2><button class="secondary" onclick="closeDay()">Zur Monatsübersicht</button></div>`;
 if(!es.length){dayDetails.innerHTML=head+'<p>Kein Training.</p>';return}
 let groups={};
 es.forEach(e=>{let g=e.dog+' · '+e.category;(groups[g]||(groups[g]=[])).push(e)});
 dayDetails.innerHTML=head+Object.entries(groups).map(([g,items])=>`<h3>${esc(g)}</h3>${items.map(renderEntry).join('')}`).join('');
}
window.closeDay=()=>{selectedDay=null;dayDetails.classList.add('hidden');renderCalendar()}
function renderEntry(e){return `<div class="entry-card"><b>${esc(e.dog)}</b> <span class="cat-chip ${catClass(e.category)}">${esc(e.category)}</span> ${e.club?'<span class="pill">Hundeplatz</span>':''} ${e.duration?`<span class="pill">${esc(e.duration)} Min</span>`:''}<div>${e.exercises.map(x=>`<span class="pill">${esc(x.subcategory)}</span>`).join('')}</div>${e.treadmill?.length?`<p><b>Laufband:</b> ${e.treadmill.map(b=>`${esc(b.minutes)} Min ${esc(b.speed)} km/h`).join(' | ')}</p>`:''}${e.note?`<p>${esc(e.note)}</p>`:''}<div class="entry-actions"><button class="secondary" onclick="editEntry('${e.id}')">Bearbeiten</button><button class="secondary" onclick="dupEntry('${e.id}')">Duplizieren</button><button class="danger" onclick="delEntry('${e.id}')">Löschen</button></div></div>`}
window.editEntry=id=>{let e=data.entries.find(x=>x.id===id);if(e)loadEntry(e,false)}
window.dupEntry=id=>{let e=data.entries.find(x=>x.id===id);if(e)loadEntry(e,true)}
window.delEntry=id=>{if(confirm('Eintrag löschen?')){data.entries=data.entries.filter(e=>e.id!==id);save();renderCalendar();renderToday();renderBalance()}}

function renderToday(){let d=todayDog.value||data.dogs[0]; if(!d){todayContent.innerHTML='<div class="card"><h2>Noch kein Hund</h2><p>Bitte lege zuerst einen Hund an.</p></div>';return} let good=[],recent=[];allSubs().filter(x=>active(d,x.cat,x.sub)&&!clubSubs.has(x.sub)).forEach(x=>{let l=last(d,x.sub),days=l?daysBetween(l.date):999,p=rules[x.sub]??0;(days<=p?recent:good).push({...x,days})});good.sort((a,b)=>b.days-a.days);recent.sort((a,b)=>a.days-b.days);todayContent.innerHTML=`<div class="card"><h2>Heute sinnvoll</h2><div class="score-list">${good.slice(0,8).map(x=>sug(x,'green')).join('')||'<p>Keine Vorschläge.</p>'}</div></div><div class="card"><h2>Kürzlich trainiert</h2><div class="score-list">${recent.slice(0,8).map(x=>sug(x,'red')).join('')||'<p>Nichts blockiert.</p>'}</div></div>${balanceCard(d,'Fitness',true)}${balanceCard(d,'Unterordnung',true)}`}
function sug(x,cls){return `<div class="score-row"><span><b>${esc(x.sub)}</b><br><span class="tiny">${esc(x.cat)}</span></span><span class="pill ${cls}">${x.days===999?'noch nie':'vor '+x.days+' T.'}</span></div>`}

function renderBalance(){let d=balanceDog.value||data.dogs[0]; if(!d){balanceContent.innerHTML='<div class="card">Noch kein Hund.</div>';return} let order=['Unterordnung','Basics','Fitness','Sonstiges','Nasenarbeit','IGP','Tricks',...Object.keys(data.categories).filter(c=>!['Unterordnung','Basics','Fitness','Sonstiges','Nasenarbeit','IGP','Tricks'].includes(c))]; balanceContent.innerHTML=order.filter(c=>data.categories[c]).map(c=>balanceCard(d,c,false)).join('')}
function balanceCard(d,cat,compact){let subs=(data.categories[cat]||[]).filter(s=>active(d,cat,s));if(!subs.length)return `<div class="card"><h2>${esc(cat)}</h2><p>Keine aktiven Übungen.</p></div>`;let since=new Date();since.setDate(since.getDate()-30);let si=isoDate(since);let rows=subs.map(s=>{let cnt=entries(d).filter(e=>e.date>=si&&e.exercises.some(x=>x.category===cat&&x.subcategory===s)).length,l=last(d,s),days=l?daysBetween(l.date):999;return{sub:s,cnt,days}}).sort((a,b)=>a.cnt-b.cnt||b.days-a.days);let max=Math.max(1,...rows.map(r=>r.cnt));if(compact)rows=rows.slice(0,6);return `<div class="card"><h2>${esc(cat)} <span class="pill">30 Tage</span></h2><div class="score-list">${rows.map(r=>`<div class="score-row"><span style="flex:1"><b>${esc(r.sub)}</b><br><span class="tiny">${r.cnt}× · zuletzt ${r.days===999?'noch nie':'vor '+r.days+' T.'}</span><div class="bar-wrap"><div class="bar" style="width:${Math.max(4,Math.round(r.cnt/max*100))}%"></div></div></span><span class="pill ${r.cnt===0?'red':r.cnt<=1?'yellow':'green'}">${r.cnt}×</span></div>`).join('')}</div></div>`}

function renderSettings(){categoryList.innerHTML=Object.entries(data.categories).map(([cat,subs])=>`<div class="card"><div class="manage-head"><h2>${esc(cat)}</h2><button class="danger" onclick="deleteCategory('${attr(cat)}')">Kategorie löschen</button></div><div class="sub-list">${subs.map(s=>`<span class="pill">${esc(s)}<button class="mini-delete" onclick="deleteSub('${attr(cat)}','${attr(s)}')">×</button></span>`).join('')}</div></div>`).join('')}
function addCategory(){let c=newCategoryName.value.trim();if(!c)return;if(data.categories[c]){alert('Kategorie existiert bereits.');return}data.categories[c]=[];data.dogs.forEach(ensureProfile);newCategoryName.value='';save();refresh()}
function addSubcategory(){let c=subcategoryCategory.value,s=newSubcategoryName.value.trim();if(!s)return;if(data.categories[c].includes(s)){alert('Unterkategorie existiert bereits.');return}data.categories[c].push(s);data.dogs.forEach(d=>{ensureProfile(d);data.profiles[d].active[k(c,s)]=true});newSubcategoryName.value='';save();refresh()}
window.deleteCategory=c=>{let cnt=data.entries.filter(e=>e.category===c||e.exercises.some(x=>x.category===c)).length;if(!confirm(`Kategorie "${c}" löschen?${cnt?`\n\n${cnt} Einträge nutzen sie.`:''}`))return;if(cnt&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;delete data.categories[c];Object.values(data.profiles).forEach(p=>Object.keys(p.active).forEach(key=>{if(key.startsWith(c+'||'))delete p.active[key]}));save();refresh()}
window.deleteSub=(c,s)=>{let cnt=data.entries.filter(e=>e.exercises.some(x=>x.category===c&&x.subcategory===s)).length;if(!confirm(`Unterkategorie "${s}" löschen?${cnt?`\n\n${cnt} Einträge nutzen sie.`:''}`))return;if(cnt&&prompt('Bitte LÖSCHEN eingeben')!=='LÖSCHEN')return;data.categories[c]=data.categories[c].filter(x=>x!==s);Object.values(data.profiles).forEach(p=>delete p.active[k(c,s)]);save();refresh()}

function entries(d){return data.entries.filter(e=>e.dog===d)}
function calendarEntries(){
 let selected=document.getElementById('calendarDog')?.value || '__all__';
 return selected==='__all__' ? data.entries : data.entries.filter(e=>e.dog===selected);
}

function last(d,sub){return entries(d).filter(e=>e.exercises.some(x=>x.subcategory===sub)).sort((a,b)=>b.date.localeCompare(a.date))[0]}
function backup(){let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='training-tracker-backup.json';a.click();URL.revokeObjectURL(a.href)}
function importBackup(ev){let f=ev.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{data=normalize(JSON.parse(r.result));save();refresh();alert('Backup importiert.')}catch{alert('Backup konnte nicht gelesen werden.')}};r.readAsText(f)}
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
 alert('Alle App-Daten und alte Speicherstände wurden gelöscht.');
}
function catClass(c){if(c==='IGP Sonstiges'||c==='IGP')return'cat-IGP';return 'cat-'+String(c||'default').replace(/\s+/g,'-').replace(/[^\wäöüÄÖÜß-]/g,'')}
function shortCat(c){return c==='Unterordnung'?'UO':(c==='IGP Sonstiges'||c==='IGP')?'IGP':c==='Schutzdienst'?'SD':c}
