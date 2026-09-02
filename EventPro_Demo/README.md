# Vanbaelinghem — Commandes Événementielles

Application web (PWA) pour gérer numériquement les commandes événementielles
multi-magasins de la boucherie Vanbaelinghem : production cuisine, classeur de
préparation, suivi des impressions, chiffre d'affaires, et journal d'audit.

> Ce projet est **séparé** de la PWA `commandes-vanba` existante (commandes
> quotidiennes magasin → labo).

---

## Mode actuel : LOCAL (sans configuration)

Telle qu'elle est livrée, l'application fonctionne **directement en double-
cliquant sur `index.html`**, sans rien installer ni configurer. Toutes les
données (commandes, catalogue, comptes, journal d'audit) sont stockées dans
le navigateur via `localStorage`.

### Démarrage

1. Double-cliquez sur `index.html` — il s'ouvre dans votre navigateur.
2. Au premier lancement, créez votre **compte administrateur** (prénom,
   email, mot de passe) directement depuis l'écran d'accueil.
3. Le catalogue (~55 produits avec prix, repris de vos fichiers Excel
   Noël / Nouvel An) se charge automatiquement.
4. Les salariés n'ont rien à configurer : ils entrent juste leur prénom sur
   l'écran d'accueil pour démarrer une commande.
5. Pour créer d'autres comptes manager/admin, allez dans **Administration >
   Utilisateurs**.

### ⚠️ Limites importantes du mode local

- **Les données restent sur cet ordinateur, dans ce navigateur.** Si vous
  ouvrez l'app sur un autre PC, ou dans un autre navigateur, vous repartez
  de zéro (un nouveau catalogue est créé, mais aucune commande n'est
  partagée).
- **Pas de synchronisation entre magasins.** Chaque magasin qui ouvrirait
  l'app sur son propre poste aurait ses propres données, sans les voir
  s'agréger avec les autres.
- Vider le cache / les données de navigation du navigateur supprime tout.
- C'est un mode parfait pour **tester l'application, valider l'interface et
  les écrans avec de vraies données**, mais pas pour une utilisation réelle
  multi-magasins.

---

## Passer en mode multi-magasins (Firebase) — pour plus tard

Quand vous serez prêts à utiliser l'application en conditions réelles avec
plusieurs magasins qui partagent les mêmes commandes en temps réel, il
faudra activer Firebase. Voici les grandes étapes (à refaire avec moi à ce
moment-là si besoin) :

1. Créer un projet Firebase (gratuit, plan Spark) sur
   https://console.firebase.google.com
2. Activer **Firestore Database** (mode production) et **Authentication**
   (méthode Email/Mot de passe).
3. Copier la configuration Firebase dans `js/config.js` (remplacer les
   `"REPLACE_ME"`).
4. Remplacer `js/data.js` par le contenu de `js/data_firebase.js.bak`
   (la version Firebase est conservée dans ce fichier, prête à être
   réactivée).
5. Réintégrer les balises `<script>` du SDK Firebase dans `index.html`
   (commentées en haut du bloc `<!-- Application -->`).
6. Publier les règles de sécurité du fichier `firestore.rules` fourni.
7. **Héberger l'application en ligne** (GitHub Pages ou Firebase Hosting) —
   contrairement au mode local, Firebase ne fonctionne pas en ouvrant le
   fichier directement (`file://`), il faut un vrai serveur web (même
   gratuit).

## Structure du projet

```
index.html                  Page principale
manifest.json               Manifeste PWA (icônes, nom, couleurs)
service-worker.js           Cache de la coquille applicative (utile seulement en hébergement http/https)
firestore.rules             Règles de sécurité à publier dans Firebase (mode Firebase uniquement)
css/style.css               Styles (identité visuelle + impression)
js/config.js                Constantes métier (magasins, statuts...) + note pour la config Firebase future
js/catalogue.js             Catalogue produits initial + logique de décomposition des menus
js/data.js                  Couche de données ACTIVE — actuellement en mode LOCAL (localStorage)
js/data_firebase.js.bak     Couche de données Firebase, prête à être réactivée (renommer en data.js)
js/app.js                   Routage, état global, authentification
js/ecran_*.js                Un fichier par écran de l'application
```

## Notes importantes

- La **décomposition des menus** est entièrement automatique : un menu vendu
  N fois ajoute N × chaque composant à la production cuisine, avec le détail
  des sources (unités seules vs menus) affiché dans l'écran Production.
- Le **journal d'audit** trace toutes les actions (création/modification/
  suppression de commandes, changements de statut, impressions...).
- L'**impression** marque automatiquement les commandes comme imprimées
  (avec date + utilisateur), évitant les doublons tout en autorisant une
  réimpression manuelle si besoin (filtre "Toutes les commandes").
- Vous pouvez modifier le catalogue produits et la composition des menus à
  tout moment depuis **Administration > Produits & menus**.

