/*
 *  ThunderAI Sparks [https://micz.it/thunderbird-addon-thunderai/#sparks]
 *  Copyright (C) 2024 - 2025  Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { extractJsonObject } from "./js/mztas-utils.js";
import { tasLogger } from "./js/mztas-logger.js";

const SPARKS_VERSION = browser.runtime.getManifest().version;

// ============== FOR TESTING ==============
// browser.browserAction.onClicked.addListener(() => {
//     testThunderAISparks();
//   });

// async function testThunderAISparks(){
//   await browser.CalendarTools.openCalendarDialog({
//     startDate: '20250104T183000Z',
//     endDate: '20250104T193000Z',
//     summary: "ThunderAI Sparks",
//     forceAllDay: false,
//     attendees: [attendee1@example.com,attendee2@example.com,attendee3@example.com]"
//   });
// }
// =========================================

// Force ThunderAI to reload menus when installed the first time
browser.runtime.onInstalled.addListener(({reason}) => {
  if (reason == "install") {
    browser.runtime.sendMessage('thunderai@micz.it',{action: "reload_menus"})
  }
});

let prefs_init = await browser.storage.sync.get({do_debug: false});
let tasLog = new tasLogger("mztas-background",prefs_init.do_debug);

// Fields declared in api/CalendarTools/schema.json. Any other property in the
// AI response would make the schema validation fail, so it is discarded.
const CALENDAR_EVENT_FIELDS = ["startDate", "endDate", "summary", "location", "description", "forceAllDay", "attendees", "timezone", "use_timezone", "reminderMinutes"];
const TASK_FIELDS = ["dueDate", "summary", "initialDate", "location", "description", "timezone", "use_timezone", "reminderMinutes"];

function filterFields(jsonObj, allowedFields, caller) {
  if (!jsonObj || typeof jsonObj !== "object") {
    return jsonObj;
  }
  let filtered = {};
  let discarded = [];
  for (let key of Object.keys(jsonObj)) {
    if (allowedFields.includes(key)) {
      filtered[key] = jsonObj[key];
    } else {
      discarded.push(key);
    }
  }
  if (discarded.length > 0) {
    tasLog.log(caller + " discarded unknown fields: ", discarded.join(", "));
  }
  return filtered;
}

// reminderMinutes must be an integer >= -1, otherwise it is ignored
// (a non-integer value would also fail the schema validation) and
// Thunderbird's default reminder applies.
function filterReminderMinutes(jsonObj, caller) {
  if (jsonObj && ("reminderMinutes" in jsonObj) && !(Number.isInteger(jsonObj.reminderMinutes) && jsonObj.reminderMinutes >= -1)) {
    tasLog.log(caller + " ignoring invalid reminderMinutes: ", jsonObj.reminderMinutes);
    delete jsonObj.reminderMinutes;
  }
  return jsonObj;
}

// Listen for messages from ThunderAI
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  tasLog.log("Message received:", message);
  tasLog.log("Sender info:", sender);

  switch (message.action) {
    case "checkPresence":
      return Promise.resolve(SPARKS_VERSION);
      break;

    case "openCalendarEventDialog": {
      tasLog.log("openCalendarEventDialog: ", message.calendar_event_data);
      let jsonObj = {};
      try{
        jsonObj = extractJsonObject(message.calendar_event_data);
      }catch(e){
        console.error("[ThunderAI Sparks] openCalendarDialog error: ", e);
        return {result: "error", error: e};
      }
      tasLog.log("openCalendarEventDialog jsonObj: ", JSON.stringify(jsonObj));
      jsonObj = filterFields(jsonObj, CALENDAR_EVENT_FIELDS, "openCalendarEventDialog");
      jsonObj = filterReminderMinutes(jsonObj, "openCalendarEventDialog");
      return _openCalendarDialog(jsonObj);

      async function _openCalendarDialog(jsonObj) {
        let _result = await browser.CalendarTools.openCalendarDialog(jsonObj);
        if(_result.result){
          return "ok";
        } else {
          return {result: "error", error: _result.error};
        }
      }
      break;
    }
    case "openTaskDialog": {
      tasLog.log("openTaskDialog: ", message.task_data);
      let jsonObj = {};
      try{
        jsonObj = extractJsonObject(message.task_data);
      }catch(e){
        console.error("[ThunderAI Sparks] openTaskDialog error: ", e);
        return {result: "error", error: e};
      }
      tasLog.log("openTaskDialog jsonObj: ", JSON.stringify(jsonObj));
      jsonObj = filterFields(jsonObj, TASK_FIELDS, "openTaskDialog");
      jsonObj = filterReminderMinutes(jsonObj, "openTaskDialog");
      // A task reminder is related to the due date, or to the initial date
      // when there is no due date: without any date it is ignored and
      // Thunderbird's default reminder applies.
      if (jsonObj && jsonObj.reminderMinutes >= 0 && !jsonObj.dueDate && !jsonObj.initialDate) {
        tasLog.log("openTaskDialog ignoring reminderMinutes, the task has no due or initial date: ", jsonObj.reminderMinutes);
        delete jsonObj.reminderMinutes;
      }
      return _openTaskDialog(jsonObj);

      async function _openTaskDialog(jsonObj) {
        let _result = await browser.CalendarTools.openTaskDialog(jsonObj);
        if(_result.result){
          return "ok";
        } else {
          return {result: "error", error: _result.error};
        }
      }
      break;
    }
  }
  
  return true;
});
