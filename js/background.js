var logs = 0,
  isRedact = true;

var gfw = 'http://www.greatfirewallofchina.org',
  triggers = new Set(['zhang+yannan', 'celestial+empire', 'grass+mud+horse', 'grassmudhorse', '草泥']),
  engines = ['^(www\.)*google\.((com\.|co\.|it\.)?([a-z]{2})|com)$', '^(www\.)*bing\.(com)$', 'search\.yahoo\.com$'],
  listUrl = 'https://raw.githubusercontent.com/dhowe/ChinaEye/master/sensitiveKeywords.txt',
  hostRegex = new RegExp(engines.join('|'), 'i'),
  cacheTimeout = 1000 * 60 * 5; // 5 min

chrome.runtime.onStartup.addListener(function () {
  getTriggersFromLocalStorage();
  updateCheck();
  clearBlockingStatus();
});

chrome.runtime.onInstalled.addListener(function () {

  loadListFromLocal(processList);

  chrome.storage.local.set({
    "whitelistedSites": [""],
    "whitelistedSearches": [""],
    "tabsBlockingStatus": {}
  });

  injectContentScriptToAllTabs();
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {

  // console.log('onUpdated', tabId, changeInfo, tab);
  if (changeInfo && changeInfo.status == "complete") {

    chrome.tabs.sendMessage(tabId, {
      what: 'tabUpdate',
      url: tab.url
    });

    updateBadge(tabId);
  }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {

  updateBadge(activeInfo.tabId);

});

chrome.tabs.onRemoved.addListener(function (tabId) {

  removeBlockingStatus(tabId);
});

/**************************** Messaging ******************************/

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

  logs && console.log("Request: " + request.what);

  if (request.what === "checkPage") {

    //DISABLED
    //1.on disabled list
    //2.chrome page

    isOnWhiteList(request.location.href, function (result) {

      if (result.status === "disabled" || request.location.href.indexOf("chrome://") === 0) {

        logs && console.log("The Page is disabled");

        setBlockingStatus(sender.tab.id, request.location.href, request.location.host, {
          status: 'disabled'
        });

        callback && callback({
          status: 'disabled'
        });

        return;

      } else {

        checkPage(sender.tab, request.location, callback);
      }
    });

  } else if (request.what === "disableSite" || request.what === "disableSearch" ||
    request.what === "resumeSite" || request.what === "resumeSearch") {

    // from popup button

    var processButton;

    switch (request.what) {
    case "disableSite":
      processButton = setSiteToWhitelist;
      break;
    case "disableSearch":
      processButton = setSearchToWhitelist;
      break;
    case "resumeSite":
      processButton = removeSiteFromWhitelist;
      break;
    case "resumeSearch":
      processButton = removeSearchFromWhitelist;
      break;
    }
    // console.log("processButton", request.url);
    processButton(request.url);

    // and reload (will trigger content-script and be ignored)
    setIcon(request.tabId, "disabled");
    chrome.tabs.reload(request.tabId);

  } else if (request.what === "recheckCurrentPage") {

    Cache.clear(key);
    chrome.tabs.get(request.tabId, function (tab) {
      checkPage(tab, null, callback);
    });

  } else if (request.what === "setRedact") {

    isRedact = request.value;
    reloadAllTabs();

  } else if (request.what === "isOnWhiteList") {

    isOnWhiteList(request.url, callback);

  } else if (request.what === "getBlockingStatus") {

    getBlockingStatus(request.tabId, request.url, function (result) {

      if (result != undefined) {

        //Case 1: not search engine, same host
        //Case 2: search engine, same url
        var host = getHostNameFromURL(request.url),
          isSearchEngine = hostRegex.test(host);
        if ((!isSearchEngine && host === result.host) || (isSearchEngine && request.url === result.tabUrl)) {
          callback(result);
        }
        else {
          // console.log(request.url,result.tabUrl);
          chrome.tabs.get(request.tabId, function (tab) {
            checkPage(tab, null, callback);
          });
        }
      }

    });

  } else if (request.what === "isRedact") {

    callback && callback(isRedact);

  } else if (request.what === "isOnSearchResultPage") {

    var isSearchEngine = hostRegex.test(getHostNameFromURL(request.url));
    var key = getSearchKeywordFromURL(request.url);
    callback && callback(isSearchEngine && key);
  }

  return true;
});

/**************************** functions ******************************/

