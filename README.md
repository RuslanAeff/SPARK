<p align="center">
  <img src="assets/spark-icon.png" width="120" alt="S.P.A.R.K. Logo" />
</p>

<h1 align="center">⚡ S.P.A.R.K.</h1>

<p align="center">
  <strong>Smart Personal Accounting & Receipt Keeper</strong><br/>
  AI-powered personal finance tracker with receipt scanning
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK_55-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React_Native-0.83-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Gemini_AI-Powered-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Platform-iOS_%7C_Android-green?style=for-the-badge" alt="Platform" />
</p>

---

## 📖 About

**S.P.A.R.K.** is a privacy-first, offline-capable mobile finance app built with React Native & Expo. It helps users track expenses, set budgets, and scan receipts using Google Gemini AI — all while keeping data **locally on the device** in SQLite.

### ✨ Key Highlights

- 🔒 **Offline-first** — All data stored locally in SQLite (`spark.db`)
- 🤖 **AI Receipt Scanning** — Camera/gallery → Gemini AI → structured expense data
- 📊 **Rich Analytics** — Donut charts, bar charts, heatmaps, spending trends
- 🌍 **Multi-language** — Turkish, English, Azerbaijani, Russian
- 🎨 **Glassmorphism UI** — Dark/light themes with neon green primary accent
- 🔐 **Security Hardened** — API keys in OS keychain, input validation, proto-pollution protection

---

## 🖥️ Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Monthly summary, donut chart, budget card, savings goal, category limits, top vendors |
| **Transactions** | Paginated list with time filters, batch selection & deletion |
| **Receipt Scanner** | Camera/gallery capture → image compression → Gemini AI parsing → auto-categorization |
| **Analytics** | Draggable card layout, bar/donut/line charts, spending heatmap, vendor breakdown |
| **Settings** | Budget management, API key (secure), theme (manual + auto schedule), language picker, categories, backup & restore |
| **Notifications** | Smart alerts for budget thresholds, category limits, savings goals, pending drafts |
| **Backup & Restore** | Date-range JSON export/import via system share sheet — atomic & idempotent |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Expo SDK 55, expo-router (file-based routing) |
| **UI** | React 19, React Native 0.83 |
| **Navigation** | Material Top Tabs (rendered at bottom) + PagerView swipe |
| **Animation** | React Native Reanimated 4, Gesture Handler |
| **Charts** | react-native-svg (custom Bar, Donut, Line, Heatmap) |
| **Database** | expo-sqlite (WAL mode, foreign keys) |
| **AI** | Google Generative Language API (Gemini) with dynamic model discovery |
| **Security** | expo-secure-store (OS keychain), expo-crypto (SHA-256) |
| **Backup** | expo-sharing + expo-document-picker |
| **Notifications** | expo-notifications + custom rule engine |

---

## 📁 Project Structure

```
app/                         # Screens & navigation (expo-router)
  _layout.tsx                # Root Stack — providers, theme scheduler
  (tabs)/                    # Bottom tabs: Dashboard, Transactions, Scanner, Analytics, Settings
  add-expense.tsx            # Add/edit expense screen
  edit-items.tsx             # Receipt line items editor
  categories.tsx             # Category management
  goal-settings.tsx          # Savings goal configuration
  notifications.tsx          # Notification center

src/
  components/                # Shared UI (AnimatedCard, DonutChart, SparkToast, ...)
  context/                   # Currency, Refresh, Notifications providers
  db/                        # Schema, database init, DAOs (expense, category, vendor, goal, ...)
  hooks/                     # useExpenses, useBudget, useDatabase, useSavingsGoalData
  i18n/                      # LanguageContext, translations, locale JSON files
  notifications/             # Feed storage, rule engine, notification types
  services/                  # Gemini AI, secure key store, receipt parser, backup service
  theme/                     # Colors (light/dark + proxy), spacing, typography, şüşevar CTA
  utils/                     # Date helpers, currency formatting, input validation, image compression
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Expo Go](https://expo.dev/client) app on your phone (for development)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/RuslanAeff/SPARK.git
cd SPARK

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your EAS_PROJECT_ID

# 4. Start development server
npx expo start
```

### Running on Device

```bash
# Scan QR code with Expo Go app, or:
npx expo start --android    # Android emulator
npx expo start --ios        # iOS simulator
```

---

## 🔑 API Key Setup

S.P.A.R.K. uses **Google Gemini AI** for receipt scanning. To enable this feature:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Open the app → **Settings** → **API Key**
3. Enter your key — it's stored securely in the **OS keychain** (never in plain text)

> **Note:** The app works fully without an API key — receipt scanning will just be disabled.

---

## 🌍 Supported Languages

| Language | Code | Status |
|----------|------|--------|
| 🇹🇷 Türkçe | `tr` | Default |
| 🇬🇧 English | `en` | ✅ Full |
| 🇦🇿 Azərbaycan | `az` | ✅ Full |
| 🇷🇺 Русский | `ru` | ✅ Full |

Language can be changed anytime from **Settings** → bottom-sheet language picker.

---

## 🔐 Security

S.P.A.R.K. has undergone a comprehensive security audit (April 2026). Key measures:

- ✅ **API keys** stored in OS keychain via `expo-secure-store`
- ✅ **Network requests** use `x-goog-api-key` header (never URL query params)
- ✅ **Input validation** on all DAO mutations via centralized `inputValidation.ts`
- ✅ **Proto-pollution protection** on external API responses
- ✅ **Minimal permissions** — only Camera & Gallery (no audio recording)
- ✅ **Sensitive data** never logged; all logs guarded by `__DEV__`
- ✅ **EAS Project ID** loaded from environment variables

---

## ⚡ Performance

All critical performance bottlenecks have been resolved (P1–P12):

- **N+1 queries eliminated** — batch loading with Map lookups
- **Image compression** — receipts compressed to 1536px JPEG 70% before AI processing
- **UI thread animations** — Reanimated SharedValues (zero JS frame drops)
- **Paginated lists** — DB-level offset pagination with FlatList virtualization
- **Context memoization** — all providers use `useMemo`/`useCallback`
- **Theme store** — `useSyncExternalStore`-based dual-channel theme system (no flash-of-dark)

---

## 📦 Backup & Restore

Export your data as a portable JSON file:

1. **Settings** → **Backup & Restore**
2. Choose a date range (presets: This Month, Last Month, Last 3 Months, This Year, Custom)
3. **Export** — generates a JSON file shared via system share sheet
4. **Restore** — pick a backup file; import is **atomic** (all-or-nothing transaction)

---

## 🎨 Design System

- **Theme:** Dark mode (`#050505` background) & Light mode with neon green primary (`#00FF66`)
- **Typography:** Inter font family (400–800 weights)
- **Components:** Glassmorphism cards, animated donut/bar/line charts, custom toast notifications
- **CTA Style:** "Şüşevar" — pill-shaped green button with white uppercase bold text
- **Auto Theme:** Sunrise/sunset based automatic dark↔light switching

---

## 📄 License

This project is **private** and proprietary.

---

<p align="center">
  Built with ⚡ by <a href="https://github.com/RuslanAeff">RuslanAeff</a>
</p>
