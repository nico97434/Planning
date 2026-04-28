# ⛽ Planning Station-Service

Application web complète et **100% locale** pour gérer les plannings de votre station-service. Inspirée de Combo, sans serveur ni base de données : tout fonctionne dans le navigateur grâce au `localStorage`.

![Aucune dépendance](https://img.shields.io/badge/Dependencies-0-success)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![License MIT](https://img.shields.io/badge/License-MIT-blue)

## ✨ Fonctionnalités

### 📅 Planning hebdomadaire
- Vue calendrier 7 jours x N employés
- Navigation entre semaines (précédente / suivante / aujourd'hui)
- Affectation rapide d'un shift en cliquant sur une cellule
- Shifts personnalisables (Matin, Après-midi, Nuit, Journée…) avec heures et couleurs
- Calcul automatique des heures travaillées (avec gestion des pauses et shifts de nuit)
- Indicateurs visuels : sous-quota (jaune), au-dessus (rouge), conforme (vert)

### 👥 Gestion des employés
- Nombre illimité d'employés
- Heures contractuelles personnalisables par employé
- Disponibilités hebdomadaires (jours travaillables)
- Coordonnées (téléphone, email)
- Couleur d'identification
- Compteur automatique de congés pris / restants

### 🏖️ Gestion des congés
- Demandes : congés payés, RTT, maladie, formation, sans solde, absence
- Statuts : en attente / approuvé / refusé
- Affichage automatique sur le planning quand approuvé
- Calcul auto du nombre de jours pris et restants par employé
- Vue de synthèse globale

### ⚡ Modifications de dernière minute
- Marquer un employé comme **absent** en un clic
- Ajouter une note (motif, remplaçant…)
- Le planning et les statistiques se mettent à jour instantanément
- Possibilité de modifier ou supprimer n'importe quel shift à tout moment

### 📊 Statistiques
- Heures totales par semaine
- Coût estimatif (paramétrable)
- Charge horaire par jour (barres de progression)
- Effectif présent par jour
- Heures par employé vs contrat

### 🤖 Outils intelligents
- **Auto-remplissage** : génère un planning automatique en respectant disponibilités, congés et quotas
- **Copier la semaine** : duplique tout le planning vers la semaine suivante
- **Vider la semaine** en un clic

### ⚙️ Paramètres avancés
- Horaires d'ouverture (avec mode 24h/24)
- Effectif minimum requis
- Heures hebdomadaires standard
- Repos minimum entre 2 shifts (norme légale 11h)
- Création / modification de types de shifts personnalisés

### 💾 Export / Import
- Exporter toutes les données en JSON (sauvegarde)
- Importer un fichier de sauvegarde
- Aucune donnée ne quitte votre navigateur

## 🚀 Installation

### Option 1 : Utilisation locale (le plus simple)
1. Téléchargez ou clonez ce dépôt
2. Ouvrez `index.html` dans votre navigateur
3. C'est prêt ! Vos données sont sauvegardées dans le navigateur

```bash
git clone https://github.com/VOTRE-USERNAME/planning-station.git
cd planning-station
# Ouvrir index.html dans Chrome / Firefox / Safari / Edge
```

### Option 2 : Hébergement gratuit avec GitHub Pages
1. Forkez ou créez un dépôt avec ces fichiers
2. Allez dans **Settings → Pages**
3. Source : `Deploy from a branch` → `main` → `/ (root)`
4. Votre planning est accessible à `https://VOTRE-USERNAME.github.io/planning-station/`

### Option 3 : Serveur local (recommandé pour dev)
```bash
# Avec Python
python3 -m http.server 8000

# Ou avec Node
npx serve

# Puis ouvrir http://localhost:8000
```

## 📖 Guide d'utilisation rapide

### Premier lancement
L'application contient 4 employés de démo et 4 types de shifts pré-configurés. Vous pouvez :
- Les modifier (clic sur la carte employé)
- Les supprimer
- Réinitialiser via **Paramètres → Zone dangereuse**

### Créer un planning
1. Allez dans **Planning**
2. Cliquez sur une cellule vide (intersection employé / jour)
3. Sélectionnez un type de shift (les heures se remplissent automatiquement)
4. Ajoutez une note si besoin
5. **Enregistrer**

### Gérer une absence imprévue
1. Cliquez sur le shift concerné
2. Sélectionnez **"⚠️ Marquer comme absent"**
3. Notez la raison (ex: "Maladie - prévenu à 6h")
4. Le shift apparaît avec hachures rouges
5. Affectez un autre employé sur la même journée si besoin

### Demande de congé
1. **Congés → Nouvelle demande**
2. Choisissez l'employé, le type, les dates
3. Statut = **Approuvé** → apparaît automatiquement sur le planning
4. Le compteur de jours restants se met à jour

### Auto-remplir une semaine
1. Configurez bien :
   - Les disponibilités de chaque employé
   - Les types de shifts à pourvoir
   - L'effectif minimum (Paramètres)
2. Clic sur **✨ Auto-remplir**
3. L'algo affecte les employés en équilibrant les heures et respectant les contraintes

## 📁 Structure du projet

```
planning-station/
├── index.html      # Interface complète
├── styles.css      # Tous les styles
├── script.js       # Logique applicative
├── README.md       # Ce fichier
├── .gitignore
└── LICENSE
```

## 🔒 Confidentialité

**Toutes vos données restent dans votre navigateur** (localStorage). Aucun serveur, aucune télémétrie, aucun cookie tiers. Pour les sauvegarder, utilisez le bouton **Exporter** régulièrement.

⚠️ **Important** : si vous videz le cache de votre navigateur ou utilisez la navigation privée, vos données peuvent être perdues. Pensez à exporter régulièrement.

## 🛠️ Technologies

- HTML5 / CSS3 (variables CSS, Grid, Flexbox)
- JavaScript Vanilla (ES2020+)
- LocalStorage API
- **Aucune dépendance externe**, aucun framework, aucun build

## 🗺️ Améliorations possibles

- [ ] Drag & drop pour déplacer les shifts
- [ ] Vue mensuelle
- [ ] Export PDF / impression
- [ ] Multi-utilisateurs avec backend (Firebase, Supabase…)
- [ ] Notifications de conflits d'horaires
- [ ] Historique des modifications
- [ ] Mode clair / sombre

## 📝 Licence

MIT — utilisation libre, commerciale ou non.

## 🤝 Contribution

Les pull requests sont les bienvenues. Pour des changements majeurs, ouvrez d'abord une issue pour discuter de ce que vous aimeriez modifier.

---

Développé pour simplifier la vie des gérants de stations-service. 🛢️
