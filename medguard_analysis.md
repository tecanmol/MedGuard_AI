# MedGuard AI Implementation & UI/UX Analysis

==================================================
1. PROJECT OVERVIEW
==================================================

- **Application purpose**: A mobile application designed for community health workers to capture patient information, take photos of skin conditions/wounds, and receive AI-driven triage, clinical guidelines, and referral recommendations.
- **Current tech stack**: React Native, TypeScript
- **Framework**: Expo (v57.0.19)
- **UI framework/component libraries**: Custom UI components (`src/components/ui/*`). No major third-party UI libraries (like NativeBase or UI Kitten) are used.
- **State management**: React Context (`AppContext.tsx`) combined with local component state.
- **Navigation/routing**: Expo Router (`expo-router` file-based routing)
- **Backend/API integration**: Currently mocked. Architecture is in place for future backend integration via a Sync Service queue.
- **Local storage/database**: SQLite (`expo-sqlite`) for offline-first data persistence.
- **Authentication**: Local PIN-based authentication (`worker-repository.ts`), tied to a specific worker ID.
- **AI/ML integration**: Simulated local inference (mock TFLite vision model) combined with a multi-agent validation pipeline (Triage, Protocol, Safety, Referral).
- **Offline functionality**: Offline-first architecture. App works completely offline, queueing cases in SQLite to sync when connectivity returns.
- **Network synchronization**: Background queue system (`sync-service.ts`) that detects network state changes and syncs local SQLite data to the cloud.
- **Important third-party libraries**: `expo-camera`, `expo-image-picker`, `expo-crypto`, `react-native-reanimated`, `react-native-gesture-handler`.

==================================================
2. COMPLETE SCREEN INVENTORY
==================================================

### Auth Flow
- **Screen name**: Login
  - **Route**: `/(auth)/login`
  - **Purpose**: Authenticate community health worker.
  - **Reachable via**: App launch (if unauthenticated), Logout.
  - **Displays**: App name, subtitle, error messages.
  - **Forms/Inputs**: Worker ID (text), PIN (numeric secure).
  - **Buttons**: Login (primary), OTP Login (secondary, disabled offline).
  - **Navigation**: "Register here" link.

- **Screen name**: Register
  - **Route**: `/(auth)/register`
  - **Purpose**: Register a new community health worker.
  - **Reachable via**: Login screen link.
  - **Displays**: Registration form.
  - **Forms/Inputs**: Name, Worker ID, Phone, PHC Affiliation, PIN, Confirm PIN.
  - **Buttons**: Register (primary), Back (secondary).

### Tabs Flow (Dashboard)
- **Screen name**: Dashboard (Home)
  - **Route**: `/(tabs)/index` (or `/(tabs)`)
  - **Purpose**: Main landing page for workers to see daily stats and start cases.
  - **Reachable via**: Post-login, Tab bar.
  - **Displays**: Connectivity status, daily case count, high-risk pending count, pending sync warning, list of recent cases.
  - **Buttons**: New Case (primary, full width), View All (link).
  - **Cards**: Stat cards (Cases Today, High Risk), Case summary cards.
  - **Loading/Empty states**: Empty state for no recent cases. Pull-to-refresh control.

- **Screen name**: History
  - **Route**: `/(tabs)/history`
  - **Purpose**: View past cases.
  - **Reachable via**: Tab bar, "View All" on Dashboard.
  - **Displays**: Search bar, list of historical cases with risk badges and sync status chips.
  - **Forms/Inputs**: Search query input.
  - **Empty states**: "No cases found." message.

- **Screen name**: Sync
  - **Route**: `/(tabs)/sync`
  - **Purpose**: Manage and monitor offline data synchronization.
  - **Reachable via**: Tab bar.
  - **Displays**: Last synced time, list of queued sync items (type, reference ID, status, errors).
  - **Buttons**: Sync Now (primary, disabled offline or when syncing).
  - **Icons**: Status chips for sync states.
  - **Empty states**: "✅ Everything is synced!" message.

