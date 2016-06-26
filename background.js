var disabled = {},
  gfw = 'http://www.greatfirewallofchina.org',
  googleRegex = /^(www\.)*google\.((com\.|co\.|it\.)?([a-z]{2})|com)$/i,
  triggers = ['shang+fulin+graft', 'zhang+yannan', 'celestial+empire', 'grass+mud+horse'];

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

  console.log("onMessage:", request.what, request);

  if (request.what === "checkPage") { // from content_script

    var host = request.location.host,
      hash = request.location.hash;

    if (googleRegex.test(host) && hash.indexOf("#q=")===0) {

      var query = hash.substring(3).toLowerCase();

      console.log('google-search: ' + query);

      for (var i = 0; i < triggers.length; i++) {

        if (query === triggers[i].toLowerCase()) {

          console.log('google-block: ' + query);
          callback({
            status: 'block',
            trigger: query
          });
        }
      }
    }

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
