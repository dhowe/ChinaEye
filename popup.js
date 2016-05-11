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
      what: "isActive"
    }, function (res) {
      updateButton(button, tabs[0].id, !res || res.active);
    });
  });
});

// enable the button if we are active
function updateButton(button, tabId, on) {

  button.disabled = !on;
  button.innerHTML = (on ? 'Disable on this page' : 'Disabled');

  on && button.addEventListener('click', function () {

    chrome.runtime.sendMessage({
      what: "refresh",
      tabId: tabId
    });

    window.close();
  });
}
