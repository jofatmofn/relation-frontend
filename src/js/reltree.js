var domainValueVOList, isAppReadOnly, highlightedEntity, domainValueVOMap;
var paSelectElement, raSpSelectElement, raPcSelectElement, paDomainValueVOList, raDomainValueVOList, isPersonNode;
var action, selectElementMap, doubleClick, paSearchXtraOptions;
var allPersonsSelectElement, malePersonsSelectElement, femalePersonsSelectElement;
var translator, s, enterEdgeColor;

import Pikaday from 'pikaday';
import EdgeCurveProgram from "@sigma/edge-curve";
import { downloadAsImage } from "@sigma/export-image";
import { Graph } from 'graphology';
import { Sigma } from 'sigma';
import { invokeService, fileToByteArray, Language } from './relationUtils.js';
import * as constants from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
	drawGraph();
	document.getElementById("switchLanguageButton").onclick = function() {switchLanguage();}
	document.getElementById("switchProjectButton").onclick = function() {switchProject();}
	document.getElementById("createProjectButton").onclick = function() {createProject();}
	document.getElementById("logoutButton").onclick = function() {logout();}
	document.getElementById("searchPersonButton").onclick = function() {searchPerson();}
	document.getElementById("ascertainRelationButton").onclick = function() {ascertainRelation();}
	document.getElementById("clearGraphButton").onclick = function() {clearGraph();}
	document.getElementById("nodeToFocusButton").onclick = function() {nodeToFocus();}
	document.getElementById("printGraphButton").onclick = function() {printGraph();}
	document.getElementById("addPersonButton").onclick = function() {addPerson();}
	document.getElementById("relatePersonsButton").onclick = function() {relatePersons();}
	document.getElementById("uploadPrDataButton").onclick = function() {uploadPrData();}
	document.getElementById("drel").onclick = function() {enDisableDepth(this);}
	document.getElementById("viewTree").onclick = function() {enDisableDepth(this);}
	document.getElementById("displayTree").onclick = function() {enDisableDepth(this);}
	document.getElementById("exportTree").onclick = function() {enDisableDepth(this);}
	document.getElementById("exportFullTree").onclick = function() {enDisableDepth(this);}
	document.getElementById("roots").onclick = function() {enDisableDepth(this);}
	document.getElementById("parceners").onclick = function() {enDisableDepth(this);}
	document.getElementById("sidebarphotoInput").onchange = function() {
		document.getElementById('sidebarphotoImg').src = window.URL.createObjectURL(this.files[0]);
	}
});

async function drawGraph() {
	
	var urlParams, startPersonId, startProjectId;
	
	window.addEventListener("unhandledrejection", event =>
	{
		if (event.reason.stack != undefined && event.reason.stack.startsWith("sigma.")) {
			console.log(event);
			alert("System ran into trouble. Hence going to refresh the screen.");
			location.reload();
		}
		else {
			if (event.reason == "Error: Internal Server Error. Message: No message available") {
				alert("Internal Server Error. Report to SysAdmin.")
			} else {
				alert(event.reason);
				switch (event.reason) {
					case "Establish Project before using the system":
						// document.getElementById("project").value = 	""; Let the last used value remain so that the user can just click on Switch to re-establish the session
						break;
					case "Establish yourself by logging-in to the system":
						loginLogout("");
						isAppReadOnly=true;
						enableDisableRWFunctions();
						break;
					default:
						if (event.reason.startsWith("Invalid Person Id")) {	// TODO: To be made more generic
							clearSidebar();
						}
				}
			}
		}
	});
	
	isAppReadOnly = await invokeService("projectuser/postLogin", "");
	await retrieveAppStartValues();
	
	// Instantiate sigma
	urlParams = new URLSearchParams(window.location.search);
	startPersonId = urlParams.get('startPersonId');
	startProjectId = urlParams.get('startProjectId');
	const graph = new Graph();
	const container = document.getElementById("graph-container");
	// For COLORs https://borderleft.com/toolbox/hex/
	s = new Sigma(graph, container, {
			minEdgeSize: 0.5,
			maxEdgeSize: 2,
			renderEdgeLabels: true,
			enableEdgeEvents: true,
			enableEdgeHovering: true,
			edgeHoverSizeRatio: 1,
			edgeHoverExtremities: true,
			edgeProgramClasses: {
				curve: EdgeCurveProgram,
			}
		});
	/* https://github.com/jacomyal/sigma.js/issues/910 */
	s.on('enterNode', function(e) {
		s.setSettings({doubleClickZoomingRatio: 1});
	});

	s.on('leaveNode', function(e) {
		s.setSettings({doubleClickZoomingRatio: 2});
	});
	
	s.on("enterEdge", function(e) {
		const enterEdge = s.graph._edges.get(e.edge);
		enterEdgeColor = enterEdge.attributes.color;
		enterEdge.attributes.color = constants.EDGE_HOVER_COLOR;
		s.refresh();
	});
	s.on("leaveEdge", function(e) {
		s.graph._edges.get(e.edge).attributes.color = enterEdgeColor;
		s.refresh();
	});
  
	doubleClick = 0; // https://github.com/jacomyal/sigma.js/issues/506
						// To avoid double click also firing single click.
						// However, this is causing some delays!
	// Set doubleClick to zero, whenever programmatically invoking s.emit('clickNode'
	s.on('clickNode', function(e) {
		window.setTimeout(function () {
			if(doubleClick) {
				doubleClick--;
				return;
			}
			editEntityAttributes('clickNode', e.node);
		}, s.settings.doubleClickTimeout + 100);
	});
	
	s.on('clickEdge', function(e) {
		editEntityAttributes('clickEdge', e.edge);
	});
	
	s.on('doubleClickNode', function(e) {
		doubleClick = 2;
		if (e.node != constants.NEW_ENTITY_ID && e.node != constants.SEARCH_ENTITY_ID) {
			s.graph.clear();
			s.setSettings({ doubleClickZoomingRatio: 1 });
			callBackendAndPopulateGraph(e.node);
			s.refresh();
		}
		clearSidebar();
	});

	if (startProjectId != null) {
		var projectVO;
		
		document.getElementById("personCount").innerText = "";
		projectVO = await invokeService("projectuser/switchProject", startProjectId);
		isAppReadOnly = projectVO.appReadOnly;
		document.getElementById("project").value = startProjectId;
		document.getElementById("personCount").innerText = projectVO.personCount;
		if (startPersonId != null) {
			s.graph.import(await invokeService("basic/retrieveRelations", {startPersonId : startPersonId}));
		}
	}
	enableDisableRWFunctions();

}

async function callBackendAndPopulateGraph(personId) {
	if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value == "drel") {
		s.graph.import(await invokeService("basic/retrieveRelations", {startPersonId : personId}));
	} else if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value == "view") {
			s.graph.import(await invokeService("basic/retrieveTree", {startPersonId : personId,
				maxDepth : parseInt(document.getElementById("depth").options[document.getElementById("depth").selectedIndex].value)}));
	} else if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value == "display") {
			s.graph.import(await invokeService("basic/displayTree", {startPersonId : personId}), timeout_ms=0);
	} else if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value.startsWith("export")) {
		data = await invokeService("basic/exportTree", {startPersonId : personId,
			maxDepth : parseInt(document.getElementById("depth").options[document.getElementById("depth").selectedIndex].value),
			exportTreeType: document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value}, timeout_ms=0);
		// https://stackoverflow.com/questions/46638343/download-csv-file-as-response-on-ajax-request
		const downloadData = (function() {
		    const a = document.createElement("a");
		    document.body.appendChild(a);
		    a.style = "display: none";
		    return function (data, fileName) {
		        const blob = new Blob([data], {type: "octet/stream"}),
		            url = window.URL.createObjectURL(blob);
		        a.href = url;
		        a.download = fileName;
		        a.click();
		            setTimeout(function() {
		                window.URL.revokeObjectURL(url);
		            }, 100);
		    };
		}());

		downloadData(data, document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value + ".csv");
	} else if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value == "roots") {
		s.graph.import(await invokeService("basic/retrieveRoots", {startPersonId : personId}));
	} else if (document.querySelector('input[type="radio"][name="cfgPersonDblClk"]:checked').value == "parceners") {
		s.graph.import(await invokeService("basic/retrieveParceners", {startPersonId : personId}));
	}
}

