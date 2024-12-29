/*
 *  ThunderAI Sparks [https://micz.it/thunderbird-addon-thunderai/#sparks]
 *  Copyright (C) 2024  Mic (m@micz.it)

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

  var CalEditingSandbox = {require: exports.require, exports: {}};

  Services.scriptloader.loadSubScript(
    "chrome://calendar/content/calendar-item-editing.js",
    CalEditingSandbox
  );

  var CalendarTools = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        CalendarTools: {
          async openCalendarDialog(cal_data) {
            // implementation
            console.log(">>>>>>>>>> ThunderAI Sparks: openCalendarDialog cal_data: ", cal_data);
            CalEditingSandbox.createEventWithDialog(cal_data);
            return;
          }
        }
      }
    }
  };


  // Export the API by assigning it to the exports parameter of the anonymous
  // closure function, which is the global this.
  exports.CalendarTools = CalendarTools;

})(this);