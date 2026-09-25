# Contributing to Studio Editor

Thanks for helping improve Studio Editor. Bug reports, documentation, accessibility fixes and focused pull requests are welcome. The project is in beta; check the [roadmap](docs/ROADMAP.md) and [implementation status](docs/IMPLEMENTATION-PROGRESS.md) before starting a larger change.

## Run locally

Use Node.js 22.12+ or 24+.

```sh
git clone https://github.com/metinweb/studio-editor.git
cd studio-editor
npm ci
npm run dev
```

## Make a change

1. Create a branch for a focused change.
2. Preserve document selection, undo/redo and HTML sanitization when changing editing behavior.
3. Add a regression test for behavior changes. Use the existing Node tests for pure logic and Playwright for browser editing.
4. Run the relevant checks below and describe what you tested in your pull request.

```sh
npm run test:unit
npm run build
npx playwright install chromium firefox webkit
npm test
npm run build:library
```

On Linux, use `npx playwright install --with-deps chromium firefox webkit` if browser system dependencies are missing.

For the landing page and hosted demo:

```sh
npm run build:site
npm run test:site
npm run preview:site
```

For package changes, `npm run package:release` builds local archives and `npm run verify:release` tests the installed Vue package. These commands do not publish to npm.

Format only the files you change with Prettier. Keep pull requests small enough to review. Include reproduction steps and browser versions for editing, clipboard and selection bugs. Never attach confidential documents, real access tokens or private user data.

## Project boundaries

The editor engine is implemented in this repository. Do not introduce another rich-text editor engine as a dependency without discussing the architecture first. The application stores documents locally by default. Media and collaboration servers under `examples/` are reference implementations, not production services.

Core UI supports Turkish and English; several advanced messages still need translation. Documentation contributions in either language are welcome.

## Reporting security issues

Use the private reporting channel described in [SECURITY.md](SECURITY.md) for potential vulnerabilities. Avoid public issues containing a working exploit or sensitive information.
