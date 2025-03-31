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

  var { cal } = ChromeUtils.importESModule("resource:///modules/calendar/calUtils.sys.mjs");
  var { CalTimezoneService } = ChromeUtils.importESModule("resource:///modules/CalTimezoneService.sys.mjs");
  var { CalAttendee } = ChromeUtils.importESModule("resource:///modules/CalAttendee.sys.mjs");

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
            //  console.log(">>>>>>>>>> ThunderAI Sparks: openCalendarDialog cal_data: ", JSON.stringify(cal_data));

            // let calendars = cal.manager.getCalendars().filter(calendar => !calendar.getProperty("disabled"));

            let window = Services.wm.getMostRecentWindow("mail:3pane");
            if (!window) {
              throw new Error("No active Thunderbird window found");
            }
            try {
              let startDate = cal.createDateTime(cal_data.startDate)
              let endDate = cal.createDateTime(cal_data.endDate)

              if(cal_data.use_timezone) {
                const timezoneService = new CalTimezoneService();
                startDate.timezone = timezoneService.getTimezone(cal_data.timezone);
                endDate.timezone = timezoneService.getTimezone(cal_data.timezone);
              }

              let attendees_obj = [];
              if(cal_data.attendees != null) {
                attendees_obj = cal_data.attendees.map(attendee => {
                  return new CalAttendee("ATTENDEE:" + attendee, "", "REQ-PARTICIPANT", "", "");
                });
              }

              // let calendars = cal.manager.getCalendars();
              // calendars = calendars.filter(cal.acl.isCalendarWritable);

              // if (calendars.length < 1) {
              //   // There are no writable calendars
              //   console.error("[ThunderAI Sparks] openCalendarDialog ExtensionAPI error: ", "No active calendar found!");
              //   return {result: false, error: "|>>noActiveCalendar"};
              // }

              let curr_calendar = window.getSelectedCalendar();

              // console.log(">>>>>>>>>> ThunderAI Sparks: openCalendarDialog curr_calendar.name: ", JSON.stringify(curr_calendar.name));
              // console.log(">>>>>>>>>> ThunderAI Sparks: openCalendarDialog curr_calendar.getProperty(\"disabled\"): ", JSON.stringify(curr_calendar.getProperty("disabled")));

              window.createEventWithDialog(
                curr_calendar, //calendars[0], //cal_data.calendar,
                startDate,
                endDate,
                cal_data.summary,
                null, //cal_data.event,
                cal_data.forceAllDay,
                attendees_obj
              );
            } catch (e) {
              console.error("[ThunderAI Sparks] openCalendarDialog ExtensionAPI error: ", e);
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