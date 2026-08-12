# Grist Portfolio Cockpit — V4.2.0

Cette version ajoute deux fonctions structurantes au cockpit V4.1.

## 1. Distinction Projets / Produits

La distinction utilise la colonne réelle :

`Projects.Type`

Le cockpit considère :
- une valeur contenant `Produit` comme un **Produit** ;
- toute autre valeur comme un **Projet**.

Les vues Projet et Offre de services proposent désormais les filtres :
- Tous
- Projets
- Produits

Les badges Projet / Produit apparaissent dans le cockpit et la vue Offre.

## 2. Pilotage par Offre de services

Nouvel onglet **Offre de services** :
- sélection d'une offre ;
- activités OFS ;
- projets et produits rattachés ;
- nombre de projets / produits ;
- avancement moyen ;
- objectifs stratégiques couverts ;
- charge cumulée des ressources.

Chaîne utilisée :

`Offres_Services ← Activites_OFS ← Activites ← Projects`

## 3. Administration CRUD

Nouvel onglet **Administration** permettant de créer, lire, modifier et supprimer :
- `Axes_Strategiques`
- `Objectifs`
- `Offres_Services`
- `Activites_OFS`
- `Activites`
- `Team`

### Protection des suppressions

Le widget calcule les dépendances avant suppression.

Par exemple :
- une activité utilisée par un Project ne peut pas être supprimée ;
- une offre utilisée par une Activites_OFS ne peut pas être supprimée ;
- un objectif utilisé dans CONTRIBUTIONS_OBJECTIFS ne peut pas être supprimé ;
- un membre Team affecté dans Projects, Tasks ou Allocations ne peut pas être supprimé.

## Déploiement

Remplace les fichiers GitHub Pages puis utilise temporairement :

`?v=4.2.0`

sur l'URL du widget Grist pour forcer le rafraîchissement.
