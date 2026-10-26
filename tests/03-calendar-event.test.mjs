// action "openCalendarEventDialog" (mztas-background.js), per CLAUDE.md "How the two add-ons
// communicate" #3-#4 and the "Gotchas" field-whitelist note:
//  - the payload message.calendar_event_data is a string (often raw LLM output); the JSON object is
//    extracted from it;
//  - any property not in CALENDAR_EVENT_FIELDS is dropped before the call, so an undeclared field
//    cannot fail the experiment's schema validation;
//  - the filtered object is handed to browser.CalendarTools.openCalendarDialog;
//  - a native result.result -> "ok"; otherwise {result: "error", error}.
//
// Level 1: the real background, loaded under the mock; CalendarTools is the mock's stub.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground } from './helpers/load.mjs';

const EVENT = {
    startDate: '20250104T183000Z',
    endDate: '20250104T193000Z',
    summary: 'ThunderAI Sparks',
    forceAllDay: false,
};

test('extracts the event JSON and opens the native dialog with it', async () => {
    const bg = await startBackground();
    const reply = await bg.dispatchExternal({
        action: 'openCalendarEventDialog',
        calendar_event_data: JSON.stringify(EVENT),
    });
    assert.equal(reply, 'ok');
    assert.equal(bg.calendarCalls.length, 1);
    assert.equal(bg.calendarCalls[0].fn, 'openCalendarDialog');
    assert.deepEqual(bg.calendarCalls[0].data, EVENT);
});

test('accepts the LLM payload with prose around the JSON', async () => {
    const bg = await startBackground();
    const payload = 'Here is your event:\n' + JSON.stringify(EVENT) + '\nAnything else?';
    const reply = await bg.dispatchExternal({ action: 'openCalendarEventDialog', calendar_event_data: payload });
    assert.equal(reply, 'ok');
    assert.deepEqual(bg.calendarCalls[0].data, EVENT);
});

test('drops fields not declared in the schema before the call', async () => {
    const bg = await startBackground();
    const data = { ...EVENT, priority: 'high', color: 'red', attendees: ['a@example.com'] };
    await bg.dispatchExternal({ action: 'openCalendarEventDialog', calendar_event_data: JSON.stringify(data) });
    assert.deepEqual(bg.calendarCalls[0].data, { ...EVENT, attendees: ['a@example.com'] });
    assert.ok(!('priority' in bg.calendarCalls[0].data));
    assert.ok(!('color' in bg.calendarCalls[0].data));
});

test('keeps every declared optional field', async () => {
    const bg = await startBackground();
    const data = {
        ...EVENT,
        location: 'Room 1', description: 'notes', attendees: ['a@example.com'],
        timezone: 'Europe/Rome', use_timezone: true, reminderMinutes: 10,
    };
    await bg.dispatchExternal({ action: 'openCalendarEventDialog', calendar_event_data: JSON.stringify(data) });
    assert.deepEqual(bg.calendarCalls[0].data, data);
});

test('reports an error object when the native dialog fails', async () => {
    const bg = await startBackground({ calendar: { result: false, error: 'no calendar' } });
    const reply = await bg.dispatchExternal({
        action: 'openCalendarEventDialog',
        calendar_event_data: JSON.stringify(EVENT),
    });
    assert.deepEqual(reply, { result: 'error', error: 'no calendar' });
});
