// reminderMinutes validation (filterReminderMinutes in mztas-background.js), per the source
// contract and schema.json (reminderMinutes is an integer):
//  - it must be an integer >= -1; any other value is dropped, so it cannot fail the schema
//    validation, and Thunderbird's default reminder then applies;
//  - -1 (the "no reminder" sentinel) and 0 are valid.
//
// Exercised through the calendar event path to isolate it from the task-only "reminder needs a
// date" rule (covered in 04-task.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground } from './helpers/load.mjs';

const BASE = {
    startDate: '20250104T183000Z',
    endDate: '20250104T193000Z',
    summary: 'Event',
    forceAllDay: false,
};

async function openWith(reminderMinutes) {
    const bg = await startBackground();
    await bg.dispatchExternal({
        action: 'openCalendarEventDialog',
        calendar_event_data: JSON.stringify({ ...BASE, reminderMinutes }),
    });
    return bg.calendarCalls[0].data;
}

for (const valid of [-1, 0, 10, 1440]) {
    test(`keeps a valid integer reminderMinutes (${valid})`, async () => {
        assert.equal((await openWith(valid)).reminderMinutes, valid);
    });
}

for (const invalid of [-2, 1.5, '10', null, true]) {
    test(`drops an invalid reminderMinutes (${JSON.stringify(invalid)})`, async () => {
        assert.ok(!('reminderMinutes' in (await openWith(invalid))));
    });
}
