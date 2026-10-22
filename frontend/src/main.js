import {extractFile, splitText} from "./extract.js";

// Where the backend lives: the Cloud Run URL, set at build time on Vercel with VITE_API_BASE (local dev: the Flask server).
const ENV=import.meta.env||{};
let API=ENV.VITE_API_BASE||(ENV.DEV?"http://localhost:5050":"");
if(!/^https?:\/\//.test(API))API="";
API=API.replace(/\/$/,"");

const S={exam:[],practice:[],kind:null,mode:"teach_test",size:"section",depth:"standard",outline:null,slides:[],cfiles:[],lfiles:[],biwsMods:new Set(),biwsDefaults:false,level:"Beginner",focus:new Set(["Everyday conversation"]),step:-1};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

// ---------------------------------------------------------------- AI Lodge rate limit (429 CTA) and demo paused (503)
const CTA={
  name:"TOMO",emoji:"📚",accentColor:"#2aabee",
  headline:"You've studied up a storm!",
  description:"This demo built {count} study plans for you. In SMU BIA's AI Lodge, you'll learn to build AI tutors like TOMO from scratch.",
  programme:"AI Lodge",programmeLink:"https://www.smubia.com/ailodge",
  githubLink:"https://github.com/smubia-projects/ail-ay2627-s1-bianca-tomo",showcaseLink:"https://www.smubia.com/Projects",
};
class Handled extends Error{}  // a 429/503 that has already been shown to the user
let lastFocus=null;
function openOverlay(el){
  lastFocus=document.activeElement;el.classList.add("open");
  const f=el.querySelectorAll("a[href],button");if(f.length)setTimeout(()=>f[0].focus(),50);
}
function closeOverlay(el){el.classList.remove("open");if(lastFocus&&lastFocus.focus)lastFocus.focus()}
function showRateLimit(count){
  const el=$("#rl-overlay");
  el.style.setProperty("--rl-accent",CTA.accentColor);
  $("#rl-emoji").textContent=CTA.emoji;$("#rl-title").textContent=CTA.headline;
  $("#rl-desc").textContent=CTA.description.replace("{count}",count);
  $("#rl-join-label").textContent=`Join ${CTA.programme}`;
  $("#rl-join").href=CTA.programmeLink;$("#rl-github").href=CTA.githubLink;$("#rl-showcase").href=CTA.showcaseLink;
  openOverlay(el);
}
function showPaused(msg){$("#pause-msg").textContent=msg;openOverlay($("#pause-overlay"))}
$("#rl-dismiss").onclick=()=>closeOverlay($("#rl-overlay"));
$("#pause-ok").onclick=()=>closeOverlay($("#pause-overlay"));
document.querySelectorAll(".rl-overlay").forEach(o=>{
  o.addEventListener("click",e=>{if(e.target===o)closeOverlay(o)});
  o.addEventListener("keydown",e=>{  // keep focus inside the dialog; Escape closes it
    if(e.key==="Escape"){closeOverlay(o);return}
    if(e.key!=="Tab")return;
    const f=[...o.querySelectorAll("a[href],button")];if(!f.length)return;
    if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}
    else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}
  });
});
// Every call to the backend goes through here: a 429 from the rate limiter opens the CTA (count from the server),
// a 503 means the demo is paused (never the CTA). Other 429s (e.g. too many plans created) are ordinary errors.
async function api(path,opts){
  const r=await fetch(API+path,opts);
  if(r.status===429||r.status===503){
    let body={};try{body=await r.clone().json()}catch(e){}
    const d=(body&&body.detail)||{};
    if(r.status===503){const m=d.message||"This demo is temporarily paused. Check back soon.";showPaused(m);throw new Handled(m)}
    if(d.queries_used!=null){showRateLimit(d.queries_used);throw new Handled("You've used this demo's free plan builds for now.")}
  }
  return r;
}

