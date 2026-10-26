/*
 *  In-memory WebExtension mock, the core of the Sparks test suite.
 *
 *  mztas-background.js runs `await browser.storage.sync.get(...)` and reads
 *  browser.runtime.getManifest() at IMPORT time, so the mock must be on globalThis before any
 *  module under test is evaluated: call installBrowserMock() first, then load the modules with a
 *  dynamic import() (see ./load.mjs).
 *
 *  One mock = one extension context. The modules under test keep module-level state (the
 *  background registers its listeners once), so every test file is one context and one scenario;
 *  `node --test` runs each file in its own process, which gives each a fresh set of modules.
 *
 *  It models only the WebExtension APIs the Sparks code actually touches. The experimental API
 *  (browser.CalendarTools, the whole reason Sparks exists) is privileged, Thunderbird-only code
 *  that cannot run here, so it is a configurable stub: a test says what the native dialog returns.
 *
 *  No jsdom here, so the level-1 tests can import it with nothing installed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EXT_ORIGIN = 'moz-extension://00000000-sparks-uuid/';
export const SPARKS_ID = 'thunderai-sparks@micz.it';
export const THUNDERAI_ID = 'thunderai@micz.it';

const clone = v => (v === undefined ? undefined : structuredClone(v));

function makeEvent() {
    const listeners = [];
    return {
        _listeners: listeners,
        addListener(fn) { if (!listeners.includes(fn)) listeners.push(fn); },
        removeListener(fn) { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); },
        hasListener(fn) { return listeners.includes(fn); },
    };
}

/**
 * A storage area with the real StorageArea.get() semantics:
 *  - get(null | undefined): everything
 *  - get('key') / get(['a', 'b']): only the keys present
 *  - get({key: default}): every key, the stored value when PRESENT, the default otherwise.
 *    A stored null is present and comes back as null - the default does not replace it.
 * Values are structured-cloned on the way in and out, like the real serialisation.
 */
function makeStorageArea(name, initial, calls) {
    const data = new Map(Object.entries(clone(initial) || {}));
    const onChanged = makeEvent();
    const area = {
        _data: data,
        async get(keys) {
            calls.push({ area: name, op: 'get', keys: clone(keys) });
            const out = {};
            if (keys === null || keys === undefined) {
                for (const [k, v] of data) out[k] = clone(v);
            } else if (typeof keys === 'string') {
                if (data.has(keys)) out[keys] = clone(data.get(keys));
            } else if (Array.isArray(keys)) {
                for (const k of keys) if (data.has(k)) out[k] = clone(data.get(k));
            } else if (typeof keys === 'object') {
                for (const [k, def] of Object.entries(keys)) {
                    if (data.has(k)) out[k] = clone(data.get(k));
                    else if (def !== undefined) out[k] = clone(def);
                }
            } else {
                throw new TypeError('storage.' + name + '.get: invalid keys');
            }
            return out;
        },
        async set(items) {
            calls.push({ area: name, op: 'set', items: clone(items) });
            const changes = {};
            for (const [k, v] of Object.entries(items)) {
                if (v === undefined) continue;
                const oldValue = data.has(k) ? clone(data.get(k)) : undefined;
                data.set(k, clone(v));
                changes[k] = { oldValue, newValue: clone(v) };
            }
            if (Object.keys(changes).length > 0) {
                for (const fn of [...onChanged._listeners]) fn(clone(changes));
            }
        },
        onChanged,
    };
    return area;
}

function readJson(relToRepo) {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../../' + relToRepo, import.meta.url)), 'utf8'));
}

function loadEnMessages() {
    return readJson('_locales/en/messages.json');
}

