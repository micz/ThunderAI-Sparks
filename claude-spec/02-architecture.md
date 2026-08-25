# Architecture

## Components

```
manifest.json
  └─ background: mztas-background.js  (ES module, top-level await)
  └─ experiment_apis.CalendarTools
        ├─ schema:  api/CalendarTools/schema.json
        └─ script:  api/CalendarTools/implementation.js   (privileged)
  └─ options_ui: options/mztas-options.html

js/
  mztas-utils.js            extractJsonObject(str)  → parsed object | null
  mztas-logger.js           tasLogger(prefix, do_debug)
  mztas-i18n.js             __MSG_*__ DOM localizer (vendored)
  mztas-options.js          storage.sync get/set helper (vendored, MPL-2.0)
  mztas-options-default.js  { do_debug: false }

options/
  mztas-options.html/.css/mztas-options-page.js   Options page
  mztas-release-notes.html/.css/.js               Release-notes view

_locales/<lang>/messages.json                      i18n (default: en)
```

### `mztas-background.js` — the entry point

The only always-on code. Responsibilities:

1. Read the `do_debug` pref and build a `tasLogger`.
2. On `runtime.onInstalled` with `reason == "install"`, send
   `{action: "reload_menus"}` to `thunderai@micz.it` so ThunderAI rebuilds its
   menus to include Sparks-enabled items.
3. Register `runtime.onMessageExternal` and dispatch on `message.action`:
   - `checkPresence` → `Promise.resolve(SPARKS_VERSION)`
   - `openCalendarEventDialog` → extract JSON from `message.calendar_event_data`,
     call `CalendarTools.openCalendarDialog`.
   - `openTaskDialog` → extract JSON from `message.task_data`, call
     `CalendarTools.openTaskDialog`.

`SPARKS_VERSION` comes from `browser.runtime.getManifest().version` — never
hardcoded.

### `api/CalendarTools/` — the experimental API

The reason the add-on exists. `schema.json` declares the API surface; the two
functions are `async` and take a single object parameter. `implementation.js`
runs in a **privileged** context and is wrapped in the experiments-framework
idiom:

```js
(function (exports) {
  var { cal } = ChromeUtils.importESModule(".../calUtils.sys.mjs");
  // ... CalTimezoneService, CalAttendee, CalEvent ...
  var CalendarTools = class extends ExtensionCommon.ExtensionAPI { ... };
  exports.CalendarTools = CalendarTools;
})(this);
```

`openCalendarDialog(cal_data)`:
- Finds the most recent `mail:3pane` window (throws if none).
- Builds start/end `cal.createDateTime(...)`; if `use_timezone`, applies the
  timezone via `CalTimezoneService`.
- Creates a `CalEvent`, sets title, calendar (the window's selected calendar),
  start/end, optional attendees (`CalAttendee`), optional `LOCATION` and
  `DESCRIPTION` properties.
- Opens the native dialog via `window.createEventWithDialog(..., event, forceAllDay)`.
- Returns `{result: true}` or `{result: false, error}`.

`openTaskDialog(task_data)`:
- Same window lookup and timezone handling for `dueDate` / `initialDate`.
- Opens the native todo dialog via `window.createTodoWithDialog(calendar,
  dueDate, summary, null, initialDate)`.
- Returns `{result: true}` or `{result: false, error}`.

> The `(function(exports){...})(this)` closure, the `ChromeUtils` /
> `Services` / `ExtensionCommon` globals, and the `ExtensionAPI` subclass are
> required by the experiments framework. Do not refactor them into standard ES
> imports.

## End-to-end flow

```
ThunderAI (separate add-on)                      Sparks (this add-on)
────────────────────────────                     ─────────────────────
user picks "add to calendar"
   │
   ├─ runs its PROMPT against the LLM
   │  (prompt lives in ThunderAI settings)
   │
   ├─ gets back text containing JSON
   │
   └─ runtime.sendMessage(
        'thunderai-sparks@micz.it',
        { action: 'openCalendarEventDialog',
          calendar_event_data: '<llm text>' })
                                  │
                                  ▼
                        onMessageExternal
                          │
                          ├─ extractJsonObject(text)  → {startDate, ...}
                          │  (js/mztas-utils.js: first {...} match, JSON.parse)
                          │
                          └─ browser.CalendarTools.openCalendarDialog(obj)
                                  │  (privileged experiment)
                                  └─ native Thunderbird event dialog opens,
                                     pre-filled. User reviews & saves.
                          │
                          └─ returns "ok" | {result:"error", error}
```

The task flow is identical with `openTaskDialog` / `task_data` /
`openTaskDialog`.

## Options / storage

- Prefs stored in `browser.storage.sync`. Only one pref today: `do_debug`.
- `mztas-options.js` (vendored options-manager) wires `.option-input` elements
  to `storage.sync` on `change`, and restores them on load.
- The options page and release-notes page are localized via the `__MSG_*__`
  helper in `mztas-i18n.js`.

## Error handling

- JSON extraction failures and API errors are caught and returned as
  `{result: "error", error}` (background) or `{result: false, error}`
  (implementation), and logged to the console with a `[ThunderAI Sparks]` prefix.
- Verbose diagnostic logs go through `tasLogger` and only print when `do_debug`
  is enabled.
