$(document).ready(function() {

    chrome.tabs.query({

        active: true,
        currentWindow: true

    }, function(tabs) {
        var currentPageUrl = tabs[0].url;
       
        // ignore chrome urls
        if (/^chrome:/.test(currentPageUrl)) {
          updateButtons(0, 0);
          return;
        }
            
        // ask content-script if we are active
        chrome.tabs.sendMessage(tabs[0].id, {
            what: 'isActive',
        }, function(res) {
            updateButtons(currentPageUrl, res && res.active);
        });

        //button clicks
        $(".whitelistButtons").click(function() {

          var message = $(this).hasClass("resume") ? "resume" : "disable";
           message += $(this).attr("id") === "disableSite_button" ? "Site" : "Search";
           
          console.log(message, currentPageUrl);


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


    });

});

function updateButtons(tabUrl, active) {

      /*if we are active, button is set to default text(disable site/search)
      if we are not active, check whether if page is in disabled list
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


  if (active) {

    $('#redactMode_button').prop('disabled', true);

  } else {

   
    chrome.runtime.sendMessage({
         what: "isRedact",
     }, function(res) {
      console.log(res);
        $('#infoMode_button').prop('disabled', !res);
        $('#redactMode_button').prop('disabled', res);
     });


    chrome.runtime.sendMessage({
      what: "isOnWhiteList",
      url: tabUrl
    }, function (res) {
      console.log("isOnWhiteList? ", res);
      if (res && res.status == 'disabled') {
        //change the button text 
        console.log("change button text");

        if(res.lists.indexOf("whiteListedSites") !== -1) {
          $('#disableSite_button').text("Resume for this site");//change i18n class in the future
          $('#disableSite_button').addClass("resume");
        }

        if(res.lists.indexOf("whiteListedSearches") !== -1 &&  $('#disableSearch_button').css('display') !== 'none'){
          $('#disableSearch_button').text("Resume for this search");
          $('#disableSearch_button').addClass("resume");
        } 

      } else {

         $('#disableSite_button').prop('disabled', true);

      }    

    });
  }
}



