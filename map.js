const map = L.map('map').setView([33.749, -84.388], 14);

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
});
osmLayer.addTo(map);

const layers = {
    sewershed: null,
    inlets: null,
    manhole: null,
    subcatchment: null,
    rivers: null,
    divide: null,
};

async function loadSewershed() {
    try {
        const response = await fetch('geojson_files/custer_ave_sewershed.geojson');
        const data = await response.json();
        
        layers.sewershed = L.geoJSON(data, {
            style: {
                color: '#ff6600',
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.05,
                dashArray: '5, 5',
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<h3>Custer Ave Sewershed</h3>');
            },
        });
        
        layers.sewershed.addTo(map);
        console.log('Sewershed loaded');
    } catch (error) {
        console.error('Error loading sewershed:', error);
        layers.sewershed = null;
    }
}

async function loadInlets() {
    try {
        const response = await fetch('geojson_files/storm_inlets.geojson');
        const data = await response.json();
        
        layers.inlets = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 7,
                    fillColor: '#0099ff',
                    color: '#003d66',
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.8,
                });
            },
            onEachFeature: function(feature, layer) {
                var props = feature.properties;
                var inletId = props.id || props.objectid || 'unknown';
                
                var popupContent = '<h3>Storm Inlet</h3>';
                popupContent += '<div class="popup-property"><strong>ID:</strong> ' + inletId + '</div>';
                popupContent += '<button onclick="selectInlet(\'' + inletId + '\')" class="btn-navigate">Navigate to Inlet</button>';
                
                layer.bindPopup(popupContent);
            },
        });
        
        layers.inlets.addTo(map);
        console.log('Inlets loaded');
    } catch (error) {
        console.error('Error loading inlets:', error);
        layers.inlets = null;
    }
}

async function loadManhole() {
    try {
        const response = await fetch('geojson_files/stormmanhole.geojson');
        const data = await response.json();
        
        layers.manhole = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: '#9933ff',
                    color: '#5500aa',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.7,
                });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<h3>Storm Manhole</h3>');
            },
        });
        
        layers.manhole.addTo(map);
        console.log('Manhole loaded');
    } catch (error) {
        console.error('Error loading manhole:', error);
        layers.manhole = null;
    }
}

async function loadSubcatchment() {
    try {
        const response = await fetch('geojson_files/subcatchment.geojson');
        const data = await response.json();
        
        layers.subcatchment = L.geoJSON(data, {
            style: {
                color: '#00cc99',
                weight: 1.5,
                opacity: 0.6,
                fillOpacity: 0.1,
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<h3>Subcatchment</h3>');
            },
        });
        
        layers.subcatchment.addTo(map);
        console.log('Subcatchment loaded');
    } catch (error) {
        console.error('Error loading subcatchment:', error);
        layers.subcatchment = null;
    }
}

async function loadRivers() {
    try {
        const response = await fetch('geojson_files/georgia_rivers_streams.geojson');
        const data = await response.json();
        
        layers.rivers = L.geoJSON(data, {
            style: {
                color: '#0066cc',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0,
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<h3>River/Stream</h3>');
            },
        });
        
        layers.rivers.addTo(map);
        console.log('Rivers loaded');
    } catch (error) {
        console.error('Error loading rivers - file may be corrupted. Skipping this layer:', error);
        layers.rivers = null;
    }
}

async function loadDivide() {
    try {
        const response = await fetch('geojson_files/eastern_continental_divide.geojson');
        const data = await response.json();
        
        layers.divide = L.geoJSON(data, {
            style: {
                color: '#cc00cc',
                weight: 2,
                opacity: 0.6,
                fillOpacity: 0,
                dashArray: '10, 5',
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('<h3>Continental Divide</h3>');
            },
        });
        
        layers.divide.addTo(map);
        console.log('Divide loaded');
    } catch (error) {
        console.error('Error loading divide:', error);
        layers.divide = null;
    }
}

window.addEventListener('load', function() {
    loadSewershed();
    loadInlets();
    loadManhole();
    loadSubcatchment();
    loadRivers();
    loadDivide();
});

var sewershedToggle = document.getElementById('toggle-sewershed');
if (sewershedToggle) {
    sewershedToggle.addEventListener('change', function(e) {
        if (layers.sewershed) {
            if (e.target.checked) {
                map.addLayer(layers.sewershed);
            } else {
                map.removeLayer(layers.sewershed);
            }
        }
    });
}

