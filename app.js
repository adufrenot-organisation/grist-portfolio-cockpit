
const VERSION="4.2.0";
const T={projects:"Projects",tasks:"Tasks",team:"Team",contrib:"CONTRIBUTIONS_OBJECTIFS",objectives:"Objectifs",axes:"Axes_Strategiques",activities:"Activites",activityOffers:"Activites_OFS",offers:"Offres_Services",allocations:"Allocations"};
let db={},currentProjectId=null,taskFilter="all",busy=false,currentTab="project",typeFilter="all",offerTypeFilter="all",currentOfferId=null;
const $=id=>document.getElementById(id);
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
  const es=await Promise.all(Object.entries(T).map(async([k,t])=>[k,await fetchTable(k,t)]));db=Object.fromEntries(es);
  if(!db.projects.length){banner("Projects est vide ou inaccessible.");return}
  if(!currentProjectId||!get("projects",currentProjectId))currentProjectId=db.projects[0].id;
  populateProjectSelect();
  if(!currentOfferId&&db.offers.length)currentOfferId=db.offers[0].id;
  populateOfferSelect();
  renderAll();
}
function populateProjectSelect(){
  const ps=filteredProjects();
  if(ps.length&&!ps.some(p=>p.id===currentProjectId))currentProjectId=ps[0].id;
  $("projectSelect").innerHTML=ps.map(p=>`<option value="${p.id}">${esc(p.nom||`#${p.id}`)} — ${typeOf(p)==="produit"?"Produit":"Projet"}</option>`).join("");
  if(currentProjectId)$("projectSelect").value=currentProjectId;
}
function populateOfferSelect(){
  $("offerSelect").innerHTML=db.offers.map(o=>`<option value="${o.id}">${esc(o.Nom||o.Code||`#${o.id}`)}</option>`).join("");
  if(currentOfferId)$("offerSelect").value=currentOfferId;
}
function renderAll(){renderProject();renderOffer();renderAdmin();}

function renderProject(){
  const p=get("projects",currentProjectId);if(!p)return;
  const ts=taskRows(p.id),cs=contribRows(p.id),as=allocRows(p.id);
  $("projectTitle").innerHTML=`${esc(p.nom||`Projet #${p.id}`)} ${typeBadge(p)}`;
  $("projectMeta").textContent=[p.code,p.statut,p.sponsor,p.Type].filter(Boolean).join(" • ");
  const active=ts.filter(t=>!done(t.statut)).length,overdue=ts.filter(late).length,milestones=ts.filter(t=>/jalon/i.test(String(t.type||""))).length,est=ts.reduce((n,t)=>n+Number(t.estimationH||0),0),spent=ts.reduce((n,t)=>n+Number(t.tempsPasse||0),0);
  $("kpis").innerHTML=kpi("Type",typeOf(p)==="produit"?"Produit":"Projet",typeBadge(p))+kpi("Avancement",`${pct(p.progression)}%`,bar(pct(p.progression)))+kpi("Tâches actives",active,`${ts.length} au total`)+kpi("En retard",overdue,overdue?"À traiter":"Aucune alerte")+kpi("Charge",`${spent}h`,`${est}h estimées`);
  strategy(cs);business(p);team(ts,as);alerts(p,ts,as);computedProgress(p,ts);gantt(ts);resourceLoad(ts,as);tasks(ts);diagnostic();
}
function kpi(l,v,s=""){return`<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${s}</div></div>`}
function bar(v){return`<div class="progress"><div style="width:${v}%"></div></div>`}

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
Allocations: ${db.allocations.length}</div>`;
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

/* ---------- Administration CRUD ---------- */
const ADMIN={
  axes:{label:"Axes stratégiques",table:"Axes_Strategiques",key:"axes",fields:[["Code","Code","text"],["Nom","Nom","text"],["Description","Description","text"],["Sponsor","Sponsor","text"],["Priorite","Priorité","text"],["Horizon","Horizon","text"],["Statut","Statut","text"]]},
  objectives:{label:"Objectifs",table:"Objectifs",key:"objectives",fields:[["Code","Code","text"],["Nom","Nom","text"],["Axe_Code","Axe stratégique","ref:axes"],["KPI","KPI","text"],["Valeur_Cible","Valeur cible","text"],["Echeance","Échéance","date"],["Responsable","Responsable","text"],["Statut","Statut","text"],["Progression","Progression (%)","percent"]]},
  offers:{label:"Offres de services",table:"Offres_Services",key:"offers",fields:[["Code","Code","text"],["Nom","Nom","text"],["Description","Description","text"],["Responsable","Responsable","text"],["Statut","Statut","text"]]},
  activityOffers:{label:"Activités OFS",table:"Activites_OFS",key:"activityOffers",fields:[["Activites_Nom","Nom","text"],["OFS_Code","Offre","ref:offers"]]},
  activities:{label:"Activités",table:"Activites",key:"activities",fields:[["Code","Code","text"],["Nom","Nom","text"],["Service_Code","Activité OFS","ref:activityOffers"],["Description","Description","text"],["Responsable","Responsable","text"],["Type","Type","text"],["Capacite_ETP","Capacité ETP","number"],["Statut","Statut","text"]]},
  team:{label:"Équipe / Team",table:"Team",key:"team",fields:[["nom","Nom","text"],["role","Rôle","text"],["capacite_ETP","Capacité ETP","number"]]}
};
function renderAdmin(){
  const k=$("adminTableSelect").value||"axes",cfg=ADMIN[k],rs=db[cfg.key]||[];$("adminTitle").textContent=cfg.label;
  if(!rs.length){$("adminTable").innerHTML='<div class="empty">Aucun enregistrement.</div>';return}
  $("adminTable").innerHTML=`<table><thead><tr>${cfg.fields.slice(0,5).map(f=>`<th>${esc(f[1])}</th>`).join("")}<th>Dépendances</th><th></th></tr></thead><tbody>${rs.map(r=>`<tr>${cfg.fields.slice(0,5).map(f=>`<td>${esc(displayField(r,f))}</td>`).join("")}<td class="admin-dependency">${dependencyCount(k,r.id)} usage(s)</td><td class="admin-actions"><button data-admin-edit="${r.id}">Modifier</button><button class="danger" data-admin-delete="${r.id}">Supprimer</button></td></tr>`).join("")}</tbody></table>`;
  document.querySelectorAll("[data-admin-edit]").forEach(b=>b.onclick=()=>openAdmin(Number(b.dataset.adminEdit)));
  document.querySelectorAll("[data-admin-delete]").forEach(b=>b.onclick=()=>deleteAdmin(Number(b.dataset.adminDelete)));
}
function displayField(r,f){const [name,,type]=f,v=r[name];if(type==="date")return dt(v);if(type==="percent")return pct(v)+"%";if(type.startsWith("ref:")){const key=type.split(":")[1],x=get(key,id(v));return x?.Nom||x?.nom||x?.Activites_Nom||x?.Code||""}return v??""}
function dependencyCount(k,rid){
  if(k==="axes")return db.objectives.filter(o=>id(o.Axe_Code)===rid).length;
  if(k==="objectives")return db.contrib.filter(c=>(id(c.Objectif_Libelle)||id(c.Objectif_Code2))===rid).length;
  if(k==="offers")return db.activityOffers.filter(x=>id(x.OFS_Code)===rid).length;
  if(k==="activityOffers")return db.activities.filter(a=>id(a.Service_Code)===rid).length;
  if(k==="activities")return db.projects.filter(p=>id(p.activite)===rid).length;
  if(k==="team")return db.projects.filter(p=>id(p.responsable)===rid).length+db.tasks.filter(t=>refs(t.assignees).includes(rid)).length+db.allocations.filter(a=>id(a.Ressource_Code)===rid).length;
  return 0;
}
function openAdmin(rid=null){
  const k=$("adminTableSelect").value,cfg=ADMIN[k],r=rid?get(cfg.key,rid):null;$("adminForm").id.value=rid||"";$("adminDialogTitle").textContent=(rid?"Modifier ":"Créer ")+cfg.label;
  $("adminFields").innerHTML=cfg.fields.map(([name,label,type])=>adminField(name,label,type,r?.[name])).join("");
  $("adminDependencyHint").textContent=rid?`${dependencyCount(k,rid)} dépendance(s) utilisent cet enregistrement. La suppression sera bloquée tant qu'elles existent.`:"Nouvel enregistrement.";
  $("adminDialog").showModal()
}
function adminField(name,label,type,v){
  if(type.startsWith("ref:")){const key=type.split(":")[1],rows=db[key]||[];return`<label>${esc(label)}<select name="${name}"><option value="">—</option>${rows.map(r=>`<option value="${r.id}" ${Number(id(v))===Number(r.id)?"selected":""}>${esc(r.Nom||r.nom||r.Activites_Nom||r.Code||`#${r.id}`)}</option>`).join("")}</select></label>`}
  if(type==="date")return`<label>${esc(label)}<input type="date" name="${name}" value="${din(v)}"></label>`;
  if(type==="number")return`<label>${esc(label)}<input type="number" step="0.01" name="${name}" value="${v??""}"></label>`;
  if(type==="percent")return`<label>${esc(label)}<input type="number" min="0" max="100" name="${name}" value="${pct(v)}"></label>`;
  return`<label>${esc(label)}<input name="${name}" value="${esc(v??"")}"></label>`
}
async function deleteAdmin(rid){
  const k=$("adminTableSelect").value,cfg=ADMIN[k],deps=dependencyCount(k,rid);if(deps){banner(`Suppression bloquée : ${deps} dépendance(s) utilisent cet enregistrement.`);return}
  if(confirm("Supprimer définitivement cet enregistrement ?"))await apply([["RemoveRecord",cfg.table,rid]],"Référentiel supprimé.")
}
$("adminForm").onsubmit=async e=>{e.preventDefault();const k=$("adminTableSelect").value,cfg=ADMIN[k],f=e.currentTarget,rid=Number(f.id.value)||null,fields={};
  for(const [name,,type] of cfg.fields){const el=f.elements[name];if(!el)continue;if(type.startsWith("ref:"))fields[name]=el.value?Number(el.value):null;else if(type==="date")fields[name]=gd(el.value);else if(type==="number")fields[name]=el.value===""?null:Number(el.value);else if(type==="percent")fields[name]=fromPct(el.value);else fields[name]=el.value}
  $("adminDialog").close();await apply([[rid?"UpdateRecord":"AddRecord",cfg.table,rid||null,fields]],rid?"Référentiel mis à jour.":"Référentiel créé.")
}

/* ---------- Project CRUD ---------- */
function banner(t){$("banner").textContent=t;$("banner").classList.remove("hidden")}function hideBanner(){$("banner").classList.add("hidden")}
async function apply(actions,msg){if(busy)return;busy=true;document.body.classList.add("busy");try{await grist.docApi.applyUserActions(actions);await load();banner(msg);setTimeout(()=>{if(!busy)hideBanner()},1700)}catch(e){console.error(e);banner(`Erreur Grist: ${e?.message||e}`)}finally{busy=false;document.body.classList.remove("busy")}}
function opt(el,rows,label,selected=null,empty="—"){el.innerHTML=`<option value="">${empty}</option>`+rows.map(r=>`<option value="${r.id}" ${Number(selected)===Number(r.id)?"selected":""}>${esc(label(r))}</option>`).join("")}
function openProject(){const p=get("projects",currentProjectId),f=$("projectForm");if(!p)return;["nom","code","statut","priorite","sponsor","risque"].forEach(k=>f[k].value=p[k]??"");f.Type.value=/produit/i.test(p.Type||"")?"Produit":"Projet";f.progression.value=pct(p.progression);f.budget.value=p.budget??"";f.valeurStrategique.value=p.valeurStrategique??"";f.dateDebut.value=din(p.dateDebut);f.dateFin.value=din(p.dateFin);opt(f.activite,db.activities,r=>r.Nom,id(p.activite),"— activité —");opt(f.responsable,db.team,r=>r.nom,id(p.responsable),"— responsable —");$("projectDialog").showModal()}
$("projectForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,fields={nom:f.nom.value,code:f.code.value,Type:f.Type.value,statut:f.statut.value,priorite:f.priorite.value,sponsor:f.sponsor.value,progression:fromPct(f.progression.value),budget:f.budget.value===""?null:Number(f.budget.value),risque:f.risque.value,valeurStrategique:f.valeurStrategique.value===""?null:Number(f.valeurStrategique.value),activite:f.activite.value?Number(f.activite.value):null,responsable:f.responsable.value?Number(f.responsable.value):null,dateDebut:gd(f.dateDebut.value),dateFin:gd(f.dateFin.value)};$("projectDialog").close();await apply([["UpdateRecord","Projects",currentProjectId,fields]],"Projet / Produit mis à jour.")}

function fillMulti(el,rows,label,selected=[]){const s=new Set(selected.map(Number));el.innerHTML=rows.map(r=>`<option value="${r.id}" ${s.has(Number(r.id))?"selected":""}>${esc(label(r))}</option>`).join("")}
function openTask(tid=null){const f=$("taskForm");f.reset();f.id.value=tid||"";const t=tid?get("tasks",tid):null;$("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";if(t){["titre","description","Code","type","statut","priorite","estimationH","tempsPasse"].forEach(k=>f[k].value=t[k]??"");f.progression.value=pct(t.progression);f.dateDebut.value=din(t.dateDebut);f.dateEcheance.value=din(t.dateEcheance);f.tags.value=Array.isArray(t.tags)?t.tags.filter(x=>typeof x==="string").join(", "):""}else{f.type.value="tache";f.progression.value=0}fillMulti(f.assignees,db.team,r=>r.nom,t?refs(t.assignees):[]);fillMulti(f.dependDe,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?refs(t.dependDe):[]);opt(f.parentTask,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?id(t.parentTask):null,"— aucune —");$("taskDialog").showModal()}
$("taskForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,tid=Number(f.id.value)||null,tags=f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),fields={titre:f.titre.value,description:f.description.value,Code:f.Code.value,type:f.type.value,statut:f.statut.value,priorite:f.priorite.value,progression:fromPct(f.progression.value),estimationH:f.estimationH.value===""?null:Number(f.estimationH.value),tempsPasse:f.tempsPasse.value===""?null:Number(f.tempsPasse.value),dateDebut:gd(f.dateDebut.value),dateEcheance:gd(f.dateEcheance.value),projet:currentProjectId,assignees:reflist([...f.assignees.selectedOptions].map(o=>Number(o.value))),dependDe:reflist([...f.dependDe.selectedOptions].map(o=>Number(o.value))),parentTask:f.parentTask.value?Number(f.parentTask.value):null,tags:["L",...tags]};$("taskDialog").close();await apply([[tid?"UpdateRecord":"AddRecord","Tasks",tid||null,fields]],tid?"Tâche mise à jour.":"Tâche créée.")}
async function deleteTask(tid){const t=get("tasks",tid);if(t&&confirm(`Supprimer « ${t.titre} » ?`))await apply([["RemoveRecord","Tasks",tid]],"Tâche supprimée.")}
function openContribution(){const f=$("contributionForm"),existing=new Set(contribRows(currentProjectId).map(c=>id(c.Objectif_Libelle)||id(c.Objectif_Code2)));const choices=db.objectives.filter(o=>!existing.has(o.id));opt(f.objectif,choices,r=>r.Nom,null,"Choisir un objectif…");f.contribution.value=100;f.commentaire.value="";$("contributionDialog").showModal()}
$("contributionForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,oid=Number(f.objectif.value),fields={Projet_Code:reflist([currentProjectId]),Objectif_Libelle:oid,Objectif_Code2:oid,Contributions_Objectifs:fromPct(f.contribution.value),Commentaire:f.commentaire.value};$("contributionDialog").close();await apply([["AddRecord","CONTRIBUTIONS_OBJECTIFS",null,fields]],"Objectif associé.")}
async function removeContribution(cid){if(confirm("Retirer cet objectif ?"))await apply([["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",cid]],"Contribution retirée.")}
async function deleteProject(){const p=get("projects",currentProjectId),ts=taskRows(currentProjectId),cs=contribRows(currentProjectId),as=allocRows(currentProjectId);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.nom} » (${typeOf(p)}) ?`))return;const actions=[...ts.map(x=>["RemoveRecord","Tasks",x.id]),...cs.map(x=>["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",x.id]),...as.map(x=>["RemoveRecord","Allocations",x.id]),["RemoveRecord","Projects",p.id]];currentProjectId=null;await apply(actions,"Projet / Produit supprimé.")}

/* ---------- events ---------- */
document.querySelectorAll("[data-main-tab]").forEach(b=>b.onclick=()=>{currentTab=b.dataset.mainTab;document.querySelectorAll("[data-main-tab]").forEach(x=>x.classList.toggle("active",x===b));$("projectView").classList.toggle("hidden",currentTab!=="project");$("offerView").classList.toggle("hidden",currentTab!=="offer");$("adminView").classList.toggle("hidden",currentTab!=="admin");$("projectPickerWrap").classList.toggle("hidden",currentTab!=="project")});
document.querySelectorAll("[data-type-filter]").forEach(b=>b.onclick=()=>{typeFilter=b.dataset.typeFilter;document.querySelectorAll("[data-type-filter]").forEach(x=>x.classList.toggle("active",x===b));populateProjectSelect();renderProject()});
document.querySelectorAll("[data-offer-type-filter]").forEach(b=>b.onclick=()=>{offerTypeFilter=b.dataset.offerTypeFilter;document.querySelectorAll("[data-offer-type-filter]").forEach(x=>x.classList.toggle("active",x===b));renderOffer()});
$("projectSelect").onchange=e=>{currentProjectId=Number(e.target.value);renderProject()};$("offerSelect").onchange=e=>{currentOfferId=Number(e.target.value);renderOffer()};$("adminTableSelect").onchange=renderAdmin;$("adminNewBtn").onclick=()=>openAdmin();$("editProjectBtn").onclick=openProject;$("deleteProjectBtn").onclick=deleteProject;$("newTaskBtn").onclick=()=>openTask();$("addContributionBtn").onclick=openContribution;$("refreshBtn").onclick=load;
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));tasks(taskRows(currentProjectId))});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=$(b.dataset.close);if(d?.open)d.close()});
grist.ready({requiredAccess:"full"});grist.onOptions(()=>load());load();
