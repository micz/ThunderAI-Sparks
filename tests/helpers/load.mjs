/*
 *  The loader. The mock must be on globalThis before any module under test is imported (the
 *  background awaits storage and reads the manifest at import time, mztas-options.js reads
 *  prefs_default), so the modules are always loaded through a dynamic import() here, never with a
 *  static one.
 *
 *  A cache-busting query (?t=<counter>) is appended to each import so a second startBackground()
 *  in the same process really re-runs the background's top level against a fresh mock, instead of
 *  getting the cached, already-registered module. Test files are one context each anyway; this is
 *  only for the rare test that wants two.
 */

import { installBrowserMock } from './browser-mock.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const REPO = new URL('../../', import.meta.url);
export function repoPath(rel) { return fileURLToPath(new URL(rel, REPO)); }
export function readRepo(rel) { return readFileSync(repoPath(rel), 'utf8'); }

let counter = 0;
const bust = (rel) => new URL(rel + '?t=' + (++counter), REPO).href;

/** Capture console.{log,error,warn}; restore() puts the originals back. */
export function captureConsole() {
    const entries = [];
    const original = {};
    const verbose = process.env.TEST_VERBOSE === '1';
    for (const level of ['log', 'error', 'warn']) {
        original[level] = console[level];
        console[level] = (...args) => {
            entries.push({ level, text: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') });
            if (verbose) original[level](...args);
        };
    }
    return {
        entries,
        errors: () => entries.filter(e => e.level === 'error'),
        warnings: () => entries.filter(e => e.level === 'warn'),
        clear: () => { entries.length = 0; },
        restore: () => { for (const level of Object.keys(original)) console[level] = original[level]; },
    };
}

/** The shared, browser-free modules: utils and the default prefs. */
export async function loadModules() {
    const utils = await import(bust('js/mztas-utils.js'));
    const { prefs_default } = await import(bust('js/mztas-options-default.js'));
    return { utils, prefs_default };
}

/**
 * Start a background context: install the mock, capture the console, import the background so its
 * top-level await runs and its listeners register. Returns { ctl, con } plus the mock controller's
 * fields, so a test can dispatchExternal()/dispatchInstalled() and read calls/sent/calendarCalls.
 */
export async function startBackground(mockOpts = {}) {
    const ctl = installBrowserMock(mockOpts);
    const con = captureConsole();
    await import(bust('mztas-background.js'));
    return { ctl, con, ...ctl };
}