- **Screen name**: Settings
  - **Route**: `/(tabs)/settings`
  - **Purpose**: Manage user profile and app preferences.
  - **Reachable via**: Tab bar.
  - **Displays**: Profile info (Name, ID, PHC), App/Model version.
  - **Buttons**: Language selection toggles, Logout (danger variant).

### Case Flow (New Assessment)
- **Screen name**: Patient Details
  - **Route**: `/case/metadata`
  - **Purpose**: Collect patient demographic and clinical metadata.
  - **Reachable via**: "New Case" button on Dashboard.
  - **Forms/Inputs**: Patient Name, Age (number), Sex (select), Duration of illness (number), Diabetes Status (select), Pain Level (slider). Condition Category (radio).
  - **Buttons**: Continue (saves draft).
  - **Conditional UI**: Auto-save toast notification (Android only).

- **Screen name**: Image Capture
  - **Route**: `/case/capture`
  - **Purpose**: Take or upload clinical photos.
  - **Reachable via**: Continuing from Patient Details.
  - **Displays**: Placeholder camera frame, image quality feedback, thumbnails of captured images.
  - **Buttons**: Tap to Capture, Select from Gallery, Add Another Angle (disabled at 3 images), Remove (overlay on thumbnail), Continue to Analysis (disabled if no images).
  - **Images**: Rendered thumbnails of captured photos.

- **Screen name**: Analysis Processing
  - **Route**: `/case/analysis`
  - **Purpose**: Loading screen simulating AI inference and multi-agent pipeline.
  - **Reachable via**: Continuing from Image Capture.
  - **Displays**: Activity indicator, current stage text, progress bar, estimated time remaining.
  - **Error states**: Shows warning icon and message if processing fails, with a Back button.
  - **Navigation**: Header back button hidden, gesture back disabled.

- **Screen name**: Triage Result
  - **Route**: `/case/result`
  - **Purpose**: Display the final AI/Agent risk assessment.
  - **Reachable via**: Automatic transition from Analysis.
  - **Displays**: Final risk level, predicted condition, confidence score.
  - **Primary actions**: View Care Guidance, View Referral.
  - **Secondary actions**: View Agent Reasoning.

- **Screen name**: Agent Validation (Agent Reasoning)
  - **Route**: `/case/agents`
  - **Purpose**: Show the internal reasoning of the multi-agent system.
  - **Reachable via**: "View Agent Reasoning" from Result screen.
  - **Displays**: Timeline of agent verdicts (Triage, Protocol, Safety, Referral) with their specific explanations, risk levels, safety overrides, and flags.

- **Screen name**: Care Guidance
  - **Route**: `/case/guidance`
  - **Purpose**: Provide clinical care steps based on the AI diagnosis.
  - **Reachable via**: Result screen.
  - **Displays**: Disclaimer banner, guideline source badge, version, numbered steps (cards), expandable citations/sources.
  - **Conditional UI**: Warning text if using offline "generic_fallback" guidance.

- **Screen name**: Referral
  - **Route**: `/case/referral`
  - **Purpose**: Provide referral recommendations and nearby facilities.
  - **Reachable via**: Result screen.
  - **Displays**: Referral recommendation (self-care, clinic, urgent).

- **Screen name**: Case Summary / Detail
  - **Route**: `/case/summary` & `/case/[id]`
  - **Purpose**: View the complete finalized record of a case.
  - **Reachable via**: End of case flow, or tapping a case in Dashboard/History.
  - **Displays**: Aggregated data from metadata, images, and triage results.

==================================================
3. USER FLOWS
==================================================

A. **App launch → Home**
   - App loads `_layout.tsx`. Splash screen is held.
   - `AppContext` checks SQLite DB for a saved session.
   - If no session, routes to `/(auth)/login`.
   - User enters Worker ID and PIN, taps Login.
   - Validation occurs locally in DB. If success, saves session and routes to `/(tabs)/index` (Dashboard). Splash screen hides.