function show(n){
  S.step=n;
  if(n===2){
    const b=S.kind==="biws";
    $("#biws-style-note").classList.toggle("hide",!b);
    const d={concept:b?"Bite-size pieces, about a minute each: tap Next to keep going. Each guide lesson is split into 3 to 6 short ideas.":null,
             section:b?"A condensed lesson of about 350 to 450 words: one main idea with the guide's example.":null,
             topic:b?"The guide itself, word for word, with its tables and screenshots. The longest and most complete.":null};
    $$("[data-size] span").forEach(sp=>{const k=sp.parentElement.dataset.size;if(!sp.dataset.orig)sp.dataset.orig=sp.textContent;sp.textContent=d[k]||sp.dataset.orig});
    if(b&&!S.biwsDefaults){S.biwsDefaults=true;S.size="topic";$$("[data-size]").forEach(x=>x.classList.toggle("sel",x.dataset.size==="topic"));$("#nq").value=3}
  }
  $$("#steps .st em")[1].textContent=S.kind==="biws"?"Modules":"Material";
  if(n===2){renderQtypes();$("#dur-block").classList.toggle("hide",S.kind==="smu"||S.kind==="biws");durHint()}
  $$("section.card").forEach(c=>c.classList.toggle("hide",!(+c.dataset.step===n && (!c.dataset.for||c.dataset.for===S.kind))));
  $("#steps").classList.toggle("hide",n<0);$("#brand").classList.toggle("hide",n<0);
  $$("#steps .st").forEach((e,i)=>e.classList.toggle("on",i<=n));
  scrollTo({top:0,behavior:"smooth"});
}
$("#go").onclick=()=>show(0);
$("#b0").onclick=()=>show(-1);
$$("[data-kind]").forEach(b=>b.onclick=()=>{S.kind=b.dataset.kind;$$("[data-kind]").forEach(x=>x.classList.toggle("sel",x===b));$("#n0").disabled=false});
$("#n0").onclick=()=>show(1);
$$(".back").forEach(b=>b.onclick=()=>show(S.step-1));
$$(".next").forEach(b=>{if(b.id!=="create")b.onclick=()=>{
  if(S.kind==="smu"&&(!S.outline||!S.slides.length)){alert("Please upload both the outline and at least one slide file.");return}
  if(S.kind==="custom"&&!$("#topic").value.trim()){alert("Tell me what you want to learn.");return}
  if(S.kind==="language"&&!$("#lang").value.trim()){alert("Which language do you want to learn?");return}
  if(S.kind==="biws"&&!S.biwsMods.size){alert("Pick at least one module.");return}
  show(2)}});

// uploads
const lists={exam:"#exam-list",practice:"#practice-list",outline:"#outline-list",slides:"#slides-list",cfiles:"#cfiles-list",lfiles:"#lfiles-list"};
function setFiles(key,files){
  files=[...files];
  if(key==="outline"){S.outline=files[0]||null}else{S[key]=files}
  $(lists[key]).innerHTML=files.map(f=>`<li>📄 ${f.name.replace(/[&<>]/g,"")}</li>`).join("");
}
$$(".drop").forEach(d=>{
  const key=d.dataset.input, input=$("#"+key);
  d.onclick=()=>input.click();
  input.onchange=()=>setFiles(key,input.files);
  d.ondragover=e=>{e.preventDefault();d.classList.add("over")};
  d.ondragleave=()=>d.classList.remove("over");
  d.ondrop=e=>{e.preventDefault();d.classList.remove("over");setFiles(key,e.dataTransfer.files)};
});

