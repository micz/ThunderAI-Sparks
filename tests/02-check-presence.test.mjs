// The background listeners that let ThunderAI detect Sparks (mztas-background.js), per CLAUDE.md
// "How the two add-ons communicate":
//  - #2: action "checkPresence" -> Sparks replies with its version string, read from the manifest
//    at runtime (CLAUDE.md "Conventions": never hardcoded);
//  - #5: on first install Sparks messages ThunderAI (action "reload_menus") so it rebuilds its menus.
//
// Level 1: the real background, loaded under the mock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBackground, readRepo } from './helpers/load.mjs';
import { THUNDERAI_ID } from './helpers/browser-mock.mjs';

const manifestVersion = JSON.parse(readRepo('manifest.json')).version;

test('checkPresence replies with the manifest version string', async () => {
    const bg = await startBackground();
    const reply = await bg.dispatchExternal({ action: 'checkPresence' });
    assert.equal(reply, manifestVersion);
    assert.equal(typeof reply, 'string');
});

test('on install, it asks ThunderAI to reload its menus', async () => {
    // ThunderAI is the receiver of that message, so it is installed: let it answer.
    const bg = await startBackground({ external: () => undefined });
    await bg.dispatchInstalled({ reason: 'install' });
    assert.deepEqual(bg.sent, [{ to: THUNDERAI_ID, message: { action: 'reload_menus' } }]);
});

test('it does not reload menus on update (only on first install)', async () => {
    const bg = await startBackground();
    await bg.dispatchInstalled({ reason: 'update' });
    assert.deepEqual(bg.sent, []);
});

test('an unknown action falls through without an answer or a side effect', async () => {
    const bg = await startBackground();
    const reply = await bg.dispatchExternal({ action: 'somethingElse' });
    assert.equal(reply, true); // the listener's trailing `return true`
    assert.deepEqual(bg.calendarCalls, []);
    assert.deepEqual(bg.sent, []);
});
