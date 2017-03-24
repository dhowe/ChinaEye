var ALLPASS = "All servers were able to reach your site. This means that your site should be accessible from within mainland China.";

$(document).ready(function() {

    chrome.tabs.query({

        active: true,
        currentWindow: true

    }, function(tabs) {
        var currentPageUrl = tabs[0].url, currentPageTabId = tabs[0].id;
       
        updateMode();
        renderInterface(currentPageUrl, currentPageTabId);
        

        //button clicks
        $(".whitelistButtons").click(function() {
           whitelistButtonOnClick(currentPageUrl);
        });

        $(".modeButtons").click(modeButtonOnClick);

        $(".modeButtons:enabled").hover(function() {
           $(".modeButtons:disabled").toggleClass("enabled");
        })


    });

});

function whitelistButtonOnClick(currentPageUrl) {
    var message = $(this).hasClass("resume") ? "resume" : "disable";
    message += $(this).attr("id") === "disableSite_button" ? "Site" : "Search";

    // console.log(message, currentPageUrl);

    chrome.runtime.sendMessage({
        what: message,
        url: currentPageUrl
    });

    window.close();

}

function modeButtonOnClick () {
    var isRedact = $(this).attr("id") === "infoMode_button" ? false : true;

    chrome.runtime.sendMessage({
        what: "setRedact",
        value: isRedact
    });

    $(".modeButtons:disabled").prop('disabled', false);
    $(this).prop('disabled', true);

    window.close();

}

function renderInterface (currentPageUrl, currentPageTabId) {
    // ignore chrome urls
    if (/^chrome:/.test(currentPageUrl)) {
      updateButtons(0, 0);
      $('.serverResult').hide();
      return;
    }

    //ask background about the blockingstatus
    //might takes a long time if blockingstatus doesn't already exist

    chrome.runtime.sendMessage({
        what: "getBlockingStatus",
        tabId: currentPageTabId,
        url: currentPageUrl
    }, function(res) {
        if (res != undefined) {
            updateButtons(currentPageUrl, res);
            displayServerInfo(res);
        }
        else {
          //ask again if res is not ready
          // setInterval(function(){
          //   renderInterface(currentPageUrl, currentPageTabId);
          // }, 1000);

        }
    });

}

function displayServerInfo (res) {
    if (res === undefined)
      return;
    if(res && res.status === undefined) {
       //error
       $('ul').hide();
    }
    if (res.status === "block" && res.servers === undefined) {
        //blocked by searchkeyword
        $(".response .status").toggleClass("ok").text("ok");
        $("p.info").text(ALLPASS);
    } else {
        var count = 0;
        if (res.servers != undefined) {
            for (place in res.servers) {
                var placeId = place.replace(" ", "_"),
                    result = res.servers[place];

                $(".response#" + placeId + " .status").text(result);

                if (result === "ok" || result === "fail")
                    $(".response#" + placeId + " .status").toggleClass(result);
                else if (result.length > 0)
                    $(".response#" + placeId + " .status").toggleClass("yellow");
            }
        }
    }

    $("p.info").text(res.info);
}

function updateMode () {
    /****************************
    No.1 :
    ask background page, 
    whether the page is on Redact or Info Mode
    ****************************/

    chrome.runtime.sendMessage({
        what: "isRedact",
    }, function(res) {
        // console.log(res);
        var infoMode = !res;
        $('#infoMode_button').prop('disabled', infoMode);
        $('#redactMode_button').prop('disabled', res);
    });

}

function updateButtons (tabUrl, status) {
    
    if(status) status = status.status;

    /****************************
    No.2 :
    if the page is blocked/disabled
    check whether it is on search Engine, 
    if yes, show disableSearch button
    ****************************/
    if (status != "allow") {
       //disable or block
        chrome.runtime.sendMessage({
            what: "isOnSearchResultPage",
            url: tabUrl
        }, function(res) {
            if (res) $('#disableSearch_button').show();
        });
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
        }, function(whitelist) {
            // console.log("isOnWhiteList? ", whitelist);
            if (whitelist && whitelist.status == 'disabled') {
                //change the button text 
                // console.log("change button text");
                if (whitelist.lists.indexOf("whiteListedSites") !== -1) {
                    $('#disableSite_button').text("Resume for this site"); //change i18n class in the future
                    $('#disableSite_button').addClass("resume");
                }

                if (whitelist.lists.indexOf("whiteListedSearches") !== -1 && $('#disableSearch_button').css('display') !== 'none') {
                    $('#disableSearch_button').text("Resume for this search");
                    $('#disableSearch_button').addClass("resume");
                }

            } else {
               
                if (status.status == 'allow')
                    $('.whitelistButtons').prop('disabled', true);

            }

        });
    } else if( status === "allowed" || status === undefined){

        /****************************
         No.4 :
         if the page is allowed/undefined
         disable "disable site" button
        ****************************/

        $('.whitelistButtons').prop('disabled', true);
    }
}



