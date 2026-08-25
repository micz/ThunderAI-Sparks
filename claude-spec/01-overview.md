# Overview

## What Sparks is

ThunderAI Sparks is a Thunderbird MailExtension that adds features to the
**ThunderAI** add-on which cannot be implemented with standard WebExtension
APIs. It is a small, focused executor: it receives structured data from
ThunderAI and uses Thunderbird's privileged **experimental APIs** to open native
calendar and task dialogs pre-filled with that data.

- Extension ID: `thunderai-sparks@micz.it`
- Manifest: v2, background ES module
- Homepage: https://micz.it/thunderbird-addon-thunderai/#sparks
- License: GPL-3.0 (own code)

## Why a separate add-on

ThunderAI is a normal WebExtension: it can call LLMs, render menus, read message
content, and store settings. What it **cannot** do is reach into Thunderbird's
internal calendar backend (`CalEvent`, `CalAttendee`, the timezone service, the
"create event/todo with dialog" window methods). Those require Thunderbird
[Experiments](https://developer.thunderbird.net/add-ons/mailextensions/experiments) —
privileged code with `ChromeUtils` access — which also forces the add-on to
request full permissions.

Rather than make all of ThunderAI privileged, the privileged surface is isolated
in this small companion add-on. ThunderAI stays a clean WebExtension and
delegates the calendar/task work to Sparks over cross-extension messaging.

## Current features

| Feature | Trigger (from ThunderAI) | Sparks action |
|---|---|---|
| Create calendar event from a mail | `openCalendarEventDialog` | `CalendarTools.openCalendarDialog` → native event dialog |
| Create task/todo from a mail | `openTaskDialog` | `CalendarTools.openTaskDialog` → native todo dialog |
| Presence/version detection | `checkPresence` | returns manifest version |

Event fields supported today: start/end date, summary, location, description,
attendees, timezone. Task fields: summary, due date, initial date, timezone.
(See [`03-data-contracts.md`](03-data-contracts.md).)

## What Sparks does NOT do

- It does not call any LLM or AI service.
- It does not store or manage prompts.
- It does not build ThunderAI's menus or read message bodies.
- It does not decide *which* fields to extract — it just fills what it's given.

All of the above lives in **ThunderAI**. See
[`04-thunderai-integration.md`](04-thunderai-integration.md).
