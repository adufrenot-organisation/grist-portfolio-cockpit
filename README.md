# Grist Portfolio Cockpit — V4.0.0

Cette version est adaptée au fichier `.grist` fourni.

## Schéma réel pris en compte

- `Projects`
- `Tasks`
- `Team`
- `CONTRIBUTIONS_OBJECTIFS`
- `Objectifs`
- `Axes_Strategiques`
- `Activites`
- `Activites_OFS`
- `Offres_Services`
- `Allocations`

## Relations réelles

- `Projects.activite` → `Activites`
- `Activites.Service_Code` → `Activites_OFS`
- `Activites_OFS.OFS_Code` → `Offres_Services`
- `Tasks.projet` → `Projects`
- `Tasks.assignees` → `Team` (`RefList`)
- `Tasks.dependDe` → `Tasks` (`RefList`)
- `Tasks.parentTask` → `Tasks`
- `CONTRIBUTIONS_OBJECTIFS.Projet_Code` → `Projects` (`RefList`)
- `CONTRIBUTIONS_OBJECTIFS.Objectif_Libelle` → `Objectifs`
- `CONTRIBUTIONS_OBJECTIFS.Objectif_Code2` → `Objectifs`
- `Allocations.Projet_Code` → `Projects`
- `Allocations.Ressource_Code` → `Team`

## Nouveautés V4

- correction définitive du lien objectif ↔ projet avec `RefList`;
- chaîne métier corrigée via `Activites_OFS`;
- édition du responsable projet;
- dépendances de tâches;
- tâche parente;
- estimation et temps passé;
- tags;
- mini-Gantt;
- diagnostic du modèle intégré;
- suppression persistante des projets/tâches;
- aucune donnée métier persistée côté navigateur.

## Déploiement

Publie `index.html`, `app.js`, `styles.css`, `README.md`, `ARCHITECTURE.md` sur GitHub Pages.

L'URL du widget peut rester la même. Pour forcer le rafraîchissement dans Grist, ajoute `?v=4.0.0` à l'URL du widget.
