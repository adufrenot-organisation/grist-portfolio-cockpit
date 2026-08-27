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

## V4.8.3 — Navigation Liste → Fiche

- Correction du bandeau de filtres : plus de chevauchement/coupure sur les largeurs normales.
- La vue Pilotage s'ouvre sur le portefeuille.
- Un clic sur un projet ou produit ouvre désormais une **vue fiche dédiée**.
- Bouton **← Retour à la liste** en haut de la fiche.
- L'URL utilise `#projet-ID`, ce qui permet aussi de revenir à une fiche via l'historique/navigation.

## V4.8.4 — Colonnes personnalisables

Le tableau portefeuille propose désormais un bouton **▦ Colonnes**.

Colonnes disponibles :
Code, Nom, Type, Nature, Domaine, Service, Statut, Avancement, Début, Fin et Météo.

- Toutes les colonnes actuelles sont affichées par défaut.
- `Nom` reste toujours visible.
- Le choix est mémorisé localement dans le navigateur de l'utilisateur.
- **Réinitialiser** restaure la vue par défaut.
- Cette fonction masque uniquement des colonnes de la vue : aucune donnée ni colonne Grist n'est supprimée.

## V4.8.5 — Rattachement Releases ↔ Fonctionnalités

Le lien `Release_Fonctionnalites` est maintenant géré dans les deux sens depuis le Cockpit.

### Depuis une Release
Le formulaire Créer / Modifier une release contient désormais un champ multi-sélection
**Fonctionnalités** permettant d'embarquer directement les fonctionnalités du Projet / Produit courant.

### Depuis une Fonctionnalité
Le formulaire Créer / Modifier une fonctionnalité contient désormais un champ multi-sélection
**Release(s)** permettant de rattacher la fonctionnalité à une ou plusieurs releases.

Les cartes Fonctionnalités affichent également les releases auxquelles elles appartiennent.

## V4.8.6 — Correctif modification Projet / Produit

Le formulaire de modification n'envoie désormais que :
- les colonnes réellement présentes dans `Projects` ;
- les valeurs qui ont effectivement changé.

Cela évite qu'une colonne absente du document ou ajoutée dans une version récente bloque tout le `UpdateRecord`.

La fonction `apply()` renvoie maintenant explicitement succès/échec afin que le formulaire ne se ferme
qu'après un enregistrement réussi.

## V4.9.0 — Onglet Documentation

Nouvel onglet principal **📚 Documentation**.

Le Cockpit lit la table Grist `Documentation` et affiche automatiquement toutes les lignes actives,
triées par `Ordre`.

Chaque carte affiche :
- l'icône choisie ;
- le nom ;
- l'URL ;
- ouverture dans un nouvel onglet.

La configuration est entièrement gérée dans Admin & Audit V1.9.

## V4.9.1 — Documentation : URL ou pièce jointe

L'onglet Documentation restitue désormais :
- les URL externes ;
- les pièces jointes Grist de la colonne `Piece_Jointe`.

Pour une pièce jointe, la carte ouvre le fichier via l'accès au document Grist.


## V4.9.2 — Correctif responsive du bandeau Pilotage
Grille adaptative pour éviter les coupures à zoom réduit et dans les widgets Grist.

## V4.9.3 — Bandeau Pilotage sur deux lignes

Le bandeau est maintenant structuré de façon permanente en deux niveaux :

1. titre + description ;
2. filtres + bouton `+ Nouveau`.

Le titre ne partage donc plus sa largeur avec les filtres. Seule la seconde ligne se réorganise
lorsque la largeur du widget diminue.

## V4.9.4 — Compatibilité table Documentation

Le Cockpit lit désormais indifféremment :
- `Documentation`
- `Documentation_v1_9_1`

Il accepte aussi `Type_Document = Fichier` comme alias de `Pièce jointe`.

## V4.9.5 — Table Documentation stricte

Le Cockpit cherche désormais **uniquement** la table technique `Documentation`.

Si Grist refuse ou ne trouve pas cette table, l'onglet Documentation affiche directement :
- le nom exact recherché ;
- l'erreur renvoyée par Grist ;
- un rappel de vérifier l'ID technique de la table et les droits d'accès.

L'ancien alias `Documentation_v1_9_1` n'est plus utilisé.

## V4.9.6 — Diagnostic de lecture Documentation

