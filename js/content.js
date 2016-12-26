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

    // console.log("block");

    // Create text for the CSS we need for our font & Image
    var css = document.createElement("style"),
        fontFace = '@font-face { font-family: Redacted; src: url("' + chrome.extension.getURL('fonts/redacted-regular.woff') + '"); }',
        rdImageStyle = 'img, image {\n-webkit-filter: brightness(0);\n}';
    
    css.type = "text/css";
    css.innerHTML = fontFace + rdImageStyle;
    document.getElementsByTagName('head')[0].appendChild(css);


    // Apply our font/color to all sub-elements
      var elements = document.getElementsByTagName("*");
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].tagName !== 'SCRIPT' && elements[i].tagName !== 'STYLE'){
          elements[i].style.background = 'none';
          elements[i].style.color = '#000';
          elements[i].style.fontFamily = 'Redacted';

        }
      }
  
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
