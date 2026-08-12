
const VERSION="4.5.1";
const T={projects:"Projects",tasks:"Tasks",team:"Team",contrib:"CONTRIBUTIONS_OBJECTIFS",objectives:"Objectifs",axes:"Axes_Strategiques",activities:"Activites",activityOffers:"Activites_OFS",offers:"Offres_Services",allocations:"Allocations",projectStages:"Etapes_Projet",featureStages:"Stades_Fonctionnalite",features:"Fonctionnalites",audit:"JOURNAL_ACTIONS"};
let db={},currentProjectId=null,taskFilter="all",busy=false,currentTab="project",detailTab="overview",typeFilter="all",offerTypeFilter="all",currentOfferId=null,projectSearch="";
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
function filteredProjects(filter=typeFilter){return db.projects.filter(p=>filter==="all"||typeOf(p)===filter)}

async function load(){
  try{
  const es=await Promise.all(Object.entries(T).map(async([k,t])=>[k,await fetchTable(k,t)]));db=Object.fromEntries(es);
  if(!db.projects.length){banner("Projects est vide ou inaccessible.");return}
  if(!currentProjectId||!get("projects",currentProjectId))currentProjectId=db.projects[0].id;
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
  document.querySelectorAll("[data-project-id]").forEach(el=>el.onclick=()=>{currentProjectId=Number(el.dataset.projectId);renderProjectList();renderProject();});
}
function renderProject(){
  const p=get("projects",currentProjectId);
  if(!p){$("projectEmpty").classList.remove("hidden");$("projectDetail").classList.add("hidden");return}
  $("projectEmpty").classList.add("hidden");$("projectDetail").classList.remove("hidden");
  const ts=taskRows(p.id),cs=contribRows(p.id),as=allocRows(p.id);
  $("projectTitle").textContent=p.nom||`Projet #${p.id}`;
  $("projectTypeBadge").innerHTML=typeBadge(p);
  document.querySelectorAll(".project-only").forEach(x=>x.classList.toggle("hidden",typeOf(p)!=="projet"));
  document.querySelectorAll(".product-only").forEach(x=>x.classList.toggle("hidden",typeOf(p)!=="produit"));
  if(typeOf(p)==="projet"&&detailTab==="features")detailTab="overview";if(typeOf(p)==="produit"&&detailTab==="stages")detailTab="overview";
  const resp=get("team",id(p.responsable));
  $("projectMeta").textContent=[p.code,p.statut,resp?.nom?`Responsable : ${resp.nom}`:null].filter(Boolean).join(" • ");
  progressSummary(p,ts);dateSummary(p,ts);loadSummary(ts);activitySummary(p);offerSummary(p);objectiveSummary(cs);statusSummary(p);
  strategy(cs);business(p);team(ts,as);alerts(p,ts,as);gantt(ts);resourceLoad(ts,as);tasks(ts);projectStagesView(p,ts);productFeaturesView(p,ts);diagnostic();
  switchDetailTab(detailTab,false);
}
function progressSummary(p,ts){
  const xs=ts.filter(t=>!/jalon/i.test(String(t.type||"")));
  const avg=xs.length?Math.round(xs.reduce((n,t)=>n+pct(t.progression),0)/xs.length):pct(p.progression);
  const doneCount=xs.filter(t=>done(t.statut)||pct(t.progression)>=100).length;
  $("progressSummary").innerHTML=`<div style="display:flex;align-items:center;gap:18px"><div style="font-size:34px;font-weight:800">${avg}%</div><div><div>Basé sur les tâches</div><div class="muted">${doneCount} / ${xs.length} tâches terminées</div></div></div><div class="metric-bar" style="margin-top:14px"><div style="width:${avg}%"></div></div>`;
}
function dateSummary(p,ts){
  const starts=ts.map(t=>dms(t.dateDebut)).filter(Boolean),ends=ts.map(t=>dms(t.dateEcheance)).filter(Boolean);
  const start=p.dateDebut|| (starts.length?Math.min(...starts):null),end=p.dateFin||(ends.length?Math.max(...ends):null);
  $("dateSummary").innerHTML=`<div class="kv"><div class="key">Début</div><div class="value">${dt(start)}</div><div class="key">Fin prévue</div><div class="value">${dt(end)}</div><div class="key">Retard</div><div class="value">${ts.filter(late).length} tâche(s)</div></div>`;
}
function loadSummary(ts){
  const est=ts.reduce((n,t)=>n+Number(t.estimationH||0),0),spent=ts.reduce((n,t)=>n+Number(t.tempsPasse||0),0),remain=Math.max(0,est-spent);
  $("loadSummary").innerHTML=`<div><strong style="font-size:22px">${Math.round(remain)} h</strong> <span class="muted">Estimées restantes</span></div><div class="metric-bar" style="margin:12px 0"><div style="width:${est?Math.min(100,spent/est*100):0}%"></div></div><div><strong>${Math.round(spent)} h</strong> <span class="muted">Passées</span></div><div class="muted" style="margin-top:5px">${Math.round(est)} h estimées totales</div>`;
}
function activitySummary(p){
  const a=get("activities",id(p.activite));$("activitySummary").innerHTML=`<div><strong>${a?.Nom||"—"}</strong></div><div class="muted" style="margin-top:8px">${a?.Type||""}</div>`;
}
function offerSummary(p){
  const a=get("activities",id(p.activite)),ao=a?get("activityOffers",id(a.Service_Code)):null,o=ao?get("offers",id(ao.OFS_Code)):null;
  $("offerSummary").innerHTML=`<div><strong style="color:#067647">${esc(o?.Nom||"—")}</strong></div><div class="muted" style="margin-top:8px">${esc(ao?.Activites_Nom||"")}</div>`;
}
function objectiveSummary(cs){$("objectiveSummary").innerHTML=`<div><strong>${cs.length} objectif(s)</strong></div><div class="muted" style="margin-top:8px">${cs.slice(0,2).map(c=>get("objectives",id(c.Objectif_Libelle)||id(c.Objectif_Code2))?.Nom).filter(Boolean).join(" • ")}</div>`}
function statusSummary(p){$("statusSummary").innerHTML=`<div class="type-badge projet">Statut : ${esc(p.statut||"—")}</div><div style="height:8px"></div><div class="type-badge produit">Priorité : ${esc(p.priorite||"—")}</div>`}
function switchDetailTab(tab,rerender=true){
  detailTab=tab;
  document.querySelectorAll("[data-detail-tab]").forEach(b=>b.classList.toggle("active",b.dataset.detailTab===tab));
  const map={overview:"detailOverview",tasks:"detailTasks",stages:"detailStages",features:"detailFeatures",objectives:"detailObjectives",resources:"detailResources",infos:"detailInfos"};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle("hidden",k!==tab));
  if(rerender&&tab==="tasks")gantt(taskRows(currentProjectId));
}
function kpi(l,v,s=""){return`<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${s}</div></div>`}
function bar(v){return`<div class="progress"><div style="width:${v}%"></div></div>`}

