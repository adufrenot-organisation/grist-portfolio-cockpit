# GRIST. COCKPIT Pilotage PMO — V4.4.0.1

Cette version implémente la nouvelle interface validée visuellement.

## Changement majeur d'ergonomie

Le menu principal est maintenant **tout en haut** :

- Pilotage par projets / produits
- Pilotage par offre de services
- Administration

Le nom du projet/produit sélectionné **n'apparaît que dans l'onglet Pilotage par projets / produits**.

## Nouvelle vue portefeuille Projets / Produits

La page comprend maintenant :

- filtres Tous / Projets / Produits ;
- KPI portefeuille :
  - total éléments ;
  - en cours ;
  - en retard ;
  - terminés ;
  - avancement moyen ;
  - charge restante ;
- liste latérale recherchable des projets / produits ;
- détail du projet sélectionné à droite ;
- badge Projet / Produit basé sur `Projects.Type`.

## Détail Projet / Produit

Le détail possède 5 sous-onglets :

1. Vue d'ensemble
2. Tâches / Gantt
3. Objectifs
4. Ressources
5. Infos

La vue d'ensemble synthétise :
- avancement calculé ;
- dates clés ;
- charge ;
- activité ;
- offre de services ;
- objectifs stratégiques ;
- statut et priorité.

## Modèle de données

Aucun changement du modèle Grist V4.2.

Le widget continue à utiliser les vraies tables :
`Projects`, `Tasks`, `Team`, `CONTRIBUTIONS_OBJECTIFS`, `Objectifs`,
`Axes_Strategiques`, `Activites`, `Activites_OFS`, `Offres_Services`, `Allocations`.

## Déploiement

Remplace les fichiers GitHub Pages et utilise temporairement :

`?v=4.4.0`

dans l'URL du widget Grist pour forcer le rafraîchissement.


## Correctif 4.4.0

La V4.3.0 contenait une erreur de syntaxe JavaScript dans le bloc d'événements.
Conséquence : le HTML/CSS s'affichait, mais `app.js` ne s'exécutait jamais ; l'interface paraissait donc statique et aucune table Grist n'était lue.

La V4.4.0 corrige ce bloc et réactive :
- lecture des tables via `fetchTable`;
- liste réelle Projects / Produits;
- KPI calculés;
- détail sélectionné;
- offre de services;
- administration CRUD;
- écritures Grist via `applyUserActions`.

Un message d'erreur de chargement est maintenant affiché dans le cockpit si le JavaScript rencontre une erreur à l'initialisation.


## Correctif V4.4.0

La V4.3.1 appelait `objectiveCount.textContent` mais l'élément `#objectiveCount`
n'existait plus dans le nouveau HTML. Cela provoquait :

`Cannot set properties of null (setting 'textContent')`

La V4.4.0 réintroduit ce compteur dans l'onglet Objectifs et ajoute un diagnostic
plus explicite si un identifiant HTML attendu manque à l'avenir.


## V4.4 — cycles Projet / Produit
Prise en charge de Etapes_Projet, Stades_Fonctionnalite et Fonctionnalites, ajoutées aussi au CRUD Administration.


## V4.5 — séparation métier / administration
L’onglet Administration est retiré du cockpit principal. Le CRUD des référentiels, l’audit, le diagnostic et le MCD sont transférés dans **GRIST. ADMIN & AUDIT PMO**.
