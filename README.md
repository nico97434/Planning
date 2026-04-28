# Planning Station-Service v2

Application web de gestion de planning pour station-service, **avec effectifs minimums obligatoires, préférences employés et horaires d'ouverture par station**. Tout en local dans le navigateur, aucune connexion serveur requise.

## 🆕 Nouveautés v2

- **Effectifs minimums** par poste, par shift et par type de jour (semaine / weekend / férié)
  → ex: « toujours 3 pompistes le matin et 2 caissières l'après-midi »
- **Préférences employés** par shift (5 niveaux : Doit / Préfère / Neutre / Éviter / Impossible)
  → l'auto-remplissage en tient compte automatiquement
- **Horaires d'ouverture par station** (chaque station a ses propres horaires par jour de la semaine)
- **Multi-stations** (plusieurs stations dans une même app)
- **Vue Couverture** temps réel : voir ce qui est couvert et ce qui manque
- **Vue Mensuelle** complète avec mini-shifts
- **Drag & drop** des shifts entre cellules
- **Templates de semaine** réapplicables en un clic
- **Alertes intelligentes** : sous-effectif, repos non respecté, heures supp, préférences violées, anniversaires...
- **Polyvalence** : un employé peut couvrir plusieurs postes
- **Import depuis v1** automatique

## 🚀 Démarrer

Aucune installation. Ouvre `index.html` dans un navigateur. C'est tout.

Pour publier en ligne :
1. Crée un dépôt GitHub
2. Pousse les 4 fichiers (`index.html`, `styles.css`, `script.js`, `LICENSE`)
3. Active **GitHub Pages** dans Settings → Pages → Source : `main`
4. Tu accèdes à l'app via `https://<ton-user>.github.io/<ton-repo>`

## 📋 Guide d'utilisation

### 1. Configurer les **postes** (rôles)
Settings → "Postes / rôles" → ajoute Pompiste, Caissier, Manager, etc.
Chaque poste a un nom, une couleur, un emoji.

### 2. Configurer les **shifts** (créneaux types)
Settings → "Shifts" → 3 par défaut : Matin (06-14), Après-midi (14-22), Nuit (22-06).
Tu peux les modifier ou en ajouter.

### 3. Configurer les **horaires d'ouverture**
Settings → "Horaires d'ouverture (de cette station)"
Pour chaque jour de la semaine, indique l'heure d'ouverture/fermeture, ou coche "Fermé".
**Chaque station a ses propres horaires.** Si tu en as 2, tu les configures séparément.

### 4. Définir les **effectifs minimums**
Vue Couverture → bouton "⚙️ Configurer minimums"
Trois onglets : Semaine / Weekend / Jours fériés
Pour chaque combinaison Poste × Shift, indique le minimum requis :
- 3 pompistes le matin
- 2 caissières l'après-midi
- 1 manager le matin
- etc.

### 5. Ajouter les **employés**
Vue Employés → "+ Ajouter un employé"

3 onglets dans la fiche employé :
- **Général** : nom, poste principal, postes secondaires (polyvalence), couleur, contact, notes
- **Contrat** : type de contrat, date d'embauche, heures hebdo, congés annuels, tarif horaire
- **Préférences** : disponibilités par jour + préférences par shift (5 niveaux)

### 6. Faire le planning
Vue Planning → clique sur une cellule pour affecter un shift, ou utilise **"✨ Auto-remplir"** pour que l'app affecte automatiquement les employés en :
- respectant les minimums requis
- respectant les disponibilités
- privilégiant les préférences (Doit > Préfère > Neutre > Éviter)
- évitant les "Impossible"
- équilibrant les heures par employé

Tu peux ensuite ajuster manuellement par drag & drop.

### 7. Templates
Sauvegarde une semaine type ("Semaine standard", "Été", "Vacances scolaires"…) puis réapplique-la en un clic plus tard.

## 🎯 Vue Couverture

Indique en temps réel pour chaque jour de la semaine :
- Quels minimums sont **couverts** (✓ vert)
- Ce qui **manque** (rouge)

Le bandeau de couverture en haut du planning montre l'état de chaque jour d'un coup d'œil.

## ⚠️ Alertes automatiques

L'app détecte automatiquement :
- Sous-effectif sur un poste/shift
- Repos < minimum entre deux shifts
- Heures supplémentaires excessives (>15% du contrat)
- Sous-quota d'heures (<85% du contrat)
- Affectation sur un shift marqué "impossible" ou "à éviter"
- Demandes de congés en attente
- Anniversaires à venir

## 💾 Données

Stockées localement dans le navigateur (`localStorage`).
Pour sauvegarder : bouton **"💾 Exporter"** → fichier JSON.
Pour restaurer : bouton **"📥 Importer"** → sélectionne un JSON.

**L'import depuis la v1 est automatique** : tes données v1 seront migrées au format v2.

## 🖨️ Impression

Bouton **"🖨️ Imprimer"** : génère un planning propre en mode paysage, parfait pour l'afficher en pause.

## 🏪 Multi-stations

Le sélecteur de station en haut à gauche permet de basculer entre plusieurs stations. Chaque station a ses propres :
- Employés, shifts, rôles, congés
- Horaires d'ouverture
- Effectifs minimums
- Templates
- Jours fériés

## 🎨 Personnalisation

- Couleurs par employé, shift, poste
- Horaires de shifts personnalisables
- Postes personnalisables avec emoji
- Règles configurables : heures hebdo standard, repos minimum, pause repas auto, tarif horaire

## 📄 Licence

MIT
