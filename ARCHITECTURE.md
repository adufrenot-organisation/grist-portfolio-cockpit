# ARCHITECTURE.md — Grist Portfolio Cockpit

## 1. Objectif du projet

Ce widget est un cockpit projet / portefeuille pour Grist.

Il agrège les données opérationnelles, stratégiques et métier autour d’un projet, sans dupliquer la donnée et sans maintenir une base parallèle côté navigateur.

> **Principe directeur : Grist est l’unique source de vérité.**

Le widget peut afficher, filtrer, créer, modifier ou supprimer des enregistrements, mais il ne doit jamais considérer un cache local, `localStorage`, `IndexedDB` ou un état mémoire comme une source d’autorité.

Après toute écriture, le widget doit relire les données depuis Grist.

## 2. Architecture fonctionnelle

### Stratégie

`Axes_Strategiques → Objectifs → Contributions_Objectifs → Projects`

Un projet peut contribuer à plusieurs objectifs. `Contributions_Objectifs` est une table de liaison plusieurs-à-plusieurs.

### Offre de services

`Projects → Activites → Services → Offres_Services`

Chaque projet est positionné dans une activité. L’activité appartient à un service, qui appartient à une offre de services.

### Exécution

`Projects → Tasks`

Les tâches et jalons sont regroupés dans `Tasks`. La colonne `type` distingue notamment `tache` et `jalon`.

### Ressources

`Projects → Allocations → Team`

Les membres peuvent également être référencés depuis `Tasks.assignees`.

## 3. Tables Grist attendues

### Projects

Table projet principale.

Colonnes utilisées ou prévues :

- `nom`
- `code`
- `activite` — Reference vers `Activites`
- `sponsor`
- `statut`
- `priorite`
- `dateDebut`
- `dateFin`
- `progression`
- `budget`
- `risque`
- `valeurStrategique`
- `responsable`
- `actif`
- `couleur`

Règle : ne jamais créer une deuxième table projet métier concurrente.

### Tasks

Table opérationnelle des tâches et jalons.

Colonnes attendues :

- `titre`
- `description`
- `dateDebut`
- `dateEcheance`
- `priorite`
- `statut`
- `progression`
- `projet` — Reference vers `Projects`
- `assignees` — Reference List vers `Team`
- `type`

Règle : toute suppression doit être persistée dans Grist avant de disparaître de l’interface.

### Team

Référentiel opérationnel des membres. Le widget doit privilégier cette table pour l’affectation des tâches et allocations.

### Contributions_Objectifs

- `Projet_Code` — Reference vers `Projects`
- `Objectif_Code` — Reference vers `Objectifs`
- `Contribution`
- `Commentaire`

### Objectifs

- `Code`
- `Nom`
- `Axe_Code` — Reference vers `Axes_Strategiques`
- `KPI`
- `Valeur_Cible`
- `Echeance`
- `Responsable`
- `Statut`
- `Progression`

### Axes_Strategiques

- `Code`
- `Nom`
- `Description`
- `Sponsor`
- `Priorite`
- `Horizon`
- `Statut`

### Activites

- `Code`
- `Nom`
- `Service_Code` — Reference vers `Services`
- `Description`
- `Responsable`
- `Type`
- `Capacite_ETP`
- `Statut`

### Services

- `Code`
- `Nom`
- `Offre_Code` — Reference vers `Offres_Services`
- `Description`
- `Responsable`
- `Criticite`
- `Statut`

### Offres_Services

- `Code`
- `Nom`
- `Description`
- `Responsable`
- `Statut`

### Allocations

- `Projet_Code` — Reference vers `Projects`
- `Ressource_Code` — Reference vers `Team`
- `Date_Debut`
- `Date_Fin`
- `Allocation`
- `Role`

## 4. Règles techniques non négociables

### Source de vérité

Grist est la seule source d’autorité.

Interdictions :

- ne pas stocker de copie métier dans `localStorage` ;
- ne pas stocker de copie métier dans `IndexedDB` ;
- ne pas restaurer automatiquement d’anciens enregistrements depuis un cache ;
- ne pas recréer des lignes manquantes sauf action explicite de l’utilisateur.

Autorisé : état UI temporaire en mémoire, filtres locaux, tri local, sélection courante, préférences non métier.

### Écriture

Toute création / modification / suppression doit passer par l’API Grist.

Après écriture :

1. attendre la confirmation de l’API ;
2. relire les tables concernées depuis Grist ;
3. reconstruire l’interface depuis ces données relues.

### Suppression

Une suppression doit être explicite, confirmée par l’utilisateur, propagée dans Grist, puis suivie d’un rafraîchissement depuis Grist.

