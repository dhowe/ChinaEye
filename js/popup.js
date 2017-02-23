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
  var infoMode;

      /*if the page is blocked, button is set to default text(disable site/search)
      if not, check whether if page is in disabled list
          if yes, button:resume on this Page
          if not, disable the button*/

     //if we are blocking the page && it is from a search engine
     //show disable search button

     chrome.runtime.sendMessage({
         what: "isOnSearchResultPage",
         url: tabUrl
     }, function(res) {
         if (res) $('#disableSearch_button').show();
     });

  // console.log("Status?", status);

  if (status === "block") {

    $('#redactMode_button').prop('disabled', true);

  } else {
   
    chrome.runtime.sendMessage({
         what: "isRedact",
     }, function(res) {
        // console.log(res);
        infoMode = !res;
        $('#infoMode_button').prop('disabled', infoMode);
        $('#redactMode_button').prop('disabled', res);
     });
   
    chrome.runtime.sendMessage({
      what: "isOnWhiteList",
      url: tabUrl
    }, function (res) {
      // console.log("isOnWhiteList? ", res.status, infoMode);
      if (res && res.status == 'disabled') {
        //change the button text 
        // console.log("change button text");
        if(res.lists.indexOf("whiteListedSites") !== -1) {
          $('#disableSite_button').text("Resume for this site");//change i18n class in the future
          $('#disableSite_button').addClass("resume");
        }

        if(res.lists.indexOf("whiteListedSearches") !== -1 &&  $('#disableSearch_button').css('display') !== 'none'){
          $('#disableSearch_button').text("Resume for this search");
          $('#disableSearch_button').addClass("resume");
        } 

      } else {
         // console.log("disable button");
         $('.whitelistButtons').prop('disabled', true);

      }    

    });
  }
}



