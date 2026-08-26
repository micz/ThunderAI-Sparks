# Data contracts

The messaging interface between **ThunderAI** and **Sparks**. This is the
contract you must keep stable (or change on both sides).

## Incoming messages (`runtime.onMessageExternal`)

Sender: the ThunderAI add-on (`thunderai@micz.it`). Handled in
[`mztas-background.js`](../mztas-background.js), dispatched on `message.action`.

### `checkPresence`

- **Payload**: none.
- **Response**: the Sparks version string (e.g. `"2.1.0"`), from
  `browser.runtime.getManifest().version`.
- **Purpose**: lets ThunderAI detect that Sparks is installed and which version,
  so it can enable/adjust Sparks-dependent features.

### `openCalendarEventDialog`

- **Payload**: `message.calendar_event_data` — a **string** (typically raw LLM
  output). Sparks runs `extractJsonObject()` on it to get the object below.
- **Response**: `"ok"` on success, or `{result: "error", error}` on failure.

### `openTaskDialog`

- **Payload**: `message.task_data` — a **string**; parsed the same way.
- **Response**: `"ok"` or `{result: "error", error}`.

## JSON shapes (after `extractJsonObject`)

These match `api/CalendarTools/schema.json`. `extractJsonObject` matches the
first `{ ... }` block in the string and `JSON.parse`s it, so surrounding prose in
the LLM output is tolerated.

### Calendar event (`openCalendarDialog`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `startDate` | string | yes | iCal datetime, e.g. `20250104T183000Z` → `cal.createDateTime` |
| `endDate` | string | yes | same format |
| `summary` | string | yes | event title |
| `forceAllDay` | boolean | yes | passed to `createEventWithDialog` |
| `location` | string | no | set as `LOCATION` property |
| `description` | string | no | set as `DESCRIPTION` property |
| `attendees` | string[] | no | each becomes a `REQ-PARTICIPANT` `CalAttendee` |
| `timezone` | string | no | applied only when `use_timezone` is true |
| `use_timezone` | boolean | no | if true, apply `timezone` to start/end |

```json
{
  "startDate": "20250104T183000Z",
  "endDate": "20250104T193000Z",
  "summary": "Project kickoff",
  "location": "Room 2",
  "description": "Discuss Q1 plan",
  "forceAllDay": false,
  "attendees": ["a@example.com", "b@example.com"],
  "timezone": "Europe/Rome",
  "use_timezone": true
}
```

### Task / todo (`openTaskDialog`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `summary` | string | yes | task title |
| `dueDate` | string | no | iCal datetime |
| `initialDate` | string | no | iCal datetime (start) |
| `timezone` | string | no | applied only when `use_timezone` is true |
| `use_timezone` | boolean | no | if true, apply `timezone` to due/initial |

```json
{
  "summary": "Send the report",
  "dueDate": "20250110T170000Z",
  "initialDate": "20250108T090000Z",
  "timezone": "Europe/Rome",
  "use_timezone": true
}
```

## Return contract from the experimental API

`CalendarTools.openCalendarDialog` / `openTaskDialog` return:

- `{ result: true }` — dialog opened.
- `{ result: false, error }` — failure (also `console.error`-logged).

The background script maps `result === true` → `"ok"` back to ThunderAI, and any
failure/parse error → `{result: "error", error}`.

## Changing the contract

Adding a field to an event/task requires **both repos**:

1. **Here**: add it to `api/CalendarTools/schema.json` and consume it in
   `api/CalendarTools/implementation.js`.
2. **ThunderAI**: update the prompt so the LLM actually produces that field
   (this is why CHANGELOG entries say "be sure to update the prompt in the
   ThunderAI settings").

See [`04-thunderai-integration.md`](04-thunderai-integration.md).
