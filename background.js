var disabled = {},
  gfw = 'http://www.greatfirewallofchina.org';

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

  //console.log("onMessage:", request.what, request, sender);

  if (request.what === "checkPage") { // from content_script

    checkPage(sender.tab, callback);

  } else if (request.what === "disablePage") { // from popup

    // add to disabled-tabId table
    disabled[request.tabId] = true;

    // and reload (will trigger content-script and be ignored)
    chrome.tabs.reload(request.tabId);
  }

  return true;
});

var checkPage = function (tab, callback) {

  //console.log('checkPage:', tab.url);

  if (typeof disabled[tab.id] === 'undefined') {

    $.ajax(gfw + '/index.php?siteurl=' + tab.url, {
      success: function (data) {
        callback(parseResults(data));
      },
      error: function (e) {
        callback({
          status: 'error',
          fails: -1
        });
        console.warn(e);
      }
    });
  } else { // we're disabled

    setTimeout(function () {
      delete disabled[tab.id];
    }, 5000); // remove after 5 seconds
    callback({
      status: 'disabled'
    });
  }
}

var parseResults = function (html) {

  var fails = 0,
    result = {};

  // remove img tags before calling find
  html = html.replace(/<img\b[^>]*>/ig, '');

  var locs = $(html).find('.resultlocation'),
    vals = $(html).find('.resultstatus');

  for (var i = 0; i < locs.length; i++) {
    var value = $(vals[i]).text().toLowerCase();
    result[$(locs[i]).text().toLowerCase()] = value;
    if (value === 'fail') fails++;
  }

  result.status = fails > 2 ? 'block' : 'allow';
  //console.log('result:', locs.length, vals.length, result);
  return result;
}