async function retrieveAppStartValues() {
	var retrieveAppStartValuesResponseVO, selectElement, optionElement, languageSelectElement, ind;
	
	retrieveAppStartValuesResponseVO = await invokeService("basic/retrieveAppStartValues", "");
	if (retrieveAppStartValuesResponseVO.loggedInUser != null) {
		loginLogout(retrieveAppStartValuesResponseVO.loggedInUser);
	}
	domainValueVOList = retrieveAppStartValuesResponseVO.domainValueVOList;
	document.getElementById("project").value = retrieveAppStartValuesResponseVO.inUseProject;
	domainValueVOMap = new Map();
	paSelectElement = document.createElement("select");
	paSelectElement.setAttribute("name","attributenames");
	paSelectElement.classList.add("propdrop");
	raSpSelectElement = document.createElement("select");
	raSpSelectElement.setAttribute("name","attributenames");
	raSpSelectElement.classList.add("propdrop");
	raPcSelectElement = document.createElement("select");
	raPcSelectElement.setAttribute("name","attributenames");
	raPcSelectElement.classList.add("propdrop");
	selectElementMap = new Map();
	paDomainValueVOList = [];
	raDomainValueVOList = [];
	paSearchXtraOptions = [];
	for (let domainValueVO of domainValueVOList) {
		domainValueVOMap.set(domainValueVO.id, domainValueVO);
		optionElement = document.createElement("option");
		optionElement.setAttribute("value", domainValueVO.id);
		optionElement.appendChild(document.createTextNode(domainValueVO.value));
		if (domainValueVO.category == constants.CATEGORY_PERSON_ATTRIBUTE) {
			if (domainValueVO.isInputAsAttribute) {
				paSelectElement.appendChild(optionElement);
				paDomainValueVOList.push(domainValueVO);
			}
		} else 	if (domainValueVO.category == constants.CATEGORY_ADDITIONAL_PERSON_ATTRIBUTE) {
			paSearchXtraOptions.push(optionElement);
		}
		else if (domainValueVO.category == constants.CATEGORY_RELATION_ATTRIBUTE) {
			if (domainValueVO.isInputAsAttribute) {
				if (domainValueVO.relationGroup == null || domainValueVO.relationGroup == "" || domainValueVO.relationGroup == constants.RELATION_GROUP_SPOUSE) {
					raSpSelectElement.appendChild(optionElement);
				}
				if (domainValueVO.relationGroup == null || domainValueVO.relationGroup == "" || domainValueVO.relationGroup == constants.RELATION_GROUP_PARENT_CHILD) {
					raPcSelectElement.appendChild(optionElement.cloneNode(true));	// Without cloneNode, the optionElement is removed from raSpSelectElement
				}
				raDomainValueVOList.push(domainValueVO);
			}
		}
		else {
			if (selectElementMap.has(domainValueVO.category)) {
				selectElement = selectElementMap.get(domainValueVO.category);
			}
			else {
				selectElement = document.createElement("select");
				selectElement.setAttribute("name", domainValueVO.category);
				selectElement.classList.add("propdrop");
				selectElementMap.set(domainValueVO.category, selectElement);
			}
			selectElement.appendChild(optionElement);
			if (domainValueVO.category == constants.CATEGORY_BOOLEAN && domainValueVO.value == constants.DEFAULT_BOOLEAN) { // TODO: Map of Category Vs. Default Value in DB or constants
				optionElement.setAttribute("selected", "");
			}
		}
	}

	languageSelectElement = selectElementMap.get(constants.CATEGORY_LANGUAGE).cloneNode(true);
	languageSelectElement.id = "language";
	document.getElementById("language").replaceWith(languageSelectElement);
	languageSelectElement.value = retrieveAppStartValuesResponseVO.inUseLanguage;
	translator = new Language(domainValueVOMap.get(retrieveAppStartValuesResponseVO.inUseLanguage).languageCode);
	
}

