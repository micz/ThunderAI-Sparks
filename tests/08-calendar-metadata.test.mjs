import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground, readRepo } from './helpers/load.mjs';
import { loadCalendarAPI, calendar, EVENT } from './helpers/calendar-api.mjs';

test('capabilities preserve the version handshake and require ThunderAI identity and message shape', async () => {
    const bg = await startBackground({ categories: ['Séminaire', 'Name, "quoted"'] });
    try {
        assert.equal(await bg.dispatchExternal({ action: 'checkPresence' }), JSON.parse(readRepo('manifest.json')).version);
        const capabilities = await bg.dispatchExternal({ action: 'getCapabilities' });
        assert.deepEqual(capabilities.calendarCategories, ['Séminaire', 'Name, "quoted"']);
        assert.ok(capabilities.calendarEventFields.includes('categories'));
        assert.ok(capabilities.calendarEventFields.includes('links'));
        for (const invalid of [null, [], 'getCapabilities', {action: 4}]) assert.equal(await bg.dispatchExternal(invalid), undefined);
        for (const action of ['getCapabilities', 'openCalendarEventDialog']) {
            assert.equal(await bg.dispatchExternal({action, calendar_event_data: JSON.stringify(EVENT)}, {id:'other@example.com'}), undefined);
        }
        assert.equal(bg.calendarCalls.length, 0);
    } finally { bg.con.restore(); }
});

test('optional invalid metadata is removed before schema validation, without changing legacy fields', async () => {
    const bg = await startBackground({ sync: {do_debug:true} });
    try {
        for (const fields of [{categories:42, links:null}, {categories:['Séminaire', 3, null], links:['https://example.org/x', false]}]) {
            assert.equal(await bg.dispatchExternal({action:'openCalendarEventDialog', calendar_event_data:JSON.stringify({...EVENT,...fields,calendarId:'model-chosen'})}), 'ok');
        }
        assert.deepEqual(bg.calendarCalls[0].data, EVENT);
        assert.deepEqual(bg.calendarCalls[1].data, {...EVENT,categories:['Séminaire'],links:['https://example.org/x']});
        assert.equal(bg.con.entries.some(entry => entry.text.includes('Synthetic seminar')), false, 'no event content in metadata diagnostics');
    } finally { bg.con.restore(); }
});

test('simulated native categories: exact current names, duplicates, invalid entries and special characters', async () => {
    for (const [input, expected] of [
        [undefined, []], [[], []], [null, []], ['Séminaire', []],
        [['Séminaire'], [['Séminaire']]],
        [['Séminaire','Name, "quoted"','Séminaire', false, 'unknown'], [['Séminaire','Name, "quoted"']]],
        [['unknown', 1, null], []],
    ]) {
        const h = loadCalendarAPI({categories:['Séminaire','Name, "quoted"']});
        assert.equal((await h.api.openCalendarDialog({...EVENT,...(input === undefined ? {} : {categories:input})})).result, true);
        assert.deepEqual(h.event().categoryCalls, expected);
        assert.deepEqual(h.event().attendees, []);
        assert.equal(h.calls.dialogs.length, 1);
    }
});

test('simulated native categories are read again at creation and respect provider limits with a warning', async () => {
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
    }
});

test('simulated native URI attachments validate, normalize and deduplicate without losing description', async () => {
    const h = loadCalendarAPI();
    const valid = ['https://example.org/programme.pdf?a=1#part','http://example.org/'];
    const invalid = ['ftp://example.org/x','javascript:alert(1)','/relative','https://user:pass@example.org', 'https://@example.org/',
        'https://example.org/a b','https://example.org/a\\b','https://example.org/\nsecret','https://example.org/\u007fsecret','not a URL','https://[',null,3];
    const description = 'Agenda\nHTTPS://EXAMPLE.ORG:443/programme.pdf?a=1#part';
    await h.api.openCalendarDialog({...EVENT,description,links:[...valid,'HTTPS://EXAMPLE.ORG:443/programme.pdf?a=1#part',...invalid]});
    assert.deepEqual(h.calls.uris, valid);
    assert.deepEqual(h.event().attachments.map(a => a.uri.spec), valid);
    assert.equal(h.event().descriptionText, description + '\nhttp://example.org/');
    assert.equal(h.calls.warnings.length, 0);
    assert.equal(JSON.stringify(h.calls.logs).includes('secret'), false);
});

test('simulated native unsupported attachments and URI failures keep URLs in the description and warn', async () => {
    for (const options of [{selected:calendar('limited',{'capabilities.attachments.supported':false})},{uriFailure:true}]) {
        const h = loadCalendarAPI(options);
        await h.api.openCalendarDialog({...EVENT,links:['https://example.org/']});
        assert.equal(h.event().descriptionText, EVENT.description + '\nhttps://example.org/');
        assert.equal(h.event().attachments.length, 0);
        assert.equal(h.calls.warnings.length, 1);
        assert.equal(h.calls.dialogs.length, 1);
    }
});

test('simulated native legacy fields, empty attendees, reminder and mandatory confirmation are preserved', async () => {
    const h = loadCalendarAPI();
    await h.api.openCalendarDialog(EVENT);
    const event = h.event();
    assert.equal(event.title, EVENT.summary);
    assert.equal(event.descriptionText, EVENT.description);
    assert.equal(event.properties.LOCATION, EVENT.location);
    assert.equal(event.startDate.value, EVENT.startDate);
    assert.equal(event.endDate.value, EVENT.endDate);
    assert.equal(event.startDate.timezone.tzid, EVENT.timezone);
    assert.equal(event.alarms[0].offset.minutes, EVENT.reminderMinutes);
    assert.equal(event.alarms[0].offset.isNegative, true);
    assert.equal(event.alarms[0].related, 0);
    assert.deepEqual(event.attendees, []);
    assert.deepEqual(event.categoryCalls, []);
    assert.deepEqual(event.attachments, []);
    assert.equal(h.calls.dialogs[0][4], event);
    assert.equal(h.calls.dialogs[0][5], false);
});
