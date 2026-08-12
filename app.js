
const VERSION="4.1.0";
const T={projects:"Projects",tasks:"Tasks",team:"Team",contrib:"CONTRIBUTIONS_OBJECTIFS",objectives:"Objectifs",axes:"Axes_Strategiques",activities:"Activites",activityOffers:"Activites_OFS",offers:"Offres_Services",allocations:"Allocations"};
let db={},currentProjectId=null,taskFilter="all",busy=false;
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
function taskRows(pid){return db.tasks.filter(t=>id(t.projet)===Number(pid))}
function contribRows(pid){return db.contrib.filter(c=>refs(c.Projet_Code).includes(Number(pid)))}
function allocRows(pid){return db.allocations.filter(a=>id(a.Projet_Code)===Number(pid))}
async function load(){
  const es=await Promise.all(Object.entries(T).map(async([k,t])=>[k,await fetchTable(k,t)]));db=Object.fromEntries(es);
  if(!db.projects.length){banner("Projects est vide ou inaccessible.");return}
  if(!currentProjectId||!get("projects",currentProjectId))currentProjectId=db.projects[0].id;
  $("projectSelect").innerHTML=db.projects.map(p=>`<option value="${p.id}">${esc(p.nom||`Projet #${p.id}`)}</option>`).join("");
  $("projectSelect").value=currentProjectId;render()
}
function render(){
  const p=get("projects",currentProjectId);if(!p)return;
  const ts=taskRows(p.id),cs=contribRows(p.id),as=allocRows(p.id);
  $("projectTitle").textContent=p.nom||`Projet #${p.id}`;
  $("projectMeta").textContent=[p.code,p.statut,p.sponsor,p.Type].filter(Boolean).join(" • ");
  const active=ts.filter(t=>!done(t.statut)).length, overdue=ts.filter(late).length, milestones=ts.filter(t=>/jalon/i.test(String(t.type||""))).length, est=ts.reduce((n,t)=>n+Number(t.estimationH||0),0), spent=ts.reduce((n,t)=>n+Number(t.tempsPasse||0),0);
  $("kpis").innerHTML=kpi("Avancement",`${pct(p.progression)}%`,bar(pct(p.progression)))+kpi("Tâches actives",active,`${ts.length} au total`)+kpi("En retard",overdue,overdue?"À traiter":"Aucune alerte")+kpi("Charge",`${spent}h`,`${est}h estimées`)+kpi("Budget",money(p.budget),`${milestones} jalon(s)`);
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
  $("business").innerHTML=`<div class="kv"><div class="key">Offre</div><div class="value">${esc(offer?.Nom||"—")}</div><div class="key">Activité OFS</div><div class="value">${esc(ao?.Activites_Nom||"—")}</div><div class="key">Activité</div><div class="value">${esc(a?.Nom||"—")}</div><div class="key">Responsable activité</div><div class="value">${esc(a?.Responsable||"—")}</div><div class="key">Risque</div><div class="value">${esc(p.risque||"—")}</div><div class="key">Valeur stratégique</div><div class="value">${esc(p.valeurStrategique??"—")}</div></div>`
}
function team(ts,as){
  const ids=new Set();ts.forEach(t=>refs(t.assignees).forEach(x=>ids.add(x)));as.forEach(a=>{const x=id(a.Ressource_Code);if(x)ids.add(x)});
  if(!ids.size){$("team").innerHTML='<div class="empty">Aucune ressource affectée.</div>';return}
  $("team").innerHTML=[...ids].map(x=>{const m=get("team",x),alloc=as.filter(a=>id(a.Ressource_Code)===x).reduce((n,a)=>n+Number(a.Allocation||0),0);return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f1f3"><div><strong>${esc(m?.nom||`#${x}`)}</strong><div class="muted">${esc(m?.role||"")} • capacité ${m?.capacite_ETP??"—"} ETP</div></div><span>${alloc?pct(alloc)+"%":""}</span></div>`}).join("")
}

function alerts(p,ts,as){
  const items=[];
  const overdue=ts.filter(late);
  if(overdue.length)items.push({level:"danger",icon:"⚠️",text:`${overdue.length} tâche(s) en retard.`});
  const overAlloc=as.filter(a=>Number(a.Allocation||0)>1);
  if(overAlloc.length)items.push({level:"danger",icon:"👥",text:`${overAlloc.length} allocation(s) dépassent 100%.`});
  const noDates=ts.filter(t=>!t.dateDebut&&!t.dateEcheance);
  if(noDates.length)items.push({level:"warn",icon:"📅",text:`${noDates.length} tâche(s) sans dates.`});
  const unassigned=ts.filter(t=>!refs(t.assignees).length);
  if(unassigned.length)items.push({level:"warn",icon:"🙋",text:`${unassigned.length} tâche(s) non assignée(s).`});
  const highRisk=/haut|élev|critique|high/i.test(String(p.risque||""));
  if(highRisk)items.push({level:"danger",icon:"🔥",text:`Risque projet : ${p.risque}.`});
  if(!items.length)items.push({level:"ok",icon:"✅",text:"Aucune alerte majeure détectée."});
  $("alerts").innerHTML=`<div class="alert-list">${items.map(x=>`<div class="alert-item ${x.level}"><div class="alert-icon">${x.icon}</div><div>${esc(x.text)}</div></div>`).join("")}</div>`;
}
function computedProgress(p,ts){
  const weighted=ts.filter(t=>!(/jalon/i.test(String(t.type||""))));
  const avg=weighted.length?Math.round(weighted.reduce((n,t)=>n+pct(t.progression),0)/weighted.length):0;
  const est=weighted.reduce((n,t)=>n+Number(t.estimationH||0),0);
  const weightedByHours=est>0?Math.round(weighted.reduce((n,t)=>n+pct(t.progression)*Number(t.estimationH||0),0)/est):avg;
  const declared=pct(p.progression);
  $("computedProgress").innerHTML=`<div class="metric-stack">
    <div class="metric-line"><span>Projet déclaré</span><div class="metric-bar"><div style="width:${declared}%"></div></div><strong>${declared}%</strong></div>
    <div class="metric-line"><span>Moyenne tâches</span><div class="metric-bar"><div style="width:${avg}%"></div></div><strong>${avg}%</strong></div>
    <div class="metric-line"><span>Pondéré par charge</span><div class="metric-bar"><div style="width:${weightedByHours}%"></div></div><strong>${weightedByHours}%</strong></div>
    <div class="muted">Écart déclaré / calculé : ${Math.abs(declared-weightedByHours)} point(s).</div>
  </div>`;
}
function resourceLoad(ts,as){
  const byMember=new Map();
  for(const m of db.team)byMember.set(m.id,{m,alloc:0,est:0,spent:0,tasks:0});
  for(const a of as){
    const mid=id(a.Ressource_Code); if(!mid)return;
    if(!byMember.has(mid))byMember.set(mid,{m:get("team",mid)||{id:mid,nom:`#${mid}`},alloc:0,est:0,spent:0,tasks:0});
    byMember.get(mid).alloc+=Number(a.Allocation||0);
  }
  for(const t of ts){
    const mids=refs(t.assignees); if(!mids.length)continue;
    const share=1/mids.length;
    for(const mid of mids){
      if(!byMember.has(mid))byMember.set(mid,{m:get("team",mid)||{id:mid,nom:`#${mid}`},alloc:0,est:0,spent:0,tasks:0});
      const x=byMember.get(mid); x.est+=Number(t.estimationH||0)*share; x.spent+=Number(t.tempsPasse||0)*share; x.tasks+=1;
    }
  }
  const rows=[...byMember.values()].filter(x=>x.alloc||x.tasks);
  if(!rows.length){$("resourceLoad").innerHTML='<div class="empty">Aucune donnée de charge disponible.</div>';return}
  $("resourceLoad").innerHTML=`<div class="resource-row header"><div>Ressource</div><div>Allocation</div><div>Estimé</div><div>Passé</div></div>${
    rows.map(x=>{
      const allocPct=Math.round(x.alloc*100),over=allocPct>100;
      return`<div class="resource-row"><div><strong>${esc(x.m?.nom||`#${x.m?.id}`)}</strong><div class="muted">${x.tasks} tâche(s)</div></div><div><div class="load-track"><div class="load-fill ${over?"over":""}" style="width:${Math.min(100,allocPct)}%"></div></div><div class="muted">${allocPct}%</div></div><div>${Math.round(x.est*10)/10} h</div><div>${Math.round(x.spent*10)/10} h</div></div>`;
    }).join("")
  }`;
}
function gantt(ts){
  const ds=ts.map(t=>({t,s:dms(t.dateDebut),e:dms(t.dateEcheance)})).filter(x=>x.s||x.e);
  if(!ds.length){$("gantt").innerHTML='<div class="empty">Aucune tâche datée.</div>';return}
  ds.forEach(x=>{if(!x.s)x.s=x.e;if(!x.e)x.e=x.s});
  let mn=Math.min(...ds.map(x=>x.s)),mx=Math.max(...ds.map(x=>x.e));
  if(mx<=mn)mx=mn+86400000;
  const pad=Math.max((mx-mn)*.04,86400000*2);mn-=pad;mx+=pad;
  const span=mx-mn,today=(Date.now()-mn)/span*100;
  const sorted=ds.sort((a,b)=>a.s-b.s);
  const rowIndex=new Map(sorted.map((x,i)=>[x.t.id,i]));
  const rowH=36, labelW=230;
  const depSvg=[];
  for(const {t,s,e} of sorted){
    for(const depId of refs(t.dependDe)){
      const dep=sorted.find(x=>x.t.id===depId);
      if(!dep)continue;
      const fromRow=rowIndex.get(depId),toRow=rowIndex.get(t.id);
      const x1=labelW+((dep.e-mn)/span)*1000;
      const x2=labelW+((s-mn)/span)*1000;
      const y1=18+fromRow*rowH, y2=18+toRow*rowH;
      depSvg.push(`<path d="M ${x1} ${y1} C ${x1+25} ${y1}, ${x2-25} ${y2}, ${x2} ${y2}" fill="none" stroke="#98a2b3" stroke-width="1.4" marker-end="url(#arrow)"/>`);
    }
  }
  $("gantt").innerHTML=`<div class="gantt-wrap"><div class="gantt gantt-canvas">
    <div class="gantt-axis"><div></div><div><div class="gantt-months"><span>${dt(mn)}</span><span>${dt((mn+mx)/2)}</span><span>${dt(mx)}</span></div><div class="gantt-scale"><span>début</span><span>aujourd’hui</span><span>fin</span></div></div></div>
    <svg class="dep-layer" viewBox="0 0 1230 ${Math.max(40,sorted.length*rowH)}" preserveAspectRatio="none">
      <defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0, 7 3.5, 0 7" fill="#98a2b3"/></marker></defs>
      ${depSvg.join("")}
    </svg>
    ${sorted.map(({t,s,e})=>{
      const left=(s-mn)/span*100,w=Math.max(.8,(e-s)/span*100),mil=/jalon/i.test(String(t.type||""));
      const prog=pct(t.progression);
      return`<div class="gantt-row">
        <div class="gantt-label">${esc(t.titre||"Sans titre")}<span class="subtle">${esc(t.statut||"")}</span></div>
        <div class="gantt-track">
          ${today>=0&&today<=100?`<div class="gantt-today" style="left:${today}%"></div>`:""}
          <div class="gantt-bar ${mil?"milestone":""}" style="left:${left}%;width:${w}%">
            ${!mil?`<div class="gantt-progress" style="width:${prog}%"></div>`:""}
          </div>
        </div>
      </div>`}).join("")}
  </div></div>`;
}
function tasks(ts){
  let f=ts;if(taskFilter==="jalon")f=ts.filter(t=>/jalon/i.test(String(t.type||"")));if(taskFilter==="late")f=ts.filter(late);
  if(!f.length){$("tasks").innerHTML='<div class="empty">Aucune tâche pour ce filtre.</div>';return}
  $("tasks").innerHTML=`<table><thead><tr><th>Code</th><th>Titre</th><th>Type</th><th>Statut</th><th>Progression</th><th>Charge</th><th>Assignés</th><th></th></tr></thead><tbody>${f.map(t=>`<tr><td>${esc(t.Code||"")}</td><td><strong>${esc(t.titre||"")}</strong><br><span class="muted">${esc(t.description||"")}</span></td><td>${esc(t.type||"")}</td><td><span class="status ${late(t)?"late":done(t.statut)?"done":/cours/i.test(t.statut||"")?"running":""}">${esc(t.statut||"")}</span></td><td>${pct(t.progression)}%</td><td>${Number(t.tempsPasse||0)}h / ${Number(t.estimationH||0)}h</td><td>${refs(t.assignees).map(x=>esc(get("team",x)?.nom||`#${x}`)).join(", ")}</td><td class="task-actions"><button data-edit="${t.id}">Modifier</button><button class="danger" data-del="${t.id}">Supprimer</button></td></tr>`).join("")}</tbody></table>`;
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openTask(Number(b.dataset.edit)));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteTask(Number(b.dataset.del)))
}
function diagnostic(){
  $("diagnostic").innerHTML=`<div class="diag">VERSION ${VERSION}
Projects: ${db.projects.length} lignes
Tasks: ${db.tasks.length} lignes
Team: ${db.team.length} lignes
CONTRIBUTIONS_OBJECTIFS: ${db.contrib.length} lignes
Objectifs: ${db.objectives.length} lignes
Axes_Strategiques: ${db.axes.length} lignes
Activites: ${db.activities.length} lignes
Activites_OFS: ${db.activityOffers.length} lignes
Offres_Services: ${db.offers.length} lignes
Allocations: ${db.allocations.length} lignes

Relations utilisées:
Projects.activite -> Activites
Activites.Service_Code -> Activites_OFS
Activites_OFS.OFS_Code -> Offres_Services
Tasks.projet -> Projects
Tasks.assignees -> Team (RefList)
Tasks.dependDe -> Tasks (RefList)
Tasks.parentTask -> Tasks
CONTRIBUTIONS_OBJECTIFS.Projet_Code -> Projects (RefList)
CONTRIBUTIONS_OBJECTIFS.Objectif_Libelle/Objectif_Code2 -> Objectifs
Allocations.Projet_Code -> Projects
Allocations.Ressource_Code -> Team

Fonctions V4.1:
- alertes retard / surcharge / tâches sans date
- avancement calculé depuis Tasks
- charge ressources estimée / passée
- Gantt avec progression et dépendances visuelles</div>`
}
function banner(t){$("banner").textContent=t;$("banner").classList.remove("hidden")}function hideBanner(){$("banner").classList.add("hidden")}
async function apply(actions,msg){if(busy)return;busy=true;document.body.classList.add("busy");try{await grist.docApi.applyUserActions(actions);await load();banner(msg);setTimeout(()=>{if(!busy)hideBanner()},1700)}catch(e){console.error(e);banner(`Erreur Grist: ${e?.message||e}`)}finally{busy=false;document.body.classList.remove("busy")}}

function opt(el,rows,label,selected=null,empty="—"){el.innerHTML=`<option value="">${empty}</option>`+rows.map(r=>`<option value="${r.id}" ${Number(selected)===Number(r.id)?"selected":""}>${esc(label(r))}</option>`).join("")}
function openProject(){const p=get("projects",currentProjectId),f=$("projectForm");if(!p)return;["nom","code","statut","priorite","sponsor","risque","Type"].forEach(k=>f[k].value=p[k]??"");f.progression.value=pct(p.progression);f.budget.value=p.budget??"";f.valeurStrategique.value=p.valeurStrategique??"";f.dateDebut.value=din(p.dateDebut);f.dateFin.value=din(p.dateFin);opt(f.activite,db.activities,r=>r.Nom,id(p.activite),"— activité —");opt(f.responsable,db.team,r=>r.nom,id(p.responsable),"— responsable —");$("projectDialog").showModal()}
$("projectForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const fields={nom:f.nom.value,code:f.code.value,statut:f.statut.value,priorite:f.priorite.value,sponsor:f.sponsor.value,progression:fromPct(f.progression.value),budget:f.budget.value===""?null:Number(f.budget.value),risque:f.risque.value,valeurStrategique:f.valeurStrategique.value===""?null:Number(f.valeurStrategique.value),Type:f.Type.value,activite:f.activite.value?Number(f.activite.value):null,responsable:f.responsable.value?Number(f.responsable.value):null,dateDebut:gd(f.dateDebut.value),dateFin:gd(f.dateFin.value)};$("projectDialog").close();await apply([["UpdateRecord","Projects",currentProjectId,fields]],"Projet mis à jour.")}

function fillMulti(el,rows,label,selected=[]){const s=new Set(selected.map(Number));el.innerHTML=rows.map(r=>`<option value="${r.id}" ${s.has(Number(r.id))?"selected":""}>${esc(label(r))}</option>`).join("")}
function openTask(tid=null){const f=$("taskForm");f.reset();f.id.value=tid||"";const t=tid?get("tasks",tid):null;$("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";if(t){["titre","description","Code","type","statut","priorite","estimationH","tempsPasse"].forEach(k=>f[k].value=t[k]??"");f.progression.value=pct(t.progression);f.dateDebut.value=din(t.dateDebut);f.dateEcheance.value=din(t.dateEcheance);f.tags.value=Array.isArray(t.tags)?t.tags.filter(x=>typeof x==="string").join(", "):""}else{f.type.value="tache";f.progression.value=0}fillMulti(f.assignees,db.team,r=>r.nom,t?refs(t.assignees):[]);fillMulti(f.dependDe,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?refs(t.dependDe):[]);opt(f.parentTask,taskRows(currentProjectId).filter(x=>x.id!==tid),r=>r.titre,t?id(t.parentTask):null,"— aucune —");$("taskDialog").showModal()}
$("taskForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,tid=Number(f.id.value)||null,tags=f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),fields={titre:f.titre.value,description:f.description.value,Code:f.Code.value,type:f.type.value,statut:f.statut.value,priorite:f.priorite.value,progression:fromPct(f.progression.value),estimationH:f.estimationH.value===""?null:Number(f.estimationH.value),tempsPasse:f.tempsPasse.value===""?null:Number(f.tempsPasse.value),dateDebut:gd(f.dateDebut.value),dateEcheance:gd(f.dateEcheance.value),projet:currentProjectId,assignees:reflist([...f.assignees.selectedOptions].map(o=>Number(o.value))),dependDe:reflist([...f.dependDe.selectedOptions].map(o=>Number(o.value))),parentTask:f.parentTask.value?Number(f.parentTask.value):null,tags:["L",...tags]};$("taskDialog").close();await apply([[tid?"UpdateRecord":"AddRecord","Tasks",tid||null,fields]],tid?"Tâche mise à jour.":"Tâche créée.")}
async function deleteTask(tid){const t=get("tasks",tid);if(t&&confirm(`Supprimer « ${t.titre} » ?`))await apply([["RemoveRecord","Tasks",tid]],"Tâche supprimée.")}

function openContribution(){const f=$("contributionForm"),existing=new Set(contribRows(currentProjectId).map(c=>id(c.Objectif_Libelle)||id(c.Objectif_Code2)));const choices=db.objectives.filter(o=>!existing.has(o.id));opt(f.objectif,choices,r=>r.Nom,null,"Choisir un objectif…");f.contribution.value=100;f.commentaire.value="";$("contributionDialog").showModal()}
$("contributionForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,oid=Number(f.objectif.value),fields={Projet_Code:reflist([currentProjectId]),Objectif_Libelle:oid,Objectif_Code2:oid,Contributions_Objectifs:fromPct(f.contribution.value),Commentaire:f.commentaire.value};$("contributionDialog").close();await apply([["AddRecord","CONTRIBUTIONS_OBJECTIFS",null,fields]],"Objectif associé.")}
async function removeContribution(cid){if(confirm("Retirer cet objectif du projet ?"))await apply([["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",cid]],"Contribution retirée.")}

async function deleteProject(){const p=get("projects",currentProjectId),ts=taskRows(currentProjectId),cs=contribRows(currentProjectId),as=allocRows(currentProjectId);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.nom} » ?\n${ts.length} tâches, ${cs.length} contributions et ${as.length} allocations seront aussi supprimées.`))return;const actions=[...ts.map(x=>["RemoveRecord","Tasks",x.id]),...cs.map(x=>["RemoveRecord","CONTRIBUTIONS_OBJECTIFS",x.id]),...as.map(x=>["RemoveRecord","Allocations",x.id]),["RemoveRecord","Projects",p.id]];currentProjectId=null;await apply(actions,"Projet supprimé.")}

$("projectSelect").onchange=e=>{currentProjectId=Number(e.target.value);render()};$("zoomGanttBtn").onclick=()=>gantt(taskRows(currentProjectId));$("editProjectBtn").onclick=openProject;$("deleteProjectBtn").onclick=deleteProject;$("newTaskBtn").onclick=()=>openTask();$("addContributionBtn").onclick=openContribution;$("refreshBtn").onclick=load;
document.querySelectorAll("[data-task-filter]").forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));tasks(taskRows(currentProjectId))});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=$(b.dataset.close);if(d?.open)d.close()});
grist.ready({requiredAccess:"full"});grist.onOptions(()=>load());load();
