'use strict';
/* =====================================================================
   YourProgress – Online Aptitude Test & Student Performance Analysis
   Single-page app. Data lives in the Flask backend (SQLite database).
   ===================================================================== */

/* ---------- theme storage + server calls ---------- */
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
};
let DB=null;
async function api(method,url,body){
  const o={method,headers:{'X-Requested-With':'YourProgress'},credentials:'same-origin'};
  if(body instanceof FormData)o.body=body;
  else if(body!==undefined){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body)}
  let r;
  try{r=await fetch(url,o)}catch(e){throw new Error('Cannot reach the server. Is the Flask app running?')}
  let d=null;try{d=await r.json()}catch(e){}
  if(r.status===401&&S.user&&url!=='/api/login'){S.user=null;DB=null;render();throw new Error('Your session has ended. Please sign in again.')}
  if(!r.ok)throw new Error((d&&d.error)||'Something went wrong ('+r.status+').');
  return d;
}
async function loadData(){const d=await api('GET','/api/bootstrap');DB=d.data;S.user=d.user;return d}
async function mutate(fn,msg){
  try{const r=await fn();await loadData();if(msg)toast(msg,'ok');return r||true}
  catch(e){toast(e.message,'bad');return false}
}

/* ---------- tiny helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const num=v=>{const n=parseFloat(v);return isNaN(n)?0:n};
const r1=n=>(Math.round(n*10)/10).toFixed(1);
const r2=n=>(Math.round(n*100)/100).toFixed(2);
const pctTxt=v=>v==null?'—':r1(v)+'%';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const pad=n=>String(n).padStart(2,'0');
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const fmtDate=iso=>{try{return new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch(e){return iso}};
const fmtDT=iso=>{try{return new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return iso}};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

const IC={
  dash:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/><path d="M17 3.13a4 4 0 0 1 0 7.75"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  check:'<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  trend:'<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  menu:'<path d="M3 12h18M3 6h18M3 18h18"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>'
};
const ico=(n,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
const LOGO=`<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#FFD23F"/><path d="M6 22 L12 16 L17 19 L26 8" fill="none" stroke="#0F1A3C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- calculation engine ---------- */
const sc=()=>DB.settings;
function gradeOf(p){
  const t=[[80,10,'O'],[70,9,'A'],[60,8,'B'],[55,7,'C'],[50,6,'D'],[45,5,'E'],[40,4,'P']];
  for(const [m,gp,g] of t)if(p>=m)return{gp,g};
  return{gp:0,g:'F'};
}
function calcSubject(s){
  const S=sc(),th=num(s.th),it=num(s.int),total=th+it,max=S.thMax+S.intMax;
  const pct=max?total/max*100:0,thOk=th>=S.thMin,intOk=it>=S.intMin,pass=thOk&&intOk;
  const g=pass?gradeOf(pct):{gp:0,g:'F'};
  return{name:s.name,th,int:it,total,max,pct,thOk,intOk,pass,gp:g.gp,grade:g.g};
}
function calcSem(rec){
  const subs=rec.subjects.map(calcSubject);
  const total=subs.reduce((a,s)=>a+s.total,0),max=subs.reduce((a,s)=>a+s.max,0);
  const failed=subs.filter(s=>!s.pass),n=subs.length,gp=subs.reduce((a,s)=>a+s.gp,0);
  return{sem:rec.sem,subs,total,max,pct:max?total/max*100:0,sgpa:n?gp/n:0,gp,n,failed,pass:failed.length===0};
}
const studentSems=sid=>DB.marks.filter(m=>m.studentId===sid&&m.subjects.length).sort((a,b)=>a.sem-b.sem).map(calcSem);
function cgpaOf(sems){const n=sems.reduce((a,s)=>a+s.n,0);return n?sems.reduce((a,s)=>a+s.gp,0)/n:null}
function attOf(sid,sem){
  let t=0,p=0;
  DB.attendance.forEach(s=>{if(sem&&s.sem!==sem)return;const r=s.records[sid];if(r){t++;if(r==='P')p++}});
  return{total:t,present:p,pct:t?p/t*100:null};
}
const attemptsOf=sid=>DB.attempts.filter(a=>a.studentId===sid).sort((a,b)=>a.date.localeCompare(b.date));
const sortedStudents=()=>DB.students.slice().sort((a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true}));

/* ---------- app state ---------- */
const S={user:null,route:'dashboard',loginRole:'admin',sel:{sid:null},ui:{},edit:null,exam:null,result:null,timer:null};
const NAV={
  admin:[['dashboard','Dashboard','dash'],['students','Students','users'],['tests','PDF & Tests','file'],['attendance','Attendance','cal'],['marks','Semester marks','edit'],['results','Results & CGPA','award'],['analytics','Analytics','trend'],['settings','Settings','sliders']],
  student:[['dashboard','My overview','dash'],['tests','Aptitude tests','check'],['attendance','My attendance','cal'],['results','My results','award'],['analytics','My progress','trend']]
};
let charts={};

/* ---------- UI primitives ---------- */
function toast(msg,kind){const t=$('#toast');t.textContent=msg;t.className='on '+(kind||'');clearTimeout(toast.t);toast.t=setTimeout(()=>{t.className=''},3000)}
function openModal(html,wide){const o=$('#overlay');o.innerHTML=`<div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">${html}</div>`;o.classList.add('on')}
function closeModal(){const o=$('#overlay');o.classList.remove('on');o.innerHTML=''}
function confirmBox(msg,yes,fn){
  window.__confirm=fn;
  openModal(`<h3>Please confirm</h3><p class="muted">${esc(msg)}</p><div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn danger" onclick="closeModal();window.__confirm()">${esc(yes)}</button></div>`);
}
function toggleTheme(){
  const cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  const n=cur==='dark'?'light':'dark';
  document.documentElement.dataset.theme=n;store.set('yp_theme',n);
  S.user?refresh():render();
}
function toggleSide(open){const sh=$('.shell');if(sh)sh.classList.toggle('open',open)}

/* ---------- charts ---------- */
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function drawChart(id,type,data,extra){
  const el=document.getElementById(id);if(!el)return;
  if(charts[id]){charts[id].destroy();delete charts[id]}
  if(!window.Chart){el.parentElement.innerHTML='<div class="empty small">Charts need an internet connection to load Chart.js.</div>';return}
  Chart.defaults.font.family="'Public Sans',system-ui,sans-serif";
  Chart.defaults.color=cssv('--muted');Chart.defaults.borderColor=cssv('--line');
  const opts=Object.assign({responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:data.datasets.length>1,position:'bottom',labels:{boxWidth:10,usePointStyle:true}}}},extra||{});
  charts[id]=new Chart(el,{type,data,options:opts});
}
function lineChart(id,labels,sets,o={}){
  const cols=[cssv('--c1'),cssv('--c3'),cssv('--c2'),cssv('--c4')];
  drawChart(id,'line',{labels,datasets:sets.map((s,i)=>({label:s.label,data:s.data,borderColor:cols[i],backgroundColor:cols[i],tension:.3,spanGaps:true,pointRadius:4,pointHoverRadius:6,borderWidth:2.5,borderDash:s.dash?[6,5]:[],fill:false}))},
    {scales:{y:{min:o.min??0,max:o.max??100,ticks:{callback:v=>v+(o.suffix||'')}},x:{grid:{display:false}}}});
}
function barChart(id,labels,data,o={}){
  const col=o.color||cssv('--c2');
  drawChart(id,'bar',{labels,datasets:[{label:o.label||'',data,backgroundColor:col,borderRadius:6,maxBarThickness:o.horizontal?22:44}]},
    {indexAxis:o.horizontal?'y':'x',plugins:{legend:{display:false}},
     scales:{[o.horizontal?'x':'y']:{min:o.min??0,max:o.max??100,ticks:{callback:v=>v+(o.suffix||'')}},[o.horizontal?'y':'x']:{grid:{display:false}}}});
}
const chartCard=(title,sub,id,h)=>`<div class="card"><h3>${title}</h3>${sub?`<p class="muted sm">${sub}</p>`:''}<div class="chartbox" style="${h?'height:'+h+'px':''}"><canvas id="${id}"></canvas></div></div>`;

/* ---------- auth ---------- */
function setRole(r){S.loginRole=r;render()}
function enter(e){if(e.key==='Enter')doLogin()}
async function doLogin(){
  const u=$('#lu').value.trim(),p=$('#lp').value,err=$('#lerr');
  if(!u||!p){err.textContent='Enter your '+(S.loginRole==='admin'?'username':'roll number')+' and password.';return}
  try{await api('POST','/api/login',{role:S.loginRole,username:u,password:p});await loadData()}
  catch(e){err.textContent=e.message;return}
  S.route='dashboard';S.sel.sid=null;S.ui={};render();
}
async function logout(){endExam();try{await api('POST','/api/logout')}catch(e){}S.user=null;DB=null;S.edit=null;S.result=null;render()}