async function editEntityAttributes(eventType, itemKey) {
	var attributeValueVOList, rightBarElement, valueElement, attributeValueBlockElement, actionButtonElement, addButtonElement;
	var person1Node, person2Node, retrieveRelationAttributesResponseVO,  person1GenderDVId, person2GenderDVId, person1ForPerson2SelectElement,  person2ForPerson2SelectElement;
	var retrievePersonAttributesResponseVO, photoImageElement;
	var person1AsPerRelationId, relationGroup, isEditEnabled;
	
	if (highlightedEntity != undefined && highlightedEntity.attributes != undefined) {
		highlightedEntity.attributes.color = constants.DEFAULT_COLOR;
	}
	
	attributeValueVOList = [];
	action = constants.ACTION_SAVE;
	clearSidebar();
	highlightedEntity = (eventType == "clickNode" ? s.graph._nodes.get(itemKey) : s.graph._edges.get(itemKey));
	if (highlightedEntity.attributes == undefined) {
		highlightedEntity.attributes = {};
	}
	if (highlightedEntity.attributes.label == undefined) {
		highlightedEntity.attributes.label = "Unlabelled"; 
	}
	console.log(eventType, highlightedEntity.attributes.label);
	if (eventType == "clickNode") {
		isPersonNode = true;
		if (highlightedEntity.key == constants.SEARCH_ENTITY_ID) {
			action = constants.ACTION_SEARCH;
		}
		if (highlightedEntity.key > 0) {
			retrievePersonAttributesResponseVO = await invokeService("basic/retrievePersonAttributes", highlightedEntity.key);
			highlightedEntity.attributes.label = retrievePersonAttributesResponseVO.label;
			photoImageElement = document.getElementById("sidebarphotoImg");
			document.getElementById("sidebarphotoInput").value = '';
			if (isAppReadOnly) {
				document.getElementById("sidebarphotoInput").setAttribute("disabled", "");
			}
			photoImageElement.parentElement.setAttribute("style", "display: block");
			if (retrievePersonAttributesResponseVO.photo == null) {
				photoImageElement.removeAttribute("src");
			}
			else {
				photoImageElement.setAttribute("src", "data:image/jpg;base64," + retrievePersonAttributesResponseVO.photo);
			}
			attributeValueVOList = retrievePersonAttributesResponseVO.attributeValueVOList;
			isEditEnabled = retrievePersonAttributesResponseVO.manageAccess;
		} else {
			isEditEnabled = true; // New Person
		}
	}
	else {
		isPersonNode = false;
		if (highlightedEntity.key > 0) {
			retrieveRelationAttributesResponseVO = await invokeService("basic/retrieveRelationAttributes", highlightedEntity.key);
			attributeValueVOList = retrieveRelationAttributesResponseVO.attributeValueVOList;
			person1GenderDVId = retrieveRelationAttributesResponseVO.person1GenderDVId;
			person2GenderDVId = retrieveRelationAttributesResponseVO.person2GenderDVId;
			person1AsPerRelationId = retrieveRelationAttributesResponseVO.person1Id;
			relationGroup = retrieveRelationAttributesResponseVO.relationGroup;
		}
		else {
			if (!highlightedEntity.key.startsWith("S")) {
				alert("Debug: Scenario when edge id equals 0!");
			}
			return;
		}
		isEditEnabled = !isAppReadOnly;
	}
	
	highlightedEntity.attributes.color = constants.HIGHLIGHT_COLOR;
	if (!isPersonNode) enterEdgeColor = highlightedEntity.attributes.color;
	
	rightBarElement = document.getElementById("sidebarbody");
	/* Current attribute values from back-end */
	for (let attributeValueVO of attributeValueVOList) {
		attributeValueBlockElement = document.createElement("fieldset");
		rightBarElement.appendChild(attributeValueBlockElement);
		attributeValueBlockElement.appendChild(document.createTextNode(attributeValueVO.attributeName));
		createAttributeBlock(attributeValueBlockElement, attributeValueVO, action, isEditEnabled);
	}
	/* Mandatory attributes for new entity */
	if (action == constants.ACTION_SAVE && attributeValueVOList.length == 0) {
		for (let attributeDomainValueVO of (isPersonNode ? paDomainValueVOList : raDomainValueVOList)) {
			if (attributeDomainValueVO.isInputMandatory) {
				attributeValueBlockElement = document.createElement("fieldset");
				rightBarElement.appendChild(attributeValueBlockElement);
				attributeValueBlockElement.appendChild(document.createTextNode(attributeDomainValueVO.value));
				createAttributeBlock(attributeValueBlockElement, {attributeDvId: attributeDomainValueVO.id}, action, isEditEnabled);
			}
		}
	}
	s.refresh();
	
	for (let attributeValueBlkElement of rightBarElement.querySelectorAll("fieldset[attributedvid]")) {
		attributeDvId = parseInt(attributeValueBlkElement.getAttribute("attributedvid"));
		if (attributeDvId == constants.RELATION_ATTRIBUTE_DV_ID_PERSON1_FOR_PERSON2) {
			person1ForPerson2SelectElement = attributeValueBlkElement.querySelector("select[name=RelName]");
		}
		else if (attributeDvId == constants.RELATION_ATTRIBUTE_DV_ID_PERSON2_FOR_PERSON1) {
			person2ForPerson1SelectElement = attributeValueBlkElement.querySelector("select[name=RelName]");
		}
	}
	
	/* Set default value for person2ForPerson1 */
	/* Beware: This code may go out of sync with what is configured */
	if (!isPersonNode && person1GenderDVId != null && person2GenderDVId != null) {
		person1ForPerson2SelectElement.onchange = function() {
			person1ForPerson2RelationDVId = parseInt(person1ForPerson2SelectElement.options[person1ForPerson2SelectElement.selectedIndex].value);
			switch(true) {
				case person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_HUSBAND_DV_ID && person2GenderDVId == constants.GENDER_FEMALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_WIFE_DV_ID;
					break;
				case person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_WIFE_DV_ID && person2GenderDVId == constants.GENDER_MALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_HUSBAND_DV_ID;
					break;
				case (person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_FATHER_DV_ID || person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_MOTHER_DV_ID) && person2GenderDVId == constants.GENDER_MALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_SON_DV_ID;
					break;
				case (person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_FATHER_DV_ID || person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_MOTHER_DV_ID) && person2GenderDVId == constants.GENDER_FEMALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_DAUGHTER_DV_ID;
					break;
				case (person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_SON_DV_ID || person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_DAUGHTER_DV_ID) && person2GenderDVId == constants.GENDER_MALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_FATHER_DV_ID;
					break;
				case (person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_SON_DV_ID || person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId == constants.RELATION_NAME_DAUGHTER_DV_ID) && person2GenderDVId == constants.GENDER_FEMALE_DV_ID:
					person2ForPerson1SelectElement.value = constants.RELATION_NAME_MOTHER_DV_ID;
					break;
				/* On error do nothing; Validations come later */
			}
		}
	}
	
	document.getElementById("sidebarbuttons").innerHTML = "<button id='addbutton'" + (action == constants.ACTION_SAVE && !isEditEnabled ? " disabled" : "") + ">+</button>" +
		"<button id='actionbutton'" + (action == constants.ACTION_SAVE && !isEditEnabled ? " disabled" : "") + ">" + translator.getStr("label" + action) + "</button>" +
		(action == constants.ACTION_SEARCH ? "<input type='checkbox' id='isLenient'><label for='isLenient'>" + translator.getStr("labelIsLenient") + "</label>" : "");
	if (action == constants.ACTION_SAVE) {
		if (isPersonNode) {
			document.getElementById("sidebarbuttons").innerHTML += "<button id='deletebutton'" + (isAppReadOnly || highlightedEntity.key == constants.NEW_ENTITY_ID ? " disabled" : "") + ">" + translator.getStr("labelDeletePerson") + "</button>";
			document.getElementById("deletebutton").onclick = async function() {
				if (confirm("Going to delete the Person.")) {
					await invokeService("basic/deletePerson", highlightedEntity.key);
					s.graph.dropNode(highlightedEntity.key);	// The node and each edge that is bound to it
					s.refresh();
					clearSidebar();
					alert("Person DELETED successfully");
				}
			};
		}
		else {
			document.getElementById("sidebarbuttons").innerHTML += "<button id='deletebutton'" + (isAppReadOnly ? " disabled" : "") + ">" + translator.getStr("labelDeleteRelation") + "</button>";
			document.getElementById("deletebutton").onclick = async function() {
				if (confirm("Going to delete the Relation.")) {
					await invokeService("basic/deleteRelation", highlightedEntity.key);
					s.graph.dropEdge(highlightedEntity.key); // The edge
					s.refresh();
					clearSidebar();
					alert("Relation DELETED successfully");
				}
			};
		}
	}
	addButtonElement = document.getElementById("addbutton");
	actionButtonElement = document.getElementById("actionbutton");
	
	addButtonElement.onclick = function() {
		var selectElement, optionElement;
		attributeValueBlockElement = document.createElement("fieldset");
		rightBarElement.appendChild(attributeValueBlockElement);
		
		selectElement = (isPersonNode ? paSelectElement : (relationGroup == constants.RELATION_GROUP_SPOUSE ? raSpSelectElement : raPcSelectElement)).cloneNode(true);
		if (action == constants.ACTION_SEARCH) {
			for (optionElement of paSearchXtraOptions) {
				selectElement.appendChild(optionElement.cloneNode(true));
			}
		}
		attributeValueBlockElement.appendChild(selectElement);
		if (isPersonNode && action == constants.ACTION_SEARCH) {
			selectElement.value = constants.PERSON_ATTRIBUTE_DV_ID_ANY_NAME;
			createAttributeBlock(attributeValueBlockElement, {attributeDvId: constants.PERSON_ATTRIBUTE_DV_ID_ANY_NAME}, action, isEditEnabled);
		}
		else {
			createAttributeBlock(attributeValueBlockElement, {attributeDvId: parseInt(selectElement.options[0].value)}, action, isEditEnabled);
		}
		selectElement.onchange = function() {
			var avbChildNodeList, skippedNodeCount, avbChildNode;
			avbChildNodeList = selectElement.parentElement.childNodes;
			skippedNodeCount = 0;
			while (avbChildNodeList.length > skippedNodeCount) {
				avbChildNode = avbChildNodeList[skippedNodeCount];
				if (avbChildNode.nodeName != "SELECT" || !avbChildNode.hasAttribute("name") || avbChildNode.getAttribute("name") != "attributenames") {
					avbChildNode.remove();
				}
				else {
					skippedNodeCount = skippedNodeCount + 1;
				}
			}
			createAttributeBlock(selectElement.parentElement, {attributeDvId: parseInt(selectElement.options[selectElement.selectedIndex].value)}, action, isEditEnabled);
		};
		
	};
	
	switch(action) {
		case constants.ACTION_SAVE:
			if (isPersonNode) {
				document.getElementById("sidebartitle").textContent = translator.getStr("labelDetails") + ": " + (highlightedEntity.key == constants.NEW_ENTITY_ID ? translator.getStr("labelNewPerson") : highlightedEntity.attributes.label);
			}
			else {
				person1Node = highlightedEntity.source;
				person2Node = highlightedEntity.target;
				document.getElementById("sidebartitle").textContent = translator.getStr("labelDetailsOfRelation") + ": " +
						(person1Node.key == person1AsPerRelationId ? (person1Node.attributes.label + " " + translator.getStr("labelAnd") + " " + person2Node.attributes.label) : (person2Node.attributes.label + " " + translator.getStr("labelAnd") + " " + person1Node.attributes.label));
			}
			break;
		case constants.ACTION_SEARCH:
			document.getElementById("sidebartitle").textContent = translator.getStr("labelPersonSearchCriteria");
			break;
	}
	
	actionButtonElement.onclick = async function() {
		var attributeValueVOList, attributeValueVO, saveAttributesRequestVO, inputElements;
		var attributeVsValueListMap, attributeDvId, attributeDomainValueVO;
		var ind1, ind2, attributeValueNBlkList, searchedPersonId, saveAttributesResponseVO;
		var toInsertAttributeValueDummyId, relationPerson1ForPerson2, relationPerson2ForPerson1, relationSubType;
		var searchResultsWindowElement, searchResultsTableElement, searchCloseButtonElement, searchReturnButtonElement, searchResultsVO, searchResultsList, srInputElement, srRowNo, searchMessageElement;
		var isTranslatable, personIdsList, photoInputElement, file, personSearchCriteriaVO, dsource, indexAdjustment;
		
		attributeValueVOList = [];
		attributeVsValueListMap = new Map();
		saveAttributesRequestVO = {entityId: highlightedEntity.key, attributeValueVOList: attributeValueVOList};
		toInsertAttributeValueDummyId = 1;
		
		for (let attributeValueBlkElement of rightBarElement.querySelectorAll("fieldset[attributedvid]")) {
			inputElements = attributeValueBlkElement.querySelectorAll("input,select:not([name=attributenames])");
			attributeDvId = parseInt(attributeValueBlkElement.getAttribute("attributedvid"));
			attributeDomainValueVO = domainValueVOMap.get(attributeDvId);
			indexAdjustment = 0;
			if (action == constants.ACTION_SAVE && document.getElementById("language").value != constants.DEFAULT_LANGUAGE_DV_ID &&
					attributeDomainValueVO.isScriptConvertible != null && attributeDomainValueVO.isScriptConvertible) {
				isTranslatable = true;
				indexAdjustment++;
			} else {
				isTranslatable = false;
			}
			attributeValueVO = {attributeDvId: attributeDvId, id: null,
				attributeValue: (inputElements[0].tagName == "INPUT" ? inputElements[0].value : inputElements[0].options[inputElements[0].selectedIndex].value),
				translatedValue: (isTranslatable ? inputElements[1].value : null), valueApproximate: null, startDate: null, endDate: null, private: null, maybeNotRegistered: null};
			if (action == constants.ACTION_SAVE) {
				if (attributeValueBlkElement.hasAttribute("attributevalueid")) {
					attributeValueVO.id = parseInt(attributeValueBlkElement.getAttribute("attributevalueid"));
				}
				else {
					toInsertAttributeValueDummyId--;
					attributeValueVO.id = toInsertAttributeValueDummyId;
					attributeValueBlkElement.setAttribute("attributevalueid", toInsertAttributeValueDummyId);
				}
				attributeValueVO.valueApproximate = inputElements[1 + indexAdjustment].checked;
				if (attributeDomainValueVO.repetitionType != constants.FLAG_ATTRIBUTE_REPETITION_NOT_ALLOWED) {
					if (inputElements[2 + indexAdjustment].value != "") {
						attributeValueVO.startDate = pikadayToIsoFormat(inputElements[2 + indexAdjustment].value);
					}
					if (inputElements[3 + indexAdjustment].value != "") {
						attributeValueVO.endDate = pikadayToIsoFormat(inputElements[3 + indexAdjustment].value);
					}
					indexAdjustment = indexAdjustment + 2;
				}
				attributeValueVO.isPrivate = inputElements[2 + indexAdjustment].checked;
			} else {
				attributeValueVO.maybeNotRegistered = inputElements[1].checked;
			}
			attributeValueVOList.push(attributeValueVO);
			if (attributeVsValueListMap.has(attributeDvId)) {
				attributeValueNBlkList = attributeVsValueListMap.get(attributeDvId);
			}
			else {
				attributeValueNBlkList = [];
				attributeVsValueListMap.set(attributeDvId, attributeValueNBlkList);
			}
			attributeValueNBlkList.push({attributeValueVO: attributeValueVO, attributeValueBlkElement: attributeValueBlkElement})
		}
		if (action == constants.ACTION_SAVE) {
			// Validations
			for (let attributeDomainValueVO of (isPersonNode ? paDomainValueVOList : raDomainValueVOList)) {
				if (attributeDomainValueVO.isInputMandatory && !attributeVsValueListMap.has(attributeDomainValueVO.id)) {
					alert(attributeDomainValueVO.value + " is a mandatory property");
					return;
				}
				if (attributeDomainValueVO.repetitionType == constants.FLAG_ATTRIBUTE_REPETITION_NON_OVERLAPPING_ALLOWED && attributeVsValueListMap.has(attributeDomainValueVO.id)) {
					attributeValueNBlkList = attributeVsValueListMap.get(attributeDomainValueVO.id);
					for (ind1 = 0; ind1 < attributeValueNBlkList.length - 1; ind1++) {
						for (ind2 = ind1 + 1; ind2 < attributeValueNBlkList.length; ind2++) {
							if (areOverlappingDates(attributeValueNBlkList[ind1].attributeValueVO.startDate, attributeValueNBlkList[ind1].attributeValueVO.endDate, attributeValueNBlkList[ind2].attributeValueVO.startDate, attributeValueNBlkList[ind2].attributeValueVO.endDate)) {
								alert("Multiple values with effective period overlapping not allowed for " + attributeDomainValueVO.value);
								return;
							}
						}
					}
				}
			}
			for (let keyValueArr of attributeVsValueListMap.entries()) {
				attributeDomainValueVO = domainValueVOMap.get(keyValueArr[0]);
				if (attributeDomainValueVO.repetitionType == constants.FLAG_ATTRIBUTE_REPETITION_NOT_ALLOWED && keyValueArr[1].length > 1) {
					alert("Multiple Values not allowed for " + attributeDomainValueVO.value);
					return;
				}
				for (let value of keyValueArr[1]) {
					if (value.attributeValueVO.attributeValue == "") {
						value.attributeValueBlkElement.className = "attrValError";
						alert("Blank is not a valid value");
						return;
					}
					if (document.getElementById("language").value != constants.DEFAULT_LANGUAGE_DV_ID &&
							attributeDomainValueVO.isScriptConvertible != null && attributeDomainValueVO.isScriptConvertible &&
							value.attributeValueVO.translatedValue == "") {
						value.attributeValueBlkElement.className = "attrValError";
						alert("Blank is not a valid translation");
						return;
					}
					if (value.attributeValueVO.startDate != null && value.attributeValueVO.endDate != null && new Date(value.attributeValueVO.startDate) > new Date(value.attributeValueVO.endDate)) {
						value.attributeValueBlkElement.className = "attrValError";
						alert("Start date cannot be after end date");
						return;
					}
				}
			}
			if (!isPersonNode) {
				relationPerson1ForPerson2 = attributeVsValueListMap.get(constants.RELATION_ATTRIBUTE_DV_ID_PERSON1_FOR_PERSON2)[0].attributeValueVO.attributeValue;
				relationPerson2ForPerson1 = attributeVsValueListMap.get(constants.RELATION_ATTRIBUTE_DV_ID_PERSON2_FOR_PERSON1)[0].attributeValueVO.attributeValue;
				attributeDomainValueVO = domainValueVOMap.get(parseInt(relationPerson1ForPerson2));
				if (!constants.VALID_RELATIONS_JSON.includes(JSON.stringify([relationPerson1ForPerson2, relationPerson2ForPerson1]))) {
					alert("Invalid pair of relations");
					return;
				}
				if (attributeVsValueListMap.has(constants.RELATION_ATTRIBUTE_DV_ID_RELATION_SUB_TYPE)) {
					relationSubType = attributeVsValueListMap.get(constants.RELATION_ATTRIBUTE_DV_ID_RELATION_SUB_TYPE)[0].attributeValueVO.attributeValue;
					if (attributeDomainValueVO.relationGroup == constants.RELATION_GROUP_PARENT_CHILD && !constants.VALID_RELSUBTYPES_PARENT_CHILD.includes(relationSubType) ||
						attributeDomainValueVO.relationGroup == constants.RELATION_GROUP_SPOUSE && !constants.VALID_RELSUBTYPES_SPOUSE.includes(relationSubType)) {
						alert("Invalid relation sub type");
						return;
					}
				}
				/* Beware: The following validation may go out of sync with what is configured */
				person1ForPerson2RelationDVId = parseInt(person1ForPerson2SelectElement.options[person1ForPerson2SelectElement.selectedIndex].value);
				person2ForPerson1RelationDVId = parseInt(person2ForPerson1SelectElement.options[person2ForPerson1SelectElement.selectedIndex].value);
				if (person1GenderDVId == constants.GENDER_MALE_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_HUSBAND_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_FATHER_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_SON_DV_ID ||
					person1GenderDVId == constants.GENDER_FEMALE_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_WIFE_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_MOTHER_DV_ID && person1ForPerson2RelationDVId != constants.RELATION_NAME_DAUGHTER_DV_ID ||
					person2GenderDVId == constants.GENDER_MALE_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_HUSBAND_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_FATHER_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_SON_DV_ID ||
					person2GenderDVId == constants.GENDER_FEMALE_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_WIFE_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_MOTHER_DV_ID && person2ForPerson1RelationDVId != constants.RELATION_NAME_DAUGHTER_DV_ID) {
						alert("Relation is not appropriate for the Gender");
						return;
				}
			}
		}
		switch(action) {
			case constants.ACTION_SAVE:
				if (isPersonNode) {
					photoInputElement = document.getElementById("sidebarphotoInput");
					if ('files' in photoInputElement) {
						switch(photoInputElement.files.length) {
							case 0:
								break;
							case 1:
								file = photoInputElement.files[0];
								if (!file.name.toLowerCase().endsWith(".jpg") && !file.name.toLowerCase().endsWith(".png")) {
									alert("Only JPG and PNG files are allowed");
									return;
								}
								if (file.size > 1048576) { // 1 MB
									alert("Only file of maximum size 1 MB allowed");
									return;
								}
								saveAttributesRequestVO.photo = await fileToByteArray(file);
								break;
							default:
								alert("Only one photo is permitted");
								return;
						}
					}
				}
				dsource = sourceOfData();
				if (dsource == "error") {
					return;
				}
				saveAttributesRequestVO.sourceId = dsource;
				saveAttributesResponseVO = await invokeService((isPersonNode ? "basic/savePersonAttributes" : "basic/saveRelationAttributes"), saveAttributesRequestVO);
				toInsertAttributeValueDummyId = 1;
				for (let insertedAttributeValueId of saveAttributesResponseVO.insertedAttributeValueIdList) {
					toInsertAttributeValueDummyId--;
					attributeValueBlkElement = rightBarElement.querySelector("fieldset[attributedvid][attributevalueid='" + toInsertAttributeValueDummyId + "']");
					if (attributeValueBlkElement == null) {
						alert("Saved values are not properly refreshed on the screen. Please click on the " + (isPersonNode ? "node" : "edge") + " again.");
						return;
					}
					attributeValueBlkElement.setAttribute("attributevalueid", insertedAttributeValueId);
				}
				alert("Saved");
				// document.getElementById("deletebutton").removeAttribute("disabled");
				if (isPersonNode && highlightedEntity.key == constants.NEW_ENTITY_ID) {
					s.graph.dropNode(constants.NEW_ENTITY_ID);
					s.graph.addNode(saveAttributesResponseVO.entityId, {
						size: 5.0,
						x: Math.random() * 10,
						y: Math.random() * 10,
						dX: 0,
						dY: 0
					});
					highlightedEntity = s.graph._nodes.get(""+saveAttributesResponseVO.entityId);
					highlightedEntity.attributes.color = constants.HIGHLIGHT_COLOR;
					if (!isPersonNode) enterEdgeColor = highlightedEntity.attributes.color;
				}
				highlightedEntity.attributes.label = (isPersonNode ? attributeVsValueListMap.get(constants.PERSON_ATTRIBUTE_DV_ID_FIRST_NAME)[0].attributeValueVO.attributeValue :
					domainValueVOMap.get(parseInt(attributeVsValueListMap.get(constants.RELATION_ATTRIBUTE_DV_ID_PERSON1_FOR_PERSON2)[0].attributeValueVO.attributeValue)).value + "-" + domainValueVOMap.get(parseInt(attributeVsValueListMap.get(constants.RELATION_ATTRIBUTE_DV_ID_PERSON2_FOR_PERSON1)[0].attributeValueVO.attributeValue)).value);
				s.refresh();
				break;
			case constants.ACTION_SEARCH:
				if (attributeValueVOList.length == 0) {
					alert("Specify search criteria");
					return;
				}
				for (let keyValueArr of attributeVsValueListMap.entries()) {
					for (let value of keyValueArr[1]) {
						if (value.attributeValueVO.attributeValue == "") {
							value.attributeValueBlkElement.className = "attrValError";
							alert("Blank is not a valid value");
							return;
						}
					}
				}
				personSearchCriteriaVO = {lenient: document.getElementById("isLenient").checked, attributeValueVOList: attributeValueVOList};
				searchResultsVO = await invokeService("basic/searchPerson", personSearchCriteriaVO);
				if (searchResultsVO.resultsList == null) {
					searchedPersonId = constants.NEW_ENTITY_ID;
				}
				
				if (searchedPersonId == constants.NEW_ENTITY_ID) {
					alert("Person with the specified properties could not be found");
				}
				else {
					searchResultsList = searchResultsVO.resultsList;
					searchResultsWindowElement = document.getElementById("searchresultswindow");
					searchMessageElement = document.getElementById("searchMessage");
					searchResultsTableElement = document.getElementById("searchresultstable");
					searchCloseButtonElement = document.getElementById("searchCloseButton");
					searchReturnButtonElement = document.getElementById("searchReturnButton");
					/* Open the modal window and display search results */
					searchResultsWindowElement.style.display = "block";
					/* When the user clicks anywhere outside of the modal, close it
					window.onclick = function(event) {
						if (event.target == searchResultsWindowElement) {
							searchResultsWindowElement.style.display = "none";
						}
					} */
					searchResultsTableElement.innerHTML = "";
					searchMessageElement.innerText = translator.getStr("messageSearchResults").replace("#resultCount#", searchResultsVO.countInDb).replace("#partialCount#", searchResultsList.length - 1);
					
					srRowNo = -1;
					for (let attributesList of searchResultsList) {
						srRowNo++;
						srRowElement = document.createElement("tr");
						srCellElement = document.createElement("td");
						srRowElement.appendChild(srCellElement);
						if (srRowNo > 0) { // To exclude heading
							srInputElement = document.createElement("input");
							srCellElement.appendChild(srInputElement);
							srInputElement.setAttribute("type", "radio");
							srInputElement.setAttribute("name", "searchresultradio");
							srInputElement.setAttribute("value", attributesList[0]); // personId
						}
						if (srRowNo == 1) { // First data row
							srInputElement.checked=true;
						}
						searchResultsTableElement.appendChild(srRowElement);
						for (let attributeValue of attributesList) {
							srCellElement = document.createElement("td");
							srRowElement.appendChild(srCellElement);
							srCellElement.appendChild(document.createTextNode(attributeValue));
						}
					}
					searchCloseButtonElement.onclick = function() {
						searchResultsWindowElement.style.display = "none";
					}
					searchReturnButtonElement.onclick = async function() {
						searchedPersonId = document.querySelector('input[type="radio"][name="searchresultradio"]:checked').value;
						searchResultsWindowElement.style.display = "none";
						s.graph.dropNode(constants.SEARCH_ENTITY_ID);
						if (s.graph.hasNode(searchedPersonId)) {
							alert("Person exists already");
							doubleClick = 0;
							s.emit('clickNode', eventPayload('node', searchedPersonId));
						}
						else {
							personIdsList = [];
							for (let nodeKey of s.graph.nodes()) {	// TODO: To filterNodes
								if (nodeKey != constants.NEW_ENTITY_ID) {
									personIdsList.push(nodeKey);
								}
							}
							s.graph.addNode(searchedPersonId, {
								size: 5.0,
								x: Math.random() * 10,
								y: Math.random() * 10
							});
							for (let relationVO of await invokeService("basic/retrieveRelationsBetween", {end1PersonId : searchedPersonId, end2PersonIdsList : personIdsList})) {
								s.graph.addEdgeWithKey(
									relationVO.key,
									relationVO.source,
									relationVO.target, {
									label: relationVO.label,
									size: relationVO.size
								});
							}
							doubleClick = 0;
							s.emit('clickNode', eventPayload('node', searchedPersonId));
						}
					}
				}
				break;
		}
	};
	
}

