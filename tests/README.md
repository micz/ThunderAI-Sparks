# Tests

Automated tests for **ThunderAI Sparks**, built with the same method as the main
[ThunderAI](https://github.com/micz/ThunderAI) add-on: Node's built-in test runner
(`node:test` + `node:assert/strict`), two levels, and [jsdom](https://github.com/jsdom/jsdom)
as the one development-only dependency. Sparks is a small add-on, so the suite is a single
area rather than ThunderAI's one-area-at-a-time layout, but the shape is the same.

Nothing here is shipped: `tests/`, `package.json`, `package-lock.json` and `node_modules/`
must be excluded from the XPI by the packaging script (`make_xpi_git_sparks.bat` /
`create_xpi_from_folder.bat`), and no runtime code imports anything from `node_modules`.

## The two levels

| Level | Where | What it loads | Needs |
|---|---|---|---|
| **1** | `tests/*.test.mjs` | the shipped modules, imported as they are (`js/mztas-utils.js`, `js/mztas-options-default.js`, and the real background `mztas-background.js` run under a mock) | Node 22+, **nothing to install** |
| **DOM** | `tests/dom/<page>/*.dom.mjs` | the add-on's real page HTML + its script, in jsdom | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26`, `npm ci` |

The different suffix (`.dom.mjs`) keeps the level-1 glob from ever picking up a DOM test, and no
file a `.test.mjs` imports may reach jsdom: level 1 must keep running with nothing installed.

## Running

```sh
node --test "tests/**/*.test.mjs"     # level 1 only: no install
npm ci                                 # once: installs jsdom from package-lock.json
npm test                               # both levels
npm run test:dom                       # DOM tests only
```

Run from the repository root. One file: `node --test tests/01-extract-json.test.mjs`. To see
the modules' console output (captured and hidden by default), set `TEST_VERBOSE=1`.

CI (`.github/workflows/tests.yml`, Node 22 and 24) runs on demand: by hand (Actions → Tests →
Run workflow, or `gh workflow run tests.yml --ref <branch>`), or by adding the `run-tests` label
to a pull request. It runs level 1 first, **before** installing anything (proving it still needs
no install), then `npm ci && npm test`.

## What is covered

Level 1:

- **`01-extract-json`** — `extractJsonObject()`: pulling the JSON object out of the (possibly
  prose-wrapped) LLM payload, and returning `null` on no match / invalid JSON.
- **`02-check-presence`** — the background's external listeners: `checkPresence` replies with the
  manifest version; first install messages ThunderAI `reload_menus`; an unknown action falls
  through.
- **`03-calendar-event`** / **`04-task`** — the `openCalendarEventDialog` / `openTaskDialog`
  flows: JSON extraction, the field whitelist dropping undeclared properties, the task
  "reminder needs a date" rule, and the native dialog result mapping to `"ok"` / an error object.
- **`05-reminder-minutes`** — `reminderMinutes` kept only when it is an integer ≥ -1.
- **`06-field-whitelist`** — static: `CALENDAR_EVENT_FIELDS` / `TASK_FIELDS` in the background
  match the properties in `api/CalendarTools/schema.json` exactly (CLAUDE.md "Gotchas": a new
  field needs both).
- **`07-prefs-default`** — `prefs_default`, the background's matching default read, and the
  options page control.

DOM:

- **`dom/options/01-do-debug`** — the options page: restoring the `do_debug` checkbox from
  storage, saving it on change, and localising the page.

## The method, in short

- **The mock** (`helpers/browser-mock.mjs`): an in-memory WebExtension API, installed on
  `globalThis.browser` **before** any module is imported (the background awaits storage and reads
  the manifest at import time). It models only what the Sparks code touches; the privileged
  experimental API `browser.CalendarTools` — which cannot run outside Thunderbird — is a
  configurable stub (a test says what the native dialog returns).
- **The loader** (`helpers/load.mjs`): `loadModules()`, `startBackground()` (install the mock,
  then dynamically `import()` the background so its listeners register), and `captureConsole()`.
- **The DOM harness** (`helpers/dom-harness.mjs`, the only file that imports jsdom): loads a
  page's real HTML at a `moz-extension://` url, exposes the window globals the page's module code
  reads as bare names, installs the mock, imports the page module, dispatches `DOMContentLoaded`
  and settles.
- **Known issues** (`helpers/known-issues.mjs`): tests are written from the spec, not the code. A
  test that fails against the shipped code runs as a `node:test` TODO (its reason listed in
  `KNOWN`) instead of being bent to pass; once it passes, the run fails so the stale entry is
  removed. The list is empty while the suite matches the spec.

## What is not covered

- The experimental API itself (`api/CalendarTools/implementation.js`): it runs in a privileged
  Thunderbird context and builds real `CalEvent`/`CalTodo` objects, so it is tested by hand in
  Thunderbird.
- Real layout and CSS — jsdom has no layout engine.
- How the UI looks, and the end-to-end round trip with the ThunderAI add-on.
