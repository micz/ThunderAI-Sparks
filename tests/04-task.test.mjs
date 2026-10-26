// action "openTaskDialog" (mztas-background.js), per CLAUDE.md "How the two add-ons communicate"
// and the "Gotchas" field-whitelist note:
//  - the payload message.task_data is a string; the JSON object is extracted from it;
//  - any property not in TASK_FIELDS is dropped before the call;
//  - a task reminder is tied to the due date, or to the initial date when there is no due date:
//    with neither date, reminderMinutes is ignored and Thunderbird's default applies;
//  - the filtered object is handed to browser.CalendarTools.openTaskDialog; result.result -> "ok",
//    otherwise {result: "error", error}.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground } from './helpers/load.mjs';

const TASK = { summary: 'Reply to customer', dueDate: '20250104T170000Z' };

test('extracts the task JSON and opens the native task dialog with it', async () => {
    const bg = await startBackground();
    const reply = await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(TASK) });
    assert.equal(reply, 'ok');
    assert.equal(bg.calendarCalls.length, 1);
    assert.equal(bg.calendarCalls[0].fn, 'openTaskDialog');
    assert.deepEqual(bg.calendarCalls[0].data, TASK);
});

test('drops fields not declared in the task schema (e.g. the event-only forceAllDay)', async () => {
    const bg = await startBackground();
    const data = { ...TASK, forceAllDay: true, endDate: '20250104T180000Z', priority: 1 };
    await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(data) });
    assert.deepEqual(bg.calendarCalls[0].data, TASK);
});

test('keeps reminderMinutes when the task has a due date', async () => {
    const bg = await startBackground();
    const data = { ...TASK, reminderMinutes: 15 };
    await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(data) });
    assert.equal(bg.calendarCalls[0].data.reminderMinutes, 15);
});

test('keeps reminderMinutes when the task has only an initial date', async () => {
    const bg = await startBackground();
    const data = { summary: 'Prep', initialDate: '20250104T090000Z', reminderMinutes: 30 };
    await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(data) });
    assert.equal(bg.calendarCalls[0].data.reminderMinutes, 30);
});

test('ignores reminderMinutes when the task has neither a due nor an initial date', async () => {
    const bg = await startBackground();
    const data = { summary: 'Someday', reminderMinutes: 30 };
    await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(data) });
    assert.ok(!('reminderMinutes' in bg.calendarCalls[0].data));
    assert.deepEqual(bg.calendarCalls[0].data, { summary: 'Someday' });
});

test('reports an error object when the native task dialog fails', async () => {
    const bg = await startBackground({ task: { result: false, error: 'no task list' } });
    const reply = await bg.dispatchExternal({ action: 'openTaskDialog', task_data: JSON.stringify(TASK) });
    assert.deepEqual(reply, { result: 'error', error: 'no task list' });
});
