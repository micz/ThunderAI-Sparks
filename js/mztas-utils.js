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


export function extractJsonObject(inputString) {
    try {
      const jsonMatch = inputString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonObject = JSON.parse(jsonMatch[0]);
        // console.log(">>>>>>>>>> Extracted JSON object:", jsonObject);
        return jsonObject;
      } else {
        throw new Error("[ThunderAI-Sparks] No JSON object found in the input string.");
      }
    } catch (error) {
      console.error("[ThunderAI-Sparks] Error extracting JSON object:", error);
      return null;
    }
  }