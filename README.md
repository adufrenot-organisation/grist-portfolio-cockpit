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


## V4.5.1 — Journal détaillé des actions Cockpit

Quand la table `JOURNAL_ACTIONS` est disponible, chaque création, modification ou suppression
effectuée depuis le cockpit ajoute une ligne contenant :
- `Date_Heure`
- `Origine = Cockpit PMO`
- `Action`
- `Table`
- `Record_ID`
- `Libelle`
- `Details`

`Details` contient du JSON avec :
- les valeurs créées ;
- les couples `avant / après` lors d'une modification ;
- l'enregistrement avant suppression.

La Plugin API publique ne fournit pas directement l'identité de l'utilisateur au widget.
Pour renseigner automatiquement `Utilisateur`, configure dans Grist cette colonne avec une
**trigger formula** basée sur `user.Email` ou `user.Name`, appliquée à la création de la ligne.


## V4.5.2 — Onglet Synthèse

Le sous-onglet `Infos` est renommé **Synthèse**.

Son ancien contenu est entièrement remplacé par :
- Synthèse projet
- Alertes
- Échéances & rythme
- Stratégie
- Offre & activité
- Ressources
- Prochaine attention

Les alertes affichées dans cet onglet sont calculées à partir des données Grist déjà présentes :
retards, priorité, risque, allocations et affectations.


## V4.5.3 — Correctif Synthèse

Correction de l'erreur `Élément UI introuvable: #business`.

L'ancien onglet Infos contenait les éléments `#business` et `#alerts`.
Ils ont été supprimés en V4.5.2, mais les anciennes fonctions de rendu étaient encore appelées.
Ces appels ont été retirés : les informations de positionnement et les alertes sont désormais
rendues uniquement dans le nouvel onglet **Synthèse**.


## V4.5.4 — Création Projet / Produit et Synthèse par défaut

- Ajout du bouton **+ Nouveau** dans la vue Pilotage par projets / produits.
- Le même formulaire sert désormais à créer ou modifier un enregistrement `Projects`.
- Le type proposé par défaut suit le filtre courant : Produit si le filtre Produits est actif, sinon Projet.
- Après création, le nouvel élément est sélectionné automatiquement quand il est identifiable par nom + code.
- **Synthèse est maintenant le premier sous-onglet** de la fiche.
- À chaque sélection d'un Projet / Produit, la fiche s'ouvre sur **Synthèse**.


## V4.5.5 — Météo projet visible sur la fiche

La météo apparaît maintenant :
- dans l'en-tête de la fiche Projet / Produit, à côté du badge de type ;
- dans l'onglet **Synthèse**.

Le widget lit en priorité les colonnes Grist :
- `Meteo_Projet`
- `Motif_Meteo`

Si elles ne sont pas encore présentes ou vides, il utilise provisoirement la logique calculée actuelle
(retards, priorités et risque) pour afficher Vert / Orange / Rouge.


## V4.5.6 — Correctif des anciens renderers

Après le remplacement de l'onglet `Infos` par `Synthèse`, plusieurs anciens renderers restaient
encore présents dans le JavaScript alors que leurs conteneurs HTML avaient disparu :
`diagnostic`, `business`, `alerts` et `computedProgress`.

Ils ont été retirés du cockpit métier. Le diagnostic reste disponible dans le widget
**GRIST. ADMIN & AUDIT PMO**.
