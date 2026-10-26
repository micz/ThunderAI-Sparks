// The options page (options/mztas-options.html + mztas-options-page.js), loaded in jsdom:
//  - on load it localises the page and restores the controls from storage.sync (the do_debug
//    checkbox), per the vendored options manager (js/mztas-options.js) and prefs_default;
//  - changing the checkbox saves it back to storage.sync.
//
// DOM level: needs `npm ci` (jsdom). See tests/README.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from '../../helpers/dom-harness.mjs';

test('restores the do_debug checkbox from storage.sync', async () => {
    const ctx = await openPage('options', { sync: { do_debug: true } });
    try {
        const box = ctx.$('#do_debug');
        assert.ok(box, 'the do_debug checkbox should exist');
        assert.equal(box.checked, true);
    } finally { ctx.cleanup(); }
});

test('defaults the checkbox to false when nothing is stored', async () => {
    const ctx = await openPage('options', { sync: {} });
    try {
        assert.equal(ctx.$('#do_debug').checked, false);
    } finally { ctx.cleanup(); }
});

test('saves the checkbox to storage.sync when it changes', async () => {
    const ctx = await openPage('options', { sync: { do_debug: false } });
    try {
        const box = ctx.$('#do_debug');
        box.checked = true;
        await ctx.fire(box, 'change');
        assert.equal(ctx.ctl.syncData().do_debug, true);
        assert.ok(ctx.ctl.calls.some(c => c.area === 'sync' && c.op === 'set' && c.items.do_debug === true));
    } finally { ctx.cleanup(); }
});

test('localises the page (no __MSG_ tokens left in the body)', async () => {
    const ctx = await openPage('options', { sync: {} });
    try {
        assert.ok(!ctx.document.body.innerHTML.includes('__MSG_'),
            'i18n.updateDocument() should have replaced every __MSG_*__ token');
    } finally { ctx.cleanup(); }
});
