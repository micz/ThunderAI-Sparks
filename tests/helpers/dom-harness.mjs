/*
 *  The DOM harness: load a real add-on page in jsdom, the way Thunderbird loads it.
 *
 *  jsdom does not execute <script type="module">, so openPage() does what the browser does:
 *  parse the page's real HTML at a moz-extension:// url, expose the window globals the page's
 *  module code looks up as bare names, install the browser mock (before any module is imported),
 *  import the page's module script, dispatch DOMContentLoaded and let it settle.
 *
 *  This is the only helper that imports jsdom, so a level-1 test must never import it (it would
 *  break the "runs with nothing installed" contract). Its files carry the .dom.mjs suffix, which
 *  keeps the level-1 glob from ever picking them up.
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowserMock, EXT_ORIGIN } from './browser-mock.mjs';
import { captureConsole } from './load.mjs';

const REPO = new URL('../../', import.meta.url);

// Add-on pages, by name, to their HTML file.
const PAGES = {
    options: 'options/mztas-options.html',
    'release-notes': 'options/mztas-release-notes.html',
};

// The window globals the page code reads as bare names. The list is explicit: copying the whole
// window would shadow Node's own URL, timers and so on.
const WINDOW_GLOBALS = [
    'window', 'document', 'navigator', 'DOMParser', 'XPathResult', 'XMLSerializer',
    'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'HTMLElement', 'Option',
    'getComputedStyle', 'customElements', 'ShadowRoot',
];

/** Turn the event loop until nothing is pending (a small, bounded flush). */
async function settle(window) {
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => window.queueMicrotask(r));
    }
}

/**
 * Open an add-on page.
 * @param {string} page   a key of PAGES
 * @param {object} opts   passed to installBrowserMock() (sync, external, ...), plus:
 *   module  - the page's module script, repo-relative (default: the one in its <script type=module>)
 * @returns ctx: { window, document, $, $$, ctl, con, fire, click, settle, cleanup }
 */
export async function openPage(page, opts = {}) {
    const htmlRel = PAGES[page];
    if (!htmlRel) throw new Error('unknown page: ' + page);
    const html = readFileSync(fileURLToPath(new URL(htmlRel, REPO)), 'utf8');
    const url = EXT_ORIGIN + htmlRel;

    const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;

    // Install the mock before the page module is imported.
    const ctl = installBrowserMock(opts);
    const con = captureConsole();

    // Expose the window globals where the module code looks them up. Some (navigator) are
    // getter-only on globalThis in Node, so define them instead of assigning.
    const saved = [];
    const expose = (name, value) => {
        saved.push([name, Object.getOwnPropertyDescriptor(globalThis, name)]);
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    };
    for (const name of WINDOW_GLOBALS) {
        if (name in window) expose(name, window[name]);
    }

    // The module's <script type="module" src="..."> — resolve relative to the page's folder.
    let moduleRel = opts.module;
    if (!moduleRel) {
        const tag = window.document.querySelector('script[type="module"][src]');
        const src = tag ? tag.getAttribute('src') : null;
        if (!src) throw new Error('no module script found in ' + htmlRel);
        moduleRel = htmlRel.replace(/[^/]+$/, '') + src;
    }

    await import(new URL(moduleRel + '?t=' + Date.now(), REPO).href);

    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: false }));
    await settle(window);

    const $ = sel => window.document.querySelector(sel);
    const $$ = sel => [...window.document.querySelectorAll(sel)];
    const fire = async (el, type) => { el.dispatchEvent(new window.Event(type, { bubbles: true })); await settle(window); };
    const click = async (el) => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await settle(window); };
    const cleanup = () => {
        for (const [name, desc] of saved) {
            if (desc) Object.defineProperty(globalThis, name, desc);
            else delete globalThis[name];
        }
        con.restore();
        window.close();
    };

    return { window, document: window.document, $, $$, ctl, con, fire, click, settle: () => settle(window), cleanup };
}
