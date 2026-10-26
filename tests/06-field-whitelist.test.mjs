// Static consistency, per CLAUDE.md "Gotchas": a new event/task field must be plumbed through
// schema.json AND added to the field whitelist in mztas-background.js (which drops undeclared
// fields). So the two whitelists must match the properties declared in the experiment schema
// exactly - otherwise a field the LLM is asked for is silently dropped, or a dropped field is
// let through to fail the schema validation.
//
// Level 1: the repository as source, no behaviour run, nothing to install.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRepo } from './helpers/load.mjs';

const source = readRepo('mztas-background.js');
const schema = JSON.parse(readRepo('api/CalendarTools/schema.json'));

function whitelist(name) {
    const m = source.match(new RegExp('const\\s+' + name + '\\s*=\\s*(\\[[^\\]]*\\])'));
    assert.ok(m, 'could not find ' + name + ' in mztas-background.js');
    return JSON.parse(m[1]);
}

function schemaProps(fnName) {
    const ns = schema.find(n => n.namespace === 'CalendarTools');
    assert.ok(ns, 'CalendarTools namespace not found in schema.json');
    const fn = ns.functions.find(f => f.name === fnName);
    assert.ok(fn, fnName + ' not found in schema.json');
    return Object.keys(fn.parameters[0].properties);
}

test('CALENDAR_EVENT_FIELDS matches openCalendarDialog schema properties', () => {
    assert.deepEqual([...whitelist('CALENDAR_EVENT_FIELDS')].sort(),
        [...schemaProps('openCalendarDialog')].sort());
});

test('TASK_FIELDS matches openTaskDialog schema properties', () => {
    assert.deepEqual([...whitelist('TASK_FIELDS')].sort(),
        [...schemaProps('openTaskDialog')].sort());
});
