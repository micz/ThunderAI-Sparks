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

// Listen for messages from ThunderAI
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  tasLog.log("Message received:", message);
  tasLog.log("Sender info:", sender);

  switch (message.action) {
    case "checkPresence":
      return Promise.resolve("1.2.0");
      break;

    case "openCalendarEventDialog":
      tasLog.log("openCalendarEventDialog: ", message.calendar_event_data);
      let jsonObj = {};
      try{
        jsonObj = extractJsonObject(message.calendar_event_data);
      }catch(e){
        console.error("[ThunderAI Sparks] openCalendarDialog error: ", e);
        return {result: "error", error: e};
      }
      tasLog.log("openCalendarEventDialog jsonObj: ", JSON.stringify(jsonObj));
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
  
  return true;
});
