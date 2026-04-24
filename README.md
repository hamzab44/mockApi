# MockAPI — Alternative Mockoon

Interface web pour lire, modifier et simuler des fichiers Mockoon `.json`.
Compatible 100% avec le format Mockoon Desktop & CLI.

## Prérequis

- Docker installé et fonctionnel
- WSL Ubuntu
- Make (`sudo apt-get install make`)

## Installation (première fois uniquement)

```bash
make install
```

## Lancer l'application

```bash
make start
```

Ouvre ensuite dans ton navigateur Windows :
http://localhost:5173

## Arrêter

```bash
make stop
```
ou `Ctrl+C` dans le terminal.

## Utilisation

### Charger un fichier Mockoon
1. Onglet **Fichier Mockoon**
2. Clic **Parcourir WSL**
3. Navigue jusqu'à ton `.json` et clique dessus
4. Le fichier est mémorisé → rechargé automatiquement au prochain démarrage

### Routes
- Routes groupées par **dossier** comme dans Mockoon
- **Barre de recherche** pour filtrer parmi toutes les routes
- Clic sur une route → voir headers + corps
- Icône ✏️ → éditer la route et ses réponses multiples

### Tester une route
1. Onglet **Tester**
2. Clique **Démarrer** le serveur simulé
3. Sélectionne méthode + path → **Envoyer**

### Serveur réel (pour ton appli)
Le serveur Express sur `http://localhost:3001` sert les routes mockées
à ton application comme un vrai backend.
Clique **Démarrer** dans l'interface pour activer le routing.

## Structure du projet
mockapi/
├── src/
│   └── MockAPI.jsx     # Composant principal
├── server.cjs          # Serveur Express (fichiers + mock)
├── Makefile            # Commandes make
└── README.md           # Ce fichier

## Stack technique

| Catégorie | Technologie | Rôle |
|-----------|-------------|------|
| Frontend | React 18 | Interface utilisateur |
| Build | Vite | Serveur de développement |
| Éditeur JSON | Monaco Editor | Édition du corps des réponses |
| Backend | Express.js | API fichiers + serveur mock |
| Runtime | Node.js 20 (Docker) | Environnement d'exécution |
| Format | Mockoon JSON | Format natif des environnements |
| Conteneurisation | Docker | Isolation de l'environnement |

## Compatibilité Mockoon

Le fichier `.json` reste dans le format Mockoon natif.
Tes collègues peuvent l'ouvrir directement dans Mockoon Desktop sans aucune conversion.

# Première fois
make install

# Tous les jours
make start