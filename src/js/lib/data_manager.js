/**
 * Created by nativ on 02/02/2017.
 */
// data_manager.js

// to do: implement LIFO(like lru-cache)

// first one is always key0
var nextOpenIndex = 0;

function save(str) {
    var key = 'key' + nextOpenIndex++;
    var obj = {};
    obj[key] = str;
    chrome.storage.local.set(obj, function () {
        console.log("saved: " + str + " to storage");
    });
}

function saveLocation(siteUrl, marginTop, marginRight) {
    var key = siteUrl;
    var obj = {};
    obj[key] = marginTop + "," + marginRight;
    chrome.storage.local.set(obj, function () {
        console.log("saved location: " + obj[key] + " to storage");
    });
}

function getLocation(siteUrl, callback) {
    try {
        chrome.storage.local.get(siteUrl, function (items) {
            if (!items || Object.keys(items).length === 0)
                callback(undefined);
            else
                callback(items[siteUrl]);

        });
    } catch (e) {
        callback(undefined);
    }
}

function loadSuffixFromDBTree() {
    console.log("building new tree");

    chrome.storage.local.get(null, function (items) {
        var allValues = Object.values(items);
        var allKeys = Object.keys(items);
        nextOpenIndex = allValues.length;
        for (i = 0; i < allValues.length; i++) {
            if (!allKeys[i].includes("http")) {
                console.log("adding to tree: " + allValues[i]);
                jsSuffixTrie.add(allValues[i]);
            }
        }
    });
}

function deleteValue(value) {
    console.log("building new tree");

    chrome.storage.local.get(null, function (items) {
        var allValues = Object.values(items);
        var allKeys = Object.values(items);

        for (i = 0; i < allValues.length; i++) {
            if (allValues === value) {
                chrome.storage.local.remove(allKeys[i]);
                break;
            }
        }
    });

}

function cleanDB() {
    chrome.storage.local.clear();
}