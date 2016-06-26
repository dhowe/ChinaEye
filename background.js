var disabled = {};

chrome.runtime.onMessage.addListener(function (req, src, callback) {

  console.log("msg:", req.what, req, src);

  if (req.what === "refresh" && req.tabId) { // from popup

    // add to disabled-tabId table
    disabled[req.tabId] = true;

    setTimeout(function () {
      delete disabled[req.tabId];
    }, 5000); // remove after 5 seconds

    chrome.tabs.reload(req.tabId);

  } else if (req.what === "test") { // from content_script

    var active = (typeof disabled[src.tab.id] === 'undefined');
    if (active) {
      testServers(src.tab.url, callback);
    }
    //var tabId = (src.tab && src.tab.id) || req.tabId;
  } else if (req.what === "check") { // from content_script

    //var tabId = (src.tab && src.tab.id) || req.tabId;
    callback({
      "active": (typeof disabled[src.tab.id] === 'undefined')
    });
  }
  return true;
});

var testServers = function (page, callback) {

  var gfw = 'http://www.greatfirewallofchina.org';
  var url = gfw + '/index.php?siteurl=' + page;

  console.log('testServers:', url);

  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {

    if (xhr.readyState == XMLHttpRequest.DONE) {

      var fails = 0, result = {},
        locs = $(xhr.responseText).find('.resultlocation'),
        vals = $(xhr.responseText).find('.resultstatus');

      for (var i = 0; i < locs.length; i++) {
        var value = $(vals[i]).text().toLowerCase();
        result[$(locs[i]).text().toLowerCase()] = value;
        if (value === 'fail') fails++;
      }

      console.log('result:', locs.length, vals.length, result);
      result.status = fails > 2 ? 'block' : 'allow';
      callback(result);
    }
  }
  xhr.open('GET', url, true);
  xhr.send(null);
}
