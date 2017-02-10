document.addEventListener('DOMContentLoaded', function () {

  var button = document.querySelector('#rd_button');

  chrome.tabs.query({
    active: true,
    currentWindow: true

  }, function (tabs) {

    // ignore chrome urls
    if (/^chrome:/.test(tabs[0].url))
      return updateButton(button, 0, 0);

    // ask content-script if we are active
    chrome.tabs.sendMessage(tabs[0].id, {
      what: 'isActive',
    }, function (res) {
      //console.log('isActive?',res);
      updateButton(button, tabs[0].id, !res || res.active);
    });
  });
});


function updateButton(button, tabId, on) {

  console.log('updateButton', on);

  //if we are active - button:disable on this page
  //if we are not active, check whether the page is in the disabled list
  //if yes, - button: Resume on this Page

  if (on) {
      button.disabled = false;
      button.innerHTML = 'Disable ChinaEye on this page';
  } else {
      chrome.runtime.sendMessage({
          what: "isOnDisabledList",
          tabId: tabId
      }, function(res) {

          if (res && res.status == 'disabled') {
              button.disabled = false;
              button.innerHTML = 'Resume ChinaEye on this Page';
          } 
          else
              button.disabled = !on;
      });

  }
  

  button.addEventListener('click', function () {

    var message = (on ? "disablePage" : "resumePage");

    chrome.runtime.sendMessage({
      what: message,
      tabId: tabId
    });

    window.close();

  });

}
