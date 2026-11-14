// Calendar categories (spec 03 "Calendar categories"): the getCapabilities action, the filter
// before the schema, and the real implementation.js under Thunderbird doubles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground, readRepo } from './helpers/load.mjs';
import { loadCalendarAPI, calendar, EVENT } from './helpers/calendar-api.mjs';

test('capabilities keep the version handshake and answer ThunderAI only, with a valid message shape', async () => {
    const bg = await startBackground({ categories: ['Séminaire', 'Name, "quoted"'] });
    try {
        assert.equal(await bg.dispatchExternal({ action: 'checkPresence' }), JSON.parse(readRepo('manifest.json')).version);
        const capabilities = await bg.dispatchExternal({ action: 'getCapabilities' });
        assert.deepEqual(capabilities.calendarCategories, ['Séminaire', 'Name, "quoted"']);
        assert.ok(capabilities.calendarEventFields.includes('categories'));
        assert.equal(capabilities.calendarEventFields.includes('links'), false);
        for (const invalid of [null, [], 'getCapabilities', {action: 4}]) assert.equal(await bg.dispatchExternal(invalid), undefined);
        for (const action of ['getCapabilities', 'openCalendarEventDialog']) {
            assert.equal(await bg.dispatchExternal({action, calendar_event_data: JSON.stringify(EVENT)}, {id:'other@example.com'}), undefined);
        }
        assert.equal(bg.calendarCalls.length, 0);
    } finally { bg.con.restore(); }
});

test('invalid categories are removed before schema validation, without changing the other fields', async () => {
    const bg = await startBackground({ sync: {do_debug:true} });
    try {
        for (const fields of [{categories:42}, {categories:['Séminaire', 3, null, '']}]) {
            assert.equal(await bg.dispatchExternal({action:'openCalendarEventDialog', calendar_event_data:JSON.stringify({...EVENT,...fields,links:['https://example.org/'],calendarId:'model-chosen'})}), 'ok');
        }
        assert.deepEqual(bg.calendarCalls[0].data, EVENT);
        assert.deepEqual(bg.calendarCalls[1].data, {...EVENT,categories:['Séminaire']});
    } finally { bg.con.restore(); }
});

test('simulated native categories: exact current names, each once, never invented', async () => {
    for (const [input, expected] of [
        [undefined, []], [[], []], [null, []], ['Séminaire', []],
        [['Séminaire'], [['Séminaire']]],
        [['Séminaire','Name, "quoted"','Séminaire', false, 'unknown', 'séminaire'], [['Séminaire','Name, "quoted"']]],
        [['unknown', 1, null], []],
    ]) {
        const h = loadCalendarAPI({categories:['Séminaire','Name, "quoted"']});
        assert.equal((await h.api.openCalendarDialog({...EVENT,...(input === undefined ? {} : {categories:input})})).result, true);
        assert.deepEqual(h.event().categoryCalls, expected);
        assert.deepEqual(h.event().attendees, []);
        assert.equal(h.calls.dialogs.length, 1);
        assert.equal(h.calls.warnings.length, 0);
    }
});

test('simulated native categories are read again at creation and follow the calendar limit, with a warning', async () => {
    const opts = {categories:['Before','After']};
    const h = loadCalendarAPI(opts);
    assert.deepEqual(Array.from(await h.api.getCalendarCategories()), ['Before','After']);
    opts.categories = ['After'];
    await h.api.openCalendarDialog({...EVENT,categories:['Before','After']});
    assert.deepEqual(h.event().categoryCalls, [['After']]);
    for (const limit of [0,1,2,null]) {
        const limited = loadCalendarAPI({categories:['A','B'],selected:calendar('limited',{'capabilities.categories.maxCount':limit})});
        await limited.api.openCalendarDialog({...EVENT,categories:['A','B']});
        assert.deepEqual(limited.event().categoryCalls, limit === 0 ? [] : [limit === 1 ? ['A'] : ['A','B']]);
        assert.equal(limited.calls.warnings.length, limit === 0 || limit === 1 ? 1 : 0);
        assert.equal(limited.calls.dialogs.length, 1);
    }
});

test('simulated native failure to set categories warns and still opens the event', async () => {
    const h = loadCalendarAPI({categories:['A'],categoryFailure:true});
    assert.equal((await h.api.openCalendarDialog({...EVENT,categories:['A']})).result, true);
    assert.equal(h.calls.warnings.length, 1);
    assert.equal(h.calls.dialogs.length, 1);
});

test('simulated native: the event keeps the selected calendar and its other fields', async () => {
    const h = loadCalendarAPI({categories:['A']});
    await h.api.openCalendarDialog({...EVENT,categories:['A']});
    const event = h.event();
    assert.equal(event.calendar, h.selected);
    assert.equal(event.title, EVENT.summary);
    assert.equal(event.descriptionText, EVENT.description);
    assert.equal(event.properties.LOCATION, EVENT.location);
    assert.equal(event.alarms[0].offset.minutes, EVENT.reminderMinutes);
    assert.deepEqual(event.attendees, []);
    assert.equal(h.calls.dialogs[0][4], event);
    assert.equal(h.calls.dialogs[0][5], false);
});
