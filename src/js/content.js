// content.js
'use js/lib/js_suffix_trie.js'
'use js/lib/jquery-ui.js'
'use background.js'
'use js/lib/data_manager.js'

var focused;
var bubbleDOM;
var mainNode;
var table;
var tbody;
var currentInputStr;
var internalContainer;
var borderAndScrollDiv;
var currentLineIndex;
var duplicateLines;
var allCurrentLines;
var lineHeightInPX = 40;

var noBreakingSpaceCharCode = 160;
var currentNavigationIndex = -1;

var specialChars = [",", "\"", "\\", "="];
var stopEvents = false;
var mRealFocusedOnShift;

window.onload = function () {
    fixupActiveElement();

    chrome.runtime.sendMessage({"message": "load_suffix_tree"}, function (response) {
        console.log("sent load_suffix_tree");
    });
}

function onChange() {
    // alert(focused.value);
}

function onKeyUpBubble() {
    alert("onKeyUpBubble");
}

function sendAnalytics(eventName, eventValue) {
    var obj = [];
    obj[0] = eventName;
    obj[1] = eventValue;
    chrome.runtime.sendMessage({"message": "analytics", "input": obj}, function (response) {
        console.log("sent analytics: " + eventName);
    });
}

function onKeyUp(event) {
    if (event.keyCode == 38) { //up
        if (table && bubbleDOM) {

            if (currentNavigationIndex > 0) {

                var rows = tbody.getElementsByTagName('tr');
                rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#fff'; // old bg
                currentNavigationIndex = Math.max(0, currentNavigationIndex - 1);
                rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#B3E5FC';
            }
        }
    } else if (event.keyCode == 40) { //down
        if (table && bubbleDOM) {
            sendAnalytics('paginate_down_event', undefined);

            var rows = tbody.getElementsByTagName('tr');
            if (currentNavigationIndex < rows.length - 1) {
                rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#fff'; // old bg
                currentNavigationIndex = Math.min(rows.length, currentNavigationIndex + 1);
                rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#B3E5FC';
            }
        }
    } else if (event.keyCode == 18) { // alt(keyboard on table)
        if (table && bubbleDOM) {
            sendAnalytics('move_focus_to_table_event', undefined);

            var rows = tbody.getElementsByTagName('tr');

            if (currentNavigationIndex != -1)
                rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#fff'; // old bg

            stopEvents = true;
            rows[0].getElementsByTagName('text')[0].style.backgroundColor = '#B3E5FC';
            currentNavigationIndex = 0;

            mRealFocusedOnShift = focused;

            var fixedId = focused.id;
            if (fixedId.includes(":"))
                fixedId = fixedId.replace(/:/g, '\\:'); // fixing ids that contains : using regex : => \\:

            $('#' + fixedId).blur();
        }
    } else
    // save if enter(13), hide bubble is esc(27) otherwise query tree
    if (event.keyCode == 27) {
        currentInputStr = "";
        currentLineIndex = -1;
        currentNavigationIndex = -1;
        allCurrentLines = [];
        hideBubble();
    } else if (event.keyCode == 13) {
        sendAnalytics('add_to_db_event', undefined);

        // putting text from table to focused element
        if (currentNavigationIndex != -1) {
            var rows = tbody.getElementsByTagName('tr');
            var rowsData = rows[currentNavigationIndex].getElementsByTagName('text');
            var optionText = rowsData[0].value;
            onRowClicked(optionText, currentLineIndex);
        } else {
            currentInputStr = "";
            // focused is division or section

            var text;
            console.log("outside findFocusedInputField");

            text = myTrim(allCurrentLines[currentLineIndex]);

            text = removeSpecialChars(text);

            // this weird code comes from somewhere within javascript, Just fixing in
            text = removeU200B(text);

            if (text)
                addToDatabase(text);
        }
        hideBubble();
    } else {
        if (!getFocusedElementText()) {
            hideBubble();
        } else {
            duplicateLines = 0;

            if (focused.nodeName == "TEXTAREA" || focused.nodeName == "INPUT") {
                var allLinesText = getFocusedElementText();
                setupLineIndexForTextAreaOrInput(allLinesText);
            } else {
                // only div?
                findLineOfStr(document.getSelection().anchorNode.textContent.slice(0, document.getSelection().focusOffset));

                currentInputStr = removeU200B(allCurrentLines[currentLineIndex]);

                // IGNORE POINT 1
                if (myTrim(currentInputStr).length == 0) {
                    hideBubble();
                    return;
                }

                // // IGNORE POINT 2
                // if (duplicateLines > 1) {
                //     hideBubble();
                //     return;
                // }
            }

            while (currentInputStr.endsWith("\n")) {
                currentInputStr = currentInputStr.substring(0, currentInputStr.length - 1);
            }

            // this weird code comes from somewhere within javascript, Just fixing in
            currentInputStr = removeU200B(currentInputStr);
            currentInputStr = removeSpecialChars(currentInputStr);

            chrome.runtime.sendMessage({
                "message": "query_tree",
                "input": currentInputStr,
                "currentLineIndex": currentLineIndex
            }, function (response) {
                console.log("sent " + currentInputStr + " to query_tree");
            });
        }
    }
}