/* ---------- navigation / render ---------- */
function go(r){
  if(S.exam&&r!=='tests'){confirmBox('Leave this test? Your answers will be lost.','Leave test',()=>{endExam();go(r)});return}
  S.route=r;if(r!=='tests'){S.edit=null;S.result=null}
  toggleSide(false);render();
}
function loginView(){
  const adm=S.loginRole!=='student';
  return `<div class="login">
  <section class="hero">
    <div class="brand">${LOGO}<span>YourProgress</span></div>
    <h1>Six semesters, one clear picture.</h1>
    <p>Marks, attendance and aptitude tests for every student, with CGPA and progress graphs worked out for you.</p>
    <svg class="trace-svg" viewBox="0 0 520 280" role="img" aria-label="Line graph of a student's percentage rising across six semesters">
      <g stroke="currentColor" opacity=".18" stroke-width="1"><path d="M20 44H500M20 104H500M20 164H500M20 224H500"/></g>
      <path class="trace" pathLength="1" d="M40 200 L130 170 L220 178 L310 120 L400 96 L490 44" fill="none" stroke="#FFD23F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="dots" fill="#FFD23F"><circle cx="40" cy="200" r="6"/><circle cx="130" cy="170" r="6"/><circle cx="220" cy="178" r="6"/><circle cx="310" cy="120" r="6"/><circle cx="400" cy="96" r="6"/><circle cx="490" cy="44" r="6"/></g>
      <g fill="currentColor" font-size="12" opacity=".75" text-anchor="middle"><text x="40" y="262">Sem 1</text><text x="130" y="262">Sem 2</text><text x="220" y="262">Sem 3</text><text x="310" y="262">Sem 4</text><text x="400" y="262">Sem 5</text><text x="490" y="262">Sem 6</text></g>
    </svg>
    <div class="foot">Online Aptitude Test &amp; Student Performance Analysis System</div>
  </section>
  <section class="lform"><div class="lcard">
    <div class="lt"><h2>Sign in</h2><button class="icon-btn" onclick="toggleTheme()" aria-label="Switch light or dark theme">${ico('moon')}</button></div>
    <div class="seg wide"><button class="${adm?'on':''}" onclick="setRole('admin')">Admin / Teacher</button><button class="${adm?'':'on'}" onclick="setRole('student')">Student</button></div>
    <div class="field"><label for="lu">${adm?'Username':'Roll number'}</label><input id="lu" autocomplete="username" onkeydown="enter(event)"></div>
    <div class="field"><label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" onkeydown="enter(event)"></div>
    <div id="lerr" class="err" role="alert"></div>
    <button class="btn block" onclick="doLogin()">Sign in</button>
    <p class="hint">${adm?'First time here? Username <b>admin</b>, password <b>admin123</b>. You can change it in Settings.':'Use your roll number. Your first password is the same as your roll number, unless your teacher has set a different one.'}</p>
  </div></section></div>`;
}
function render(){
  Object.values(charts).forEach(c=>c.destroy());charts={};
  const app=$('#app');
  if(!S.user){app.innerHTML=loginView();return}
  const role=S.user.role;
  if(!NAV[role].some(n=>n[0]===S.route))S.route='dashboard';
  const me=role==='admin'?{name:'Administrator',sub:'Teacher / Admin'}:(()=>{const s=DB.students.find(x=>x.id===S.user.id)||{};return{name:s.name||'Student',sub:'Roll no. '+(s.roll||'')}})();
  app.innerHTML=`<div class="shell">
    <aside class="side" id="side" aria-label="Main navigation">
      <div class="brand">${LOGO}<span>YourProgress</span></div>
      ${NAV[role].map(n=>`<button class="nav ${S.route===n[0]?'on':''}" onclick="go('${n[0]}')">${ico(n[2])}<span>${n[1]}</span></button>`).join('')}
      <div class="me"><b>${esc(me.name)}</b>${esc(me.sub)}<button onclick="logout()">${ico('out',16)} Sign out</button></div>
    </aside>
    <div class="scrim" onclick="toggleSide(false)"></div>
    <div class="main">
      <header class="top"><button class="icon-btn menu" onclick="toggleSide(true)" aria-label="Open menu">${ico('menu')}</button><h1 class="pt"></h1><div class="grow"></div><button class="icon-btn" onclick="toggleTheme()" aria-label="Switch light or dark theme">${ico('moon')}</button></header>
      <main class="content" id="content"></main>
    </div></div>`;
  refresh();window.scrollTo(0,0);
}
function refresh(){
  if(!S.user)return;
  const y=window.scrollY;
  Object.values(charts).forEach(c=>c.destroy());charts={};
  const p=PAGES[S.route]();
  $('#content').innerHTML=p.html;$('.pt').textContent=p.title;
  if(p.mount)p.mount();
  window.scrollTo(0,y);
}