Ne jamais faire de suppression persistée uniquement côté navigateur.

### Références

Les relations doivent utiliser les IDs de lignes Grist, pas des codes texte, sauf pour l’affichage.

Lorsqu’un widget reçoit une référence, il doit résoudre l’enregistrement correspondant par ID.

### Schéma

Le widget doit tolérer une table ou une colonne optionnelle absente, et pourra proposer à terme un mapping configurable. Il ne doit pas inventer silencieusement un nouveau schéma sans confirmation.

## 5. Politique d’accès

### V1

La V1 est en lecture seule.

Elle peut demander `requiredAccess: "full"` uniquement parce qu’elle lit plusieurs tables du document. Elle ne doit appeler aucune API d’écriture.

### V2+

Pour les versions éditables :

- utiliser l’API Grist d’écriture ;
- afficher des confirmations avant suppression ;
- journaliser les erreurs côté interface ;
- ne jamais masquer un échec d’écriture.

## 6. Organisation recommandée du code

Structure actuelle :

```text
index.html
app.js
styles.css
README.md
ARCHITECTURE.md
```

À partir de la V2, structure recommandée :

```text
src/
  api/
    grist.js
  domain/
    projects.js
    tasks.js
    strategy.js
    resources.js
  ui/
    cockpit.js
    tasks.js
    strategy.js
  state/
    store.js
index.html
styles.css
ARCHITECTURE.md
```

Règle : isoler les appels Grist dans un module dédié.

## 7. Feuille de route fonctionnelle

### V2 — édition sûre

- modifier un projet ;
- créer une tâche ;
- modifier une tâche ;
- supprimer une tâche ;
- créer / supprimer un jalon ;
- confirmations avant suppression ;
- rafraîchissement systématique depuis Grist.

### V3 — cockpit avancé

- Gantt intégré ;
- plan de charge ;
- filtres portefeuille ;
- alertes échéances ;
- risques ;
- budget ;
- synthèse stratégique ;
- navigation offre → service → activité → projet ;
- navigation axe → objectif → projet.

### V4 — gouvernance

- rôles et droits d’édition ;
- journal des actions ;
- contrôles de cohérence ;
- détection de références orphelines ;
- règles de validation ;
- configuration du mapping des colonnes.

## 8. Contrat pour une IA qui reprend le projet

Avant de modifier le code, une IA doit :

1. lire `README.md` ;
2. lire `ARCHITECTURE.md` ;
3. identifier les tables et colonnes touchées ;
4. préserver Grist comme source de vérité ;
5. ne pas introduire de cache persistant métier ;
6. ne pas renommer les tables ou colonnes existantes sans demande explicite ;
7. ne pas créer de nouvelles tables automatiquement sans validation ;
8. expliquer toute migration de schéma ;
9. faire des changements petits et vérifiables ;
10. préserver la compatibilité avec Grist DINUM et GitHub Pages.

## 9. Prompt conseillé pour Claude / Cursor / autre IA

> Tu travailles sur un widget Grist de cockpit projet. Lis d’abord `README.md` et `ARCHITECTURE.md`. Grist est l’unique source de vérité. N’utilise aucun cache persistant pour des données métier et ne recrée jamais automatiquement des lignes supprimées. Toute écriture doit passer par l’API Grist, être confirmée, puis suivie d’une relecture depuis Grist. Préserve les noms de tables et les références existantes. Propose des changements incrémentaux et indique clairement les tables / colonnes impactées.

## 10. Décision d’architecture actuelle

Le widget cockpit peut coexister avec TaskFlow, mais :

- TaskFlow reste un outil opérationnel optionnel ;
- les données maîtres restent dans Grist ;
- le cockpit ne dépend pas d’un état interne TaskFlow ;
- les futures fonctions Gantt / charge devront lire directement Grist ou passer par une intégration explicitement maîtrisée.


---

## Mise à jour V2

La V2 est éditable.

Écritures autorisées :
- `UpdateRecord` sur `Projects`
- `AddRecord`, `UpdateRecord`, `RemoveRecord` sur `Tasks`
- suppression contrôlée d'un projet et de ses lignes dépendantes

Règle V2 :
- aucune modification optimiste persistée uniquement dans l'UI ;
- chaque écriture utilise `grist.docApi.applyUserActions`;
- chaque succès est suivi d'une relecture complète des tables utiles via `fetchTable`;
- une suppression de projet demande confirmation et nettoie les dépendances connues avant le projet.

Avant d'ajouter une nouvelle table dépendante de `Projects`, mettre à jour la suppression en cascade du cockpit ou interdire la suppression tant que des dépendances existent.
