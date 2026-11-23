import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground } from './helpers/load.mjs';
import { loadCalendarAPI, calendar, EVENT } from './helpers/calendar-api.mjs';

test('preferred calendar comes from the ThunderAI message, never from AI data or a stale Sparks value', async () => {
    const bg = await startBackground({sync:{preferred_calendar_id:'stale'}});
    try {
        const action = 'openCalendarEventDialog';
        const calendar_event_data = JSON.stringify({...EVENT,preferred_calendar_id:'model',calendarId:'model'});
        for (const preferred_calendar_id of ['first','second','',42]) {
            await bg.dispatchExternal({action,calendar_event_data,preferred_calendar_id});
        }
        await bg.dispatchExternal({action,calendar_event_data});
        assert.deepEqual(bg.calendarCalls, [
            {fn:'openCalendarDialog',data:EVENT,preferred:'first'},
            {fn:'openCalendarDialog',data:EVENT,preferred:'second'},
            {fn:'openCalendarDialog',data:EVENT},
            {fn:'openCalendarDialog',data:EVENT},
            {fn:'openCalendarDialog',data:EVENT},
        ]);
    } finally { bg.con.restore(); }
});

test('the writable calendars are listed for ThunderAI only', async () => {
    const calendars = [{id:'one',name:'One',type:'caldav'}];
    const bg = await startBackground({calendars});
    try {
        assert.deepEqual(await bg.dispatchExternal({action:'listWritableCalendars'}), calendars);
        assert.equal(await bg.dispatchExternal({action:'listWritableCalendars'},{id:'other@example.com'}), undefined);
    } finally { bg.con.restore(); }
});

test('simulated native list includes only calendars allowing event creation, distinguished by stable ID', async () => {
    const good = calendar('good');
    const sameName = calendar('same-name');
    sameName.type = 'caldav';
    const calendars = [good,sameName,...[
        {'disabled':true},{readOnly:true},{aclDenied:true},{offlineUnavailable:true},{'capabilities.events.supported':false},
    ].map((props,i) => calendar('bad'+i, props))];
    const h = loadCalendarAPI({calendars});
    assert.deepEqual(JSON.parse(JSON.stringify(await h.api.listWritableCalendars())), [
        {id:'good',name:'Calendar',type:'memory'}, {id:'same-name',name:'Calendar',type:'caldav'},
    ]);
    assert.ok(h.calls.writable.includes('good'));
    assert.ok(h.calls.acl.includes('good'));
});

test('simulated native valid preference wins without reading the selected calendar', async () => {
    const preferred = calendar('preferred');
    const h = loadCalendarAPI({calendars:[calendar(),preferred]});
    await h.api.openCalendarDialog(EVENT,'preferred');
    assert.equal(h.event().calendar, preferred);
    assert.equal(h.calls.selected, 0);
    assert.equal(h.calls.warnings.length, 0);
});

test('simulated native no preference keeps the selected calendar path', async () => {
    const h = loadCalendarAPI();
    await h.api.openCalendarDialog(EVENT);
    assert.equal(h.event().calendar, h.selected);
    assert.equal(h.calls.selected, 1);
    assert.equal(h.calls.manager, 0);
    assert.equal(h.calls.warnings.length, 0);
});

// Thunderbird's openEventDialog() retargets a new event on the first eligible calendar of the
// calendar list: without a preference Sparks picks that calendar itself, silently, so what it
// prepares (category and attachment limits) is for the calendar that receives the event.
test('simulated native no preference sends an ineligible selected calendar\'s event to the first eligible one, silently', async () => {
    for (const props of [{disabled:true},{readOnly:true},{aclDenied:true},{'capabilities.events.supported':false}]) {
        const selected = calendar('selected',props), other = calendar('other');
        const h = loadCalendarAPI({selected,calendars:[selected,other]});
        const result = await h.api.openCalendarDialog(EVENT);
        assert.equal(result.result,true);
        assert.equal(h.calls.dialogs.length,1);
        assert.equal(h.event().calendar,other);
        assert.equal(h.calls.warnings.length,0);
    }
});

test('simulated native deleted, disabled, read-only and ACL-denied preferences fall back and warn', async () => {
    for (const props of [null,{disabled:true},{readOnly:true},{aclDenied:true},{'capabilities.events.supported':false}]) {
        const preferred = props ? [calendar('preferred',props)] : [];
        const h = loadCalendarAPI({calendars:[...preferred,calendar('other')]});
        const result = await h.api.openCalendarDialog(EVENT,'preferred');
        assert.equal(result.result,true);
        assert.equal(h.event().calendar,h.selected);
        assert.equal(h.calls.warnings.length,1);
    }
});

test('simulated native fallback follows the calendar list order if the selected calendar is ineligible', async () => {
    const first = calendar('first'), second = calendar('second');
    const h = loadCalendarAPI({selected:calendar('bad',{readOnly:true}),calendars:[first,second]});
    await h.api.openCalendarDialog(EVENT,'missing');
    assert.equal(h.event().calendar,first);
    assert.equal(h.calls.warnings.length,1);
    const sorted = loadCalendarAPI({selected:calendar('bad',{readOnly:true}),calendars:[first,second],sortCalendarArray:list => [...list].reverse()});
    await sorted.api.openCalendarDialog(EVENT,'missing');
    assert.equal(sorted.event().calendar,second);
});

test('simulated native no eligible calendar reports an error and opens no dialog', async () => {
    for (const preferred of ['', 'missing']) {
        const h = loadCalendarAPI({selected:null,calendars:[]});
        const result = await h.api.openCalendarDialog(EVENT, preferred);
        assert.equal(result.result,false);
        assert.ok(result.error);
        assert.equal(h.calls.dialogs.length,0);
        assert.equal(h.calls.events.length,0);
    }
    const selected = calendar('selected',{readOnly:true});
    const h = loadCalendarAPI({selected,calendars:[selected,calendar('off',{disabled:true})]});
    assert.equal((await h.api.openCalendarDialog(EVENT)).result,false);
    assert.equal(h.calls.dialogs.length,0);
});