$$("[data-level]").forEach(b=>b.onclick=()=>{S.level=b.dataset.level;$$("[data-level]").forEach(x=>x.classList.toggle("sel",x===b))});
$$("[data-focus]").forEach(b=>b.onclick=()=>{const v=b.dataset.focus;S.focus.has(v)?S.focus.delete(v):S.focus.add(v);b.classList.toggle("sel")});
$$("[data-size]").forEach(b=>b.onclick=()=>{S.size=b.dataset.size;$$("[data-size]").forEach(x=>x.classList.toggle("sel",x===b))});
const QT_LANG=[["talk","Conversation (reply out loud)"],["say","Repeat after me"],["listen","Listening"],["mcq","Multiple choice"],["fill","Fill in the blank"]];
const QT_OTHER=[["mcq","Multiple choice"],["tf","True or false"],["open","Open-ended"],["fill","Fill in the blank"]];
function renderQtypes(){
  const lang=S.kind==="language";
  if(S.qtKind!==lang){S.qtKind=lang;S.qtypes=new Set(lang?["talk","say","listen"]:["mcq","open"])}
  $("#qtypes").innerHTML="";
  (lang?QT_LANG:QT_OTHER).forEach(([k,label])=>{
    const c=document.createElement("button");c.className="chip"+(S.qtypes.has(k)?" sel":"");c.textContent=label;
    c.onclick=()=>{if(S.qtypes.has(k)){if(S.qtypes.size>1)S.qtypes.delete(k)}else S.qtypes.add(k);c.classList.toggle("sel",S.qtypes.has(k))};
    $("#qtypes").append(c)});
}
S.dur="10";
// how long the plan runs: a number of lessons, or "forever" (new lessons are written as you go)
function planLength(){
  if(S.dur==="forever")return "forever";
  if(S.dur==="other")return Math.max(1,Math.min(200,parseInt($("#dur-n").value)||1));
  return +S.dur;
}
function durHint(){
  const el=$("#dur-hint");if(!el)return;
  $("#dur-other").classList.toggle("hide",S.dur!=="other");
  if(S.dur==="forever"){el.textContent="I'll keep writing new lessons as you go, building on what you've learned and what you find hard.";return}
  const n=planLength();
  el.textContent=S.mode==="teach_test"?`${n} lessons, each followed by a quiz: ${2*n} sessions, one each time you send /next. At the end you can add more or keep going.`
    :`${n} quizzes, one each time you send /next. At the end you can add more or keep going.`;
}
$("#dur-n").oninput=durHint;
$$("[data-dur]").forEach(b=>b.onclick=()=>{S.dur=b.dataset.dur;$$("[data-dur]").forEach(x=>x.classList.toggle("sel",x===b));durHint()});
$$("[data-depth]").forEach(b=>b.onclick=()=>{S.depth=b.dataset.depth;$$("[data-depth]").forEach(x=>x.classList.toggle("sel",x===b))});
// mode
$$("[data-mode]").forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;$$("[data-mode]").forEach(x=>x.classList.toggle("sel",x===b));durHint()});

// Breaking Into Wall Street is copyrighted, so online it only appears for someone who enters the private access code
const biwsHeaders=()=>{let c="";try{c=sessionStorage.getItem("biws-code")||""}catch(e){}return c?{"X-Biws-Code":c}:{}};
function loadBiws(){
api("/api/biws",{headers:biwsHeaders()}).then(r=>r.json()).then(b=>{
  $("#unlock").classList.toggle("hide",!b.locked);
  if(!b.available){$("#biws-opt").classList.add("hide");return}  // the guide is copyrighted, so it's only offered where its files exist
  $("#biws-opt").classList.remove("hide");
  let opt=0;
  $("#biws-mods").innerHTML=b.modules.map(m=>{opt+=m.optional;S.biwsMods.add(m.id);return `<button class="opt sel" data-mod="${m.id}"><b>${esc(m.name)}</b><span>${esc(m.blurb)} · ${m.days} lessons</span></button>`}).join("");
  $("#biws-opt-n").textContent=`(${opt} extra days)`;
  $$("[data-mod]").forEach(x=>x.onclick=()=>{const id=x.dataset.mod;S.biwsMods.has(id)?S.biwsMods.delete(id):S.biwsMods.add(id);x.classList.toggle("sel")});
}).catch(()=>{});
}
loadBiws();
$("#unlock-btn").onclick=async()=>{
  const code=prompt("Enter your access code");
  if(!code)return;
  try{sessionStorage.setItem("biws-code",code.trim())}catch(e){}
  const b=await (await api("/api/biws",{headers:biwsHeaders()})).json();
  if(b.available){loadBiws();alert("Unlocked. The Breaking Into Wall Street option is now on the list.")}
  else{try{sessionStorage.removeItem("biws-code")}catch(e){}alert("That code didn't work.")}
};