B. **New assessment**
   - Dashboard: User taps "New Case".
   - `patient information` (`/case/metadata`): User fills out demographics/symptoms. Auto-saves as a draft. User taps Continue.
   - `image capture` (`/case/capture`): User takes a photo. The app runs a local image quality check (`services/image-quality.ts`). Feedback ("Good" or retake reason) is displayed. User accepts image, taps Continue.
   - `AI analysis` (`/case/analysis`): Fake loading screen plays a progress bar animation while simulating TFLite model classification and running the local multi-agent logic (Triage -> Protocol -> Safety -> Referral).
   - `result` (`/case/result`): Final diagnosis and risk level are shown.
   - `explanation` (`/case/agents`): (Optional branch) User taps to see how agents arrived at the verdict, seeing safety overrides or specific flags.
   - `recommendation` (`/case/guidance`): User taps to view step-by-step care guidelines, which are generated based on the AI result and patient metadata.
   - `referral` (`/case/referral`): User taps to view whether the patient should be referred to a higher-tier facility.

C. **Existing patient / records flow**
   - User taps History tab.
   - Sees list of cases. Can type in search bar to filter by name.
   - Taps a case card -> Routes to `/case/[id]` to view the full historical record.

D. **AI/RAG assistant flow**
   - Care Guidelines are currently generated locally using static mock logic (`services/guidelines.ts`), simulating a RAG retrieval system. If offline, it falls back to generic guidelines. 

E. **Offline flow**
   - App operates normally without internet.
   - When a case is completed, it is saved to local SQLite.
   - The `SyncService` adds a "case" record to the `sync_queue` table with status "pending".
   - If user navigates to Guidance offline, a fallback warning is displayed.
   - Dashboard shows "Offline" chip.

F. **Synchronization flow**
   - User navigates to Sync tab.
   - Taps "Sync Now".
   - App checks `isOnline`. If true, loops through pending items in `sync_queue`.
   - Simulates a 300ms network request per item, updates status to "done" or "failed".
   - Updates the "Last synced" timestamp.

==================================================
4. NAVIGATION MAP
==================================================

```text
Root
├── (auth)
│   ├── Login (/login)
│   └── Register (/register)
├── (tabs)
│   ├── Dashboard (/index)
│   ├── History (/history)
│   ├── Sync (/sync)
│   └── Settings (/settings)
└── case
    ├── Patient Details (/metadata)
    ├── Image Capture (/capture)
    ├── Analysis Processing (/analysis)
    ├── Triage Result (/result)
    ├── Agent Validation (/agents)
    ├── Care Guidance (/guidance)
    ├── Referral (/referral)
    ├── Case Summary (/summary)
    └── Case Detail (/[id])
```

==================================================
5. COMPONENT INVENTORY
==================================================

- **Button** (`src/components/ui/Button.tsx`): Reusable pressable component. Props: `title`, `onPress`, `variant` (primary, secondary, outline, danger), `fullWidth`, `loading`, `disabled`.
- **Card** (`src/components/ui/Card.tsx`): Surface container with shadow/elevation. Reusable everywhere.
- **TextInput / UIInput** (`src/components/ui/Input.tsx`): Standard text field with label and error state.
- **NumberInput** (`src/components/ui/Input.tsx`): specialized numeric input.
- **Select** (`src/components/ui/Input.tsx`): Dropdown-style selection.
- **Slider** (`src/components/ui/Input.tsx`): Wrapper around `@react-native-community/slider`.
- **RadioGroup** (`src/components/ui/Input.tsx`): Radio button list.
- **RiskBadge** (`src/components/ui/RiskBadge.tsx`): Displays low/moderate/high risk tiers with associated semantic colors. 
- **StatusChip** (`src/components/ui/StatusChip.tsx`): Displays network connectivity ("Online"/"Offline") or sync status ("Pending", "Done", "Failed").
- **DisclaimerBanner** (`src/components/ui/DisclaimerBanner.tsx`): Warning banner for clinical disclaimers.

