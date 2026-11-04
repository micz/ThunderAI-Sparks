# Preferred event calendar

In Sparks options, **Default calendar for events** lets you choose a stable
calendar ID. The empty value, **Use the currently selected calendar**, keeps the
existing `window.getSelectedCalendar()` path. Tasks are unaffected.

Only calendars supporting events and passing Thunderbird's native writability
and add-item ACL checks are listed. These checks also account for disabled and
unavailable calendars. Names are accompanied by provider type and ID, so
calendars with identical names can be distinguished.

The `preferred_calendar_id` preference uses the existing `storage.sync` preference
manager and defaults to `""`. It is read for every event. The ID is passed as an
optional second argument to `CalendarTools.openCalendarDialog(cal_data, id)`;
it is never taken from AI-generated JSON. `CalendarTools.listWritableCalendars()`
provides `{id, name, type}` descriptors for the options page.

At creation, Sparks rechecks the preferred calendar's availability, event support,
writability and creation ACL. If it is no longer usable, the selected calendar is
used when eligible, otherwise the first eligible calendar returned by the native
manager is used. A native warning explains the fallback. The saved ID is kept,
so temporarily offline calendars do not lose their preference. With no usable
calendar, Sparks returns an explicit error and opens no event dialog.

The selector has separate initialization and is not an `.option-input` control.
The vendored options manager dispatches synthetic `change` events during restore;
these must not save an empty/default value over the stored ID. An unavailable
stored ID remains selected in a disabled option. A calendar-list read failure
disables only this control and leaves storage and the debug checkbox usable.

## Validation

Automated Node tests execute the real privileged implementation with Thunderbird
doubles. jsdom loads the actual options page and checks restoration without any
preference write, explicit user changes, duplicate names and list failures. These
are simulated software checks, not real provider or native UI verification.

In a separate Thunderbird test profile, create two disposable calendars with the
same name, choose one as preferred and select the other in the calendar pane.
Open a synthetic event and confirm the preferred calendar wins. Cancel, reopen,
edit, save and reopen a second event. Repeat after disabling the preferred
calendar, making it read-only, denying its creation ACL and deleting it. Check
the warning, selected/first-eligible fallback, and that the stored ID is kept.
Make every calendar ineligible and confirm the error without an event window.
Finally clear the preference and verify that the selected calendar is used.

For a test CalDAV calendar, repeat save/sync/reopen and verify that the event UID
exists in the intended server collection. Google tests must use a disposable
calendar. Native UI and synchronization are **NOT VERIFIED** until exercised;
do not alter system confinement to bypass a Thunderbird startup refusal.
