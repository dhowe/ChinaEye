
$(document).ready(function () {

  renderLocales();

  chrome.tabs.query({

    active: true,
    currentWindow: true

  }, function (tabs) {

    var currentPageUrl = tabs[0].url,
      currentPageTabId = tabs[0].id;

    updateMode();
    renderInterface(currentPageUrl, currentPageTabId);

    /**************** Interactions ********************/

    $(".modeButtons").click(modeButtonOnClick);

    $("#recheck_button").click(function () {
      recheckButtonOnClick(currentPageTabId, currentPageUrl, renderInterface);
    });

    $(".modeButtons:enabled").hover(function () {
      $(".modeButtons:disabled").toggleClass("enabled");
    })

    $(".whitelistButtons").click(function () {
      whitelistButtonOnClick(this, currentPageUrl);
    });

    /***************************************************/

  });
});

function recheckButtonOnClick(id, url, callback) {

  clearServerInfo();

  chrome.runtime.sendMessage({
    what: "recheckCurrentPage",
    tabId: id,
    url: url
  }, function () {
    callback(url, id);
  });

}

function whitelistButtonOnClick(current, currentPageUrl) {

  var message = $(current).hasClass("resume") ? "resume" : "disable";
  message += $(current).attr("id") === "disableSite_button" ? "Site" : "Search";

  // console.log(message, currentPageUrl);

  chrome.runtime.sendMessage({
    what: message,
    url: currentPageUrl
  });

  window.close();

}

function modeButtonOnClick() {

  var isRedact = $(this).attr("id") === "infoMode_button" ? false : true;

  chrome.runtime.sendMessage({
    what: "setRedact",
    value: isRedact
  });

  $(".modeButtons:disabled").prop('disabled', false);
  $(this).prop('disabled', true);

  window.close();

}

function renderInterface(currentPageUrl, currentPageTabId) {

  // ignore chrome urls
  if (/^chrome:/.test(currentPageUrl)) {

    updateButtons(0, 0);
    $('.serverResult').hide();
    return;
  }

  // ask background about blockingstatus
  // might takes some time if blockingstatus doesn't already exist

  chrome.runtime.sendMessage({

    what: "getBlockingStatus",
    tabId: currentPageTabId,
    url: currentPageUrl
  }, function (res) {

    if (res) {

      updateButtons(currentPageUrl, res);
      displayServerInfo(res);

      if (res.trigger != undefined){
        var keyword = res.trigger.replace(/\+/g, " ");
        displayKeywordInfo(keyword);
      }

    } else {
      // ask again if res is not ready
      // setInterval(function(){
      //   renderInterface(currentPageUrl, currentPageTabId);
      // }, 1000);
    }
  });

}

function displayKeywordInfo(keyword) {

  $(".keywordResult").show();
  $(".blockedKeyword span#keywordArea").html(keyword);
}

function clearServerInfo() {

  $(".response .status").html('<img src="img/loader.gif" alt="">').attr('class','status');
  $("#recheck_button").prop('disabled', true);
  $(".info").html("");
}

function renderLocales() {
    var elems, n, i, elem, text;

    elems = document.querySelectorAll('[data-i18n]');
    n = elems.length;
    for ( i = 0; i < n; i++ ) {
        elem = elems[i];
        text = chrome.i18n.getMessage(elem.getAttribute('data-i18n'));
        if ( !text ) {
            continue;
        }
        $(elem).text(text);
    }
}

function displayServerInfo(res) {
  if (res === undefined)
    return;
  if (res && (res.status === undefined || res.status === "disabled" )) {
    //error or disabled
    $('.serverResult').hide();
  }

  if (res.status === "block" && res.servers === undefined) {
    //blocked by searchkeyword
    $(".response .status").addClass("ok").text("ok");
    $("p.info").text($("#popupServerInfoOk").text());

  } else {
    var count = 0;
    if (res.servers != undefined) {
      for (place in res.servers) {
        
        var placeId = place.replace(" ", "_"),
          result = res.servers[place];

        $(".response#" + placeId + " .status").text(result);

        if (result === "ok" || result === "fail")
          $(".response#" + placeId + " .status").addClass(result);
        else if (result.length > 0)
          $(".response#" + placeId + " .status").addClass("yellow");
      }

    }
  }

  if (res.info && res.info.startsWith("No server")) $("p.info").text($("#popupServerInfoFail").text());
  else $("p.info").text(res.info);

  $("#recheck_button").prop('disabled', false);
}

function updateMode() {

  /****************************
  ask background page if page is in Redact or Info Mode
  ****************************/

  chrome.runtime.sendMessage({
    what: "isRedact",
  }, function (res) {

    $('#infoMode_button').prop('disabled', !res);
    $('#redactMode_button').prop('disabled', res);
  });

}

function updateButtons(tabUrl, res) {

  var status, trigger;

  if (res) {
    status = res.status;
    trigger = res.trigger;
  }

  /****************************
  No.1 :
  if the page is blocked and if it is blocked by search keyword
    show disableSearch button
  ****************************/

  if (status === "block" && trigger != undefined) {

    $('#disableSearch_button').show();
  }

  /****************************
   No.3 :
    if the page is disabled,
    check the exact whitelist:
       if it is on whiteListedSites
         -> change the button text to "Resume for this site"
       if it is on whitelistedSearches
         -> change the button text to "Resume for this search"
   ****************************/

  if (status === "disabled") {

    chrome.runtime.sendMessage({
      what: "isOnWhiteList",
      url: tabUrl

    }, function (whitelist) {

      // console.log("isOnWhiteList? ", whitelist);
      if (whitelist && whitelist.status == 'disabled') {

        // change the button text
        // console.log("change button text");
        if (whitelist.lists.indexOf("whiteListedSites") !== -1) {

          // TODO: change to i18n class
          $('#disableSite_button').text("Resume for this site").addClass("resume").show();
          $('.serverResult').hide(); //hide server result if the site is disabled
        }

        if (whitelist.lists.indexOf("whiteListedSearches") !== -1) {

          $('#disableSearch_button').text("Resume for this search").addClass("resume").show();
        }
      }
    });
  }

  /****************************
   No.4 :
   if the page is allowed/undefined
   disable "disable site" button
  ****************************/
  // Disable should always be allowed: see #64
  //if (status === "allow")
    //$('.whitelistButtons').prop('disabled', true);

}
