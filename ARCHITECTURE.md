# ARCHITECTURE.md — V4 adaptée au modèle réel

Grist est l'unique source de vérité.

## Modèle opérationnel
Projects → Tasks
Projects → Allocations → Team
Tasks.assignees → Team
Tasks.dependDe → Tasks
Tasks.parentTask → Tasks

## Modèle stratégique
Axes_Strategiques → Objectifs → CONTRIBUTIONS_OBJECTIFS → Projects

Attention : `CONTRIBUTIONS_OBJECTIFS.Projet_Code` est une **RefList:Projects**.
Toute écriture doit utiliser une valeur Grist RefList de forme `["L", projectId, ...]`.

## Modèle offre / activité
Projects.activite → Activites
Activites.Service_Code → Activites_OFS
Activites_OFS.OFS_Code → Offres_Services

Ne pas introduire une table `Services` fictive dans le widget : elle n'est pas utilisée par le modèle réel.

## Règles
- aucun localStorage / IndexedDB pour les données métier;
- après toute écriture, relecture depuis Grist;
- toute suppression est confirmée;
- ne jamais recréer automatiquement une ligne supprimée;
- conserver les IDs de colonnes réels du modèle actuel.


## V4.1 — Pilotage opérationnel

La V4.1 n'ajoute aucune table et ne change pas le schéma.

Elle calcule uniquement des vues dérivées :
- alertes projet ;
- progression calculée ;
- charge ressource ;
- dépendances visuelles du Gantt.

Aucune de ces données dérivées n'est persistée côté navigateur ni réécrite automatiquement dans Grist.


## V4.2.0 — Offre, CRUD et Projet / Produit

### Typologie portefeuille

`Projects.Type` est la source de vérité pour distinguer :
- Projet
- Produit

Cette distinction est uniquement une dimension métier du même référentiel `Projects`.
Aucune table `Produits` séparée n'est créée.

### Vue Offre

La vue Offre agrège les objets `Projects` de type Projet ou Produit à travers :

`Projects.activite -> Activites.Service_Code -> Activites_OFS.OFS_Code -> Offres_Services`

### Administration

Le CRUD porte sur les référentiels maîtres.
Une suppression est interdite tant qu'une dépendance connue existe.
Le widget ne fait aucune suppression en cascade automatique sur les référentiels.
