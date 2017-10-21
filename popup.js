
var gResults = [];
var gRow = 0;
var gCol = 0;
var gMax = 0;
var gURL = "";
var gHeaders = null;

/*
 * Fetch the  URL of the current tab.
 *
 * @param {function(string)} callback called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, (tabs) => {
    var tab = tabs[0];
    var url = tab.url;

    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(url);
  });
}

/**
 * Gets the saved headers for url.
 *
 * @param {string} url URL whose background color is to be retrieved.
 * @param {function(string)} callback called with the saved background color for
 *     the given url on success, or a falsy value if no color is retrieved.
 */
function getSavedHeaders(callback) {
  // See https://developer.chrome.com/apps/storage#type-StorageArea. We check
  // for chrome.runtime.lastError to ensure correctness even when the API call
  // fails.
  chrome.storage.sync.get(gURL, (items) => {
    callback(chrome.runtime.lastError ? null : items[gURL]);
  });
}
/*
 * Sets the table headers for a given url.
 *
 * @param {string} url URL for which background color is to be saved.
 * @param {string} color The background color to be saved.
 */
function setSavedHeaders(headers) {
  var items = {};
  items[gURL] = headers;
  // See https://developer.chrome.com/apps/storage#type-StorageArea. We omit the
  // optional callback since we don't need to perform any action once the
  // background color is saved.
  chrome.storage.sync.set(items);
}

document.addEventListener('DOMContentLoaded', () => {
    getCurrentTabUrl((url) => {
        gURL = url;
        analyzeSelection();
    });
});

document.addEventListener('keyup', () => {

    updateDownload();
}); 

function updateDownload() {
    var out = "";
    
    // grab the headers
    out += getHeaderElements();
    
    // fill out the rows
    for (var i = 0; i < gResults.length; i++) {
        out += gResults[i].join(",") + "\n";
    }
 
    var d = new Date();
    var pref = d.toDateString().replace(" ", "-");    

    downloadString(out, "text/csv", pref+".csv"); 
}


function getHeaderElements() {
    if ($('.header-in').length == gMax) {
        var headers = new Array(gMax);
        for (var c=0; c < gMax; c++) {
            headers[c] = $('#head'+c).val();
        }
        gHeaders = headers.join();
        return gHeaders + "\n";
    }

    return "";
}

function addHeader() {
    getSavedHeaders(function(saved) {
        var vals = [];
        if (saved) {
            vals = saved.split(",")
        }
        var header = "<tr>";
        for (var c=0; c < gMax; c++) {
            var val = (vals[c]) ? vals[c] : "";
            header += "<td><input class='header-in' id='head" + c + "' value='" + val + "'>"
        }
        header += "</tr>";
        $('#parsed').prepend($.parseHTML(header));
        $('#addh').hide();

        updateDownload();
    });
}

function saveOnDownload() {
    console.warn("saving headers");
    setSavedHeaders(gHeaders);
}

function downloadString(text, fileType, fileName) {
    var blob = new Blob([text], { type: fileType });

    var a = document.createElement('a');
    a.download = fileName;
    a.id = "download";
    a.href = URL.createObjectURL(blob);
    a.onclick = saveOnDownload
    a.dataset.downloadurl = [fileType, a.download, a.href].join(':');
    a.appendChild(document.createTextNode("download"));
    $('#download').replaceWith(a);
    //document.body.removeChild(a);
    //setTimeout(function() { URL.revokeObjectURL(a.href); }, 1500);
}

function checkHeader() {
   var a = document.createElement('a');
    a.href = "#";
    a.id="addh";
    a.appendChild(document.createTextNode("+"));
    $('#container').prepend(a);
    $('#addh').click(addHeader);
}

// simplistic search for table content
// first look for tr (most normal tables have tr's for table rows
// if no tr's try lis (don't ask me why this makes sense)

function analyzeSelection() {
    chrome.tabs.executeScript( {
        code: "foo=document.createElement('div');foo.appendChild(window.getSelection().getRangeAt(0).cloneContents());foo.innerHTML;"
    }, function(selection) {
        $('#contents').html(selection);
        // gResults = [["ActivityDate","TransactionDate","Account","Activity","CheckCardNumber","Description","Quantity","Price","Amount","Balance","End"]];
        gResults = [[]];
        gRow = 1;
        gMax = 0;

        var trs = $('tr');
        var lis = $('li');

        var rows = (trs.length > lis.length) ? trs : lis;

       
        rows.each(function() {
            gResults.push([])
            gCol = 0;
            $(this).children().each(function() {
                gResults[gRow][gCol] = $(this).text().replace(",", " ").trim();
                gCol += 1;
            });

            if (gCol < gMax) {
                // if other rows have more columns, then add more cols to me
                for (var c = gCol; c < gMax; c++) {
                    gResults[gRow][c] = "";
                }
            }

            if (gCol > gMax) {
                // and if I have more than the other fix them
                for (var r = 0; r < gResults.length; r++) {
                    if (r != gRow) {
                        for (var c = gMax; c < gCol; c++) {
                            gResults[r][c] = "";
                        }
                    }
                }
                gMax = gCol;
            }

            gRow += 1;   
        });

        $('#contents').html("");

        var parsed = "";
        for (var i = 0; i < gResults.length; i++) {
            parsed += "<tr><td>" + gResults[i].join("</td><td>") + "</tr></td>";
        }
        $("#parsed").html(parsed);
        
        checkHeader();

        updateDownload();

    });
}