var ALLPASS = "All servers were able to reach your site. This means that your site should be accessible from within mainland China.";

$(document).ready(function() {

    chrome.tabs.query({

        active: true,
        currentWindow: true

    }, function(tabs) {
        var currentPageUrl = tabs[0].url, currentPageTabId = tabs[0].id;
       
        // ignore chrome urls
        if (/^chrome:/.test(currentPageUrl)) {
          updateButtons(0, 0);
          return;
        }
            
        //ask background about the blockingstatus
        
        chrome.runtime.sendMessage({
            what: "getBlockingStatus",
            tabId: currentPageTabId
          }, function(res){
            updateButtons(currentPageUrl, res);
            displayServerInfo(res);
          });

        //button clicks
        $(".whitelistButtons").click(function() {

          var message = $(this).hasClass("resume") ? "resume" : "disable";
           message += $(this).attr("id") === "disableSite_button" ? "Site" : "Search";
           
          // console.log(message, currentPageUrl);

          chrome.runtime.sendMessage({
            what: message,
            url: currentPageUrl
          });

          window.close();

        })

        $(".modeButtons").click(function() {
           var isRedact = $(this).attr("id") === "infoMode_button" ? false : true;

          chrome.runtime.sendMessage({
            what: "setRedact",
            value: isRedact
          });
          
           $(".modeButtons:disabled").prop('disabled', false);
           $(this).prop('disabled', true);

          window.close();

        })

        $(".modeButtons:enabled").hover(function() {
           $(".modeButtons:disabled").toggleClass("enabled");
        })


    });

});

function displayServerInfo(res) {
  
    if (res.status === "block" && res.servers === undefined) {
        $(".response .status").toggleClass("ok").text("ok");
        $("p.info").text(ALLPASS);
    } else {
       
        var count = 0;
        for (place in res.servers) {
            var placeId = place.replace(" ", "_");
          
            $(".response#" + placeId + " .status").toggleClass(res.servers[place]);
            $(".response#" + placeId + " .status").text(res.servers[place]);
        }

        $("p.info").text(res.info);

    }
}

function updateButtons(tabUrl, status) {

    // console.log(status);
    status = status.status;
    
    /****************************
    No.0 :
    hide server result on browser pages
    ****************************/
    if (status === undefined)
      $('.serverResult').hide();


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



