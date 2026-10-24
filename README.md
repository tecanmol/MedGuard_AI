# MedGuard AI 🩺🛡️

An offline-first, AI-assisted clinical triage and diagnostic decision support system designed for frontline community healthcare workers (ASHA/ANM workers in rural and low-resource settings). 

MedGuard AI enables community healthcare workers to capture skin condition photos, perform on-device deep-learning triage with explainable AI (xAI) heatmaps, verify patient safety factors, route referrals to nearby health facilities, and sync case records securely to a centralized PHC portal when network connectivity is available.

---

## 🌟 Core Capabilities

- **100% Offline Edge Inference**: On-device deep learning triage powered by TensorFlow Lite (`react-native-fast-tflite`) with zero network latency.
- **Explainable AI (xAI) Visual Heatmaps**: Calculates an on-device 7×7 Occlusion Sensitivity heatmap showing exactly which image regions influenced the triage score.
- **Calibrated Multi-Agent Safety Consensus**: Fuses image classification with clinical risk factors (diabetes, blood glucose, duration, fever, pain) via specialized safety, triage, protocol, and referral agents.
- **Encrypted Local Enclave**: All case records and images are stored locally in an encrypted SQLite database using `expo-sqlite` with SQLCipher.
- **Offline Healthcare Facility Routing**: Preloaded with primary healthcare centers (PHCs), community health centers (CHCs), and sub-district hospitals, with optional OpenStreetMap Overpass sync.
- **Spark-Tier Compliant Cloud Sync**: Transmits prioritized case records and images via Firestore documents with automatic 8-second network timeouts and auto-recovery. No paid cloud storage buckets required.
- **Stitch Clinical Design System**: Adaptive clinical interface supporting both light and dark modes with high-contrast accessibility standards.

---

## 🛠️ Tech Stack

- **Framework**: React Native 0.86.3 / Expo SDK 57 (Expo Router file-based routing)
- **Machine Learning**: TensorFlow Lite runtime (`react-native-fast-tflite`), EfficientNetV2B0 architecture fine-tuned on clinical dermatological datasets
- **Database**: Local SQLite with SQLCipher (`expo-sqlite`)
- **Backend Sync**: Firebase Firestore (free Spark tier compatible)
- **Languages**: TypeScript, Python (model training scripts)
- **Typography & Theme**: Stitch Clinical Design System (`Inter`, clinical teal palette)

---

## 💻 Setup Guide (New Machine)

### Prerequisites

1. **Node.js**: `v20.x` or higher (LTS recommended)
2. **Package Manager**: `npm` (included with Node)
3. **Expo CLI & EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```
4. **Android Device or Emulator**:
   - Because MedGuard AI uses native hardware modules (Fast TFLite, Encrypted SQLite, Camera), testing full inference requires a physical Android device or an EAS build.

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/MedGuard_AI.git
cd MedGuard_AI
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

1. Copy the template `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and add your keys:
   ```env
   # Google Gemini API Key (optional hybrid online fallback)
   EXPO_PUBLIC_GEMINI_API_KEY="your_actual_gemini_api_key_here"

   # Firebase API Key (optional cloud sync)
   EXPO_PUBLIC_FIREBASE_API_KEY="your_actual_firebase_api_key_here"
   ```
   *(Note: The app runs 100% offline even without these keys; they are only needed for optional cloud sync and online hybrid verification).*

### Step 4: Run Locally in Development

```bash
npx expo start
```

---

## 📱 Building the Standalone APK (EAS Cloud)

Because the project contains native C++ modules (`react-native-fast-tflite`), standard Expo Go cannot run the compiled TFLite model. You should build a standalone APK using EAS Cloud:

### 1. Log in to your Expo account
```bash
npx eas login
```

