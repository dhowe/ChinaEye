var url = location.href; // store original
var status;
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

  status = res && res.status, isRedact = res && res.redact;
  //console.log(res, status === 'block', isRedact == true);

  if (status === 'block' && isRedact == true) {

    // Create text for the CSS we need for our font & Image
    if (document.getElementById("rd_style") === null) {

      var css = document.createElement("style"),
        redact, fontFace = '@font-face { font-family: Redacted; src: url("' +
          chrome.extension.getURL('fonts/redacted-regular.woff') + '"); }',
        rdImageStyle = 'img, image {\n-webkit-filter: brightness(0);\n}';

      css.type = "text/css";
      css.id = "rd_style";
      css.innerHTML = fontFace + rdImageStyle;
      document.getElementsByTagName('head')[0].appendChild(css);
    }

  }

  // Apply our font/color to all sub-elements
  //Enable or diable Redact

  var redact = function (ele, status) {

    if (!isRedact) return;

    elements = ele.getElementsByTagName("*");

    if (status === "block") {
      for (var i = 0; i < elements.length; i++) {

        if (elements[i].tagName !== 'SCRIPT' && elements[i].tagName
          !== 'STYLE' && elements[i].tagName !== 'HEAD')
        {
          // console.log(elements[i]);
          elements[i].style.color = '#000';
          elements[i].style.background = 'none';
          elements[i].style.fontFamily = 'Redacted';

        }
      }
    } else if (status === "allow") {

      if (document.getElementById("rd_style") != null) {
        //remove style tag
        document.getElementById("rd_style").remove();
      }
      //remove inline style
      for (var i = 0; i < elements.length; i++) {

        if (elements[i].style.fontFamily === 'Redacted') {
          // console.log(elements[i]);
          elements[i].style.color = '';
          elements[i].style.background = '';
          elements[i].style.fontFamily = '';
        }
      }
    }
  }

  redact(document.body, status);

  document.addEventListener('DOMNodeInserted', function (e) {
    // console.log(e.relatedNode);
    //e.relatedNode
    redact(e.relatedNode, status);
    // console.log("Node change:" + status);
  });
}

chrome.runtime.onMessage.addListener(

  function (message, sender, callback) {

    if (message.what === "isActive") {
      // console.log("cs-send", 'active:' + (document.querySelector('#rd_style')!= null));
      callback({
        'active': (document.querySelector('#rd_style') != null)
      });

    } else if (message.what === "tabUpdate" && message.url != url) {
      // compare updated URL to original URL
      // if URL is programmatically changed, recheck the page
      //sometimes this is not triggered when url is changed?
      sendCheckPage();
    }

    return true;

  });