function pikadayToIsoFormat(pDateStr) {
	var pDate, year, month, day;
	pDate = new Date(pDateStr);
	year = pDate.getFullYear();
	month = pDate.getMonth() + 1;
	day = pDate.getDate();
	return [year, month < 10 ? "0" + month : month, day < 10 ? "0" + day : day].join('-');
}

function isoToPikadayFormat(iDateStr) {
	// This function is required because of the issue https://github.com/Pikaday/Pikaday/issues/655
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var iDate, dayNo;
	iDate = new Date(iDateStr);
	dayNo = iDate.getDate();
	return [days[iDate.getDay()], months[iDate.getMonth()], dayNo < 10 ? "0" + dayNo : dayNo, iDate.getFullYear()].join(" ");
}

function areOverlappingDates(startDate1Str, endDate1Str, startDate2Str, endDate2Str) {
	var startDate1, endDate1, startDate2, endDate2;
	if (startDate1Str != null) {
		startDate1 = new Date(startDate1Str);
	}
	if (endDate1Str != null) {
		endDate1 = new Date(endDate1Str);
	}
	if (startDate2Str != null) {
		startDate2 = new Date(startDate2Str);
	}
	if (endDate2Str != null) {
		endDate2 = new Date(endDate2Str);
	}
	if ((startDate1Str === null || endDate2Str === null || startDate1 <= endDate2) &&
		(endDate1Str === null || startDate2Str === null || endDate1 >= startDate2)) {
		return true;
	}
	return false;
}

