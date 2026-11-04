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

test('simulated native description deduplication ignores punctuation around a URL, not a URL of its own', async () => {
    const link = 'https://example.org/p.pdf';
    for (const description of ['See '+link+'.', 'See ['+link+']('+link+')', '('+link+'), thanks', '**'+link+'**', '"'+link+'"', link]) {
        const h = loadCalendarAPI();
        await h.api.openCalendarDialog({...EVENT,description,links:[link]});
        assert.equal(h.event().descriptionText, description);
        assert.deepEqual(h.event().attachments.map(a => a.uri.spec), [link]);
    }
    const wiki = 'https://example.org/wiki/Foo_(bar)';
    for (const [description, expected] of [
        ['('+wiki+')', '('+wiki+')'],
        ['https://example.org/wiki/Foo_', 'https://example.org/wiki/Foo_\n'+wiki],
    ]) {
        const h = loadCalendarAPI();
        await h.api.openCalendarDialog({...EVENT,description,links:[wiki]});
        assert.equal(h.event().descriptionText, expected);
    }
});

test('simulated native first valid link becomes the native event URL, even without attachment support', async () => {
    const links = ['ftp://example.org/x','https://example.org/a','https://example.org/b'];
    for (const options of [{},{selected:calendar('limited',{'capabilities.attachments.supported':false})}]) {
        const h = loadCalendarAPI(options);
        await h.api.openCalendarDialog({...EVENT,links});
        assert.equal(h.event().properties.URL,'https://example.org/a');
    }
    for (const fields of [{},{links:[]},{links:['ftp://example.org/x']}]) {
        const h = loadCalendarAPI();
        await h.api.openCalendarDialog({...EVENT,...fields});
        assert.equal('URL' in h.event().properties,false);
    }
});

test('simulated native limits are those of the calendar that receives the event, not of an ineligible selected one', async () => {
    const selected = calendar('selected',{readOnly:true,'capabilities.categories.maxCount':0,'capabilities.attachments.supported':false});
    const first = calendar('first'), second = calendar('second');
    const h = loadCalendarAPI({categories:['A','B','C'],selected,calendars:[selected,first,second],
        sortCalendarArray: list => [...list].reverse()});
    await h.api.openCalendarDialog({...EVENT,categories:['A','B','C'],links:['https://example.org/a','https://example.org/b']});
    assert.equal(h.event().calendar, second);
    assert.deepEqual(h.event().categoryCalls, [['A','B','C']]);
    assert.equal(h.event().attachments.length, 2);
    assert.equal(h.calls.warnings.length, 0);
});

test('simulated native "@" is refused in the authority only', async () => {
    const accepted = ['https://meet.example.org?email=a@b.org','https://example.org#a@b','https://example.org/path?email=a@b.org',
        'https://teams.example.org/l/19:meeting_x@thread.v2/0?context=%7b%7d'];
    const h = loadCalendarAPI();
    await h.api.openCalendarDialog({...EVENT,links:[...accepted,'https://@example.org/','https://:@example.org/','https://user@example.org/','https://a@b@example.org/']});
    assert.deepEqual(h.event().attachments.map(a => new URL(a.uri.spec).hostname),
        ['meet.example.org','example.org','example.org','teams.example.org']);
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

test('simulated native no calendar able to receive the event: an explicit error and no dialog', async () => {
    const selected = calendar('selected',{readOnly:true});
    const h = loadCalendarAPI({selected,calendars:[selected,calendar('off',{disabled:true})]});
    const result = await h.api.openCalendarDialog(EVENT);
    assert.equal(result.result,false);
    assert.ok(result.error);
    assert.equal(h.calls.dialogs.length,0);
});