function setEndOfContenteditable(contentEditableElement) {
    var range, selection;
    if (document.createRange)//Firefox, Chrome, Opera, Safari, IE 9+
    {
        range = document.createRange();//Create a range (a range is a like the selection but invisible)
        range.selectNodeContents(contentEditableElement);//Select the entire contents of the element with the range
        range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
        selection = window.getSelection();//get the selection object (allows you to change selection)
        selection.removeAllRanges();//remove any selections already made
        selection.addRange(range);//make the range you have just created the visible selection
    }
    else if (document.selection)//IE 8 and lower
    {
        range = document.body.createTextRange();//Create a range (a range is a like the selection but invisible)
        range.moveToElementText(contentEditableElement);//Select the entire contents of the element with the range
        range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
        range.select();//Select the range (make it the visible selection
    }
}

function removeSpecialChars(str) {
    for (i = 0; i < specialChars.length; i++)
        if (str.includes(specialChars[i])) {
            str = str.replace(specialChars[i], "");
        }
    return str;
}

function myTrim(x) {
    return x.replace(/^\s+|\s+$/gm, '');
}

function findLineOfStr(str) {
    var allLinesText = getFocusedElementText();

    // more the 1 space at end
    // if (myTrim(allLinesText).length < allLinesText.length - 1) {
    //     allLinesText = myTrim(allLinesText) + " ";
    // }

    if (allLinesText.includes("\n")) {
        allCurrentLines = allLinesText.split("\n");
        var lines = allLinesText.split("\n");
        var lineCount = lines.length;

        // if lines include the same line twice it means we don't know on which one of them the user is - so we ignore this state
        for (j = 0; j < lineCount; j++) {
            if (lines[j].includes(str)) {
                duplicateLines++;
                currentLineIndex = j;
            }
        }
        if (duplicateLines > 1)
            console.log("duplicateLines = " + duplicateLines + ". currentLineIndex = " + currentLineIndex);

        return lines[currentLineIndex]
    } else {
        allCurrentLines = [allLinesText];
        duplicateLines = 1;
        currentLineIndex = 0;
    }
}

function setupLineIndexForTextAreaOrInput(allLinesText) {
    if (allLinesText.includes("\n")) {
        var fixedId = focused.id;
        if (fixedId.includes(":"))
            fixedId = fixedId.replace(/:    /g, '\\:'); // fixing ids that contains : using regex : => \\:

        var cursorPosition = $('#' + fixedId).prop("selectionStart");
        currentLineIndex = getCurrentLineTextArea(allLinesText, cursorPosition);

        allCurrentLines = allLinesText.split("\n");
        currentInputStr = allCurrentLines[currentLineIndex];

    } else {
        allCurrentLines = [allLinesText];
        currentLineIndex = 0;
        currentInputStr = allLinesText;
    }
}

function removeU200B(str) {
    if (str.includes("\u200B"))
        str = str.replace(/\u200B/g, '');

    return str;
}

function hideBubble() {
    if (bubbleDOM) {
        bubbleDOM.parentNode.removeChild(bubbleDOM);
        bubbleDOM = null;
        sendAnalytics('hide_table_event', undefined);
    }
    lastBoldCharCount = 0;
    mRealFocusedOnShift = null;
    stopEvents = false;
    currentNavigationIndex = -1;
    // currentInputStr = "";
    // currentLineIndex = -1;
}

function getCurrentLineTextArea(myString, caretPos) {
    return myString.substring(0, caretPos).split("\n").length - 1; // counts from 0 to N
}

function getFocusedElementText() {
    if (focused.nodeName == "DIV")
        return focused.innerText;
    else
        return focused.value;
}

function addToDatabase(text) {
    if (text) {
        var isOneLongLine = text.length > 10 && !text.includes('\s');
        if (!isOneLongLine) {

            chrome.runtime.sendMessage({"message": "add_to_suffix_tree", "input": text}, function (response) {
                console.log("sent " + text + " to add_to_suffix_tree");
            });
        }
    }
}