var inletsToggle = document.getElementById('toggle-inlets');
if (inletsToggle) {
    inletsToggle.addEventListener('change', function(e) {
        if (layers.inlets) {
            if (e.target.checked) {
                map.addLayer(layers.inlets);
            } else {
                map.removeLayer(layers.inlets);
            }
        }
    });
}

var manholeToggle = document.getElementById('toggle-manhole');
if (manholeToggle) {
    manholeToggle.addEventListener('change', function(e) {
        if (layers.manhole) {
            if (e.target.checked) {
                map.addLayer(layers.manhole);
            } else {
                map.removeLayer(layers.manhole);
            }
        }
    });
}

var subcatchmentToggle = document.getElementById('toggle-subcatchment');
if (subcatchmentToggle) {
    subcatchmentToggle.addEventListener('change', function(e) {
        if (layers.subcatchment) {
            if (e.target.checked) {
                map.addLayer(layers.subcatchment);
            } else {
                map.removeLayer(layers.subcatchment);
            }
        }
    });
}

var riversToggle = document.getElementById('toggle-rivers');
if (riversToggle) {
    riversToggle.addEventListener('change', function(e) {
        if (layers.rivers) {
            if (e.target.checked) {
                map.addLayer(layers.rivers);
            } else {
                map.removeLayer(layers.rivers);
            }
        }
    });
}

var divideToggle = document.getElementById('toggle-divide');
if (divideToggle) {
    divideToggle.addEventListener('change', function(e) {
        if (layers.divide) {
            if (e.target.checked) {
                map.addLayer(layers.divide);
            } else {
                map.removeLayer(layers.divide);
            }
        }
    });
}

var navigationMap = null;
var routeLayer = null;
var userLocation = null;
var selectedInletLocation = null;

function selectInlet(inletId) {
    console.log('Selected inlet:', inletId);
    
    if (!window.userMarker) {
        alert('User location not available. Please enable location services.');
        return;
    }
    
    var userLat = window.userMarker.getLatLng().lat;
    var userLng = window.userMarker.getLatLng().lng;
    
    if (layers.inlets && layers.inlets.getLayers) {
        var inletMarkers = layers.inlets.getLayers();
        var selectedMarker = null;
        
        for (var i = 0; i < inletMarkers.length; i++) {
            var marker = inletMarkers[i];
            var latlng = marker.getLatLng();
            if (marker.feature && (marker.feature.properties.id == inletId || marker.feature.properties.objectid == inletId)) {
                selectedMarker = marker;
                selectedInletLocation = latlng;
                break;
            }
        }
        
        if (selectedMarker) {
            userLocation = { lat: userLat, lng: userLng };
            showNavigation(userLocation, selectedInletLocation, inletId);
        } else {
            alert('Could not find selected inlet');
        }
    }
}

function showNavigation(startLocation, endLocation, inletId) {
    var navigationDiv = document.getElementById('navigation-panel');
    
    if (!navigationDiv) {
        navigationDiv = document.createElement('div');
        navigationDiv.id = 'navigation-panel';
        navigationDiv.className = 'navigation-panel';
        document.body.appendChild(navigationDiv);
    }
    
    navigationDiv.innerHTML = '<h3 style="margin: 0 0 10px 0; color: #0099ff;">Navigation to Inlet</h3><p>Loading directions...</p>';
    
    getDirections(startLocation, endLocation, function(directions) {
        displayDirections(directions, navigationDiv, startLocation, endLocation);
        drawRoute(directions.routes[0].geometry.coordinates, startLocation, endLocation);
    });
}

function getDirections(start, end, callback) {
    var url = 'https://api.openrouteservice.org/v2/directions/foot?api_key=5b3ce3597851110001cf6248&start=' + start.lng + ',' + start.lat + '&end=' + end.lng + ',' + end.lat;
    
    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            callback(data);
        })
        .catch(function(error) {
            console.error('Error getting directions:', error);
            alert('Could not get directions. Please try again.');
        });
}

