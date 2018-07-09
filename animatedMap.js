var ANIMATION_WAIT = 20;
var DELAY_BETWEEN = 2500;
var ZOOM_LEVEL = 6; // Previously 5 

var map;
var upper;
var processedData = [];
var markers = [];

// Sort adapted from: https://stackoverflow.com/questions/2855189/sort-latitude-and-longitude-coordinates-into-clockwise-ordered-quadrilateral
// --------------------------------------------------------------------------
function latToX(lat) { return (lat + 180) * 360; }
function lngToY(lng) { return (lng + 90) * 180; }

function distance(p1, p2) {
		var dX = latToX(p1.lat()) - latToX(p2.lat());
		var dY = lngToY(p1.lng()) - lngToY(p2.lng());
		return Math.sqrt((dX*dX) + (dY*dY));
}

function slope(p1, p2) {
		var dX = latToX(p1.lat()) - latToX(p2.lat());
		var dY = lngToY(p1.lng()) - lngToY(p2.lng());
		return dY / dX;
}

// A custom sort function that sorts p1 and p2 based on their slope
// that is formed from the upper most point from the array of points.
function pointSort(p1, p2) {
	// Exclude the 'upper' point from the sort (which should come first).
	p1 = p1.loc;
	p2 = p2.loc;
	if(p1 == upper) return -1;
	if(p2 == upper) return 1;

	// Find the slopes of 'p1' and 'p2' when a line is 
	// drawn from those points through the 'upper' point.
	var m1 = slope(upper, p1);
	var m2 = slope(upper, p2);

	// 'p1' and 'p2' are on the same line towards 'upper'.
	if(m1 == m2) {
		// The point closest to 'upper' will come first.
		return distance(p1, upper) < distance(p2, upper) ? -1 : 1;
	}

	// If 'p1' is to the right of 'upper' and 'p2' is the the left.
	if(m1 <= 0 && m2 > 0) return -1;

	// If 'p1' is to the left of 'upper' and 'p2' is the the right.
	if(m1 > 0 && m2 <= 0) return 1;

	// It seems that both slopes are either positive, or negative.
	return m1 > m2 ? -1 : 1;
}

// Find the upper most point. In case of a tie, get the left most point.
function upperLeft(points) {
	var top = points[0];
	for(var i = 1; i < points.length; i++) {
		var temp = points[i];
		if(lngToY(temp.lng()) > lngToY(top.lng()) || (lngToY(temp.lng()) == lngToY(top.lng()) && latToX(temp.lat()) < latToX(top.lat()))) {
			top = temp;
		}
	}
	return top;
}
// --------------------------------------------------------------------------

function extractCoordinates(data) {
	return data.map(function (x) { return x.loc });
}

function countryCompare(a,b) {
	if (a.Country < b.Country)
		return -1;
	if (a.Country > b.Country)
		return 1;
	return 0;
}

function initialize() {
	// Process and sort points
	var cur = [];
	var lastCountry;
	data.sort(countryCompare);
	for(var i = 0, len = data.length; i < len; i++) {
		if(lastCountry != data[i].Country && cur.length > 0) {
			upper = upperLeft(extractCoordinates(cur));
			cur.sort(pointSort);
			processedData.push.apply(processedData, cur);
			cur = [];
		}
		cur.push({loc: new google.maps.LatLng(data[i].Lat, data[i].Long), address: data[i].Address});
		lastCountry = data[i].Country;
	}
	if (cur.length > 0) {
		upper = upperLeft(extractCoordinates(cur));
		cur.sort(pointSort);
		processedData.push.apply(processedData, cur);
	}
	initializeMap(); 
}

function initializeMap() {
	var mapOptions = { 
		center: processedData[0].loc,
		zoom: ZOOM_LEVEL,
		gestureHandling: 'none',
		disableDefaultUI: true,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
	for(var i = 0, len = processedData.length; i < len; i++) {
		addStationaryMarker(processedData[i].loc);
	}
	addMarker(extractCoordinates(processedData));
}

function addStationaryMarker(pos) {
	var marker = new google.maps.Marker({
		map: map,
		position: pos,
		zIndex: markers.length,
		icon: "Om_logo.gif"
	});
	markers.push(marker);
}
		
function addMarker(coords) {
	var marker = new google.maps.Marker({
		map: map,
		coordinates: coords,
		icon:"chinmaya_mission_lamp.JPG",
		curInd: 0,
		position: coords[0],
		zIndex: markers.length,
	});
	
	$('#info')[0].innerHTML = processedData[marker.curInd].address;
	  
	function animatedMove(waitInBetween) {
		from = marker.coordinates[marker.curInd % marker.coordinates.length];
		to = marker.coordinates[(marker.curInd + 1)% marker.coordinates.length];
		fromLat = from.lat();
		fromLng = from.lng();
		toLat = to.lat();
		toLng = to.lng();
		// store a LatLng for each step of the animation
		frames = [];
		for (var percent = 0; percent < 1; percent += 0.01) {
			curLat = fromLat + percent * (toLat - fromLat);
			curLng = fromLng + percent * (toLng - fromLng);
			frames.push(new google.maps.LatLng(curLat, curLng));
		}

		move = function(marker, latlngs, index, wait, newDestination) {
			map.setCenter(latlngs[index]);
			marker.setPosition(latlngs[index]);
			
			if(index != latlngs.length-1) {
			  // call the next "frame" of the animation
				setTimeout(function() { 
					move(marker, latlngs, index+1, wait, newDestination); 
				}, wait);
			}
			else {
				// assign new route
				map.setCenter(marker.position);
				marker.setPosition(marker.coordinates[++marker.curInd % marker.coordinates.length]);
				if (marker.curInd >= marker.coordinates.length)
					marker.curInd = 0;
				// Output information in some way
				$('#info')[0].innerHTML = processedData[marker.curInd].address;
				setTimeout(function() {
					animatedMove(waitInBetween);
				}, waitInBetween);
			}
		}
		move(marker, frames, 0, ANIMATION_WAIT, marker.position);
	}

	// begin animation, send back to origin after completion
	markers.push(marker);
	animatedMove(DELAY_BETWEEN);
}

function callback(results, status) {
  if (status == google.maps.places.PlacesServiceStatus.OK) {
	for (var i = 0; i < results.length; i++) {
	  var place = results[i];
	}
  }
}

function DisplayImage(map,data,mapCenter) {
  var request = { query: data.Name,fields: ['photos', 'formatted_address', 'name', 'rating', 'opening_hours', 'geometry'] };
  var service = new google.maps.places.PlacesService(map);
  service.findPlaceFromQuery(request, callback);
};

google.maps.event.addDomListener(window, 'load', initialize);
