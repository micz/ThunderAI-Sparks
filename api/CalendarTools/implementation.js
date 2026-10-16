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
  var { CalAttendee } = ChromeUtils.importESModule("resource:///modules/CalAttendee.sys.mjs");
  var { CalAlarm } = ChromeUtils.importESModule("resource:///modules/CalAlarm.sys.mjs");

  ChromeUtils.defineESModuleGetters(globalThis, {
    CalEvent: "resource:///modules/CalEvent.sys.mjs",
    CalTodo: "resource:///modules/CalTodo.sys.mjs",
  });

  // True when reminderMinutes asks for a specific reminder setting
  // (-1 = no reminder, >= 0 = minutes before), false when it is absent or
  // invalid, meaning Thunderbird's default reminder must be applied.
  function hasReminderMinutes(reminderMinutes) {
    return Number.isInteger(reminderMinutes) && reminderMinutes >= -1;
  }

  // Replaces the item's alarms with the requested one: none for -1, otherwise
  // a single DISPLAY alarm reminderMinutes before the given relation
  // (Ci.calIAlarm.ALARM_RELATED_START or ALARM_RELATED_END).
  function setReminder(item, reminderMinutes, related) {
    item.clearAlarms();
    if (reminderMinutes >= 0) {
      let alarmOffset = cal.createDuration();
      alarmOffset.minutes = reminderMinutes;
      alarmOffset.normalize();
      alarmOffset.isNegative = true;

      let alarm = new CalAlarm();
      alarm.related = related;
      alarm.action = "DISPLAY";
      alarm.offset = alarmOffset;
      item.addAlarm(alarm);
    }
  }

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
                const timezoneService = cal.timezoneService;
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

              // Reminder: absent (or invalid) = Thunderbird's default reminder,
              // -1 = explicitly no reminder, >= 0 = exactly one DISPLAY alarm
              // that many minutes before the start.
              // createEventWithDialog applies the default alarm only when no
              // template event is passed, so we apply it ourselves, after the
              // calendar and the dates are set. setDefaultValues honors
              // calendar.alarms.onforevents (and adds nothing when it is off),
              // and for events it depends only on the calendar (alarm action),
              // not on the dates, so forceAllDay, applied later by
              // createEventWithDialog, does not change the default alarm.
              if (hasReminderMinutes(cal_data.reminderMinutes)) {
                setReminder(event, cal_data.reminderMinutes, Ci.calIAlarm.ALARM_RELATED_START);
              } else {
                cal.alarms.setDefaultValues(event);
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
                const timezoneService = cal.timezoneService;
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

              // Always build the task ourselves: createTodoWithDialog applies
              // Thunderbird's default alarm only when no template task is passed,
              // and a template is needed anyway for location, description and a
              // specific reminder. With a template it ignores its summary/date
              // arguments, so everything is set here.
              let todo = new CalTodo();

              todo.title = task_data.summary;
              todo.calendar = curr_calendar;

              // Tasks use entryDate/dueDate, not startDate/endDate.
              if (initialDate) {
                todo.entryDate = initialDate;
              }
              if (dueDate) {
                todo.dueDate = dueDate;
              }

              // Add location if provided
              if (task_data.location) {
                todo.setProperty("LOCATION", task_data.location);
              }

              // Add description if provided
              if (task_data.description) {
                todo.descriptionText = task_data.description;
              }

              // Reminder: absent (or invalid) = Thunderbird's default reminder,
              // -1 = explicitly no reminder, >= 0 = exactly one DISPLAY alarm
              // that many minutes before the due date (ALARM_RELATED_END, which
              // Thunderbird resolves to dueDate for tasks), or before the
              // initial date (ALARM_RELATED_START = entryDate) when there is no
              // due date. Without any date a reminder can't be related to
              // anything, so the value is ignored (the background script
              // already dropped and logged it) and the default applies.
              // setDefaultValues honors calendar.alarms.onfortodos, adds nothing
              // when it is off, and sets entryDate to now if missing.
              let reminderMinutes = task_data.reminderMinutes;
              if (hasReminderMinutes(reminderMinutes) && reminderMinutes >= 0 && !dueDate && !initialDate) {
                reminderMinutes = undefined;
              }
              if (hasReminderMinutes(reminderMinutes)) {
                setReminder(todo, reminderMinutes, dueDate ? Ci.calIAlarm.ALARM_RELATED_END : Ci.calIAlarm.ALARM_RELATED_START);
              } else {
                cal.alarms.setDefaultValues(todo);
              }

              window.createTodoWithDialog(
                curr_calendar,
                dueDate,
                task_data.summary,
                todo,
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