function removeNoBreakingSpace(str) {
    return str.replace(String.fromCharCode(noBreakingSpaceCharCode), " ");
}

function setColorWhenHover(element) {
    element.addEventListener("mouseover", function () {

        var rows = tbody.getElementsByTagName('tr');
        if (currentNavigationIndex != -1)
            rows[currentNavigationIndex].getElementsByTagName('text')[0].style.backgroundColor = '#fff'; // old bg

        this.style.backgroundColor = "#B3E5FC";
    }, false);
    element.addEventListener("mouseout", function () {
        this.style.backgroundColor = "#fff";
    }, false);
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log("content.js got event " + request.message);
        if (request.message === "query_tree_results" && request.input) {
            const currentQueryLine = request.currentLineIndex;
            sendAnalytics('creating_table', "size " + request.input.length);

            var callback = function (location) {
                focused.focus();
                if (table && tbody || request.input.length == 0) {
                    table.removeChild(tbody);
                    tbody = null;
                }

                // create table
                if (!table) {
                    table = document.createElement("pretty_table");
                    table.setAttribute("id", "pretty_table");
                    table.setAttribute("class", "pretty_table");
                    table.style.width = 'auto';

                }

                // create table's bpdy
                tbody = document.createElement("tbody");
                tbody.style.width = 'auto';
                tbody.style.background = 'transparent';
                table.appendChild(tbody);

                // create bubble and internal container(2 div) and append to parent
                if (!bubbleDOM) {
                    internalContainer = document.createElement('div');
                    internalContainer.setAttribute('class', 'bordered_div')
                    internalContainer.setAttribute('id', 'internalContainer')

                    // table.style.cursor = '';
                    internalContainer.style.right = '30px';
                    internalContainer.style.top = '30px';
                    internalContainer.style.position = 'fixed';
                    internalContainer.style.paddingTop = '15px';

                    borderAndScrollDiv = document.createElement('div');
                    borderAndScrollDiv.style.border = 'solid';
                    borderAndScrollDiv.style.position = 'fixed';
                    borderAndScrollDiv.style.borderColor = '#e0e0e0';
                    borderAndScrollDiv.style.borderWidth = '1px';
                    borderAndScrollDiv.style.overflow = 'auto';
                    borderAndScrollDiv.style.overflowY = 'auto';

                    bubbleDOM = document.createElement('div');
                    bubbleDOM.setAttribute('class', 'anti_overides_selection_bubble');
                    bubbleDOM.setAttribute('id', 'anti_overides_selection_bubble');

                    var tempParent = focused.parentNode;
                    if (mainNode) {
                        mainNode.appendChild(bubbleDOM);
                    } else {

                        while (tempParent.parentNode && tempParent.parentNode.parentNode) {
                            tempParent = tempParent.parentNode;
                        }

                        mainNode = tempParent;
                        mainNode.appendChild(bubbleDOM);
                    }


                    borderAndScrollDiv.appendChild(table);
                    internalContainer.appendChild(borderAndScrollDiv);
                    bubbleDOM.appendChild(internalContainer);
                    addListeners();
                }

                var longestInputStr = "";

                var maxWidth = $(document).width();

                for (i = 0; i < request.input.length; i++) {

                    if (longestInputStr.length < request.input[i].length)
                        longestInputStr = request.input[i];

                    while (currentInputStr.endsWith("\n")) {
                        currentInputStr = currentInputStr.substring(0, currentInputStr.length - 1);
                    }

                    var isRtl = isRTL(request.input[i]);

                    const data = document.createElement("text");
                    data.style.cursor = 'default';

                    var str = request.input[i].replace(removeNoBreakingSpace(currentInputStr), '');

                    data.style.padding = '5px';

                    data.style.display = '-webkit-box';

                    if (isRtl) {
                        data.style.webkitBoxAlign = 'center left';
                        data.style.webkitBoxPack = 'center left';
                    } else {
                        data.style.webkitBoxAlign = 'center right';
                        data.style.webkitBoxPack = 'center right';
                    }

                    data.value = currentInputStr + str;
                    data.innerHTML = currentInputStr.bold() + str;
                    data.style.textAlign = 'center left';
                    // td.style.maxWidth = '100%';
                    // tdNormalSuffix.style.height = (lineHeightInPX - 2 ) + 'px';
                    data.style.fontSize = 25 + 'px';
                    data.style.textSpace = 5 + 'px';
                    data.style.marginLeft = '0px';
                    data.style.borderSpacing = '0px';
                    data.style.width = maxWidth * (1 / 3) + 'px';
                    data.style.minHeight = (lineHeightInPX - 2 ) + 'px';
                    data.style.verticalAlign = 'center';
                    // tdNormalSuffix.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
                    setColorWhenHover(data);

                    // tdNormalSuffix.style.textShadow = "0 0 1px black";
                    var deleteBtnContainer = document.createElement("td");

                    var deleteBtn = document.createElement("img");
                    deleteBtn.id = "delete_btn" + i;
                    deleteBtn.style.marginTop = '13px';
                    deleteBtn.style.marginBottom = '10px';
                    deleteBtn.style.marginLeft = '10px';
                    deleteBtn.style.marginRight = '10px';
                    deleteBtn.style.width = '16px';
                    deleteBtn.style.height = '16px';
                    deleteBtn.style.float = 'right';

                    deleteBtn.src = chrome.extension.getURL("images/close.png");

                    deleteBtnContainer.appendChild(deleteBtn)

                    setColorWhenHover(deleteBtnContainer);

                    const constIndex = i;

                    const row = document.createElement("tr");
                    row.id = "row_id";

                    deleteBtnContainer.addEventListener("click", function (event) {
                        event.stopPropagation();
                        $(this).closest('tr').fadeOut('fast',
                            function (here) {
                                var valueInDB = this.id;
                                $(here).parents('tr:first').remove();

                                borderAndScrollDiv.style.height = (parseInt(borderAndScrollDiv.style.height.replace('px', '')) - lineHeightInPX) + 'px';

                                chrome.runtime.sendMessage({
                                    "message": "remove_from_databases",
                                    "input": valueInDB
                                }, function (response) {
                                    console.log("sent " + valueInDB + " remove_from_databases");
                                });

                                sendAnalytics('delete_result', "index " + constIndex);

                            });
                    }, true);

                    row.border = 0;
                    row.setAttribute("id", "" + request.input[i]);
                    row.setAttribute("class", "shadow-z-1");
                    row.setAttribute("index", i);
                    row.style.width = 'auto';

                    row.style.height = 'auto';//(lineHeightInPX - 2 ) + 'px';
                    row.style.childAlign = 'center';
                    row.style.background = 'white';

                    if (isRtl) {
                        data.style.direction = 'rtl';
                        data.style.textAlign = 'right';

                        row.appendChild(deleteBtnContainer);
                        row.appendChild(data);
                    } else {
                        row.appendChild(data);
                        row.appendChild(deleteBtnContainer);
                    }

                    row.addEventListener("mouseover", function () {
                        if (currentNavigationIndex != -1) {
                            var rows = tbody.getElementsByTagName('tr');
                            rows[currentNavigationIndex].style.background = 'white'; // old bg
                        }
                        currentNavigationIndex = parseInt(row.getAttribute("index"));
                    });

                    tbody.appendChild(row);

                    var createClickHandler =
                        function (option) {
                            return function () {
                                var optionText = data.innerText;
                                onRowClicked(optionText, currentQueryLine);

                                sendAnalytics('ac_result_selected', "index " + constIndex);

                            };
                        };


                    // tdBoldPrefix.onclick = createClickHandler(tdBoldPrefix);
                    data.onclick = createClickHandler(data);
                }

                // var parentHeight = ($("#anti_overides_selection_bubble").parent().height() - 50);
                // var calcHeight = (request.input.length * lineHeightInPX );

                // var internalHeight = Math.min(parentHeight, calcHeight) + 'px';

                var width = calcStringInPixels(longestInputStr);
                internalContainer.style.paddingRight = (Math.min(width, maxWidth * (1 / 3)) + 30) + 'px';

                tbody.style.height = 'auto';
                table.style.height = 'auto';
                borderAndScrollDiv.style.height = 'auto';
                internalContainer.style.height = 'auto';
                bubbleDOM.style.height = '100%';
                bubbleDOM.style.width = '100%';

                tbody.offsetWidth = (tbody.offsetWidth + 40);
                tbody.style.width = (tbody.offsetWidth + 'px');

                console.log("borderAndScrollDiv width: " + borderAndScrollDiv.offsetWidth);
                console.log("internalContainer width: " + internalContainer.offsetWidth);
                console.log("tbody width: " + tbody.offsetWidth);
                console.log("table width: " + table.offsetWidth);


                if (location) {
                    var margins = location.split(",");
                    // internalContainer.style.right = -1;
                    internalContainer.style.top = margins[0];
                    internalContainer.style.left = margins[1];
                }

            };

            var hostname = window.location.hostname;
            if (!hostname)
                callback(undefined)
            else
                getLocation(window.location.hostname, callback);


        } else if (request.message == "hide_bubble") {
            hideBubble();
        }
    })


