
const VERSION="5.4.26";

// ===== v5.4.3 : console de logs intégrée =====
const pmoLogs=[];
const nativeConsole={info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)};
function logSafeValue(v){
  if(v instanceof Error)return {name:v.name,message:v.message,stack:v.stack};
  if(typeof v==="string"||typeof v==="number"||typeof v==="boolean"||v==null)return v;
  try{return JSON.parse(JSON.stringify(v))}catch{return String(v)}
}
function pmoLog(level,message,details=null){
  const entry={ts:new Date().toISOString(),level,message:String(message),details:details==null?null:logSafeValue(details)};
  pmoLogs.push(entry);
  if(pmoLogs.length>500)pmoLogs.splice(0,pmoLogs.length-500);
  renderPmoLogs();
  return entry;
}
function pmoInfo(message,details=null){nativeConsole.info("[PMO]",message,details??"");return pmoLog("INFO",message,details)}
function pmoWarn(message,details=null){nativeConsole.warn("[PMO]",message,details??"");return pmoLog("WARN",message,details)}
function pmoError(message,details=null){nativeConsole.error("[PMO]",message,details??"");return pmoLog("ERROR",message,details)}
function renderPmoLogs(){
  const list=document.getElementById("logList");if(!list)return;
  const filter=document.getElementById("logLevelFilter")?.value||"ALL";
  const rows=pmoLogs.filter(x=>filter==="ALL"||x.level===filter);
  list.innerHTML=rows.length?rows.slice().reverse().map(x=>`<div class="log-row log-${x.level.toLowerCase()}"><div class="log-meta"><span>${x.level}</span><time>${new Date(x.ts).toLocaleTimeString()}</time></div><div class="log-message">${esc(x.message)}</div>${x.details!=null?`<pre>${esc(typeof x.details==="string"?x.details:JSON.stringify(x.details,null,2))}</pre>`:""}</div>`).join(""):'<div class="log-empty">Aucun log.</div>';
  const errors=pmoLogs.filter(x=>x.level==="ERROR").length;
  const badge=document.getElementById("logErrorBadge");if(badge){badge.textContent=errors;badge.classList.toggle("hidden",errors===0)}
  const summary=document.getElementById("logSummary");if(summary)summary.textContent=`${pmoLogs.length} événement${pmoLogs.length>1?"s":""} · ${errors} erreur${errors>1?"s":""}`;
}
function clearPmoLogs(){pmoLogs.length=0;renderPmoLogs()}
function pmoLogsText(){return pmoLogs.map(x=>`${x.ts} [${x.level}] ${x.message}${x.details!=null?" | "+(typeof x.details==="string"?x.details:JSON.stringify(x.details)):""}`).join("\n")}

function notifyBanner(message,type="info"){
  try{
    const el=document.getElementById("banner");
    if(el){
      el.textContent=String(message??"");
      el.className="banner "+(type||"info");
      el.classList.remove("hidden");
      clearTimeout(notifyBanner._t);
      notifyBanner._t=setTimeout(()=>el.classList.add("hidden"),2600);
      return;
    }
  }catch(e){pmoWarn("Impossible d'afficher la bannière",e)}
  if(type==="error")pmoError(String(message));
  else if(type==="warn")pmoWarn(String(message));
  else pmoInfo(String(message));
}

window.addEventListener("error",e=>pmoError("Erreur JavaScript",{message:e.message,source:e.filename,line:e.lineno,column:e.colno}));
window.addEventListener("unhandledrejection",e=>pmoError("Promesse rejetée",e.reason));
const T={domains:"Domaine",projects:"Projects",tasks:"Tasks",team:"Team",teamRef:"Team_ref",contrib:"CONTRIBUTIONS_OBJECTIFS",objectives:"Objectifs",axes:"Axes_Strategiques",activities:"Activites",activityOffers:"Activites_OFS",offers:"Offres_Services",allocations:"Allocations",projectStages:"Etapes_Projet",projectStagePlans:"Projet_Etapes",featureStages:"Stades_Fonctionnalite",features:"Fonctionnalites",releases:"Releases",releaseFeatures:"Release_Fonctionnalites",audit:"JOURNAL_ACTIONS",documentation:"Documentation"};
function tableKeyFromName(tableName){
  const wanted=String(tableName||"").trim().toLowerCase();
  if(!wanted)return null;
  const hit=Object.entries(T).find(([,name])=>String(name).trim().toLowerCase()===wanted);
  return hit?.[0]||null;
}
let db={},tableLoadErrors={},tableLoadMeta={},currentProjectId=null,taskFilter="all",busy=false,currentTab="project",detailTab="infos",typeFilter="all",offerTypeFilter="all",currentOfferId=null,projectSearch="",domainFilter="all",serviceFilter="all",natureFilter="all",resourceTeamFilter="all",resourceRoleFilter="all",resourceProjectFilter="all",resourceLoadFilter="all",selectedResourceId=null;
function presencePage(){
  if(currentTab==="docs")return "Documentation";
  if(currentTab==="offer")return currentOfferId?`Offre #${currentOfferId}`:"Offres de services";
  if(currentTab==="resources")return selectedResourceId?`Ressource #${selectedResourceId}`:"Pilotage ressources";
  if(currentTab==="project"){
    if(currentProjectId && !optionalEl("projectPage")?.classList.contains("hidden"))return `Projet/Produit #${currentProjectId}`;
    return "Portefeuille projets / produits";
  }
  return "Cockpit";
}
function touchPresence(){window.PmoPresence?.touch?.()}

const $=id=>{
  const el=document.getElementById(id);
  if(!el) throw new Error(`Élément UI introuvable: #${id}`);
  return el;
};
function optionalEl(id){return document.getElementById(id)}
function rows(d){if(!d||!Array.isArray(d.id))return[];const ks=Object.keys(d);return d.id.map((_,i)=>Object.fromEntries(ks.map(k=>[k,Array.isArray(d[k])?d[k][i]:d[k]])))}
async function fetchTable(k,t){
  try{
    const raw=await grist.docApi.fetchTable(t);
    const result=rows(raw);
    delete tableLoadErrors[k];
    tableLoadMeta[k]={
      table:t,
      count:result.length,
      columns:Object.keys(raw||{}).filter(x=>x!=="id")
    };
    return result;
  }catch(e){
    tableLoadErrors[k]=e?.message||String(e);
    tableLoadMeta[k]={table:t,count:0,columns:[]};
    console.warn(`Table ${t} inaccessible`,e);
    return [];
  }
}
function id(v){if(Array.isArray(v))return v.find(x=>Number.isInteger(x))??null;const n=Number(v);return Number.isFinite(n)?n:null}
function refs(v){if(!v)return[];return Array.isArray(v)?v.filter(x=>Number.isInteger(x)):Number.isInteger(v)?[v]:[]}
function reflist(xs){return["L",...xs.map(Number).filter(Number.isFinite)]}
function get(k,i){return(db[k]||[]).find(r=>Number(r.id)===Number(i))||null}
function pct(v){let n=Number(v??0);if(!Number.isFinite(n))n=0;if(n<=1)n*=100;return Math.max(0,Math.min(100,Math.round(n)))}
function fromPct(v){let n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:0}
function dms(v){if(!v)return null;if(typeof v==="number")return v>1e12?v:v*1000;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function dt(v){const ms=dms(v);return ms?new Intl.DateTimeFormat("fr-FR").format(new Date(ms)):"—"}
function din(v){const ms=dms(v);return ms?new Date(ms).toISOString().slice(0,10):""}
function gd(v){if(!v)return null;const ms=Date.parse(v+"T00:00:00Z");return Number.isFinite(ms)?Math.floor(ms/1000):null}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function indicatorHelp(text){
  return `<button type="button" class="indicator-help" aria-label="Explication du calcul" title="${esc(text)}" data-indicator-help="${esc(text)}">?</button>`;
}
function money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n):"—"}
function done(s){return/termin|done|clos|fini/i.test(String(s||""))}
function late(t){return!done(t.statut)&&!!dms(t.dateEcheance)&&dms(t.dateEcheance)<Date.now()}
function typeOf(p){return/produit/i.test(String(p?.Type||""))?"produit":"projet"}
function typeBadge(p){const t=typeOf(p);return`<span class="type-badge ${t}">${t==="produit"?"Produit":"Projet"}</span>`}
function taskRows(pid){return db.tasks.filter(t=>id(t.projet)===Number(pid))}
function contribRows(pid){return db.contrib.filter(c=>refs(c.Projet_Code).includes(Number(pid)))}
function allocRows(pid){return db.allocations.filter(a=>id(a.Projet_Code)===Number(pid))}

