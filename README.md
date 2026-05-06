# MockAPI — Alternative Mockoon

Lightweight Mockoon alternative running in the browser via Docker on WSL Ubuntu.
Reads and writes native Mockoon JSON files — fully compatible with Mockoon Desktop & CLI.

![CI](https://github.com/hamzab44/mockApi/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-1.1.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Prerequisites

- Docker installé et fonctionnel
- WSL Ubuntu
- Make (`sudo apt-get install make`)

## Installation

```bash
make install
```

## Start

```bash
make start
```

Open in your Windows browser:
http://localhost:5173

## Stop

```bash
make stop
# or Ctrl+C in the terminal
```

## Usage

### Load a Mockoon file
1. Go to **Mockoon File** tab
2. Click **Browse WSL**
3. Navigate to your `.json` file and click it
4. The file path is remembered for next sessions

### Routes
- Routes grouped by **folders** like Mockoon Desktop
- **Search bar** to filter across all folders
- Click a route to expand headers and body
- ✏️ Edit route and its multiple responses with rules
- ⚡ Quick test when server is running
- Clone, move and delete routes with auto-save

### Testing a route
1. Go to **Test** tab
2. Click **Start** to activate the mock server
3. Select method + path → **Send**

### Real server (for your app)
The Express server on `http://localhost:3002` serves mocked routes
to your application like a real backend.
Click **Start** in the UI to activate routing.

## Project Structure

```
mockapi/
├── src/
│   ├── MockAPI.jsx              # Main component (~170 lines)
│   ├── version.js               # Version and changelog
│   ├── constants/
│   │   └── theme.js             # Colors (C), icons (I), METHOD_COLORS
│   ├── utils/
│   │   ├── mockoon.js           # Mockoon format helpers (parse, serialize, convert)
│   │   └── simulate.js          # Route simulation engine
│   └── components/
│       ├── ui/
│       │   ├── Icon.jsx         # SVG icon component
│       │   ├── Btn.jsx          # Button component
│       │   ├── Input.jsx        # Input component
│       │   ├── Select.jsx       # Select component
│       │   ├── MethodBadge.jsx  # HTTP method badge
│       │   ├── StatusBadge.jsx  # HTTP status badge
│       │   └── JsonEditor.jsx   # Monaco JSON editor
│       ├── FileExplorer.jsx     # WSL file browser modal
│       ├── RouteEditor.jsx      # Route edit modal with rules engine
│       ├── RoutesTab.jsx        # Routes list with folder navigation
│       ├── TestPanel.jsx        # Route test panel
│       ├── MockoonTab.jsx       # Mockoon file import/export
│       ├── Logs.jsx             # Request logs
│       ├── NewRouteModal.jsx    # New route creation modal
│       └── MoveRouteModal.jsx   # Route move modal
├── server.cjs                   # Express server (File API + mock engine)
├── Makefile                     # make install / start / stop
├── .github/
│   ├── workflows/
│   │   └── ci.yml               # GitHub Actions CI (5 jobs)
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── CHANGELOG.md
└── README.md
```

## Stack

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

The `.json` file stays in native Mockoon format.
Your teammates can open the same file in Mockoon Desktop without any conversion.

# Première fois
make install

# Tous les jours
make start


## Contributing

Contributions are welcome! Please follow the guidelines below.

### Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable production branch |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Maintenance, deps, CI |
| `refactor/*` | Code refactoring |

### Commit convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

<type>: <short description>
[optional body]
Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance
- `refactor` — code refactoring
- `docs` — documentation
- `test` — tests
- `ci` — CI/CD changes

Examples:
feat: add recursive folder navigation
fix: preserve response labels on save
chore: update dependencies

### Pull Request process

1. Fork the repository
2. Create your branch from `main`:
```bash
   git checkout -b feat/your-feature
```
3. Make your changes
4. Ensure CI passes locally:
```bash
   make install
   npm run build
   npm run lint
```
5. Commit following the convention above
6. Push and open a Pull Request against `main`
7. Fill in the PR template
8. Wait for CI to pass before requesting review

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `PATCH` → bug fix
- `MINOR` → new feature
- `MAJOR` → breaking change

Always update `src/version.js` with the new version and changelog entry before opening a PR.

### Release process

Releases are created by maintainers after merging to `main`:

1. Merge PR into `main`
2. Update `src/version.js` version number
3. Create a Git tag:
```bash
   git tag v1.x.x
   git push origin v1.x.x
```
4. Create a GitHub Release from the tag with release notes

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full history.