function calcStringInPixels(str) {
    // Create dummy span
    var e = document.createElement('span');
    // Set font-size
    e.style.fontSize = '25px';
    // Set font-face / font-family
    e.style.fontFamily = 'Arial';
    e.style.fontStyle = 'bold';
    // Set text
    e.innerHTML = str;
    document.body.appendChild(e);
    // Get width NOW, since the dummy span is about to be removed from the document
    var w = e.offsetWidth;
    // Cleanup
    document.body.removeChild(e);
    // All right, we're done
    return w + 36 + 100; // 36 for delete button, 100 padding
}

function onRowClicked(optionText, lineIndex) {
    var fixedFocusItem = focused;
    if (mRealFocusedOnShift)
        fixedFocusItem = mRealFocusedOnShift;

    fixedFocusItem.focus();

    var finalResult = "";

    var allInput;
    if (fixedFocusItem.nodeName == "DIV")
        allInput = fixedFocusItem.innerText;
    else
        allInput = fixedFocusItem.value;

    if (allInput && allInput.includes("\n")) {
        var lines = allInput.split("\n");
        lines[lineIndex] = optionText;

        for (i = 0; i < lines.length; i++) {
            finalResult += lines[i] + (i != lines.length - 1 ? "\n" : "");
        }
    } else {
        finalResult = optionText;
    }

    if (fixedFocusItem.nodeName == "DIV") {
        fixedFocusItem.innerText = finalResult;
        setEndOfContenteditable(fixedFocusItem);
    }

    try {
        fixedFocusItem.value = finalResult;
    } catch (ee) {

    }

    // put cursor at end of text
    fixedFocusItem.selectionStart = fixedFocusItem.selectionEnd = fixedFocusItem.value.length;

    hideBubble();
}


