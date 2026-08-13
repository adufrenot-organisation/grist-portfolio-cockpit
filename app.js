
const VERSION="4.7.2";
const T={domains:"Domaine",projects:"Projects",tasks:"Tasks",team:"Team",contrib:"CONTRIBUTIONS_OBJECTIFS",objectives:"Objectifs",axes:"Axes_Strategiques",activities:"Activites",activityOffers:"Activites_OFS",offers:"Offres_Services",allocations:"Allocations",projectStages:"Etapes_Projet",featureStages:"Stades_Fonctionnalite",features:"Fonctionnalites",audit:"JOURNAL_ACTIONS"};
let db={},currentProjectId=null,taskFilter="all",busy=false,currentTab="project",detailTab="infos",typeFilter="all",offerTypeFilter="all",currentOfferId=null,projectSearch="",domainFilter="all",serviceFilter="all";
const $=id=>{
  const el=document.getElementById(id);
  if(!el) throw new Error(`Élément UI introuvable: #${id}`);
  return el;
};
function rows(d){if(!d||!Array.isArray(d.id))return[];const ks=Object.keys(d);return d.id.map((_,i)=>Object.fromEntries(ks.map(k=>[k,Array.isArray(d[k])?d[k][i]:d[k]])))}
async function fetchTable(k,t){try{return rows(await grist.docApi.fetchTable(t))}catch(e){console.warn(t,e);return[]}}
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
  if(filter!=="all"&&typeOf(p)!==filter)return false;
  const offer=projectOffer(p);
  if(serviceFilter!=="all"&&Number(offer?.id)!==Number(serviceFilter))return false;
  if(domainFilter!=="all"&&Number(projectDomainId(p))!==Number(domainFilter))return false;
  return true;
})}

