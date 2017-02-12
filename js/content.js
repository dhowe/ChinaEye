var url = location.href; // store original

// console.log('content.js: ' + url);

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

    // TODO: make sure that our style tag is not being added multiple times on the same page(done)

    // Create text for the CSS we need for our font & Image
    if (document.getElementById("rd_style") === null) {
     var css = document.createElement("style"),
         redact, fontFace = '@font-face { font-family: Redacted; src: url("' + chrome.extension.getURL('fonts/redacted-regular.woff') + '"); }',
         rdImageStyle = 'img, image {\n-webkit-filter: brightness(0);\n}';

     css.type = "text/css";
     css.id = "rd_style";
     css.innerHTML = fontFace + rdImageStyle;
     document.getElementsByTagName('head')[0].appendChild(css);
    }

    // Apply our font/color to all sub-elements
    (redact = function () {
      var elements = document.getElementsByTagName("*");
      for (var i = 0; i < elements.length; i++) {

        if (elements[i].tagName !== 'SCRIPT' && elements[i].tagName !== 'STYLE') {
          elements[i].style.color = '#000';
          elements[i].style.background = 'none';
          elements[i].style.fontFamily = 'Redacted';
        }
      }
    })('body');

    // rerun our function when new nodes are inserted
    document.addEventListener('DOMNodeInserted', function (e) {
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