function createAttributeBlock(attributeValueBlockElement, attributeValueVO, action, isEditEnabled) {
	var valueElement, isApproximateElement, startDateElement, endDateElement, isPrivateElement, isMaybeNotRegisteredElement;
	var startDatePicker, endDatePicker, attributeDomainValueVO;
	var deleteBlockImageElement, regEx;
	
	attributeDomainValueVO = domainValueVOMap.get(attributeValueVO.attributeDvId);
	attributeValueBlockElement.setAttribute("attributedvid", attributeValueVO.attributeDvId);
	if (attributeValueVO.id != undefined) {
		attributeValueBlockElement.setAttribute("attributevalueid", attributeValueVO.id);
	}
	if (action == constants.ACTION_SAVE && !isEditEnabled) {
		attributeValueBlockElement.setAttribute("disabled", "");
	}
	else {
		attributeValueBlockElement.appendChild(document.createTextNode("     "));
		deleteBlockImageElement = document.createElement("img");
		attributeValueBlockElement.appendChild(deleteBlockImageElement);
		deleteBlockImageElement.setAttribute("src","img/delete.png");
		deleteBlockImageElement.setAttribute("alt", translator.getStr("labelDeleteProperty"));
		deleteBlockImageElement.setAttribute("width","5%");
		deleteBlockImageElement.setAttribute("height","3%");
		deleteBlockImageElement.onclick = async function() {
			if (confirm("Going to delete the Property.")) {
				attributeValueBlockElement.remove();
			}
		};
	}
	
	attributeValueBlockElement.appendChild(document.createElement("br"));
	
	attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelValue") + ": "));
	
	if (attributeDomainValueVO.attributeDomain == "") {
		var loopInd, isTranslatable;
		
		if (action == constants.ACTION_SAVE && document.getElementById("language").value != constants.DEFAULT_LANGUAGE_DV_ID &&
				attributeDomainValueVO.isScriptConvertible != null && attributeDomainValueVO.isScriptConvertible) {
			isTranslatable = true;
		} else {
			isTranslatable = false;
		}
		for (loopInd = 1; loopInd <= (isTranslatable ? 2 : 1); loopInd++) {
			valueElement = document.createElement("input");
			valueElement.setAttribute("type","text");
			if (loopInd == 1 && attributeValueVO.attributeValue != undefined) {
				valueElement.setAttribute("value", attributeValueVO.attributeValue);
			}
			if (loopInd == 2 && attributeValueVO.translatedValue != undefined) {
				valueElement.setAttribute("value", attributeValueVO.translatedValue);
			}
			if (attributeDomainValueVO.validationJsRegEx != null && attributeDomainValueVO.validationJsRegEx != "") {
				regEx = new RegExp(attributeDomainValueVO.validationJsRegEx, 'u');
				valueElement.onkeypress = function() {return blockSpecialCharOnKeyPress(event, regEx);}
				regEx = new RegExp('^(' + attributeDomainValueVO.validationJsRegEx + ')*$', 'u');
				valueElement.onpaste = function() {return blockSpecialCharOnPaste(event, regEx);}
			}
			if (loopInd == 2) {
				attributeValueBlockElement.appendChild(document.createElement("br"));
			}
			attributeValueBlockElement.appendChild(valueElement);
		}
	} else {
		valueElement = selectElementMap.get(attributeDomainValueVO.attributeDomain).cloneNode(true);
		if (attributeValueVO.attributeValue != undefined) {
			valueElement.value = domainValueVOMap.get(parseInt(attributeValueVO.attributeValue)).id;
		}
		attributeValueBlockElement.appendChild(valueElement);
	}

	if (action != constants.ACTION_SAVE) {
		attributeValueBlockElement.appendChild(document.createElement("br"));
		
		attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelIsMaybeNotRegistered") + ": "));
		isMaybeNotRegisteredElement = document.createElement("input");
		attributeValueBlockElement.appendChild(isMaybeNotRegisteredElement);
		isMaybeNotRegisteredElement.setAttribute("type","checkbox");
	
		return;
	}
	
	attributeValueBlockElement.appendChild(document.createElement("br"));
	
	attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelIsApproximate") + ": "));
	isApproximateElement = document.createElement("input");
	attributeValueBlockElement.appendChild(isApproximateElement);
	isApproximateElement.setAttribute("type","checkbox");
	if (attributeValueVO.valueApproximate != undefined && attributeValueVO.valueApproximate) {
		isApproximateElement.setAttribute("checked", "");
	}
	
	if (attributeDomainValueVO.repetitionType != constants.FLAG_ATTRIBUTE_REPETITION_NOT_ALLOWED) {
		attributeValueBlockElement.appendChild(document.createElement("br"));
		
		attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelStartDate") + ": "));
		startDateElement = document.createElement("input");
		attributeValueBlockElement.appendChild(startDateElement);
		startDateElement.setAttribute("type","text");
		startDateElement.classList.add("startenddate");
		startDatePicker = new Pikaday({field: startDateElement, theme: "dark-theme", minDate: new Date(1001, 0, 1)});
		if (attributeValueVO.startDate != undefined) {
			startDateElement.setAttribute("value", isoToPikadayFormat(attributeValueVO.startDate));
		}
		
		attributeValueBlockElement.appendChild(document.createElement("br"));
		
		attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelEndDate") + ": "));
		endDateElement = document.createElement("input");
		attributeValueBlockElement.appendChild(endDateElement);
		endDateElement.setAttribute("type","text");
		endDateElement.classList.add("startenddate");
		endDatePicker = new Pikaday({field: endDateElement, theme: "dark-theme", minDate: new Date(1001, 0, 1)});
		if (attributeValueVO.endDate != undefined) {
			endDateElement.setAttribute("value", isoToPikadayFormat(attributeValueVO.endDate));
		}
	}
	
	attributeValueBlockElement.appendChild(document.createElement("br"));
	
	attributeValueBlockElement.appendChild(document.createTextNode(translator.getStr("labelIsPrivate") + ": "));
	isPrivateElement = document.createElement("input");
	attributeValueBlockElement.appendChild(isPrivateElement);
	isPrivateElement.setAttribute("type","checkbox");
	if (attributeDomainValueVO.privacyRestrictionType != constants.FLAG_ATTRIBUTE_PRIVACY_RESTRICTION_INDIVIDUAL_CHOICE) {
		isPrivateElement.setAttribute("disabled","");
	}
	if (attributeDomainValueVO.privacyRestrictionType == constants.FLAG_ATTRIBUTE_PRIVACY_RESTRICTION_PRIVATE_ONLY ||
			attributeDomainValueVO.privacyRestrictionType == constants.FLAG_ATTRIBUTE_PRIVACY_RESTRICTION_INDIVIDUAL_CHOICE && attributeValueVO.isPrivate != undefined && attributeValueVO.isPrivate) {
		isPrivateElement.setAttribute("checked", "");
	}
	
	if (!attributeDomainValueVO.isInputAsAttribute) {
		valueElement.setAttribute("disabled","");
		isApproximateElement.setAttribute("disabled","");
		if (attributeDomainValueVO.repetitionType != constants.FLAG_ATTRIBUTE_REPETITION_NOT_ALLOWED) {
			startDateElement.setAttribute("disabled","");
			endDateElement.setAttribute("disabled","");
		}
		isPrivateElement.setAttribute("disabled","");
	}
}

