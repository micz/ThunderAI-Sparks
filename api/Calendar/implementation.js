// Using a closure to not leak anything but the API to the outside world.
(function (exports) {

  var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

  var Calendar = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        Calendar: {
          async openCalendarDialog(cal_data) {
            // implementation
          }
        }
      }
    }
  };


  // Export the API by assigning it to the exports parameter of the anonymous
  // closure function, which is the global this.
  exports.Calendar = Calendar;

})(this)