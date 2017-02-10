var showLogs = false;

var disabled = {},
  gfw = 'http://www.greatfirewallofchina.org',
  triggers = ['shang+fulin+graft', 'zhang+yannan', 'celestial+empire', 'grass+mud+horse', '草泥'],
  engines = ['^(www\.)*google\.((com\.|co\.|it\.)?([a-z]{2})|com)$', '^(www\.)*bing\.(com)$', 'search\.yahoo\.com$'];

chrome.runtime.onStartup.addListener(function () {
  getTriggersFromLocalStorage();
  updateCheck();
});

chrome.runtime.onInstalled.addListener(function(){
  getTriggersFromLocalStorage();
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  //console.log('onUpdated', tabId, changeInfo, tab);
  if (changeInfo && changeInfo.status == "complete") {
    chrome.tabs.sendMessage(tabId, {
      what: 'tabUpdate',
      url: tab.url
    });
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

  if (request.what === "checkPage") {

    if (typeof disabled[sender.tab.id] !== 'undefined') {

      // setTimeout(function () {
      //   delete disabled[sender.tab.id];
      // }, 5000); // remove after 5 seconds //why?

      callback && callback({
        status: 'disabled'
      });
    }
    
    //ignore chrome pages
    if(request.location.href.indexOf("chrome://") === 0) return;

    var hostRegex = new RegExp(engines.join('|'), 'i'),
        keyvals = keysValues(request.location.href);
        keyword = keyvals.q || keyvals.p;

    if (keyword && keyword.length && hostRegex.test(request.location.host)) {

      var query = decodeURI(keyword.toLowerCase());
     
      if (query.indexOf(" ") > -1) 
        query = query.replace(" ", "+");

      showLogs && console.log('search: ' + query);

      for (var i = 0; i < triggers.length; i++) {

        if (query === triggers[i]) {

          showLogs && console.log('block: ' + query);

          callback({
            status: 'block',
            trigger: query
          });

          return; // got one, we're done
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

  } else if(request.what === "resumePage") {
   
    // remove from disabled-tabId table
    delete disabled[request.tabId];
    //reload the page
    chrome.tabs.reload(request.tabId);
    
  } else if( request.what === "isOnDisabledList" ){
      
      if (typeof disabled[request.tabId] !== 'undefined') {

      callback && callback({
        status: 'disabled'
      });

    }

  }

  return true;

});

/**************************** functions ******************************/

function keysValues(href) {
  
  var vars = [],
    hashes = href.slice(href.indexOf('?') + 1).split(/&|\#/);

  for (var i = 0; i < hashes.length; i++) {
    var hash = hashes[i].split('=');

    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
  }

  return vars;
}

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
    locs, vals, result = {};

  // remove img tags before calling find
  html = html.replace(/<img\b[^>]*>/ig, '');
  locs = $(html).find('.resultlocation');
  vals = $(html).find('.resultstatus');

  for (var i = 0; i < locs.length; i++) {

    var value = $(vals[i]).text().toLowerCase();
    result[$(locs[i]).text().toLowerCase()] = value;
    if (value === 'fail') fails++;
  }

  result.status = fails > 2 ? 'block' : 'allow';
  showLogs && console.log('result:', locs.length, vals.length, result);
  return result;
}

var downloadList = function (callback) {

  $.ajax({
    url: 'https://raw.githubusercontent.com/dhowe/ChinaEye/master/sensitiveKeywords.txt',
    type: 'get',
    success: function (data) {
      showLogs && console.log("Got list: " + data.length);
      callback(data);
    },
    error: function (e) {
      callback && callback({
        status: 'error',
        fails: -1
      });
      console.warn(e);
    }
  });
}

var loadListFromLocal = function (callback) {
  $.ajax({
    url: chrome.runtime.getURL("sensitiveKeywords.txt"),
    type: 'get',
    success: function (data) {
      showLogs && console.log("Load list from Local: " + data.length);
      callback(data);
    },
    error: function (e) {
      callback && callback({
        status: 'error',
        fails: -1
      });
      console.warn(e);
    }
  });
}

var updateCheck = function () {

  var lastCheckTime = chrome.storage.local.get('lastCheckTime', function (data) {

    showLogs && console.log("lastCheckTime", data.lastCheckTime);

    lastCheckTime = Date.parse(data.lastCheckTime);

    var currentTime = Date.now(),
      twelveHours = 5;

    if (currentTime - lastCheckTime < twelveHours) {

      showLogs && console.log("No need to update");

      return;

    } else {

      downloadList(processList);
    }
  });
}

var getTriggersFromLocalStorage = function (rules){
    //if it returns null, loadFrom local copy
    chrome.storage.local.get('list', function (data) {
        if(data.list === undefined) loadListFromLocal(processList);
        else {
          showLogs && console.log("Get triggers from local storage.");
          processTriggers(data.list);
        }
      });

}

var processTriggers = function (rules) {
  for (var index in rules) {

    var rule = rules[index];
    var keywords = rule.replace(/ /g, "+").split("|");
    triggers.push(keywords[0]);
    if (keywords.length > 1)
      triggers.push(keywords[1]);
  }
  showLogs && console.log('Triggers ready.');
}

var processList = function (list) {

  var txtArr = list.split("\n"),
    time = new Date().toLocaleString();

  showLogs && console.log("Check time", time);

  var rules = txtArr.filter(function (line) {
    return /^(?!!|\[).*/.test(line)
  });

  showLogs && console.log("Example", rules[1]);

  chrome.storage.local.set({
    list: rules
  });

  chrome.storage.local.set({
    lastCheckTime: time
  });

  processTriggers(rules);
}
