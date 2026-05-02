# Reddit Content Filter Extension

Personal Chromium extension for strictly filtering adult Reddit content.

## Development

Install dependencies:

```powershell
npm install
```

Run end-to-end tests:

```powershell
npm run test:e2e
```

Load this repository folder directly in Chrome:

```text
D:\My Folder\Development\Reddit Content Filter Extension
```

The extension files are `manifest.json` and `filter.js`. E2E tests live in `tests/e2e/` and load the unpacked extension into Chromium with Playwright.

## Version Control

Every meaningful code change should be committed so the project can be rolled back to a known working version. Run the E2E suite before commits when behavior changes.
