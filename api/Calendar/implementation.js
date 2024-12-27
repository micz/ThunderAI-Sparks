var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

var Calendar = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      Calendar: {}
    }
  }
};