// ---------------------------------------------------------------- creating a plan
// 1) send the choices, 2) read each file in the browser and send its text, 3) ask the server to build the plan
const JSONH={"Content-Type":"application/json"};
function working(msg){$("#working").classList.remove("hide");$("#done").classList.add("hide");$("#failed").classList.add("hide");$("#working h2").textContent=msg}
function failed(msg){$("#working").classList.add("hide");$("#failed").classList.remove("hide");$("#ferr").textContent=msg}
$("#start-over").onclick=()=>location.reload();

async function sendFiles(id){
  const jobs=[];
  if(S.kind==="smu"){
    if(S.outline)jobs.push(["outline",S.outline]);
    S.slides.forEach(f=>jobs.push(["file",f]));S.exam.forEach(f=>jobs.push(["exam",f]));S.practice.forEach(f=>jobs.push(["practice",f]));
  }else if(S.kind==="language"){S.lfiles.forEach(f=>jobs.push(["file",f]))}
  else if(S.kind==="custom"){S.cfiles.forEach(f=>jobs.push(["file",f]))}
  for(let i=0;i<jobs.length;i++){
    const [kind,file]=jobs[i];
    working(`Reading ${file.name} (${i+1} of ${jobs.length})…`);
    const text=await extractFile(file);
    for(const part of splitText(file.name,text)){
      const r=await api(`/api/plans/${id}/material`,{method:"POST",headers:JSONH,body:JSON.stringify({kind,name:part.name,text:part.text})});
      if(!r.ok){let m="Couldn't upload "+file.name;try{m=(await r.json()).error||m}catch(e){}throw new Error(m)}
    }
  }
}

$("#create").onclick=async()=>{
  $("#err").textContent="";
  const body={kind:S.kind,mode:S.mode,size:S.size,depth:S.depth,nq:Math.min(15,Math.max(2,parseInt($("#nq").value)||5)),qtypes:[...S.qtypes]};
  if(S.kind==="smu"){body.notes=$("#notes").value}
  else if(S.kind==="biws"){Object.assign(body,{modules:[...S.biwsMods],optional:$("#biws-opt-days").checked,start:+$("#biws-start").value||1,notes:$("#biws-notes").value})}
  else if(S.kind==="language"){Object.assign(body,{language:$("#lang").value,level:S.level,focus:[...S.focus].join(", ")||"Everyday conversation",scope:$("#lnotes").value,length:planLength()})}
  else{Object.assign(body,{topic:$("#topic").value,scope:$("#scope").value,length:planLength()})}
  $("#create").disabled=true;
  try{
    const r=await api("/api/plans",{method:"POST",headers:{...JSONH,...biwsHeaders()},body:JSON.stringify(body)});const j=await r.json();
    if(!r.ok){$("#err").textContent=j.error||"Something went wrong.";return}
    show(3);working("Getting started…");PID=j.id;
    await sendFiles(j.id);
    if(S.kind!=="biws"){
      working("Building your study plan… this can take up to a minute.");
      // if it times out, poll() reports what happened; a rate limit or a paused demo stops here
      try{await api(`/api/plans/${j.id}/build`,{method:"POST",headers:JSONH,body:"{}"})}catch(e){if(e instanceof Handled)throw e}
    }
    poll(j.id);
  }catch(e){
    if($("#err").textContent==="")$("#err").textContent=e.message;
    if(S.step===3)failed(e.message);
  }finally{$("#create").disabled=false}
};