L'onglet Documentation affiche maintenant explicitement :
- si la table `Documentation` est trouvée ;
- le nombre de lignes lues ;
- le nombre de lignes actives ;
- les colonnes réellement renvoyées par Grist ;
- l'erreur exacte si la table est inaccessible.

Les lignes avec `Actif = false` restent volontairement masquées.

## V4.9.7 — Correction onglet Documentation

- `docsView` est replacé dans le conteneur principal du Cockpit ;
- navigation principale centralisée dans `switchMainTab()` ;
- l'onglet Documentation reste affiché même si son rendu rencontre une erreur ;
- après chaque rechargement des données, l'onglet actif est réappliqué.


## v5.0.0 — Pilotage par les ressources
Nouvel onglet transverse basé sur `Team`, `Team_ref` et `Allocations` :
- capacité ETP totale et charge planifiée ;
- détection des surcharges et ressources non allouées ;
- matrice de charge sur 8 trimestres ;
- filtres équipe, rôle, projet/produit et état de charge ;
- détail d'une ressource et de ses allocations ;
- proratisation d'une allocation sur un trimestre selon ses dates de début/fin.
Aucune nouvelle table Grist n'est requise.

## v5.1.0 — Refonte UX Pilotage des ressources
La base fonctionnelle reste la v5.0.0 et les tables Grist restent inchangées.

Nouvelle ergonomie :
- vue Ressources par défaut sous forme de liste de pilotage ;
- recherche et filtres équipe / rôle / projet ;
- filtres rapides Toutes / Surchargées / Disponibles / Charge normale / Non allouées ;
- alertes de tensions sur les quatre prochains trimestres ;
- vue Plan de charge sur huit trimestres avec jauges ;
- vue Équipes avec capacité agrégée ;
- détail d'une ressource dans un drawer latéral ;
- les ressources sans allocation restent visibles et identifiées comme « Non allouées ».


## v5.2.1 — Correctif réel Nouvelle fonctionnalité
Cause racine corrigée : `openFeature()` utilisait `featureForm.Releases`, mais le formulaire Fonctionnalité ne contenait aucun champ `Releases`. L'appel à `fillMulti()` levait donc une erreur JavaScript avant `showModal()`.

Corrections :
- ajout du sélecteur `Release(s)` au formulaire Fonctionnalité ;
- garde défensive si le champ Releases n'est pas présent ;
- lecture sûre de `selectedOptions` ;
- bouton `+ Nouvelle fonctionnalité` actif sur Projet et Produit ;
- ajout de `Fonctionnalites.Categ_module` ;
- libellé dynamique `Module` pour Projet / `Catégorie` pour Produit.


## v5.4.1 — Correctif sûr gestion des allocations
Cette version repart strictement de la v5.3.0 fonctionnelle fournie.
Le chargement Grist et le bootstrap applicatif ne sont pas modifiés.
Ajouts uniquement :
- création / modification / suppression d'allocations depuis la fiche ressource ;
- formulaire d'allocation ;
- raccourci d'affectation depuis la fiche Projet / Produit.
La liste Projets / Produits et l'ouverture de fiche au clic restent inchangées.


## v5.4.2 — Correctif démarrage
Cause racine de la régression v5.4.1 : `app.js` était exécuté avant le markup du nouveau `allocationDialog`. Le handler `$("allocationForm").onsubmit` levait donc une erreur avant `grist.ready()` / `load()`.
Correction : le script applicatif est désormais chargé tout à la fin du `<body>`, après tous les dialogs.


## v5.4.3 — Console de logs
Ajout d'une console de diagnostic intégrée au Cockpit :
- bouton `Logs` dans le menu supérieur ;
- niveaux INFO / WARN / ERROR ;
- capture des erreurs JavaScript et des promesses rejetées ;
- journalisation du démarrage, du chargement Grist et des écritures ;
- compteur d'erreurs dans le menu ;
- filtre par niveau ;
- `Copier` pour transmettre les logs lors d'un diagnostic ;
- `Vider les logs` pour supprimer immédiatement les logs de la session.
Les logs restent en mémoire dans le navigateur et ne sont pas enregistrés dans Grist.


## v5.4.4 — Correctif boutons allocations
Deux causes racines corrigées :
- `allocationStart(null)` / `allocationEnd(null)` faisaient échouer `+ Nouvelle allocation` avant l'ouverture du dialog ;
- le champ `name="id"` du formulaire entrait en conflit avec la propriété native `HTMLFormElement.id`. Il devient `allocation_id` et est lu via `form.elements`.
La console de logs indique désormais le branchement et le clic des boutons Ajouter / Modifier / Supprimer.