async function load(){
  try{
  const es=await Promise.all(Object.entries(T).map(async([k,t])=>[k,await fetchTable(k,t)]));db=Object.fromEntries(es);
  if(!db.projects.length){banner("Projects est vide ou inaccessible.");return}
  if(!currentProjectId||!get("projects",currentProjectId))currentProjectId=db.projects[0].id;
  populatePortfolioFilters();
  populateProjectSelect();
  if(!currentOfferId&&db.offers.length)currentOfferId=db.offers[0].id;
  populateOfferSelect();
  renderAll();
  }catch(e){
    console.error("Erreur de chargement cockpit",e);
    banner(`Erreur de chargement : ${e?.message||e}`);
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
function renderAll(){renderPortfolioKpis();renderProject();renderOffer();}
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
function renderProjectList(){
  const ps=visibleProjects();
  $("projectList").innerHTML=ps.length?ps.map(p=>{
    const progress=pct(p.progression),active=p.id===currentProjectId;
    return`<div class="project-item ${active?"active":""}" data-project-id="${p.id}">
      <div>
        <div class="project-item-title">📁 ${esc(p.nom||`#${p.id}`)} ${typeBadge(p)}</div>
        <div class="project-item-meta">${esc(p.code||"")} • ${esc(p.statut||"")}</div>
      </div>
      <div class="project-item-progress"><strong>${progress}%</strong><div class="mini-progress"><div style="width:${progress}%"></div></div></div>
    </div>`}).join(""):'<div class="empty-state"><h3>Aucun résultat</h3><p>Modifiez le filtre ou la recherche.</p></div>';
  $("projectListFooter").textContent=`${ps.length} élément(s)`;
  document.querySelectorAll("[data-project-id]").forEach(el=>el.onclick=()=>{currentProjectId=Number(el.dataset.projectId);detailTab="infos";renderProjectList();renderProject();});
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
  
  strategy(cs);team(ts,as);gantt(ts);resourceLoad(ts,as);tasks(ts);projectStagesView(p,ts);productFeaturesView(p,ts);renderSynthesis(p,ts,cs,as);
  switchDetailTab(detailTab,false);
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

  $("summaryMain").innerHTML=`<div class="kv">
    <div class="key">Météo</div><div class="value">${weatherBadge(p,ts)}</div>
    <div class="key">Type</div><div class="value">${typeOf(p)==="produit"?"Produit":"Projet"}</div>
    <div class="key">Statut</div><div class="value">${esc(p.statut||"—")}</div>
    <div class="key">Priorité</div><div class="value">${esc(p.priorite||"—")}</div>
    <div class="key">Avancement</div><div class="value">${pct(p.progression)}%</div>
    <div class="key">Tâches actives</div><div class="value">${active}</div>
    <div class="key">Jalons</div><div class="value">${milestones.length}</div>
  </div>`;

  let alerts=[];
  if(criticalLate.length) alerts.push(`🔴 ${criticalLate.length} tâche(s) critique(s) ou haute priorité en retard`);
  else if(overdue.length) alerts.push(`🟠 ${overdue.length} tâche(s) en retard`);
  if(/haut|élev|critique|high/i.test(String(p.risque||""))) alerts.push(`🟠 Risque projet : ${p.risque}`);
  if(as.some(a=>Number(a.Allocation||0)>1)) alerts.push("🟠 Allocation ressource supérieure à 100%");
  if(ts.some(t=>!refs(t.assignees).length)) alerts.push("🟡 Certaines tâches ne sont pas assignées");
  $("summaryAlerts").innerHTML=alerts.length
    ? `<div class="alert-list">${alerts.map(x=>`<div class="alert-item warn">${esc(x)}</div>`).join("")}</div>`
    : `<div class="alert-item ok">🟢 Aucune alerte majeure</div>`;

  $("summaryAlerts").innerHTML += `<div class="dependency-summary">
    <div class="summary-line"><span>Dépendances inter-projets</span><strong>${externalDeps.length}</strong></div>
    <div class="summary-line"><span>Externes en retard</span><strong class="${lateExternalDeps.length?'bad':''}">${lateExternalDeps.length}</strong></div>
    ${externalDeps.length?`<div class="dependency-list">${externalDeps.slice(0,6).map(x=>`<div class="dependency-row"><span><strong>${esc(x.task.titre||"")}</strong><br><span class="muted">dépend de ${esc(taskDependencyLabel(x.dependency))}</span></span>${late(x.dependency)?'<span class="dependency-alert">En retard</span>':'<span class="dependency-ok">OK</span>'}</div>`).join("")}</div>`:""}
  </div>`;

  $("summaryDates").innerHTML=`<div class="kv">
    <div class="key">Début</div><div class="value">${dt(p.dateDebut)}</div>
    <div class="key">Fin prévue</div><div class="value">${dt(p.dateFin)}</div>
    <div class="key">Prochaine échéance</div><div class="value">${nextDue?`${esc(nextDue.titre||"")} — ${dt(nextDue.dateEcheance)}`:"—"}</div>
    <div class="key">Charge passée</div><div class="value">${Math.round(spent)} h</div>
    <div class="key">Charge estimée</div><div class="value">${Math.round(est)} h</div>
  </div>`;

  const objNames=cs.map(c=>get("objectives",id(c.Objectif_Libelle)||id(c.Objectif_Code2))?.Nom).filter(Boolean);
  $("summaryStrategy").innerHTML=`<div><strong>${cs.length} objectif(s) stratégique(s)</strong></div><div class="muted" style="margin-top:8px">${esc(objNames.slice(0,3).join(" • ")||"Aucun objectif associé")}</div>`;

  $("summaryBusiness").innerHTML=`<div class="kv">
    <div class="key">Offre</div><div class="value">${esc(offer?.Nom||"—")}</div>
    <div class="key">Activité OFS</div><div class="value">${esc(ao?.Activites_Nom||"—")}</div>
    <div class="key">Activité</div><div class="value">${esc(a?.Nom||"—")}</div>
  </div>`;

  $("summaryResources").innerHTML=`<div class="kv">
    <div class="key">Allocations</div><div class="value">${as.length}</div>
    <div class="key">Allocation cumulée</div><div class="value">${Math.round(allocTotal*100)}%</div>
    <div class="key">Ressources actives</div><div class="value">${new Set(as.map(a=>id(a.Ressource_Code)).filter(Boolean)).size}</div>
  </div>`;

  let nextText="Aucune attention particulière.";
  if(criticalLate.length) nextText=`Traiter en priorité ${criticalLate.length} tâche(s) critique(s) en retard.`;
  else if(overdue.length) nextText=`Résorber les ${overdue.length} tâche(s) en retard.`;
  else if(nextDue) nextText=`Sécuriser la prochaine échéance : ${nextDue.titre} (${dt(nextDue.dateEcheance)}).`;
  else if(cs.length===0) nextText="Associer au moins un objectif stratégique au projet.";
  $("summaryNext").innerHTML=`<div>${esc(nextText)}</div>`;
}

function switchDetailTab(tab,rerender=true){
  detailTab=tab;
  document.querySelectorAll("[data-detail-tab]").forEach(b=>b.classList.toggle("active",b.dataset.detailTab===tab));
  const map={tasks:"detailTasks",stages:"detailStages",features:"detailFeatures",objectives:"detailObjectives",resources:"detailResources",infos:"detailInfos"};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle("hidden",k!==tab));
  if(rerender&&tab==="tasks")gantt(taskRows(currentProjectId));
}
function kpi(l,v,s=""){return`<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${s}</div></div>`}
function bar(v){return`<div class="progress"><div style="width:${v}%"></div></div>`}

function projectStagesView(p,ts){
  if(typeOf(p)!=="projet"){$("projectStagesView").innerHTML='<div class="empty">Cette vue concerne les projets.</div>';return}
  const stages=[...db.projectStages].sort((a,b)=>Number(a.Ordre||0)-Number(b.Ordre||0));
  const current=id(p.etape_courante);
  if(!stages.length){$("projectStagesView").innerHTML='<div class="empty">Aucune étape dans Etapes_Projet. Crée le référentiel dans Admin & Audit.</div>';return}
  const currentStage=get("projectStages",current);
  $("projectStagesView").innerHTML=
    `<div class="lifecycle">${stages.map(s=>{const cls=s.id===current?"current":(currentStage&&Number(s.Ordre||0)<Number(currentStage.Ordre||0)?"done":"");return`<span class="stage-pill ${cls}">${esc(s.Nom||s.Code||"")}</span>`}).join("")}</div>`+
    stages.map(s=>{
      const st=ts.filter(t=>id(t.etape_projet)===s.id);
      const starts=st.map(t=>dms(t.dateDebut)).filter(Boolean),ends=st.map(t=>dms(t.dateEcheance)).filter(Boolean);
      const avg=st.length?Math.round(st.reduce((n,t)=>n+pct(t.progression),0)/st.length):0;
      return `<div class="stage-block">
        <div class="stage-head">
          <div><h4>${esc(s.Nom||s.Code||"")}</h4><div class="muted">${st.length} tâche(s) • ${avg}% • ${starts.length?dt(Math.min(...starts)):"—"} → ${ends.length?dt(Math.max(...ends)):"—"}</div></div>
          <button class="primary-outline" data-add-stage-task="${s.id}">+ Tâche</button>
        </div>
        ${st.length?`<table><thead><tr><th>Tâche</th><th>Fonctionnalité</th><th>Statut</th><th>Début</th><th>Échéance</th><th>Avancement</th><th></th></tr></thead><tbody>${st.map(t=>`<tr><td>${esc(t.titre||"")}</td><td>${esc(get("features",id(t.fonctionnalite))?.Nom||"—")}</td><td>${esc(t.statut||"")}</td><td>${dt(t.dateDebut)}</td><td>${dt(t.dateEcheance)}</td><td>${pct(t.progression)}%</td><td><button data-stage-edit-task="${t.id}">Modifier</button></td></tr>`).join("")}</tbody></table>`:'<div class="muted">Aucune tâche rattachée.</div>'}
      </div>`;
    }).join("");
  document.querySelectorAll("[data-add-stage-task]").forEach(b=>b.onclick=()=>openTask(null,{stageId:Number(b.dataset.addStageTask)}));
  document.querySelectorAll("[data-stage-edit-task]").forEach(b=>b.onclick=()=>openTask(Number(b.dataset.stageEditTask)));
}

function featureParentId(f){
  return id(f.parent)||id(f.projet_produit)||id(f.produit)||id(f.Project)||id(f.Projet);
}
function featureRowsForProject(pid){
  return db.features.filter(f=>featureParentId(f)===Number(pid));
}
function featureParentField(){
  const s=db.features[0]||{};
  if("parent" in s)return "parent";
  if("projet_produit" in s)return "projet_produit";
  if("produit" in s)return "produit";
  return "parent";
}
function productFeaturesView(p,ts){
  const fs=featureRowsForProject(p.id);
  if(!fs.length){
    $("productFeaturesView").innerHTML=typeOf(p)==="produit"
      ?'<div class="empty">Aucune fonctionnalité pour ce produit. Crée la première pour construire la roadmap.</div>'
      :'<div class="empty">Aucune fonctionnalité rattachée à ce projet.</div>';
    return;
  }
  $("productFeaturesView").innerHTML=`<div class="feature-grid">${fs.map(f=>{
    const st=get("featureStages",id(f.stade));
    const linked=ts.filter(t=>id(t.fonctionnalite)===f.id);
    const start=f.Date_Debut||f.dateDebut||null;
    const end=f.Date_Fin||f.dateFin||f.Date_Cible||null;
    return `<div class="feature-card"><div class="feature-card-head"><div><h4>${esc(f.Nom||"")}</h4><div class="feature-meta">${esc(f.Code||"")} • ${esc(st?.Nom||"Sans stade")}</div></div><strong>${pct(f.Progression)}%</strong></div><div class="feature-meta">${esc(f.Description||"")}</div><div class="metric-bar" style="margin-top:10px"><div style="width:${pct(f.Progression)}%"></div></div><div class="feature-meta">${linked.length} tâche(s) • ${dt(start)} → ${dt(end)}</div><div class="feature-actions"><button class="primary-outline" data-feature-task="${f.id}">+ Tâche</button><button data-feature-edit="${f.id}">Modifier</button><button class="danger" data-feature-del="${f.id}">Supprimer</button></div></div>`;
  }).join("")}</div>`;
  document.querySelectorAll("[data-feature-task]").forEach(b=>b.onclick=()=>openTask(null,{featureId:Number(b.dataset.featureTask)}));
  document.querySelectorAll("[data-feature-edit]").forEach(b=>b.onclick=()=>openFeature(Number(b.dataset.featureEdit)));
  document.querySelectorAll("[data-feature-del]").forEach(b=>b.onclick=()=>deleteFeature(Number(b.dataset.featureDel)));
}
/* ---------- Fonctionnalités (Projet / Produit) ---------- */
function openFeature(fid=null){
  const p=get("projects",currentProjectId);if(!p){banner("Sélectionne un Projet ou un Produit.");return}
  const f=$("featureForm"),row=fid?get("features",fid):null;f.reset();f.id.value=fid||"";
  $("featureDialogTitle").textContent=row?"Modifier la fonctionnalité":"Nouvelle fonctionnalité";
  if(row){["Code","Nom","Description","Priorite"].forEach(k=>f[k].value=row[k]??"");f.Progression.value=pct(row.Progression);f.Date_Debut.value=din(row.Date_Debut||row.dateDebut);f.Date_Fin.value=din(row.Date_Fin||row.dateFin);f.Date_Cible.value=din(row.Date_Cible);f.Actif.value=String(row.Actif!==false)}
  else{f.Progression.value=0;f.Actif.value="true"}
  opt(f.stade,db.featureStages,r=>r.Nom,row?id(row.stade):null,"— stade —");
  opt(f.Responsable,db.team,r=>r.nom,row?id(row.Responsable):null,"— responsable —");
  $("featureDialog").showModal()
}
$("featureForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fid=Number(f.id.value)||null,fields={Code:f.Code.value,Nom:f.Nom.value,Description:f.Description.value,stade:f.stade.value?Number(f.stade.value):null,Priorite:f.Priorite.value,Progression:fromPct(f.Progression.value),Date_Debut:gd(f.Date_Debut.value),Date_Fin:gd(f.Date_Fin.value),Date_Cible:gd(f.Date_Cible.value),Responsable:f.Responsable.value?Number(f.Responsable.value):null,Actif:f.Actif.value==="true"};fields[featureParentField()]=currentProjectId;$("featureDialog").close();await apply([[fid?"UpdateRecord":"AddRecord","Fonctionnalites",fid||null,fields]],fid?"Fonctionnalité mise à jour.":"Fonctionnalité créée.")}
async function deleteFeature(fid){const used=db.tasks.filter(t=>id(t.fonctionnalite)===fid).length;if(used){banner(`Suppression bloquée : ${used} tâche(s) utilisent cette fonctionnalité.`);return}if(confirm("Supprimer définitivement cette fonctionnalité ?"))await apply([["RemoveRecord","Fonctionnalites",fid]],"Fonctionnalité supprimée.")}

/* ---------- Project CRUD ---------- */
function banner(t){$("banner").textContent=t;$("banner").classList.remove("hidden")}function hideBanner(){$("banner").classList.add("hidden")}
function tableKeyFromName(name){return Object.keys(T).find(k=>T[k]===name)||null}
function auditValue(v){
  if(Array.isArray(v))return v;
  if(v && typeof v==="object")return v;
  return v??null;
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
  if(busy)return;
  busy=true;document.body.classList.add("busy");
  try{
    const finalActions=[...actions];
    // JOURNAL_ACTIONS est optionnelle : on journalise si elle est accessible.
    if(db.audit!==undefined){
      for(const a of actions){
        if(["AddRecord","UpdateRecord","RemoveRecord"].includes(a[0]) && a[1]!=="JOURNAL_ACTIONS"){
          finalActions.push(["AddRecord","JOURNAL_ACTIONS",null,auditPayload(a)]);
        }
      }
    }
    try{
      await grist.docApi.applyUserActions(finalActions);
    }catch(e){
      // Si JOURNAL_ACTIONS n'existe pas ou son schéma diffère, ne pas bloquer l'action métier.
      if(finalActions.length!==actions.length){
        console.warn("Journalisation impossible, action métier appliquée sans journal",e);
        await grist.docApi.applyUserActions(actions);
      }else throw e;
    }
    await load();banner(msg);setTimeout(()=>{if(!busy)hideBanner()},1700)
  }catch(e){console.error(e);banner(`Erreur Grist: ${e?.message||e}`)}
  finally{busy=false;document.body.classList.remove("busy")}
}
function opt(el,rows,label,selected=null,empty="—"){el.innerHTML=`<option value="">${empty}</option>`+rows.map(r=>`<option value="${r.id}" ${Number(selected)===Number(r.id)?"selected":""}>${esc(label(r))}</option>`).join("")}
function openProject(create=false){
  const f=$("projectForm");
  f.reset();
  f.id.value="";
  let p=null;

  if(!create){
    p=get("projects",currentProjectId);
    if(!p)return;
    f.id.value=String(p.id);
    $("projectDialogTitle").textContent="Modifier Projet / Produit";
    ["nom","code","statut","priorite","sponsor","risque"].forEach(k=>f[k].value=p[k]??"");
    f.Type.value=/produit/i.test(p.Type||"")?"Produit":"Projet";
    f.progression.value=pct(p.progression);
    f.budget.value=p.budget??"";
    f.valeurStrategique.value=p.valeurStrategique??"";
    f.dateDebut.value=din(p.dateDebut);
    f.dateFin.value=din(p.dateFin);
  }else{
    $("projectDialogTitle").textContent="Nouveau Projet / Produit";
    f.Type.value=typeFilter==="produit"?"Produit":"Projet";
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
  const rid=Number(f.id.value)||null;
  const fields={
    nom:f.nom.value,
    code:f.code.value,
    Type:f.Type.value,
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
  const lookup={nom:fields.nom,code:fields.code};
  $("projectDialog").close();

  if(rid){
    await apply([["UpdateRecord","Projects",rid,fields]],"Projet / Produit mis à jour.");
  }else{
    if(busy)return;
    busy=true;document.body.classList.add("busy");
    try{
      const actions=[["AddRecord","Projects",null,fields]];
      const finalActions=[...actions];
      if(db.audit!==undefined){
        for(const a of actions){
          finalActions.push(["AddRecord","JOURNAL_ACTIONS",null,auditPayload(a)]);
        }
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
      const created=[...db.projects]
        .filter(p=>String(p.nom||"")===lookup.nom && String(p.code||"")===lookup.code)
        .sort((a,b)=>Number(b.id)-Number(a.id))[0];
      if(created){
        currentProjectId=created.id;
        projectSearch="";
        $("projectSearch").value="";
        typeFilter="all";
        document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x.dataset.typeFilter==="all"));
        populateProjectSelect();
        renderPortfolioKpis();
        detailTab="infos";
        renderProject();
      }
      banner("Projet / Produit créé.");
    }catch(e){
      console.error(e);
      banner(`Erreur Grist: ${e?.message||e}`);
    }finally{
      busy=false;document.body.classList.remove("busy");
    }
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
document.querySelectorAll("[data-main-tab]").forEach(b=>b.onclick=()=>{currentTab=b.dataset.mainTab;document.querySelectorAll("[data-main-tab]").forEach(x=>x.classList.toggle("active",x===b));$("projectView").classList.toggle("hidden",currentTab!=="project");$("offerView").classList.toggle("hidden",currentTab!=="offer")});
document.querySelectorAll("[data-type-filter]").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.typeFilter;document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x===b));populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
document.querySelectorAll("[data-offer-type-filter]").forEach(b=>b.onclick=()=>{offerTypeFilter=b.dataset.offerTypeFilter;document.querySelectorAll("[data-offer-type-filter]").forEach(x=>x.classList.toggle("active",x===b));renderOffer()});
$("offerSelect").onchange=e=>{currentOfferId=Number(e.target.value);renderOffer()};
$("editProjectBtn").onclick=()=>openProject(false);$("newProjectBtn").onclick=()=>openProject(true);
$("deleteProjectBtn").onclick=deleteProject;
$("newTaskBtn").onclick=()=>openTask();$("newStageTaskBtn").onclick=()=>openTask();
$("addContributionBtn").onclick=openContribution;$("newFeatureBtn").onclick=()=>openFeature();
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));tasks(taskRows(currentProjectId))});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=$(b.dataset.close);if(d?.open)d.close()});

$("projectSearch").addEventListener("input",e=>{projectSearch=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
$("domainFilter").addEventListener("change",e=>{domainFilter=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
$("serviceFilter").addEventListener("change",e=>{serviceFilter=e.target.value;populateProjectSelect();renderPortfolioKpis();detailTab="infos";renderProject()});
document.querySelectorAll("[data-detail-tab]").forEach(b=>b.onclick=()=>switchDetailTab(b.dataset.detailTab));

grist.ready({requiredAccess:"full"});grist.onOptions(()=>load());load();
