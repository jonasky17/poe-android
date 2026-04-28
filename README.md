# Mobile App Project Notes

## Project Description

This app is being built to visually replicate the look and feel of VS Code.

Design direction for now:

1. Use a VS Code inspired color palette.
2. Use typography that matches the VS Code style as closely as possible.
3. Support both dark and light themes across all screens.
4. Keep UI elements reusable so future pages stay consistent.

## Current UI Goals

1. Drawer based navigation with a reusable sidebar.
2. A theme system that can switch between light and dark mode.
3. A centralized design language for spacing, typography, and colors.

## VS Code Color Tokens (Draft)

These are starter tokens inspired by VS Code and can be refined over time.

### Dark Theme

1. `background.app`: `#1E1E1E`
2. `background.panel`: `#252526`
3. `background.sidebar`: `#333333`
4. `text.primary`: `#CCCCCC`
5. `text.muted`: `#9D9D9D`
6. `accent.primary`: `#007ACC`
7. `border.default`: `#3C3C3C`
8. `icon.default`: `#C5C5C5`

### Light Theme

1. `background.app`: `#FFFFFF`
2. `background.panel`: `#F3F3F3`
3. `background.sidebar`: `#EDEDED`
4. `text.primary`: `#1F1F1F`
5. `text.muted`: `#5C5C5C`
6. `accent.primary`: `#005FB8`
7. `border.default`: `#D4D4D4`
8. `icon.default`: `#424242`

## Font Stack Options (By Platform)

Goal: keep typography close to VS Code with practical platform fallbacks.

1. Android primary: `JetBrains Mono` for code-like content, `Inter` for UI text.
2. iOS primary: `Menlo` or `SF Mono` for code-like content, `San Francisco` for UI text.
3. Web primary: `"Segoe UI", "Inter", "JetBrains Mono", monospace`.
4. Fallback rule: always provide a safe default sans-serif and monospace fallback.

## Theme Checklist (Per Screen/Component)

Use this checklist whenever adding or updating a screen/component.

1. Background uses theme token, not hardcoded color.
2. Text colors use theme tokens for both primary and muted states.
3. Borders, dividers, and shadows are theme-aware.
4. Icons use theme-aware colors.
5. Buttons support normal, pressed, and disabled states in both themes.
6. Inputs (if any) support focused, error, and placeholder colors in both themes.
7. Drawer/sidebar colors match active theme.
8. Contrast is readable in both light and dark modes.
9. Screen is visually checked on both browser and Expo Go mobile.
10. No layout breakage in small screens.

## Development Notes (Living Document)

This README is a living reference and should be updated as decisions are made.

Use it to track:

1. UI decisions.
2. Theme and color changes.
3. Font choices.
4. Reusable component plans.
5. Important architecture updates.

## Run Locally

1. Install dependencies.

```bash
npm install
```

2. Start Expo.

```bash
npx expo start
```

3. Test options:

1. Expo Go on Android by scanning the QR code.
2. Browser preview at http://localhost:8081.

## Change Log

### 2026-04-27

1. Initialized Expo project.
2. Replaced bottom tab navigation with a reusable sidebar drawer and hamburger trigger.
3. Added this README as a persistent project memory for ongoing development.
4. Added draft VS Code inspired color tokens, platform font stack notes, and theme checklist.
5. Wired theme tokens into runtime app theme and shared components.
6. Added semantic theme token mapping for reusable screen and component styling.
7. Added manual theme mode control in drawer: System, Light, Dark.
