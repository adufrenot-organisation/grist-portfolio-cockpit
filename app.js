
const TABLES = {
  projects: "Projects",
  tasks: "Tasks",
  team: "Team",
  contributions: "Contributions_Objectifs",
  objectives: "Objectifs",
  axes: "Axes_Strategiques",
  activities: "Activites",
  services: "Services",
  offers: "Offres_Services",
  allocations: "Allocations",
};

let db = {};
let currentProjectId = null;
let taskFilter = "all";
let isBusy = false;

const $ = (id) => document.getElementById(id);

function columnarToRows(data) {
  if (!data || !data.id || !Array.isArray(data.id)) return [];
  const keys = Object.keys(data);
  return data.id.map((_, i) => {
    const row = {};
    for (const key of keys) row[key] = Array.isArray(data[key]) ? data[key][i] : data[key];
    return row;
  });
}

function pct(value) {
  let n = Number(value ?? 0);
  if (!Number.isFinite(n)) n = 0;
  if (n <= 1) n *= 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function fromPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 0;
}
function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {style:"currency", currency:"EUR", maximumFractionDigits:0}).format(n);
}
function gristDateToInput(value) {
  if (!value) return "";
  const ms = typeof value === "number" ? (value > 1e12 ? value : value * 1000) : Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}
function inputDateToGrist(value) {
  if (!value) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}
function dateText(value) {
  if (!value) return "—";
  const ms = typeof value === "number" ? (value > 1e12 ? value : value * 1000) : Date.parse(value);
  const d = new Date(ms);
  return isNaN(d) ? String(value) : new Intl.DateTimeFormat("fr-FR").format(d);
}
function asId(value) {
  if (Array.isArray(value)) {
    const n = value.find(v => Number.isInteger(v));
    return n ?? null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function refList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => Number.isInteger(v));
  return Number.isInteger(value) ? [value] : [];
}
function getById(tableName, id) {
  return (db[tableName] || []).find(r => Number(r.id) === Number(id)) || null;
}
function first(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return null;
}
function isDone(status) {
  return /termin|done|clos|fini/i.test(String(status || ""));
}
function isLate(task) {
  if (isDone(first(task, "statut", "status"))) return false;
  const raw = first(task, "dateEcheance", "dateFin", "dueDate");
  if (!raw) return false;
  const ts = typeof raw === "number" ? (raw > 1e12 ? raw : raw * 1000) : Date.parse(raw);
  return Number.isFinite(ts) && ts < Date.now();
}
function statusClass(status, late=false) {
  if (late) return "late";
  if (isDone(status)) return "done";
  if (/cours|progress|doing/i.test(String(status || ""))) return "running";
  return "";
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

async function fetchOptional(tableId) {
  try {
    return columnarToRows(await grist.docApi.fetchTable(tableId));
  } catch (e) {
    console.warn(`Table ${tableId} indisponible`, e);
    return [];
  }
}
async function loadAll({preserveSelection=true} = {}) {
  const oldProject = currentProjectId;
  const entries = await Promise.all(
    Object.entries(TABLES).map(async ([key, tableId]) => [key, await fetchOptional(tableId)])
  );
  db = Object.fromEntries(entries);

  if (!db.projects.length) {
    showBanner("La table « Projects » est vide ou inaccessible.");
    currentProjectId = null;
    renderEmpty();
    return;
  }
  hideBanner();
  if (preserveSelection && oldProject && getById("projects", oldProject)) currentProjectId = oldProject;
  else if (!currentProjectId || !getById("projects", currentProjectId)) currentProjectId = db.projects[0].id;
  populateProjectSelect();
  $("projectSelect").value = String(currentProjectId);
  render();
}
function populateProjectSelect() {
  const select = $("projectSelect");
  select.innerHTML = "";
  [...db.projects]
    .sort((a,b) => String(first(a,"nom","Name","name")||"").localeCompare(String(first(b,"nom","Name","name")||""), "fr"))
    .forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = first(p, "nom", "Name", "name", "code") || `Projet #${p.id}`;
      select.appendChild(opt);
    });
}