function addPerson(personId = constants.NEW_ENTITY_ID) {
	if (!s.graph.hasNode(personId)) {
		s.graph.addNode(personId, {
			size: 5.0,
			x: Math.random() * 10,
			y: Math.random() * 10,
		});
		if (personId == constants.NEW_ENTITY_ID) {
			s.graph._nodes.get(personId).attributes.label = translator.getStr('labelYetToBeAdded');
		}
	}
	doubleClick = 0;
	s.emit('clickNode', eventPayload('node', personId));
}

function searchPerson() {
	if (!s.graph.hasNode(constants.SEARCH_ENTITY_ID)) {
		s.graph.addNode(constants.SEARCH_ENTITY_ID, {
			size: 5.0,
			x: Math.random() * 10,
			y: Math.random() * 10,
			label: translator.getStr('labelYetToBeSearched')
		});
	}
	doubleClick = 0;
	s.emit('clickNode', eventPayload('node', constants.SEARCH_ENTITY_ID));
}

function clearGraph() {
	s.graph.clear();
	s.refresh();
	clearSidebar();
}

function clearSidebar() {
	document.getElementById("sidebartitle").innerHTML = "";
	document.getElementById("sidebarbuttons").innerHTML = "";
	document.getElementById("sidebarbody").innerHTML = "";
	document.getElementById("sidebarphoto").setAttribute("style", "display: none");
}

