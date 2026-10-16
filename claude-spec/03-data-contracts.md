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
| `reminderMinutes` | integer | no | reminder (alarm), see below |

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
  "use_timezone": true,
  "reminderMinutes": 15
}
```

For `reminderMinutes`, see [Reminders](#reminders-reminderminutes) below. For
events the alarm is related to the start.

### Task / todo (`openTaskDialog`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `summary` | string | yes | task title |
| `dueDate` | string | no | iCal datetime → `dueDate` |
| `initialDate` | string | no | iCal datetime (start) → `entryDate` |
| `location` | string | no | set as `LOCATION` property |
| `description` | string | no | set as `DESCRIPTION` property |
| `timezone` | string | no | applied only when `use_timezone` is true |
| `use_timezone` | boolean | no | if true, apply `timezone` to due/initial |
| `reminderMinutes` | integer | no | reminder (alarm), see below |

```json
{
  "summary": "Send the report",
  "dueDate": "20250110T170000Z",
  "initialDate": "20250108T090000Z",
  "location": "Room 2",
  "description": "Include the Q1 figures",
  "timezone": "Europe/Rome",
  "use_timezone": true,
  "reminderMinutes": 60
}
```

`createTodoWithDialog(calendar, dueDate, summary, todo, initialDate)` applies
`summary`/`dueDate` and Thunderbird's defaults **only when `todo` is null**.
Those defaults are the default start/due dates from the `calendar.task.*` prefs
and the default alarm. Its 4th argument is a *template task*, not a text body.
`implementation.js` **always** builds that `CalTodo` template, so it sets
`title`, `calendar`, `entryDate` (from `initialDate`) and `dueDate` itself
(tasks use `entryDate`, not `startDate`). It also sets location, description
and the reminder. This keeps the behavior the same with or without
location/description, with two consequences:

- A missing date stays empty, because the `calendar.task.defaultstart` /
  `defaultdue` prefs are not applied. The default alarm is applied, see below.
- `initialDate` always becomes the task's start date. With a `null` template it
  was only the reference date for the date pickers.

## Reminders (`reminderMinutes`)

Optional integer, the same for events and tasks
([ThunderAI #887](https://github.com/micz/ThunderAI/issues/887); ThunderAI
5.1.0+ is needed to produce it). It has three states:

| Value | Event | Task |
|---|---|---|
| absent, or invalid (non-integer, `< -1`) | Thunderbird's default reminder: `cal.alarms.setDefaultValues()` | same |
| `-1` | no reminder: `clearAlarms()` | same (no date needed) |
| `0` or positive | exactly one `DISPLAY` `CalAlarm`, offset = minus that many minutes (`0` = at the time), never combined with the default | same |
| …related to | `ALARM_RELATED_START` (start date) | `ALARM_RELATED_END` (due date); `ALARM_RELATED_START` (`entryDate` = `initialDate`) if there is no due date; with neither date the value is ignored (logged) and treated as absent |

The background script drops (and logs via `tasLog`) invalid values and any
task value `>= 0` that has no date. A non-integer would also fail schema
validation. `implementation.js` checks both cases again.

**Default reminder.** `createEventWithDialog()` / `createTodoWithDialog()` apply
the default alarm (`setDefaultItemValues()` → `cal.alarms.setDefaultValues()`)
only when no template item is passed. Sparks always passes one, so it calls
`cal.alarms.setDefaultValues(item)` itself. It does this only when
`reminderMinutes` is absent, after the calendar and the dates are set. What
that function does in comm-esr140
(`calendar/base/modules/utils/calAlarmUtils.sys.mjs`):

- It adds an alarm only if `calendar.alarms.onforevents` / `onfortodos` is `1`,
  and nothing otherwise. The length and unit come from
  `calendar.alarms.{event,todo}alarmlen` / `…alarmunit`.
- The alarm is always `ALARM_RELATED_START`. The action is `DISPLAY` unless
  the item's calendar doesn't support it, so the calendar must be set first.
- For a task without `entryDate` it sets `entryDate` to now, because a
  start-related alarm needs one. The manual "new task" path does the same.
- It doesn't look at event dates, and Thunderbird has no separate all-day
  default. So `forceAllDay`, which `createEventWithDialog()` applies to the
  template afterwards, doesn't change which default is applied. A
  start-related alarm on an all-day event counts from midnight, as for an
  event created by hand.

The dialog shows exactly the item's alarms (`loadReminders(item.getAlarms())`).
For tasks, `ALARM_RELATED_END` resolves to `dueDate` and `ALARM_RELATED_START`
to `entryDate` (`cal.dtz.endDateProp` / `startDateProp`). The task dialog
checks and locks the checkbox of the related date (`commonUpdateReminder`).

## Field whitelist

The schema rejects any property it does not declare, so a single extra field in
the LLM JSON used to make the whole call fail. Before calling the experimental
API, `mztas-background.js` (`filterFields()`) copies into a new object **only** the
fields listed above that are actually present (`CALENDAR_EVENT_FIELDS` /
`TASK_FIELDS`), and logs the discarded names via `tasLog` (only visible with
`do_debug`). **When you add a field to `schema.json`, add it to the matching
list too**, or it will be silently dropped.

The whitelist filters by name only. A known field with the wrong type (e.g.
`"forceAllDay": "yes"`) still fails schema validation.

## Return contract from the experimental API

`CalendarTools.openCalendarDialog` / `openTaskDialog` return:

- `{ result: true }` — dialog opened.
- `{ result: false, error }` — failure (also `console.error`-logged).

The background script maps `result === true` → `"ok"` back to ThunderAI, and any
failure/parse error → `{result: "error", error}`.

## Changing the contract

Adding a field to an event/task requires **both repos**:

1. **Here**: add it to `api/CalendarTools/schema.json`, to the whitelist in
   `mztas-background.js` (`CALENDAR_EVENT_FIELDS` / `TASK_FIELDS`), and consume it
   in `api/CalendarTools/implementation.js`.
2. **ThunderAI**: update the prompt so the LLM actually produces that field
   (this is why CHANGELOG entries say "be sure to update the prompt in the
   ThunderAI settings").

See [`04-thunderai-integration.md`](04-thunderai-integration.md).
