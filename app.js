
const VERSION = "3.1.0";
const TABLES = {
  projects: "Projects", tasks: "Tasks", team: "Team",
  contributions: "Contributions_Objectifs", objectives: "Objectifs",
  axes: "Axes_Strategiques", activities: "Activites", services: "Services",
  offers: "Offres_Services", allocations: "Allocations",
};

const COLS = {
  projects: {
    nom:["nom","Nom","name","Name"], code:["code","Code"], statut:["statut","Statut","status"],
    priorite:["priorite","Priorite"], sponsor:["sponsor","Sponsor"],
    progression:["progression","Progression"], budget:["budget","Budget"],
    risque:["risque","Risque"], valeurStrategique:["valeurStrategique","Valeur_Strategique","valeur_strategique"],
    activite:["activite","Activite","Activite_Code"], dateDebut:["dateDebut","Date_Debut","date_debut"],
    dateFin:["dateFin","Date_Fin","date_fin"],
  },
  tasks: {
    titre:["titre","Titre","nom","Name"], description:["description","Description"],
    type:["type","Type"], statut:["statut","Statut","status"], priorite:["priorite","Priorite"],
    progression:["progression","Progression"], dateDebut:["dateDebut","Date_Debut"],
    dateEcheance:["dateEcheance","Date_Echeance","dateFin","Date_Fin"],
    projet:["projet","Projet","project"], assignees:["assignees","Assignees","assignes","team"],
  },
  contributions: {
    projet:["Projet_Code","Projet","projet"], objectif:["Objectif_Code","Objectif","objectif"],
    contribution:["Contribution","contribution"], commentaire:["Commentaire","commentaire"],
  },
  objectives: { nom:["Nom","nom"], axe:["Axe_Code","Axe","axe"], kpi:["KPI","kpi"], echeance:["Echeance","echeance"], statut:["Statut","statut"] },
  activities: { nom:["Nom","nom"], service:["Service_Code","service","Service"] },
  services: { nom:["Nom","nom"], offre:["Offre_Code","offre","Offre"] },
  offers: { nom:["Nom","nom"] },
  team: { nom:["nom","Nom","name","Name","email","Email"] },
  allocations: { projet:["Projet_Code","Projet","projet"], ressource:["Ressource_Code","Ressource","ressource"], allocation:["Allocation","allocation"] },
};

let db = {}, dbColumns = {};
let currentProjectId = null, taskFilter = "all", isBusy = false;
const $ = id => document.getElementById(id);

