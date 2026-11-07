# Preferred event calendar

In ThunderAI, **Manage calendar event settings** lets you choose a default calendar,
stored as a stable calendar ID. The empty value, **Use the currently selected
calendar**, keeps the
existing `window.getSelectedCalendar()` path. When that calendar cannot receive the
event, Sparks picks the one Thunderbird's dialog would retarget to, the first eligible
calendar in the calendar list's order, silently as before; the category and attachment
limits applied are then that calendar's. Tasks are unaffected.

Only calendars supporting events and passing Thunderbird's native writability
and add-item ACL checks are listed. These checks also account for disabled and
unavailable calendars. A calendar is listed by its name; calendars with identical
names also show their provider type and ID, so they can be distinguished.

ThunderAI stores the choice as `calendar_preferred_id`, default `""`, and reads it
for every event. It sends the value in the `preferred_calendar_id` message field,
next to `calendar_event_data`, never inside the AI-generated JSON. Sparks passes it
as an optional second argument to `CalendarTools.openCalendarDialog(cal_data, id)`.
The `listWritableCalendars` message gives ThunderAI `{id, name, type}` descriptors
and is answered to ThunderAI only, because calendar names are private. An older
Sparks does not answer it: the selector stays disabled and says why.

At creation, Sparks rechecks the preferred calendar's availability, event support,
writability and creation ACL. If it is no longer usable, the selected calendar is
used when eligible, otherwise the first eligible calendar in the calendar list's order,
as Thunderbird's dialog picks it. A native warning explains the fallback. The saved ID is kept,
so temporarily offline calendars do not lose their preference. With no usable
calendar, Sparks returns an explicit error and opens no event dialog.

The selector has separate initialization and is not an `.option-input` control,
because its calendars arrive after the page has restored its options. An unavailable
stored ID remains selected in a disabled option. A calendar-list read failure
disables only this control. A calendar ID exists in one profile only, so the
preference is excluded from ThunderAI's managed policies.

## Validation

Automated Node tests execute the real privileged implementation with Thunderbird
doubles. In ThunderAI, jsdom loads the actual settings page and checks restoration
without any preference write, explicit user changes, duplicate names and list
failures. These are simulated software checks, not real provider or native UI
verification.

In a separate Thunderbird test profile, create two disposable calendars with the
same name, choose one as preferred and select the other in the calendar pane.
Open a synthetic event and confirm the preferred calendar wins. Cancel, reopen,
edit, save and reopen a second event. Repeat after disabling the preferred
calendar, making it read-only, denying its creation ACL and deleting it. Check
the warning, selected/first-eligible fallback, and that the stored ID is kept.
Make every calendar ineligible and confirm the error without an event window.
Finally clear the preference and verify that the selected calendar is used.
Then select a read-only calendar with the preference still empty: the dialog must
open on an eligible calendar, without a Sparks warning.

For a test CalDAV calendar, repeat save/sync/reopen and verify that the event UID
exists in the intended server collection. Google tests must use a disposable
calendar. Native UI and synchronization are **NOT VERIFIED** until exercised;
do not alter system confinement to bypass a Thunderbird startup refusal.
