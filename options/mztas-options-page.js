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

import { tasLogger } from "../js/mztas-logger.js";
import { i18n } from "../js/mztas-i18n.js";
import { tasPrefs } from "../js/mztas-options.js";

document.addEventListener('DOMContentLoaded', async () => {
    let do_debug = await tasPrefs.getPref("do_debug");
    tasPrefs.logger = new tasLogger("mztas-options", do_debug);

    tasPrefs.restoreOptions();
    i18n.updateDocument();
    document.querySelectorAll(".option-input").forEach(element => {
      element.addEventListener("change", tasPrefs.saveOptions);
    });
    // This select is intentionally outside .option-input: restoreOptions dispatches
    // synthetic change events, which must never overwrite a stored calendar ID.
    await restorePreferredCalendar();
  }, { once: true });

async function restorePreferredCalendar() {
    const select = document.getElementById("preferred_calendar_id");
    const status = document.getElementById("preferred_calendar_status");
    try {
      const [stored, calendars] = await Promise.all([
        tasPrefs.getPref("preferred_calendar_id"),
        browser.CalendarTools.listWritableCalendars()
      ]);
      const preferred = typeof stored === "string" ? stored : "";
      select.add(new Option(browser.i18n.getMessage("prefs_selected_event_calendar"), ""));
      for (const calendar of calendars) {
        select.add(new Option(`${calendar.name} (${calendar.type}; ${calendar.id})`, calendar.id));
      }
      if (preferred && !calendars.some(calendar => calendar.id === preferred)) {
        const unavailable = new Option(browser.i18n.getMessage("prefs_unavailable_event_calendar") + ` (${preferred})`, preferred);
        unavailable.disabled = true;
        select.add(unavailable);
        status.textContent = browser.i18n.getMessage("prefs_unavailable_event_calendar_info");
      }
      select.value = preferred;
      select.disabled = false;
      select.addEventListener("change", async () => {
        await tasPrefs.setPref("preferred_calendar_id", select.value);
        status.textContent = "";
      });
    } catch (e) {
      status.textContent = browser.i18n.getMessage("prefs_event_calendars_load_error");
    }
}
