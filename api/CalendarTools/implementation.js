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

/* global Services, ExtensionCommon */

"use strict";

// Using a closure to not leak anything but the API to the outside world.
(function (exports) {

  var { ExtensionUtils } = ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs");
  var { ExtensionError } = ExtensionUtils;
  var { cal } = ChromeUtils.importESModule("resource:///modules/calendar/calUtils.sys.mjs");

  // var CalEditingSandbox = {require: exports.require, exports: {}};

  // var window = Services.wm.getMostRecentWindow("mail:3pane");
  // if (!window) {
  //   throw new Error("No active Thunderbird window found");
  // }

  // CalEditingSandbox.openDialog = function (url, name, features, args) {
  //     return window.openDialog(url, name, features, args);
  //   };

  // CalEditingSandbox.window = window;
  // CalEditingSandbox.document = window.document;

  // Services.scriptloader.loadSubScript("chrome://calendar/content/calendar-views-utils.js",CalEditingSandbox);
  // Services.scriptloader.loadSubScript("chrome://calendar/content/calendar-item-editing.js",CalEditingSandbox);

  // window.openEventDialog = CalEditingSandbox.openEventDialog;

  var CalendarTools = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        CalendarTools: {
          async openCalendarDialog(cal_data) {
            // implementation
            // console.log(">>>>>>>>>> ThunderAI Sparks: openCalendarDialog cal_data: ", JSON.stringify(cal_data));

            // let calendars = cal.manager.getCalendars().filter(calendar => !calendar.getProperty("disabled"));

            let window = Services.wm.getMostRecentWindow("mail:3pane");
            if (!window) {
              throw new Error("No active Thunderbird window found");
            }
            try {
              window.createEventWithDialog(
                window.getSelectedCalendar(), //calendars[0], //cal_data.calendar,
                cal.createDateTime(cal_data.startDate),
                cal.createDateTime(cal_data.endDate),
                cal_data.summary,
                null, //cal_data.event,
                cal_data.forceAllDay,
                [], //cal_data.attendees
              );
            } catch (e) {
              console.error("[ThunderAI Sparks] openCalendarDialog error: ", e);
              return {result: false, error: e};
            }
            return {result: true};
          }
        }
      }
    }
  };


  // Export the API by assigning it to the exports parameter of the anonymous
  // closure function, which is the global this.
  exports.CalendarTools = CalendarTools;

})(this);