function relatePersons() {
	var rightBarElement, fatherPersonElement, motherPersonElement, childPersonElement, husbandPersonElement, wifePersonElement;
	var actionButtonElement, parentChildRadioElement;
	
	clearSidebar();
	document.getElementById("sidebarbuttons").innerHTML = "<button id='actionbutton'>" + translator.getStr("labelRelate") + "</button>";
	document.getElementById("sidebartitle").textContent = translator.getStr("labelRelatedPersons");

	rightBarElement = document.getElementById("sidebarbody");
	rightBarElement.innerHTML = `<input type="radio" id="PC" name="relGrp" value="PC" checked onclick="switchRelGrp(this);"/>
					<label for="PC">${translator.getStr("labelParentChild")}</label>
					<input type="radio" id="Sp" name="relGrp" value="Sp" onclick="switchRelGrp(this);"/>
					<label for="Sp">${translator.getStr("labelSpouse")}</label>
					<div id="relatedPersons"></div>`;
	parentChildRadioElement = document.getElementById("PC");
	switchRelGrp(parentChildRadioElement);
	
	actionButtonElement = document.getElementById("actionbutton");
	actionButtonElement.onclick = async function() {
		var person1Id, person2Id, relationId, fatherPersonElement, motherPersonElement, childPersonElement, husbandPersonElement, wifePersonElement;
		var selectedRelGrp, dsource;
		
		selectedRelGrp = document.querySelector('input[name="relGrp"]:checked')?.value;
		
		if (selectedRelGrp == "PC") {
			fatherPersonElement = document.getElementById("fatherPerson");
			motherPersonElement = document.getElementById("motherPerson");
			childPersonElement = document.getElementById("childPerson");
			fatherPersonId = parseInt(fatherPersonElement.options[fatherPersonElement.selectedIndex].value);
			motherPersonId = parseInt(motherPersonElement.options[motherPersonElement.selectedIndex].value);
			childPersonId = parseInt(childPersonElement.options[childPersonElement.selectedIndex].value);
			if (fatherPersonId == childPersonId || motherPersonId == childPersonId) {
				alert("Same person cannot be part of a relation");
				return;
			}
			if (fatherPersonId == -1 && motherPersonId == -1) {
				alert("One of Father, Mother is required");
				return;
			}
			dsource = sourceOfData();
			if (dsource == "error") {
				return;
			}
			if (motherPersonId != -1) {
				relationId = await saveRelation({person1Id: motherPersonId, person2Id: childPersonId, person1ForPerson2: constants.RELATION_NAME_MOTHER_DV_ID, sourceId: dsource});
			}
			// Beware: The above and below saveRelation are NOT part of a single TRANSACTION
			if (fatherPersonId != -1) {
				relationId = await saveRelation({person1Id: fatherPersonId, person2Id: childPersonId, person1ForPerson2: constants.RELATION_NAME_FATHER_DV_ID, sourceId: dsource});
			}
		} else {
			husbandPersonElement = document.getElementById("husbandPerson");
			wifePersonElement = document.getElementById("wifePerson");
			husbandPersonId = parseInt(husbandPersonElement.options[husbandPersonElement.selectedIndex].value);
			wifePersonId = parseInt(wifePersonElement.options[wifePersonElement.selectedIndex].value);
			relationId = await saveRelation({person1Id: husbandPersonId, person2Id: wifePersonId, person1ForPerson2: '' + constants.RELATION_NAME_HUSBAND_DV_ID});
		}
	}
}

async function saveRelation(relatedPersonsVO) {
	relationVO = await invokeService("basic/saveRelation", relatedPersonsVO);
	s.graph.addEdgeWithKey(
		relationVO.key,
		relationVO.source,
		relationVO.target, {
		label: relationVO.label,
		size: relationVO.size
	});
	s.emit('clickEdge', eventPayload('edge', relationVO.key));
}

async function switchRelGrp(clickedRadioElement) {
	var relatedPersonsElement;
	
	await createPersonDropdown();
	relatedPersonsElement = document.getElementById("relatedPersons");
	relatedPersonsElement.innerHTML = "";
	
	if (clickedRadioElement.value == "PC") {
		
		relatedPersonsElement.appendChild(document.createTextNode(translator.getStr("labelFather") + ": "));
		fatherPersonElement = malePersonsSelectElement.cloneNode(true);
		makeDropdownOptional(fatherPersonElement);
		fatherPersonElement.setAttribute("id", "fatherPerson");
		relatedPersonsElement.appendChild(fatherPersonElement);
		relatedPersonsElement.appendChild(document.createElement("br"));
		
		relatedPersonsElement.appendChild(document.createTextNode(translator.getStr("labelMother") + ": "));
		motherPersonElement = femalePersonsSelectElement.cloneNode(true);
		makeDropdownOptional(motherPersonElement);
		motherPersonElement.setAttribute("id", "motherPerson");
		relatedPersonsElement.appendChild(motherPersonElement);
		relatedPersonsElement.appendChild(document.createElement("br"));
		
		relatedPersonsElement.appendChild(document.createTextNode(translator.getStr("labelSonDaughter") + ": "));
		childPersonElement = allPersonsSelectElement.cloneNode(true);
		childPersonElement.setAttribute("id", "childPerson");
		relatedPersonsElement.appendChild(childPersonElement);
		relatedPersonsElement.appendChild(document.createElement("br"));
	}
	else {
		relatedPersonsElement.appendChild(document.createTextNode(translator.getStr("labelHusband") + ": "));
		husbandPersonElement = malePersonsSelectElement.cloneNode(true);
		husbandPersonElement.setAttribute("id", "husbandPerson");
		relatedPersonsElement.appendChild(husbandPersonElement);
		relatedPersonsElement.appendChild(document.createElement("br"));
		
		relatedPersonsElement.appendChild(document.createTextNode(translator.getStr("labelWife") + ": "));
		wifePersonElement = femalePersonsSelectElement.cloneNode(true);
		wifePersonElement.setAttribute("id", "wifePerson");
		relatedPersonsElement.appendChild(wifePersonElement);
		relatedPersonsElement.appendChild(document.createElement("br"));
	}
}

async function ascertainRelation() {
	var actionButtonElement;
	
	clearSidebar();
	document.getElementById("sidebarbuttons").innerHTML = "<button id='actionbutton'>" + translator.getStr("labelAscertain") + "</button>";
	document.getElementById("sidebartitle").textContent = translator.getStr("labelAscertainRelation");

	await getPersonsPair();
	
	actionButtonElement = document.getElementById("actionbutton");
	actionButtonElement.onclick = async function() {
		var person1Id, person2Id, relationId, person1Element, person2Element;
		var exclrelElement, excludeRelationIdCsv, exclPersElement, excludePersonIdCsv;
		person1Element = document.getElementById("person1");
		person2Element = document.getElementById("person2");
		exclrelElement = document.getElementById("exclrelids");
		exclPersElement = document.getElementById("exclpersids");
		person1Id = parseInt(person1Element.options[person1Element.selectedIndex].value);
		person2Id = parseInt(person2Element.options[person2Element.selectedIndex].value);
		excludeRelationIdCsv = exclrelElement.value;
		excludePersonIdCsv = exclPersElement.value;
		if (person1Id == person2Id) {
			alert("Same person cannot be part of a relation");
			return;
		}
		s.graph.clear();
		s.graph.import(await invokeService("algo/retrieveRelationPath", {person1Id: person1Id, person2Id: person2Id, excludeRelationIdCsv: excludeRelationIdCsv, excludePersonIdCsv: excludePersonIdCsv}, timeout_ms=50000));
		s.refresh();
		await getPersonsPair(person1Id, person2Id, excludeRelationIdCsv, excludePersonIdCsv);
	}
}

async function getPersonsPair(person1Id, person2Id, excludeRelationIdCsv, excludePersonIdCsv) {
	var rightBarElement, person1Element, person2Element;
	var exclrelElement, exclPersElement;

	await createPersonDropdown();
	rightBarElement = document.getElementById("sidebarbody");
	
	rightBarElement.innerHTML = "";
	rightBarElement.appendChild(document.createTextNode(translator.getStr("labelPerson") + " 1: "));
	person1Element = allPersonsSelectElement.cloneNode(true);
	person1Element.setAttribute("id", "person1");
	if (person1Id != null) {
		person1Element.value = person1Id;
	}
	rightBarElement.appendChild(person1Element);
	
	rightBarElement.appendChild(document.createElement("br"));
	rightBarElement.appendChild(document.createTextNode(translator.getStr("labelPerson") + " 2: "));
	person2Element = allPersonsSelectElement.cloneNode(true);
	person2Element.setAttribute("id", "person2");
	if (person2Id != null) {
		person2Element.value = person2Id;
	}
	rightBarElement.appendChild(person2Element);
	
	rightBarElement.appendChild(document.createElement("br"));
	rightBarElement.appendChild(document.createTextNode(translator.getStr("labelExcludeRelations") + ": "));
	exclrelElement = document.createElement("input");
	exclrelElement.setAttribute("type","text");
	exclrelElement.setAttribute("id", "exclrelids");
	if (excludeRelationIdCsv != null) {
		exclrelElement.value = excludeRelationIdCsv;
	}
	rightBarElement.appendChild(exclrelElement);
	
	rightBarElement.appendChild(document.createElement("br"));
	rightBarElement.appendChild(document.createTextNode(translator.getStr("labelExcludePersons") + ": "));
	exclPersElement = document.createElement("input");
	exclPersElement.setAttribute("type","text");
	exclPersElement.setAttribute("id", "exclpersids");
	if (excludePersonIdCsv != null) {
		exclPersElement.value = excludePersonIdCsv;
	}
	rightBarElement.appendChild(exclPersElement);
	
}

