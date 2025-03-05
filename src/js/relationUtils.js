import { DEFAULT_LANGUAGE_CODE, languageLabelMap } from './constants.js';

async function invokeService(serviceUrl, requestVO, timeout_ms=30000)
{
	return new Promise(function(resolve, reject) 
	{
		var httpRequest, netAction, responseParseOut;
		blockPage();
		httpRequest = new XMLHttpRequest();
		httpRequest.onreadystatechange = function()
		{
			if(this.readyState == 4)
			{
				unblockPage();
				if(this.status == 200)
				{
					if (httpRequest.response == null) {
						netAction = 1;
					}
					else if (httpRequest.responseText == "") {
						netAction = 2;
					}
					else {
						if (httpRequest.getResponseHeader("content-type") == "application/json") {
							netAction = 3;
						}
						else {
							netAction = 4;
						}
					}
				}
				else if(this.status == 500)
				{
					netAction = 5;
				}
				else
				{
					netAction = 6;
				}
				/* ontimeout, if applicable, is triggered after this!!! */
			}
		};
		httpRequest.open('POST', serviceUrl);
		httpRequest.timeout = timeout_ms;
		httpRequest.ontimeout = function () {
			netAction = 7;
	    };
		httpRequest.onloadend = function () {
			console.log("Service " + serviceUrl + ". netAction: " + netAction);
			switch(netAction) {
				case 1:
					resolve(null);
					return;
				case 2:
					resolve("");
					return;
				case 3:
					resolve(JSON.parse(httpRequest.responseText));
					return;
				case 4:
					resolve(httpRequest.responseText);
					return;
				case 5:
					responseParseOut = JSON.parse(httpRequest.responseText);
					if (responseParseOut.message == "No message available") {
						reject("Error: " + responseParseOut.error + ". Message: " + responseParseOut.message);
					}
					else {
						reject(responseParseOut.message);
					}
					return;
				case 7:
					reject("Taking long duration. Try giving lesser workload. Time-out Limit applied: " + timeout_ms + " ms.");
					return;
				case 6:
					reject(serviceUrl + " failed to run and returned with the status " + httpRequest.status);
					return;
			}
	    };
		if (requestVO == null) {
			httpRequest.send();
		}
		else if(typeof requestVO == "string" && (isNaN(requestVO))) {	// Is not complete, enough for now
			httpRequest.setRequestHeader('Content-Type', 'text/plain');
			httpRequest.send(requestVO);
		}
		else {
			httpRequest.setRequestHeader('Content-Type', 'application/json');
			httpRequest.send(JSON.stringify(requestVO));
		}
	});
	
}

function blockPage() {
	var blockingElement;
	blockingElement = document.querySelector(".blockPage");
	if (blockingElement == null) {
		blockingElement = document.createElement("div");
		blockingElement.classList.add("blockPage");
		blockingElement.innerHTML = "<span>Please wait...<span>";
		document.getElementsByTagName("body")[0].appendChild(blockingElement);
	}
}

function unblockPage() {
	var blockingElement;
	blockingElement = document.querySelector(".blockPage");
	if (blockingElement != null) {
		blockingElement.remove();
	}
}

/* https://stackoverflow.com/questions/37134433/convert-input-file-to-byte-array */
function fileToByteArray(file) {
    return new Promise((resolve, reject) => {
        try {
            let reader = new FileReader();
            let fileByteArray = [];
            reader.readAsArrayBuffer(file);
            reader.onloadend = (evt) => {
                if (evt.target.readyState == FileReader.DONE) {
                    let arrayBuffer = evt.target.result,
                        array = new Uint8Array(arrayBuffer);
                    for (byte of array) {
                        fileByteArray.push(byte);
                    }
                }
                resolve(fileByteArray);
            }
        }
        catch (e) {
            reject(e);
        } 
    })
}

/* https://stackoverflow.com/questions/228835/best-practice-javascript-and-multilanguage */
function Language(lang)
{
    var __construct = async function() {
		try {
			if (typeof lang !== 'undefined') {
				// lang exists
			} else {
				// lang is undefined
				lang = DEFAULT_LANGUAGE_CODE;
			}
		} catch (e) {
			// lang is not declared
			lang = DEFAULT_LANGUAGE_CODE;
		}
        return;
    }()

    this.getStr = function(str, defaultStr) {
		if (languageLabelMap.has(lang)) {
			var retStr = languageLabelMap.get(lang)[str];
			if (typeof retStr != 'undefined')
			{
				return retStr;
			} else {
				if (typeof defaultStr != 'undefined')
				{
					return defaultStr;
				} else {
					return 'labelUndefined';
				}
			}
		} else {
			return 'langUndefined';
		}
    }
}

export { invokeService, fileToByteArray, Language };