## v5.4.5 — Correctifs issus de la console de logs
Corrections appliquées à partir des erreurs réelles remontées :
- `banner is not a function` : remplacement par `notifyBanner()`, helper sûr qui utilise le DOM si la bannière existe et retombe sur la console de logs sinon ;
- `#docsView` absent : les accès à cette vue deviennent optionnels et ne bloquent plus le Cockpit ;
- conservation du correctif `allocationStart(null)` / `allocationEnd(null)` et du champ `allocation_id`.


## v5.4.6 — Correctif formulaire Allocation
Les logs v5.4.5 ont montré que les boutons étaient correctement branchés, mais que l'ouverture du formulaire échouait avec `Cannot set properties of undefined (setting 'value')`.

Cause : utilisation de propriétés directes du formulaire (`f.Ressource_Code`, `f.Projet_Code`, etc.).
Correction :
- tous les champs sont résolus via `form.elements.namedItem(...)` ;
- helper défensif `allocationFormField()` avec log ERROR si un champ attendu manque ;
- création, modification et soumission utilisent la même méthode fiable ;
- log INFO ajouté quand le dialog est réellement ouvert.


## v5.4.7 — Correctif champ caché Allocation
Les logs v5.4.6 ont montré que le formulaire exposait encore le champ caché `id` alors que le JavaScript attendait `allocation_id`.
Correction ciblée :
- le champ caché du seul formulaire `allocationDialog` est renommé `allocation_id` ;
- le reste des formulaires du Cockpit n'est pas modifié ;
- log supplémentaire des champs réellement détectés à l'ouverture du formulaire.


## v5.4.8 — Correctif suppression Allocation
La croix rouge envoie désormais directement l'action Grist `RemoveRecord` sur la table `Allocations`, journalise l'envoi et la réponse, recharge les données puis rafraîchit le détail ressource.
En cas d'échec, l'erreur est visible dans la console de logs et dans la bannière.

## v5.4.9 — Tâches assignées sur la fiche Ressource
La fiche Ressource affiche deux vues : Allocations et Tâches assignées. Les tâches sont filtrées via `Tasks.assignees` (RefList vers Team). Sont affichés : projet/produit, nom, statut, échéance, fonctionnalité et étape projet si disponibles, avec compteur de tâches en retard.

## v5.4.10 — Présence applicative

Ajout du module `presence.js` sur la base exacte de la v5.4.9 Resource Assigned Tasks.

Le Cockpit écrit un heartbeat toutes les 2 minutes dans la table `SESSIONS_UTILISATEURS`.
La session est propre à chaque onglet navigateur et suit la zone courante :
Portefeuille, fiche Projet/Produit, Offre, Ressources ou Documentation.

Le mécanisme est non bloquant : si la table n'existe pas ou n'est pas accessible,
le Cockpit continue à fonctionner et le badge indique `Présence indisponible`.

## v5.4.11 — Utilisateurs actifs dans le Cockpit

Le badge de présence devient interactif. Il affiche le nombre d'utilisateurs actifs et ouvre un panneau détaillé.

- seuil actif : heartbeat dans les 10 dernières minutes ;
- regroupement par utilisateur : plusieurs onglets = une seule ligne avec compteur de sessions ;
- affichage du nom, email, widget, version, page et dernière activité ;
- option `Tous les widgets` déjà prévue pour l'intégration future d'Admin/Audit et Migration ;
- actualisation manuelle depuis le panneau.

## v5.4.12 — rattachement des fonctionnalités

Correction du rattachement des fonctionnalités à leur projet/produit.

La table Grist `Fonctionnalites` utilise la colonne technique `Parent` avec un P majuscule.
Le Cockpit cherchait en priorité `parent`, ce qui donnait zéro fonctionnalité malgré des références
correctement renseignées dans Grist.

Le Cockpit reconnaît désormais `Parent` et conserve les anciens alias pour compatibilité.
La même tolérance est appliquée aux Releases.

## v5.4.13 — Vue fonctionnalités compacte
Une ligne par fonctionnalité, filtres Module/Stade/Release, recherche, tris et regroupement par module, dans la charte Cockpit.


## v5.4.14 — correction tableKeyFromName
Correction d'une fonction manquante utilisée par le journal d'audit avant les écritures Grist.
L'erreur `tableKeyFromName is not defined` pouvait bloquer toute modification, notamment le passage Projet → Produit.