async function createPersonDropdown()
{
	var optionElement, allPersonIds, allGenders, ind;
	
	allPersonsSelectElement = document.createElement("select");
	allPersonsSelectElement.setAttribute("name","persons");
	allPersonsSelectElement.classList.add("propdrop");
	malePersonsSelectElement = allPersonsSelectElement.cloneNode(true);
	femalePersonsSelectElement = allPersonsSelectElement.cloneNode(true);
	
	allPersonIds = [];
	for (let nodeKey of s.graph.nodes()) {	// TODO: To filterNodes
		if (nodeKey != constants.NEW_ENTITY_ID && nodeKey != constants.SEARCH_ENTITY_ID) {
			allPersonIds.push(nodeKey);
		}
	}
	if (allPersonIds.length == 0) {
		document.getElementById("actionbutton").disabled = true;
		return;
	}
	allGenders = await invokeService("basic/retrieveGendersOfPersons", allPersonIds);
	
	ind = -1;
	for (let nodeEntry of s.graph.nodeEntries()) {	// TODO: To forEachNode
		if (nodeEntry.node != constants.NEW_ENTITY_ID && nodeEntry.node != constants.SEARCH_ENTITY_ID) {
			optionElement = document.createElement("option");
			optionElement.setAttribute("value", nodeEntry.node);
			optionElement.appendChild(document.createTextNode(nodeEntry.attributes.label));
			allPersonsSelectElement.appendChild(optionElement);
			ind++;
			if (allGenders[ind] == constants.GENDER_MALE_DV_ID) {
				malePersonsSelectElement.appendChild(optionElement.cloneNode(true));
			} else if (allGenders[ind] == constants.GENDER_FEMALE_DV_ID) {
				femalePersonsSelectElement.appendChild(optionElement.cloneNode(true));
			}
		}
	}
}

function makeDropdownOptional(ddElement) {
	var optionElement;
	optionElement = document.createElement("option");
	optionElement.setAttribute("value", -1);
	optionElement.appendChild(document.createTextNode("-- " + translator.getStr("labelSelect") + " --"));
	ddElement.prepend(optionElement);
}

function printGraph() {
	downloadAsImage(s, {
		layers: null,	// null = all = ["edges", "nodes", "edgeLabels", "labels"]
		format: "png",	// or jpeg
		fileName: "familytree",
		backgroundColor: "#ffffff",
		width: null,
		height: null,	// TODO: width and height to come from user inputs
		cameraState: null
	});
}

function enDisableDepth(clickedRadioElement) {
	if (clickedRadioElement.value == "view") {
		document.getElementById("depth").removeAttribute("disabled");
	}
	else {
		document.getElementById("depth").setAttribute("disabled","");
	}
}

async function switchProject() {
	var projectVO;
	
	document.getElementById("personCount").innerText = "";
	projectVO = await invokeService("projectuser/switchProject", document.getElementById("project").value);
	isAppReadOnly = projectVO.appReadOnly;
	document.getElementById("personCount").innerText = projectVO.personCount;
	enableDisableRWFunctions();
	alert("Project switched successfully");
}

async function switchLanguage() {
	await invokeService("projectuser/switchLanguage", document.getElementById("language").value);
	translator = await new Language(domainValueVOMap.get(parseInt(document.getElementById("language").value)).languageCode);
	alert("Language switched successfully");
	location.reload();
}

async function logout() {
	await invokeService("projectuser/preLogout", "");
	window.location.href = "./logout";
	/* postLogin will now be called which in-turn will take care of enableDisableRWFunctions */
}

function enableDisableRWFunctions() {
	for (let element of document.querySelectorAll("*[rel-modify-data]")) {
		if (isAppReadOnly) {
			element.setAttribute("disabled","");
		}
		else {
			element.removeAttribute("disabled");
		}
	}
}

async function createProject() {
	var projectName;
	
	projectName = "";
	while (projectName == "") {
		projectName = prompt("Please enter a name for the project", "My Clan");
		if (projectName == null) {	/* Cancel Clicked */
			return;
		}
	}
	document.getElementById("project").value = 	await invokeService("projectuser/createProject", projectName);
	isAppReadOnly = false;
	enableDisableRWFunctions();
	alert("Project created successfully");
}

function loginLogout(loggedInUser) {
	document.getElementById("user").value = loggedInUser;
	if (loggedInUser != null && loggedInUser != "") {
		for (var element of document.getElementsByClassName("unauthenticated")) {
			element.style.display = "none";
		}
		for (var element of document.getElementsByClassName("authenticated")) {
			element.style.display = "inline-block";
		}
	}
	else {
		for (var element of document.getElementsByClassName("unauthenticated")) {
			element.style.display = "inline-block";
		}
		for (var element of document.getElementsByClassName("authenticated")) {
			element.style.display = "none";
		}
	}
}

function blockSpecialCharOnKeyPress(e, regEx) {
	if (! regEx.test(e.key)) {	/* document.all ? e.keyCode : e.which); */
		if (e.preventDefault) {
			e.preventDefault();
		}
		else {
			e.returnValue = false;
		}
	}
}

function blockSpecialCharOnPaste(e, regEx) {
	if (e.clipboardData) {
		content = e.clipboardData.getData('text/plain');
	}
	else if (window.clipboardData) {
		content = window.clipboardData.getData('Text');
	}
	if (! regEx.test(content)) {
		if (e.preventDefault) {
			e.preventDefault();
		}
		else {
			e.returnValue = false;
		}
	}
}

function nodeToFocus() {
	s.getCamera().animatedReset();
}

async function uploadPrData() {
	var actionButtonElement, rightBarElement, pRDataCsvInputElement, formData, dsource;
	
	clearSidebar();
	document.getElementById("sidebarbuttons").innerHTML = "<button id='actionbutton'>" + translator.getStr("labelUpload") + "</button>";
	document.getElementById("sidebartitle").textContent = translator.getStr("labelPersonsNRelationsUpload");

	rightBarElement = document.getElementById("sidebarbody");
	rightBarElement.innerHTML = `
					<input type="radio" id="ufCheckDuplicates" name="uploadFunction" value="ufCheckDuplicates" checked/>
					<label for="ufCheckDuplicates">${translator.getStr("labelUploadFunctionCheckDuplicates")}</label><br/>
					<input type="radio" id="ufStore" name="uploadFunction" value="ufStore"/>
					<label for="ufStore">${translator.getStr("labelUploadFunctionStore")}</label><br/>
					<input id='pRDataCsvInput' type='file' accept='.csv' />`
	
	actionButtonElement = document.getElementById("actionbutton");
	actionButtonElement.onclick = async function() {
		pRDataCsvInputElement = document.getElementById("pRDataCsvInput");
		if ('files' in pRDataCsvInputElement) {
			switch(pRDataCsvInputElement.files.length) {
				case 0:
					break;
				case 1:
					file = pRDataCsvInputElement.files[0];
					if (!file.name.toLowerCase().endsWith(".csv")) {
						alert("Only CSV files are allowed");
						return;
					}
					if (file.size > 1048576) { // 1 MB
						alert("Only file of maximum size 1 MB allowed");
						return;
					}
					let formData = new FormData();
					formData.append("function", document.querySelector('input[type="radio"][name="uploadFunction"]:checked').value);
					dsource = sourceOfData();
					if (dsource == "error") {
						return;
					}
					formData.append("sourceId", dsource == null ? "" : dsource); // Fix to overcome the problem that null is sent as string "null"
					formData.append("file", pRDataCsvInput.files[0]);
					// TODO: Using invokeService instead of fetch?
					await fetch("basic/importPrData", {
							method: "POST",
							body: formData
						})
						.then( res => res.blob() )
						.then( blob => {
							const downloadData = (function() {
								const a = document.createElement("a");
								document.body.appendChild(a);
								a.style = "display: none";
								return function (blob, fileName) {
									const url = window.URL.createObjectURL(blob);
									a.href = url;
									a.download = fileName;
									a.click();
									setTimeout(function() {
										window.URL.revokeObjectURL(url);
									}, 100);
								};
							}());
	
							downloadData(blob, "messages.csv");
						});
					break;
				default:
					alert("Only one file is permitted");
					return;
			}
		}
	}
}

function sourceOfData() {
	var dsource;
	
	dsource = document.getElementById("dsource").value;
	if (dsource == null || dsource == "") {
		return null;
	}
	if (isNaN(dsource)) {
		alert("Source has to be (numeric) user-id")
		return "error";
	}
	return +dsource;
}

function eventPayload(itemType, itemKey) {
	var payload;
	payload = {
		preventSigmaDefault: function () {
			this.event.sigmaDefaultPrevented = true;
		},
		event: {
			x: null,
			y: null,
			original: null,
			sigmaDefaultPrevented: false,
			preventSigmaDefault: function () {
				this.sigmaDefaultPrevented = true;
			},
		}
	}
	if (typeof itemKey == "number") {
		payload[itemType] = ""+itemKey;
	} else {
		payload[itemType] = itemKey;
	}
	return payload;
}