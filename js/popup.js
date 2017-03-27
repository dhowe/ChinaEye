var ALLPASS = "All servers were able to reach this site. It should be accessible from within mainland China.";

$(document).ready(function () {

  chrome.tabs.query({

    active: true,
    currentWindow: true

  }, function (tabs) {

    var currentPageUrl = tabs[0].url,
      currentPageTabId = tabs[0].id;

    updateMode();
    renderInterface(currentPageUrl, currentPageTabId);

    /**************Interactions********************/

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

    /**********************************************/

  });
});

function recheckButtonOnClick(id, url, callback) {

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

  // ask background about the blockingstatus
  // might takes a long time if blockingstatus doesn't already exist

  chrome.runtime.sendMessage({
    what: "getBlockingStatus",
    tabId: currentPageTabId,
    url: currentPageUrl
  }, function (res) {
    // console.log(res);
    if (res != undefined) {
      updateButtons(currentPageUrl, res);
      displayServerInfo(res);
    } else {
      // ask again if res is not ready
      // setInterval(function(){
      //   renderInterface(currentPageUrl, currentPageTabId);
      // }, 1000);

    }
  });

}

function displayServerInfo(res) {
  if (res === undefined)
    return;
  if (res && res.status === undefined) {
    //error
    $('ul').hide();
  }

  $(".response .status").attr('class', 'status');

  if (res.status === "block" && res.servers === undefined) {
    //blocked by searchkeyword
    $(".response .status").addClass("ok").text("ok");
    $("p.info").text(ALLPASS);
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

  $("p.info").text(res.info);
}

function updateMode() {

  /****************************
  ask background page,
  whether the page is on Redact or Info Mode
  ****************************/

  chrome.runtime.sendMessage({
    what: "isRedact",
  }, function (res) {
    // console.log(res);
    var infoMode = !res;
    $('#infoMode_button').prop('disabled', infoMode);
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
        //change the button text
        // console.log("change button text");
        if (whitelist.lists.indexOf("whiteListedSites") !== -1) {
          $('#disableSite_button').text("Resume for this site"); //change i18n class in the future
          $('#disableSite_button').show().addClass("resume");
          $('.serverResult').hide(); //hide server result if the site is disabled
        }

        if (whitelist.lists.indexOf("whiteListedSearches") !== -1) {
          $('#disableSearch_button').text("Resume for this search");
          $('#disableSearch_button').show();
          $('#disableSearch_button').addClass("resume");
        }

      }
    });
  }

  /****************************
   No.4 :
   if the page is allowed/undefined
   disable "disable site" button
  ****************************/

  if (status === "allow")
    $('.whitelistButtons').prop('disabled', true);

}