function addListeners() {
    var div = $('#internalContainer');
    div.resizable(
        {
            stop: function (event, ui) {
                sendAnalytics('drag_and_drop_event', undefined);
                var top = getTop(ui.helper);
                ui.helper.css('position', 'fixed');
                ui.helper.css('top', top + "px");

                saveLocation(window.location.hostname, internalContainer.style.top, internalContainer.style.left);
            }
        });
    div.draggable(
        {
            stop: function (event, ui) {
                sendAnalytics('drag_and_drop_event', undefined);

                var top = getTop(ui.helper);
                ui.helper.css('position', 'fixed');
                ui.helper.css('top', top + "px");
                ui.helper.css('background', "transparent");

                saveLocation(window.location.hostname, internalContainer.style.top, internalContainer.style.left);
            }
        });


    function getTop(ele) {
        var eTop = ele.offset().top;
        var wTop = $(window).scrollTop();
        var top = eTop - wTop;

        return top;
    }
}

// this is the order in which events will fire if we shift focus using a tab
document.addEventListener("keydown", onKeyDownChanged, true);
document.addEventListener("focus", onFocusChanged, true);
document.addEventListener("keyup", onKeyUpChanged, true);

function fixupActiveElement(e) {
    var lstFocusId;
    // clear listeners
    if (focused != null) {
        focused.removeEventListener("change", onChange);
        focused.removeEventListener("keyup", onKeyUp);
        lstFocusId = focused.id;
    }

    focused = document.activeElement;
    focused.addEventListener("change", onChange);
    focused.addEventListener("keyup", onKeyUp);

    console.log("focused changed to " + focused.nodeName + " " + focused.id);
    // focus changed to different element
    if (lstFocusId && lstFocusId != focused.id && currentNavigationIndex == -1) {
        hideBubble();
    }
}

function onFocusChanged(e) {

    // if focus belongs to bubble  - do not change 'focused' element to that
    if (mRealFocusedOnShift) {
        return;
    }

    fixupActiveElement(e);
}

function onKeyUpChanged(e) {
    fixupActiveElement(e);

    if (stopEvents) {
        onKeyUp(e);
        e.stopPropagation();
        return true;
    }
    return false;
}

function onKeyDownChanged(e) {
    fixupActiveElement(e);

    if (stopEvents) {
        if ([38, 40, 13].indexOf(e.keyCode) > -1) {
            e.preventDefault();
        }
        // e.stopPropagation();
        return true;
    }
    return false;
}

function isRTL(s) {
    var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' + '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF',
        rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC',
        rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']');

    return rtlDirCheck.test(s);
};