/* shared UI */
function curStudent(){
  if(S.user.role==='student')return DB.students.find(s=>s.id===S.user.id);
  return DB.students.find(s=>s.id===S.sel.sid)||sortedStudents()[0];
}
function studentPicker(){
  if(S.user.role!=='admin')return '';
  const cur=curStudent();
  return `<div class="field"><label for="sp">Student</label><select id="sp" onchange="S.sel.sid=this.value;S.ui.mk=null;refresh()">${sortedStudents().map(s=>`<option value="${s.id}" ${cur&&cur.id===s.id?'selected':''}>${esc(s.roll)} – ${esc(s.name)}</option>`).join('')}</select></div>`;
}
const noStudents=()=>`<div class="card empty big"><h2>No students yet</h2><p>Add a student first, or load sample data to explore the system.</p><div class="row center"><button class="btn" onclick="go('students');studentForm()">Add student</button><button class="btn ghost" onclick="loadDemo()">Load sample data</button></div></div>`;
function filterRows(q,id){q=q.toLowerCase();document.querySelectorAll('#'+id+' tbody tr').forEach(tr=>{tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none'})}

/* =====================================================================
   DASHBOARDS
   ===================================================================== */
function adminDash(){
  const st=sortedStudents();
  if(!st.length)return{title:'Dashboard',html:`<div class="card empty big"><h2>Start by adding students</h2><p>Add your first student, or load sample data to see six semesters of marks, attendance and tests in action.</p><div class="row center"><button class="btn" onclick="go('students');studentForm()">Add student</button><button class="btn ghost" onclick="loadDemo()">Load sample data</button></div></div>`};
  const semsBy=st.map(s=>studentSems(s.id));
  const all=semsBy.flat();
  const cg=avg(semsBy.map(cgpaOf).filter(v=>v!=null));
  const at=avg(st.map(s=>attOf(s.id).pct).filter(v=>v!=null));
  const pass=all.length?all.filter(s=>s.pass).length/all.length*100:null;
  const classAvg=[1,2,3,4,5,6].map(n=>{const a=all.filter(s=>s.sem===n).map(s=>s.pct);return a.length?+r1(avg(a)):null});
  const attn=[];
  st.forEach((s,i)=>{
    const a=attOf(s.id).pct,last=semsBy[i][semsBy[i].length-1];
    const why=[];
    if(a!=null&&a<75)why.push(`Attendance ${r1(a)}%`);
    if(last&&last.failed.length)why.push(`${last.failed.length} failed in Sem ${last.sem}`);
    if(why.length)attn.push({s,why});
  });
  const recent=DB.attempts.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const html=`
  <div class="stats">
    <div class="stat"><div class="k">Students</div><div class="v">${st.length}</div></div>
    <div class="stat"><div class="k">Average CGPA</div><div class="v">${cg==null?'—':r2(cg)}</div><div class="s">out of 10</div></div>
    <div class="stat"><div class="k">Average attendance</div><div class="v">${pctTxt(at)}</div></div>
    <div class="stat"><div class="k">Semester pass rate</div><div class="v">${pctTxt(pass)}</div><div class="s">${all.length} results</div></div>
    <div class="stat"><div class="k">Tests attempted</div><div class="v">${DB.attempts.length}</div></div>
  </div>
  <div class="cols">
    ${chartCard('Class average by semester','Average percentage of all students','cA')}
    ${chartCard('CGPA by student','Top '+Math.min(12,st.length)+' students','cB',Math.max(220,Math.min(12,st.length)*34+40))}
  </div>
  <div class="cols mt2">
    <div class="card"><h3>Needs attention</h3>${attn.length?`<ul class="list">${attn.slice(0,8).map(x=>`<li><span><b>${esc(x.s.name)}</b> <span class="muted sm">Roll ${esc(x.s.roll)}</span></span><span>${x.why.map(w=>`<span class="chip bad">${esc(w)}</span>`).join(' ')}</span></li>`).join('')}</ul>`:'<p class="empty small">Nobody is below 75% attendance or has failed subjects in their latest semester.</p>'}</div>
    <div class="card"><h3>Recent test attempts</h3>${recent.length?`<ul class="list">${recent.map(a=>{const s=DB.students.find(x=>x.id===a.studentId);return `<li><span><b>${esc(s?s.name:'Removed student')}</b><br><span class="muted sm">${esc(a.title)}</span></span><span class="right"><b>${a.score}/${a.total}</b><br><span class="muted sm">${fmtDT(a.date)}</span></span></li>`}).join('')}</ul>`:'<p class="empty small">No tests attempted yet.</p>'}</div>
  </div>`;
  return{title:'Dashboard',html,mount(){
    lineChart('cA',['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6'],[{label:'Class average',data:classAvg}],{suffix:'%'});
    const top=st.map((s,i)=>({n:s.name,c:cgpaOf(semsBy[i])})).filter(x=>x.c!=null).sort((a,b)=>b.c-a.c).slice(0,12);
    barChart('cB',top.map(x=>x.n),top.map(x=>+r2(x.c)),{horizontal:true,max:10,label:'CGPA',color:cssv('--c1')});
  }};
}
function studentDash(){
  const me=curStudent();
  if(!me)return{title:'Overview',html:'<div class="card empty">Your account could not be found. Please sign out and sign in again.</div>'};
  const sems=studentSems(me.id),last=sems[sems.length-1],cg=cgpaOf(sems),at=attOf(me.id),tries=attemptsOf(me.id);
  const avail=DB.tests.filter(t=>t.published);
  const html=`
  <div class="card"><h2>Hello, ${esc(me.name.split(' ')[0])}</h2><p class="muted">${esc(me.course)} · Semester ${me.semester}${me.year?' · '+esc(me.year):''}</p></div>
  <div class="stats">
    <div class="stat"><div class="k">CGPA</div><div class="v">${cg==null?'—':r2(cg)}</div><div class="s">out of 10</div></div>
    <div class="stat"><div class="k">${last?'Sem '+last.sem+' percentage':'Latest percentage'}</div><div class="v">${last?pctTxt(last.pct):'—'}</div></div>
    <div class="stat"><div class="k">Attendance</div><div class="v">${pctTxt(at.pct)}</div><div class="s">${at.present} of ${at.total} sessions</div></div>
    <div class="stat"><div class="k">Tests taken</div><div class="v">${tries.length}</div></div>
  </div>
  ${last&&last.failed.length?`<div class="failbox"><h4>${last.failed.length} failed subject${last.failed.length>1?'s':''} in Semester ${last.sem}</h4><ul>${last.failed.map(f=>`<li>${esc(f.name)}</li>`).join('')}</ul></div><div class="mt2"></div>`:''}
  <div class="cols">
    ${chartCard('Percentage by semester','Your progress across semesters','cA')}
    <div class="card"><h3>Aptitude tests</h3>${avail.length?`<ul class="list">${avail.slice(0,4).map(t=>`<li><span><b>${esc(t.title)}</b><br><span class="muted sm">${t.questions.length} questions · ${t.duration} min</span></span><button class="btn sm" onclick="startExam('${t.id}')">Start</button></li>`).join('')}</ul>`:'<p class="empty small">No tests are available right now.</p>'}</div>
  </div>`;
  return{title:'My overview',html,mount(){
    lineChart('cA',['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6'],[{label:'Percentage',data:[1,2,3,4,5,6].map(n=>{const s=sems.find(x=>x.sem===n);return s?+r1(s.pct):null})}],{suffix:'%'});
  }};
}

/* =====================================================================
   MODULE 1 – STUDENTS
   ===================================================================== */
function pStudents(){
  const list=sortedStudents();
  const rows=list.map(s=>{
    const cg=cgpaOf(studentSems(s.id)),a=attOf(s.id).pct;
    return `<tr><td>${esc(s.roll)}</td><td><b>${esc(s.name)}</b><br><span class="muted sm">${esc(s.email||'')}</span></td><td>${esc(s.course)}</td><td>${s.semester}</td><td>${a==null?'—':`<span class="chip ${a<75?'bad':'ok'}">${r1(a)}%</span>`}</td><td>${cg==null?'—':r2(cg)}</td>
    <td class="nowrap"><button class="btn sm ghost" onclick="viewStudent('${s.id}')">Progress</button> <button class="btn sm ghost" onclick="studentForm('${s.id}')">Edit</button> <button class="btn sm ghost" onclick="delStudent('${s.id}')" aria-label="Delete ${esc(s.name)}">${ico('trash',15)}</button></td></tr>`;
  }).join('');
  return{title:'Students',html:`
  <div class="pagehead"><div class="field"><label for="sq">Search</label><input id="sq" placeholder="Name, roll no. or course" oninput="filterRows(this.value,'stuTable')"></div><div class="grow"></div><button class="btn" onclick="studentForm()">${ico('plus',16)} Add student</button></div>
  <div class="card">${list.length?`<div class="tablewrap"><table id="stuTable"><thead><tr><th>Roll no.</th><th>Student</th><th>Course</th><th>Sem</th><th>Attendance</th><th>CGPA</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">No students added yet. Use “Add student” to create the first record.</div>'}</div>`};
}
function viewStudent(id){S.sel.sid=id;go('analytics')}
function studentForm(id){
  const s=id?DB.students.find(x=>x.id===id):{};
  openModal(`<h3>${id?'Edit student':'Add student'}</h3>
  <div class="grid2"><div class="field"><label for="f_roll">Roll no. *</label><input id="f_roll" value="${esc(s.roll||'')}"></div>
  <div class="field"><label for="f_sem">Current semester *</label><select id="f_sem">${[1,2,3,4,5,6].map(n=>`<option ${s.semester===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
  <div class="field"><label for="f_name">Student name *</label><input id="f_name" value="${esc(s.name||'')}"></div>
  <div class="field"><label for="f_course">Course *</label><input id="f_course" value="${esc(s.course||'B.Sc. Computer Science')}"></div>
  <div class="grid2"><div class="field"><label for="f_email">Email</label><input id="f_email" type="email" value="${esc(s.email||'')}"></div>
  <div class="field"><label for="f_phone">Phone</label><input id="f_phone" inputmode="tel" value="${esc(s.phone||'')}"></div></div>
  <div class="grid2"><div class="field"><label for="f_year">Academic year</label><input id="f_year" placeholder="2025-26" value="${esc(s.year||'')}"></div>
  <div class="field"><label for="f_pw">${id?'New password':'Password'}</label><input id="f_pw" type="text" placeholder="${id?'Leave blank to keep current':'Blank = roll number'}"></div></div>
  <div id="f_err" class="err" role="alert"></div>
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveStudent('${id||''}')">Save student</button></div>`);
}
async function saveStudent(id){
  const v=k=>$('#f_'+k).value.trim(),err=$('#f_err');
  const roll=v('roll'),name=v('name'),course=v('course');
  if(!roll||!name||!course){err.textContent='Roll no., name and course are required.';return}
  const body={roll,name,course,semester:parseInt($('#f_sem').value),email:v('email'),phone:v('phone'),year:v('year'),password:$('#f_pw').value};
  try{await api(id?'PUT':'POST','/api/students'+(id?'/'+id:''),body);await loadData()}
  catch(e){err.textContent=e.message;return}
  closeModal();toast(id?'Student updated':'Student added','ok');refresh();
}
function delStudent(id){
  const s=DB.students.find(x=>x.id===id);
  confirmBox(`Delete ${s.name}? Their marks, attendance and test attempts will also be removed.`,'Delete student',async()=>{
    if(await mutate(()=>api('DELETE','/api/students/'+id),'Student deleted')){if(S.sel.sid===id)S.sel.sid=null;refresh()}
  });
}

/* =====================================================================
   MODULE 2 – PDF → MCQ  (text extraction + question generator)
   ===================================================================== */
/* ---------- materials & tests page (admin) ---------- */
function pTests(){
  if(S.user.role==='student')return studentTests();
  return S.edit?testEditor():adminTests();
}
function adminTests(){
  const mats=DB.materials.slice().reverse();
  const tests=DB.tests.slice().reverse();
  const html=`
  <div class="card"><h3>Upload study material</h3><p class="muted sm">Upload a PDF. Its text is read in your browser, then used to create MCQ questions.</p>
    <div class="grid2" style="margin-top:12px"><div class="field"><label for="pdfTitle">Title (optional)</label><input id="pdfTitle" placeholder="e.g. Operating Systems – Unit 2"></div>
    <div class="field"><label for="pdfSubj">Subject (optional)</label><input id="pdfSubj"></div></div>
    <div class="field"><label for="pdfFile">PDF file</label><input id="pdfFile" type="file" accept="application/pdf,.pdf"></div>
    <div class="row"><button class="btn" onclick="uploadPDF()">Upload and read PDF</button><button class="btn ghost" onclick="pasteForm()">Paste text instead</button></div>
    <div id="pdfStatus" class="status" aria-live="polite"></div></div>
  <div class="card"><h3>Study material</h3>${mats.length?`<ul class="list">${mats.map(m=>`<li><span><b>${esc(m.title)}</b>${m.subject?` <span class="chip gray">${esc(m.subject)}</span>`:''}<br><span class="muted sm">${m.pages?m.pages+' pages · ':''}${m.words} words · added ${fmtDate(m.createdAt.slice(0,10))}</span></span>
    <span class="row"><button class="btn sm" onclick="genForm('${m.id}')">Generate MCQs</button><button class="btn sm ghost" onclick="previewMat('${m.id}')">Preview</button><button class="btn sm ghost" onclick="delMat('${m.id}')" aria-label="Delete ${esc(m.title)}">${ico('trash',15)}</button></span></li>`).join('')}</ul>`:'<p class="empty small">No study material yet. Upload a PDF above to create questions from it.</p>'}</div>
  <div class="card"><div class="semhead"><h3>Aptitude tests</h3><button class="btn sm" onclick="newTest()">${ico('plus',15)} New blank test</button></div>
    ${tests.length?`<div class="tablewrap"><table><thead><tr><th>Test</th><th>Questions</th><th>Time</th><th>Attempts</th><th>Status</th><th></th></tr></thead><tbody>${tests.map(t=>{
      const src=DB.materials.find(m=>m.id===t.materialId);
      return `<tr><td><b>${esc(t.title)}</b><br><span class="muted sm">${src?'From: '+esc(src.title):'Manual questions'}</span></td><td>${t.questions.length}</td><td>${t.duration} min</td><td>${DB.attempts.filter(a=>a.testId===t.id).length}</td>
      <td><span class="chip ${t.published?'ok':'gray'}">${t.published?'Published':'Draft'}</span></td>
      <td class="nowrap"><button class="btn sm ghost" onclick="editTest('${t.id}')">Edit</button> <button class="btn sm ghost" onclick="togglePub('${t.id}')">${t.published?'Unpublish':'Publish'}</button> <button class="btn sm ghost" onclick="testResults('${t.id}')">Results</button> <button class="btn sm ghost" onclick="delTest('${t.id}')" aria-label="Delete test">${ico('trash',15)}</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty small">No tests yet. Generate one from study material or create a blank test.</p>'}</div>`;
  return{title:'PDF & Tests',html};
}
function setStatus(msg,kind){const el=$('#pdfStatus');if(el){el.textContent=msg;el.className='status '+(kind||'')}}
async function uploadPDF(){
  const f=$('#pdfFile').files[0];
  if(!f){setStatus('Choose a PDF file first.','bad');return}
  if(!/\.pdf$/i.test(f.name)&&f.type!=='application/pdf'){setStatus('This file is not a PDF.','bad');return}
  if(f.size>25*1024*1024){setStatus('The file is larger than 25 MB. Split it and try again.','bad');return}
  setStatus('Uploading and reading the PDF…');
  const fd=new FormData();fd.append('file',f);fd.append('title',$('#pdfTitle').value.trim());fd.append('subject',$('#pdfSubj').value.trim());
  try{await api('POST','/api/materials',fd);await loadData()}
  catch(e){setStatus(e.message,'bad');return}
  toast('Study material saved','ok');refresh();
}
function pasteForm(){
  openModal(`<h3>Paste study text</h3><div class="field"><label for="pt_title">Title *</label><input id="pt_title"></div><div class="field"><label for="pt_subj">Subject</label><input id="pt_subj"></div>
  <div class="field"><label for="pt_text">Text *</label><textarea id="pt_text" rows="8" placeholder="Paste notes or chapter text here (at least a few paragraphs)"></textarea></div><div id="pt_err" class="err" role="alert"></div>
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="savePaste()">Save material</button></div>`,true);
}
async function savePaste(){
  const title=$('#pt_title').value.trim(),text=$('#pt_text').value;
  if(!title||text.replace(/\s/g,'').length<200){$('#pt_err').textContent='Add a title and at least a few paragraphs of text.';return}
  try{await api('POST','/api/materials',{title,subject:$('#pt_subj').value.trim(),text});await loadData()}
  catch(e){$('#pt_err').textContent=e.message;return}
  closeModal();toast('Study material saved','ok');refresh();
}
function previewMat(id){const m=DB.materials.find(x=>x.id===id);openModal(`<h3>${esc(m.title)}</h3><p class="muted sm">First part of the extracted text</p><div class="pre mt">${esc(m.preview)}${m.preview.length>=2500?'…':''}</div><div class="actions"><button class="btn" onclick="closeModal()">Close</button></div>`,true)}
function delMat(id){confirmBox('Delete this study material? Tests already created from it are kept.','Delete material',async()=>{if(await mutate(()=>api('DELETE','/api/materials/'+id),'Material deleted'))refresh()})}
function genForm(id){
  const m=DB.materials.find(x=>x.id===id);
  openModal(`<h3>Generate MCQs</h3><p class="muted sm">${esc(m.title)}</p>
  <div class="field mt"><label for="g_title">Test title</label><input id="g_title" value="${esc(m.title)} – Aptitude Test"></div>
  <div class="grid2"><div class="field"><label for="g_n">Number of questions</label><input id="g_n" type="number" min="3" max="40" value="10"></div>
  <div class="field"><label for="g_dur">Time limit (minutes)</label><input id="g_dur" type="number" min="1" max="180" value="15"></div></div>
  <div id="g_err" class="err" role="alert"></div>
  <div class="actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="doGenerate('${id}')">Generate</button></div>`);
}
async function doGenerate(id){
  const m=DB.materials.find(x=>x.id===id),n=clamp(parseInt($('#g_n').value)||10,3,40),dur=clamp(parseInt($('#g_dur').value)||15,1,180);
  let qs;
  try{qs=(await api('POST','/api/materials/'+id+'/generate',{n})).questions}
  catch(e){$('#g_err').textContent=e.message;return}
  S.edit={isNew:true,id:null,title:$('#g_title').value.trim()||m.title,duration:dur,materialId:m.id,published:false,questions:qs,note:qs.length<n?`Only ${qs.length} of ${n} questions could be created from this text. You can add more by hand.`:''};
  closeModal();refresh();window.scrollTo(0,0);
}
const blankQ=()=>({q:'',options:['','','',''],answer:0});
function newTest(){S.edit={isNew:true,id:null,title:'',duration:15,materialId:null,published:false,questions:[blankQ()],note:''};refresh();window.scrollTo(0,0)}
function editTest(id){const t=DB.tests.find(x=>x.id===id);S.edit=JSON.parse(JSON.stringify(t));S.edit.isNew=false;S.edit.note='';refresh();window.scrollTo(0,0)}
async function togglePub(id){const t=DB.tests.find(x=>x.id===id);if(await mutate(()=>api('POST','/api/tests/'+id+'/publish',{published:!t.published}),t.published?'Test unpublished':'Test published'))refresh()}
function delTest(id){confirmBox('Delete this test and all its attempts?','Delete test',async()=>{if(await mutate(()=>api('DELETE','/api/tests/'+id),'Test deleted'))refresh()})}
function testResults(id){
  const t=DB.tests.find(x=>x.id===id),at=DB.attempts.filter(a=>a.testId===id).sort((a,b)=>b.date.localeCompare(a.date));
  openModal(`<h3>${esc(t.title)}</h3><p class="muted sm">${at.length} attempt${at.length===1?'':'s'}</p>${at.length?`<div class="tablewrap"><table><thead><tr><th>Student</th><th>Score</th><th>%</th><th>Date</th></tr></thead><tbody>${at.map(a=>{const s=DB.students.find(x=>x.id===a.studentId);return `<tr><td>${esc(s?s.name:'Removed student')}</td><td>${a.score}/${a.total}</td><td>${r1(a.score/a.total*100)}%</td><td>${fmtDT(a.date)}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty small">Nobody has attempted this test yet.</p>'}<div class="actions"><button class="btn" onclick="closeModal()">Close</button></div>`,true);
}
function testEditor(){
  const e=S.edit;
  const html=`
  ${e.note?`<div class="card"><span class="chip warn">${esc(e.note)}</span></div>`:''}
  <div class="card"><h3>${e.isNew?'Review and create test':'Edit test'}</h3><p class="muted sm">Check each question. Choose the correct answer with the round button next to it. Generated questions may need small corrections.</p>
    <div class="grid2 mt"><div class="field"><label for="et_t">Test title</label><input id="et_t" value="${esc(e.title)}" oninput="S.edit.title=this.value"></div>
    <div class="field"><label for="et_d">Time limit (minutes)</label><input id="et_d" type="number" min="1" value="${e.duration}" oninput="S.edit.duration=parseInt(this.value)||1"></div></div>
    <label class="check"><input type="checkbox" ${e.published?'checked':''} onchange="S.edit.published=this.checked"> Publish so students can attempt this test</label></div>
  ${e.questions.map((q,i)=>`<div class="qcard"><div class="qhead"><b>Question ${i+1}</b><button class="icon-btn" onclick="delQ(${i})" aria-label="Delete question ${i+1}">${ico('trash',16)}</button></div>
    <textarea rows="3" aria-label="Question ${i+1} text" oninput="S.edit.questions[${i}].q=this.value">${esc(q.q)}</textarea>
    ${q.options.map((o,j)=>`<div class="opt"><input type="radio" name="ans${i}" ${q.answer===j?'checked':''} onchange="S.edit.questions[${i}].answer=${j}" aria-label="Option ${'ABCD'[j]} is correct"><input value="${esc(o)}" placeholder="Option ${'ABCD'[j]}" aria-label="Option ${'ABCD'[j]}" oninput="S.edit.questions[${i}].options[${j}]=this.value"></div>`).join('')}</div>`).join('')}
  <div class="actionbar"><button class="btn ghost" onclick="addQ()">${ico('plus',16)} Add question</button><div class="grow"></div><button class="btn ghost" onclick="cancelEdit()">Cancel</button><button class="btn" onclick="saveTest()">Save test</button></div>`;
  return{title:e.isNew?'New test':'Edit test',html};
}
function addQ(){S.edit.questions.push(blankQ());refresh();window.scrollTo(0,document.body.scrollHeight)}
function delQ(i){S.edit.questions.splice(i,1);refresh()}
function cancelEdit(){S.edit=null;refresh();window.scrollTo(0,0)}
async function saveTest(){
  const e=S.edit;
  if(!e.title.trim()){toast('Give the test a title','bad');return}
  if(!e.questions.length){toast('Add at least one question','bad');return}
  for(let i=0;i<e.questions.length;i++){
    const q=e.questions[i];
    if(!q.q.trim()){toast(`Question ${i+1} has no text`,'bad');return}
    if(q.options.some(o=>!o.trim())){toast(`Question ${i+1} needs all four options`,'bad');return}
    if(new Set(q.options.map(o=>o.trim().toLowerCase())).size<4){toast(`Question ${i+1} has repeated options`,'bad');return}
  }
  const body={title:e.title.trim(),duration:e.duration||15,materialId:e.materialId,published:!!e.published,
    questions:e.questions.map(q=>({q:q.q.trim(),options:q.options.map(o=>o.trim()),answer:q.answer}))};
  if(await mutate(()=>api(e.isNew?'POST':'PUT',e.isNew?'/api/tests':'/api/tests/'+e.id,body),'Test saved')){S.edit=null;refresh();window.scrollTo(0,0)}
}

/* =====================================================================
   MODULE 3 – ONLINE APTITUDE TEST (student)
   ===================================================================== */
function studentTests(){
  if(S.exam)return examView();
  if(S.result)return resultView();
  const me=curStudent(),avail=DB.tests.filter(t=>t.published),tries=attemptsOf(me.id).slice().reverse();
  const html=`
  <div class="card"><h3>Available tests</h3>${avail.length?`<ul class="list">${avail.map(t=>{
    const mine=tries.filter(a=>a.testId===t.id),best=mine.length?Math.max(...mine.map(a=>a.score)):null;
    return `<li><span><b>${esc(t.title)}</b><br><span class="muted sm">${t.questions.length} questions · ${t.duration} minutes${best!=null?` · best score ${best}/${t.questions.length}`:''}</span></span><button class="btn" onclick="startExam('${t.id}')">${mine.length?'Try again':'Start test'}</button></li>`}).join('')}</ul>`:'<p class="empty small">No tests are published yet. Check back later.</p>'}</div>
  <div class="card"><h3>My attempts</h3>${tries.length?`<div class="tablewrap"><table><thead><tr><th>Test</th><th>Score</th><th>%</th><th>Date</th><th></th></tr></thead><tbody>${tries.map(a=>`<tr><td>${esc(a.title)}</td><td>${a.score}/${a.total}</td><td>${r1(a.score/a.total*100)}%</td><td>${fmtDT(a.date)}</td><td><button class="btn sm ghost" onclick="reviewAttempt('${a.id}')">Review</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty small">You have not attempted any test yet.</p>'}</div>`;
  return{title:'Aptitude tests',html};
}
async function startExam(tid){
  const t=DB.tests.find(x=>x.id===tid);if(!t||!t.published||!t.questions.length){toast('This test is not available','bad');return}
  try{await api('POST','/api/tests/'+tid+'/start')}catch(e){toast(e.message,'bad');return}
  S.route='tests';S.result=null;
  S.exam={tid,order:shuffle(t.questions.map((_,i)=>i)),answers:t.questions.map(()=>-1),idx:0,end:Date.now()+t.duration*60000,start:Date.now()};
  clearInterval(S.timer);S.timer=setInterval(tick,1000);
  toggleSide(false);render();
}
function tick(){
  if(!S.exam){clearInterval(S.timer);return}
  const left=Math.max(0,Math.round((S.exam.end-Date.now())/1000)),el=$('#timer');
  if(el){el.textContent=pad(Math.floor(left/60))+':'+pad(left%60);el.classList.toggle('low',left<=60)}
  if(left<=0)submitExam(true);
}
function endExam(){clearInterval(S.timer);S.exam=null}
function examView(){
  const x=S.exam,t=DB.tests.find(q=>q.id===x.tid),n=t.questions.length,q=t.questions[x.order[x.idx]];
  const left=Math.max(0,Math.round((x.end-Date.now())/1000)),done=x.answers.filter(a=>a>=0).length;
  const html=`<div class="exam">
    <div class="card examtop"><div><b>${esc(t.title)}</b><div class="muted sm">Question ${x.idx+1} of ${n} · ${done} answered</div></div><div class="timer ${left<=60?'low':''}" id="timer" aria-label="Time left">${pad(Math.floor(left/60))}:${pad(left%60)}</div></div>
    <div class="bar" style="margin-bottom:14px"><i style="width:${done/n*100}%"></i></div>
    <div class="card"><p class="qtext">${esc(q.q)}</p>
      ${q.options.map((o,j)=>`<button class="choice ${x.answers[x.idx]===j?'on':''}" onclick="pick(${j})"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="navrow"><button class="btn ghost" onclick="examGo(${x.idx-1})" ${x.idx===0?'disabled':''}>Previous</button>
      ${x.idx<n-1?`<button class="btn" onclick="examGo(${x.idx+1})">Next</button>`:`<button class="btn" onclick="submitExam(false)">Submit test</button>`}</div>
    <div class="qnav" aria-label="Question navigator">${x.order.map((_,i)=>`<button class="${i===x.idx?'cur':x.answers[i]>=0?'done':''}" onclick="examGo(${i})" aria-label="Go to question ${i+1}">${i+1}</button>`).join('')}</div>
    <div class="row mt2"><button class="btn ghost sm" onclick="submitExam(false)">Submit now</button></div></div>`;
  return{title:'Aptitude test',html};
}
function pick(j){S.exam.answers[S.exam.idx]=j;refresh()}
function examGo(i){const n=S.exam.answers.length;if(i<0||i>=n)return;S.exam.idx=i;refresh();window.scrollTo(0,0)}
async function submitExam(auto){
  if(!S.exam||S.exam.sending)return;
  const un=S.exam.answers.filter(a=>a<0).length;
  if(!auto&&un>0){confirmBox(`You have ${un} unanswered question${un>1?'s':''}. Submit anyway?`,'Submit test',()=>submitExam(true));return}
  const x=S.exam,t=DB.tests.find(q=>q.id===x.tid);
  const picks=new Array(t.questions.length).fill(-1);x.order.forEach((qi,p)=>{picks[qi]=x.answers[p]});
  x.sending=true;
  let att;
  try{att=(await api('POST','/api/tests/'+t.id+'/submit',{answers:picks})).attempt}
  catch(e){x.sending=false;toast(e.message,'bad');return}
  const timedOut=Date.now()>=x.end;
  endExam();S.result=att;
  try{await loadData()}catch(e){}
  if(auto&&timedOut)toast('Time is up. Your test was submitted.');
  refresh();window.scrollTo(0,0);
}
function reviewAttempt(id){S.result=DB.attempts.find(a=>a.id===id);refresh();window.scrollTo(0,0)}
function resultView(){
  const a=S.result,p=a.score/a.total*100,skipped=a.snap.filter(s=>s.pick<0).length;
  const html=`<div class="card"><div class="row" style="justify-content:space-between"><div><p class="muted sm">${esc(a.title)} · ${fmtDT(a.date)}</p><div class="scorebig">${a.score}<span class="muted" style="font-size:26px">/${a.total}</span></div>
    <p class="mt"><span class="chip ${p>=75?'ok':p>=50?'warn':'bad'}">${r1(p)}% · ${p>=75?'Excellent':p>=50?'Good, keep practising':'Needs more practice'}</span></p></div>
    <div class="sumbox" style="margin:0;min-width:240px"><div><b>${a.score}</b><span>Correct</span></div><div><b>${a.total-a.score-skipped}</b><span>Wrong</span></div><div><b>${skipped}</b><span>Skipped</span></div><div><b>${pad(Math.floor(a.secs/60))}:${pad(a.secs%60)}</b><span>Time taken</span></div></div></div>
    <div class="row mt2"><button class="btn" onclick="S.result=null;refresh()">Back to tests</button></div></div>
    ${a.snap.map((s,i)=>`<div class="qcard"><b>${i+1}. ${esc(s.q)}</b><div class="mt">${s.options.map((o,j)=>`<div class="choice static ${j===s.answer?'good':j===s.pick?'wrong':''}"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}${j===s.answer?' <b>(correct)</b>':''}${j===s.pick&&j!==s.answer?' <b>(your answer)</b>':''}</span></div>`).join('')}</div>${s.pick<0?'<p class="muted sm">You skipped this question.</p>':''}</div>`).join('')}`;
  return{title:'Test result',html};
}

/* =====================================================================
   MODULE 4 – ATTENDANCE
   ===================================================================== */
function getSession(sem,date,subject){
  return DB.attendance.find(x=>x.sem===sem&&x.date===date&&(x.subject||'').toLowerCase()===(subject||'').toLowerCase());
}
function attInit(){
  if(!S.ui.att){
    const counts={};DB.students.forEach(s=>{counts[s.semester]=(counts[s.semester]||0)+1});
    const sem=parseInt(Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0])||6;
    S.ui.att={sem,date:todayISO(),subject:'',marks:{}};attLoad();
  }
}
function attLoad(){
  const a=S.ui.att,list=DB.students.filter(s=>s.semester===a.sem),ex=getSession(a.sem,a.date,a.subject,false);
  a.marks={};list.forEach(s=>{a.marks[s.id]=ex&&ex.records[s.id]?ex.records[s.id]:'P'});a.existing=!!ex;
}
function attSet(k,v){S.ui.att[k]=v;if(k!=='subject')attLoad();refresh()}
function attSubj(v){S.ui.att.subject=v}
function attMark(sid,v){S.ui.att.marks[sid]=v;refresh()}
function attAll(v){Object.keys(S.ui.att.marks).forEach(k=>S.ui.att.marks[k]=v);refresh()}
async function saveAtt(){
  const a=S.ui.att,ids=Object.keys(a.marks);
  if(!ids.length){toast('No students in this semester','bad');return}
  if(!a.date){toast('Choose a date','bad');return}
  if(await mutate(()=>api('POST','/api/attendance',{sem:a.sem,date:a.date,subject:a.subject.trim(),records:a.marks}),'Attendance saved')){attLoad();refresh()}
}
function delSession(id){confirmBox('Delete this attendance session?','Delete',async()=>{if(await mutate(()=>api('DELETE','/api/attendance/'+id))){attLoad();refresh()}})}
function adminAtt(){
  attInit();const a=S.ui.att;
  const list=sortedStudents().filter(s=>s.semester===a.sem);
  const present=list.filter(s=>a.marks[s.id]==='P').length;
  const sum=list.map(s=>({s,...attOf(s.id,a.sem)}));
  const sessions=DB.attendance.filter(s=>s.sem===a.sem).sort((x,y)=>y.date.localeCompare(x.date));
  const html=`
  <div class="card"><h3>Mark attendance</h3>
    <div class="grid2 mt"><div class="field"><label for="a_sem">Semester</label><select id="a_sem" onchange="attSet('sem',parseInt(this.value))">${[1,2,3,4,5,6].map(n=>`<option ${a.sem===n?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label for="a_date">Date</label><input id="a_date" type="date" value="${a.date}" onchange="attSet('date',this.value)"></div></div>
    <div class="field"><label for="a_sub">Subject or lecture (optional)</label><input id="a_sub" value="${esc(a.subject)}" placeholder="e.g. Cloud Computing" oninput="attSubj(this.value)" onchange="attSet('subject',this.value)"></div>
    ${a.existing?'<p><span class="chip warn">Attendance for this date is already saved. Saving will update it.</span></p>':''}
    ${list.length?`<div class="row mt"><button class="btn sm ghost" onclick="attAll('P')">Mark all present</button><button class="btn sm ghost" onclick="attAll('A')">Mark all absent</button><span class="muted sm">${present} present · ${list.length-present} absent</span></div>
    <div class="mt">${list.map(s=>`<div class="arow"><span><b>${esc(s.name)}</b> <span class="muted sm">Roll ${esc(s.roll)}</span></span><div class="seg"><button class="${a.marks[s.id]==='P'?'on ok':''}" onclick="attMark('${s.id}','P')" aria-label="Present">P</button><button class="${a.marks[s.id]==='A'?'on bad':''}" onclick="attMark('${s.id}','A')" aria-label="Absent">A</button></div></div>`).join('')}</div>
    <div class="row mt2"><button class="btn" onclick="saveAtt()">Save attendance</button></div>`:`<p class="empty small">No students are in Semester ${a.sem}. Change a student’s current semester in Students, or pick another semester.</p>`}</div>
  ${list.length?`<div class="cols"><div class="card"><h3>Attendance summary · Semester ${a.sem}</h3><div class="tablewrap"><table><thead><tr><th>Student</th><th>Present</th><th>Sessions</th><th>Attendance</th></tr></thead><tbody>${sum.map(x=>`<tr><td>${esc(x.s.name)}</td><td>${x.present}</td><td>${x.total}</td><td>${x.pct==null?'—':`<div class="row" style="flex-wrap:nowrap"><div class="bar ${x.pct<75?'low':''}" style="width:80px"><i style="width:${x.pct}%"></i></div><b>${r1(x.pct)}%</b></div>`}</td></tr>`).join('')}</tbody></table></div></div>
    ${chartCard('Attendance by student','Semester '+a.sem,'cAt',Math.max(220,list.length*34+40))}</div>`:''}
  ${sessions.length?`<div class="card mt2"><h3>Saved sessions · Semester ${a.sem}</h3><ul class="list">${sessions.slice(0,15).map(s=>{const v=Object.values(s.records),p=v.filter(x=>x==='P').length;return `<li><span><b>${fmtDate(s.date)}</b>${s.subject?' · '+esc(s.subject):''}</span><span class="row"><span class="chip ${p/v.length<.75?'warn':'ok'}">${p}/${v.length} present</span><button class="icon-btn" style="width:32px;height:32px" onclick="delSession('${s.id}')" aria-label="Delete session">${ico('trash',15)}</button></span></li>`}).join('')}</ul></div>`:''}`;
  return{title:'Attendance',html,mount(){
    const l=sum.filter(x=>x.pct!=null);
    if(l.length)barChart('cAt',l.map(x=>x.s.name),l.map(x=>+r1(x.pct)),{horizontal:true,suffix:'%',label:'Attendance',color:cssv('--c2')});
    else{const c=document.getElementById('cAt');if(c)c.parentElement.innerHTML='<div class="empty small">Save attendance to see the graph.</div>'}
  }};
}
function studentAtt(){
  const me=curStudent(),all=attOf(me.id);
  const semP=[1,2,3,4,5,6].map(n=>attOf(me.id,n).pct);
  const rec=DB.attendance.filter(s=>s.records[me.id]).sort((a,b)=>b.date.localeCompare(a.date));
  const html=`
  <div class="stats"><div class="stat"><div class="k">Overall attendance</div><div class="v">${pctTxt(all.pct)}</div></div>
    <div class="stat"><div class="k">Present</div><div class="v">${all.present}</div></div>
    <div class="stat"><div class="k">Absent</div><div class="v">${all.total-all.present}</div></div>
    <div class="stat"><div class="k">Sessions</div><div class="v">${all.total}</div></div></div>
  ${all.pct!=null&&all.pct<75?'<div class="failbox" style="margin-top:0;margin-bottom:16px"><h4>Attendance is below 75%</h4><p class="sm">Try not to miss more sessions.</p></div>':''}
  <div class="cols">${chartCard('Present and absent','All sessions','cD',240)}${chartCard('Attendance by semester','Percentage per semester','cS',240)}</div>
  <div class="card mt2"><h3>Recent sessions</h3>${rec.length?`<ul class="list">${rec.slice(0,30).map(s=>`<li><span><b>${fmtDate(s.date)}</b>${s.subject?' · '+esc(s.subject):''} <span class="muted sm">Sem ${s.sem}</span></span><span class="chip ${s.records[me.id]==='P'?'ok':'bad'}">${s.records[me.id]==='P'?'Present':'Absent'}</span></li>`).join('')}</ul>`:'<p class="empty small">No attendance has been recorded yet.</p>'}</div>`;
  return{title:'My attendance',html,mount(){
    if(all.total)drawChart('cD','doughnut',{labels:['Present','Absent'],datasets:[{data:[all.present,all.total-all.present],backgroundColor:[cssv('--ok'),cssv('--bad')],borderWidth:0}]},{cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true}}}});
    else{const c=document.getElementById('cD');if(c)c.parentElement.innerHTML='<div class="empty small">No data yet.</div>'}
    barChart('cS',['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6'],semP.map(v=>v==null?null:+r1(v)),{suffix:'%',color:cssv('--c1'),label:'Attendance'});
  }};
}

/* =====================================================================
   MODULE 5 – SEMESTER MARKS ENTRY
   ===================================================================== */
function mkLoad(){
  const m=S.ui.mk,rec=DB.marks.find(r=>r.studentId===m.sid&&r.sem===m.sem);
  m.rows=rec?rec.subjects.map(x=>({name:x.name,th:String(x.th),int:String(x.int)})):[0,1,2,3,4,5].map(()=>({name:'',th:'',int:''}));
}
function pMarks(){
  const st=curStudent();
  if(!st)return{title:'Semester marks',html:noStudents()};
  if(!S.ui.mk||S.ui.mk.sid!==st.id){S.ui.mk={sid:st.id,sem:st.semester||1};mkLoad()}
  const m=S.ui.mk,Sx=sc();
  const has=n=>DB.marks.some(r=>r.studentId===st.id&&r.sem===n&&r.subjects.length);
  const html=`
  <div class="pagehead">${studentPicker()}</div>
  <div class="card"><h3>${esc(st.name)} · Semester marks</h3><p class="muted sm">Each subject has theory (TH, out of ${Sx.thMax}, minimum ${Sx.thMin}) and internal (INT, out of ${Sx.intMax}, minimum ${Sx.intMin}) marks.</p>
    <div class="semchips" role="tablist" aria-label="Semester">${[1,2,3,4,5,6].map(n=>`<button class="semchip ${m.sem===n?'on':''} ${has(n)?'has':''}" onclick="mkSem(${n})">Sem ${n}<i title="Marks saved"></i></button>`).join('')}</div>
    <div class="mhead"><span>Subject</span><span>TH /${Sx.thMax}</span><span>INT /${Sx.intMax}</span><span>Total</span><span>Status</span><span></span></div>
    <div id="mkRows">${m.rows.map((r,i)=>mkRow(r,i)).join('')}</div>
    <div class="row mt"><button class="btn sm ghost" onclick="mkAdd()">${ico('plus',15)} Add subject</button>
      <span class="row" style="gap:6px"><label class="sm muted" for="mkCount">Rows</label><input id="mkCount" type="number" min="1" max="30" value="${m.rows.length}" style="width:70px;min-height:32px;padding:4px 8px"><button class="btn sm ghost" onclick="mkSetCount()">Set</button></span></div>
    <div class="sumbox" id="mkSum"></div><div id="mkFail"></div>
    <div class="row mt2"><button class="btn" onclick="mkSave()">Save Semester ${m.sem} marks</button>${has(m.sem)?'<button class="btn ghost" onclick="mkClear()">Delete this semester</button>':''}</div></div>`;
  return{title:'Semester marks',html,mount:mkCalc};
}
function mkRow(r,i){
  const Sx=sc();
  return `<div class="mrow" id="mr${i}"><input class="m-name" placeholder="Subject name" aria-label="Subject ${i+1} name" value="${esc(r.name)}" oninput="mkEdit(${i},'name',this.value)">
  <input class="m-th" type="number" inputmode="decimal" min="0" max="${Sx.thMax}" placeholder="TH" aria-label="TH marks" value="${esc(r.th)}" oninput="mkEdit(${i},'th',this.value)">
  <input class="m-int" type="number" inputmode="decimal" min="0" max="${Sx.intMax}" placeholder="INT" aria-label="Internal marks" value="${esc(r.int)}" oninput="mkEdit(${i},'int',this.value)">
  <div class="m-tot" id="mkT${i}">—</div><div class="m-st" id="mkS${i}">—</div>
  <button class="icon-btn m-del" onclick="mkDel(${i})" aria-label="Remove subject ${i+1}" style="width:34px;height:34px">${ico('x',15)}</button></div>`;
}
function mkSem(n){S.ui.mk.sem=n;mkLoad();refresh()}
function mkAdd(){S.ui.mk.rows.push({name:'',th:'',int:''});refresh()}
function mkDel(i){S.ui.mk.rows.splice(i,1);refresh()}
function mkSetCount(){
  const n=clamp(parseInt($('#mkCount').value)||1,1,30),rows=S.ui.mk.rows;
  while(rows.length<n)rows.push({name:'',th:'',int:''});
  rows.length=n;refresh();
}
function mkEdit(i,k,v){S.ui.mk.rows[i][k]=v;mkCalc()}
function mkCalc(){
  const rows=S.ui.mk.rows,Sx=sc(),subs=[];
  rows.forEach((r,i)=>{
    const t=document.getElementById('mkT'+i),s=document.getElementById('mkS'+i);if(!t)return;
    const thIn=document.querySelector('#mr'+i+' .m-th'),inIn=document.querySelector('#mr'+i+' .m-int');
    const badTh=r.th!==''&&(num(r.th)<0||num(r.th)>Sx.thMax),badIn=r.int!==''&&(num(r.int)<0||num(r.int)>Sx.intMax);
    thIn.classList.toggle('badv',badTh);inIn.classList.toggle('badv',badIn);
    if(r.th===''||r.int===''||badTh||badIn){t.textContent='—';s.innerHTML='—';return}
    const c=calcSubject(r);subs.push(c);
    t.textContent=c.total+'/'+c.max;
    s.innerHTML=c.pass?'<span class="chip ok">Pass</span>':'<span class="chip bad">Fail</span>';
  });
  const total=subs.reduce((a,s)=>a+s.total,0),max=subs.reduce((a,s)=>a+s.max,0),gp=subs.reduce((a,s)=>a+s.gp,0),failed=subs.filter(s=>!s.pass);
  $('#mkSum').innerHTML=`<div><b>${total}/${max}</b><span>Total marks</span></div><div><b>${max?r1(total/max*100)+'%':'—'}</b><span>Percentage</span></div><div><b>${subs.length?r2(gp/subs.length):'—'}</b><span>SGPA (this semester)</span></div><div><b>${subs.length?(failed.length?'FAIL':'PASS'):'—'}</b><span>Result</span></div>`;
  $('#mkFail').innerHTML=subs.length?(failed.length?`<div class="failbox"><h4>Failed subjects (${failed.length})</h4><ul>${failed.map(f=>`<li>${esc(f.name||'Unnamed subject')} – ${failReason(f)}</li>`).join('')}</ul></div>`:'<div class="passbox">All subjects are passed.</div>'):'';
}
function failReason(f){
  const Sx=sc(),r=[];
  if(!f.thOk)r.push(`TH ${f.th}/${Sx.thMax} (minimum ${Sx.thMin})`);
  if(!f.intOk)r.push(`INT ${f.int}/${Sx.intMax} (minimum ${Sx.intMin})`);
  return r.join(', ');
}
async function mkSave(){
  const m=S.ui.mk,Sx=sc(),subjects=[];
  for(let i=0;i<m.rows.length;i++){
    const r=m.rows[i];
    if(!r.name.trim()&&r.th===''&&r.int==='')continue;
    if(!r.name.trim()){toast(`Row ${i+1}: enter the subject name`,'bad');return}
    if(r.th===''||r.int===''){toast(`${r.name}: enter both TH and INT marks`,'bad');return}
    if(num(r.th)<0||num(r.th)>Sx.thMax||num(r.int)<0||num(r.int)>Sx.intMax){toast(`${r.name}: marks are outside the allowed range`,'bad');return}
    subjects.push({name:r.name.trim(),th:num(r.th),int:num(r.int)});
  }
  if(!subjects.length){toast('Enter marks for at least one subject','bad');return}
  if(await mutate(()=>api('POST','/api/marks',{studentId:m.sid,sem:m.sem,subjects}),`Semester ${m.sem} marks saved`)){mkLoad();refresh()}
}
function mkClear(){
  const m=S.ui.mk;
  confirmBox(`Delete all Semester ${m.sem} marks for this student?`,'Delete marks',async()=>{
    if(await mutate(()=>api('DELETE',`/api/marks/${m.sid}/${m.sem}`),'Marks deleted')){mkLoad();refresh()}
  });
}

/* =====================================================================
   MODULE 6 – RESULTS & CGPA
   ===================================================================== */
function marksheet(sid){
  const sems=studentSems(sid);
  if(!sems.length)return '<div class="card empty">No semester marks have been entered yet.</div>';
  const Sx=sc(),cg=cgpaOf(sems),op=overallPct(sems),fails=sems.reduce((a,s)=>a+s.failed.length,0);
  return `<div class="stats"><div class="stat"><div class="k">CGPA</div><div class="v">${r2(cg)}</div><div class="s">out of 10</div></div>
    <div class="stat"><div class="k">Overall percentage</div><div class="v">${r1(op)}%</div></div>
    <div class="stat"><div class="k">Semesters recorded</div><div class="v">${sems.length}</div><div class="s">of 6</div></div>
    <div class="stat"><div class="k">Failed subjects</div><div class="v">${fails}</div></div></div>`+
  sems.map(s=>`<div class="card"><div class="semhead"><h3>Semester ${s.sem}</h3><span class="chip ${s.pass?'ok':'bad'}">${s.pass?'PASS':'FAIL'}</span></div>
    <p class="muted sm">Total <b>${s.total}/${s.max}</b> · Percentage <b>${r1(s.pct)}%</b> · SGPA <b>${r2(s.sgpa)}</b></p>
    <div class="tablewrap"><table><thead><tr><th>Subject</th><th>TH /${Sx.thMax}</th><th>INT /${Sx.intMax}</th><th>Total</th><th>Grade</th><th>Status</th></tr></thead><tbody>${s.subs.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.th}</td><td>${x.int}</td><td>${x.total}/${x.max}</td><td>${x.grade}</td><td><span class="chip ${x.pass?'ok':'bad'}">${x.pass?'Pass':'Fail'}</span></td></tr>`).join('')}</tbody></table></div>
    ${s.failed.length?`<div class="failbox"><h4>Failed subjects (${s.failed.length})</h4><ul>${s.failed.map(f=>`<li>${esc(f.name)} – ${failReason(f)}</li>`).join('')}</ul></div>`:'<div class="passbox">All subjects passed in this semester.</div>'}</div>`).join('')+
  `<p class="muted sm">Grade points: 80%+ = 10 (O), 70% = 9 (A), 60% = 8 (B), 55% = 7 (C), 50% = 6 (D), 45% = 5 (E), 40% = 4 (P). A failed subject scores 0. SGPA is the average grade point of the subjects in a semester; CGPA is the average over all recorded semesters.</p>`;
}
function overallPct(sems){const m=sems.reduce((a,s)=>a+s.max,0);return m?sems.reduce((a,s)=>a+s.total,0)/m*100:0}
function pResults(){
  if(S.user.role==='student'){const me=curStudent();return{title:'My results',html:marksheet(me.id)}}
  const st=curStudent();
  if(!st)return{title:'Results & CGPA',html:noStudents()};
  const tab=S.ui.resTab||'student';
  let body;
  if(tab==='student')body=`<div class="pagehead">${studentPicker()}</div>`+marksheet(st.id);
  else{
    const sem=S.ui.clsSem||6;
    const rows=sortedStudents().map(s=>{const r=DB.marks.find(m=>m.studentId===s.id&&m.sem===sem&&m.subjects.length);return r?{s,c:calcSem(r)}:null}).filter(Boolean);
    const pass=rows.filter(x=>x.c.pass).length;
    body=`<div class="pagehead"><div class="field"><label for="cs">Semester</label><select id="cs" onchange="S.ui.clsSem=parseInt(this.value);refresh()">${[1,2,3,4,5,6].map(n=>`<option ${sem===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
    <div class="card"><h3>Class result · Semester ${sem}</h3>${rows.length?`<p class="muted sm">${pass} of ${rows.length} students passed (${r1(pass/rows.length*100)}%)</p><div class="tablewrap"><table><thead><tr><th>Roll no.</th><th>Student</th><th>Total</th><th>%</th><th>SGPA</th><th>Failed</th><th>Result</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.s.roll)}</td><td>${esc(x.s.name)}</td><td>${x.c.total}/${x.c.max}</td><td>${r1(x.c.pct)}%</td><td>${r2(x.c.sgpa)}</td><td>${x.c.failed.length?x.c.failed.map(f=>esc(f.name)).join(', '):'—'}</td><td><span class="chip ${x.c.pass?'ok':'bad'}">${x.c.pass?'PASS':'FAIL'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty small">No marks entered for this semester yet.</p>'}</div>`;
  }
  return{title:'Results & CGPA',html:`<div class="tabs"><button class="${tab==='student'?'on':''}" onclick="S.ui.resTab='student';refresh()">Student marksheet</button><button class="${tab==='class'?'on':''}" onclick="S.ui.resTab='class';refresh()">Class result</button></div>${body}`};
}

/* =====================================================================
   MODULE 7 – PERFORMANCE ANALYTICS
   ===================================================================== */
function pAnalytics(){
  const st=curStudent();
  if(!st)return{title:'Analytics',html:noStudents()};
  const sems=studentSems(st.id),by=n=>sems.find(s=>s.sem===n);
  const six=[1,2,3,4,5,6],labels=six.map(n=>'Sem '+n);
  const pct=six.map(n=>by(n)?+r1(by(n).pct):null);
  const sg=six.map(n=>by(n)?+r2(by(n).sgpa):null);
  let gp=0,nn=0;const cum=six.map(n=>{const x=by(n);if(!x)return null;gp+=x.gp;nn+=x.n;return nn?+r2(gp/nn):null});
  const cls=DB.classAvg||six.map(()=>null);
  const att=six.map(n=>{const p=attOf(st.id,n).pct;return p==null?null:+r1(p)});
  const tries=attemptsOf(st.id);
  const ins=[];
  if(sems.length){
    const best=sems.reduce((a,b)=>b.pct>a.pct?b:a);
    ins.push(`Best semester: Semester ${best.sem} at ${r1(best.pct)}%.`);
    if(sems.length>1){const l=sems[sems.length-1],p=sems[sems.length-2],d=l.pct-p.pct;ins.push(`Semester ${l.sem} is ${d>=0?'up':'down'} ${r1(Math.abs(d))} percentage points from Semester ${p.sem}.`)}
    ins.push(`CGPA so far: ${r2(cgpaOf(sems))} out of 10.`);
    const f=sems.reduce((a,s)=>a+s.failed.length,0);ins.push(f?`${f} failed subject${f>1?'s':''} across all semesters.`:'No failed subjects.');
  }
  const a=attOf(st.id);if(a.pct!=null)ins.push(`Attendance: ${r1(a.pct)}% across ${a.total} sessions${a.pct<75?' (below 75%)':''}.`);
  if(tries.length)ins.push(`Average aptitude score: ${r1(avg(tries.map(t=>t.score/t.total*100)))}% over ${tries.length} attempt${tries.length>1?'s':''}.`);
  const html=`<div class="pagehead">${studentPicker()}</div>
  <div class="card"><h3>${esc(st.name)}</h3><p class="muted sm">${esc(st.course)} · Roll no. ${esc(st.roll)} · Semester ${st.semester}</p>${ins.length?`<ul class="insights">${ins.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:'<p class="empty small">Marks, attendance and test data will appear here once they are recorded.</p>'}</div>
  <div class="cols">
    ${chartCard('Percentage across six semesters','Student compared with class average','cP')}
    ${chartCard('SGPA and CGPA','Grade points out of 10','cG')}
    ${chartCard('Attendance by semester','Percentage of sessions attended','cT')}
    ${chartCard('Aptitude test scores','Each attempt, in order','cQ')}
  </div>`;
  return{title:S.user.role==='admin'?'Analytics':'My progress',html,mount(){
    const lab6=['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6'];
    lineChart('cP',lab6,[{label:'Student',data:pct},{label:'Class average',data:cls,dash:true}],{suffix:'%'});
    lineChart('cG',lab6,[{label:'SGPA',data:sg},{label:'CGPA (cumulative)',data:cum}],{max:10,min:0});
    barChart('cT',lab6,att,{suffix:'%',color:cssv('--c2'),label:'Attendance'});
    if(tries.length)lineChart('cQ',tries.map((t,i)=>'#'+(i+1)),[{label:'Score',data:tries.map(t=>+r1(t.score/t.total*100))}],{suffix:'%'});
    else{const c=document.getElementById('cQ');if(c)c.parentElement.innerHTML='<div class="empty small">No aptitude tests attempted yet.</div>'}
  }};
}

/* =====================================================================
   SETTINGS, BACKUP, DEMO DATA
   ===================================================================== */
function pSettings(){
  const Sx=sc();
  return{title:'Settings',html:`
  <div class="cols">
  <div class="card"><h3>Marking scheme</h3><p class="muted sm">Used for pass or fail checks, totals and grades. Existing results are recalculated automatically.</p>
    <div class="grid2 mt"><div class="field"><label for="s_thmax">TH maximum</label><input id="s_thmax" type="number" min="1" value="${Sx.thMax}"></div><div class="field"><label for="s_thmin">TH minimum to pass</label><input id="s_thmin" type="number" min="0" value="${Sx.thMin}"></div>
    <div class="field"><label for="s_inmax">INT maximum</label><input id="s_inmax" type="number" min="1" value="${Sx.intMax}"></div><div class="field"><label for="s_inmin">INT minimum to pass</label><input id="s_inmin" type="number" min="0" value="${Sx.intMin}"></div></div>
    <p class="muted sm">Maximum per subject: <b>${Sx.thMax+Sx.intMax}</b>. With 11 subjects the semester total is <b>${(Sx.thMax+Sx.intMax)*11}</b>.</p>
    <div class="row mt"><button class="btn" onclick="saveScheme()">Save marking scheme</button></div></div>
  <div class="card"><h3>Admin account</h3>
    <div class="field mt"><label for="s_user">Username</label><input id="s_user" value="${esc(Sx.adminUser)}"></div>
    <div class="field"><label for="s_old">Current password</label><input id="s_old" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="s_new">New password</label><input id="s_new" type="password" autocomplete="new-password"></div>
    <div id="s_err" class="err" role="alert"></div><button class="btn" onclick="saveAdmin()">Update account</button></div></div>
  <div class="card mt2"><h3>Data</h3><p class="muted sm">All data is saved in the database file <b>database.db</b> in the project folder. Copy that file to keep a backup.</p>
    <div class="row mt"><button class="btn ghost" onclick="exportBackup()">Export data (JSON)</button>
    <button class="btn ghost" onclick="loadDemo()">Load sample data</button><button class="btn danger" onclick="resetAll()">Reset everything</button></div></div>`};
}
async function saveScheme(){
  const v=id=>parseFloat($(id).value),a=v('#s_thmax'),b=v('#s_thmin'),c=v('#s_inmax'),d=v('#s_inmin');
  if([a,b,c,d].some(x=>isNaN(x)||x<0)||a<1||c<1){toast('Enter valid numbers','bad');return}
  if(b>a||d>c){toast('Minimum marks cannot be more than maximum marks','bad');return}
  if(await mutate(()=>api('PUT','/api/settings',{thMax:a,thMin:b,intMax:c,intMin:d}),'Marking scheme saved'))refresh();
}
async function saveAdmin(){
  const err=$('#s_err'),u=$('#s_user').value.trim(),o=$('#s_old').value,n=$('#s_new').value;
  if(!u){err.textContent='Username cannot be empty.';return}
  if((o||n)&&n.length<6){err.textContent='New password must be at least 6 characters.';return}
  if(!n&&u===DB.settings.adminUser){err.textContent='Nothing to update.';return}
  try{await api('PUT','/api/account',{username:u,oldPassword:o,newPassword:n});await loadData()}
  catch(e){err.textContent=e.message;return}
  toast('Account updated','ok');refresh();
}
function exportBackup(){window.location.href='/api/backup'}
function resetAll(){
  confirmBox('Delete all students, marks, attendance, tests and study material? The admin account stays. This cannot be undone.','Reset everything',async()=>{
    if(await mutate(()=>api('POST','/api/reset'),'All data cleared')){S.sel.sid=null;S.ui={};refresh()}
  });
}
async function loadDemo(){
  const r=await mutate(()=>api('POST','/api/demo'));
  if(r){S.sel.sid=null;refresh();toast(r.added?`Added ${r.added} sample student${r.added>1?'s':''}`:'Sample students are already added',r.added?'ok':'')}
}

/* ---------- page map & boot ---------- */
const PAGES={
  dashboard:()=>S.user.role==='admin'?adminDash():studentDash(),
  students:pStudents,tests:pTests,
  attendance:()=>S.user.role==='admin'?adminAtt():studentAtt(),
  marks:pMarks,results:pResults,analytics:pAnalytics,settings:pSettings
};
(async function boot(){
  const th=store.get('yp_theme');if(th)document.documentElement.dataset.theme=th;
  try{await loadData()}catch(e){S.user=null}
  render();
})();