### 2. Configure Build Environment Variables (Recommended)
Add your API keys to your Expo dashboard under **Project Settings** → **Environment Variables**:
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_FIREBASE_API_KEY`

### 3. Trigger the Standalone APK Build
```bash
npx eas build --platform android --profile preview
```
- EAS Cloud will compile the native Android APK (`~10-15 minutes`).
- Once finished, EAS will provide a direct download link and QR code to install the `.apk` on your phone.

---

## 🤖 Instructions for AI Coding Agents

If you are an AI coding assistant (Antigravity, Cursor, Claude Code, GitHub Copilot, etc.) modifying or extending this codebase, **you MUST follow these architectural rules**:

### 1. Expo SDK 57 Compatibility
- This codebase runs on **Expo SDK 57** (React 19, React Native 0.86).
- Follow official versioned documentation: [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/).
- Do NOT downgrade packages or introduce incompatible legacy react-navigation patterns.

### 2. On-Device TFLite Model Specifications
- **Model Path**: `assets/models/skin_model.tflite` (7.2 MB)
- **Input Tensor**: Shape `[1, 224, 224, 3]`, data type `Float32`.
- **Normalization Crucial Rule**: 
  - **DO NOT normalize pixels in JavaScript** (e.g., do NOT do `(pixel / 127.5) - 1.0` or `pixel / 255.0`).
  - Preprocessing (`Rescaling` / MobileNet normalization) is **already baked into the TFLite computational graph**.
  - Pass raw pixel values in the `0.0 – 255.0` range.
- **Class Labels & Exact Indices**:
  ```ts
  0: 'acne'
  1: 'carcinoma'
  2: 'eczema'
  3: 'keratosis'
  4: 'milia'
  5: 'rosacea'
  ```
- **Policy Rule (`medguard_policy.json`)**:
  - Malignant rule: If calibrated probability for index `1` (`carcinoma`) is $\ge 0.25$, the policy forces `malignant` decision tier regardless of the argmax winner.
  - Temperature scaling: $T = 0.6693$.

### 3. Explainable AI (xAI) Heatmap
- Occlusion Sensitivity is computed across a 7×7 grid.
- Occlusion patch replacement value is mid-grey: `127.5` in the `0–255` raw pixel space.

### 4. Native Module Resilience
- Native modules like `expo-location` may not be linked in every build flavor.
- Always probe native modules safely using `requireOptionalNativeModule` from `expo-modules-core` (see `src/services/location-service.ts`) and provide graceful offline fallbacks.

### 5. Cloud Sync Constraints (Free Spark Tier)
- **Never use Firebase Cloud Storage (`getStorage`, `uploadBytes`)**: It requires a Blaze paid billing plan.
- Images are encoded to base64 and embedded directly inside the Firestore document in `cases/{caseId}`.
- Every Firebase asynchronous call MUST be wrapped with `withTimeout(promise, 8000)` to ensure field workers in spotty 2G/3G connectivity never get stuck on "Transmitting Data...".

### 6. React Native Keyboard & List Architecture
- **Never place active `<TextInput>` controls inside `ListHeaderComponent` of a `FlatList`**.
- Re-rendering inline header functions causes the native input view to unmount/remount on keystrokes, which immediately dismisses the software keyboard. Keep search inputs in a persistent parent `<View>` above the list.

### 7. Design System & Theming
- Import colors and design tokens from `@/constants/theme` (`StitchColors`, `Fonts`, `Spacing`, `BorderRadius`).
- Support both Light and Dark themes via `useTheme()`.
- Ensure status badges (PENDING, UPLOADING, DONE, FAILED) use theme-aware translucent containers with high-contrast text tokens.

---

## 📂 Project Structure

```
MedGuard_AI/
├── assets/
│   ├── images/                # App icons, splash screens
│   └── models/
│       ├── skin_model.tflite  # Production active on-device TFLite model (7.2MB)
│       └── MODEL_README.md    # Model architecture & benchmark documentation
├── src/
│   ├── app/                   # Expo Router screens
│   │   ├── (auth)/            # Login & worker profile selection
│   │   ├── (tabs)/            # Main app tabs (Dashboard, History, Sync, Settings)
│   │   └── case/              # Clinical triage workflow
│   │       ├── capture.tsx    # Guided camera viewfinder & retake check
│   │       ├── metadata.tsx   # Patient clinical factors form
│   │       ├── analysis.tsx   # Inference progress & multi-agent execution
│   │       ├── result.tsx     # Diagnostic report & heatmap viewer
│   │       ├── guidance.tsx   # Standard treatment protocol & citations
│   │       └── referral.tsx   # Health facility referral & PDF slip export
│   ├── components/            # Reusable UI widgets & design system primitives
│   ├── constants/             # Design tokens (theme.ts), translations (i18n.ts)
│   ├── contexts/              # Global React context (AppContext.tsx)
│   ├── models/                # TypeScript interfaces (types.ts)
│   └── services/              # Core business logic
│       ├── agents/            # Safety, Triage, Referral, Protocol sub-agents
│       ├── ai-inference.ts    # TFLite inference & heatmap computation
│       ├── case-repository.ts # SQLite database queries & storage
│       ├── sync-service.ts    # Offline queue & Firestore transmission
│       └── location-service.ts# Safe GPS acquisition & fallback routing
├── eas.json                   # Expo Application Services build profiles
├── app.json                   # Expo configuration & native permissions
└── .gitignore                 # Strict Git rules excluding API keys and datasets
```

---

## 📄 License & Medical Disclaimer

This project is licensed under the Apache 2.0 License.

> **⚠️ CLINICAL DISCLAIMER**: MedGuard AI is an assistive screening tool designed for trained community healthcare workers. It provides risk triage recommendations and decision support based on statistical models. It does not replace definitive clinical examination, laboratory biopsy, or diagnosis by a registered medical practitioner.
