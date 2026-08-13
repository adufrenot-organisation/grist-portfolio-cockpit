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


## V4.6.0 — Planning projet / Roadmap produit

La Vue d'ensemble est supprimée.

Pour les **Projets**, le sous-onglet `Planning projet` permet maintenant :
- de visualiser les étapes du référentiel `Etapes_Projet`;
- de créer une tâche directement dans une étape;
- de voir les dates et l'avancement de l'étape calculés depuis ses tâches.

Pour les **Produits**, le sous-onglet `Roadmap produit` permet :
- de créer une fonctionnalité;
- de créer une tâche directement depuis une fonctionnalité;
- de préremplir automatiquement le lien `Tasks.fonctionnalite`.

Les étapes restent un référentiel global géré dans Admin & Audit. Elles ne sont pas dupliquées par projet.


## V4.6.1 — Filtres Domaine / Service
Ajout de filtres cumulables Domaine et Service dans le portefeuille. Le service est résolu par `Projects.activite → Activites.Service_Code → Activites_OFS.OFS_Code → Offres_Services`. Le domaine est lu sur l'offre ou l'activité via une référence `Domaine_code`, `Domaine_Code` ou `Domaine`.


## V4.6.2 — Correction responsive du bandeau portefeuille

Correction de la présentation de la vue **Pilotage par projets / produits** :
- le titre ne se compacte plus sur quelques caractères par ligne ;
- les filtres Type / Domaine / Service se réorganisent automatiquement selon la largeur disponible ;
- le bouton **+ Nouveau** reste visible ;
- le bandeau passe proprement sur une ou deux lignes dans un widget Grist étroit.


## V4.6.3 — Fonctionnalités gérées dans le cockpit

Le CRUD métier des `Fonctionnalites` est confirmé dans **Roadmap produit** :
création, modification et suppression sont réalisées depuis le cockpit.

Le référentiel `Stades_Fonctionnalite` reste administré dans Admin & Audit.

Correction complémentaire : après suppression de Vue d'ensemble, les changements de contexte
Projet/Produit reviennent désormais sur **Synthèse** et non sur l'ancien onglet `overview`.


## V4.7.0 — Fonctionnalités Projet / Produit

Une fonctionnalité peut appartenir à un Projet ou à un Produit.
Le cockpit privilégie `Fonctionnalites.parent -> Projects`, avec compatibilité `projet_produit` et l'ancienne colonne `produit`.

- Projet : borné, structuré par étapes ; une tâche appartient à une étape et peut aussi appartenir à une fonctionnalité.
- Produit : non forcément borné, sans étape ; roadmap par fonctionnalités uniquement.
- Fonctionnalité : stade + Date_Debut + Date_Fin + progression + priorité + responsable.

Le CRUD Fonctionnalites reste exclusivement dans le Cockpit.


## V4.7.1 — Dépendances inter-projets

Le champ `Tasks.dependDe` n'est plus limité aux tâches du projet courant.
Le sélecteur propose désormais toutes les tâches du portefeuille, avec un libellé explicite :
`[Projet/Produit] Nom de la tâche`.

Le modèle reste `Tasks.dependDe -> RefList Tasks` : aucune nouvelle table n'est requise.


## V4.7.2 — Visualisation des dépendances inter-projets

La Synthèse affiche maintenant :
- le nombre de dépendances vers d'autres Projets / Produits ;
- le nombre de dépendances externes dont la tâche amont est en retard ;
- jusqu'à six liens explicites `tâche courante -> [Projet externe] tâche dépendante`.

Le sélecteur `Dépend de` reste global à tout le portefeuille.

Cette version restaure également le renderer de l'onglet Synthèse qui avait été perdu lors de l'évolution V4.7.


## V4.7.3 — Correctif météo et accès aux fonctionnalités

- restauration de `weatherBadge()` ;
- correction de l'erreur `weatherBadge is not defined` ;
- Synthèse reste l'onglet d'arrivée ;
- ajout d'une carte **Fonctionnalités** dans Synthèse ;
- bouton **Ouvrir les fonctionnalités** pour accéder directement au CRUD ;
- la création se fait ensuite avec **+ Nouvelle fonctionnalité** dans l'onglet Fonctionnalités / Roadmap produit.