function projectTasks(projectId) {
  return (db.tasks || []).filter(t => asId(first(t, "projet", "Projet", "project")) === Number(projectId));
}
function projectContribs(projectId) {
  return (db.contributions || []).filter(c => asId(first(c, "Projet_Code", "Projet", "projet")) === Number(projectId));
}
function projectAllocations(projectId) {
  return (db.allocations || []).filter(a => asId(first(a, "Projet_Code", "Projet", "projet")) === Number(projectId));
}

function render() {
  const p = getById("projects", currentProjectId);
  if (!p) return renderEmpty();
  const tasks = projectTasks(p.id);
  const contribs = projectContribs(p.id);
  const allocs = projectAllocations(p.id);

  $("projectTitle").textContent = first(p, "nom", "Name", "name") || `Projet #${p.id}`;
  $("projectMeta").textContent = [first(p,"code"), first(p,"statut","status"), first(p,"sponsor")].filter(Boolean).join(" • ");

  renderKpis(p, tasks, contribs, allocs);
  renderStrategy(contribs);
  renderBusiness(p);
  renderTeam(tasks, allocs);
  renderTasks(tasks);
}
function renderKpis(p, tasks, contribs, allocs) {
  const progress = pct(first(p, "progression", "Progression"));
  const active = tasks.filter(t => !isDone(first(t,"statut","status"))).length;
  const late = tasks.filter(isLate).length;
  const milestones = tasks.filter(t => /jalon|milestone/i.test(String(first(t,"type","Type") || ""))).length;
  const budget = first(p,"budget","Budget");
  $("kpis").innerHTML = `
    ${kpi("Avancement", `${progress}%`, progressBar(progress))}
    ${kpi("Tâches actives", active, `${tasks.length} au total`)}
    ${kpi("En retard", late, late ? "À traiter" : "Aucune alerte")}
    ${kpi("Jalons", milestones, `${contribs.length} objectif(s) lié(s)`)}
    ${kpi("Budget", money(budget), `${allocs.length} allocation(s)`)}
  `;
}
function kpi(label, value, sub="") {
  return `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${sub}</div></div>`;
}
function progressBar(v) { return `<div class="progress" title="${v}%"><div style="width:${v}%"></div></div>`; }

