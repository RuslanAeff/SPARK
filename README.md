<p align="center">
  <img src="assets/spark-icon.png" width="120" alt="S.P.A.R.K. logo" />
</p>

<h1 align="center">⚡ S.P.A.R.K.</h1>

<p align="center">
  <strong>Smart Personal Accounting & Receipt Keeper</strong><br/>
  Privacy-oriented personal finance tracking with optional AI receipt parsing.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK_55-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React_Native-0.83-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native 0.83" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Platform-iOS_%7C_Android-green?style=for-the-badge" alt="iOS and Android" />
</p>

## Overview

S.P.A.R.K. is an offline-first React Native and Expo application for recording expenses, managing budget cycles, tracking savings, debts and additional income, and analysing spending. Financial records live in the device's SQLite database. Google Gemini receipt parsing is optional and is used only when the user configures an API key.

### Main capabilities

- Local expense, receipt-line, category and vendor management
- Income-day-based budget cycles, category limits and savings goals
- Debt, debt-payment and additional-income tracking without double-counting consumption
- Camera/gallery receipt capture and optional Gemini-assisted parsing
- Customisable analytics cards and spending projections
- Persistent notification centre with channel filters and batch actions
- Versioned JSON backup and transactional restore
- Turkish, English, Azerbaijani and Russian interfaces
- Light, dark and scheduled theme modes

## Technology

| Area | Choice |
|---|---|
| Application | Expo, React Native, TypeScript, Expo Router |
| Data | `expo-sqlite`, WAL mode, foreign keys and migrations |
| UI | Reanimated, Gesture Handler, `react-native-svg` |
| AI | Google Generative Language API (Gemini) |
| Secrets | `expo-secure-store` |
| Notifications | `expo-notifications` and a local rule engine |
| Tests | Jest, `jest-expo`, React Native Testing Library |
| CI | GitHub Actions with Node 20, typecheck and Jest |

Exact dependency versions and scripts are owned by [`package.json`](package.json); they are intentionally not duplicated here.

## Repository map

```text
app/                  Expo Router screens and navigation
src/components/       Shared and feature UI
src/context/          Application providers
src/db/               SQLite schema, migrations and DAOs
src/hooks/            Data and domain hooks
src/i18n/             Translation sources and generated locales
src/notifications/    Notification feed and rule engine
src/services/         Gemini, receipt, backup and platform services
src/theme/            Theme store, tokens and CTA contract
src/utils/            Validation, date, money and domain utilities
docs/                 Architecture, development, decisions and evidence
```

## Getting started

### Requirements

- Node.js 20 (the CI reference runtime)
- npm
- Android/iOS tooling or Expo Go for supported development flows

### Install and run

```bash
git clone https://github.com/RuslanAeff/SPARK.git
cd SPARK
npm ci
npm start
```

Useful commands:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
npm test -- --ci --coverage=false
```

EAS build profiles are defined in [`eas.json`](eas.json). Expo application identity, permissions and native plugins are defined by [`app.json`](app.json) together with [`app.config.js`](app.config.js).

## Gemini setup

Receipt parsing requires a Google Gemini API key:

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Open S.P.A.R.K. settings and navigate to the AI/API-key screen.
3. Save the key; the application stores it in the operating-system keychain.

The key must not be committed to the repository, written to SQLite or included in logs. Core manual finance tracking remains available without Gemini.

## Documentation

| Document | Purpose |
|---|---|
| [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md) | Product scope, UX intent and design principles |
| [`AGENTS.md`](AGENTS.md) | Shared human/AI contribution rules |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System, data and domain architecture |
| [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) | Implementation conventions and workflows |
| [`docs/QUALITY_AND_SECURITY.md`](docs/QUALITY_AND_SECURITY.md) | Test strategy, device validation and security boundaries |
| [`docs/decisions/README.md`](docs/decisions/README.md) | Architecture Decision Record index |
| [`docs/history/ENGINEERING_HISTORY_2026.md`](docs/history/ENGINEERING_HISTORY_2026.md) | Retrospective engineering audit history |
| [`docs/evidence/TRACEABILITY.md`](docs/evidence/TRACEABILITY.md) | Requirement-to-evidence traceability for the diploma study |
| [`docs/evidence/AI_COLLABORATION_LOG.md`](docs/evidence/AI_COLLABORATION_LOG.md) | Human decisions, AI contribution and validation record |
| [`docs/templates/`](docs/templates) | Reusable documentation and AI-session templates for other projects |

Current code and configuration remain authoritative when a historical document differs from the running implementation.

## Privacy and permissions

- Financial records are stored locally in SQLite.
- Gemini access is opt-in and requires a user-provided key.
- The API key is stored with `expo-secure-store` and sent in the `x-goog-api-key` header.
- External receipt and backup data pass through validation boundaries before persistence.
- Android configuration currently declares camera, media-read and notification permissions; verify the exact current set in `app.json`.
- The published privacy policy URL is owned by the Expo configuration.

See [`docs/QUALITY_AND_SECURITY.md`](docs/QUALITY_AND_SECURITY.md) for guarantees, limitations and verification responsibilities.

## License

This project is private and proprietary.

<p align="center">
  Built with ⚡ by <a href="https://github.com/RuslanAeff">RuslanAeff</a>
</p>