## v5.4.15 — continuité Projet → Produit
La Roadmap produit utilise exactement le même rattachement `Fonctionnalites.Parent` que la vue Fonctionnalités projet.
Le filtre accepte l'ID de référence Grist et, par sécurité, la valeur affichée nom/code si un ancien import l'a exposée ainsi.
Le changement de `Type` d'un enregistrement Projects ne doit donc jamais faire disparaître ses fonctionnalités.

## v5.4.16 — résolution robuste du parent des fonctionnalités

Le Cockpit résout désormais le rattachement d'une fonctionnalité indépendamment de la casse du nom de colonne
(`Parent`, `parent`, etc.) et accepte les différentes représentations d'une Ref Grist (ID, ["R", id], objet).
En dernier recours, il compare aussi la valeur affichée/helper au nom ou code du projet/produit.
Un diagnostic s'affiche si la table contient des fonctionnalités mais qu'aucune ne pointe vers l'élément courant.

## v5.4.17 — correction modification Projet / Produit

Le formulaire Projet utilisait par erreur un champ caché `allocation_id` et le code lisait `f.id`,
qui correspond à l'ID HTML du formulaire, pas à l'ID de la ligne Grist. Résultat : une modification
pouvait être interprétée comme une création.

Correction :
- champ caché `record_id` explicite ;
- lecture via `f.elements.record_id` ;
- `UpdateRecord` garanti lors de la modification ;
- garde-fou supplémentaire : si le record_id manque mais qu'un projet de même nom unique existe,
  le Cockpit met à jour cette ligne au lieu de créer un doublon.

## v5.4.18 — correction Audit `auditValue is not defined`

Le journal d'audit appelait une fonction `auditValue()` absente du bundle.
Elle est maintenant définie et normalise les valeurs simples, listes, objets et dates avant sérialisation JSON.

La modification Projet ↔ Produit n'est plus bloquée par l'audit.

## v5.4.19 — libellé Synthèse
Dans la fiche Projet / Produit, `Synthèse projet` devient `Synthèse`.

## v5.4.21 — Statut, stade et étape projet des fonctionnalités

- ajout explicite de `Statut` dans l'édition d'une fonctionnalité ;
- `Stade` reste la phase de réalisation (`Développement`, `Recette`, `Production`, `Déploiement`) ;
- ajout de `Étape projet` pour les fonctionnalités rattachées à un objet de type Projet ;
- ajout des filtres Statut et Étape projet dans la vue Fonctionnalités ;
- enrichissement du détail dépliable avec Statut, Stade, Étape projet, dates, avancement et description ;
- résolution tolérante des IDs techniques `Stade/stade`, `Statut/statut`, `Etape_Projet/etape_projet`.

Pour enregistrer `Étape projet`, la table `Fonctionnalites` doit posséder une colonne Ref vers `Etapes_Projet`
(par exemple `Etape_Projet`). Si elle n'existe pas, le champ est affiché mais n'est pas envoyé à Grist.

## v5.4.22 — exploitation de `Projet_Etapes`

Le Cockpit charge désormais la table `Projet_Etapes`.

Dans l'onglet Planning projet :
- affichage de chaque étape du référentiel ;
- dates planifiées et dates calculées depuis les fonctionnalités ;
- écarts début / fin ;
- alerte planning `OK`, `Attention`, `Retard`, etc. ;
- fonctionnalités rattachées à l'étape ;
- tâches de l'étape en détail repliable ;
- création / modification des dates planifiées directement depuis le Cockpit.

Dans la Synthèse :
- ajout des dates calculées des étapes ;
- remontée du nombre d'étapes en alerte ;
- les retards de `Projet_Etapes` alimentent le bloc Alertes.

Colonnes attendues dans `Projet_Etapes` :
`Projet`, `Etape`, `Date_Debut_Planifiee`, `Date_Fin_Planifiee`,
`Date_Debut_Calculee`, `Date_Fin_Calculee`, `Ecart_Debut`, `Ecart_Fin`,
`Alerte_Planning`, `Actif`.

## v5.4.23 — explication des indicateurs
Ajout d'un bouton `?` contextuel à côté des principaux indicateurs de Synthèse et de Planning projet.
Le survol affiche la formule dans une infobulle native ; le clic affiche également l'explication dans la bannière du Cockpit.
Les explications décrivent le calcul réellement effectué par le code ou, pour `Projet_Etapes`, les formules Grist attendues.

