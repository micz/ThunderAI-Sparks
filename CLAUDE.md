# CLAUDE.md

Guidance for AI agents working in the **ThunderAI Sparks** repository.

## What this project is

ThunderAI Sparks is a **Thunderbird MailExtension** (add-on) that acts as a
companion/helper for the main **ThunderAI** add-on. It adds "advanced" features
to ThunderAI that require Thunderbird's [experimental
APIs](https://developer.thunderbird.net/add-ons/mailextensions/experiments) —
capabilities that ThunderAI itself cannot ship because they need privileged,
non-WebExtension access to Thunderbird internals (the calendar backend, in this
case).

Concretely, Sparks currently exposes two features, both driven by ThunderAI:

- **Create a calendar event from a mail message** ([ThunderAI #182](https://github.com/micz/ThunderAI/issues/182))
- **Create a task (todo) from a mail message** ([ThunderAI #333](https://github.com/micz/ThunderAI/issues/333))

> **IMPORTANT — the split between the two add-ons.**
> Sparks is *only the executor*. It does **not** talk to any LLM, and it does
> **not** contain the prompts. All AI prompting, model configuration, message
> extraction, and user-facing menus live in the **ThunderAI** add-on (a separate
> repository: https://github.com/micz/ThunderAI). ThunderAI asks the LLM to
> produce structured JSON (event/task data), then sends that JSON to Sparks via
> cross-extension messaging. Sparks parses it and opens the native Thunderbird
> calendar/task dialog pre-filled with the data.
>
> **When a feature or behavior depends on a prompt, the prompt is edited in
> ThunderAI, not here.** Several CHANGELOG entries say "be sure to update the
> prompt in the ThunderAI settings" for exactly this reason (e.g. `location`,
> `description`, `attendees` fields). If you add a new field to an event/task,
> the corresponding change to *ask the LLM for that field* is a ThunderAI change.

## The two repositories

| | ThunderAI | ThunderAI Sparks (this repo) |
|---|---|---|
| Extension ID | `thunderai@micz.it` | `thunderai-sparks@micz.it` |
| Role | LLM prompting, settings, menus, message extraction | Executor for experimental-API features |
| Contains prompts? | **Yes** | No |
| Talks to LLM? | Yes | No |
| Issue tracker | Yes (use `Sparks` label for this add-on) | Uses ThunderAI's tracker |

Issues for Sparks are filed in the **ThunderAI** repo with the
[`Sparks` label](https://github.com/micz/ThunderAI/labels/Sparks).

## How the two add-ons communicate

1. Sparks registers `browser.runtime.onMessageExternal` (see
   [`mztas-background.js`](mztas-background.js)).
2. ThunderAI sends a message to `thunderai-sparks@micz.it` with an `action`:
   - `checkPresence` → Sparks replies with its version string (so ThunderAI can
     detect Sparks is installed and which version).
   - `openCalendarEventDialog` → payload `message.calendar_event_data` (a string,
     often the raw LLM output).
   - `openTaskDialog` → payload `message.task_data`.
3. Sparks extracts the JSON object out of the payload string with
   `extractJsonObject()` ([`js/mztas-utils.js`](js/mztas-utils.js)) — it greedily
   matches the first `{ ... }` block, so the LLM output may contain surrounding
   prose.
4. Sparks calls into its experimental API `browser.CalendarTools.*`, which opens
   the native Thunderbird dialog.
5. On first install, Sparks messages ThunderAI (`action: "reload_menus"`) so
   ThunderAI rebuilds its menus and shows the Sparks-enabled items.

The **experimental API** is the whole reason Sparks exists: it needs
`ChromeUtils.importESModule(...)` access to Thunderbird's calendar modules
(`CalEvent`, `CalAttendee`, `CalTimezoneService`, `calUtils`) which are not
available to regular WebExtensions. This is also why the add-on requests full
permissions.

## Layout

```
manifest.json              MV2 manifest; registers background + experiment_apis
mztas-background.js        Cross-extension message listener (the entry point)
api/CalendarTools/
  schema.json              Experimental API surface (openCalendarDialog, openTaskDialog)
  implementation.js        Privileged impl: builds CalEvent/todo, opens native dialogs
js/
  mztas-utils.js           extractJsonObject() — pull JSON out of LLM text
  mztas-logger.js          tasLogger — debug logging gated on the do_debug pref
  mztas-i18n.js            __MSG_*__ DOM localization helper (vendored)
  mztas-options.js         Options-manager helper (vendored, MPL-2.0)
  mztas-options-default.js Default prefs: { do_debug: false }
options/                   Options UI + release-notes page
_locales/<lang>/messages.json   Translations (default_locale: en)
images/                    Icons
```

See [`claude-spec/`](claude-spec/) for detailed architecture docs.

## Conventions

- **Manifest v2**, background is an ES module (`"type": "module"`), top-level
  `await` is used in the background script.
- **Version** is read at runtime from the manifest
  (`browser.runtime.getManifest().version`) — do not hardcode it. When bumping a
  release, change `manifest.json` `version` and add a `<h2>` block at the top of
  [`CHANGELOG.md`](CHANGELOG.md) (note: CHANGELOG uses HTML `<h2>`/`<ul>`, not
  markdown headings).
- **Naming**: files/vars are prefixed `mztas` / `tas` (ThunderAI Sparks).
- **License**: GPL-3.0 for the add-on's own files (keep the header block on new
  source files); some vendored helpers (`mztas-options.js`, `mztas-i18n.js`)
  carry their own upstream licenses — leave those headers intact.
- **Localization**: user-facing strings go through `_locales`; the `en` locale is
  the source of truth. Translations are contributed (often via Weblate) — don't
  hand-edit non-`en` locales unless asked.
- **Logging**: use `tasLogger`; verbose logs are gated behind the `do_debug`
  storage pref so they stay silent in production.

## Testing / running

There is no build step and no automated test suite. To exercise it manually you
load it as a temporary add-on in Thunderbird (140+) alongside ThunderAI. The
commented `testThunderAISparks()` block in
[`mztas-background.js`](mztas-background.js) shows the shape of a direct
`CalendarTools` call for ad-hoc testing.

## Gotchas

- Thunderbird version compatibility is tight (`strict_min_version` /
  `strict_max_version` in the manifest). Experimental APIs break across
  Thunderbird versions — most CHANGELOG entries are compatibility bumps.
- `implementation.js` runs in a privileged context; the closure-wrapped
  `(function(exports){...})(this)` pattern and the `ChromeUtils`/`Services`
  globals are required by the experiments framework — don't "modernize" them into
  regular imports.
- A new event/task field needs changes in **both** repos: the field plumbed
  through `schema.json` + `implementation.js` here, and the LLM asked to produce
  it via the prompt in ThunderAI.
