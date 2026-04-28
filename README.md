# Planning Station-Service v2

Application web de gestion de planning pour station-service, **avec synchronisation cloud temps réel, horaires variables semaine/weekend/férié, effectifs minimums, et préférences employés**.

## 🆕 Nouveautés v2

- **☁️ Synchronisation cloud temps réel** via Firebase : tu modifies sur ton PC, tes équipes voient les modifs instantanément sur leurs téléphones
- **🕐 Horaires variables par type de jour** : chaque shift peut avoir des horaires différents en semaine, weekend et jours fériés (ex: matin 06h-14h en semaine, 07h-15h le samedi). Tu peux aussi désactiver un shift certains jours (ex: pas de shift nuit le dimanche).
- **🎯 Effectifs minimums** par poste, par shift et par type de jour
  → ex: « toujours 3 pompistes le matin et 2 caissières l'après-midi »
- **👤 Préférences employés** par shift (5 niveaux : Doit / Préfère / Neutre / Éviter / Impossible)
  → l'auto-remplissage en tient compte automatiquement
- **🏪 Horaires d'ouverture par station** (chaque station a ses propres horaires)
- **🏬 Multi-stations**
- **🎨 Drag & drop** des shifts
- **💾 Templates de semaine** réapplicables
- **⚠️ Alertes intelligentes** : sous-effectif, repos non respecté, heures supp, préférences violées, anniversaires
- **🔁 Polyvalence** : un employé peut couvrir plusieurs postes
- Vue mensuelle, vue couverture, statistiques, mode impression
- Import des données v1 automatique

## 🚀 Démarrage rapide

1. Ouvre `index.html` dans ton navigateur — l'app marche immédiatement (mode local)
2. Pour partager avec tes équipes, configure Firebase (voir section ci-dessous)
3. Pour héberger en ligne, pousse les fichiers sur GitHub et active GitHub Pages

## ☁️ Mise en place de la synchronisation cloud

**Pourquoi ?** Pour que toi et tes équipes voyiez tous le même planning en temps réel depuis n'importe quel appareil. **C'est gratuit** jusqu'à 1 Go (largement assez pour une station-service).

### Étapes (5-10 minutes)

1. Va sur **[console.firebase.google.com](https://console.firebase.google.com/)** et connecte-toi avec un compte Google
2. Clique **"Ajouter un projet"** → donne-lui un nom (ex: `planning-station`) → Continuer → désactive Google Analytics → Créer
3. Dans le menu de gauche : **Build → Realtime Database → Créer une base de données**
4. Choisis la région la plus proche → mode **"démarrer en mode test"** → Activer
5. Va dans l'onglet **Règles** et remplace le contenu par :
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
   Puis "Publier".
6. Clique l'engrenage ⚙️ en haut → **"Paramètres du projet"**
7. Section **"Vos applications"** → clique l'icône Web `</>`
8. Donne un surnom → "Enregistrer l'application"
9. Tu verras un bloc de code. **Copie les valeurs** de `apiKey`, `authDomain`, `databaseURL`, `projectId`
10. Dans l'app Planning, va dans **Paramètres → Synchronisation Cloud → Configurer**, colle les valeurs, choisis **"Pousser mes données locales vers le cloud"** la première fois → Connecter
11. **C'est fini !** Tes équipes vont sur l'URL de l'app et voient automatiquement les mêmes données.

### Comment ça marche au quotidien

- Tu modifies un planning → c'est uploadé instantanément
- Un employé ouvre l'app sur son téléphone → il voit la dernière version
- Si quelqu'un d'autre modifie en même temps que toi, tu vois ses modifs en quelques secondes
- Si tu n'as pas internet : ça continue de marcher en local, ça resynchronisera plus tard
- L'indicateur en bas à gauche te dit l'état : 🟢 Cloud connecté / 🟡 Connexion / ⚫ Local

### Pour donner accès à un nouvel employé

- **Option simple** : envoie-lui le lien de l'app (URL GitHub Pages). Il clique, il voit immédiatement le planning.
- **Tablette à la station** : ouvre l'app dans le navigateur de la tablette, configure Firebase une fois, et tous les employés peuvent consulter/modifier dessus.

## 📋 Guide d'utilisation

### 1. Configurer les postes (rôles)
**Paramètres → Postes / rôles** → ajoute Pompiste, Caissier, Manager, etc.

### 2. Configurer les shifts avec horaires variables
**Paramètres → Shifts** → 3 par défaut : Matin, Après-midi, Nuit.

Pour chaque shift, tu définis **3 horaires** :
- 📅 **Semaine** (Lun-Ven)
- 🎈 **Weekend** (Sam-Dim)
- 🎉 **Jours fériés**

Tu peux **désactiver** un shift sur un type de jour (ex: pas de shift Nuit le weekend → décoche). Le bouton **"Copier semaine → weekend & férié"** te fait gagner du temps si les horaires sont identiques.

### 3. Configurer les horaires d'ouverture de la station
**Paramètres → Horaires d'ouverture** → pour chaque jour de la semaine : heures d'ouverture/fermeture, ou case "Fermé".

### 4. Définir les effectifs minimums
**Couverture → ⚙️ Configurer minimums** → 3 onglets : Semaine / Weekend / Fériés. Indique le minimum requis par Poste × Shift.

### 5. Ajouter les employés
**Employés → + Ajouter** → 3 onglets :
- **Général** : nom, postes principaux et secondaires (polyvalence), contact
- **Contrat** : type, heures hebdo, congés annuels, tarif horaire
- **Préférences** : jours dispos + préférences par shift (5 niveaux)

### 6. Faire le planning
**Planning** → clique sur une cellule pour affecter manuellement, ou utilise **"✨ Auto-remplir"** : l'app affecte les employés en respectant minimums, préférences, disponibilités, et utilise automatiquement le bon horaire selon le type de jour.

### 7. Templates
Sauvegarde une semaine type ("Été", "Standard"…) puis réapplique-la en un clic.

## 💾 Données

- **Local** : stockées dans le navigateur (localStorage)
- **Cloud** (si Firebase configuré) : synchronisées en temps réel
- **Export/Import** : sauvegarde manuelle en JSON via les boutons de la sidebar

## 📄 Licence

MIT
