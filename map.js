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
            var markerId = (marker.feature.properties.id || marker.feature.properties.objectid || '').toString();
            if (markerId == inletId) {
                selectedMarker = marker;
                var inletLat = marker.getLatLng().lat;
                var inletLng = marker.getLatLng().lng;
                
                // Open Google Maps navigation
                var googleMapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${inletLat},${inletLng}`;
                window.open(googleMapsUrl, '_blank');
                break;
            }
        }
        
        if (!selectedMarker) {
            alert('Could not find selected inlet');
        }
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
    var nearestLat = null;
    var nearestLng = null;
    
    for (var i = 0; i < inletMarkers.length; i++) {
        var marker = inletMarkers[i];
        var latlng = marker.getLatLng();
        var distance = calculateDistance(userLat, userLng, latlng.lat, latlng.lng);
        
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestMarker = marker;
            nearestLat = latlng.lat;
            nearestLng = latlng.lng;
        }
    }
    
    if (nearestMarker) {
        var distanceMeters = (nearestDistance * 1000).toFixed(0);
        var distanceMiles = (nearestDistance * 0.621371).toFixed(2);
        var infoDiv = document.getElementById('nearest-inlet-info');
        infoDiv.textContent = `Nearest inlet: ${distanceMeters}m (${distanceMiles} miles) away`;
        
        // Open Google Maps navigation
        var googleMapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${nearestLat},${nearestLng}`;
        window.open(googleMapsUrl, '_blank');
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

getUserLocation();