# Grist Portfolio Cockpit — V3.0.0

## Pourquoi cette V3 ?

La V2 pouvait échouer avec `KeyError 'budget'` si le document Grist ne contenait pas exactement la colonne `budget`.

La V3 corrige ce problème : **les écritures sont désormais tolérantes au schéma**.

Le widget lit la liste réelle des colonnes renvoyées par Grist et n'envoie que les champs qui existent réellement.

Par exemple, si `Projects.budget` n'existe pas, le bouton **Modifier** peut quand même enregistrer le nom, le statut, la progression, etc.

## Nouveautés V3

- correction robuste du `KeyError 'budget'` et erreurs analogues ;
- alias de colonnes (`budget` / `Budget`, `dateDebut` / `Date_Debut`, etc.) ;
- version visible `v3.0.0` ;
- cache-busting des fichiers JS/CSS via `?v=3.0.0` ;
- édition de l'activité du projet ;
- affectation de membres `Team` aux tâches ;
- ajout / retrait d'objectifs stratégiques depuis le cockpit ;
- mini-Gantt intégré, directement calculé depuis `Tasks` ;
- création / modification / suppression persistantes des tâches ;
- suppression contrôlée des projets et dépendances connues ;
- aucune donnée métier persistée dans le navigateur.

## Mise à jour GitHub Pages

Remplace les fichiers de ton dépôt par ceux de ce ZIP et pousse sur `main`.

L'URL Grist ne change pas.

Le bandeau du widget doit ensuite afficher `v3.0.0`. Si ce numéro n'apparaît pas, Grist ou le navigateur affiche encore une ancienne version.

## Source de vérité

Après chaque `applyUserActions`, le widget relit les tables avec `fetchTable`.

Le widget ne restaure jamais une donnée supprimée depuis un cache local.

## Tables

Même modèle qu'avant :

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

## Important

La V3 tolère des colonnes optionnelles manquantes. Les colonnes structurantes restent nécessaires pour certaines fonctions, notamment :
- le lien `Tasks → Projects` ;
- les références de `Contributions_Objectifs` ;
- les références `Projects → Activites → Services → Offres_Services`.