==================================================
6. CURRENT DESIGN SYSTEM
==================================================

- **Primary colors**: `#10b981` (Emerald 500)
- **Secondary/Accent colors**: `#06b6d4` (Cyan)
- **Background colors**: Light (`#E0E5EC`), Dark (`#2A2D34`)
- **Text colors**: Light mode (`#1e293b`), Dark mode (`#f1f5f9`), with secondary (`#64748b` / `#94a3b8`) and tertiary variants.
- **Typography**: System default fonts (sans, serif, mono). Font weights utilized: `400`, `500`, `600`, `700`.
- **Semantic Risk Colors**: 
  - Low: `#16a34a` (Green)
  - Moderate: `#d97706` (Orange)
  - High: `#dc2626` (Red)
- **Border radius**: Small (`6px`), Medium (`12px`), Large (`16px`), Extra Large (`24px`).
- **Spacing**: Base units of `4, 8, 12, 16, 24, 32`.
- **Shadows**: Neumorphic soft shadows explicitly defined (`#FFFFFF` and `#A3B1C6` in light mode).
- **Icons**: Emoji placeholders currently used heavily (e.g., 🏠, 📋, 🔄, ⚙️ in tabs).

==================================================
7. RESPONSIVE / MOBILE BEHAVIOR
==================================================

- **Target device sizes**: Primarily mobile phones.
- **Safe areas**: `SafeAreaView` from `react-native-safe-area-context` wraps all major root screens to prevent overlap with notches/home indicators.
- **Scrolling behavior**: Forms (like `/case/metadata`) and lists use `ScrollView` and `FlatList` respectively. 
- **Keyboard behavior**: Basic avoidance, though no specialized `KeyboardAvoidingView` is globally apparent in the snippets provided.
- **Camera behavior**: Triggers native device camera or gallery picker via `expo-image-picker`.
- **Orientation handling**: Default React Native behavior (usually portrait-locked depending on `app.json`).

==================================================
8. AI/ML FUNCTIONALITY
==================================================

- **Image classification**: `ai-inference.ts` mocks a TFLite vision model, returning a predicted skin/wound condition and a confidence score (e.g. 0.4 to 0.95).
- **Confidence/uncertainty**: Displayed as a percentage on the result screen. If below 0.5, flagged as "Uncertain".
- **Multi-agent system**: 
  - *Triage Agent*: Fuses model output with metadata.
  - *Protocol Agent*: Checks if the presentation violates clinical protocol (e.g., duration too long).
  - *Safety Agent*: Hard rules that override lower-risk classifications to "high" (e.g., Fever + Wound).
  - *Referral Agent*: Maps final risk to a facility tier.
- **UI Interaction**: The `/case/agents` screen renders a vertical timeline of how each agent voted, displaying explicit flags (e.g. "Safety Override Applied").

==================================================
9. DATA FLOW
==================================================

1. **User input**: Worker enters data in `/case/metadata` and captures photos in `/case/capture`.
2. **State**: Temporarily held in React component state, then saved to SQLite as a `draft` via `saveDraft`.
3. **Model/API**: During `/case/analysis`, local metadata and image URIs are passed to `classifyImages()` and `runAgentPipeline()`.
4. **Result**: A comprehensive `CaseRecord` object is assembled (including metadata, images, triage verdict, guidelines).
5. **Storage**: The finalized `CaseRecord` is written to SQLite (`saveCase()`) with status "completed".
6. **Synchronization**: A queue record is created in `sync_queue`. The Sync tab polls this and pushes data to the mock cloud endpoint.

==================================================
10. OFFLINE FUNCTIONALITY
==================================================

- **What works offline**: Entire app (Authentication, Case creation, AI inference, Multi-agent reasoning, Dashboard, History).
- **Data stored locally**: Workers, Cases, Sync Queue, App Settings (SQLite).
- **Requires internet**: Synchronization to cloud (`/sync`), and rich/updated Care Guidelines (RAG). 
- **Connection lost**: App falls back to generic guidelines for care instructions. Sync button is disabled. Network chip shows "Offline".
- **Connection returns**: Network chip changes to "Online". Sync tab allows manual triggering.
- **Sync indicators**: Tab bar has a badge for pending sync counts. Dashboard shows a warning banner if items are pending. StatusChips on history cards show "pending" or "failed".