let PID=null,UNITS=[],FILES=[];
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function renderUnits(){
  $("#units").innerHTML=UNITS.map((u,i)=>`<div class="ucard" data-i="${i}" data-bd="${u.biws_day||""}">
    <div class="top"><input type="number" class="w" min="1" max="52" placeholder="Wk" value="${Math.max(1,parseInt(u.week)||i+1)}" title="Week (optional)">
      <input type="text" class="t" value="${esc(u.title)}" placeholder="Topic title">
      <button class="ib up" title="Move up">↑</button><button class="ib dn" title="Move down">↓</button><button class="ib del" title="Delete">✕</button></div>
    <textarea class="s" placeholder="What this topic covers">${esc(u.summary)}</textarea>
    ${FILES.length?`<div class="chips">${FILES.map(f=>`<button class="chip f${u.files.includes(f)?" sel":""}" data-f="${esc(f)}">${esc(f)}</button>`).join("")}</div>`:""}
  </div>`).join("");
}
function readUnits(){
  UNITS=$$(".ucard").map(c=>({week:Math.max(1,parseInt(c.querySelector(".w").value)||1),title:c.querySelector(".t").value,summary:c.querySelector(".s").value,
    files:[...c.querySelectorAll(".chip.f.sel")].map(x=>x.dataset.f),biws_day:c.dataset.bd?+c.dataset.bd:undefined}));
}
$("#units").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  const i=+b.closest(".ucard").dataset.i;
  if(b.classList.contains("chip")){b.classList.toggle("sel");return}
  readUnits();
  const seq=UNITS.every((u,k)=>+u.week===k+1);  // weeks still follow the order, so keep them in step
  if(b.classList.contains("del")){if(UNITS.length>1)UNITS.splice(i,1);else alert("A plan needs at least one topic.")}
  if(b.classList.contains("up")&&i>0)[UNITS[i-1],UNITS[i]]=[UNITS[i],UNITS[i-1]];
  if(b.classList.contains("dn")&&i<UNITS.length-1)[UNITS[i+1],UNITS[i]]=[UNITS[i],UNITS[i+1]];
  if(seq)UNITS.forEach((u,k)=>u.week=k+1);
  renderUnits();
});
$("#addu").onclick=()=>{readUnits();UNITS.push({week:UNITS.length+1,title:"",summary:"",files:[]});renderUnits();$$(".ucard .t").pop().focus()};
$("#saveu").onclick=async()=>{
  readUnits();$("#savemsg").textContent="Saving…";
  const r=await api(`/api/plans/${PID}/units`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({units:UNITS})});
  const j=await r.json();
  $("#savemsg").innerHTML=r.ok?'<span class="ok">Saved ✓ The bot will use this plan.</span>':`<span class="err">${esc(j.error)}</span>`;
};

async function poll(id){
  PID=id;
  const p=await (await api("/api/plans/"+id)).json();
  if(p.status==="processing"){setTimeout(()=>poll(id),2500);return}
  $("#working").classList.add("hide");
  if(p.status==="error"){$("#failed").classList.remove("hide");$("#ferr").textContent=p.error;return}
  $("#done").classList.remove("hide");
  $("#course").textContent=p.course;$("#sched").textContent=p.how;
  UNITS=p.units;FILES=p.files||[];renderUnits();
  $("#addu").classList.toggle("hide",p.kind==="biws");
  const b=p.banks||{};$("#banknote").textContent=(b.exam||b.practice)?"🎯 Quizzes will be built from variants and harder versions of your "+[b.exam&&b.exam.length+" past paper(s)",b.practice&&b.practice.length+" practice file(s)"].filter(Boolean).join(" and ")+", within each topic.":"";
  $("#tglink").href=p.link||"#";
  watch(id);
}
async function watch(id){
  const p=await (await api("/api/plans/"+id)).json();
  if(p.linked){$("#linked").classList.remove("hide");$("#tglink").classList.add("hide");return}
  setTimeout(()=>watch(id),3000);
}
show(-1);