function displayDirections(directions, container, start, end) {
    if (!directions.routes || directions.routes.length === 0) {
        container.innerHTML = '<p>No route found</p>';
        return;
    }
    
    var route = directions.routes[0];
    var distance = (route.summary.distance / 1000).toFixed(2);
    var duration = Math.round(route.summary.duration / 60);
    
    var html = '<h3 style="margin: 0 0 10px 0; color: #0099ff;">Directions</h3>';
    html += '<div style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin-bottom: 10px;">';
    html += '<p style="margin: 0 0 5px 0;"><strong>Distance:</strong> ' + distance + ' km</p>';
    html += '<p style="margin: 0;"><strong>Time:</strong> ' + duration + ' minutes</p>';
    html += '</div>';
    
    if (route.segments && route.segments.length > 0) {
        var steps = route.segments[0].steps;
        html += '<h4 style="margin: 10px 0 5px 0; color: #333;">Turn-by-Turn:</h4>';
        
        for (var i = 0; i < Math.min(steps.length, 10); i++) {
            var step = steps[i];
            var instruction = step.instruction || 'Continue';
            var dist = (step.distance / 1000).toFixed(2);
            
            html += '<div style="padding: 8px; border-bottom: 1px solid #ddd;">';
            html += '<p style="margin: 0; font-size: 12px;"><strong>Step ' + (i + 1) + ':</strong> ' + instruction + ' (' + dist + ' km)</p>';
            html += '</div>';
        }
        
        if (steps.length > 10) {
            html += '<p style="padding: 5px; color: #666; font-size: 12px;">... and ' + (steps.length - 10) + ' more steps</p>';
        }
    }
    
    html += '<button onclick="closeNavigation()" style="width: 100%; margin-top: 10px; padding: 10px; background: #ff6600; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Close Navigation</button>';
    
    container.innerHTML = html;
}

function drawRoute(coordinates, start, end) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    var latLngs = [];
    for (var i = 0; i < coordinates.length; i++) {
        latLngs.push([coordinates[i][1], coordinates[i][0]]);
    }
    
    routeLayer = L.polyline(latLngs, {
        color: '#ff0000',
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 5'
    }).addTo(map);
    
    var bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds);
}

function closeNavigation() {
    var navigationDiv = document.getElementById('navigation-panel');
    if (navigationDiv) {
        navigationDiv.remove();
    }
    
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            if (!window.userMarker) {
                window.userMarker = L.circleMarker([latitude, longitude], {
                    radius: 8,
                    fillColor: '#ff6b35',
                    color: '#ffffff',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 0.8,
                }).addTo(map);
                
                L.circle([latitude, longitude], {
                    radius: accuracy,
                    color: 'orange',
                    fillColor: '#ff6b35',
                    fillOpacity: 0.1,
                    weight: 1,
                    dashArray: '5, 5',
                }).addTo(map);
            } else {
                window.userMarker.setLatLng([latitude, longitude]);
            }
            
            if (!window.mapCentered) {
                map.setView([latitude, longitude], 15);
                window.mapCentered = true;
            }
        }, function(error) {
            console.warn('Geolocation error:', error);
        }, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
        });
    }
}

function navigateToNearest() {
    if (!window.userMarker) {
        alert('User location not available. Please enable location services.');
        return;
    }
    
    var userLat = window.userMarker.getLatLng().lat;
    var userLng = window.userMarker.getLatLng().lng;
    
    if (!layers.inlets || !layers.inlets.getLayers) {
        alert('Storm inlets layer not loaded');
        return;
    }
    
    var inletMarkers = layers.inlets.getLayers();
    var nearestMarker = null;
    var nearestDistance = Infinity;
    var nearestId = null;
    
    for (var i = 0; i < inletMarkers.length; i++) {
        var marker = inletMarkers[i];
        var latlng = marker.getLatLng();
        var distance = calculateDistance(userLat, userLng, latlng.lat, latlng.lng);
        
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestMarker = marker;
            nearestId = marker.feature.properties.id || marker.feature.properties.objectid || 'unknown';
        }
    }
    
    if (nearestMarker) {
        var infoDiv = document.getElementById('nearest-inlet-info');
        infoDiv.textContent = 'Nearest inlet: ' + (nearestDistance * 1000).toFixed(0) + ' meters away';
        selectInlet(nearestId);
    } else {
        alert('No inlets found');
    }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

getUserLocation();