function projectOffer(p){
  const act=get("activities",id(p.activite));
  if(!act)return null;
  const ao=get("activityOffers",id(act.Service_Code));
  return ao?get("offers",id(ao.OFS_Code)):null;
}
function domainRefFromRecord(r){
  if(!r)return null;
  for(const k of ["Domaine_code","Domaine_Code","Domaine","domaine","domain","Domain"]){
    const v=id(r[k]);if(v)return v;
  }
  return null;
}
function projectDomainId(p){
  const fromOffer=domainRefFromRecord(projectOffer(p));
  if(fromOffer)return fromOffer;
  return domainRefFromRecord(get("activities",id(p.activite)));
}
function populatePortfolioFilters(){
  $("domainFilter").innerHTML='<option value="all">Tous les domaines</option>'+db.domains.map(d=>`<option value="${d.id}">${esc(d.Nom||d.Libelle||d.Code||`#${d.id}`)}</option>`).join("");
  $("serviceFilter").innerHTML='<option value="all">Tous les services</option>'+db.offers.map(o=>`<option value="${o.id}">${esc(o.Nom||o.Code||`#${o.id}`)}</option>`).join("");
  $("domainFilter").value=domainFilter;$("serviceFilter").value=serviceFilter;
}
function filteredProjects(filter=typeFilter){return db.projects.filter(p=>{
  if(filter!=="all"&&typeOf(p)!==filter)return false;if(natureFilter!=="all"&&String(p.Nature_Projet||"")!==natureFilter)return false;
  const offer=projectOffer(p);
  if(serviceFilter!=="all"&&Number(offer?.id)!==Number(serviceFilter))return false;
  if(domainFilter!=="all"&&Number(projectDomainId(p))!==Number(domainFilter))return false;
  return true;
})}

async function load(){pmoInfo("Chargement des données Grist démarré");
  try{
  const es=await Promise.all(Object.entries(T).map(async([k,t])=>[k,await fetchTable(k,t)]));db=Object.fromEntries(es);
  if(!db.projects.length){notifyBanner("Projects est vide ou inaccessible.");return}
  if(!currentProjectId||!get("projects",currentProjectId))currentProjectId=db.projects[0].id;
  populatePortfolioFilters();
  populateProjectSelect();
  if(!currentOfferId&&db.offers.length)currentOfferId=db.offers[0].id;
  populateOfferSelect();
  renderAll();
  switchMainTab(currentTab);
  }catch(e){
    console.error("Erreur de chargement cockpit",e);
    notifyBanner(`Erreur de chargement : ${e?.message||e}`);
  }
}
function visibleProjects(){
  const q=projectSearch.trim().toLowerCase();
  return filteredProjects().filter(p=>!q||String(p.nom||"").toLowerCase().includes(q)||String(p.code||"").toLowerCase().includes(q));
}
function populateProjectSelect(){
  const ps=visibleProjects();
  if(ps.length&&!ps.some(p=>p.id===currentProjectId))currentProjectId=ps[0].id;
  if(!ps.length)currentProjectId=null;
  renderProjectList();
}
function populateOfferSelect(){
  $("offerSelect").innerHTML=db.offers.map(o=>`<option value="${o.id}">${esc(o.Nom||o.Code||`#${o.id}`)}</option>`).join("");
  if(currentOfferId)$("offerSelect").value=currentOfferId;
}

function attachmentIds(v){
  if(!Array.isArray(v))return [];
  return v.map(Number).filter(n=>Number.isFinite(n)&&n>0);
}
async function openDocAttachment(attId){
  try{
    const tokenInfo=grist.getAccessToken?await grist.getAccessToken({readOnly:true}):await grist.docApi.getAccessToken({readOnly:true});
    const base=String(tokenInfo.baseUrl||"").replace(/\/$/,"");
    const docId=tokenInfo.docId;
    if(!base||!docId)throw new Error("Accès pièce jointe indisponible.");
    const url=`${base}/api/docs/${encodeURIComponent(docId)}/attachments/${encodeURIComponent(attId)}/download?auth=${encodeURIComponent(tokenInfo.token)}`;
    window.open(url,"_blank","noopener,noreferrer");
  }catch(e){console.error(e);notifyBanner(`Impossible d'ouvrir la pièce jointe : ${e?.message||e}`);}
}
function renderDocumentation(){
  const error=tableLoadErrors.documentation;
  const meta=tableLoadMeta.documentation||{table:"Documentation",count:0,columns:[]};
  const status=$("docsStatus");

  const allDocs=[...(db.documentation||[])];
  const activeDocs=allDocs.filter(d=>{
    // If the column does not exist, publish the row.
    if(!Object.prototype.hasOwnProperty.call(d,"Actif"))return true;
    // Grist Bool returns true/false. Empty/null is treated as visible.
    return d.Actif!==false && d.Actif!==0;
  });

  if(error){
    status.classList.remove("hidden");
    status.innerHTML=`<strong>Table <code>Documentation</code> introuvable ou inaccessible.</strong>
      <div class="muted">Erreur Grist : ${esc(error)}</div>
      <div class="muted">Le Cockpit utilise l'ID technique exact <code>Documentation</code>.</div>`;
  }else if(meta.count===0){
    status.classList.remove("hidden");
    status.innerHTML=`<strong>Table <code>Documentation</code> trouvée, mais aucune ligne n'est lue.</strong>
      <div class="muted">Colonnes détectées : ${meta.columns.length?meta.columns.map(esc).join(", "):"aucune"}</div>`;
  }else if(!activeDocs.length){
    status.classList.remove("hidden");
    status.innerHTML=`<strong>Table <code>Documentation</code> trouvée : ${meta.count} ligne(s), mais aucune ligne active.</strong>
      <div>Active au moins une ligne dans la colonne <code>Actif</code>.</div>
      <div class="muted">Colonnes détectées : ${meta.columns.map(esc).join(", ")}</div>`;
  }else{
    status.classList.remove("hidden");
    status.innerHTML=`<strong>Documentation chargée : ${activeDocs.length} ligne(s) active(s) sur ${meta.count}.</strong>
      <div class="muted">Source : table technique <code>${esc(meta.table)}</code></div>`;
  }

  const docs=activeDocs.sort((a,b)=>Number(a.Ordre||0)-Number(b.Ordre||0)||String(a.Nom||"").localeCompare(String(b.Nom||"")));
  $("docsCards").classList.toggle("hidden",!docs.length);
  $("docsEmpty").classList.toggle("hidden",!!docs.length||!!error||meta.count>0);
  $("docsCards").innerHTML=docs.map(d=>{
    const atts=attachmentIds(d.Piece_Jointe),isAttachment=/pièce jointe|fichier/i.test(String(d.Type_Document||""));
    const sourceLabel=isAttachment?(atts.length?`${atts.length} pièce(s) jointe(s)`:"Pièce jointe non chargée"):(d.URL||"");
    const action=isAttachment
      ? (atts.length?`<button class="doc-card doc-card-button" data-doc-att="${atts[0]}"><div class="doc-card-icon">${esc(d.Icone||"📎")}</div><div class="doc-card-body"><h3>${esc(d.Nom||"Document")}</h3><div class="doc-card-url">${esc(sourceLabel)}</div></div><div class="doc-card-arrow">↗</div></button>`:
        `<div class="doc-card doc-card-disabled"><div class="doc-card-icon">${esc(d.Icone||"📎")}</div><div class="doc-card-body"><h3>${esc(d.Nom||"Document")}</h3><div class="doc-card-url">${esc(sourceLabel)}</div></div></div>`)
      : `<a class="doc-card" href="${esc(d.URL||"#")}" target="_blank" rel="noopener noreferrer"><div class="doc-card-icon">${esc(d.Icone||"🔗")}</div><div class="doc-card-body"><h3>${esc(d.Nom||"Documentation")}</h3><div class="doc-card-url">${esc(sourceLabel)}</div></div><div class="doc-card-arrow">↗</div></a>`;
    return action;
  }).join("");
  document.querySelectorAll("[data-doc-att]").forEach(b=>b.onclick=()=>openDocAttachment(Number(b.dataset.docAtt)));
}

function renderAll(){renderPortfolioKpis();renderProject();renderOffer();renderResources();renderDocumentation();}
function renderPortfolioKpis(){
  const ps=visibleProjects(), all=filteredProjects();
  const active=ps.filter(p=>!/termin|clos|done/i.test(String(p.statut||""))).length;
  const lateProjects=ps.filter(p=>taskRows(p.id).some(late)).length;
  const doneProjects=ps.filter(p=>/termin|clos|done/i.test(String(p.statut||""))).length;
  const avg=ps.length?Math.round(ps.reduce((n,p)=>n+pct(p.progression),0)/ps.length):0;
  const remaining=ps.reduce((sum,p)=>sum+taskRows(p.id).reduce((n,t)=>n+Math.max(0,Number(t.estimationH||0)-Number(t.tempsPasse||0)),0),0);
  const proj=ps.filter(p=>typeOf(p)==="projet").length,prod=ps.filter(p=>typeOf(p)==="produit").length;
  $("portfolioKpis").innerHTML=
    kpi("Total éléments",ps.length,`Projets : ${proj} • Produits : ${prod}`)+
    kpi("En cours",active,ps.length?`${Math.round(active/ps.length*100)}% du total`:"")+
    kpi("En retard",lateProjects,ps.length?`${Math.round(lateProjects/ps.length*100)}% du total`:"")+
    kpi("Terminés",doneProjects,ps.length?`${Math.round(doneProjects/ps.length*100)}% du total`:"")+
    kpi("Avancement moyen",`${avg}%`,"Global portefeuille")+
    kpi("Charge totale",`${Math.round(remaining)} h`,"Estimation restante");
}

function showPortfolioPage(){
  touchPresence();
  $("portfolioPage").classList.remove("hidden");
  $("projectPage").classList.add("hidden");
  try{history.replaceState(null,"",location.pathname+location.search)}catch(_){}
  window.scrollTo({top:0,behavior:"smooth"});
}
function showProjectPage(pid){
  currentProjectId=Number(pid);detailTab="infos";
  touchPresence();
  $("portfolioPage").classList.add("hidden");
  $("projectPage").classList.remove("hidden");
  renderProject();
  const p=get("projects",currentProjectId);
  $("projectBreadcrumb").textContent=p?.nom||p?.code||"Projet / Produit";
  try{history.replaceState(null,"",`#projet-${currentProjectId}`)}catch(_){}
  window.scrollTo({top:0,behavior:"smooth"});
}


const PROJECT_COLUMNS=[
  {key:"code",label:"Code"},
  {key:"nom",label:"Nom",required:true},
  {key:"type",label:"Type"},
  {key:"nature",label:"Nature"},
  {key:"domaine",label:"Domaine"},
  {key:"service",label:"Service"},
  {key:"statut",label:"Statut"},
  {key:"avancement",label:"Avancement"},
  {key:"debut",label:"Début"},
  {key:"fin",label:"Fin"},
  {key:"meteo",label:"Météo"}
];
const DEFAULT_PROJECT_COLUMNS=PROJECT_COLUMNS.map(c=>c.key);
let projectColumns=loadProjectColumns();
function loadProjectColumns(){
  try{
    const saved=JSON.parse(localStorage.getItem("gristPmoProjectColumns")||"null");
    if(Array.isArray(saved)){
      const valid=saved.filter(k=>PROJECT_COLUMNS.some(c=>c.key===k));
      if(!valid.includes("nom"))valid.unshift("nom");
      return valid.length?valid:DEFAULT_PROJECT_COLUMNS.slice();
    }
  }catch(_){}
  return DEFAULT_PROJECT_COLUMNS.slice();
}
function saveProjectColumns(){
  try{localStorage.setItem("gristPmoProjectColumns",JSON.stringify(projectColumns))}catch(_){}
}
function columnVisible(k){return projectColumns.includes(k)}
function renderColumnsMenu(){
  $("columnsChoices").innerHTML=PROJECT_COLUMNS.map(c=>`<label class="column-choice">
    <input type="checkbox" value="${c.key}" ${columnVisible(c.key)?"checked":""} ${c.required?"disabled":""}>
    <span>${esc(c.label)}</span>${c.required?'<small>obligatoire</small>':""}
  </label>`).join("");
  $("columnsChoices").querySelectorAll('input:not([disabled])').forEach(cb=>cb.onchange=()=>{
    if(cb.checked){if(!projectColumns.includes(cb.value))projectColumns.push(cb.value)}
    else projectColumns=projectColumns.filter(k=>k!==cb.value);
    // preserve canonical order
    projectColumns=PROJECT_COLUMNS.map(c=>c.key).filter(k=>projectColumns.includes(k));
    saveProjectColumns();renderProjectList();
  });
}
function toggleColumnsMenu(force){
  const menu=$("columnsMenu");
  const open=typeof force==="boolean"?force:menu.classList.contains("hidden");
  menu.classList.toggle("hidden",!open);
  if(open)renderColumnsMenu();
}

function renderProjectList(){
  const ps=visibleProjects();
  if(!ps.length){
    $("projectList").innerHTML='<div class="empty-state"><h3>Aucun résultat</h3><p>Modifiez le filtre ou la recherche.</p></div>';
    $("projectListFooter").textContent="0 élément";
    return;
  }
  const header={
    code:"Code",nom:"Nom",type:"Type",nature:"Nature",domaine:"Domaine",service:"Service",
    statut:"Statut",avancement:"Avancement",debut:"Début",fin:"Fin",meteo:"Météo"
  };
  const th=PROJECT_COLUMNS.filter(c=>columnVisible(c.key)).map(c=>`<th>${header[c.key]}</th>`).join("");
  $("projectList").innerHTML=`<table class="portfolio-table configurable-table">
    <thead><tr>${th}<th class="actions-col"></th></tr></thead>
    <tbody>${ps.map(p=>{
      const progress=pct(p.progression),active=p.id===currentProjectId;
      const act=get("activities",id(p.activite));
      const ao=act?get("activityOffers",id(act.Service_Code)):null;
      const offer=ao?get("offers",id(ao.OFS_Code)):null;
      const domain=get("domains",projectDomainId(p));
      const weather=String(p.Meteo_Projet||"").trim()||(
        taskRows(p.id).some(t=>late(t)&&/haute|critique|high/i.test(String(t.priorite||"")))?"🔴 Rouge":
        taskRows(p.id).some(late)||/haut|élev|critique|high/i.test(String(p.risque||""))?"🟠 Orange":"🟢 Vert"
      );
      const cells={
        code:`<td><button class="table-link" data-project-open="${p.id}">${esc(p.code||`#${p.id}`)}</button></td>`,
        nom:`<td><strong>${esc(p.nom||`#${p.id}`)}</strong></td>`,
        type:`<td>${typeBadge(p)}</td>`,
        nature:`<td>${esc(p.Nature_Projet||"—")}</td>`,
        domaine:`<td>${esc(domain?.Nom||domain?.Libelle||domain?.Code||"—")}</td>`,
        service:`<td>${esc(offer?.Nom||offer?.Code||"—")}</td>`,
        statut:`<td>${esc(p.statut||"—")}</td>`,
        avancement:`<td><div class="table-progress"><span>${progress}%</span><div class="mini-progress"><div style="width:${progress}%"></div></div></div></td>`,
        debut:`<td>${dt(p.dateDebut)}</td>`,
        fin:`<td>${dt(p.dateFin)}</td>`,
        meteo:`<td>${esc(weather)}</td>`
      };
      return `<tr class="${active?"selected-row":""}" data-project-id="${p.id}">
        ${PROJECT_COLUMNS.filter(c=>columnVisible(c.key)).map(c=>cells[c.key]).join("")}
        <td class="actions-col"><button class="row-open" data-project-open="${p.id}" title="Ouvrir la fiche">›</button></td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
  $("projectListFooter").textContent=`${ps.length} élément(s)`;
  document.querySelectorAll("[data-project-open]").forEach(el=>el.onclick=e=>{
    e.stopPropagation();showProjectPage(Number(el.dataset.projectOpen));
  });
  document.querySelectorAll("#projectList tr[data-project-id]").forEach(el=>el.onclick=()=>{
    showProjectPage(Number(el.dataset.projectId));
  });
}
function bindIndicatorHelp(root=document){
  root.querySelectorAll("[data-indicator-help]").forEach(b=>{
    b.onclick=e=>{
      e.stopPropagation();
      notifyBanner(b.dataset.indicatorHelp||b.title||"");
    };
  });
}
function renderProject(){
  const p=get("projects",currentProjectId);
  if(!p){$("projectEmpty").classList.remove("hidden");$("projectDetail").classList.add("hidden");return}
  $("projectEmpty").classList.add("hidden");$("projectDetail").classList.remove("hidden");
  const ts=taskRows(p.id),cs=contribRows(p.id),as=allocRows(p.id);
  $("projectTitle").textContent=p.nom||`Projet #${p.id}`;
  $("projectTypeBadge").innerHTML=typeBadge(p);
  $("projectWeatherBadge").innerHTML=weatherBadge(p,ts);
  document.querySelectorAll(".project-only").forEach(x=>x.classList.toggle("hidden",typeOf(p)!=="projet"));
  document.querySelectorAll(".product-only").forEach(x=>x.classList.toggle("hidden",typeOf(p)!=="produit"));
  if(typeOf(p)==="produit"&&detailTab==="stages")detailTab="infos";
  $("featuresTabBtn").textContent=typeOf(p)==="produit"?"🧩 Roadmap produit":"🧩 Fonctionnalités";
  $("featuresSectionTitle").textContent=typeOf(p)==="produit"?"Roadmap produit":"Fonctionnalités du projet";
  $("featuresSectionHelp").textContent=typeOf(p)==="produit"
    ?"Le produit n’a pas d’étapes : sa roadmap est structurée par ses fonctionnalités et leurs tâches."
    :"Les fonctionnalités sont transverses au planning par étapes. Une tâche projet peut appartenir à une étape et, facultativement, à une fonctionnalité.";
  const resp=get("team",id(p.responsable));
  $("projectMeta").textContent=[p.code,p.statut,resp?.nom?`Responsable : ${resp.nom}`:null].filter(Boolean).join(" • ");
  
  strategy(cs);team(ts,as);gantt(ts);resourceLoad(ts,as);tasks(ts);projectStagesView(p,ts);productFeaturesView(p,ts);releasesView(p);renderSynthesis(p,ts,cs,as);
  switchDetailTab(detailTab,false);
}








function weatherBadge(p,ts){
  const raw=String(p.Meteo_Projet||p.Météo_Projet||"").trim();
  let label=raw,cls="neutral";
  if(raw){
    if(/rouge|red/i.test(raw))cls="red";
    else if(/orange|amber/i.test(raw))cls="orange";
    else if(/vert|green/i.test(raw))cls="green";
  }else{
    const overdue=ts.filter(late);
    const critical=overdue.filter(t=>/haute|critique|high/i.test(String(t.priorite||"")));
    if(critical.length){label="🔴 Rouge";cls="red"}
    else if(overdue.length||/haut|élev|critique|high/i.test(String(p.risque||""))){label="🟠 Orange";cls="orange"}
    else{label="🟢 Vert";cls="green"}
  }
  return `<span class="weather-badge ${cls}" title="${esc(p.Motif_Meteo||p.Motif_Météo||"")}">${esc(label||"Météo")}</span>`;
}

function renderSynthesis(p,ts,cs,as){
  const externalDeps=externalDependenciesForProject(p.id);
  const lateExternalDeps=externalDeps.filter(x=>late(x.dependency));
  const active=ts.filter(t=>!done(t.statut)).length;
  const overdue=ts.filter(late);
  const criticalLate=overdue.filter(t=>/haute|critique|high/i.test(String(t.priorite||"")));
  const milestones=ts.filter(t=>/jalon/i.test(String(t.type||"")));
  const nextDue=[...ts].filter(t=>!done(t.statut)&&dms(t.dateEcheance)).sort((a,b)=>dms(a.dateEcheance)-dms(b.dateEcheance))[0];
  const est=ts.reduce((n,t)=>n+Number(t.estimationH||0),0);
  const spent=ts.reduce((n,t)=>n+Number(t.tempsPasse||0),0);
  const allocTotal=as.reduce((n,a)=>n+Number(a.Allocation||0),0);
  const a=get("activities",id(p.activite));
  const ao=a?get("activityOffers",id(a.Service_Code)):null;
  const offer=ao?get("offers",id(ao.OFS_Code)):null;
  const stagePlans=typeOf(p)==="projet"?projectStagePlanRows(p.id).filter(x=>x.Actif!==false):[];
  const stagePlanningLate=stagePlans.filter(x=>/retard/i.test(String(x.Alerte_Planning||"")));
  const stagePlanningAttention=stagePlans.filter(x=>/attention/i.test(String(x.Alerte_Planning||"")));
  const stageCalcStarts=stagePlans.map(x=>dms(x.Date_Debut_Calculee)).filter(Boolean);
  const stageCalcEnds=stagePlans.map(x=>dms(x.Date_Fin_Calculee)).filter(Boolean);
  const releaseDateIssues=releaseRowsForProject(p.id)
    .map(r=>({release:r,planning:releasePlanningFromGrist(r)}))
    .filter(x=>/retard|incohérent|non planifié|sans fonctionnalités/i.test(String(x.planning.alert||"")));

  $("summaryMain").innerHTML=`<div class="kv">
    <div class="key">Météo ${indicatorHelp("Si Meteo_Projet est renseignée, cette valeur est utilisée. Sinon : Rouge si une tâche en retard est de priorité haute/critique ; Orange s’il existe une tâche en retard ou un risque projet haut/élevé/critique ; Vert sinon.")}</div><div class="value">${weatherBadge(p,ts)}</div>
    <div class="key">Type</div><div class="value">${typeOf(p)==="produit"?"Produit":"Projet"}</div><div class="key">Nature</div><div class="value">${esc(p.Nature_Projet||"—")}</div>
    <div class="key">Statut</div><div class="value">${esc(p.statut||"—")}</div>
    <div class="key">Priorité</div><div class="value">${esc(p.priorite||"—")}</div>
    <div class="key">Avancement ${indicatorHelp("Valeur de progression du projet enregistrée dans Grist, normalisée en pourcentage entre 0 et 100.")}</div><div class="value">${pct(p.progression)}%</div>
    <div class="key">Tâches actives ${indicatorHelp("Nombre de tâches du projet dont le statut n’est pas considéré comme terminé.")}</div><div class="value">${active}</div>
    <div class="key">Jalons ${indicatorHelp("Nombre de tâches du projet dont le type contient « jalon ».")}</div><div class="value">${milestones.length}</div>
  </div>`;

  let alerts=[];
  if(criticalLate.length) alerts.push(`🔴 ${criticalLate.length} tâche(s) critique(s) ou haute priorité en retard`);
  else if(overdue.length) alerts.push(`🟠 ${overdue.length} tâche(s) en retard`);
  if(/haut|élev|critique|high/i.test(String(p.risque||""))) alerts.push(`🟠 Risque projet : ${p.risque}`);
  if(as.some(a=>Number(a.Allocation||0)>1)) alerts.push("🟠 Allocation ressource supérieure à 100%");
  if(ts.some(t=>!refs(t.assignees).length)) alerts.push("🟡 Certaines tâches ne sont pas assignées");
  if(stagePlanningLate.length) alerts.push(`🔴 ${stagePlanningLate.length} étape(s) dépassent leur fin planifiée`);
  else if(stagePlanningAttention.length) alerts.push(`🟠 ${stagePlanningAttention.length} étape(s) de planning à surveiller`);
  if(releaseDateIssues.length) alerts.push(`🟠 ${releaseDateIssues.length} release(s) ont des dates incohérentes avec leurs fonctionnalités`);
  $("summaryAlerts").innerHTML=alerts.length
    ? `<div class="alert-list">${alerts.map(x=>`<div class="alert-item warn">${esc(x)}</div>`).join("")}</div>`
    : `<div class="alert-item ok">🟢 Aucune alerte majeure</div>`;

  $("summaryAlerts").innerHTML += `<div class="dependency-summary">
    <div class="summary-line"><span>Dépendances inter-projets</span><strong>${externalDeps.length}</strong></div>
    <div class="summary-line"><span>Externes en retard</span><strong class="${lateExternalDeps.length?'bad':''}">${lateExternalDeps.length}</strong></div>
    ${externalDeps.length?`<div class="dependency-list">${externalDeps.slice(0,6).map(x=>`<div class="dependency-row"><span><strong>${esc(x.task.titre||"")}</strong><br><span class="muted">dépend de ${esc(taskDependencyLabel(x.dependency))}</span></span>${late(x.dependency)?'<span class="dependency-alert">En retard</span>':'<span class="dependency-ok">OK</span>'}</div>`).join("")}</div>`:""}
  </div>`;

  $("summaryDates").innerHTML=`<div class="kv">
    <div class="key">Début planifié projet ${indicatorHelp("Date de début globale du projet saisie dans Projects.dateDebut.")}</div><div class="value">${dt(p.dateDebut)}</div>
    <div class="key">Fin planifiée projet ${indicatorHelp("Date de fin globale du projet saisie dans Projects.dateFin.")}</div><div class="value">${dt(p.dateFin)}</div>
    ${typeOf(p)==="projet"?`<div class="key">Début calculé étapes ${indicatorHelp("Minimum des Date_Debut_Calculee des étapes actives du projet.")}</div><div class="value">${stageCalcStarts.length?dt(Math.min(...stageCalcStarts)):"—"}</div>
    <div class="key">Fin calculée étapes ${indicatorHelp("Maximum des Date_Fin_Calculee des étapes actives du projet.")}</div><div class="value">${stageCalcEnds.length?dt(Math.max(...stageCalcEnds)):"—"}</div>
    <div class="key">Étapes en alerte ${indicatorHelp("Somme des étapes dont Alerte_Planning vaut Retard ou Attention.")}</div><div class="value">${stagePlanningLate.length+stagePlanningAttention.length}</div>`:""}
    <div class="key">Prochaine échéance</div><div class="value">${nextDue?`${esc(nextDue.titre||"")} — ${dt(nextDue.dateEcheance)}`:"—"}</div>
    <div class="key">Charge passée ${indicatorHelp("Somme de tempsPasse de toutes les tâches du projet.")}</div><div class="value">${Math.round(spent)} h</div>
    <div class="key">Charge estimée ${indicatorHelp("Somme de estimationH de toutes les tâches du projet.")}</div><div class="value">${Math.round(est)} h</div>
  </div>`;

  const objNames=cs.map(c=>get("objectives",id(c.Objectif_Libelle)||id(c.Objectif_Code2))?.Nom).filter(Boolean);
  $("summaryStrategy").innerHTML=`<div><strong>${cs.length} objectif(s) stratégique(s)</strong></div><div class="muted" style="margin-top:8px">${esc(objNames.slice(0,3).join(" • ")||"Aucun objectif associé")}</div>`;

  $("summaryBusiness").innerHTML=`<div class="kv">
    <div class="key">Offre</div><div class="value">${esc(offer?.Nom||"—")}</div>
    <div class="key">Activité OFS</div><div class="value">${esc(ao?.Activites_Nom||"—")}</div>
    <div class="key">Activité</div><div class="value">${esc(a?.Nom||"—")}</div>
  </div>`;


  const featureCount=featureRowsForProject(p.id).length;const releaseCount=releaseRowsForProject(p.id).length;
  $("summaryFeatures").innerHTML=`<div><strong>${releaseCount} release(s)</strong></div>`+(typeOf(p)==="produit"
    ?`<strong>${featureCount} fonctionnalité(s)</strong><div class="muted" style="margin-top:6px">La roadmap produit se construit à partir des fonctionnalités.</div>`
    :`<strong>${featureCount} fonctionnalité(s)</strong><div class="muted" style="margin-top:6px">Elles peuvent être reliées aux tâches du planning projet.</div>`);

  $("summaryResources").innerHTML=`<div class="kv">
    <div class="key">Allocations ${indicatorHelp("Nombre de lignes d’allocation rattachées au projet.")}</div><div class="value">${as.length}</div><div class="project-allocation-shortcut"><button type="button" class="primary small" id="projectAddAllocationBtn">+ Affecter une ressource</button></div>
    <div class="key">Allocation cumulée ${indicatorHelp("Somme de la colonne Allocation des lignes du projet, affichée en pourcentage. Plusieurs ressources peuvent donc conduire à une valeur supérieure à 100 %.")}</div><div class="value">${Math.round(allocTotal*100)}%</div>
    <div class="key">Ressources actives ${indicatorHelp("Nombre de ressources distinctes présentes dans les allocations du projet.")}</div><div class="value">${new Set(as.map(a=>id(a.Ressource_Code)).filter(Boolean)).size}</div>
  </div>`;

  let nextText="Aucune attention particulière.";
  if(criticalLate.length) nextText=`Traiter en priorité ${criticalLate.length} tâche(s) critique(s) en retard.`;
  else if(overdue.length) nextText=`Résorber les ${overdue.length} tâche(s) en retard.`;
  else if(nextDue) nextText=`Sécuriser la prochaine échéance : ${nextDue.titre} (${dt(nextDue.dateEcheance)}).`;
  else if(cs.length===0) nextText="Associer au moins un objectif stratégique au projet.";
  $("summaryNext").innerHTML=`<div>${esc(nextText)}</div>`;
  bindIndicatorHelp($("detailInfos"));
}

function switchDetailTab(tab,rerender=true){
  detailTab=tab;
  document.querySelectorAll("[data-detail-tab]").forEach(b=>b.classList.toggle("active",b.dataset.detailTab===tab));
  const map={tasks:"detailTasks",stages:"detailStages",features:"detailFeatures",releases:"detailReleases",objectives:"detailObjectives",resources:"detailResources",infos:"detailInfos"};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle("hidden",k!==tab));
  if(rerender&&tab==="tasks")gantt(taskRows(currentProjectId));
}
function kpi(l,v,s=""){return`<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${s}</div></div>`}
function bar(v){return`<div class="progress"><div style="width:${v}%"></div></div>`}

function strategy(cs){
  $("objectiveCount").textContent=`${cs.length} contribution${cs.length>1?"s":""}`;
  if(!cs.length){$("strategy").innerHTML='<div class="empty">Aucun objectif rattaché.</div>';return}
  $("strategy").innerHTML=`<table><thead><tr><th>Axe</th><th>Objectif</th><th>Contribution</th><th>Échéance</th><th></th></tr></thead><tbody>${cs.map(c=>{const oid=id(c.Objectif_Libelle)||id(c.Objectif_Code2);const o=get("objectives",oid),a=o?get("axes",id(o.Axe_Code)):null;return`<tr><td>${esc(a?.Nom||"—")}</td><td><strong>${esc(o?.Nom||"—")}</strong><br><span class="muted">${esc(o?.KPI||"")}</span></td><td>${pct(c.Contributions_Objectifs)}%</td><td>${dt(o?.Echeance)}</td><td><button class="danger" data-rmcontrib="${c.id}">Retirer</button></td></tr>`}).join("")}</tbody></table>`;
  document.querySelectorAll("[data-rmcontrib]").forEach(b=>b.onclick=()=>removeContribution(Number(b.dataset.rmcontrib)))
}

function team(ts,as){
  const ids=new Set();ts.forEach(t=>refs(t.assignees).forEach(x=>ids.add(x)));as.forEach(a=>{const x=id(a.Ressource_Code);if(x)ids.add(x)});
  if(!ids.size){$("team").innerHTML='<div class="empty">Aucune ressource affectée.</div>';return}
  $("team").innerHTML=[...ids].map(x=>{const m=get("team",x),alloc=as.filter(a=>id(a.Ressource_Code)===x).reduce((n,a)=>n+Number(a.Allocation||0),0);return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f1f3"><div><strong>${esc(m?.nom||`#${x}`)}</strong><div class="muted">${esc(m?.role||"")} • capacité ${m?.capacite_ETP??"—"} ETP</div></div><span>${alloc?pct(alloc)+"%":""}</span></div>`}).join("")
}

function gantt(ts){
  const ds=ts.map(t=>({t,s:dms(t.dateDebut),e:dms(t.dateEcheance)})).filter(x=>x.s||x.e);if(!ds.length){$("gantt").innerHTML='<div class="empty">Aucune tâche datée.</div>';return}
  ds.forEach(x=>{if(!x.s)x.s=x.e;if(!x.e)x.e=x.s});let mn=Math.min(...ds.map(x=>x.s)),mx=Math.max(...ds.map(x=>x.e));if(mx<=mn)mx=mn+86400000;const pad=Math.max((mx-mn)*.04,86400000*2);mn-=pad;mx+=pad;const span=mx-mn,today=(Date.now()-mn)/span*100;
  $("gantt").innerHTML=`<div class="gantt-wrap"><div class="gantt"><div class="gantt-axis"><div></div><div class="gantt-months"><span>${dt(mn)}</span><span>${dt((mn+mx)/2)}</span><span>${dt(mx)}</span></div></div>${ds.sort((a,b)=>a.s-b.s).map(({t,s,e})=>{const left=(s-mn)/span*100,w=Math.max(.8,(e-s)/span*100),mil=/jalon/i.test(String(t.type||""));return`<div class="gantt-row"><div class="gantt-label">${esc(t.titre||"Sans titre")}<span class="subtle">${esc(t.statut||"")}</span></div><div class="gantt-track">${today>=0&&today<=100?`<div class="gantt-today" style="left:${today}%"></div>`:""}<div class="gantt-bar ${mil?"milestone":""}" style="left:${left}%;width:${w}%">${!mil?`<div class="gantt-progress" style="width:${pct(t.progression)}%"></div>`:""}</div></div></div>`}).join("")}</div></div>`
}

function resourceLoad(ts,as){
  const map=new Map();for(const m of db.team)map.set(m.id,{m,alloc:0,est:0,spent:0,tasks:0});
  for(const a of as){const mid=id(a.Ressource_Code);if(!mid)continue;if(!map.has(mid))map.set(mid,{m:get("team",mid)||{id:mid,nom:`#${mid}`},alloc:0,est:0,spent:0,tasks:0});map.get(mid).alloc+=Number(a.Allocation||0)}
  for(const t of ts){const mids=refs(t.assignees);if(!mids.length)continue;const share=1/mids.length;for(const mid of mids){if(!map.has(mid))map.set(mid,{m:get("team",mid)||{id:mid,nom:`#${mid}`},alloc:0,est:0,spent:0,tasks:0});const x=map.get(mid);x.est+=Number(t.estimationH||0)*share;x.spent+=Number(t.tempsPasse||0)*share;x.tasks++}}
  const xs=[...map.values()].filter(x=>x.alloc||x.tasks);if(!xs.length){$("resourceLoad").innerHTML='<div class="empty">Aucune donnée de charge.</div>';return}
  $("resourceLoad").innerHTML=`<div class="resource-row header"><div>Ressource</div><div>Allocation</div><div>Estimé</div><div>Passé</div></div>${xs.map(x=>{const ap=Math.round(x.alloc*100);return`<div class="resource-row"><div><strong>${esc(x.m?.nom||"#")}</strong><div class="muted">${x.tasks} tâche(s)</div></div><div><div class="load-track"><div class="load-fill ${ap>100?"over":""}" style="width:${Math.min(100,ap)}%"></div></div><div class="muted">${ap}%</div></div><div>${Math.round(x.est*10)/10} h</div><div>${Math.round(x.spent*10)/10} h</div></div>`}).join("")}`;
}

function tasks(ts){
  let f=ts;if(taskFilter==="jalon")f=ts.filter(t=>/jalon/i.test(String(t.type||"")));if(taskFilter==="late")f=ts.filter(late);
  if(!f.length){$("tasks").innerHTML='<div class="empty">Aucune tâche.</div>';return}
  $("tasks").innerHTML=`<table><thead><tr><th>Code</th><th>Titre</th><th>Type</th><th>Statut</th><th>Progression</th><th>Charge</th><th>Assignés</th><th></th></tr></thead><tbody>${f.map(t=>`<tr><td>${esc(t.Code||"")}</td><td><strong>${esc(t.titre||"")}</strong></td><td>${esc(t.type||"")}</td><td>${esc(t.statut||"")}</td><td>${pct(t.progression)}%</td><td>${Number(t.tempsPasse||0)}h / ${Number(t.estimationH||0)}h</td><td>${refs(t.assignees).map(x=>esc(get("team",x)?.nom||`#${x}`)).join(", ")}</td><td class="task-actions"><button data-edit="${t.id}">Modifier</button><button class="danger" data-del="${t.id}">Supprimer</button></td></tr>`).join("")}</tbody></table>`;
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openTask(Number(b.dataset.edit)));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteTask(Number(b.dataset.del)))
}

/* ---------- Offre de services ---------- */

function projectStagePlanRows(projectId){
  return (db.projectStagePlans||[]).filter(r=>id(r.Projet)===Number(projectId));
}
function projectStagePlanFor(projectId,stageId){
  return projectStagePlanRows(projectId).find(r=>id(r.Etape)===Number(stageId))||null;
}
function planningAlertClass(v){
  const s=String(v||"").toLowerCase();
  if(s.includes("retard"))return "red";
  if(s.includes("attention"))return "orange";
  if(s.includes("ok"))return "green";
  return "neutral";
}
function planningDelta(v){
  if(v===null||v===undefined||v==="")return "—";
  const n=Number(v);
  if(!Number.isFinite(n))return esc(v);
  if(n===0)return "0 j";
  return `${n>0?"+":""}${Math.round(n)} j`;
}
function projectFeatureRowsForStage(projectId,stageId){
  return featureRowsForProject(projectId).filter(f=>featureProjectStageId(f)===Number(stageId));
}
function openProjectStagePlan(stageId){
  const p=get("projects",currentProjectId),stage=get("projectStages",stageId);
  if(!p||!stage)return;
  const row=projectStagePlanFor(p.id,stageId);
  const f=$("projectStagePlanForm");
  f.reset();
  f.elements.record_id.value=row?.id||"";
  f.elements.project_id.value=p.id;
  f.elements.stage_id.value=stageId;
  f.Date_Debut_Planifiee.value=din(row?.Date_Debut_Planifiee);
  f.Date_Fin_Planifiee.value=din(row?.Date_Fin_Planifiee);
  f.Actif.value=String(row?.Actif!==false);
  $("projectStagePlanDialogTitle").textContent=row?"Modifier le planning de l’étape":"Planifier l’étape";
  $("projectStagePlanDialogMeta").textContent=`${p.nom||p.code||"Projet"} • ${stage.Nom||stage.Code||"Étape"}`;
  $("projectStagePlanPreview").innerHTML=row?`<div class="planning-preview-grid">
    <span><small>Début calculé</small><b>${dt(row.Date_Debut_Calculee)}</b></span>
    <span><small>Fin calculée</small><b>${dt(row.Date_Fin_Calculee)}</b></span>
    <span><small>Écart début</small><b>${planningDelta(row.Ecart_Debut)}</b></span>
    <span><small>Écart fin</small><b>${planningDelta(row.Ecart_Fin)}</b></span>
  </div>`:'<div class="muted">Les dates calculées seront alimentées automatiquement par Grist à partir des fonctionnalités de cette étape.</div>';
  $("projectStagePlanDialog").showModal();
}
$("projectStagePlanForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const rid=Number(f.elements.record_id.value)||null;
  const fields={
    Projet:Number(f.elements.project_id.value),
    Etape:Number(f.elements.stage_id.value),
    Date_Debut_Planifiee:gd(f.Date_Debut_Planifiee.value),
    Date_Fin_Planifiee:gd(f.Date_Fin_Planifiee.value),
    Actif:f.Actif.value==="true"
  };
  const action=rid?["UpdateRecord","Projet_Etapes",rid,fields]:["AddRecord","Projet_Etapes",null,fields];
  const ok=await apply([action],rid?"Planning de l’étape mis à jour.":"Étape planifiée.");
  if(ok){$("projectStagePlanDialog").close();projectStagesView(get("projects",currentProjectId),taskRows(currentProjectId));renderSynthesis(get("projects",currentProjectId),taskRows(currentProjectId),contribRows(currentProjectId),allocRows(currentProjectId))}
};

function projectStagesView(p,ts){
  if(typeOf(p)!=="projet"){
    $("projectStagesView").innerHTML='<div class="empty">Cette vue concerne les projets.</div>';
    return
  }
  const stages=[...(db.projectStages||[])].filter(s=>s.Actif!==false).sort((a,b)=>Number(a.Ordre||0)-Number(b.Ordre||0));
  const plans=projectStagePlanRows(p.id);
  const current=id(p.etape_courante);

  if(tableLoadErrors.projectStagePlans){
    $("projectStagesView").innerHTML=`<div class="alert-item warn"><strong>Table Projet_Etapes inaccessible.</strong><br>${esc(tableLoadErrors.projectStagePlans)}</div>`;
    return
  }
  if(!stages.length){
    $("projectStagesView").innerHTML='<div class="empty">Aucune étape dans Etapes_Projet.</div>';
    return
  }

  const planned=plans.filter(x=>x.Actif!==false);
  const delays=planned.filter(x=>/retard/i.test(String(x.Alerte_Planning||""))).length;
  const attentions=planned.filter(x=>/attention/i.test(String(x.Alerte_Planning||""))).length;
  const calcStarts=planned.map(x=>dms(x.Date_Debut_Calculee)).filter(Boolean);
  const calcEnds=planned.map(x=>dms(x.Date_Fin_Calculee)).filter(Boolean);

  $("projectStagesView").innerHTML=`
    <div class="planning-project-summary">
      <div><small>Étapes planifiées ${indicatorHelp("Nombre d’étapes Projet_Etapes actives pour lesquelles un planning existe, rapporté au nombre total d’étapes actives du référentiel Etapes_Projet.")}</small><strong>${planned.length}/${stages.length}</strong></div>
      <div><small>En retard ${indicatorHelp("Nombre d’étapes dont Alerte_Planning contient « Retard ». Cette alerte est calculée dans Grist à partir des dates planifiées, des dates calculées et des écarts.")}</small><strong class="${delays?"bad":""}">${delays}</strong></div>
      <div><small>À surveiller ${indicatorHelp("Nombre d’étapes dont Alerte_Planning contient « Attention ». Dans le modèle actuel, cela correspond notamment à un démarrage calculé après le début planifié sans dépassement de la fin planifiée.")}</small><strong class="${attentions?"warn-text":""}">${attentions}</strong></div>
      <div><small>Enveloppe calculée ${indicatorHelp("Début = date calculée la plus ancienne des étapes du projet. Fin = date calculée la plus tardive. Les dates calculées de chaque étape proviennent elles-mêmes du MIN(Date_Debut) et MAX(Date_Fin) de ses fonctionnalités.")}</small><strong>${calcStarts.length?dt(Math.min(...calcStarts)):"—"} → ${calcEnds.length?dt(Math.max(...calcEnds)):"—"}</strong></div>
    </div>
    <div class="lifecycle">${stages.map(stage=>{
      const plan=projectStagePlanFor(p.id,stage.id);
      const cls=stage.id===current?"current":planningAlertClass(plan?.Alerte_Planning);
      return `<span class="stage-pill ${cls}" title="${esc(plan?.Alerte_Planning||"Non planifié")}">${esc(stage.Nom||stage.Code||"")}</span>`;
    }).join("")}</div>
    <div class="project-stage-plan-list">
      ${stages.map(stage=>{
        const plan=projectStagePlanFor(p.id,stage.id);
        const tasksForStage=ts.filter(t=>id(t.etape_projet)===stage.id);
        const features=projectFeatureRowsForStage(p.id,stage.id);
        const alert=plan?.Alerte_Planning||"Non planifié";
        const avg=features.length?Math.round(features.reduce((n,f)=>n+pct(f.Progression),0)/features.length):0;
        return `<article class="project-stage-plan ${planningAlertClass(alert)}">
          <div class="project-stage-plan-head">
            <div class="project-stage-title">
              <span class="project-stage-order">${stage.Ordre??"•"}</span>
              <div><h4>${esc(stage.Nom||stage.Code||"Étape")}</h4><div class="muted">${features.length} fonctionnalité(s) • ${tasksForStage.length} tâche(s) • ${avg}% d’avancement fonctionnel ${indicatorHelp("Moyenne arithmétique de Progression des fonctionnalités rattachées à cette étape. Chaque progression est normalisée en pourcentage entre 0 et 100.")}</div></div>
            </div>
            <div class="project-stage-actions">
              <span class="planning-alert ${planningAlertClass(alert)}">${esc(alert)}</span>
              <button class="primary-outline" data-plan-stage="${stage.id}">${plan?"Modifier planning":"Planifier"}</button>
              <button class="primary-outline" data-add-stage-task="${stage.id}">+ Tâche</button>
            </div>
          </div>
          <div class="project-stage-dates">
            <div class="stage-date-block planned"><small>Planifié ${indicatorHelp("Dates de référence saisies manuellement dans Projet_Etapes : Date_Debut_Planifiee et Date_Fin_Planifiee.")}</small><b>${dt(plan?.Date_Debut_Planifiee)} → ${dt(plan?.Date_Fin_Planifiee)}</b></div>
            <div class="stage-date-block calculated"><small>Calculé depuis les fonctionnalités ${indicatorHelp("Date de début calculée = MIN(Date_Debut) des fonctionnalités du même projet et de cette étape. Date de fin calculée = MAX(Date_Fin) de ces fonctionnalités.")}</small><b>${dt(plan?.Date_Debut_Calculee)} → ${dt(plan?.Date_Fin_Calculee)}</b></div>
            <div class="stage-date-block delta"><small>Écarts ${indicatorHelp("Écart début = Date_Debut_Calculee − Date_Debut_Planifiee. Écart fin = Date_Fin_Calculee − Date_Fin_Planifiee. Valeur positive = retard/dépassement ; négative = avance.")}</small><b>Début ${planningDelta(plan?.Ecart_Debut)} • Fin ${planningDelta(plan?.Ecart_Fin)}</b></div>
          </div>
          ${features.length?`<div class="stage-features">
            ${features.map(f=>`<button class="stage-feature-chip" data-feature-edit="${f.id}" title="Modifier la fonctionnalité">${esc(f.Nom||"Fonctionnalité")} <small>${dt(f.Date_Debut)} → ${dt(f.Date_Fin)}</small></button>`).join("")}
          </div>`:'<div class="muted stage-no-features">Aucune fonctionnalité rattachée à cette étape.</div>'}
          ${tasksForStage.length?`<details class="stage-task-details"><summary>${tasksForStage.length} tâche(s) de l’étape</summary>
            <table><thead><tr><th>Tâche</th><th>Fonctionnalité</th><th>Statut</th><th>Début</th><th>Échéance</th><th>Avancement</th><th></th></tr></thead>
            <tbody>${tasksForStage.map(t=>`<tr><td>${esc(t.titre||"")}</td><td>${esc(get("features",id(t.fonctionnalite))?.Nom||"—")}</td><td>${esc(t.statut||"")}</td><td>${dt(t.dateDebut)}</td><td>${dt(t.dateEcheance)}</td><td>${pct(t.progression)}%</td><td><button data-stage-edit-task="${t.id}">Modifier</button></td></tr>`).join("")}</tbody></table>
          </details>`:""}
        </article>`;
      }).join("")}
    </div>`;

  document.querySelectorAll("[data-plan-stage]").forEach(b=>b.onclick=()=>openProjectStagePlan(Number(b.dataset.planStage)));
  document.querySelectorAll("[data-add-stage-task]").forEach(b=>b.onclick=()=>openTask(null,{stageId:Number(b.dataset.addStageTask)}));
  document.querySelectorAll("[data-stage-edit-task]").forEach(b=>b.onclick=()=>openTask(Number(b.dataset.stageEditTask)));
  document.querySelectorAll("#projectStagesView [data-feature-edit]").forEach(b=>b.onclick=()=>openFeature(Number(b.dataset.featureEdit)));
  bindIndicatorHelp($("projectStagesView"));
}

function refIdAny(v){
  if(v===null||v===undefined||v==="")return null;
  if(typeof v==="number"&&Number.isFinite(v))return Number(v);
  if(typeof v==="string"){
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  }
  if(Array.isArray(v)){
    // Grist peut exposer une Ref sous la forme ["R", id].
    for(const x of v){
      if(typeof x==="number"&&Number.isFinite(x))return Number(x);
      if(typeof x==="string"&&/^\d+$/.test(x))return Number(x);
    }
    return null;
  }
  if(typeof v==="object"){
    const n=Number(v.id??v.rowId??v.value);
    return Number.isFinite(n)?n:null;
  }
  return null;
}
function featureParentRaw(f){
  if(!f)return null;
  const aliases=["parent","projet_produit","produit","project","projet"];
  for(const [k,v] of Object.entries(f)){
    if(aliases.includes(String(k).toLowerCase()))return v;
  }
  return null;
}
function featureParentId(f){
  return refIdAny(featureParentRaw(f));
}
function featureRowsForProject(pid){
  const wanted=Number(pid);
  const project=db.projects.find(p=>Number(p.id)===wanted);
  const labels=new Set(
    [project?.nom,project?.Nom,project?.code,project?.Code]
      .filter(Boolean)
      .map(v=>String(v).trim().toLowerCase())
  );

  return (db.features||[]).filter(f=>{
    // 1. Cas normal : référence Grist vers Projects.
    if(featureParentId(f)===wanted)return true;

    // 2. Ancienne donnée/import : valeur affichée au lieu de l'ID.
    const raw=featureParentRaw(f);
    if(typeof raw==="string"&&labels.has(raw.trim().toLowerCase()))return true;

    // 3. Certains exports DocAPI peuvent ne laisser que le helper d'affichage.
    for(const [k,v] of Object.entries(f)){
      if(/^gristHelper_Display/i.test(k) && typeof v==="string" && labels.has(v.trim().toLowerCase()))return true;
    }
    return false;
  });
}
function featureParentField(){
  const s=db.features[0]||{};
  if("Parent" in s)return "Parent";
  if("parent" in s)return "parent";
  if("projet_produit" in s)return "projet_produit";
  if("produit" in s)return "produit";
  return "Parent";
}

function releaseParentId(r){
  return id(r.Parent)||id(r.parent)||id(r.projet_produit)||id(r.produit)||id(r.projet)||id(r.Project)||id(r.Projet);
}
function releaseRowsForProject(pid){
  return db.releases.filter(r=>releaseParentId(r)===Number(pid));
}
function releaseParentField(){
  const s=db.releases[0]||{};
  if("Parent" in s)return "Parent";
  if("parent" in s)return "parent";
  if("projet_produit" in s)return "projet_produit";
  if("produit" in s)return "produit";
  if("projet" in s)return "projet";
  return "Parent";
}
function releaseFeatureRows(releaseId){
  return db.releaseFeatures.filter(r=>id(r.release)===Number(releaseId));
}
function releaseFeatureIds(releaseId){
  return releaseFeatureRows(releaseId).map(r=>id(r.fonctionnalite)).filter(Boolean);
}
function releaseProgress(releaseId){
  const ids=releaseFeatureIds(releaseId), fs=ids.map(fid=>get("features",fid)).filter(Boolean);
  return fs.length?Math.round(fs.reduce((n,f)=>n+pct(f.Progression),0)/fs.length):0;
}
function releasePlanningFromGrist(r){
  const features=releaseFeatureIds(r.id).map(fid=>get("features",fid)).filter(Boolean);
  const plannedStart=dms(r.Date_Debut||r.dateDebut);
  const plannedEnd=dms(r.Date_Fin||r.dateFin);
  const calcStart=dms(r.Date_Debut_Calculee);
  const calcEnd=dms(r.Date_Fin_Calculee);
  const alert=String(r.Alerte_Planning||"").trim()||"Non calculé";
  const issues=[];

  if(plannedStart&&plannedEnd&&plannedStart>plannedEnd){
    issues.push("La date de début de la release est postérieure à sa date de fin.");
  }
  if(/incohérent début/i.test(alert)){
    issues.push("Au moins une fonctionnalité commence avant le début planifié de la release.");
  }
  if(/retard/i.test(alert)){
    issues.push("Au moins une fonctionnalité se termine après la fin planifiée de la release.");
  }
  if(/sans fonctionnalités/i.test(alert)){
    issues.push("Aucune fonctionnalité datée ne permet de calculer l’enveloppe de la release.");
  }
  if(/non planifié/i.test(alert)){
    issues.push("Les dates planifiées de la release sont incomplètes.");
  }

  return {
    features,
    plannedStart,
    plannedEnd,
    calcStart,
    calcEnd,
    startDelta:r.Ecart_Debut,
    endDelta:r.Ecart_Fin,
    alert,
    issues
  };
}
function releasesView(p){
  const rs=releaseRowsForProject(p.id);
  const host=$("releasesView");
  if(!rs.length){
    host.innerHTML='<div class="empty">Aucune release pour ce projet / produit.</div>';
    return;
  }

  host.innerHTML=`<div class="release-list">${rs.map(r=>{
    const linked=releaseFeatureIds(r.id);
    const planning=releasePlanningFromGrist(r);
    const alertClass=planningAlertClass(planning.alert);

    return `<article class="release-card release-date-${alertClass}">
      <div class="release-head">
        <div>
          <h4>${esc(r.Nom||r.Code||`Release #${r.id}`)}</h4>
          <div class="muted">${linked.length} fonctionnalité(s)</div>
        </div>
        <div class="release-actions">
          <span class="planning-alert ${alertClass}">${esc(planning.alert)}</span>
          <button data-release-features="${r.id}">Fonctionnalités</button>
          <button data-release-edit="${r.id}">Modifier</button>
          <button class="danger" data-release-del="${r.id}">Supprimer</button>
        </div>
      </div>

      <div class="release-date-grid">
        <div>
          <small>Planifié ${indicatorHelp("Dates saisies sur la release : Date_Debut et Date_Fin.")}</small>
          <b>${dt(r.Date_Debut||r.dateDebut)} → ${dt(r.Date_Fin||r.dateFin)}</b>
        </div>
        <div>
          <small>Calculé dans Grist ${indicatorHelp("Date_Debut_Calculee = MIN(Date_Debut) des fonctionnalités rattachées. Date_Fin_Calculee = MAX(Date_Fin). Ces valeurs sont calculées dans Grist.")}</small>
          <b>${dt(r.Date_Debut_Calculee)} → ${dt(r.Date_Fin_Calculee)}</b>
        </div>
        <div>
          <small>Écarts ${indicatorHelp("Ecart_Debut = Date_Debut_Calculee − Date_Debut. Ecart_Fin = Date_Fin_Calculee − Date_Fin. Valeur positive = dépassement ; valeur négative = avance.")}</small>
          <b>Début ${planningDelta(r.Ecart_Debut)} • Fin ${planningDelta(r.Ecart_Fin)}</b>
        </div>
      </div>

      ${planning.issues.length?`<div class="release-date-issues">${planning.issues.map(x=>`<div>⚠ ${esc(x)}</div>`).join("")}</div>`:""}

      ${planning.features.length?`<div class="release-feature-dates">${planning.features.map(f=>{
        const fs=dms(f.Date_Debut||f.dateDebut),fe=dms(f.Date_Fin||f.dateFin);
        const outside=(fs&&planning.plannedStart&&fs<planning.plannedStart)||(fe&&planning.plannedEnd&&fe>planning.plannedEnd);
        return `<span class="${outside?"outside":""}">${esc(f.Nom||"Fonctionnalité")} <small>${fs?dt(fs):"—"} → ${fe?dt(fe):"—"}</small></span>`;
      }).join("")}</div>`:""}
    </article>`;
  }).join("")}</div>`;

  document.querySelectorAll("[data-release-features]").forEach(b=>b.onclick=()=>openReleaseFeatures(Number(b.dataset.releaseFeatures)));
  document.querySelectorAll("[data-release-edit]").forEach(b=>b.onclick=()=>openRelease(Number(b.dataset.releaseEdit)));
  document.querySelectorAll("[data-release-del]").forEach(b=>b.onclick=()=>deleteRelease(Number(b.dataset.releaseDel)));
  bindIndicatorHelp(host);
}
function productFeaturesView(p,ts){
  const fs=featureRowsForProject(p.id);
  const host=$("productFeaturesView");
  if(!fs.length){
    const loaded=(db.features||[]).length;
    host.innerHTML=(typeOf(p)==="produit"
      ?'<div class="empty">Aucune fonctionnalité rattachée à ce produit.</div>'
      :'<div class="empty">Aucune fonctionnalité rattachée à ce projet.</div>')
      +(loaded?`<div class="muted feature-diagnostic">La table Fonctionnalites contient ${loaded} ligne(s), mais aucune ne référence l’ID ${p.id} (${esc(p.nom||p.code||"")}).</div>`:"");
    return;
  }

  const val=(o,...keys)=>{for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&v!=="")return v}return ""};
  const moduleOf=f=>String(val(f,"Categ_module","Categorie_module","categ_module","categorie_module")||"Sans module");
  const stageOf=f=>{const sf=featureStageField();const st=get("featureStages",sf?id(f[sf]):null);return st?.Nom||st?.Libelle||"Sans stade"};
  const statusOf=f=>{const sf=featureStatusField();return sf?(f[sf]||"Sans statut"):"Sans statut"};
  const projectStepOf=f=>{const st=get("projectStages",featureProjectStageId(f));return st?.Nom||st?.Libelle||"Sans étape"};
  const dateOf=f=>val(f,"Date_Cible","date_cible","Date_Fin","dateFin");
  const progressOf=f=>pct(val(f,"Progression","progression"));
  const linkedTasks=f=>ts.filter(t=>id(t.fonctionnalite)===f.id);
  const relsOf=f=>releaseIdsForFeature(f.id).map(rid=>get("releases",rid)).filter(Boolean);
  const dateMs=f=>{const v=dateOf(f);if(!v)return Number.MAX_SAFE_INTEGER;const d=new Date(typeof v==="number"?v*1000:v);return Number.isNaN(d.getTime())?Number.MAX_SAFE_INTEGER:d.getTime()};
  const modules=[...new Set(fs.map(moduleOf))].sort((a,b)=>a.localeCompare(b,"fr"));
  const stages=[...new Set(fs.map(stageOf))].sort((a,b)=>a.localeCompare(b,"fr"));
  const statuses=[...new Set(fs.map(statusOf))].sort((a,b)=>a.localeCompare(b,"fr"));
  const projectSteps=[...new Set(fs.map(projectStepOf))].sort((a,b)=>a.localeCompare(b,"fr"));
  const releases=[...new Set(fs.flatMap(f=>relsOf(f).map(r=>r.Nom||r.Code).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,"fr"));

  host.innerHTML=`<div class="features-toolbar">
    <label class="features-search">⌕ <input data-f-filter="search" placeholder="Rechercher…"></label>
    <label>Module<select data-f-filter="module"><option value="">Tous</option>${modules.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
    <label>Stade<select data-f-filter="stage"><option value="">Tous</option>${stages.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
    <label>Statut<select data-f-filter="status"><option value="">Tous</option>${statuses.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
    ${typeOf(p)!=="produit"?`<label>Étape projet<select data-f-filter="projectStep"><option value="">Toutes</option>${projectSteps.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>`:""}
    <label>Release<select data-f-filter="release"><option value="">Toutes</option>${releases.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label>
    <label>Trier par<select data-f-filter="sort"><option value="dateAsc">Date cible ↑</option><option value="dateDesc">Date cible ↓</option><option value="moduleDate">Module + date</option><option value="name">Nom</option><option value="progress">Avancement ↓</option></select></label>
    <div class="features-view"><button class="active" data-f-view="list">☷ Liste</button><button data-f-view="module">▦ Par module</button></div>
  </div><div class="features-list" data-features-list></div>`;

  let view="list";
  const list=host.querySelector("[data-features-list]");
  const filter=n=>host.querySelector(`[data-f-filter="${n}"]`);

  function row(f){
    const tasks=linkedTasks(f),rels=relsOf(f),progress=progressOf(f),module=moduleOf(f),stage=stageOf(f),status=statusOf(f),projectStep=projectStepOf(f);
    const due=dateOf(f),dueMs=dateMs(f),days=dueMs===Number.MAX_SAFE_INTEGER?99999:Math.ceil((dueMs-Date.now())/86400000);
    const cls=days<0?" overdue":days<=30?" due-soon":"";
    return `<article class="feature-line${cls}">
      <button class="feature-line-name" data-feature-toggle="${f.id}">${esc(f.Nom||"Sans nom")}</button>
      <span class="feature-module">${esc(module)}</span>
      <span class="feature-cell"><small>Stade</small>${esc(stage)}</span>
      <span class="feature-cell"><small>Date cible</small><strong>${dt(due)}</strong></span>
      <span class="feature-line-progress"><span><b>${progress}%</b><small>${tasks.length} tâche${tasks.length>1?"s":""}</small></span><i><b style="width:${progress}%"></b></i></span>
      <span class="feature-cell feature-release-cell"><small>Release</small>${rels.length?rels.map(r=>`<em>${esc(r.Nom||r.Code)}</em>`).join(""):"—"}</span>
      <span class="feature-line-actions"><button class="primary-outline" data-feature-task="${f.id}">+ Tâche</button><button data-feature-edit="${f.id}">Modifier</button><button class="danger" data-feature-del="${f.id}">Supprimer</button></span>
      <div class="feature-line-detail" data-feature-detail="${f.id}">
        <div class="feature-detail-grid">
          <span><small>Statut</small><b>${esc(status)}</b></span>
          <span><small>Stade</small><b>${esc(stage)}</b></span>
          ${typeOf(p)!=="produit"?`<span><small>Étape projet</small><b>${esc(projectStep)}</b></span>`:""}
          <span><small>Module / Catégorie</small><b>${esc(module)}</b></span>
          <span><small>Date début</small><b>${dt(f.Date_Debut||f.dateDebut)}</b></span>
          <span><small>Date fin</small><b>${dt(f.Date_Fin||f.dateFin)}</b></span>
          <span><small>Date cible</small><b>${dt(due)}</b></span>
          <span><small>Avancement</small><b>${progress}%</b></span>
        </div>
        <div class="feature-detail-description">${esc(f.Description||"Aucune description.")}</div>
      </div>
    </article>`;
  }

  function rows(){
    const q=filter("search").value.trim().toLowerCase(),m=filter("module").value,st=filter("stage").value,status=filter("status").value,projectStep=filter("projectStep")?.value||"",rel=filter("release").value,sort=filter("sort").value;
    const out=fs.filter(f=>{
      const rr=relsOf(f).map(r=>r.Nom||r.Code);
      return (!q||String(f.Nom||"").toLowerCase().includes(q)||moduleOf(f).toLowerCase().includes(q))
        &&(!m||moduleOf(f)===m)&&(!st||stageOf(f)===st)&&(!status||statusOf(f)===status)&&(!projectStep||projectStepOf(f)===projectStep)&&(!rel||rr.includes(rel));
    });
    out.sort((a,b)=>sort==="dateDesc"?dateMs(b)-dateMs(a):sort==="moduleDate"?moduleOf(a).localeCompare(moduleOf(b),"fr")||dateMs(a)-dateMs(b):sort==="name"?String(a.Nom||"").localeCompare(String(b.Nom||""),"fr"):sort==="progress"?progressOf(b)-progressOf(a):dateMs(a)-dateMs(b));
    return out;
  }
  function render(){
    const rr=rows();
    if(!rr.length){list.innerHTML='<div class="empty">Aucune fonctionnalité ne correspond aux filtres.</div>';return}
    if(view==="module"){
      const groups={};rr.forEach(f=>(groups[moduleOf(f)]??=[]).push(f));
      list.innerHTML=Object.entries(groups).map(([name,items])=>`<section class="feature-module-group"><button data-feature-group><span>${esc(name)}</span><small>${items.length} fonctionnalité${items.length>1?"s":""}⌄</small></button><div>${items.map(row).join("")}</div></section>`).join("");
    }else list.innerHTML=rr.map(row).join("");
    bindRows();
  }
  function bindRows(){
    list.querySelectorAll("[data-feature-task]").forEach(b=>b.onclick=()=>openTask(null,{featureId:Number(b.dataset.featureTask)}));
    list.querySelectorAll("[data-feature-edit]").forEach(b=>b.onclick=()=>openFeature(Number(b.dataset.featureEdit)));
    list.querySelectorAll("[data-feature-del]").forEach(b=>b.onclick=()=>deleteFeature(Number(b.dataset.featureDel)));
    list.querySelectorAll("[data-feature-toggle]").forEach(b=>b.onclick=()=>list.querySelector(`[data-feature-detail="${b.dataset.featureToggle}"]`)?.classList.toggle("open"));
    list.querySelectorAll("[data-feature-group]").forEach(b=>b.onclick=()=>b.parentElement.classList.toggle("collapsed"));
  }
  host.querySelectorAll("[data-f-filter]").forEach(x=>x.addEventListener(x.tagName==="INPUT"?"input":"change",render));
  host.querySelectorAll("[data-f-view]").forEach(b=>b.onclick=()=>{view=b.dataset.fView;host.querySelectorAll("[data-f-view]").forEach(x=>x.classList.toggle("active",x===b));render()});
  render();
}

function releaseIdsForFeature(fid){
  return db.releaseFeatures.filter(x=>id(x.fonctionnalite)===Number(fid)).map(x=>id(x.release)).filter(Boolean);
}
async function syncFeatureReleases(fid,selectedReleaseIds){
  const selected=new Set((selectedReleaseIds||[]).map(Number));
  const existing=db.releaseFeatures.filter(x=>id(x.fonctionnalite)===Number(fid));
  const existingIds=new Set(existing.map(x=>id(x.release)));
  const actions=[];
  existing.filter(x=>!selected.has(id(x.release))).forEach(x=>actions.push(["RemoveRecord","Release_Fonctionnalites",x.id]));
  [...selected].filter(rid=>!existingIds.has(rid)).forEach((rid,i)=>actions.push(["AddRecord","Release_Fonctionnalites",null,{release:rid,fonctionnalite:Number(fid),Ordre:i+1}]));
  if(actions.length)await grist.docApi.applyUserActions(actions);
}
async function syncReleaseFeatures(rid,selectedFeatureIds){
  const selected=new Set((selectedFeatureIds||[]).map(Number));
  const existing=releaseFeatureRows(rid),existingIds=new Set(existing.map(x=>id(x.fonctionnalite)));
  const actions=[];
  existing.filter(x=>!selected.has(id(x.fonctionnalite))).forEach(x=>actions.push(["RemoveRecord","Release_Fonctionnalites",x.id]));
  [...selected].filter(fid=>!existingIds.has(fid)).forEach((fid,i)=>actions.push(["AddRecord","Release_Fonctionnalites",null,{release:Number(rid),fonctionnalite:fid,Ordre:i+1}]));
  if(actions.length)await grist.docApi.applyUserActions(actions);
}

/* ---------- Releases (Projet / Produit) ---------- */

function openRelease(rid=null){
  const p=get("projects",currentProjectId);if(!p){notifyBanner("Sélectionne un Projet ou un Produit.");return}
  const f=$("releaseForm"),row=rid?get("releases",rid):null;f.reset();f.id.value=rid||"";
  $("releaseDialogTitle").textContent=row?"Modifier la release":"Nouvelle release";
  if(row){
    f.Code.value=row.Code||"";f.Nom.value=row.Nom||"";allocationFormField(f,"Date_Debut").value=din(row.Date_Debut);allocationFormField(f,"Date_Fin").value=din(row.Date_Fin);
    f.Statut.value=row.Statut||"À venir";f.Objectif.value=row.Objectif||"";f.Actif.value=String(row.Actif!==false);
  }else{f.Statut.value="À venir";f.Actif.value="true"}
  opt(f.Responsable,db.team,r=>r.nom,row?id(row.Responsable):null,"— responsable —");
  fillMulti(f.Fonctionnalites,featureRowsForProject(currentProjectId),x=>x.Nom,row?releaseFeatureIds(row.id):[]);
  $("releaseDialog").showModal();
}
$("releaseForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.currentTarget,rid=Number(f.id.value)||null,p=get("projects",currentProjectId);
  const fields={Code:f.Code.value,Nom:f.Nom.value,Date_Debut:gd(allocationFormField(f,"Date_Debut").value),Date_Fin:gd(allocationFormField(f,"Date_Fin").value),Statut:f.Statut.value,Objectif:f.Objectif.value,Responsable:f.Responsable.value?Number(f.Responsable.value):null,Actif:f.Actif.value==="true"};
  fields[releaseParentField()]=currentProjectId;
  if("Type" in (db.releases[0]||{}))fields.Type=p?.Type||null;
  const selected=[...f.Fonctionnalites.selectedOptions].map(o=>Number(o.value));
  $("releaseDialog").close();

  if(rid){
    await apply([["UpdateRecord","Releases",rid,fields]],"Release mise à jour.");
    await load();
    await syncReleaseFeatures(rid,selected);
    await load();renderProject();
  }else{
    // Create first, reload to resolve generated id, then link selected features.
    await apply([["AddRecord","Releases",null,fields]],"Release créée.");
    await load();
    const created=[...db.releases].filter(r=>releaseParentId(r)===Number(currentProjectId)&&String(r.Code||"")===String(fields.Code||"")&&String(r.Nom||"")===String(fields.Nom||"")).sort((a,b)=>Number(b.id)-Number(a.id))[0];
    if(created&&selected.length){
      await syncReleaseFeatures(created.id,selected);
      await load();renderProject();
    }
  }
}
function openReleaseFeatures(rid){
  const r=get("releases",rid);if(!r)return;
  const f=$("releaseFeaturesForm");f.releaseId.value=rid;
  $("releaseFeaturesTitle").textContent=`Fonctionnalités — ${r.Nom||r.Code||"Release"}`;
  fillMulti(f.features,featureRowsForProject(currentProjectId),x=>x.Nom,releaseFeatureIds(rid));
  $("releaseFeaturesDialog").showModal();
}
$("releaseFeaturesForm").onsubmit=async e=>{
  e.preventDefault();const f=e.currentTarget,rid=Number(f.releaseId.value),selected=[...f.features.selectedOptions].map(o=>Number(o.value));
  const existing=releaseFeatureRows(rid),existingIds=new Set(existing.map(x=>id(x.fonctionnalite)));
  const selectedIds=new Set(selected),actions=[];
  existing.filter(x=>!selectedIds.has(id(x.fonctionnalite))).forEach(x=>actions.push(["RemoveRecord","Release_Fonctionnalites",x.id]));
  selected.filter(fid=>!existingIds.has(fid)).forEach((fid,i)=>actions.push(["AddRecord","Release_Fonctionnalites",null,{release:rid,fonctionnalite:fid,Ordre:i+1}]));
  $("releaseFeaturesDialog").close();
  if(actions.length)await apply(actions,"Fonctionnalités de la release mises à jour.");else notifyBanner("Aucun changement.");
}
async function deleteRelease(rid){
  const links=releaseFeatureRows(rid);
  if(!confirm(`Supprimer cette release${links.length?` et ses ${links.length} rattachement(s) de fonctionnalité`:""} ?`))return;
  const actions=links.map(x=>["RemoveRecord","Release_Fonctionnalites",x.id]);
  actions.push(["RemoveRecord","Releases",rid]);
  await apply(actions,"Release supprimée.");
}

/* ---------- Fonctionnalités (Projet / Produit) ---------- */
function featureFieldName(...aliases){
  const sample=(db.features&&db.features[0])||{};
  const entries=Object.keys(sample);
  for(const a of aliases){
    const hit=entries.find(k=>String(k).toLowerCase()===String(a).toLowerCase());
    if(hit)return hit;
  }
  return null;
}
function featureStageField(){return featureFieldName("Stade","stade")}
function featureStatusField(){return featureFieldName("Statut","statut")}
function featureProjectStageField(){return featureFieldName("Etape_Projet","etape_projet","EtapeProjet","etapeProjet")}
function featureProjectStageId(f){
  const k=featureProjectStageField();
  return k?id(f?.[k]):null;
}

function openFeature(fid=null){
  const p=get("projects",currentProjectId);if(!p){notifyBanner("Sélectionne un Projet ou un Produit.");return}
  const f=$("featureForm"),row=fid?get("features",fid):null;f.reset();f.id.value=fid||"";
  $("featureDialogTitle").textContent=row?"Modifier la fonctionnalité":"Nouvelle fonctionnalité";
  if($("featureCategModuleLabel")) $("featureCategModuleLabel").childNodes[0].nodeValue=typeOf(p)==="produit"?"Catégorie ":"Module ";
  if(row){["Code","Nom","Categ_module","Description","Priorite"].forEach(k=>{if(f[k])f[k].value=row[k]??""});f.Progression.value=pct(row.Progression);allocationFormField(f,"Date_Debut").value=din(row.Date_Debut||row.dateDebut);allocationFormField(f,"Date_Fin").value=din(row.Date_Fin||row.dateFin);f.Date_Cible.value=din(row.Date_Cible);f.Actif.value=String(row.Actif!==false)}
  else{f.Progression.value=0;f.Actif.value="true"}
  const stadeField=featureStageField();
  const statusField=featureStatusField();
  const projectStageField=featureProjectStageField();
  opt(f.stade,db.featureStages,r=>r.Nom,row&&stadeField?id(row[stadeField]):null,"— stade —");
  f.Statut.value=row&&statusField?(row[statusField]??""):"";
  const isProject=typeOf(p)!=="produit";
  $("featureProjectStageLabel").classList.toggle("hidden",!isProject);
  opt(f.Etape_Projet,db.projectStages,r=>r.Nom,row&&projectStageField?id(row[projectStageField]):null,"— étape projet —");
  if(isProject&&!projectStageField){
    f.Etape_Projet.title="Ajoute une colonne Ref vers Etapes_Projet dans Fonctionnalites pour enregistrer cette valeur.";
  }
  opt(f.Responsable,db.team,r=>r.nom,row?id(row.Responsable):null,"— responsable —");
  if(f.Releases) fillMulti(f.Releases,releaseRowsForProject(currentProjectId),x=>`${x.Nom||x.Code||"Release"} — ${dt(x.Date_Debut)} → ${dt(x.Date_Fin)}`,row?releaseIdsForFeature(row.id):[]);
  $("featureDialog").showModal()
}
$("featureForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.currentTarget,fid=Number(f.id.value)||null;
  const fields={Code:f.Code.value,Nom:f.Nom.value,Categ_module:f.Categ_module?.value||"",Description:f.Description.value,Priorite:f.Priorite.value,Progression:fromPct(f.Progression.value),Date_Debut:gd(allocationFormField(f,"Date_Debut").value),Date_Fin:gd(allocationFormField(f,"Date_Fin").value),Date_Cible:gd(f.Date_Cible.value),Responsable:f.Responsable.value?Number(f.Responsable.value):null,Actif:f.Actif.value==="true"};
  const stadeField=featureStageField(),statusField=featureStatusField(),projectStageField=featureProjectStageField();
  if(stadeField)fields[stadeField]=f.stade.value?Number(f.stade.value):null;
  if(statusField)fields[statusField]=f.Statut.value||null;
  if(typeOf(get("projects",currentProjectId))!=="produit"&&projectStageField)fields[projectStageField]=f.Etape_Projet.value?Number(f.Etape_Projet.value):null;
  fields[featureParentField()]=currentProjectId;
  const selected=f.Releases?[...f.Releases.selectedOptions].map(o=>Number(o.value)):[];
  $("featureDialog").close();

  if(fid){
    await apply([["UpdateRecord","Fonctionnalites",fid,fields]],"Fonctionnalité mise à jour.");
    await load();
    await syncFeatureReleases(fid,selected);
    await load();renderProject();
  }else{
    await apply([["AddRecord","Fonctionnalites",null,fields]],"Fonctionnalité créée.");
    await load();
    const created=[...featureRowsForProject(currentProjectId)].filter(x=>String(x.Code||"")===String(fields.Code||"")&&String(x.Nom||"")===String(fields.Nom||"")).sort((a,b)=>Number(b.id)-Number(a.id))[0];
    if(created&&selected.length){
      await syncFeatureReleases(created.id,selected);
      await load();renderProject();
    }
  }
}
function auditValue(v){
  if(v===undefined)return null;
  if(v===null)return null;
  if(v instanceof Date)return v.toISOString();
  if(Array.isArray(v))return v.map(auditValue);
  if(typeof v==="object"){
    const out={};
    for(const [k,val] of Object.entries(v))out[k]=auditValue(val);
    return out;
  }
  if(typeof v==="number"||typeof v==="boolean"||typeof v==="string")return v;
  try{return String(v)}catch(_){return null}
}

function auditPayload(action){
  const [kind,table,recordId,fields]=action;
  const key=tableKeyFromName(table);
  const before=key&&recordId?get(key,recordId):null;
  let details={};
  if(kind==="UpdateRecord"){
    details.changements={};
    for(const [col,valeur] of Object.entries(fields||{})){
      details.changements[col]={avant:auditValue(before?.[col]),apres:auditValue(valeur)};
    }
  }else if(kind==="AddRecord"){
    details.valeurs=fields||{};
  }else if(kind==="RemoveRecord"){
    details.avant=before||{};
  }else{
    details.action=action;
  }
  const label=before?.nom||before?.Nom||before?.titre||before?.Code||"";
  return {
    Date_Heure:Math.floor(Date.now()/1000),
    Utilisateur:"",
    Origine:"Cockpit PMO",
    Action:kind==="AddRecord"?"CREATE":kind==="UpdateRecord"?"UPDATE":kind==="RemoveRecord"?"DELETE":kind,
    Table:table,
    Record_ID:recordId||null,
    Libelle:String(label||""),
    Details:JSON.stringify(details)
  };
}
async function apply(actions,msg){
  if(busy)return false;
  busy=true;document.body.classList.add("busy");
  try{
    const finalActions=[...actions];
    if(db.audit!==undefined){
      for(const a of actions){
        if(["AddRecord","UpdateRecord","RemoveRecord"].includes(a[0])&&a[1]!=="JOURNAL_ACTIONS"){
          finalActions.push(["AddRecord","JOURNAL_ACTIONS",null,auditPayload(a)]);
        }
      }
    }
    try{
      await grist.docApi.applyUserActions(finalActions);
    }catch(e){
      if(finalActions.length!==actions.length){
        console.warn("Journalisation impossible, action métier appliquée sans journal",e);
        await grist.docApi.applyUserActions(actions);
      }else throw e;
    }
    await load();
    notifyBanner(msg);
    setTimeout(()=>{if(!busy)hideBanner()},1700);
    return true;
  }catch(e){
    console.error(e);
    notifyBanner(`Erreur Grist: ${e?.message||e}`);
    return false;
  }finally{
    busy=false;document.body.classList.remove("busy");
  }
}
function opt(el,rows,label,selected=null,empty="—"){el.innerHTML=`<option value="">${empty}</option>`+rows.map(r=>`<option value="${r.id}" ${Number(selected)===Number(r.id)?"selected":""}>${esc(label(r))}</option>`).join("")}

function existingProjectFieldNames(){
  const sample=(db.projects&&db.projects[0])||{};
  return new Set(Object.keys(sample));
}
function normalizeComparable(v){
  if(Array.isArray(v))return JSON.stringify(v);
  if(v===undefined)return null;
  return v;
}
function projectWritableFields(fields, before=null){
  const known=existingProjectFieldNames();
  const out={};
  for(const [k,v] of Object.entries(fields)){
    // If table has no rows, keep fields for creation. Otherwise only send columns that really exist.
    if(db.projects.length && !known.has(k))continue;
    if(before){
      const old=before[k];
      if(normalizeComparable(old)===normalizeComparable(v))continue;
      // Dates in Grist may be numbers with equivalent values; avoid false changes.
      if(["dateDebut","dateFin"].includes(k) && dms(old)===dms(v))continue;
      if(["progression"].includes(k) && Math.abs(Number(old||0)-Number(v||0))<1e-9)continue;
    }
    out[k]=v;
  }
  return out;
}

function openProject(create=false){
  const f=$("projectForm");
  f.reset();
  f.elements.record_id.value="";
  let p=null;

  if(!create){
    p=get("projects",currentProjectId);
    if(!p)return;
    f.elements.record_id.value=String(p.id);
    $("projectDialogTitle").textContent="Modifier Projet / Produit";
    ["nom","code","statut","priorite","sponsor","risque"].forEach(k=>f[k].value=p[k]??"");
    f.Type.value=/produit/i.test(p.Type||"")?"Produit":"Projet";f.Nature_Projet.value=p.Nature_Projet||"";
    f.progression.value=pct(p.progression);
    f.budget.value=p.budget??"";
    f.valeurStrategique.value=p.valeurStrategique??"";
    f.dateDebut.value=din(p.dateDebut);
    f.dateFin.value=din(p.dateFin);
  }else{
    $("projectDialogTitle").textContent="Nouveau Projet / Produit";
    f.Type.value=typeFilter==="produit"?"Produit":"Projet";f.Nature_Projet.value="";
    f.progression.value=0;
    f.statut.value="À faire";
  }

  opt(f.activite,db.activities,r=>r.Nom,p?id(p.activite):null,"— activité —");
  opt(f.etape_courante,db.projectStages,r=>r.Nom,p?id(p.etape_courante):null,"— étape courante —");
  opt(f.responsable,db.team,r=>r.nom,p?id(p.responsable):null,"— responsable —");
  $("projectDialog").showModal();
}
$("projectForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const rid=Number(f.elements.record_id.value)||null;
  const rawFields={
    nom:f.nom.value,
    code:f.code.value,
    Type:f.Type.value,
    Nature_Projet:f.Nature_Projet.value||null,
    statut:f.statut.value,
    priorite:f.priorite.value,
    sponsor:f.sponsor.value,
    progression:fromPct(f.progression.value),
    budget:f.budget.value===""?null:Number(f.budget.value),
    risque:f.risque.value,
    valeurStrategique:f.valeurStrategique.value===""?null:Number(f.valeurStrategique.value),
    activite:f.activite.value?Number(f.activite.value):null,
    etape_courante:f.etape_courante.value?Number(f.etape_courante.value):null,
    responsable:f.responsable.value?Number(f.responsable.value):null,
    dateDebut:gd(f.dateDebut.value),
    dateFin:gd(f.dateFin.value)
  };
  const lookup={nom:rawFields.nom,code:rawFields.code};

  // Sécurité : le nom du projet/produit est fonctionnellement unique.
  // Si le formulaire perdait son record_id, on ne doit jamais recréer un doublon.
  const existingByName=(db.projects||[]).filter(p=>String(p.nom||"").trim().toLowerCase()===String(rawFields.nom||"").trim().toLowerCase());
  const effectiveRid=rid || (existingByName.length===1 ? Number(existingByName[0].id) : null);

  if(effectiveRid){
    const before=get("projects",effectiveRid);
    const fields=projectWritableFields(rawFields,before);
    if(!Object.keys(fields).length){
      $("projectDialog").close();
      notifyBanner("Aucune modification à enregistrer.");
      return;
    }
    const ok=await apply([["UpdateRecord","Projects",effectiveRid,fields]],"Projet / Produit mis à jour.");
    if(ok){
      currentProjectId=effectiveRid;
      detailTab="infos";
      renderProject();
      $("projectDialog").close();
    }
    return;
  }

  const fields=projectWritableFields(rawFields,null);
  $("projectDialog").close();
  if(busy)return;
  busy=true;document.body.classList.add("busy");
  try{
    const actions=[["AddRecord","Projects",null,fields]];
    const finalActions=[...actions];
    if(db.audit!==undefined){
      for(const a of actions)finalActions.push(["AddRecord","JOURNAL_ACTIONS",null,auditPayload(a)]);
    }
    try{
      await grist.docApi.applyUserActions(finalActions);
    }catch(e){
      if(finalActions.length!==actions.length){
        console.warn("Journalisation impossible, création appliquée sans journal",e);
        await grist.docApi.applyUserActions(actions);
      }else throw e;
    }
    await load();
    const created=[...db.projects].filter(p=>String(p.nom||"")===lookup.nom&&String(p.code||"")===lookup.code).sort((a,b)=>Number(b.id)-Number(a.id))[0];
    if(created){
      currentProjectId=created.id;projectSearch="";$("projectSearch").value="";typeFilter="all";
      document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x.dataset.typeFilter==="all"));
      populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject();
    }
    notifyBanner("Projet / Produit créé.");
  }catch(e){
    console.error(e);notifyBanner(`Erreur Grist: ${e?.message||e}`);
  }finally{
    busy=false;document.body.classList.remove("busy");
  }
}