function renderStrategy(contribs) {
  $("objectiveCount").textContent = `${contribs.length} contribution${contribs.length>1?"s":""}`;
  if (!contribs.length) {
    $("strategy").innerHTML = `<div class="empty">Aucun objectif stratégique rattaché à ce projet.</div>`;
    return;
  }
  const rows = contribs.map(c => {
    const obj = getById("objectives", asId(first(c,"Objectif_Code","Objectif","objectif")));
    const axe = obj ? getById("axes", asId(first(obj,"Axe_Code","Axe","axe"))) : null;
    return `<tr>
      <td>${esc(first(axe,"Nom","nom","Code","code") || "—")}</td>
      <td><strong>${esc(first(obj,"Nom","nom","Code","code") || "—")}</strong><br><span class="muted">${esc(first(obj,"KPI","kpi") || "")}</span></td>
      <td>${pct(first(c,"Contribution","contribution"))}%</td>
      <td>${dateText(first(obj,"Echeance","echeance"))}</td>
      <td>${esc(first(obj,"Statut","statut") || "—")}</td>
    </tr>`;
  }).join("");
  $("strategy").innerHTML = `<table><thead><tr><th>Axe</th><th>Objectif</th><th>Contribution</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderBusiness(p) {
  const activity = getById("activities", asId(first(p,"activite","Activite","Activite_Code")));
  const service = activity ? getById("services", asId(first(activity,"Service_Code","service","Service"))) : null;
  const offer = service ? getById("offers", asId(first(service,"Offre_Code","offre","Offre"))) : null;
  $("business").innerHTML = `
    <div class="kv">
      <div class="key">Offre</div><div class="value">${esc(first(offer,"Nom","nom","Code","code") || "—")}</div>
      <div class="key">Service</div><div class="value">${esc(first(service,"Nom","nom","Code","code") || "—")}</div>
      <div class="key">Activité</div><div class="value">${esc(first(activity,"Nom","nom","Code","code") || "—")}</div>
      <div class="key">Responsable</div><div class="value">${esc(first(activity,"Responsable","responsable") || first(p,"responsable") || "—")}</div>
      <div class="key">Risque</div><div class="value">${esc(first(p,"risque","Risque") || "—")}</div>
      <div class="key">Valeur stratégique</div><div class="value">${esc(first(p,"valeurStrategique","Valeur_Strategique") || "—")}</div>
    </div>`;
}
function renderTeam(tasks, allocs) {
  const memberIds = new Set();
  for (const t of tasks) for (const id of refList(first(t,"assignees","assigne","team"))) memberIds.add(id);
  for (const a of allocs) {
    const id = asId(first(a,"Ressource_Code","Ressource","ressource"));
    if (id) memberIds.add(id);
  }
  const members = [...memberIds].map(id => getById("team", id)).filter(Boolean);
  if (!members.length && !allocs.length) {
    $("team").innerHTML = `<div class="empty">Aucun membre ou allocation trouvé.</div>`;
    return;
  }
  const allocationByMember = new Map();
  for (const a of allocs) {
    const id = asId(first(a,"Ressource_Code","Ressource","ressource"));
    if (!id) continue;
    allocationByMember.set(id, (allocationByMember.get(id)||0) + Number(first(a,"Allocation","allocation")||0));
  }
  $("team").innerHTML = members.map(m => {
    const name = first(m,"nom","Nom","name","Name","email","Email") || `Membre #${m.id}`;
    const a = allocationByMember.get(Number(m.id));
    return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #f0f1f3">
      <strong>${esc(name)}</strong><span class="muted">${a !== undefined ? pct(a)+"%" : ""}</span>
    </div>`;
  }).join("") || `<div class="empty">Allocations présentes mais membres non résolus dans Team.</div>`;
}
function renderTasks(tasks) {
  let filtered = tasks;
  if (taskFilter === "jalon") filtered = tasks.filter(t => /jalon|milestone/i.test(String(first(t,"type","Type")||"")));
  if (taskFilter === "late") filtered = tasks.filter(isLate);
  filtered = [...filtered].sort((a,b) => Number(first(a,"dateEcheance","dateFin")||Infinity) - Number(first(b,"dateEcheance","dateFin")||Infinity));
  if (!filtered.length) {
    $("tasks").innerHTML = `<div class="empty">Aucune tâche pour ce filtre.</div>`;
    return;
  }
  $("tasks").innerHTML = `<table>
    <thead><tr><th>Type</th><th>Titre</th><th>Statut</th><th>Progression</th><th>Début</th><th>Échéance</th><th></th></tr></thead>
    <tbody>${filtered.map(t => {
      const late = isLate(t);
      const st = first(t,"statut","status") || "—";
      return `<tr>
        <td>${esc(first(t,"type","Type") || "tâche")}</td>
        <td><strong>${esc(first(t,"titre","Titre","nom","Name") || `Tâche #${t.id}`)}</strong><br><span class="muted">${esc(first(t,"description","Description") || "")}</span></td>
        <td><span class="status ${statusClass(st, late)}">${late ? "⚠ " : ""}${esc(st)}</span></td>
        <td>${pct(first(t,"progression","Progression"))}%</td>
        <td>${dateText(first(t,"dateDebut","Date_Debut"))}</td>
        <td>${dateText(first(t,"dateEcheance","dateFin","Date_Fin"))}</td>
        <td class="task-actions">
          <button data-edit-task="${t.id}">Modifier</button>
          <button class="danger" data-delete-task="${t.id}">Supprimer</button>
        </td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
  document.querySelectorAll("[data-edit-task]").forEach(b => b.addEventListener("click", () => openTaskDialog(Number(b.dataset.editTask))));
  document.querySelectorAll("[data-delete-task]").forEach(b => b.addEventListener("click", () => deleteTask(Number(b.dataset.deleteTask))));
}

function renderEmpty() {
  $("projectTitle").textContent = "Cockpit projet";
  $("projectMeta").textContent = "";
  $("projectSelect").innerHTML = "";
  $("kpis").innerHTML = "";
  for (const id of ["strategy","business","team","tasks"]) $(id).innerHTML = `<div class="empty">En attente de données.</div>`;
}
function showBanner(text) { $("banner").textContent = text; $("banner").classList.remove("hidden"); }
function hideBanner() { $("banner").classList.add("hidden"); }

async function runAction(action, successMessage) {
  if (isBusy) return;
  setBusy(true);
  try {
    await grist.docApi.applyUserActions([action]);
    await loadAll({preserveSelection:true});
    if (successMessage) flash(successMessage);
  } catch (e) {
    console.error(e);
    showBanner(`Erreur Grist : ${e?.message || e}`);
  } finally {
    setBusy(false);
  }
}
function setBusy(value) {
  isBusy = value;
  document.body.classList.toggle("busy", value);
}
function flash(text) {
  showBanner(text);
  setTimeout(() => {
    if (!isBusy) hideBanner();
  }, 1800);
}

/* PROJECT EDITING */
function openProjectDialog() {
  const p = getById("projects", currentProjectId);
  if (!p) return;
  const f = $("projectForm");
  f.nom.value = first(p,"nom","Name","name") || "";
  f.code.value = first(p,"code") || "";
  f.statut.value = first(p,"statut","status") || "";
  f.priorite.value = first(p,"priorite") || "";
  f.sponsor.value = first(p,"sponsor") || "";
  f.progression.value = pct(first(p,"progression","Progression"));
  f.budget.value = first(p,"budget","Budget") ?? "";
  f.risque.value = first(p,"risque","Risque") || "";
  f.valeurStrategique.value = first(p,"valeurStrategique","Valeur_Strategique") ?? "";
  f.dateDebut.value = gristDateToInput(first(p,"dateDebut","Date_Debut"));
  f.dateFin.value = gristDateToInput(first(p,"dateFin","Date_Fin"));
  $("projectDialog").showModal();
}
$("projectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const fields = {
    nom: f.nom.value.trim(),
    code: f.code.value.trim(),
    statut: f.statut.value.trim(),
    priorite: f.priorite.value.trim(),
    sponsor: f.sponsor.value.trim(),
    progression: fromPct(f.progression.value),
    budget: f.budget.value === "" ? null : Number(f.budget.value),
    risque: f.risque.value.trim(),
    valeurStrategique: f.valeurStrategique.value === "" ? null : Number(f.valeurStrategique.value),
    dateDebut: inputDateToGrist(f.dateDebut.value),
    dateFin: inputDateToGrist(f.dateFin.value),
  };
  $("projectDialog").close();
  await runAction(["UpdateRecord", TABLES.projects, currentProjectId, fields], "Projet mis à jour.");
});
async function deleteProject() {
  const p = getById("projects", currentProjectId);
  if (!p) return;
  const tasks = projectTasks(currentProjectId);
  const contribs = projectContribs(currentProjectId);
  const allocs = projectAllocations(currentProjectId);
  const name = first(p,"nom","Name","name") || `#${p.id}`;
  const msg = `Supprimer définitivement le projet « ${name} » ?\n\nLe cockpit supprimera aussi ${tasks.length} tâche(s), ${contribs.length} contribution(s) stratégique(s) et ${allocs.length} allocation(s) liées.\n\nCette action est persistée directement dans Grist.`;
  if (!confirm(msg)) return;

  const actions = [];
  for (const r of tasks) actions.push(["RemoveRecord", TABLES.tasks, r.id]);
  for (const r of contribs) actions.push(["RemoveRecord", TABLES.contributions, r.id]);
  for (const r of allocs) actions.push(["RemoveRecord", TABLES.allocations, r.id]);
  actions.push(["RemoveRecord", TABLES.projects, p.id]);

  setBusy(true);
  try {
    await grist.docApi.applyUserActions(actions);
    currentProjectId = null;
    await loadAll({preserveSelection:false});
    flash("Projet et données liées supprimés.");
  } catch (e) {
    console.error(e);
    showBanner(`Suppression impossible : ${e?.message || e}`);
  } finally {
    setBusy(false);
  }
}

/* TASK CREATE / UPDATE / DELETE */
function openTaskDialog(taskId=null) {
  const f = $("taskForm");
  f.reset();
  f.id.value = taskId || "";
  if (taskId) {
    const t = getById("tasks", taskId);
    if (!t) return;
    $("taskDialogTitle").textContent = "Modifier la tâche";
    f.titre.value = first(t,"titre","Titre","nom","Name") || "";
    f.description.value = first(t,"description","Description") || "";
    f.type.value = first(t,"type","Type") || "tache";
    f.statut.value = first(t,"statut","status") || "";
    f.priorite.value = first(t,"priorite") || "";
    f.progression.value = pct(first(t,"progression","Progression"));
    f.dateDebut.value = gristDateToInput(first(t,"dateDebut","Date_Debut"));
    f.dateEcheance.value = gristDateToInput(first(t,"dateEcheance","dateFin","Date_Fin"));
  } else {
    $("taskDialogTitle").textContent = "Nouvelle tâche";
    f.type.value = "tache";
    f.progression.value = 0;
  }
  $("taskDialog").showModal();
}
$("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const id = Number(f.id.value) || null;
  const fields = {
    titre: f.titre.value.trim(),
    description: f.description.value.trim(),
    type: f.type.value,
    statut: f.statut.value.trim(),
    priorite: f.priorite.value.trim(),
    progression: fromPct(f.progression.value),
    dateDebut: inputDateToGrist(f.dateDebut.value),
    dateEcheance: inputDateToGrist(f.dateEcheance.value),
    projet: currentProjectId,
  };
  $("taskDialog").close();
  if (id) {
    await runAction(["UpdateRecord", TABLES.tasks, id, fields], "Tâche mise à jour.");
  } else {
    await runAction(["AddRecord", TABLES.tasks, null, fields], "Tâche créée.");
  }
});
async function deleteTask(taskId) {
  const t = getById("tasks", taskId);
  if (!t) return;
  const title = first(t,"titre","Titre","nom","Name") || `#${taskId}`;
  if (!confirm(`Supprimer définitivement « ${title} » ?\n\nLa suppression sera appliquée directement dans Grist.`)) return;
  await runAction(["RemoveRecord", TABLES.tasks, taskId], "Tâche supprimée.");
}

/* UI EVENTS */
$("projectSelect").addEventListener("change", e => {
  currentProjectId = Number(e.target.value);
  render();
});
$("editProjectBtn").addEventListener("click", openProjectDialog);
$("deleteProjectBtn").addEventListener("click", deleteProject);
$("newTaskBtn").addEventListener("click", () => openTaskDialog());
document.querySelectorAll("[data-task-filter]").forEach(btn => btn.addEventListener("click", () => {
  taskFilter = btn.dataset.taskFilter;
  document.querySelectorAll("[data-task-filter]").forEach(b => b.classList.toggle("active", b === btn));
  renderTasks(projectTasks(currentProjectId));
}));
document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => {
  const d = document.getElementById(btn.dataset.close);
  if (d?.open) d.close();
}));

/*
  V2:
  - multi-table access is required;
  - writes use applyUserActions;
  - after EVERY successful write, loadAll() refetches the data from Grist.
  No localStorage / IndexedDB / persistent business cache.
*/
grist.ready({ requiredAccess: "full" });

grist.onRecord((record) => {
  if (record && record.id && getById("projects", record.id)) {
    currentProjectId = record.id;
    $("projectSelect").value = String(record.id);
    render();
  }
});
grist.onOptions(() => loadAll());
loadAll();
