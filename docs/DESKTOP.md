# Windows desktop application

The Windows edition wraps the existing React application in Electron. The UI, API contract, authentication, MongoDB backend, scoring logic, routes, and browser-storage keys are shared with the web edition.

## Requirements

- Node.js 22
- npm
- MongoDB for local backend development
- Windows for generating the NSIS installer, or Linux with a complete Wine installation

## Install dependencies

```bash
npm install
npm run install:all
```

## Development

Start the API, Vite client, and Electron window together:

```bash
npm run dev:desktop
```

The desktop client uses `client/.env` for `VITE_API_URL`. Keep the deployed API URL there when building a distributable application.

## Builds

```bash
# Desktop renderer only
npm run build:desktop

# Installer and portable Windows executables
npm run dist:win

# Installer only
npm run dist:win:installer

# Portable executable only
npm run dist:win:portable
```

Artifacts are written to `release/`:

- `SAS-Academy-Typing-Setup-1.0.0.exe` — NSIS installer
- `SAS-Academy-Typing-Portable-1.0.0.exe` — portable application
- `win-unpacked/SAS Academy Typing.exe` — unpacked executable

Windows artifacts are unsigned unless a code-signing identity is configured. Windows SmartScreen may therefore display a warning on first launch.

## Desktop integration

- Native resizable window with standard minimize, maximize, restore, and close controls
- Last normal window size, position, and maximized state persisted in Electron user data
- Single-instance behavior and focus restoration
- Secure isolated renderer (`contextIsolation`, sandbox, no Node.js integration)
- Native save dialog for generated downloads and native file picker for uploads
- External web, email, telephone, maps, and social links opened in the operating system
- Standard edit, zoom, fullscreen, reload, and window keyboard shortcuts
- Packaged local static assets and desktop-aware hash routing
- Friendly network/offline errors while preserving cached site settings and local preferences

## Files added

- `client/.env.desktop`
- `desktop/main.cjs`
- `desktop/preload.cjs`
- `desktop/assets/icon.png`
- `docs/DESKTOP.md`

## Files modified

- `.gitignore`
- `README.md`
- `client/src/App.jsx`
- `client/src/main.jsx`
- `client/src/services/api.js`
- `client/vite.config.js`
- `package.json`
- `package-lock.json`

Generated `client/dist/`, `release/`, and dependency directories are not source files.