function fillMulti(el,rows,label,selected=[]){const s=new Set(selected.map(Number));el.innerHTML=rows.map(r=>`<option value="${r.id}" ${s.has(Number(r.id))?"selected":""}>${esc(label(r))}</option>`).join("")}

function taskProject(t){return get("projects",id(t.projet))}
function taskDependencyLabel(t){
  const p=taskProject(t);
  return `[${p?.nom||p?.Nom||p?.Code||"Sans projet"}] ${t.titre||t.Code||`Tâche #${t.id}`}`;
}
function externalDependenciesForProject(pid){
  const own=taskRows(pid),ownIds=new Set(own.map(t=>t.id)),rows=[];
  own.forEach(t=>refs(t.dependDe).forEach(depId=>{
    const dep=get("tasks",depId);
    if(dep&&!ownIds.has(dep.id))rows.push({task:t,dependency:dep,project:taskProject(dep)});
  }));
  return rows;
}
function openTask(tid=null,preset={}){const f=$("taskForm");f.reset();f.id.value=tid||"";const t=tid?get("tasks",tid):null;$("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";if(t){["titre","description","Code","type","statut","priorite","estimationH","tempsPasse"].forEach(k=>f[k].value=t[k]??"");f.progression.value=pct(t.progression);f.dateDebut.value=din(t.dateDebut);f.dateEcheance.value=din(t.dateEcheance);f.tags.value=Array.isArray(t.tags)?t.tags.filter(x=>typeof x==="string").join(", "):""}else{f.type.value="tache";f.progression.value=0}opt(f.etape_projet,db.projectStages,r=>r.Nom,t?id(t.etape_projet):(preset.stageId||null),"— étape projet —");opt(f.fonctionnalite,featureRowsForProject(currentProjectId),r=>r.Nom,t?id(t.fonctionnalite):(preset.featureId||null),"— fonctionnalité —");fillMulti(f.assignees,db.team,r=>r.nom,t?refs(t.assignees):[]);fillMulti(f.dependDe,db.tasks.filter(x=>x.id!==tid),r=>taskDependencyLabel(r),t?refs(t.dependDe):[]);opt(f.parentTask,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?id(t.parentTask):null,"— aucune —");if(typeOf(get("projects",currentProjectId))==="produit"){f.etape_projet.value="";f.etape_projet.disabled=true}else{f.etape_projet.disabled=false}$("taskDialog").showModal()}
$("taskForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,tid=Number(f.id.value)||null,tags=f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),fields={titre:f.titre.value,description:f.description.value,Code:f.Code.value,type:f.type.value,statut:f.statut.value,priorite:f.priorite.value,progression:fromPct(f.progression.value),estimationH:f.estimationH.value===""?null:Number(f.estimationH.value),tempsPasse:f.tempsPasse.value===""?null:Number(f.tempsPasse.value),dateDebut:gd(f.dateDebut.value),dateEcheance:gd(f.dateEcheance.value),etape_projet:typeOf(get("projects",currentProjectId))==="produit"?null:(f.etape_projet.value?Number(f.etape_projet.value):null),fonctionnalite:f.fonctionnalite.value?Number(f.fonctionnalite.value):null,projet:currentProjectId,assignees:reflist([...f.assignees.selectedOptions].map(o=>Number(o.value))),dependDe:reflist([...f.dependDe.selectedOptions].map(o=>Number(o.value))),parentTask:f.parentTask.value?Number(f.parentTask.value):null,tags:["L",...tags]};$("taskDialog").close();await apply([[tid?"UpdateRecord":"AddRecord","Tasks",tid||null,fields]],tid?"Tâche mise à jour.":"Tâche créée.")}
async function deleteTask(tid){const t=get("tasks",tid);if(t&&confirm(`Supprimer « ${t.titre} » ?`))await apply([["RemoveRecord","Tasks",tid]],"Tâche supprimée.")}
function openContribution(){const f=$("contributionForm"),existing=new Set(contribRows(currentProjectId).map(c=>id(c.Objectif_Libelle)||id(c.Objectif_Code2)));const choices=db.objectives.filter(o=>!existing.has(o.id));opt(f.objectif,choices,r=>r.Nom,null,"Choisir un objectif…");f.contribution.value=100;f.commentaire.value="";$("contributionDialog").showModal()}
$("contributionForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,oid=Number(f.objectif.value),fields={Projet_Code:reflist([currentProjectId]),Objectif_Libelle:oid,Objectif_Code2:oid,Contributions_Objectifs:fromPct(f.contribution.value),Commentaire:f.commentaire.value};$("contributionDialog").close();await apply([["AddRecord","CONTRIBUTIONS_OBJECTIFS",null,fields]],"Objectif associé.")}
async function removeContribution(cid){if(confirm("Retirer cet objectif ?"))await apply([["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",cid]],"Contribution retirée.")}
async function deleteProject(){const p=get("projects",currentProjectId),ts=taskRows(currentProjectId),cs=contribRows(currentProjectId),as=allocRows(currentProjectId);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.nom} » (${typeOf(p)}) ?`))return;const actions=[...ts.map(x=>["RemoveRecord","Tasks",x.id]),...cs.map(x=>["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",x.id]),...as.map(x=>["RemoveRecord","Allocations",x.id]),["RemoveRecord","Projects",p.id]];currentProjectId=null;await apply(actions,"Projet / Produit supprimé.")}

/* ---------- events ---------- */
function projectsForOffer(offerId){
  const aoIds=new Set(db.activityOffers.filter(x=>id(x.OFS_Code)===Number(offerId)).map(x=>x.id));
  const actIds=new Set(db.activities.filter(a=>aoIds.has(id(a.Service_Code))).map(a=>a.id));
  return db.projects.filter(p=>actIds.has(id(p.activite)) && (offerTypeFilter==="all"||typeOf(p)===offerTypeFilter));
}

function renderOffer(){
  const o=get("offers",currentOfferId);if(!o)return;
  const aos=db.activityOffers.filter(x=>id(x.OFS_Code)===Number(o.id));
  const projects=projectsForOffer(o.id);
  const projectIds=new Set(projects.map(p=>p.id));
  const contribs=db.contrib.filter(c=>refs(c.Projet_Code).some(pid=>projectIds.has(pid)));
  const objectiveIds=new Set(contribs.map(c=>id(c.Objectif_Libelle)||id(c.Objectif_Code2)).filter(Boolean));
  const allocations=db.allocations.filter(a=>projectIds.has(id(a.Projet_Code)));
  const projCount=projects.filter(p=>typeOf(p)==="projet").length,prodCount=projects.filter(p=>typeOf(p)==="produit").length;
  const avg=projects.length?Math.round(projects.reduce((n,p)=>n+pct(p.progression),0)/projects.length):0;
  $("offerKpis").innerHTML=kpi("Projets",projCount,"")+kpi("Produits",prodCount,"")+kpi("Total",projects.length,"éléments liés")+kpi("Avancement moyen",`${avg}%`,bar(avg))+kpi("Objectifs",objectiveIds.size,"couverts");
  $("offerActivities").innerHTML=aos.length?`<div class="offer-tree">${aos.map(ao=>{const acts=db.activities.filter(a=>id(a.Service_Code)===ao.id);return`<div class="offer-node"><div class="title">${esc(ao.Activites_Nom||ao.Nom||`#${ao.id}`)}</div><div class="sub">${acts.length} activité(s) internes</div></div>`}).join("")}</div>`:'<div class="empty">Aucune activité OFS.</div>';
  $("offerProjects").innerHTML=projects.length?`<table><thead><tr><th>Type</th><th>Nom</th><th>Statut</th><th>Avancement</th><th>Risque</th></tr></thead><tbody>${projects.map(p=>`<tr><td>${typeBadge(p)}</td><td><strong>${esc(p.nom||"")}</strong></td><td>${esc(p.statut||"")}</td><td>${pct(p.progression)}%</td><td>${esc(p.risque||"—")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Aucun projet/produit lié.</div>';
  const objectives=[...objectiveIds].map(i=>get("objectives",i)).filter(Boolean);
  $("offerObjectives").innerHTML=objectives.length?`<table><thead><tr><th>Objectif</th><th>KPI</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>${objectives.map(x=>`<tr><td><strong>${esc(x.Nom||"")}</strong></td><td>${esc(x.KPI||"")}</td><td>${dt(x.Echeance)}</td><td>${esc(x.Statut||"")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Aucun objectif couvert.</div>';
  const byRes=new Map();for(const a of allocations){const rid=id(a.Ressource_Code);if(!rid)continue;byRes.set(rid,(byRes.get(rid)||0)+Number(a.Allocation||0))}
  $("offerResources").innerHTML=byRes.size?`<div class="resource-row header"><div>Ressource</div><div>Allocation cumulée</div><div></div><div></div></div>${[...byRes.entries()].map(([rid,v])=>`<div class="resource-row"><div><strong>${esc(get("team",rid)?.nom||`#${rid}`)}</strong></div><div><div class="load-track"><div class="load-fill ${v>1?"over":""}" style="width:${Math.min(100,v*100)}%"></div></div><div class="muted">${Math.round(v*100)}%</div></div><div></div><div></div></div>`).join("")}`:'<div class="empty">Aucune allocation.</div>';
}


/* ---------- Pilotage par les ressources — UX v5.1 ---------- */
let resourceViewMode="people",resourceQuickFilter="all",resourceSearch="";
function allocFraction(v){let n=Number(v||0);return Number.isFinite(n)?(n>2?n/100:n):0}
function teamCapacity(m){let n=Number(m?.capacite_ETP??m?.Capacite_ETP??m?.capacite??1);return Number.isFinite(n)&&n>0?n:1}
function teamRefLabel(m){const rid=id(m?.equipe??m?.Equipe??m?.Equipe_Code??m?.Team_ref),r=rid?get("teamRef",rid):null;return r?.Libelle||r?.Nom||r?.Code||m?.equipe_libelle||"Sans équipe"}
function allocationStart(a){return a?dms(a.Date_Debut??a.dateDebut??a.DateDebut):null}
function allocationEnd(a){return a?dms(a.Date_Fin??a.dateFin??a.DateFin):null}
function quarterStart(y,q){return Date.UTC(y,(q-1)*3,1)}
function quarterEnd(y,q){return Date.UTC(y,q*3,1)-1}
function resourceQuarters(count=8,offset=0){const now=new Date(),y=now.getUTCFullYear(),q=Math.floor(now.getUTCMonth()/3)+1,out=[];for(let i=offset;i<count+offset;i++){const qi=q+i,yy=y+Math.floor((qi-1)/4),qq=((qi-1)%4)+1;out.push({y:yy,q:qq,start:quarterStart(yy,qq),end:quarterEnd(yy,qq),label:`T${qq} ${yy}`})}return out}
function allocationQuarterLoad(a,q){const raw=allocFraction(a.Allocation);if(!raw)return 0;let s=allocationStart(a),e=allocationEnd(a);if(!s&&!e)return raw;if(!s)s=e;if(!e)e=s;const overlap=Math.max(0,Math.min(e,q.end)-Math.max(s,q.start)+1);return overlap?raw*(overlap/(q.end-q.start+1)):0}
function resourceLoadForQuarter(mid,q,projectFilter="all"){return db.allocations.filter(a=>id(a.Ressource_Code)===mid&&(projectFilter==="all"||id(a.Projet_Code)===Number(projectFilter))).reduce((n,a)=>n+allocationQuarterLoad(a,q),0)}
function resourceHasAllocation(mid){return db.allocations.some(a=>id(a.Ressource_Code)===mid)}
function resourceRatio(m,q=resourceQuarters(1)[0]){return resourceLoadForQuarter(m.id,q,resourceProjectFilter)/teamCapacity(m)}
function resourceStatus(ratio,has){if(!has)return"unallocated";if(ratio>1)return"over";if(ratio<.8)return"available";return"normal"}
function resourceStatusLabel(s){return s==="over"?"Surcharge":s==="available"?"Disponible":s==="unallocated"?"Non allouée":"Charge normale"}
function resourceStatusIcon(s){return s==="over"?"🔴":s==="available"?"🟢":s==="unallocated"?"⚪":"🟡"}
function populateResourceFilters(){
 const teams=[...new Set(db.team.map(teamRefLabel).filter(Boolean))].sort(),roles=[...new Set(db.team.map(m=>String(m.role??m.Role??"").trim()).filter(Boolean))].sort();
 $("resourceTeamFilter").innerHTML='<option value="all">Toutes les équipes</option>'+teams.map(v=>`<option>${esc(v)}</option>`).join("");
 $("resourceRoleFilter").innerHTML='<option value="all">Tous les rôles</option>'+roles.map(v=>`<option>${esc(v)}</option>`).join("");
 $("resourceProjectFilter").innerHTML='<option value="all">Tous les projets / produits</option>'+db.projects.map(p=>`<option value="${p.id}">${esc(p.nom||p.code||"#"+p.id)}</option>`).join("");
 $("resourceTeamFilter").value=resourceTeamFilter;$("resourceRoleFilter").value=resourceRoleFilter;$("resourceProjectFilter").value=resourceProjectFilter;$("resourceSearch").value=resourceSearch;
}
function filteredResources(){
 const q=resourceQuarters(1)[0],needle=resourceSearch.trim().toLowerCase();
 return db.team.filter(m=>{
   if(m.actif===false||m.Actif===false)return false;
   if(resourceTeamFilter!=="all"&&teamRefLabel(m)!==resourceTeamFilter)return false;
   if(resourceRoleFilter!=="all"&&String(m.role??m.Role??"")!==resourceRoleFilter)return false;
   if(needle&&!`${m.nom||m.Nom||""} ${m.role||m.Role||""} ${teamRefLabel(m)}`.toLowerCase().includes(needle))return false;
   const has=resourceHasAllocation(m.id),status=resourceStatus(resourceRatio(m,q),has);
   return resourceQuickFilter==="all"||status===resourceQuickFilter;
 });
}
function renderResourceKpis(){
 const active=db.team.filter(m=>m.actif!==false&&m.Actif!==false),q=resourceQuarters(1)[0],cap=active.reduce((n,m)=>n+teamCapacity(m),0),load=active.reduce((n,m)=>n+resourceLoadForQuarter(m.id,q,"all"),0);
 const over=active.filter(m=>resourceLoadForQuarter(m.id,q,"all")>teamCapacity(m)).length,available=active.filter(m=>resourceHasAllocation(m.id)&&resourceLoadForQuarter(m.id,q,"all")/teamCapacity(m)<.8).length;
 $("resourceKpis").innerHTML=kpi("Ressources",active.length,"actives")+kpi("Charge totale",`${Math.round(load*100)/100} ETP`,`${cap?Math.round(load/cap*100):0}% de ${Math.round(cap*100)/100} ETP`)+kpi("Surchargées",over,over?"Arbitrage nécessaire":"Aucune tension")+kpi("Disponibles",available,"< 80% de charge");
}
function renderResourceAlerts(){
 const qs=resourceQuarters(4),alerts=[];
 db.team.filter(m=>m.actif!==false&&m.Actif!==false).forEach(m=>qs.forEach(q=>{const ratio=resourceLoadForQuarter(m.id,q,"all")/teamCapacity(m);if(ratio>1)alerts.push({m,q,ratio})}));
 alerts.sort((a,b)=>b.ratio-a.ratio);
 $("resourceAlerts").innerHTML=alerts.length?`<button class="resource-alert-summary" data-alert-filter="over"><strong>⚠ ${alerts.length} point${alerts.length>1?"s":""} de tension</strong><span>${alerts.slice(0,3).map(a=>`${esc(a.m.nom||a.m.Nom)} ${Math.round(a.ratio*100)}% en ${a.q.label}`).join(" · ")}</span></button>`:`<div class="resource-alert-ok">✓ Aucun dépassement de capacité détecté sur les 4 prochains trimestres.</div>`;
 const b=document.querySelector("[data-alert-filter]");if(b)b.onclick=()=>{resourceQuickFilter="over";resourceViewMode="people";renderResources()}
}
function renderQuickFilters(){
 const q=resourceQuarters(1)[0],active=db.team.filter(m=>m.actif!==false&&m.Actif!==false),counts={all:active.length,over:0,normal:0,available:0,unallocated:0};
 active.forEach(m=>counts[resourceStatus(resourceLoadForQuarter(m.id,q,"all")/teamCapacity(m),resourceHasAllocation(m.id))]++);
 $("resourceQuickFilters").innerHTML=[["all","Toutes"],["over","🔴 Surchargées"],["available","🟢 Disponibles"],["normal","🟡 Charge normale"],["unallocated","⚪ Non allouées"]].map(([k,l])=>`<button class="resource-chip ${resourceQuickFilter===k?"active":""}" data-rq="${k}">${l} <b>${counts[k]}</b></button>`).join("");
 document.querySelectorAll("[data-rq]").forEach(b=>b.onclick=()=>{resourceQuickFilter=b.dataset.rq;renderResources()});
}
function miniQuarter(m,q){const cap=teamCapacity(m),load=resourceLoadForQuarter(m.id,q,resourceProjectFilter),r=cap?load/cap:0,s=resourceStatus(r,resourceHasAllocation(m.id));return`<div class="mini-quarter ${s}"><span>${q.label.replace(" ","-")}</span><strong>${Math.round(r*100)}%</strong></div>`}
function renderPeople(){
 const ms=filteredResources(),q=resourceQuarters(1)[0],future=resourceQuarters(4);
 $("resourcePeopleView").innerHTML=ms.length?`<div class="resource-list">${ms.map(m=>{const cap=teamCapacity(m),load=resourceLoadForQuarter(m.id,q,resourceProjectFilter),ratio=cap?load/cap:0,has=resourceHasAllocation(m.id),status=resourceStatus(ratio,has),n=db.allocations.filter(a=>id(a.Ressource_Code)===m.id).length;return`<button class="resource-person-card" data-resource="${m.id}"><div class="resource-avatar">${esc((m.nom||m.Nom||"?").trim().slice(0,1).toUpperCase())}</div><div class="resource-person-main"><div class="resource-person-title"><strong>${esc(m.nom||m.Nom||"#"+m.id)}</strong><span>${esc(m.role??m.Role??"")}</span></div><div class="muted">${esc(teamRefLabel(m))} · ${cap} ETP · ${n?n+" allocation(s)":"Aucune allocation"}</div></div><div class="resource-current"><div class="load-bar"><i style="width:${Math.min(100,Math.round(ratio*100))}%"></i></div><strong>${Math.round(ratio*100)}%</strong><span class="status-pill ${status}">${resourceStatusIcon(status)} ${resourceStatusLabel(status)}</span></div><div class="resource-future">${future.map(x=>miniQuarter(m,x)).join("")}</div><span class="resource-chevron">›</span></button>`}).join("")}</div>`:'<div class="empty">Aucune ressource ne correspond aux filtres.</div>';
 bindResourceOpen();
}
function renderLoadPlan(){
 const ms=filteredResources(),qs=resourceQuarters(8);
 $("resourceLoadView").innerHTML=ms.length?`<div class="resource-load-head"><div><h2>Plan de charge</h2><p>8 prochains trimestres · charge / capacité ETP</p></div></div><div class="resource-matrix-wrap"><table class="resource-matrix"><thead><tr><th class="sticky-col">Ressource</th><th>Capacité</th>${qs.map(q=>`<th>${q.label}</th>`).join("")}</tr></thead><tbody>${ms.map(m=>`<tr><td class="sticky-col"><button class="resource-link" data-resource="${m.id}">${esc(m.nom||m.Nom||"#"+m.id)}</button><small>${esc(teamRefLabel(m))}</small></td><td>${teamCapacity(m)} ETP</td>${qs.map(q=>{const cap=teamCapacity(m),l=resourceLoadForQuarter(m.id,q,resourceProjectFilter),r=cap?l/cap:0,s=resourceStatus(r,resourceHasAllocation(m.id));return`<td><div class="capacity-cell ${s}"><div class="capacity-fill" style="width:${Math.min(100,r*100)}%"></div><strong>${Math.round(r*100)}%</strong><span>${Math.round(l*100)/100} ETP</span></div></td>`}).join("")}</tr>`).join("")}</tbody></table></div>`:'<div class="empty">Aucune ressource.</div>';
 bindResourceOpen();
}
function renderTeams(){
 const ms=filteredResources(),qs=resourceQuarters(4),groups={};ms.forEach(m=>(groups[teamRefLabel(m)]??=[]).push(m));
 $("resourceTeamsView").innerHTML=Object.entries(groups).map(([name,members])=>{const cap=members.reduce((n,m)=>n+teamCapacity(m),0),loads=qs.map(q=>members.reduce((n,m)=>n+resourceLoadForQuarter(m.id,q,resourceProjectFilter),0)),over=members.filter(m=>resourceRatio(m)>1).length,unalloc=members.filter(m=>!resourceHasAllocation(m.id)).length;return`<article class="team-capacity-card"><div class="team-card-head"><div><h3>${esc(name)}</h3><span>${members.length} ressources · ${Math.round(cap*100)/100} ETP</span></div><div><b>${over}</b> surcharge(s) · <b>${unalloc}</b> non allouée(s)</div></div><div class="team-quarter-grid">${qs.map((q,i)=>{const r=cap?loads[i]/cap:0;return`<div><span>${q.label}</span><div class="team-load-bar"><i style="width:${Math.min(100,r*100)}%"></i></div><strong class="${r>1?"danger-text":""}">${Math.round(r*100)}%</strong><small>${Math.round(loads[i]*100)/100} / ${Math.round(cap*100)/100} ETP</small></div>`}).join("")}</div><div class="team-members">${members.slice(0,8).map(m=>`<button data-resource="${m.id}">${esc(m.nom||m.Nom||"#"+m.id)}</button>`).join("")}</div></article>`}).join("")||'<div class="empty">Aucune équipe.</div>';
 bindResourceOpen();
}
function bindResourceOpen(){document.querySelectorAll("[data-resource]").forEach(b=>b.onclick=()=>openResourceDrawer(Number(b.dataset.resource)))}
function openResourceDrawer(mid){selectedResourceId=mid;renderResourceDetail(mid);$("resourceDrawerBackdrop").classList.remove("hidden");$("resourceDrawer").classList.add("open");$("resourceDrawer").setAttribute("aria-hidden","false")}
function closeResourceDrawer(){$("resourceDrawerBackdrop").classList.add("hidden");$("resourceDrawer").classList.remove("open");$("resourceDrawer").setAttribute("aria-hidden","true")}

function allocationColumnSet(){
  const cols=(tableLoadMeta?.allocations?.columns)||[];
  return new Set(cols);
}

function allocationFormField(form,name){
  const el=form?.elements?.namedItem(name);
  if(!el){
    pmoError("Champ allocation introuvable",{name,available:[...(form?.elements||[])].map(x=>x.name||x.id||x.tagName)});
    throw new Error(`Champ allocation introuvable: ${name}`);
  }
  return el;
}

function openAllocationDialog(a=null,defaults={}){
  pmoInfo("Ouverture formulaire allocation",{mode:a?"edit":"create",allocationId:a?.id||null,defaults});
  pmoInfo("Champs formulaire allocation détectés",{fields:[...$("allocationForm").elements].map(x=>x.name||x.id||x.tagName)});
  const f=$("allocationForm");
  if(!f){msg("Formulaire d'allocation indisponible.",true);return}
  const resourceId=a?id(a.Ressource_Code):(defaults.resourceId||selectedResourceId||null);
  const projectId=a?id(a.Projet_Code):(defaults.projectId||currentProjectId||null);

  allocationFormField(f,"allocation_id").value=a?.id||"";
  allocationFormField(f,"Ressource_Code").innerHTML='<option value="">Choisir…</option>'+db.team.map(x=>`<option value="${x.id}">${esc(x.nom||x.Nom||"#"+x.id)}</option>`).join("");
  allocationFormField(f,"Projet_Code").innerHTML='<option value="">Choisir…</option>'+db.projects.map(x=>`<option value="${x.id}">${esc(x.nom||x.code||"#"+x.id)} · ${typeOf(x)==="produit"?"Produit":"Projet"}</option>`).join("");
  allocationFormField(f,"Ressource_Code").value=resourceId||"";
  allocationFormField(f,"Projet_Code").value=projectId||"";
  allocationFormField(f,"Allocation").value=a?Math.round(allocFraction(a.Allocation)*100):100;
  allocationFormField(f,"Role").value=a?.Role??a?.role??"";
  allocationFormField(f,"Date_Debut").value=din(allocationStart(a));
  allocationFormField(f,"Date_Fin").value=din(allocationEnd(a));
  $("allocationDialogTitle").textContent=a?"Modifier l’allocation":"Nouvelle allocation";
  $("allocationDialog").showModal();pmoInfo("Formulaire allocation ouvert",{mode:a?"edit":"create"});
}
function bindAllocationActions(){
  const adds=document.querySelectorAll("[data-new-allocation]"),edits=document.querySelectorAll("[data-edit-allocation]"),deletes=document.querySelectorAll("[data-delete-allocation]");
  pmoInfo("Boutons allocations branchés",{add:adds.length,edit:edits.length,delete:deletes.length});
  adds.forEach(b=>b.onclick=()=>{const rid=Number(b.dataset.newAllocation);pmoInfo("Nouvelle allocation cliquée",{resourceId:rid});openAllocationDialog(null,{resourceId:rid})});
  edits.forEach(b=>b.onclick=()=>{const aid=Number(b.dataset.editAllocation);pmoInfo("Modifier allocation cliqué",{allocationId:aid});openAllocationDialog(get("allocations",aid))});
  deletes.forEach(b=>b.onclick=async()=>{
    const aid=Number(b.dataset.deleteAllocation),a=get("allocations",aid);
    pmoInfo("Supprimer allocation cliqué",{allocationId:aid,found:Boolean(a)});
    if(!a){pmoError("Allocation à supprimer introuvable",{allocationId:aid});return}
    if(!confirm("Supprimer cette allocation ?")){
      pmoInfo("Suppression allocation annulée",{allocationId:aid});
      return;
    }
    try{
      pmoInfo("Suppression Grist envoyée",{table:"Allocations",allocationId:aid});
      await grist.docApi.applyUserActions([["RemoveRecord","Allocations",aid]]);
      pmoInfo("Suppression Grist confirmée",{allocationId:aid});
      notifyBanner("Allocation supprimée.");
      await load();
      if(selectedResourceId)renderResourceDetail(selectedResourceId);
    }catch(e){
      pmoError("Échec suppression allocation",{allocationId:aid,error:e});
      notifyBanner(`Erreur suppression allocation : ${e?.message||e}`,"error");
    }
  });
}

function taskAssignedToResource(t,rid){return refs(t?.assignees).includes(Number(rid))}
function resourceAssignedTasks(rid){return db.tasks.filter(t=>taskAssignedToResource(t,rid))}
function resourceTaskDue(t){return dms(t?.dateEcheance??t?.Date_Echeance??t?.DateEcheance)}
function resourceTaskLate(t){const d=resourceTaskDue(t);return !!d&&d<Date.now()&&!done(t?.statut??t?.Statut)}
function resourceTaskProject(t){const p=get("projects",id(t?.projet));return p?.nom||p?.code||(id(t?.projet)?`Projet #${id(t.projet)}`:"Sans projet")}
function resourceTaskFeature(t){const f=get("features",id(t?.fonctionnalite));return f?.Nom||f?.nom||""}
function resourceTaskStage(t){const st=get("projectStages",id(t?.etape_projet));return st?.Nom||st?.nom||""}

function renderResourceDetail(mid){
 const m=get("team",mid);if(!m)return;
 const as=db.allocations.filter(a=>id(a.Ressource_Code)===mid).sort((a,b)=>(allocationStart(a)||0)-(allocationStart(b)||0));
 const tasks=resourceAssignedTasks(mid).sort((a,b)=>(resourceTaskLate(b)?1:0)-(resourceTaskLate(a)?1:0)||(resourceTaskDue(a)||Infinity)-(resourceTaskDue(b)||Infinity));
 const qs=resourceQuarters(4),cap=teamCapacity(m),loads=qs.map(q=>resourceLoadForQuarter(mid,q,"all")),peak=Math.max(0,...loads.map(l=>l/cap)),late=tasks.filter(resourceTaskLate).length;
 $("resourceDrawerContent").innerHTML=`<div class="drawer-profile"><div class="drawer-avatar">${esc((m.nom||m.Nom||"?").slice(0,1).toUpperCase())}</div><h2>${esc(m.nom||m.Nom||"#"+mid)}</h2><p>${esc(m.role??m.Role??"")} · ${esc(teamRefLabel(m))}</p></div>
 <div class="drawer-kpis resource-kpis-4"><div><b>${cap}</b><span>ETP capacité</span></div><div><b class="${peak>1?"danger-text":""}">${Math.round(peak*100)}%</b><span>pic 4 trim.</span></div><div><b>${as.length}</b><span>allocation(s)</span></div><div><b class="${late?"danger-text":""}">${tasks.length}</b><span>tâche(s) · ${late} en retard</span></div></div>
 <h3>Prochains trimestres</h3><div class="drawer-quarter-grid">${qs.map((q,i)=>`<div><span>${q.label}</span><strong>${Math.round(loads[i]/cap*100)}%</strong><small>${Math.round(loads[i]*100)/100} ETP</small></div>`).join("")}</div>
 <div class="resource-detail-tabs"><button type="button" class="resource-detail-tab active" data-resource-detail-tab="allocations">Allocations <span>${as.length}</span></button><button type="button" class="resource-detail-tab" data-resource-detail-tab="tasks">Tâches assignées <span>${tasks.length}</span></button></div>
 <section data-resource-detail-panel="allocations"><div class="allocation-section-head"><h3>Allocations projets / produits</h3><button class="primary small" type="button" data-new-allocation="${mid}">+ Nouvelle allocation</button></div>${as.length?`<div class="allocation-list">${as.map(a=>{const p=get("projects",id(a.Projet_Code));return`<div class="allocation-card"><div><strong>${esc(p?.nom||p?.code||"Projet #"+id(a.Projet_Code))}</strong><div class="muted">${esc(a.Role||a.role||"")}<br>${dt(allocationStart(a))} → ${dt(allocationEnd(a))}</div></div><div class="allocation-actions"><span>${Math.round(allocFraction(a.Allocation)*100)}%</span><button type="button" class="icon" data-edit-allocation="${a.id}">✎</button><button type="button" class="icon danger" data-delete-allocation="${a.id}">×</button></div></div>`}).join("")}</div>`:'<div class="resource-no-allocation"><b>Disponible</b><span>Aucune allocation enregistrée.</span><button class="primary small" type="button" data-new-allocation="${mid}">+ Affecter cette ressource</button></div>'}</section>
 <section data-resource-detail-panel="tasks" class="hidden"><div class="resource-task-section-head"><h3>Tâches assignées</h3><span>${late?`⚠ ${late} en retard`:"Aucune tâche en retard"}</span></div>${tasks.length?`<div class="resource-task-list">${tasks.map(t=>{const f=resourceTaskFeature(t),st=resourceTaskStage(t),due=resourceTaskDue(t),isLate=resourceTaskLate(t);return`<article class="resource-task-card ${isLate?"late":""}"><div class="resource-task-main"><strong>${esc(t.nom||t.Nom||t.titre||t.Titre||`Tâche #${t.id}`)}</strong><span>${esc(resourceTaskProject(t))}</span>${(f||st)?`<small>${f?`Fonctionnalité : ${esc(f)}`:""}${f&&st?" · ":""}${st?`Étape : ${esc(st)}`:""}</small>`:""}</div><div class="resource-task-meta"><span class="task-status">${esc(t.statut??t.Statut??"—")}</span><span class="${isLate?"danger-text":""}">${due?dt(due):"Sans échéance"}</span></div></article>`}).join("")}</div>`:'<div class="empty">Aucune tâche assignée à cette ressource.</div>'}</section>`;
 bindAllocationActions();
 document.querySelectorAll("[data-resource-detail-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-resource-detail-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll("[data-resource-detail-panel]").forEach(p=>p.classList.toggle("hidden",p.dataset.resourceDetailPanel!==b.dataset.resourceDetailTab))});
}
function renderResources(){
 if(!$("resourcesView"))return;populateResourceFilters();renderResourceKpis();renderResourceAlerts();renderQuickFilters();
 document.querySelectorAll("[data-resource-view]").forEach(b=>b.classList.toggle("active",b.dataset.resourceView===resourceViewMode));
 $("resourcePeopleView").classList.toggle("hidden",resourceViewMode!=="people");$("resourceLoadView").classList.toggle("hidden",resourceViewMode!=="load");$("resourceTeamsView").classList.toggle("hidden",resourceViewMode!=="teams");
 if(resourceViewMode==="people")renderPeople();if(resourceViewMode==="load")renderLoadPlan();if(resourceViewMode==="teams")renderTeams();
}

function switchMainTab(tab){
  currentTab=tab;
  touchPresence();
  document.querySelectorAll("[data-main-tab]").forEach(x=>x.classList.toggle("active",x.dataset.mainTab===tab));
  $("projectView").classList.toggle("hidden",tab!=="project");
  $("offerView").classList.toggle("hidden",tab!=="offer");
  $("resourcesView").classList.toggle("hidden",tab!=="resources");
  optionalEl("docsView")?.classList.toggle("hidden",tab!=="docs");
  if(tab==="resources"){renderResources()}
  if(tab==="docs"){
    try{renderDocumentation()}
    catch(e){
      console.error("Erreur onglet Documentation",e);
      optionalEl("docsView")?.classList.remove("hidden");
      const s=$("docsStatus");s.classList.remove("hidden");
      s.innerHTML=`<strong>Erreur d'affichage Documentation</strong><div class="muted">${esc(e?.message||e)}</div>`;
    }
  }
}
document.querySelectorAll("[data-main-tab]").forEach(b=>b.addEventListener("click",()=>switchMainTab(b.dataset.mainTab)));
document.querySelectorAll("[data-type-filter]").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.typeFilter;document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x===b));populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
document.querySelectorAll("[data-offer-type-filter]").forEach(b=>b.onclick=()=>{offerTypeFilter=b.dataset.offerTypeFilter;document.querySelectorAll("[data-offer-type-filter]").forEach(x=>x.classList.toggle("active",x===b));renderOffer()});
$("offerSelect").onchange=e=>{currentOfferId=Number(e.target.value);touchPresence();renderOffer()};
$("editProjectBtn").onclick=()=>openProject(false);$("newProjectBtn").onclick=()=>openProject(true);
$("deleteProjectBtn").onclick=deleteProject;
$("newTaskBtn").onclick=()=>openTask();$("newStageTaskBtn").onclick=()=>openTask();
if($("addContributionBtn"))$("addContributionBtn").onclick=openContribution;if($("newFeatureBtn"))$("newFeatureBtn").onclick=()=>openFeature();if($("newReleaseBtn"))$("newReleaseBtn").onclick=()=>openRelease();if($("summaryFeatureBtn"))$("summaryFeatureBtn").onclick=()=>switchDetailTab("features");
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));tasks(taskRows(currentProjectId))});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=$(b.dataset.close);if(d?.open)d.close()});

$("projectSearch").addEventListener("input",e=>{projectSearch=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
$("domainFilter").addEventListener("change",e=>{domainFilter=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
$("serviceFilter").addEventListener("change",e=>{serviceFilter=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});$("natureFilter").addEventListener("change",e=>{natureFilter=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
document.querySelectorAll("[data-detail-tab]").forEach(b=>b.onclick=()=>switchDetailTab(b.dataset.detailTab));


["resourceTeamFilter","resourceRoleFilter","resourceProjectFilter"].forEach(fid=>{
  $(fid).addEventListener("change",e=>{if(fid==="resourceTeamFilter")resourceTeamFilter=e.target.value;if(fid==="resourceRoleFilter")resourceRoleFilter=e.target.value;if(fid==="resourceProjectFilter")resourceProjectFilter=e.target.value;renderResources()});
});
$("resourceSearch").addEventListener("input",e=>{resourceSearch=e.target.value;renderResources()});
document.querySelectorAll("[data-resource-view]").forEach(b=>b.onclick=()=>{resourceViewMode=b.dataset.resourceView;renderResources()});

$("allocationForm").onsubmit=async e=>{
  pmoInfo("Soumission formulaire allocation");
  e.preventDefault();
  const f=e.currentTarget,aid=Number(allocationFormField(f,"allocation_id").value)||null;
  const fields={
    Ressource_Code:Number(allocationFormField(f,"Ressource_Code").value),
    Projet_Code:Number(allocationFormField(f,"Projet_Code").value),
    Allocation:fromPct(allocationFormField(f,"Allocation").value),
    Role:allocationFormField(f,"Role").value,
    Date_Debut:gd(allocationFormField(f,"Date_Debut").value),
    Date_Fin:gd(allocationFormField(f,"Date_Fin").value)
  };
  const cols=allocationColumnSet();
  const safe=Object.fromEntries(Object.entries(fields).filter(([k])=>cols.has(k)));
  if(!safe.Ressource_Code||!safe.Projet_Code){
    msg("Les colonnes Ressource_Code et Projet_Code sont nécessaires dans Allocations.",true);
    return;
  }
  $("allocationDialog").close();
  await apply([[aid?"UpdateRecord":"AddRecord","Allocations",aid||null,safe]],aid?"Allocation mise à jour.":"Allocation créée.");
  if(selectedResourceId)renderResourceDetail(selectedResourceId);
};

$("resourceDrawerClose").onclick=closeResourceDrawer;$("resourceDrawerBackdrop").onclick=closeResourceDrawer;


document.addEventListener("click",e=>{
  const b=e.target.closest?.("#projectAddAllocationBtn");
  if(!b)return;
  e.preventDefault();
  openAllocationDialog(null,{projectId:currentProjectId});
});


// v5.4.2 boot diagnostic: all DOM nodes are parsed before this script runs.
pmoInfo("Démarrage Cockpit",{version:VERSION,allocationForm:Boolean(document.getElementById("allocationForm")),projectList:Boolean(document.getElementById("projectList"))});

$("openLogsBtn").onclick=()=>{$("logDrawer").classList.remove("hidden");renderPmoLogs()};
$("closeLogsBtn").onclick=()=>$("logDrawer").classList.add("hidden");
$("logLevelFilter").onchange=renderPmoLogs;
$("clearLogsBtn").onclick=()=>{if(confirm("Vider tous les logs de cette session ?")){clearPmoLogs();pmoInfo("Logs vidés par l’utilisateur")}};
$("copyLogsBtn").onclick=async()=>{
  const text=pmoLogsText();
  try{await navigator.clipboard.writeText(text);msg("Logs copiés.");pmoInfo("Logs copiés dans le presse-papiers")}
  catch(e){pmoError("Impossible de copier les logs",e);msg("Copie impossible.",true)}
};
pmoInfo("Interface de logs prête");


function presenceAgo(ts){
  const sec=Math.max(0,Math.floor(Date.now()/1000-Number(ts||0)));
  if(sec<60)return "à l’instant";
  const min=Math.floor(sec/60);if(min<60)return `il y a ${min} min`;
  return `il y a ${Math.floor(min/60)} h`;
}
function renderPresenceUsers(users){
  const box=optionalEl("presenceUsers");if(!box)return;
  if(!users.length){box.innerHTML='<div class="presence-empty">Aucun utilisateur actif.</div>';return}
  box.innerHTML=users.map(u=>{
    const name=esc(u.Utilisateur_Nom||u.Utilisateur_Email||"Utilisateur");
    const email=u.Utilisateur_Email&&u.Utilisateur_Email!==u.Utilisateur_Nom?`<div class="muted">${esc(u.Utilisateur_Email)}</div>`:"";
    const sessions=Number(u.sessions||1)>1?` · ${u.sessions} sessions`:"";
    return `<div class="presence-user">
      <div class="presence-avatar">👤</div>
      <div class="presence-user-main"><strong>${name}</strong>${email}<div class="muted">${esc(u.Widget_Code||"Widget")} ${esc(u.Widget_Version||"")} · ${esc(u.Page||"")}${sessions}</div></div>
      <div class="presence-ago">${presenceAgo(u.Derniere_Activite)}</div>
    </div>`;
  }).join("");
}
async function refreshPresenceUsers(){
  const box=optionalEl("presenceUsers"),badge=optionalEl("presenceBadge");if(!box)return;
  box.innerHTML='<div class="muted">Chargement…</div>';
  try{
    const users=await window.PmoPresence.listActive({
      minutes:10,
      allWidgets:optionalEl("presenceAllWidgets")?.checked!==false,
      widget:"COCKPIT"
    });
    renderPresenceUsers(users);
    if(badge&&badge.classList.contains("presence-ok"))badge.textContent=`● Présence · 👥 ${users.length} actif${users.length>1?"s":""}`;
  }catch(e){
    box.innerHTML=`<div class="presence-error-box">Impossible de lire les utilisateurs actifs.<br><span class="muted">${esc(e?.message||e)}</span></div>`;
  }
}
function togglePresencePopover(force){
  const p=optionalEl("presencePopover");if(!p)return;
  const show=force===undefined?p.classList.contains("hidden"):!!force;
  p.classList.toggle("hidden",!show);
  if(show)refreshPresenceUsers();
}
optionalEl("presenceBadge")?.addEventListener("click",e=>{e.stopPropagation();togglePresencePopover()});
optionalEl("presenceCloseBtn")?.addEventListener("click",()=>togglePresencePopover(false));
optionalEl("presenceRefreshBtn")?.addEventListener("click",refreshPresenceUsers);
optionalEl("presenceAllWidgets")?.addEventListener("change",refreshPresenceUsers);
optionalEl("presencePopover")?.addEventListener("click",e=>e.stopPropagation());
document.addEventListener("click",()=>togglePresencePopover(false));

grist.ready({requiredAccess:"full"});
grist.onOptions(()=>load());
load();
window.PmoPresence?.start({widget:"COCKPIT",version:VERSION,getPage:presencePage});

$("backToPortfolioBtn").onclick=()=>{renderProjectList();showPortfolioPage();};
window.addEventListener("hashchange",()=>{
  const m=location.hash.match(/^#projet-(\d+)$/);
  if(m)showProjectPage(Number(m[1]));else showPortfolioPage();
});
setTimeout(()=>{
  const m=location.hash.match(/^#projet-(\d+)$/);
  if(m&&get("projects",Number(m[1])))showProjectPage(Number(m[1]));
},0);

$("columnsBtn").onclick=e=>{e.stopPropagation();toggleColumnsMenu()};
$("closeColumnsBtn").onclick=()=>toggleColumnsMenu(false);
$("resetColumnsBtn").onclick=()=>{
  projectColumns=DEFAULT_PROJECT_COLUMNS.slice();saveProjectColumns();renderColumnsMenu();renderProjectList();
};
$("columnsMenu").onclick=e=>e.stopPropagation();
document.addEventListener("click",()=>toggleColumnsMenu(false));