==================================================
11. CURRENT UI/UX PROBLEMS
==================================================

- **Visual problems**: Heavy reliance on system emojis for iconography (tabs, buttons, agents screen). 
- **Usability problems**: 
  - Analysis screen traps the user with `gestureEnabled: false` and a forced 4.8 second mock timer.
  - No clear way to edit a draft once passed the metadata screen without hitting back manually.
  - In the metadata form, auto-saving triggers a toast on every keystroke debounce (Android), which can be annoying.
- **Information hierarchy problems**: Agent validation timeline (`/case/agents`) is dense and text-heavy, making it hard to parse at a glance.
- **Accessibility problems**: Form inputs might lack proper contrast in the current light/dark themes, and neumorphic shadow implementations often fail WCAG contrast guidelines.
- **Consistency problems**: Some screens use `SafeAreaView` from `react-native-safe-area-context`, others use native `View` with padding. 

==================================================
12. IMPORTANT IMPLEMENTATION CONSTRAINTS
==================================================

- **Existing routes**: The Expo Router file structure (`/(auth)`, `/(tabs)`, `/case/*`) must not be broken, as deep links or internal routing rely on it.
- **Existing component APIs**: `Button`, `Card`, `UIInput`, `RiskBadge` props should be maintained so existing screen code doesn't break.
- **Existing state management**: `useApp()` context provides `worker`, `isOnline`, `language`, etc. This must remain intact.
- **Existing model integration**: `classifyImages` and `runAgentPipeline` expect specific `PatientMetadata` shapes. Form fields (Age, Category, Duration) map directly to strict TypeScript types (`src/models/types.ts`).
- **Existing offline behavior**: Draft saving and Sync Queue insertions must not be removed from button handlers (e.g. `debouncedSave`, `saveImages`).

==================================================
13. FILE STRUCTURE
==================================================

- **Navigation**: `src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/case/_layout.tsx`
- **Screens**: `src/app/**/*.tsx` (e.g., `src/app/case/metadata.tsx`)
- **Shared components**: `src/components/ui/*`
- **Styling**: `src/constants/theme.ts`
- **State**: `src/contexts/AppContext.tsx`
- **API / Sync**: `src/services/sync-service.ts`
- **AI/ML**: `src/services/ai-inference.ts`, `src/services/agents/*.ts`
- **Storage**: `src/services/database.ts`, `src/services/case-repository.ts`, `src/services/worker-repository.ts`

==================================================
14. REDESIGN HANDOFF SUMMARY
==================================================

STITCH REDESIGN HANDOFF

MedGuard AI is an offline-first Expo (React Native) application for community health workers. The UI relies on custom components (Button, Card, Input, Badges) styled with a light/dark mode theme system (`theme.ts`). 

**Redesign Scope:**
- Modernize the visual language (typography, colors, shadows) by updating `src/constants/theme.ts` and component implementations.
- Replace emoji-based iconography with professional vector icons (e.g. Lucide or Expo Symbols).
- Improve the layout and readability of dense screens, particularly the Dashboard (`/tabs/index`), Case History (`/tabs/history`), and Agent Reasoning (`/case/agents`).
- Enhance form ergonomics in the Patient Details screen (`/case/metadata`).

**Constraints:**
- Do NOT alter file-based routing paths (`src/app/...`).
- Do NOT alter data model interfaces in `src/models/types.ts`.
- Do NOT change the logic tied to `onPress` or `onChangeText` events, as they trigger critical SQLite saves and offline sync queueing.
- Preserve all existing props on custom UI components to ensure backward compatibility with screens not actively being redesigned.
- Maintain the offline-first feedback loops (Sync Badges, Offline chips, Generic Guideline fallback warnings).

