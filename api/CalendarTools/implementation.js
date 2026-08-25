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

  ChromeUtils.defineESModuleGetters(globalThis, {
    CalEvent: "resource:///modules/CalEvent.sys.mjs",
  });

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

				let event = new CalEvent();

				event.title = cal_data.summary;
				event.calendar = curr_calendar;
				event.startDate = startDate;
				event.endDate = endDate;

				if (cal_data.attendees) {
				  for (let a of cal_data.attendees) {
				    event.addAttendee(new CalAttendee("ATTENDEE:" + a, "", "REQ-PARTICIPANT", "", ""));
				  }
				}

				// Add location if provided
				if (cal_data.location) {
				  event.setProperty("LOCATION", cal_data.location);
				}

              // Add description if provided
              if (cal_data.description) {
                event.descriptionText = cal_data.description;
              }

              window.createEventWithDialog(null, null, null, null, event, cal_data.forceAllDay);
            } catch (e) {
              console.error("[ThunderAI Sparks] openCalendarDialog ExtensionAPI error: ", e);
              return {result: false, error: e};
            }
            return {result: true};
          },
          async openTaskDialog(task_data) {
            // implementation

            let window = Services.wm.getMostRecentWindow("mail:3pane");
            if (!window) {
              throw new Error("No active Thunderbird window found");
            }
            try {
                let dueDate = task_data.dueDate ? cal.createDateTime(task_data.dueDate) : null;
                let initialDate = task_data.initialDate ? cal.createDateTime(task_data.initialDate) : null;

                if (task_data.use_timezone) {
                const timezoneService = new CalTimezoneService();
                if (dueDate) {
                  dueDate.timezone = timezoneService.getTimezone(task_data.timezone);
                }
                if (initialDate) {
                  initialDate.timezone = timezoneService.getTimezone(task_data.timezone);
                }
                }

              let curr_calendar = window.getSelectedCalendar();

              // console.log(">>>>>>>>>> ThunderAI Sparks: openTaskDialog curr_calendar.name: ", JSON.stringify(curr_calendar.name));
              // console.log(">>>>>>>>>> ThunderAI Sparks: openTaskDialog curr_calendar.getProperty(\"disabled\"): ", JSON.stringify(curr_calendar.getProperty("disabled")));

              window.createTodoWithDialog(
                curr_calendar,
                dueDate,
                task_data.summary,
                null, //task_data.todo,
                initialDate
              );
            } catch (e) {
              console.error("[ThunderAI Sparks] openTodoDialog ExtensionAPI error: ", e);
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
