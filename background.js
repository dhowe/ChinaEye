var disabled = {};

chrome.runtime.onMessage.addListener(function (req, src, callback) {

  //console.log("msg:", req.what, src.tab);

  if (req.what === "refresh" && req.tabId) { // from popup

    // add to disabled-tabId table
    disabled[req.tabId] = true;

    setTimeout(function () {
      delete disabled[req.tabId];
    }, 5000); // remove after 5 seconds

    chrome.tabs.reload(req.tabId);

  } else if (req.what === "check") { // from content_script

    //var tabId = (src.tab && src.tab.id) || req.tabId;
    callback({
      "active": (typeof disabled[src.tab.id] === 'undefined')
    });
  }
});
