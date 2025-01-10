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
  }, { once: true });
