var showLogs = false;
var firstRun = true;

var disabled = {},
    gfw = 'http://www.greatfirewallofchina.org',
    qRegex = /q=([^&#]*)|p=([^&#]*)/g,
    regexes = ['^(www\.)*google\.((com\.|co\.|it\.)?([a-z]{2})|com)$','^(www\.)*bing\.(com)$','^(([a-z]{2})\.search)|search\.yahoo\.com$'],
    hostRegex = new RegExp(regexes.join("|"), "i"),
    triggers = ['shang+fulin+graft', 'zhang+yannan', 'celestial+empire', 'grass+mud+horse','草泥'];

chrome.runtime.onInstalled.addListener(function(event) {
    init(event);
});

chrome.runtime.onStartup.addListener(function(event) {

    if(firstRun){
      init(event);
      firstRun = false;
    }
    else {
      loadList();
      // updateList();
    };

});

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

  showLogs && console.log("onMessage:", request.what, request);

  if (request.what === "checkPage") { // from content_script

    if (typeof disabled[sender.tab.id] !== 'undefined') {

      setTimeout(function () {
        delete disabled[sender.tab.id];
      }, 5000); // remove after 5 seconds

      callback({
        status: 'disabled'
      });
    }

    // do we have a search, check the query term
    var queryString = request.location.search;
        host = request.location.host;
        keyword = request.location.hash.substring(3) || queryString.match(qRegex)[0].substring(2);

    showLogs && console.log("query",queryString,"host",host,"keyword",keyword);
    showLogs && console.log("search engine?",hostRegex.test(host));  

    if (hostRegex.test(host) && keyword !== null) {

      var query = decodeURI(keyword.toLowerCase());
      showLogs && console.log('search: ' + query);

      for (var i = 0; i < triggers.length; i++) {

        if (query === triggers[i].toLowerCase()) {

          showLogs && console.log('block: ' + query);
          callback({
            status: 'block',
            trigger: query
          });
          return true;
        }
      }

    }

    // otherwise check with china servers
    checkPage(sender.tab, callback);

  } else if (request.what === "disablePage") { // from popup

    // add to disabled-tabId table
    disabled[request.tabId] = true;

    // and reload (will trigger content-script and be ignored)
    chrome.tabs.reload(request.tabId);
  }

  return true;
});

/**************************** functions ******************************/

var checkPage = function (tab, callback) {

  showLogs && console.log('checkPage:', tab.url);

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

var processTriggers = function(rules) {
    for(var index in rules){
      var rule = rules[index];
      var keywords = rule.replace(/ /g,"+").split("|");
      triggers.push(keywords[0]);
      if(keywords.length>1) triggers.push(keywords[1]);
    }
    showLogs && console.log('Triggers ready.');
}

var loadList = function(callback) {

    $.ajax({
       url : 'https://raw.githubusercontent.com/dhowe/ChinaEye/master/sensitiveKeywords.txt',
       type : 'get',
       success: function (data) {
         showLogs && console.log("Successfully get the list");
         callback(processList(data));
       },
       error: function (e) {
          callback({
            status: 'error',
            fails: -1
          });
          console.warn(e);
       }
  });

}

function processList(list) {

  var txtArr = list.split("\n");

  var versionInfo = txtArr.filter(function (line) {
    return /^! Version:(.*)/.test(line)});
  if(versionInfo && versionInfo.length > 0) 
    var version = versionInfo[0].match(/^! Version:(.*)/)[1];
  showLogs && console.log("version",version);

  var rules = txtArr.filter(function (line) {
    return /^(?!!|\[).*/.test(line)
  });

  showLogs && console.log("Example",rules[1]);

  chrome.storage.local.set({ 'list': {
    version : version,
    rules : rules
  } });
  
  processTriggers(rules);
}

var init = function(event) {
  loadList();
}

