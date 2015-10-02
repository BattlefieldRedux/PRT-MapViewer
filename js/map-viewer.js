$(window).ready(init);


var MAP;
var DRAW_ACTION = [];


function updateQuery(){
	var array = [];
	for(var action in DRAW_ACTION ){
		array.push(DRAW_ACTION[action].copy());
	}
	var url  = new Url; // curent document URL will be used
	url.query.markers = JSURL.stringify(array);
	console.log(url.query.markers);
	history.pushState(null, null, url);
}

function renderFromQuery(){
	var url  = new Url; // curent document URL will be used
	
	if(!url.query.markers)
		return;
	
	var actions = JSURL.parse(url.query.markers);
	console.log(url.query.markers);
	for(var key in actions ){
		if(typeof DrawFactory[actions[key].action] == "function"){
			DRAW_ACTION.push( new DrawFactory[actions[key].action](MAP));
			DRAW_ACTION[DRAW_ACTION.length-1].render(actions[key].render);
		}
			
	}
}

function init(){
	initMap();
	initMapsMenu();
	renderFromQuery();
	
	
	$('#ActionBar .button[role="menu"]').click(toggleMapsMenu);
	$('#ActionBar .button.draw').click(function(){
		var size = DRAW_ACTION.length;
			if(size > 0 && DRAW_ACTION[size-1]){
				DRAW_ACTION[size-1].dispose();
			}
				
			
			if(DrawFactory[$(this).attr('role')]){
					DRAW_ACTION.push(new DrawFactory[$(this).attr('role')](MAP, $(this)));
			}
		
	});
	$('#SearchWrapper input').on('input', function() { 
    filterMapsByName($(this).val());
  });
	
	
	$('body').on('click', '.tile-container', function() { 
    loadMap($(this).attr('data-code'));
  });
}





function initMap(){
	MAP = L.map('MapViewer', {zoomControl: false} ).setView([0, 0], 2);
	L.control.zoom({
     position:'bottomright'
}).addTo(MAP);

	var url  = new Url;
	
	var mapName = url.query.map ? url.query.map : "albasrah";
	loadMap(mapName, true);
	var popup = L.popup();
}

function clearLayers(){
	MAP.eachLayer(function(layer){MAP.removeLayer(layer);} , {});
}

function loadMap(mapName, firstLoad){
	if(typeof firstLoad == 'undefined'){ firstLoad = false;}
	clearLayers();
	
	var url  = new Url;
	url.query.map = mapName;
	if(!firstLoad && url.query.markers){
		DRAW_ACTION = [];
		delete url.query.markers;
	}
	history.pushState(null, null, url);
	
	L.tileLayer('res/tiles/'+mapName+'/{z}/{x}/{y}.jpg', {
			minZoom : 0,
			maxZoom : 5,
			noWrap : true,
			attribution : 'Project Reality / WGP'
	}).addTo(MAP);	
}

function initMapsMenu(){
	$.getJSON("res/map_json/maplist.json", function(metaMap) {

		for (var key in metaMap) {
			var element = metaMap[key];
			var mapName = element.name;
			var mapCode = element.code;

			//If map is already in gallery
			if ($("#Map-" + mapCode).length) {
				//Do nothing
			} else {//If map is not yet in gallery
				var tileMarkup = '<div id="Map-' + mapCode + '" class="tile-container" data-name="' + element.name + '" data-code="' + element.code + '" data-listgm="' + element.listgm + '">';
				tileMarkup += "<div class='tile-card'>";
				tileMarkup += metaMap[key].name;
				tileMarkup += "</div>";
				tileMarkup += "<img class='mix tile' src='res/map_source/" + mapCode + "_minimap.jpg'>";
				tileMarkup += "<div class='meta-information'>";
				tileMarkup += "";
				tileMarkup += "</div></div>";
				$("#Menu").append(tileMarkup);
			}
		}
	}).fail(function(metaMap, textStatus, error) {
		console.error("getJSON failed, status: " + textStatus + ", error: " + error);
	});
}
	
			
function toggleMapsMenu(){
	$('body').toggleClass('selecting-map ');
}

