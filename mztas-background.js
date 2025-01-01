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

// ============== FOR TESTING ==============
browser.browserAction.onClicked.addListener(() => {
    testThunderAISparks();
  });

async function testThunderAISparks(){
  await browser.CalendarTools.openCalendarDialog({
    startDate: '20250104T183000Z',
    endDate: '20250104T193000Z',
    summary: "ThunderAI Sparks",
    forceAllDay: false
  });
}
// =========================================

// Listen for messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);
  console.log("Sender info:", sender);

  sendResponse({ response: "Message received successfully!" });

  switch (message.action) {
    case "openCalendarDialog":
      browser.CalendarTools.openCalendarDialog(message.data);
      break;
  }
  
  return true;
});