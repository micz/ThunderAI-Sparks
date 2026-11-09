// extractJsonObject() (js/mztas-utils.js), per CLAUDE.md "How the two add-ons communicate" #3:
//  - it greedily matches the FIRST { ... } block, so the LLM output may contain surrounding prose;
//  - on a match it returns the parsed object; on no match or invalid JSON it returns null (and logs
//    the kind of error only, never the text).
//
// Level 1: the module alone, nothing to install.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules, captureConsole } from './helpers/load.mjs';

const { utils } = await loadModules();
const { extractJsonObject } = utils;

test('parses a bare JSON object', () => {
    assert.deepEqual(extractJsonObject('{"summary":"Meeting","forceAllDay":false}'),
        { summary: 'Meeting', forceAllDay: false });
});

test('pulls the object out of surrounding prose (LLM output)', () => {
    const input = 'Sure! Here is the event:\n{"summary":"Lunch"}\nLet me know if you need changes.';
    assert.deepEqual(extractJsonObject(input), { summary: 'Lunch' });
});

test('greedily matches from the first "{" to the last "}" (nested objects)', () => {
    const input = 'x {"a":1,"b":{"c":2}} y';
    assert.deepEqual(extractJsonObject(input), { a: 1, b: { c: 2 } });
});

test('keeps arrays inside the object (attendees)', () => {
    const input = '{"summary":"Sync","attendees":["a@example.com","b@example.com"]}';
    assert.deepEqual(extractJsonObject(input),
        { summary: 'Sync', attendees: ['a@example.com', 'b@example.com'] });
});

test('returns null and logs when there is no { ... } block', () => {
    const con = captureConsole();
    try {
        assert.equal(extractJsonObject('no json here'), null);
        assert.ok(con.errors().some(e => e.text.includes('No JSON object found')));
    } finally { con.restore(); }
});

test('returns null and logs when the braces do not hold valid JSON', () => {
    const con = captureConsole();
    try {
        assert.equal(extractJsonObject('{not: valid, json}'), null);
        assert.ok(con.errors().some(e => e.text.includes('Error extracting JSON object')));
    } finally { con.restore(); }
});

test('returns null for a non-string input instead of throwing', () => {
    const con = captureConsole();
    try {
        assert.equal(extractJsonObject(null), null);
        assert.equal(extractJsonObject(undefined), null);
    } finally { con.restore(); }
});

test('a parse error is logged by its kind, never with the text it was given', () => {
    // An Error is kept whole here: its message is what a parser may fill with the input.
    const logged = [];
    const original = console.error;
    console.error = (...args) => logged.push(args.map(a => (a instanceof Error ? a.name + ': ' + a.message : String(a))).join(' '));
    try {
        assert.equal(extractJsonObject('{"summary": SYNTHETIC_MAIL_TEXT, "x": 1}'), null);
    } finally { console.error = original; }
    assert.equal(logged.length, 1);
    assert.equal(logged[0].includes('SYNTHETIC'), false);
    assert.ok(logged[0].includes('SyntaxError'));
});