function projectStagesView(p,ts){if(typeOf(p)!=="projet"){$("projectStagesView").innerHTML='<div class="empty">Cette vue concerne les projets.</div>';return}const stages=[...db.projectStages].sort((a,b)=>Number(a.Ordre||0)-Number(b.Ordre||0)),current=id(p.etape_courante),cur=get("projectStages",current);$("projectStagesView").innerHTML=`<div class="lifecycle">${stages.map(s=>`<span class="stage-pill ${s.id===current?"current":(cur&&Number(s.Ordre||0)<Number(cur.Ordre||0)?"done":"")}">${esc(s.Nom||s.Code||"")}</span>`).join("")}</div>`+stages.map(s=>{const st=ts.filter(t=>id(t.etape_projet)===s.id);return `<div class="stage-block"><h4>${esc(s.Nom||s.Code||"")}</h4>${st.length?`<table><thead><tr><th>Tâche</th><th>Statut</th><th>Avancement</th></tr></thead><tbody>${st.map(t=>`<tr><td>${esc(t.titre||"")}</td><td>${esc(t.statut||"")}</td><td>${pct(t.progression)}%</td></tr>`).join("")}</tbody></table>`:'<div class="muted">Aucune tâche rattachée.</div>'}</div>`}).join("")}
function productFeaturesView(p,ts){if(typeOf(p)!=="produit"){$("productFeaturesView").innerHTML='<div class="empty">Cette vue concerne les produits.</div>';return}const fs=db.features.filter(f=>id(f.produit)===p.id);$("productFeaturesView").innerHTML=fs.length?`<div class="feature-grid">${fs.map(f=>{const st=get("featureStages",id(f.stade)),linked=ts.filter(t=>id(t.fonctionnalite)===f.id);return `<div class="feature-card"><div class="feature-card-head"><div><h4>${esc(f.Nom||"")}</h4><div class="feature-meta">${esc(f.Code||"")} • ${esc(st?.Nom||"Sans stade")}</div></div><strong>${pct(f.Progression)}%</strong></div><div class="feature-meta">${esc(f.Description||"")}</div><div class="metric-bar" style="margin-top:10px"><div style="width:${pct(f.Progression)}%"></div></div><div class="feature-meta">${linked.length} tâche(s) • cible ${dt(f.Date_Cible)}</div><div class="feature-actions"><button data-feature-edit="${f.id}">Modifier</button><button class="danger" data-feature-del="${f.id}">Supprimer</button></div></div>`}).join("")}</div>`:'<div class="empty">Aucune fonctionnalité pour ce produit.</div>';document.querySelectorAll("[data-feature-edit]").forEach(b=>b.onclick=()=>openFeature(Number(b.dataset.featureEdit)));document.querySelectorAll("[data-feature-del]").forEach(b=>b.onclick=()=>deleteFeature(Number(b.dataset.featureDel)))}
function strategy(cs){
  $("objectiveCount").textContent=`${cs.length} contribution${cs.length>1?"s":""}`;
  if(!cs.length){$("strategy").innerHTML='<div class="empty">Aucun objectif rattaché.</div>';return}
  $("strategy").innerHTML=`<table><thead><tr><th>Axe</th><th>Objectif</th><th>Contribution</th><th>Échéance</th><th></th></tr></thead><tbody>${cs.map(c=>{const oid=id(c.Objectif_Libelle)||id(c.Objectif_Code2);const o=get("objectives",oid),a=o?get("axes",id(o.Axe_Code)):null;return`<tr><td>${esc(a?.Nom||"—")}</td><td><strong>${esc(o?.Nom||"—")}</strong><br><span class="muted">${esc(o?.KPI||"")}</span></td><td>${pct(c.Contributions_Objectifs)}%</td><td>${dt(o?.Echeance)}</td><td><button class="danger" data-rmcontrib="${c.id}">Retirer</button></td></tr>`}).join("")}</tbody></table>`;
  document.querySelectorAll("[data-rmcontrib]").forEach(b=>b.onclick=()=>removeContribution(Number(b.dataset.rmcontrib)))
}
function business(p){
  const a=get("activities",id(p.activite));const ao=a?get("activityOffers",id(a.Service_Code)):null;const offer=ao?get("offers",id(ao.OFS_Code)):null;
  $("business").innerHTML=`<div class="kv"><div class="key">Type</div><div class="value">${typeBadge(p)}</div><div class="key">Offre</div><div class="value">${esc(offer?.Nom||"—")}</div><div class="key">Activité OFS</div><div class="value">${esc(ao?.Activites_Nom||"—")}</div><div class="key">Activité</div><div class="value">${esc(a?.Nom||"—")}</div><div class="key">Risque</div><div class="value">${esc(p.risque||"—")}</div><div class="key">Valeur stratégique</div><div class="value">${esc(p.valeurStrategique??"—")}</div></div>`
}
function team(ts,as){
  const ids=new Set();ts.forEach(t=>refs(t.assignees).forEach(x=>ids.add(x)));as.forEach(a=>{const x=id(a.Ressource_Code);if(x)ids.add(x)});
  if(!ids.size){$("team").innerHTML='<div class="empty">Aucune ressource affectée.</div>';return}
  $("team").innerHTML=[...ids].map(x=>{const m=get("team",x),alloc=as.filter(a=>id(a.Ressource_Code)===x).reduce((n,a)=>n+Number(a.Allocation||0),0);return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f1f3"><div><strong>${esc(m?.nom||`#${x}`)}</strong><div class="muted">${esc(m?.role||"")} • capacité ${m?.capacite_ETP??"—"} ETP</div></div><span>${alloc?pct(alloc)+"%":""}</span></div>`}).join("")
}
function alerts(p,ts,as){
  const items=[];const overdue=ts.filter(late);if(overdue.length)items.push(["danger","⚠️",`${overdue.length} tâche(s) en retard.`]);
  const overAlloc=as.filter(a=>Number(a.Allocation||0)>1);if(overAlloc.length)items.push(["danger","👥",`${overAlloc.length} allocation(s) > 100%.`]);
  const noDates=ts.filter(t=>!t.dateDebut&&!t.dateEcheance);if(noDates.length)items.push(["warn","📅",`${noDates.length} tâche(s) sans date.`]);
  const unassigned=ts.filter(t=>!refs(t.assignees).length);if(unassigned.length)items.push(["warn","🙋",`${unassigned.length} tâche(s) non assignée(s).`]);
  if(/haut|élev|critique|high/i.test(String(p.risque||"")))items.push(["danger","🔥",`Risque ${p.risque}.`]);
  if(!items.length)items.push(["ok","✅","Aucune alerte majeure."]);
  $("alerts").innerHTML=`<div class="alert-list">${items.map(([l,i,t])=>`<div class="alert-item ${l}"><div class="alert-icon">${i}</div><div>${esc(t)}</div></div>`).join("")}</div>`;
}
function computedProgress(p,ts){
  const xs=ts.filter(t=>!/jalon/i.test(String(t.type||"")));const avg=xs.length?Math.round(xs.reduce((n,t)=>n+pct(t.progression),0)/xs.length):0;
  const est=xs.reduce((n,t)=>n+Number(t.estimationH||0),0),weighted=est?Math.round(xs.reduce((n,t)=>n+pct(t.progression)*Number(t.estimationH||0),0)/est):avg,decl=pct(p.progression);
  $("computedProgress").innerHTML=`<div class="metric-stack"><div class="metric-line"><span>Déclaré</span><div class="metric-bar"><div style="width:${decl}%"></div></div><strong>${decl}%</strong></div><div class="metric-line"><span>Moyenne tâches</span><div class="metric-bar"><div style="width:${avg}%"></div></div><strong>${avg}%</strong></div><div class="metric-line"><span>Pondéré charge</span><div class="metric-bar"><div style="width:${weighted}%"></div></div><strong>${weighted}%</strong></div></div>`;
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
function diagnostic(){
  $("diagnostic").innerHTML=`<div class="diag">VERSION ${VERSION}
Projects: ${db.projects.length} (${db.projects.filter(p=>typeOf(p)==="projet").length} projets / ${db.projects.filter(p=>typeOf(p)==="produit").length} produits)
Tasks: ${db.tasks.length}
Team: ${db.team.length}
CONTRIBUTIONS_OBJECTIFS: ${db.contrib.length}
Objectifs: ${db.objectives.length}
Axes_Strategiques: ${db.axes.length}
Activites: ${db.activities.length}
Activites_OFS: ${db.activityOffers.length}
Offres_Services: ${db.offers.length}
Allocations: ${db.allocations.length}
Etapes_Projet: ${db.projectStages.length}
Stades_Fonctionnalite: ${db.featureStages.length}
Fonctionnalites: ${db.features.length}</div>`;
}

/* ---------- Offre de services ---------- */
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

/* ---------- Fonctionnalités produit ---------- */
function openFeature(fid=null){const p=get("projects",currentProjectId);if(!p||typeOf(p)!=="produit"){banner("Sélectionne un Produit.");return}const f=$("featureForm"),row=fid?get("features",fid):null;f.reset();f.id.value=fid||"";$("featureDialogTitle").textContent=row?"Modifier la fonctionnalité":"Nouvelle fonctionnalité";if(row){["Code","Nom","Description","Priorite"].forEach(k=>f[k].value=row[k]??"");f.Progression.value=pct(row.Progression);f.Date_Cible.value=din(row.Date_Cible);f.Actif.value=String(row.Actif!==false)}else{f.Progression.value=0;f.Actif.value="true"}opt(f.stade,db.featureStages,r=>r.Nom,row?id(row.stade):null,"— stade —");opt(f.Responsable,db.team,r=>r.nom,row?id(row.Responsable):null,"— responsable —");$("featureDialog").showModal()}
$("featureForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fid=Number(f.id.value)||null,fields={Code:f.Code.value,Nom:f.Nom.value,Description:f.Description.value,produit:currentProjectId,stade:f.stade.value?Number(f.stade.value):null,Priorite:f.Priorite.value,Progression:fromPct(f.Progression.value),Date_Cible:gd(f.Date_Cible.value),Responsable:f.Responsable.value?Number(f.Responsable.value):null,Actif:f.Actif.value==="true"};$("featureDialog").close();await apply([[fid?"UpdateRecord":"AddRecord","Fonctionnalites",fid||null,fields]],fid?"Fonctionnalité mise à jour.":"Fonctionnalité créée.")};
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
function openProject(){const p=get("projects",currentProjectId),f=$("projectForm");if(!p)return;["nom","code","statut","priorite","sponsor","risque"].forEach(k=>f[k].value=p[k]??"");f.Type.value=/produit/i.test(p.Type||"")?"Produit":"Projet";f.progression.value=pct(p.progression);f.budget.value=p.budget??"";f.valeurStrategique.value=p.valeurStrategique??"";f.dateDebut.value=din(p.dateDebut);f.dateFin.value=din(p.dateFin);opt(f.activite,db.activities,r=>r.Nom,id(p.activite),"— activité —");opt(f.etape_courante,db.projectStages,r=>r.Nom,id(p.etape_courante),"— étape courante —");opt(f.responsable,db.team,r=>r.nom,id(p.responsable),"— responsable —");$("projectDialog").showModal()}
$("projectForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fields={nom:f.nom.value,code:f.code.value,Type:f.Type.value,statut:f.statut.value,priorite:f.priorite.value,sponsor:f.sponsor.value,progression:fromPct(f.progression.value),budget:f.budget.value===""?null:Number(f.budget.value),risque:f.risque.value,valeurStrategique:f.valeurStrategique.value===""?null:Number(f.valeurStrategique.value),activite:f.activite.value?Number(f.activite.value):null,etape_courante:f.etape_courante.value?Number(f.etape_courante.value):null,responsable:f.responsable.value?Number(f.responsable.value):null,dateDebut:gd(f.dateDebut.value),dateFin:gd(f.dateFin.value)};$("projectDialog").close();await apply([["UpdateRecord","Projects",currentProjectId,fields]],"Projet / Produit mis à jour.")}

function fillMulti(el,rows,label,selected=[]){const s=new Set(selected.map(Number));el.innerHTML=rows.map(r=>`<option value="${r.id}" ${s.has(Number(r.id))?"selected":""}>${esc(label(r))}</option>`).join("")}
function openTask(tid=null){const f=$("taskForm");f.reset();f.id.value=tid||"";const t=tid?get("tasks",tid):null;$("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";if(t){["titre","description","Code","type","statut","priorite","estimationH","tempsPasse"].forEach(k=>f[k].value=t[k]??"");f.progression.value=pct(t.progression);f.dateDebut.value=din(t.dateDebut);f.dateEcheance.value=din(t.dateEcheance);f.tags.value=Array.isArray(t.tags)?t.tags.filter(x=>typeof x==="string").join(", "):""}else{f.type.value="tache";f.progression.value=0}opt(f.etape_projet,db.projectStages,r=>r.Nom,t?id(t.etape_projet):null,"— étape projet —");opt(f.fonctionnalite,db.features.filter(x=>id(x.produit)===currentProjectId),r=>r.Nom,t?id(t.fonctionnalite):null,"— fonctionnalité —");fillMulti(f.assignees,db.team,r=>r.nom,t?refs(t.assignees):[]);fillMulti(f.dependDe,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?refs(t.dependDe):[]);opt(f.parentTask,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?id(t.parentTask):null,"— aucune —");$("taskDialog").showModal()}
$("taskForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,tid=Number(f.id.value)||null,tags=f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),fields={titre:f.titre.value,description:f.description.value,Code:f.Code.value,type:f.type.value,statut:f.statut.value,priorite:f.priorite.value,progression:fromPct(f.progression.value),estimationH:f.estimationH.value===""?null:Number(f.estimationH.value),tempsPasse:f.tempsPasse.value===""?null:Number(f.tempsPasse.value),dateDebut:gd(f.dateDebut.value),dateEcheance:gd(f.dateEcheance.value),etape_projet:f.etape_projet.value?Number(f.etape_projet.value):null,fonctionnalite:f.fonctionnalite.value?Number(f.fonctionnalite.value):null,projet:currentProjectId,assignees:reflist([...f.assignees.selectedOptions].map(o=>Number(o.value))),dependDe:reflist([...f.dependDe.selectedOptions].map(o=>Number(o.value))),parentTask:f.parentTask.value?Number(f.parentTask.value):null,tags:["L",...tags]};$("taskDialog").close();await apply([[tid?"UpdateRecord":"AddRecord","Tasks",tid||null,fields]],tid?"Tâche mise à jour.":"Tâche créée.")}
async function deleteTask(tid){const t=get("tasks",tid);if(t&&confirm(`Supprimer « ${t.titre} » ?`))await apply([["RemoveRecord","Tasks",tid]],"Tâche supprimée.")}
function openContribution(){const f=$("contributionForm"),existing=new Set(contribRows(currentProjectId).map(c=>id(c.Objectif_Libelle)||id(c.Objectif_Code2)));const choices=db.objectives.filter(o=>!existing.has(o.id));opt(f.objectif,choices,r=>r.Nom,null,"Choisir un objectif…");f.contribution.value=100;f.commentaire.value="";$("contributionDialog").showModal()}
$("contributionForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,oid=Number(f.objectif.value),fields={Projet_Code:reflist([currentProjectId]),Objectif_Libelle:oid,Objectif_Code2:oid,Contributions_Objectifs:fromPct(f.contribution.value),Commentaire:f.commentaire.value};$("contributionDialog").close();await apply([["AddRecord","CONTRIBUTIONS_OBJECTIFS",null,fields]],"Objectif associé.")}
async function removeContribution(cid){if(confirm("Retirer cet objectif ?"))await apply([["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",cid]],"Contribution retirée.")}
async function deleteProject(){const p=get("projects",currentProjectId),ts=taskRows(currentProjectId),cs=contribRows(currentProjectId),as=allocRows(currentProjectId);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.nom} » (${typeOf(p)}) ?`))return;const actions=[...ts.map(x=>["RemoveRecord","Tasks",x.id]),...cs.map(x=>["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",x.id]),...as.map(x=>["RemoveRecord","Allocations",x.id]),["RemoveRecord","Projects",p.id]];currentProjectId=null;await apply(actions,"Projet / Produit supprimé.")}

/* ---------- events ---------- */
document.querySelectorAll("[data-main-tab]").forEach(b=>b.onclick=()=>{currentTab=b.dataset.mainTab;document.querySelectorAll("[data-main-tab]").forEach(x=>x.classList.toggle("active",x===b));$("projectView").classList.toggle("hidden",currentTab!=="project");$("offerView").classList.toggle("hidden",currentTab!=="offer")});
document.querySelectorAll("[data-type-filter]").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.typeFilter;document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x===b));populateProjectSelect();renderPortfolioKpis();renderProject()});
document.querySelectorAll("[data-offer-type-filter]").forEach(b=>b.onclick=()=>{offerTypeFilter=b.dataset.offerTypeFilter;document.querySelectorAll("[data-offer-type-filter]").forEach(x=>x.classList.toggle("active",x===b));renderOffer()});
$("offerSelect").onchange=e=>{currentOfferId=Number(e.target.value);renderOffer()};
$("editProjectBtn").onclick=openProject;
$("deleteProjectBtn").onclick=deleteProject;
$("newTaskBtn").onclick=()=>openTask();
$("addContributionBtn").onclick=openContribution;$("newFeatureBtn").onclick=()=>openFeature();
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));tasks(taskRows(currentProjectId))});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=$(b.dataset.close);if(d?.open)d.close()});

$("projectSearch").addEventListener("input",e=>{projectSearch=e.target.value;populateProjectSelect();renderPortfolioKpis();renderProject()});
document.querySelectorAll("[data-detail-tab]").forEach(b=>b.onclick=()=>switchDetailTab(b.dataset.detailTab));

grist.ready({requiredAccess:"full"});grist.onOptions(()=>load());load();
