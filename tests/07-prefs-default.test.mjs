// Preferences, per CLAUDE.md ("Default prefs: { do_debug: false }") and the options page:
//  - prefs_default (js/mztas-options-default.js) is the single source of defaults;
//  - the background reads the same default when it initialises the logger
//    (browser.storage.sync.get({do_debug: false}));
//  - every default has a matching .option-input control on the options page, and every control
//    has a default, so the options page can restore and save it.
//
// Level 1: the module and the repository as source, nothing to install.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules, readRepo } from './helpers/load.mjs';

const { prefs_default } = await loadModules();

test('do_debug defaults to false', () => {
    assert.equal(prefs_default.do_debug, false);
});

test('the background initialises the logger with the same do_debug default', () => {
    const source = readRepo('mztas-background.js');
    assert.ok(/storage\.sync\.get\(\{\s*do_debug:\s*false\s*\}\)/.test(source),
        'background should read storage.sync.get({do_debug: false}) to match prefs_default');
});

test('every default pref has a matching .option-input control on the options page', () => {
    const html = readRepo('options/mztas-options.html');
    const ids = [...html.matchAll(/<input\b[^>]*\bid="([^"]+)"[^>]*\bclass="[^"]*\boption-input\b[^"]*"/g)]
        .map(m => m[1]);
    for (const pref of Object.keys(prefs_default)) {
        assert.ok(ids.includes(pref), 'no .option-input with id="' + pref + '" on the options page');
    }
});