function columnarToRows(data) {
  if (!data || !Array.isArray(data.id)) return [];
  const keys = Object.keys(data);
  return data.id.map((_, i) => Object.fromEntries(keys.map(k => [k, Array.isArray(data[k]) ? data[k][i] : data[k]])));
}
function resolveCol(tableKey, semantic) {
  const available = dbColumns[tableKey] || new Set();
  for (const candidate of (COLS[tableKey]?.[semantic] || [semantic])) if (available.has(candidate)) return candidate;
  return null;
}
function val(row, tableKey, semantic) {
  const c = resolveCol(tableKey, semantic);
  return c && row ? row[c] : null;
}
function buildFields(tableKey, semanticFields) {
  const out = {};
  for (const [semantic, value] of Object.entries(semanticFields)) {
    const c = resolveCol(tableKey, semantic);
    if (c) out[c] = value;
  }
  return out;
}
function missingSemantics(tableKey, semantics) {
  return semantics.filter(s => !resolveCol(tableKey, s));
}
function asId(v) {
  if (Array.isArray(v)) return v.find(x => Number.isInteger(x)) ?? null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
function refList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => Number.isInteger(x));
  return Number.isInteger(v) ? [v] : [];
}
function refListValue(ids) { return ["L", ...ids.map(Number).filter(Number.isFinite)]; }
function getById(key,id){ return (db[key]||[]).find(r=>Number(r.id)===Number(id))||null; }
function pct(v){ let n=Number(v??0); if(!Number.isFinite(n))n=0; if(n<=1)n*=100; return Math.max(0,Math.min(100,Math.round(n))); }
function fromPct(v){ let n=Number(v); return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:0; }
function money(v){ const n=Number(v); return Number.isFinite(n)?new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n):"—"; }
function dateMs(v){ if(!v)return null; if(typeof v==="number")return v>1e12?v:v*1000; const n=Date.parse(v); return Number.isFinite(n)?n:null; }
function dateText(v){ const ms=dateMs(v); return ms?new Intl.DateTimeFormat("fr-FR").format(new Date(ms)):"—"; }
function dateInput(v){ const ms=dateMs(v); return ms?new Date(ms).toISOString().slice(0,10):""; }
function inputDate(v){ if(!v)return null; const ms=Date.parse(v+"T00:00:00Z"); return Number.isFinite(ms)?Math.floor(ms/1000):null; }
function esc(v){ return String(v??"").replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function isDone(s){return /termin|done|clos|fini/i.test(String(s||""));}
function isLate(t){ if(isDone(val(t,"tasks","statut")))return false; const ms=dateMs(val(t,"tasks","dateEcheance")); return !!ms&&ms<Date.now(); }
function statusClass(s,late=false){if(late)return"late";if(isDone(s))return"done";if(/cours|progress|doing/i.test(String(s||"")))return"running";return"";}

async function fetchOptional(key, tableId) {
  try {
    const raw = await grist.docApi.fetchTable(tableId);
    dbColumns[key] = new Set(Object.keys(raw || {}));
    return columnarToRows(raw);
  } catch(e) {
    console.warn(tableId,e); dbColumns[key]=new Set(); return [];
  }
}
async function loadAll({preserveSelection=true}={}) {
  const old=currentProjectId;
  const entries=await Promise.all(Object.entries(TABLES).map(async([k,t])=>[k,await fetchOptional(k,t)]));
  db=Object.fromEntries(entries);
  if(!db.projects.length){ showBanner("La table Projects est vide ou inaccessible."); currentProjectId=null; renderEmpty(); return; }
  hideBanner();
  currentProjectId=(preserveSelection&&old&&getById("projects",old))?old:(getById("projects",currentProjectId)?currentProjectId:db.projects[0].id);
  populateProjectSelect(); $("projectSelect").value=String(currentProjectId); render();
}
function populateProjectSelect(){
  $("projectSelect").innerHTML=[...db.projects].sort((a,b)=>String(val(a,"projects","nom")||"").localeCompare(String(val(b,"projects","nom")||""),"fr"))
    .map(p=>`<option value="${p.id}">${esc(val(p,"projects","nom")||`Projet #${p.id}`)}</option>`).join("");
}
function projectTasks(id){return db.tasks.filter(t=>asId(val(t,"tasks","projet"))===Number(id));}
function projectContribs(id){return db.contributions.filter(c=>asId(val(c,"contributions","projet"))===Number(id));}
function projectAllocations(id){return db.allocations.filter(a=>asId(val(a,"allocations","projet"))===Number(id));}

function render(){
  const p=getById("projects",currentProjectId); if(!p)return renderEmpty();
  const tasks=projectTasks(p.id), cs=projectContribs(p.id), allocs=projectAllocations(p.id);
  $("projectTitle").textContent=val(p,"projects","nom")||`Projet #${p.id}`;
  $("projectMeta").textContent=[val(p,"projects","code"),val(p,"projects","statut"),val(p,"projects","sponsor")].filter(Boolean).join(" • ");
  renderKpis(p,tasks,cs,allocs); renderStrategy(cs); renderBusiness(p); renderTeam(tasks,allocs); renderGantt(tasks); renderTasks(tasks);
}
function kpi(l,v,s=""){return `<div class="kpi"><div class="kpi-label">${esc(l)}</div><div class="kpi-value">${esc(v)}</div><div class="kpi-sub">${s}</div></div>`;}
function progressBar(v){return `<div class="progress"><div style="width:${v}%"></div></div>`;}
function renderKpis(p,tasks,cs,allocs){
  const pr=pct(val(p,"projects","progression")), active=tasks.filter(t=>!isDone(val(t,"tasks","statut"))).length, late=tasks.filter(isLate).length;
  const milestones=tasks.filter(t=>/jalon|milestone/i.test(String(val(t,"tasks","type")||""))).length;
  $("kpis").innerHTML=kpi("Avancement",`${pr}%`,progressBar(pr))+kpi("Tâches actives",active,`${tasks.length} au total`)+kpi("En retard",late,late?"À traiter":"Aucune alerte")+kpi("Jalons",milestones,`${cs.length} objectif(s)`)+kpi("Budget",money(val(p,"projects","budget")),`${allocs.length} allocation(s)`);
}
function renderStrategy(cs){
  $("objectiveCount").textContent=`${cs.length} contribution${cs.length>1?"s":""}`;
  if(!cs.length){$("strategy").innerHTML='<div class="empty">Aucun objectif stratégique rattaché.</div>';return;}
  $("strategy").innerHTML=`<table><thead><tr><th>Axe</th><th>Objectif</th><th>Contribution</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>${
    cs.map(c=>{
      const o=getById("objectives",asId(val(c,"contributions","objectif"))); const a=o?getById("axes",asId(val(o,"objectives","axe"))):null;
      const axeName=a?(a.Nom??a.nom??a.Code??a.code):"—";
      return `<tr><td>${esc(axeName)}</td><td><strong>${esc(o?val(o,"objectives","nom"):"—")}</strong><br><span class="muted">${esc(o?val(o,"objectives","kpi"):"")}</span></td><td>${pct(val(c,"contributions","contribution"))}%</td><td>${dateText(o?val(o,"objectives","echeance"):null)}</td><td>${esc(o?val(o,"objectives","statut"):"—")}</td><td><button class="danger" data-remove-contribution="${c.id}">Retirer</button></td></tr>`;
    }).join("")
  }</tbody></table>`;
  document.querySelectorAll("[data-remove-contribution]").forEach(b=>b.addEventListener("click",()=>removeContribution(Number(b.dataset.removeContribution))));
}
function renderBusiness(p){
  const a=getById("activities",asId(val(p,"projects","activite"))); const s=a?getById("services",asId(val(a,"activities","service"))):null; const o=s?getById("offers",asId(val(s,"services","offre"))):null;
  $("business").innerHTML=`<div class="kv"><div class="key">Offre</div><div class="value">${esc(o?val(o,"offers","nom"):"—")}</div><div class="key">Service</div><div class="value">${esc(s?val(s,"services","nom"):"—")}</div><div class="key">Activité</div><div class="value">${esc(a?val(a,"activities","nom"):"—")}</div><div class="key">Risque</div><div class="value">${esc(val(p,"projects","risque")||"—")}</div><div class="key">Valeur stratégique</div><div class="value">${esc(val(p,"projects","valeurStrategique")||"—")}</div></div>`;
}
function renderTeam(tasks,allocs){
  const ids=new Set(); tasks.forEach(t=>refList(val(t,"tasks","assignees")).forEach(id=>ids.add(id))); allocs.forEach(a=>{const id=asId(val(a,"allocations","ressource"));if(id)ids.add(id);});
  if(!ids.size){$("team").innerHTML='<div class="empty">Aucun membre affecté.</div>';return;}
  $("team").innerHTML=[...ids].map(id=>{const m=getById("team",id);const alloc=allocs.filter(a=>asId(val(a,"allocations","ressource"))===id).reduce((n,a)=>n+Number(val(a,"allocations","allocation")||0),0);return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f1f3"><strong>${esc(m?val(m,"team","nom"):`Membre #${id}`)}</strong><span class="muted">${alloc?pct(alloc)+"%":""}</span></div>`;}).join("");
}
function renderGantt(tasks){
  const dated=tasks.map(t=>({t,start:dateMs(val(t,"tasks","dateDebut")),end:dateMs(val(t,"tasks","dateEcheance"))})).filter(x=>x.start||x.end);
  if(!dated.length){$("gantt").innerHTML='<div class="empty">Aucune tâche datée.</div>';return;}
  dated.forEach(x=>{if(!x.start)x.start=x.end;if(!x.end)x.end=x.start;});
  let min=Math.min(...dated.map(x=>x.start)), max=Math.max(...dated.map(x=>x.end)); if(max<=min)max=min+86400000;
  const pad=(max-min)*.03; min-=pad; max+=pad; const span=max-min;
  const today=((Date.now()-min)/span)*100;
  $("gantt").innerHTML=`<div class="gantt-wrap"><div class="gantt"><div class="gantt-axis"><div></div><div class="gantt-months"><span>${dateText(min)}</span><span>${dateText((min+max)/2)}</span><span>${dateText(max)}</span></div></div>${
    dated.sort((a,b)=>a.start-b.start).map(({t,start,end})=>{const left=Math.max(0,(start-min)/span*100), width=Math.max(.8,(end-start)/span*100);const milestone=/jalon/i.test(String(val(t,"tasks","type")||""));return `<div class="gantt-row"><div class="gantt-label">${esc(val(t,"tasks","titre")||"Sans titre")}</div><div class="gantt-track">${today>=0&&today<=100?`<div class="gantt-today" style="left:${today}%"></div>`:""}<div class="gantt-bar ${milestone?"milestone":""}" style="left:${left}%;width:${width}%;" title="${esc(val(t,"tasks","titre")||"")}"></div></div></div>`;}).join("")
  }</div></div>`;
}
function renderTasks(tasks){
  let f=tasks;if(taskFilter==="jalon")f=tasks.filter(t=>/jalon/i.test(String(val(t,"tasks","type")||"")));if(taskFilter==="late")f=tasks.filter(isLate);
  if(!f.length){$("tasks").innerHTML='<div class="empty">Aucune tâche pour ce filtre.</div>';return;}
  $("tasks").innerHTML=`<table><thead><tr><th>Type</th><th>Titre</th><th>Statut</th><th>Progression</th><th>Début</th><th>Échéance</th><th></th></tr></thead><tbody>${
    [...f].sort((a,b)=>(dateMs(val(a,"tasks","dateEcheance"))||Infinity)-(dateMs(val(b,"tasks","dateEcheance"))||Infinity)).map(t=>{const late=isLate(t), st=val(t,"tasks","statut")||"—";return `<tr><td>${esc(val(t,"tasks","type")||"tâche")}</td><td><strong>${esc(val(t,"tasks","titre")||`Tâche #${t.id}`)}</strong><br><span class="muted">${esc(val(t,"tasks","description")||"")}</span></td><td><span class="status ${statusClass(st,late)}">${late?"⚠ ":""}${esc(st)}</span></td><td>${pct(val(t,"tasks","progression"))}%</td><td>${dateText(val(t,"tasks","dateDebut"))}</td><td>${dateText(val(t,"tasks","dateEcheance"))}</td><td class="task-actions"><button data-edit-task="${t.id}">Modifier</button><button class="danger" data-delete-task="${t.id}">Supprimer</button></td></tr>`;}).join("")
  }</tbody></table>`;
  document.querySelectorAll("[data-edit-task]").forEach(b=>b.addEventListener("click",()=>openTaskDialog(Number(b.dataset.editTask))));
  document.querySelectorAll("[data-delete-task]").forEach(b=>b.addEventListener("click",()=>deleteTask(Number(b.dataset.deleteTask))));
}
function renderEmpty(){ $("projectTitle").textContent="Cockpit projet"; $("projectMeta").textContent=""; $("projectSelect").innerHTML=""; $("kpis").innerHTML=""; ["strategy","business","team","gantt","tasks"].forEach(id=>$(id).innerHTML='<div class="empty">En attente de données.</div>'); }
function showBanner(t){$("banner").textContent=t;$("banner").classList.remove("hidden");} function hideBanner(){$("banner").classList.add("hidden");}
function setBusy(v){isBusy=v;document.body.classList.toggle("busy",v);}
async function apply(actions, msg, preserve=true){
  if(isBusy)return; setBusy(true);
  try{await grist.docApi.applyUserActions(actions);await loadAll({preserveSelection:preserve});if(msg){showBanner(msg);setTimeout(()=>{if(!isBusy)hideBanner();},1600);}}
  catch(e){console.error(e);showBanner(`Erreur Grist : ${e?.message||e}`);}
  finally{setBusy(false);}
}

/* Project edit — schema tolerant */
function fillSelect(el, rows, tableKey, semantic, selected=null, emptyLabel="— Aucun —"){
  el.innerHTML=`<option value="">${emptyLabel}</option>`+rows.map(r=>`<option value="${r.id}" ${Number(r.id)===Number(selected)?"selected":""}>${esc(val(r,tableKey,semantic)||`#${r.id}`)}</option>`).join("");
}
function openProjectDialog(){
  const p=getById("projects",currentProjectId);if(!p)return;const f=$("projectForm");
  ["nom","code","statut","priorite","sponsor","risque"].forEach(s=>{if(f[s])f[s].value=val(p,"projects",s)||"";});
  f.progression.value=pct(val(p,"projects","progression"));f.budget.value=val(p,"projects","budget")??"";f.valeurStrategique.value=val(p,"projects","valeurStrategique")??"";
  f.dateDebut.value=dateInput(val(p,"projects","dateDebut"));f.dateFin.value=dateInput(val(p,"projects","dateFin"));
  fillSelect(f.activite,db.activities,"activities","nom",asId(val(p,"projects","activite")));
  const miss=missingSemantics("projects",["budget","risque","valeurStrategique","activite","priorite","sponsor"]);
  $("projectSchemaHint").textContent=miss.length?`Colonnes optionnelles absentes : ${miss.join(", ")}. Elles seront simplement ignorées à l’enregistrement.`:"Schéma Projects complet pour ce formulaire.";
  $("projectDialog").showModal();
}
$("projectForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;
  const fields=buildFields("projects",{nom:f.nom.value.trim(),code:f.code.value.trim(),statut:f.statut.value.trim(),priorite:f.priorite.value.trim(),sponsor:f.sponsor.value.trim(),progression:fromPct(f.progression.value),budget:f.budget.value===""?null:Number(f.budget.value),risque:f.risque.value.trim(),valeurStrategique:f.valeurStrategique.value===""?null:Number(f.valeurStrategique.value),activite:f.activite.value?Number(f.activite.value):null,dateDebut:inputDate(f.dateDebut.value),dateFin:inputDate(f.dateFin.value)});
  $("projectDialog").close(); await apply([["UpdateRecord",TABLES.projects,currentProjectId,fields]],"Projet mis à jour.");
});
async function deleteProject(){
  const p=getById("projects",currentProjectId);if(!p)return;const ts=projectTasks(p.id),cs=projectContribs(p.id),as=projectAllocations(p.id);
  if(!confirm(`Supprimer définitivement « ${val(p,"projects","nom")||p.id} » ?\n\n${ts.length} tâche(s), ${cs.length} contribution(s) et ${as.length} allocation(s) liées seront également supprimées.`))return;
  const actions=[...ts.map(r=>["RemoveRecord",TABLES.tasks,r.id]),...cs.map(r=>["RemoveRecord",TABLES.contributions,r.id]),...as.map(r=>["RemoveRecord",TABLES.allocations,r.id]),["RemoveRecord",TABLES.projects,p.id]];
  currentProjectId=null;await apply(actions,"Projet supprimé.",false);
}

/* Tasks */
function populateTeamMulti(select, selectedIds=[]){
  const sel=new Set(selectedIds.map(Number)); select.innerHTML=db.team.map(m=>`<option value="${m.id}" ${sel.has(Number(m.id))?"selected":""}>${esc(val(m,"team","nom")||`Membre #${m.id}`)}</option>`).join("");
}
function openTaskDialog(id=null){
  const f=$("taskForm");f.reset();f.id.value=id||"";let t=id?getById("tasks",id):null;
  $("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";
  if(t){["titre","description","type","statut","priorite"].forEach(s=>{if(f[s])f[s].value=val(t,"tasks",s)||"";});f.progression.value=pct(val(t,"tasks","progression"));f.dateDebut.value=dateInput(val(t,"tasks","dateDebut"));f.dateEcheance.value=dateInput(val(t,"tasks","dateEcheance"));populateTeamMulti(f.assignees,refList(val(t,"tasks","assignees")));}else{f.type.value="tache";f.progression.value=0;populateTeamMulti(f.assignees,[]);}
  const miss=missingSemantics("tasks",["description","type","priorite","assignees"]);
  $("taskSchemaHint").textContent=miss.length?`Colonnes optionnelles absentes : ${miss.join(", ")}. Elles seront ignorées.`:"Schéma Tasks complet pour ce formulaire.";
  $("taskDialog").showModal();
}
$("taskForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,id=Number(f.id.value)||null;const assigned=[...f.assignees.selectedOptions].map(o=>Number(o.value));
  const fields=buildFields("tasks",{titre:f.titre.value.trim(),description:f.description.value.trim(),type:f.type.value,statut:f.statut.value.trim(),priorite:f.priorite.value.trim(),progression:fromPct(f.progression.value),dateDebut:inputDate(f.dateDebut.value),dateEcheance:inputDate(f.dateEcheance.value),projet:currentProjectId,assignees:refListValue(assigned)});
  $("taskDialog").close();await apply([[id?"UpdateRecord":"AddRecord",TABLES.tasks,id||null,fields]],id?"Tâche mise à jour.":"Tâche créée.");
});
async function deleteTask(id){const t=getById("tasks",id);if(t&&confirm(`Supprimer définitivement « ${val(t,"tasks","titre")||id} » ?`))await apply([["RemoveRecord",TABLES.tasks,id]],"Tâche supprimée.");}

/* Strategic contributions */
function openContributionDialog(){
  const f=$("contributionForm"),existing=new Set(projectContribs(currentProjectId).map(c=>asId(val(c,"contributions","objectif"))));
  const choices=db.objectives.filter(o=>!existing.has(Number(o.id)));
  fillSelect(f.objectif,choices,"objectives","nom",null,"Choisir un objectif…");
  f.contribution.value=100; f.commentaire.value="";
  const pcol=resolveCol("contributions","projet"), ocol=resolveCol("contributions","objectif");
  $("contributionSchemaHint").textContent =
    `Mapping : projet → ${pcol || "ABSENT"} ; objectif → ${ocol || "ABSENT"}. ` +
    `Ces deux colonnes doivent être des Références vers Projects et Objectifs.`;
  $("contributionDialog").showModal();
}
$("contributionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const objectifId = Number(f.objectif.value);
  const projectCol = resolveCol("contributions", "projet");
  const objectiveCol = resolveCol("contributions", "objectif");
  const contributionCol = resolveCol("contributions", "contribution");
  const commentCol = resolveCol("contributions", "commentaire");

  if (!projectCol || !objectiveCol) {
    showBanner(`Impossible d'associer l'objectif : colonnes de liaison introuvables dans ${TABLES.contributions}. Projet=${projectCol || "ABSENTE"}, Objectif=${objectiveCol || "ABSENTE"}.`);
    return;
  }
  if (!currentProjectId || !objectifId) {
    showBanner("Projet ou objectif non sélectionné.");
    return;
  }

  const fields = { [projectCol]: Number(currentProjectId), [objectiveCol]: Number(objectifId) };
  if (contributionCol) fields[contributionCol] = fromPct(f.contribution.value);
  if (commentCol) fields[commentCol] = f.commentaire.value.trim();

  $("contributionDialog").close();
  if (isBusy) return;
  setBusy(true);
  try {
    await grist.docApi.applyUserActions([["AddRecord", TABLES.contributions, null, fields]]);
    await loadAll({preserveSelection:true});
    const persisted = projectContribs(currentProjectId).some(c => asId(val(c, "contributions", "objectif")) === objectifId);
    if (!persisted) {
      showBanner(`Ligne créée mais association non retrouvée après relecture. Vérifie que ${TABLES.contributions}.${projectCol} référence bien Projects et que ${TABLES.contributions}.${objectiveCol} référence bien Objectifs.`);
    } else {
      showBanner("Objectif associé au projet.");
      setTimeout(() => { if (!isBusy) hideBanner(); }, 1800);
    }
  } catch (e) {
    console.error(e);
    showBanner(`Erreur d'association : ${e?.message || e}`);
  } finally {
    setBusy(false);
  }
});
async function removeContribution(id){if(confirm("Retirer cet objectif du projet ?"))await apply([["RemoveRecord",TABLES.contributions,id]],"Contribution retirée.");}

/* Events */
$("projectSelect").addEventListener("change",e=>{currentProjectId=Number(e.target.value);render();});
$("editProjectBtn").addEventListener("click",openProjectDialog);$("deleteProjectBtn").addEventListener("click",deleteProject);$("newTaskBtn").addEventListener("click",()=>openTaskDialog());$("addContributionBtn").addEventListener("click",openContributionDialog);
document.querySelectorAll("[data-task-filter]").forEach(b=>b.addEventListener("click",()=>{taskFilter=b.dataset.taskFilter;document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));renderTasks(projectTasks(currentProjectId));}));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{const d=$(b.dataset.close);if(d?.open)d.close();}));

grist.ready({requiredAccess:"full"});
grist.onRecord(record=>{if(record?.id&&getById("projects",record.id)){currentProjectId=record.id;$("projectSelect").value=String(record.id);render();}});
grist.onOptions(()=>loadAll());
loadAll();
