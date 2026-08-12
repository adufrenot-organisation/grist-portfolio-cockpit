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


## V4.3.0 — Refonte UI PMO

Le schéma de données est inchangé.

### Navigation
Le menu de niveau 1 est placé dans le header global :
- Pilotage par projets / produits
- Pilotage par offre de services
- Administration

Le nom d'un projet/produit n'est rendu que dans le contexte de la vue Projet / Produit.

### Vue portefeuille
La vue Projet / Produit est divisée en :
- agrégats portefeuille ;
- liste filtrable / recherchable ;
- détail sélectionné ;
- sous-navigation du détail.

### Principe
Aucune donnée dérivée affichée dans les KPI ou synthèses n'est persistée automatiquement.
Grist reste l'unique source de vérité.


## Correctif V4.3.1

Correction d'une erreur de syntaxe dans l'initialisation des événements de la V4.3.0.
Cette erreur empêchait complètement l'exécution JavaScript et donc tout accès aux tables Grist.

La V4.3.1 conserve exactement le même modèle de données et la même UI, mais restaure le binding dynamique avec Grist.


## Correctif V4.3.2

Réintroduction de l'élément UI `#objectiveCount`, requis par `strategy()`.
Le helper `$()` lève désormais une erreur explicite avec l'identifiant manquant,
afin de faciliter le diagnostic des futures régressions UI.


## V4.4
Projects.etape_courante -> Etapes_Projet; Tasks.etape_projet -> Etapes_Projet; Fonctionnalites.produit -> Projects; Fonctionnalites.stade -> Stades_Fonctionnalite; Tasks.fonctionnalite -> Fonctionnalites.


## V4.5
Le cockpit principal est désormais strictement métier. Aucun référentiel n’est dupliqué : le widget Admin utilise le même document Grist.
