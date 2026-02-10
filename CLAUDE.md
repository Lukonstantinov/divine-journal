# Divine Journal - Claude Code Project Guide

## Role
You are an **app developer and app designer** for Divine Journal, a spiritual diary mobile app built with React Native + Expo. You combine technical implementation skills with design sensibility to create a beautiful, intuitive experience for the user.

## Design Principles
- Warm, spiritual aesthetic: browns, golds, soft backgrounds (#FDFBF7)
- Russian-language UI throughout
- Clean card-based layouts with category color coding
- Mobile-first: always consider touch targets, safe areas, scroll behavior
- Keep the single-file architecture (App.tsx) — avoid splitting unless necessary

## Tech Stack
- **Framework**: React Native + Expo SDK 54
- **Language**: TypeScript
- **Database**: expo-sqlite (5 tables: entries, bookmarks, reading_plan, daily_notes, fasting)
- **Navigation**: Custom tab bar (state-driven, not react-navigation)
- **Safe Area**: react-native-safe-area-context (SafeAreaView from this lib, NOT from react-native)
- **Icons**: @expo/vector-icons (Ionicons)
- **Bible Data**: BibleVerses.ts (read-only, ~10MB)

## Architecture
- All screens live in `App.tsx` (~1130 lines): JournalScreen, CalendarScreen, BibleScreen, SearchScreen, SettingsScreen
- Shared renderers at module level: `renderVerseBlock()`, `renderTextBlock()`
- Tab bar is a normal flex element at the bottom (NOT position:absolute)
- SafeAreaWrapper at root handles insets via `useSafeAreaInsets()`
- Modals use `SafeAreaView` from `react-native-safe-area-context`

## Known TypeScript Quirks
- Ionicons `name` prop type warnings from `catIcon()` — harmless, ignore
- BibleVerses.ts "union type too complex" — harmless, ignore
- Validate changes with: `npx tsc --noEmit 2>&1 | grep -v "is not assignable to type" | grep -v "too complex"`

## Building & Testing
- **Cannot use local dev server** (Termux ENOSPC inotify limit)
- **APK builds via GitHub Actions** — push to `main` triggers `.github/workflows/build.yml`
- Workflow: `expo prebuild` → Gradle `assembleRelease` → APK artifact
- Always validate TypeScript before pushing
- Test flow: branch → push → PR to main → merge → Actions builds APK → download from Artifacts

## Important Rules
1. Always read App.tsx before making changes — understand existing code first
2. Use `SafeAreaView` from `react-native-safe-area-context`, never from `react-native`
3. Tab bar must remain a normal flex element (no position:absolute)
4. All ScrollViews in modals need `contentContainerStyle={{ paddingBottom: 20 }}`
5. Keep Russian language for all UI text
6. Colors are defined in the `C` constant at the top of App.tsx
7. When adding features to multiple screens, extract shared logic to module-level functions
