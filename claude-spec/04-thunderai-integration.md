# ThunderAI integration

Sparks is a **companion add-on** to ThunderAI. This document draws the boundary
between the two so you always change the right repository.

- **ThunderAI** (main add-on): https://github.com/micz/ThunderAI — ID
  `thunderai@micz.it`
- **Sparks** (this repo): ID `thunderai-sparks@micz.it`

## The prompts are in ThunderAI, not here

This is the single most important fact for anyone editing behavior:

> **All AI prompts, LLM/model configuration, and the settings UI that controls
> them live in the ThunderAI add-on.** This repository contains *no prompts* and
> talks to *no LLM*. Sparks only receives already-produced JSON and opens native
> Thunderbird dialogs with it.

So if a request is really about *what the AI is asked to produce* — the wording,
which fields it extracts, formatting rules, the model — that work happens in
**ThunderAI**, in its settings/prompt configuration. Not here.

## Responsibility split

| Concern | Lives in | This repo? |
|---|---|---|
| Prompt text / prompt settings | ThunderAI | ❌ |
| LLM/model calls, API keys | ThunderAI | ❌ |
| Reading the mail message | ThunderAI | ❌ |
| Menus & user actions ("add to calendar") | ThunderAI | ❌ |
| Detecting Sparks & its version | ThunderAI (via `checkPresence`) | ✅ replies |
| Parsing JSON out of LLM output | Sparks | ✅ `mztas-utils.js` |
| Opening native calendar/task dialogs | Sparks (experimental API) | ✅ `CalendarTools` |
| Thunderbird version compatibility of the calendar API | Sparks | ✅ |

## Message boundary

ThunderAI → Sparks, via `runtime.sendMessage('thunderai-sparks@micz.it', ...)`:

- `checkPresence` → version string back.
- `openCalendarEventDialog` + `calendar_event_data`.
- `openTaskDialog` + `task_data`.

Sparks → ThunderAI:

- On first install, `runtime.sendMessage('thunderai@micz.it', {action:
  "reload_menus"})` so ThunderAI rebuilds menus.

Exact payloads: [`03-data-contracts.md`](03-data-contracts.md).

## "Update the prompt in ThunderAI settings"

Several Sparks CHANGELOG entries end with this phrase (attendees in 1.1.0;
location and description in 2.1.0). The pattern is always the same:

1. A new field is plumbed through Sparks (`schema.json` +
   `implementation.js`) so the dialog can accept it.
2. But the field only gets *filled* if the LLM actually returns it — which
   depends on the **prompt in ThunderAI**. Until that prompt is updated, the new
   field stays empty.

So a "add field X to the calendar event" task is a **two-repo change**, and the
user-visible half (the prompt) is on the ThunderAI side.

## Checklist: adding a new event/task field

1. **Sparks** — `api/CalendarTools/schema.json`: add the property (mark
   `optional` if appropriate).
2. **Sparks** — `api/CalendarTools/implementation.js`: read it from `cal_data` /
   `task_data` and apply it to the `CalEvent` / todo.
3. **Sparks** — bump `manifest.json` version, add a `CHANGELOG.md` entry (note it
   needs a ThunderAI prompt update).
4. **ThunderAI** — update the relevant prompt so the LLM emits the field.
5. File/track the issue in the **ThunderAI** repo with the `Sparks` label.
