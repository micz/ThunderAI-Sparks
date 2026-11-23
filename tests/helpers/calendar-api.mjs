// Simulated Thunderbird environment. Runs the real privileged implementation.js,
// with no XPCOM, provider, UI or persistence. This is software validation only.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
export function calendar(id = 'selected', properties = {}) {
    return {
        id, name: 'Calendar', type: 'memory', properties,
        getProperty(name) { return properties[name] ?? null; },
        addItem() { throw new Error('The API must not save events'); },
    };
}

export function loadCalendarAPI(options = {}) {
    const calls = { events: [], dialogs: [], warnings: [], logs: [], uris: [], selected: 0, manager: 0, writable: [], acl: [] };
    const selected = options.selected === undefined ? calendar() : options.selected;
    class Item {
        constructor() { this.properties = {}; this.attendees = []; this.attachments = []; this.categoryCalls = []; this.alarms = []; calls.events.push(this); }
        setProperty(key, value) { this.properties[key] = value; }
        setCategories(value) { this.categoryCalls.push(Array.from(value)); }
        addAttachment(value) { this.attachments.push(value); }
        addAttendee(value) { this.attendees.push(value); }
        clearAlarms() { this.alarms = []; }
        addAlarm(value) { this.alarms.push(value); }
    }
    class Attachment {
        set rawData(_) { throw new Error('No binary data'); }
    }
    const classes = {
        CalEvent: Item, CalTodo: Item, CalAttachment: Attachment,
        CalAttendee: class { constructor(...args) { this.args = args; } },
        CalAlarm: class {},
    };
    const window = {
        getSelectedCalendar() { calls.selected++; return selected; },
        createEventWithDialog(...args) { calls.dialogs.push(args); },
        // calendar-ui-utils.js, in the 3-pane window: the calendar list's order.
        ...(options.sortCalendarArray ? { sortCalendarArray: options.sortCalendarArray } : {}),
    };
    const cal = {
        category: { fromPrefs() { return options.categories || []; } },
        manager: { getCalendars() { calls.manager++; return options.calendars || [selected].filter(Boolean); } },
        acl: {
            isCalendarWritable(c) {
                calls.writable.push(c.id);
                return !c.getProperty('disabled') && !c.getProperty('readOnly') && !c.getProperty('offlineUnavailable');
            },
            userCanAddItemsToCalendar(c) { calls.acl.push(c.id); return c.getProperty('aclDenied') !== true; },
        },
        createDateTime(value) { return { value }; },
        createDuration() { return { normalize() {} }; },
        timezoneService: { getTimezone(value) { return { tzid: value }; } },
        alarms: { setDefaultValues(item) { item.defaultAlarm = true; } },
    };
    const en = JSON.parse(readFileSync(new URL('_locales/en/messages.json', root), 'utf8'));
    const sandbox = {
        Cu: { importGlobalProperties(names) { for (const name of names) { if (name !== "URL") throw new Error("Unmodelled global: " + name); sandbox[name] = URL; } } },
        console: { log(...args) { calls.logs.push(args); }, warn(...args) { calls.logs.push(args); }, error(...args) { calls.logs.push(args); } },
        Services: {
            wm: { getMostRecentWindow() { return options.noWindow ? null : window; } },
            io: { newURI(value) { calls.uris.push(value); if (options.uriFailure) throw new Error('URI failure'); return { spec: value }; } },
            prompt: { alert(_window, title, message) { calls.warnings.push({ title, message }); } },
        },
        Ci: { calIAlarm: { ALARM_RELATED_START: 0, ALARM_RELATED_END: 1 } },
        ExtensionCommon: { ExtensionAPI: class {} },
        ChromeUtils: {
            importESModule(uri) { return uri.includes('calUtils') ? { cal } : classes; },
            defineESModuleGetters(target, modules) { for (const key of Object.keys(modules)) target[key] = classes[key]; },
        },
    };
    vm.runInNewContext(readFileSync(new URL('api/CalendarTools/implementation.js', root), 'utf8'), sandbox,
        { filename: 'api/CalendarTools/implementation.js' });
    const api = new sandbox.CalendarTools().getAPI({
        extension: { localeData: { localizeMessage(key) { return en[key]?.message || key; } } },
    }).CalendarTools;
    return { api, calls, cal, selected, event: () => calls.events.at(-1) };
}

export const EVENT = {
    startDate: '20261104T140000Z', endDate: '20261104T150000Z',
    summary: 'Synthetic seminar', description: 'Synthetic agenda', location: 'Room 1',
    forceAllDay: false, attendees: [], use_timezone: true, timezone: 'Europe/Paris', reminderMinutes: 15,
};