Le CRUD des fonctionnalités reste exclusivement dans le Cockpit.


## V4.7.4 — Correctif renderers fiche projet

Correction de l'erreur `strategy is not a function`.

Lors des refontes successives de la fiche, plusieurs fonctions de rendu avaient disparu du JavaScript
alors que `renderProject()` continuait à les appeler. Cette version restaure :
- `strategy()`
- `team()`
- `gantt()`
- `resourceLoad()`
- `tasks()`

La météo, la Synthèse, le Planning projet et les Fonctionnalités restent inchangés.


## V4.7.5 — Correctif Pilotage par offre de services

Correction de l'erreur `renderOffer is not defined`.

Les fonctions de rendu de l'onglet **Pilotage par offre de services** ont été restaurées :
- `renderOffer()`
- `offerActivities()`
- `offerProjects()`
- `offerObjectives()`
- `offerResources()`

Cette version ne modifie pas le modèle Grist.


## V4.7.6 — Correctif Offre de services

Correction de l'erreur `projectsForOffer is not defined`.

`projectsForOffer()` a été restaurée. Cette fonction calcule les Projets / Produits associés à une
Offre de services via :
`Offres_Services -> Activites_OFS -> Activites -> Projects`.

Un contrôle supplémentaire compare maintenant toutes les fonctions présentes dans la base stable
V4.6.3 afin d'éviter qu'un autre helper historique manque dans cette release.


## V4.7.7 — MCD consolidé
MCD recalé au 13 août 2026. Voir `MCD.md` et `ARCHITECTURE.md`.

## V4.7.8 — Nature des projets

Ajout de `Projects.Nature_Projet` avec les valeurs :
- `Métier`
- `Support`

La distinction `Projet / Produit` reste dans `Projects.Type`.
`Nature_Projet` est une dimension séparée, principalement pertinente pour les Projets.

Le cockpit permet de saisir/modifier la nature et de filtrer le portefeuille par Nature.

### Pré-requis Grist
Ajouter dans `Projects` une colonne `Nature_Projet`, de type Choice/Text, avec les choix `Métier` et `Support`.


## V4.8.0 — Releases

Deux nouvelles tables métier sont prises en charge :
- `Releases`
- `Release_Fonctionnalites`

Une release :
- appartient à un Projet ou un Produit ;
- possède `Date_Debut` et `Date_Fin` ;
- regroupe des Fonctionnalités ;
- est gérée exclusivement dans le Cockpit.

Nouvel onglet **📦 Releases** sur les fiches Projet et Produit avec CRUD complet et gestion du contenu de la release.

### Schéma attendu

`Releases` :
`Code`, `Nom`, `parent` (Ref Projects), `Type`, `Date_Debut`, `Date_Fin`, `Statut`, `Objectif`, `Responsable` (Ref Team), `Actif`.

`Release_Fonctionnalites` :
`release` (Ref Releases), `fonctionnalite` (Ref Fonctionnalites), `Ordre`, `Statut`, `Commentaire`.

Le champ `Type` peut être une formule Grist : `$parent.Type if $parent else None`.


## V4.8.1 — Bandeau portfolio intégré à l'interface actuelle

Le bandeau **Pilotage par projets / produits** encadre maintenant le titre, la description,
les filtres Type / Domaine / Service / Nature et le bouton **+ Nouveau** dans une seule carte.

La structure actuelle est conservée sous le bandeau :
- liste des projets / produits à gauche ;
- fiche sélectionnée à droite ;
- Synthèse et sous-onglets existants ;
- CRUD, fonctionnalités, releases et planning inchangés.

La fiche projet reçoit seulement une légère harmonisation visuelle pour rester cohérente avec le nouveau bandeau.

## V4.8.2 — Liste portefeuille en tableau

La liste latérale des projets / produits est remplacée par une vue portefeuille pleine largeur,
inspirée de la maquette, avec :
- Code
- Nom
- Type
- Nature
- Domaine
- Service
- Statut
- Avancement
- Dates début / fin
- Météo

Un clic sur une ligne sélectionne l'élément et conserve la **fiche projet / produit actuelle juste en dessous**
avec Synthèse, Planning, Fonctionnalités, Releases, Tâches, Objectifs et Ressources.
