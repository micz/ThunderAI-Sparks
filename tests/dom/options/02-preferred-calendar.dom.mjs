import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from '../../helpers/dom-harness.mjs';

const calendars = [{id:'one',name:'Same name',type:'memory'},{id:'two',name:'Same name',type:'caldav'}];

for (const preferred of ['', 'two', 'deleted']) {
    test('restores calendar preference without writes: '+(preferred || '(empty)'), async () => {
        const ctx = await openPage('options', {sync:{preferred_calendar_id:preferred},calendars});
        try {
            const select = ctx.$('#preferred_calendar_id');
            assert.equal(select.value,preferred);
            assert.equal(select.disabled,false);
            assert.equal(ctx.ctl.calls.filter(c => c.op === 'set' && 'preferred_calendar_id' in c.items).length,0);
            assert.match(select.options[1].textContent,/Same name.*memory.*one/);
            assert.match(select.options[2].textContent,/Same name.*caldav.*two/);
            if (preferred === 'deleted') {
                assert.equal(select.selectedOptions[0].disabled,true);
                assert.ok(ctx.$('#preferred_calendar_status').textContent);
            }
            select.value='one';
            await ctx.fire(select,'change');
            assert.equal(ctx.ctl.syncData().preferred_calendar_id,'one');
        } finally { ctx.cleanup(); }
    });
}

test('calendar read failure leaves the saved ID intact and the checkbox usable', async () => {
    const ctx = await openPage('options',{sync:{preferred_calendar_id:'two'},calendars:new Error('unavailable')});
    try {
        assert.equal(ctx.$('#preferred_calendar_id').disabled,true);
        assert.ok(ctx.$('#preferred_calendar_status').textContent);
        assert.equal(ctx.ctl.syncData().preferred_calendar_id,'two');
        assert.equal(ctx.ctl.calls.filter(c => c.op === 'set').length,0);
        ctx.$('#do_debug').checked=true;
        await ctx.fire(ctx.$('#do_debug'),'change');
        assert.equal(ctx.ctl.syncData().do_debug,true);
        assert.equal(ctx.ctl.syncData().preferred_calendar_id,'two');
    } finally { ctx.cleanup(); }
});