function normalizeUrl(url) {  // not used?

  //remove protocal
  if (url === undefined) return undefined;

  result = url.replace(/(^\w+:|^)\/\//, '');
  return result;
}

function injectContentScriptToAllTabs() {

  chrome.tabs.query({
    currentWindow: true
  }, function(result) {
      for (var key in result) {
          var tab = result[key];

          if (tab.id && tab.url) injectContentScript(tab.id);
      }
  });

}

function injectContentScript(tabId) {

    var details = {
        file: "js/content.js",
        runAt: "document_idle"
    };

    chrome.tabs.executeScript(tabId, details);
}

function reapplyStyle(tabId, res) {
    logs && console.log("reapplyStyle", tabId, res);
    chrome.tabs.sendMessage(tabId, {
        what: "reapplyStyle",
        res: res
    });
}

function reloadAllTabs() {

  chrome.tabs.query({
    currentWindow: true
  }, function (result) {

    for (var key in result) {
      var tab = result[key];
      if (tab.url != undefined) chrome.tabs.reload(tab.id);
    }

  });

}

function keysValues(href) {

  var vars = [],
    hashes;

  if (href) hashes = href.slice(href.indexOf('?') + 1).split(/&|\#/);
  if (hashes === undefined) return null;

  for (var i = 0; i < hashes.length; i++) {
    var hash = hashes[i].split('=');

    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
  }

  return vars;
}

function getSearchKeywordFromURL(url) {

  var keyvals = keysValues(url),
    keyword, result;
  if (keyvals) keyword = keyvals.q || keyvals.p;
  if (keyword) result = decodeURI(keyword.toLowerCase());

  if (result && result.indexOf(" ") > -1)
    result = result.replace(" ", "+");
  
  //trim extra +
  if (result.slice(-1) === "+")
    result = result.slice(0, result.length-1); 
  
  return result;
}

var getHostNameFromURL = function (url) {

  if (typeof url != "string") return null;
  var matches = url.match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
  var domain = matches && matches[1];
  return domain;
}

function isOnWhiteList(targetUrl, callback) {

  //Check whether the targetUrl is on WhiteList

  var host = getHostNameFromURL(targetUrl);
  var lists = [];

  chrome.storage.local.get(["whitelistedSites", "whitelistedSearches"], function (result) {
    // console.log(result.whitelistedSites,result.whitelistedSearches);

    if (host && result.whitelistedSites.length > 0) {
      for (let listItem of result.whitelistedSites) {
        if (listItem === host) lists.push("whiteListedSites");
      }
    }

    if (host && hostRegex.test(host)) {
      var key = getSearchKeywordFromURL(targetUrl);
      for (let listItem of result.whitelistedSearches) {
        if (listItem === key) lists.push("whiteListedSearches");
      }
    }

    if (lists.length > 0) {

      callback && callback({
        status: 'disabled',
        lists: lists
      });

    } else {
      callback && callback({
        status: 'notDisabled'
      });
    }

  });
}

function setSiteToWhitelist(targetUrl) {
  setEntryToList(getHostNameFromURL(targetUrl), "whitelistedSites");
}

function setSearchToWhitelist(targetUrl) {
  setEntryToList(getSearchKeywordFromURL(targetUrl), "whitelistedSearches");
}

function removeSiteFromWhitelist(targetUrl) {
  removeEntryFromList(getHostNameFromURL(targetUrl), "whitelistedSites");
}

function removeSearchFromWhitelist(targetUrl) {
  removeEntryFromList(getSearchKeywordFromURL(targetUrl), "whitelistedSearches");
}

function setEntryToList(entry, list) {

  chrome.storage.local.get(list, function (result) {
    var data = result[list];
    data.push(entry);
    var item = {};
    item[list] = data;
    chrome.storage.local.set(item);
  });

}

function removeEntryFromList(entry, list) {

  chrome.storage.local.get(list, function (result) {
    var data = result[list];
    data.splice(data.indexOf(entry), 1);
    var item = {};
    item[list] = data;
    chrome.storage.local.set(item);

  });

}

function setBlockingStatus(tabId, tabUrl, host, status) {

  logs && console.log("setBlockingStatus", tabId, tabUrl, host, status);
  chrome.storage.local.get("tabsBlockingStatus", function (result) {
    result = result.tabsBlockingStatus;
    var items = status;
    items["tabUrl"] = tabUrl;
    items["host"] = host;
    result[tabId.toString()] = items;
    chrome.storage.local.set({
      "tabsBlockingStatus": result
    });

  });
}

function removeBlockingStatus(tabId) {

  chrome.storage.local.get("tabsBlockingStatus", function (result) {
    result = result.tabsBlockingStatus;
    delete result[tabId];
    chrome.storage.local.set({
      "tabsBlockingStatus": result
    });
  });
}

function getBlockingStatus(tabId, tabUrl, callback) {

  //get the blocking status from record
  chrome.storage.local.get("tabsBlockingStatus", function (result) {

    var target = result.tabsBlockingStatus[tabId];
    if (target !== undefined) {
      callback(target);
    } else {
    
      chrome.tabs.get(tabId, function (tab) {
        checkPage(tab, null, function(result) {
          //check content script
          //if the result doesn't match/ reapplyStyle
           chrome.tabs.sendMessage(tabId, {what: "isActive"}, function(isActive) {
            if(result.status === "block" ^ isActive )
              reapplyStyle(tabId, result);
            
            callback(result);

           });
          
        });
      });

    }
  });

}

function clearBlockingStatus() {

  chrome.storage.local.set({
    "tabsBlockingStatus": {}
  });
}

var setIcon = function (tabId, iconStatus, origin) {

  if (tabId === 0) {
    return;
  }

  var onIconReady = function () {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
      return;
    } else {
      //tab exists
    }
  };

  var iconPaths;

  switch (iconStatus) {
  case 'block':
    iconPaths = {
      '16': 'img/blocked16.png',
      '32': 'img/blocked32.png'
    };
    break;
  case 'disabled':
    iconPaths = {
      '16': 'img/disabled16.png',
      '32': 'img/disabled32.png'
    };
    break;
  default: //on
    iconPaths = {
      '16': 'img/icon16.png',
      '32': 'img/icon32.png'
    };
  }

  // console.log("SetIcon:" + iconStatus + "; From:" + origin);
  chrome.browserAction.setIcon({
    tabId: tabId,
    path: iconPaths
  }, onIconReady);
}

var updateBadge = function (tabId) {

  //add time out for setBlcokingStatus when Page is refreshed
  setTimeout(function () {
    getBlockingStatus(tabId, "", function (result) {
      if (result) setIcon(tabId, result.status, "updateBadge");
    });
  }, 500);

}

/**************************** core ******************************/

var checkServer = function (tab, url, host, count, callback) {

  var handleResult = function (result) {

    Cache.set(host, result, cacheTimeout);

    result['redact'] = isRedact;
    setBlockingStatus(tab.id, url, host, result);
    setIcon(tab.id, result.status, "checkServer");
    return result;
  }

  var onSuccess = function (data) {

    return handleResult(parseResults(data));
  }

  //chrome newtab
  if (url && url.indexOf("/chrome/newtab?") != -1)
    url = url.split("/chrome/newtab?")[0];

  var result = Cache.get(url);
  if (result) {

    logs && console.log('checkPage(cache):', host);
    return handleResult(result);
  }

  logs && console.log('checkPage(server):', host);

  $.ajax(gfw + '/index.php?siteurl=' + host, {
    success: function (data) {
      if (data.indexOf("An error occured - please try again later.") > -1) {
        // console.log(data);
        if (count === 0) {
          logs && console.log("An error occured, Retry");
          checkServer(tab, url, host, 1, callback);
        }

      } else {
        callback && callback(onSuccess(data));
      }

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

var checkPage = function (tab, location, callback) {

  var url = location ? location.href : tab.url,
    host = location ? location.host : getHostNameFromURL(tab.url);

  if (hostRegex.test(host)) {

    var keyword = getSearchKeywordFromURL(url);

    if (keyword && keyword.length) {

      logs && console.log('search: ' + keyword);

      //for (var i = 0; i < triggers.length; i++) {
      for (let trigger of triggers) {

        if (keyword === trigger) {

          logs && console.log('block: ' + keyword);

          setBlockingStatus(tab.id, url, host, {
            status: 'block',
            trigger: keyword
          });

          setIcon(tab.id, "block", "checkPage");

          callback({
            status: 'block',
            trigger: keyword,
            redact: isRedact
          });

          return true; // got one, we're done
        }
      }
    }
  }

  checkServer(tab, url, host, 0, callback);
}

var parseResults = function (html) {

  var fails = 0,
    locs, vals, result = {};

  // remove img tags before calling find
  html = html.replace(/<img\b[^>]*>/ig, '');
  locs = $(html).find('.resultlocation');
  vals = $(html).find('.resultstatus');

  if (locs.length === 0 && vals.length === 0) {
    //check whether it is an error message
    var container = $(html).find('#contentContainer div');
    if ($(container[0]).text().indexOf("error") > -1) {

      result.info = "An error occured - please try again later.";
    }

    return result;
  }

  result.servers = {};

  for (var i = 0; i < locs.length; i++) {

    var value = $(vals[i]).text().toLowerCase();
    result.servers[$(locs[i]).text().toLowerCase()] = value;
    if (value === 'fail') fails++;
  }

  result.status = fails > 2 ? 'block' : 'allow';
  result.info = $(html).find(".uitleg td").text();

  logs && console.log('parsed-result:', locs.length, vals.length, result);

  return result;
}

var downloadList = function (callback) {

  $.ajax({
    url: listUrl,
    type: 'get',
    success: function (data) {
      logs && console.log("Got list from: " + listUrl + " " + data.length);
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
      logs && console.log("Load list from Local: " + data.length + ' entries');
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

    logs && console.log("lastCheckTime", data.lastCheckTime);

    lastCheckTime = Date.parse(data.lastCheckTime);

    var currentTime = Date.now(),
      twelveHours = 1000 * 60 * 60 * 12,
      checkInterval = twelveHours;

    if (currentTime - lastCheckTime < checkInterval) {

      logs && console.log("No need to update");

      return;

    } else {

      downloadList(processList);
    }
  });
}

var getTriggersFromLocalStorage = function (rules) {

  //if it returns null, loadFrom local copy
  chrome.storage.local.get('list', function (data) {
    if (data.list === undefined) loadListFromLocal(processList);
    else {
      logs && console.log("Get triggers from local storage: ", data.list.length);
      processTriggers(data.list);
    }
  });

}

var onExtensionStartup = function () {
  getTriggersFromLocalStorage();
  injectContentScriptToAllTabs();
}

var processTriggers = function (rules) {

  if (!rules || !rules.length) console.warn('Null rules', rules);

  for (var index in rules) {

    var rule = rules[index];

    if (typeof rule !== "string") continue;

    var keywords = rule.replace(/ /g, "+").split("|");

    if (isValid(keywords[0], triggers))
      triggers.add(keywords[0]);

    if (keywords.length > 1 && isValid(keywords[1], triggers))
      triggers.add(keywords[1]);
  }

  logs && console.log(triggers.size + ' triggers loaded/processed', triggers);
}

var isValid = function (trigger, list) {

  var ok = typeof trigger === 'string' && trigger.length; // && !list.contains(trigger);

  //if (!ok && logs) console.warn('Bad: "'+trigger+'"');

  return ok;
}

var processList = function (list) {

  var txtArr = list.split("\n"),
    time = new Date().toLocaleString();

  logs && console.log("Check time", time);

  var rules = txtArr.filter(function (line) {
    return /^(?!!|\[).*/.test(line)
  });

  logs && console.log("Example:", rules[1]);

  chrome.storage.local.set({
    list: rules
  });

  chrome.storage.local.set({
    lastCheckTime: time
  });

  processTriggers(rules);
}

var Cache = {

  cacheData: {},

  get: (key) => {
    if (Cache.cacheData.hasOwnProperty(key) && Cache.cacheData[key].val) {
      return Cache.cacheData[key].val;
    }
    return false;
  },

  set: (key, value, expiry) => {

    Cache.clear(key);

    var to = false;
    if (expiry && parseInt(expiry) > 0) {
      to = setTimeout(function () {
        Cache.clear(key);
      }, parseInt(expiry));
    }

    Cache.cacheData[key] = {
      expiry: expiry,
      val: value,
      timeout: to,
    };
  },

  clear: (key) => {

    if (Cache.cacheData.hasOwnProperty(key)) {
      if (Cache.cacheData[key].to) {
        clearTimeout(Cache.cacheData[key].to);
      }

      delete Cache.cacheData[key];
      return true;
    }

    return false;
  },
};

/**************************** polyfill ******************************/

if (Array.prototype.contains instanceof Function === false) {

  Array.prototype.contains = function (a) {
    var b = this.length;
    while (b--) {
      if (this[b] === a) {
        return true;
      }
    }
    return false;
  };
}

if (String.prototype.startsWith instanceof Function === false) {
  String.prototype.startsWith = function (needle, pos) {
    if (typeof pos !== 'number') {
      pos = 0;
    }
    return this.lastIndexOf(needle, pos) === pos;
  };
}

if (String.prototype.endsWith instanceof Function === false) {
  String.prototype.endsWith = function (needle, pos) {
    if (typeof pos !== 'number') {
      pos = this.length;
    }
    pos -= needle.length;
    return this.indexOf(needle, pos) === pos;
  };
}

if (String.prototype.includes instanceof Function === false) {
  String.prototype.includes = function (needle, pos) {
    if (typeof pos !== 'number') {
      pos = 0;
    }
    if (start + search.length > this.length)
      return false;
    return this.indexOf(needle, pos) > -1;
  };
}
/******************************************************************************/

onExtensionStartup();

/******************************************************************************/
