// background.js
'use /js/lib/js_suffix_trie.js'
'use /js/lib/data_manager.js'
'use /js/analytics.js'

/*

 Good read: inject screen to page

 http://stackoverflow.com/questions/9515704/building-a-chrome-extension-inject-code-in-a-page-using-a-content-script/9517879#9517879
 */

var jsSuffixTrie = new JsSuffixTrie();
var wasInitByFirstContent = false;

var spaceConverToStr = '​AXYZA'.replace(/\u200B/g, '');

var regExp = new RegExp(spaceConverToStr, "g")

// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(function (tab) {
    // Send a message to the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {"message": "clicked_browser_action"});
    });
});

function convertBeforeAdd(str) {
    while (str.endsWith("\n")) {
        str = str.substring(0, str.length - 1);
    }
    return str.replace(/\s/g, spaceConverToStr);
}

function convertAfterFind(strArr) {
    for (i = 0; i < strArr.length; i++) {
        strArr[i] = strArr[i].replace(regExp, ' ');
    }
    return strArr;
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log("background got event " + request.message);

        if (request.message === "analytics") {
            if (request.input[1] == undefined)
                _gaq.push(['_trackEvent', request.input[0]]);
            else
                _gaq.push(['_trackEvent', request.input[0], request.input[1]]);
        } else if (request.message === "load_suffix_tree") {
            // if (!wasInitByFirstContent) {
            wasInitByFirstContent = true;
            loadSuffixFromDBTree();
            console.log("loaded suffix tree from db");
            // }
        } else if (request.message === "add_to_suffix_tree") {

            var safeInput = convertBeforeAdd(request.input);
            if (safeInput/* && !jsSuffixTrie.contains(safeInput)*/) {
                var allInTree = jsSuffixTrie.find(safeInput)
                var noResults = allInTree == null;

                if (noResults) {
                    // add to database
                    save(safeInput);
                    jsSuffixTrie.add(safeInput);
                    return;
                }

                var alreadyContained = false;

                for (i = 0; i < allInTree.length; i++) {
                    if (allInTree[i] === safeInput) {
                        alreadyContained = true;
                        break;
                    }
                }
                if (!alreadyContained) {
                    // add to database
                    save(safeInput);
                    jsSuffixTrie.add(safeInput);
                }
            }
        } else if (request.message === "query_tree") {
            // has results - show them

            var fixedInput = request.input;

            var safeInput = convertBeforeAdd(fixedInput);
            if (safeInput && jsSuffixTrie.contains(safeInput)) {
                // add to database
                var stringResults = convertAfterFind(jsSuffixTrie.find(safeInput))
                console.log("stringResults = " + stringResults);

                if (stringResults) {
                    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            "message": "query_tree_results",
                            "input": stringResults,
                            "currentLineIndex": request.currentLineIndex
                        }, function (response) {
                            console.log("sent " + stringResults + " to content.js for: " + fixedInput);
                        });
                    });
                }
                console.log(stringResults);
            } else {
                // has no results - hide them
                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        "message": "hide_bubble",
                    }, function (response) {
                        console.log("sent hide_bubble to content.js for: " + request.input);
                    });
                });
            }
        } else if (request.message === "remove_from_databases") {
            var converted = convertBeforeAdd(request.input);
            if (converted) {
                jsSuffixTrie.remove(converted);
                deleteValue(request.input);
            }
        }
    });


// use this for url change check listener - http://stackoverflow.com/questions/34999976/detect-changes-on-the-url
//
// chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
//     alert(changeInfo.url);
// });