/* ======================================================================================
 * ============            Utility Class to help the DRAW Actions          ==============
 * ======================================================================================
 */
 function DrawAction(mapObject, actionButton){
	 var self = this;
	 self.map = mapObject;
	 if(typeof actionButton != 'undefined'){
		self.button = actionButton;
		self.button.addClass("selected");
	 }
	
	 
	 self.dispose = function dispose(event){
		 //Do nothing
	 }
	 self.copy = function copy(){
		 return {};
	 }
	 self.render = function copy(){
		 self.dispose();
		 //Do nothing
	 }
 }
 
function PathAction(mapObject, actionButton){
	var self = this;
	DrawAction.call(self, mapObject, actionButton);
	
	self.addPoint = function addPoint(e){
		self.lastPoint = e.latlng;
		
		if(typeof self.line == 'undefined'){
			self.line = L.polyline([]).addTo(self.map);
			
			self.line.on('click', self.edit);
			self.map.on('mousemove', self.hover);
		}

		self.line.addLatLng(e.latlng);
	}
	self.edit = function edit(e){console.log("edit");}
	
	self.hover = function hover(e){
		if(typeof self.hoverLine == 'undefined'){
			self.hoverLine = L.polyline([]);
			self.hoverLine.setLatLngs([self.lastPoint, e.latlng]);
			self.hoverLine.addTo(self.map);
		}else{
			self.hoverLine.setLatLngs([self.lastPoint, e.latlng]);
		}
	}
	self.stopAdding = function(){
		updateQuery();
		self.dispose();
	}
	
	//Override
	self.dispose = function dispose(event){
		self.map.off('mousemove', self.hover);
		self.map.off('click', self.addPoint);
		self.map.off('dblclick', self.stopAdding);
		if(self.button)
			self.button.removeClass("selected");
	}
	//Override
	 self.copy = function copy(){
		 return { action: "path", render:{ points: self.line.getLatLngs() } };
	 }
	 
	 //Override
	 self.render = function render(values){
			self.line = L.polyline(values.points).addTo(self.map);
			self.line.on('click', self.edit);
			self.dispose();
	 }
	 
	self.hoverLine;
	self.lastPoint;
	self.line;
	
	self.map.on('click', self.addPoint);
	self.map.on('dblclick', self.stopAdding);
}
 
 
 PathAction.prototype = Object.create(DrawAction.prototype);
 
 
function MarkerAction(mapObject, actionButton){
	var self = this;
	DrawAction.call(self, mapObject, actionButton);
	
	self.addMarker = function addMarker(e){
		L.marker().setLatLng(e.latlng).on('click', self.edit).addTo(self.map);
		self.point = e.latlng;
		self.dispose();
		updateQuery();
	}
		self.edit = function edit(e){console.log("edit");}
	//Override
	self.dispose = function dispose(event){
		self.map.off('click', self.addPoint);
		if(self.button)
			self.button.removeClass("selected");
	}
	//Override
	 self.copy = function copy(){
		  return { action: "marker", render:{ point: 	Math.round(self.point*100)/100 } };
	 }
	 
	//Override
	 self.render = function render(values){
			self.point = values.point;
			L.marker().setLatLng(self.point).on('click', self.edit).addTo(self.map);
			self.dispose();
	 }
	 
	self.point;
	self.map.on('click', this.addMarker);
}
 
 
 
 MarkerAction.prototype = Object.create(DrawAction.prototype);
 
 var DrawFactory = {
	marker: MarkerAction,
	path: PathAction
};

/* ======================================================================================
 * =========================             Search          ================================
 * ======================================================================================
 */
 
 
function filterMapsByName(nameToFilter){
  $(".tile-container").each(function(){
    var mapName = $(this).find(".tile-card").text();

    if(nameToFilter == "" || mapName.toLowerCase().indexOf(nameToFilter.toLowerCase()) >= 0 )
      $(this).removeClass("hide");
    else
       $(this).addClass("hide");
     
  });
}
 
 