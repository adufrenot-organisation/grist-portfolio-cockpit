# GRIST. COCKPIT Pilotage PMO — V4.3.0

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

`?v=4.3.0`

dans l'URL du widget Grist pour forcer le rafraîchissement.
