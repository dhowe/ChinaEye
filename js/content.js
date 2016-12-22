var url = location.href; // store original

console.log('content.js: ' + url);

if (document.querySelector('#rd_style') === null) {

  sendCheckPage();
}

function sendCheckPage() {

  chrome.runtime.sendMessage({
    what: "checkPage",
    location: location
  }, postCheckPage);
}

function postCheckPage(res) {

  if (res && res.status === 'block') {

    console.log("block");

    // Create text for the CSS we need for our font
    var redact, fontFace = '@font-face { font-family: Redacted; src: url("' +
      chrome.extension.getURL('fonts/redacted-regular.woff') + '"); }';

    // Create style tags and inject them into the page
    $("<style id='rd_style' type='text/css'>")
      .html(fontFace)
      .appendTo("head");

    $("<style id='rd_img_style 'type='text/css'>")
      .html('img, image {\n-webkit-filter: brightness(0);\n}')
      .appendTo("head");

    // Apply our font/color to all sub-elements
    (redact = function (ele) {
      var eles = $('*', ele);
      eles.each(function (index) {
        if (this.tagName !== 'SCRIPT' && this.tagName !== 'STYLE')
          $(this).css('font-family', 'Redacted')
          .css('background', 'none')
          .css('color', '#000');
      });
    })('body');

    // rerun our function when new nodes are inserted
    document.addEventListener('DOMNodeInserted', function (e) {
      // console.log('DOMNodeInserted');
      redact(e.relatedNode);
    });
  }
}

chrome.runtime.onMessage.addListener(

  function (message, sender, callback) {

    if (message.what === "isActive") {
      //console.log("cs-send", 'active:'+(document.querySelector('#rd_style')!=null));
      callback({
        'active': (document.querySelector('#rd_style') != null)
      });
    }
    // compare updated URL to original URL
    else if (message.what === "tabUpdate" && message.url !== url) {

      sendCheckPage(); // if URL is programmatically changed, recheck the page
    }
  });