## v5.4.24 — dates calculées et cohérence des Releases

La vue Releases calcule désormais à la volée :
- début calculé = MIN(Date_Debut) des fonctionnalités rattachées ;
- fin calculée = MAX(Date_Fin) des fonctionnalités rattachées.

Le Cockpit compare ces bornes aux dates planifiées de la release et signale :
- une fonctionnalité qui commence avant le début planifié ;
- une fonctionnalité qui se termine après la fin planifiée ;
- une release dont la date de début est postérieure à sa date de fin.

Les anomalies remontent également dans le bloc Alertes de la Synthèse.

## v5.4.25 — Releases : calculs portés par Grist

Le Cockpit ne recalcule plus le planning métier des Releases.
Il lit directement les colonnes Grist :
- `Date_Debut_Calculee`
- `Date_Fin_Calculee`
- `Ecart_Debut`
- `Ecart_Fin`
- `Alerte_Planning`

Les fonctionnalités sont encore affichées pour contextualiser visuellement les anomalies,
mais les indicateurs et alertes métier viennent de Grist.

## v5.4.26 — correction régression Fonctionnalités

La modification de la vue Releases avait supprimé par erreur trois fonctions du bundle :
- `productFeaturesView()`
- `releaseIdsForFeature()`
- `syncFeatureReleases()`

Elles sont restaurées depuis la dernière version stable de la vue Fonctionnalités.
Les évolutions `Projet_Etapes` et Releases pilotées par Grist sont conservées.

## v5.4.27 — résolution de `Fonctionnalites.Parent`

Correction du filtrage des fonctionnalités dans la fiche Projet / Produit.
Le résolveur accepte désormais l'ID technique de la Ref Grist **et** sa valeur d'affichage (nom/code), y compris les helpers Grist.
La vue Roadmap passe directement l'objet Projet/Produit courant afin d'éviter toute confusion avec un autre ID lors du fallback.

## v5.4.28 — correction des filtres Roadmap
Correction de `a.localeCompare is not a function` dans la Roadmap/Fonctionnalités.
Les valeurs issues de Grist (notamment les Ref et valeurs numériques) sont désormais normalisées
avant tri des listes Module, Stade, Statut, Étape et Release.

## v5.4.29 — Suggestions utilisateurs

Ajout d'un bouton global `💡 Suggestion` dans le Cockpit.

La suggestion enregistre automatiquement :
- `Module = Cockpit`
- le contexte courant (portefeuille, synthèse, planning, fonctionnalités, releases, ressources, etc.)
- le projet courant lorsqu'il existe
- `Statut = Nouvelle`
- `Actif = true`

`Auteur_Email` et `Date_Creation` doivent être alimentés dans Grist par des trigger formulas
`user.Email` et `NOW()` à la création de la ligne. Le Cockpit ne peut donc pas usurper l'auteur.

Table attendue : `Suggestions`.

## v5.4.30 — Chat et suivi des fonctionnalités

- Intégration des tables `Discussions` et `Messages` dans le Cockpit.
- Bouton global `💬 Discussions`.
- Création de discussions projet/directes et envoi de messages.
- Intégration de `Suivi_Fonctionnalites` dans la fiche d'une fonctionnalité.
- Ajout d'un commentaire daté avec photographie de la progression, du statut et du stade.
- Les auteurs et horodatages restent alimentés côté Grist par trigger formulas (`user.Email`, `NOW()`).

## v5.4.31 — Menu ergonomique et paramétrage du Front Office

- barre d'identité/présence séparée de la navigation principale ;
- navigation principale simplifiée : Projets/Produits, Offres, Ressources, Documentation ;
- menu `Plus` pour les actions secondaires et les Logs ;
- Suggestions et Discussions peuvent être affichées dans la barre principale, dans `Plus`, ou masquées ;
- Présence peut être affichée ou masquée ;
- ordre des fonctions collaboratives configurable ;
- paramètres stockés dans Grist dans `Parametres_FrontOffice`.

## v5.4.32 — séparation Front Office / Back Office

Le Cockpit ne propose plus d'écran de paramétrage de `Parametres_FrontOffice`.

Il conserve uniquement le comportement Front Office :
- lecture de `Parametres_FrontOffice` ;
- affichage / masquage de Suggestions, Discussions et Présence ;
- positionnement Barre principale / menu Plus ;
- ordre d'affichage.

La modification de ces paramètres est désormais réservée au widget Admin & Audit PMO.
