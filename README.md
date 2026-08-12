# Grist Portfolio Cockpit — V1

Widget **lecture seule** pour Grist, adapté au modèle :

`Axes_Strategiques → Objectifs → Contributions_Objectifs → Projects → Tasks / Team`

et

`Projects → Activites → Services → Offres_Services`.

## Ce que la V1 affiche

- sélecteur de projet ;
- KPI : avancement, tâches actives, retards, jalons, budget ;
- objectifs stratégiques et contribution du projet ;
- offre, service et activité associés ;
- équipe / allocations ;
- tâches et jalons avec filtres.

## Installation avec GitHub Pages

1. Crée un dépôt GitHub, par exemple `grist-portfolio-cockpit`.
2. Dépose **à la racine** `index.html`, `app.js`, `styles.css`.
3. Dans GitHub : **Settings → Pages**.
4. Choisis **Deploy from a branch**, branche `main`, dossier `/ (root)`.
5. Récupère l’URL `https://<compte>.github.io/grist-portfolio-cockpit/`.
6. Dans Grist DINUM : **Ajouter un widget → Widget personnalisé → URL personnalisée**.
7. Colle l’URL GitHub Pages.
8. Autorise **Full document access**.

### Pourquoi “Full document access” alors que la V1 est en lecture seule ?

Le cockpit doit lire plusieurs tables du même document. L’API Grist réserve cet accès multi-table au niveau `full`. Le code V1 n’appelle **aucune API d’écriture** : `applyUserActions` n’est pas utilisée.

## Tables attendues

- `Projects`
- `Tasks`
- `Team`
- `Contributions_Objectifs`
- `Objectifs`
- `Axes_Strategiques`
- `Activites`
- `Services`
- `Offres_Services`
- `Allocations`

Une table absente n’empêche pas le widget de démarrer ; la zone correspondante sera simplement vide.

## Colonnes principales attendues

### Projects
`nom`, `code`, `activite`, `sponsor`, `statut`, `priorite`, `dateDebut`, `dateFin`, `progression`, `budget`, `risque`, `valeurStrategique`

### Tasks
`titre`, `description`, `dateDebut`, `dateEcheance`, `priorite`, `statut`, `progression`, `projet`, `assignees`, `type`

### Contributions_Objectifs
`Projet_Code`, `Objectif_Code`, `Contribution`

### Objectifs
`Nom`, `Axe_Code`, `KPI`, `Echeance`, `Statut`

### Activites / Services
`Activites.Service_Code` et `Services.Offre_Code`

### Allocations
`Projet_Code`, `Ressource_Code`, `Allocation`

## Étape suivante proposée — V2

Après validation de la V1 : édition projet, création/modification/suppression de tâches avec confirmation, et **chaque écriture directement vers Grist** sans état local faisant autorité.
