# Grist Portfolio Cockpit — V2

V2 éditable du cockpit Grist.

## Nouveautés V2

- modification d'un projet ;
- création d'une tâche ou d'un jalon ;
- modification d'une tâche ;
- suppression persistante d'une tâche ;
- suppression persistante d'un projet avec nettoyage des lignes liées :
  - `Tasks`
  - `Contributions_Objectifs`
  - `Allocations`
- confirmation avant suppression ;
- relecture systématique depuis Grist après chaque écriture.

## Principe critique

**Grist est l'unique source de vérité.**

Le widget ne stocke aucune donnée métier dans `localStorage` ou `IndexedDB`.

Chaque modification suit ce cycle :

1. action utilisateur ;
2. `grist.docApi.applyUserActions(...)` ;
3. attente de la confirmation ;
4. `fetchTable()` sur les tables Grist ;
5. reconstruction de l'interface.

Cela évite qu'un ancien état local « ressuscite » des données supprimées.

## Installation

Même procédure que la V1 :

1. publier `index.html`, `app.js`, `styles.css` à la racine d'un dépôt GitHub Pages ;
2. ouvrir l'URL GitHub Pages dans un widget personnalisé Grist ;
3. autoriser `Full document access`.

## Attention au schéma

La V2 écrit directement dans les colonnes suivantes.

### Projects
`nom`, `code`, `statut`, `priorite`, `sponsor`, `progression`, `budget`, `risque`,
`valeurStrategique`, `dateDebut`, `dateFin`

### Tasks
`titre`, `description`, `type`, `statut`, `priorite`, `progression`,
`dateDebut`, `dateEcheance`, `projet`

Si ton document DINUM utilise un nom de colonne différent, adapte les identifiants dans `app.js`.

## Suppression d'un projet

La V2 supprime en une seule action Grist :
- les tâches liées ;
- les contributions stratégiques liées ;
- les allocations liées ;
- puis le projet.

Cette stratégie est volontaire pour éviter les références orphelines.

## Limites V2

- pas encore d'édition de l'activité ;
- pas encore d'édition des contributions stratégiques ;
- pas encore d'édition des affectations `Team` ;
- pas encore de Gantt intégré ;
- pas de mapping configurable des colonnes.

Ce sont de bons candidats pour la V3.