/**
 * Install the mock on globalThis.browser (and globalThis.messenger).
 *
 * @param {object} opts
 *   sync       - initial storage.sync content (the do_debug pref lives here)
 *   calendar   - what browser.CalendarTools.openCalendarDialog(data) resolves to; a function
 *                (data) => result, or a fixed object. Default {result: true}.
 *   task       - what browser.CalendarTools.openTaskDialog(data) resolves to; same shape.
 *   external   - (extensionId, message) => reply: the OTHER add-on (ThunderAI) answering the
 *                two-argument runtime.sendMessage(extensionId, message). Without it that form
 *                rejects, as it does when the receiver is not installed.
 * @returns the controller (see the return block below).
 */
export function installBrowserMock(opts = {}) {
    const calls = [];          // every storage operation, in order
    const sent = [];           // every runtime.sendMessage, in order
    const calendarCalls = [];  // every CalendarTools call: {fn, data}
    const messages = loadEnMessages();
    const onInstalled = makeEvent();
    const onMessageExternal = makeEvent();

    const answer = (spec, fallback) => (data) => {
        const out = typeof spec === 'function' ? spec(clone(data)) : (spec ?? fallback);
        return clone(out);
    };
    const calendarAnswer = answer(opts.calendar, { result: true });
    const taskAnswer = answer(opts.task, { result: true });

    const browser = {
        storage: {
            sync: makeStorageArea('sync', opts.sync, calls),
            local: makeStorageArea('local', opts.local, calls),
        },
        runtime: {
            id: SPARKS_ID,
            getURL(path = '') { return EXT_ORIGIN + String(path).replace(/^\//, ''); },
            getManifest() { return readJson('manifest.json'); },
            async sendMessage(target, message) {
                // Sparks only ever uses the two-argument form, to ThunderAI.
                sent.push({ to: target, message: clone(message) });
                if (!opts.external) {
                    throw new Error('Could not establish connection. Receiving end does not exist.');
                }
                return clone(await opts.external(target, clone(message)));
            },
            onInstalled,
            onMessageExternal,
        },
        i18n: {
            getMessage(name, substitutions) {
                const entry = messages[name];
                if (!entry) return '';
                let text = entry.message;
                for (const [pname, def] of Object.entries(entry.placeholders || {})) {
                    text = text.replace(new RegExp('\\$' + pname + '\\$', 'gi'), () => def.content);
                }
                const subs = substitutions === undefined ? [] :
                    (Array.isArray(substitutions) ? substitutions : [substitutions]);
                subs.forEach((s, i) => { text = text.split('$' + (i + 1)).join(String(s)); });
                return text;
            },
            getUILanguage() { return 'en'; },
        },
        // The experimental API: a stub, the native Thunderbird dialog cannot run here.
        CalendarTools: {
            async openCalendarDialog(data) {
                calendarCalls.push({ fn: 'openCalendarDialog', data: clone(data) });
                return calendarAnswer(data);
            },
            async openTaskDialog(data) {
                calendarCalls.push({ fn: 'openTaskDialog', data: clone(data) });
                return taskAnswer(data);
            },
        },
    };

    globalThis.browser = browser;
    globalThis.messenger = browser;

    return {
        browser,
        calls,
        sent,
        calendarCalls,
        /** Raw storage.sync content, bypassing the API (no call recorded). */
        syncData() { return Object.fromEntries([...browser.storage.sync._data].map(([k, v]) => [k, clone(v)])); },
        /** Fire runtime.onInstalled, as Thunderbird does after an install/update. */
        async dispatchInstalled(details = { reason: 'install' }) {
            for (const fn of [...onInstalled._listeners]) await fn(clone(details));
        },
        /**
         * Deliver a message to the background's runtime.onMessageExternal listener, the way a
         * message from another add-on arrives. Resolves to the first listener's answer (a
         * returned promise or value), or undefined when no listener answers.
         */
        async dispatchExternal(message, sender = { id: THUNDERAI_ID }) {
            for (const fn of [...onMessageExternal._listeners]) {
                const ret = fn(clone(message), clone(sender), () => {});
                if (ret !== undefined && ret !== false && ret !== true) return clone(await ret);
                if (ret === true) return true;
            }
            return undefined;
        },
    };
}
