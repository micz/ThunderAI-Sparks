/*
 *  Known issues: potential bugs a test found, run as node:test TODOs.
 *
 *  Tests are written from the spec (CLAUDE.md, the schema, the CHANGELOG contracts). A test that
 *  fails against the shipped code is NOT changed to pass, and neither is the source: the failing
 *  assertion still runs, and is reported as a node:test TODO carrying its reason, so it shows up in
 *  every run ("# TODO") without turning CI red, until the behaviour is fixed or ruled correct.
 *
 *  A known issue whose test PASSES fails the run ("stale known issue"): remove its entry, so it
 *  cannot outlive its bug and go on hiding a later regression of the same test.
 *
 *  Sparks is a single small add-on, so the entries live here next to the mechanism (KNOWN below),
 *  keyed by the test name. Add an entry, with the spec it contradicts and what the code does
 *  instead, to run a failing test as a TODO.
 */

import { test } from 'node:test';

// name -> reason. Empty while the suite matches the spec.
export const KNOWN = {
    // 'extractJsonObject returns the deepest object': 'CLAUDE.md says it greedily matches the
    //   first { ... } block; the code does, so this would be a spec change, not a bug.',
};

async function runKnown(reason, fn, t) {
    try {
        await fn(t);
    } catch (e) {
        return { outcome: 'todo', message: reason + ' -- ' + ((e && e.message) || String(e)) };
    }
    return { outcome: 'stale' };
}

/** test(), but a name listed in KNOWN runs as a TODO while it fails (see the file header). */
export function knownTest(name, fn) {
    const reason = KNOWN[name];
    if (!reason) return test(name, fn);
    return test(name, async (t) => {
        const r = await runKnown(reason, fn, t);
        if (r.outcome === 'todo') { t.todo(r.message); return; }
        throw new Error('stale known issue, the test passes now: remove "' + name +
            '" from tests/helpers/known-issues.mjs ("' + reason + '")');
    });
}
