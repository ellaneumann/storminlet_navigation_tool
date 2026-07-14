const map = L.map('map', { preferCanvas: true }).setView([33.749, -84.388], 14);

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
});
osmLayer.addTo(map);

// Dedicated pane for the heatmap so its opacity can be capped independently —
// otherwise the heat canvas's own colors can read as a near-opaque wash that
// blots out the layers underneath it.
map.createPane('heatPane');
map.getPane('heatPane').style.zIndex = 450;
map.getPane('heatPane').style.opacity = 0.8;
map.getPane('heatPane').style.pointerEvents = 'none';

const layers = {
    sewershed: null,
    inlets: null,
    manhole: null,
    rivers: null,
    divide: null,
    elevationLabels: null,
    zoning: null,
    heatmap: null,
};

// Bright yellow-to-deep-red ramp (ColorBrewer YlOrRd) shared by the heatmap
// layer and its gradient-bar legend, so the two always stay in sync.
const HEATMAP_GRADIENT = {
    0.0: '#ffffb2',
    0.2: '#fed976',
    0.4: '#feb24c',
    0.6: '#fd8d3c',
    0.8: '#f03b20',
    1.0: '#bd0026',
};

// --- Zoning districts ---
// Fixed categorical hue order (validated for colorblind-safe adjacent contrast);
// a category outside this map (e.g. the single "Historic" district) falls back
// to ZONING_OTHER_COLOR rather than generating a new hue.
const ZONING_COLORS = {
    'Single Family Residential': '#2a78d6',
    'Multi-Family Residential': '#1baf7a',
    'Commercial': '#eda100',
    'Special Public Interest': '#008300',
    'Planned Development': '#4a3aa7',
    'Industrial': '#e34948',
    'Neighborhood Commercial District': '#e87ba4',
    'Office-Institutional': '#eb6834',
};
const ZONING_OTHER_COLOR = '#898781';
const ZONING_OTHER_LABEL = 'Other';

function getZoningColor(zoningCode) {
    return ZONING_COLORS[zoningCode] || ZONING_OTHER_COLOR;
}

var zoningTableData = [];
var zoningSortField = 'INLETS';
var zoningSortAsc = false;

// --- Elevation display ---
const ELEVATION_LABEL_ZOOM = 16;
const ELEVATION_STOPS = [
    [0.00, [26, 152, 80]],
    [0.25, [166, 217, 106]],
    [0.50, [255, 255, 191]],
    [0.75, [253, 174, 97]],
    [1.00, [215, 25, 28]],
];

var elevationEnabled = false;
var elevationDomain = null;

function getInletId(props) {
    if (props.OBJECTID !== undefined && props.OBJECTID !== null && props.OBJECTID !== '') {
        return props.OBJECTID.toString();
    }
    if (props.FACILITYID) {
        return props.FACILITYID.toString();
    }
    return 'unknown';
}

function getInletElevation(props) {
    var v = props.GROUND_ELE;
    return (typeof v === 'number' && v > 0) ? v : null;
}

function formatElevation(props) {
    var v = getInletElevation(props);
    return (v !== null) ? v.toFixed(1) + ' ft' : 'Unknown';
}

function computeElevationDomain(features) {
    var values = [];
    for (var i = 0; i < features.length; i++) {
        var v = getInletElevation(features[i].properties);
        if (v !== null) values.push(v);
    }
    values.sort(function(a, b) { return a - b; });
    if (values.length === 0) return { min: 0, max: 1 };
    var lowIdx = Math.floor(values.length * 0.02);
    var highIdx = Math.min(values.length - 1, Math.floor(values.length * 0.98));
    return { min: values[lowIdx], max: values[highIdx] };
}

function elevationColor(value) {
    if (!elevationDomain || elevationDomain.min === elevationDomain.max) {
        return 'rgb(26, 152, 80)';
    }
    var t = (value - elevationDomain.min) / (elevationDomain.max - elevationDomain.min);
    t = Math.max(0, Math.min(1, t));
    for (var i = 0; i < ELEVATION_STOPS.length - 1; i++) {
        var a = ELEVATION_STOPS[i];
        var b = ELEVATION_STOPS[i + 1];
        if (t >= a[0] && t <= b[0]) {
            var localT = (t - a[0]) / (b[0] - a[0]);
            var r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * localT);
            var g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * localT);
            var bch = Math.round(a[1][2] + (b[1][2] - a[1][2]) * localT);
            return 'rgb(' + r + ',' + g + ',' + bch + ')';
        }
    }
    return 'rgb(215, 25, 28)';
}

function applyElevationColors() {
    if (!layers.inlets) return;
    layers.inlets.eachLayer(function(marker) {
        if (elevationEnabled) {
            var val = marker._elevationValue;
            var color = (val !== null) ? elevationColor(val) : '#999999';
            marker.setStyle({ fillColor: color });
        } else {
            marker.setStyle({ fillColor: marker._baseColor });
        }
    });
}

function updateElevationLabelVisibility() {
    if (!layers.elevationLabels) return;
    var shouldShow = elevationEnabled && map.getZoom() >= ELEVATION_LABEL_ZOOM;
    if (shouldShow && !map.hasLayer(layers.elevationLabels)) {
        layers.elevationLabels.addTo(map);
    } else if (!shouldShow && map.hasLayer(layers.elevationLabels)) {
        map.removeLayer(layers.elevationLabels);
    }
}

function updateElevationLegend() {
    var legend = document.getElementById('elevation-legend');
    if (legend) legend.style.display = elevationEnabled ? 'block' : 'none';

    if (elevationDomain) {
        var minEl = document.getElementById('elevation-legend-min');
        var maxEl = document.getElementById('elevation-legend-max');
        if (minEl) minEl.textContent = Math.round(elevationDomain.min) + ' ft';
        if (maxEl) maxEl.textContent = Math.round(elevationDomain.max) + ' ft';
    }
}

function addLayerIfEnabled(layer, checkboxId) {
    var checkbox = document.getElementById(checkboxId);
    if (!checkbox || checkbox.checked) {
        layer.addTo(map);
    }
}

async function loadSewershed() {
    try {
        const response = await fetch('geojson_files/sewershed_boundry.geojson');
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
                layer.bindPopup('<h3>Custer Avenue Combined Sewershed Boundary</h3>');
                layer.bindTooltip('<strong>Sewershed Boundary</strong>', { sticky: true });
            },
        });

        addLayerIfEnabled(layers.sewershed, 'toggle-sewershed');
        map.fitBounds(layers.sewershed.getBounds(), { padding: [20, 20] });
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

        elevationDomain = computeElevationDomain(data.features);
        updateElevationLegend();

        layers.inlets = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                var marker = L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: '#0099ff',
                    color: '#003d66',
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.8,
                });
                marker._baseColor = '#0099ff';
                marker._elevationValue = getInletElevation(feature.properties);
                marker._inletType = feature.properties.INLETTYPE || 'Unknown';
                return marker;
            },
            onEachFeature: function(feature, layer) {
                var props = feature.properties;
                var inletId = getInletId(props);
                var elevText = formatElevation(props);
                var inletType = props.INLETTYPE || 'Unknown';
                var inletLng = feature.geometry.coordinates[0];
                var inletLat = feature.geometry.coordinates[1];

                var popupContent = '<h3>Storm Inlet</h3>';
                popupContent += '<div class="popup-property"><strong>ID:</strong> ' + inletId + '</div>';
                popupContent += '<div class="popup-property"><strong>Type:</strong> ' + inletType + '</div>';
                popupContent += '<div class="popup-property"><strong>Ground Elevation:</strong> ' + elevText + '</div>';
                popupContent += '<button onclick="selectInlet(\'' + inletId + '\')" class="btn-navigate">Navigate to Inlet</button>';
                popupContent += '<button onclick="reportForInlet(\'' + inletId + '\', ' + inletLat + ', ' + inletLng + ')" class="btn-navigate btn-report">Storm Inlet Report</button>';

                layer.bindPopup(popupContent);
                layer.bindTooltip(
                    '<strong>Storm Inlet</strong> (' + inletType + ')<br>Elevation: ' + elevText,
                    { sticky: true, direction: 'top', opacity: 0.9 }
                );
            },
        });

        var labelMarkers = [];
        layers.inlets.eachLayer(function(marker) {
            var val = marker._elevationValue;
            var text = (val !== null) ? Math.round(val) + ' ft' : 'N/A';
            var icon = L.divIcon({
                className: 'elevation-label-icon',
                html: text,
                iconSize: [0, 0],
            });
            labelMarkers.push(L.marker(marker.getLatLng(), {
                icon: icon,
                interactive: false,
                keyboard: false,
            }));
        });
        layers.elevationLabels = L.layerGroup(labelMarkers);

        var heatPoints = data.features.map(function(feature) {
            var coords = feature.geometry.coordinates;
            return [coords[1], coords[0], 0.5];
        });
        layers.heatmap = L.heatLayer(heatPoints, {
            pane: 'heatPane',
            radius: 18,
            blur: 15,
            max: 2,
            maxZoom: 17,
            minOpacity: 0.3,
            // Bright yellow-to-deep-red ramp (ColorBrewer YlOrRd) — every density
            // level stays visible (never fades to near-invisible white), with the
            // highest-density clusters reading as the brightest, most intense red.
            gradient: HEATMAP_GRADIENT,
        });
        addLayerIfEnabled(layers.heatmap, 'toggle-heatmap');

        addLayerIfEnabled(layers.inlets, 'toggle-inlets');
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
                var props = feature.properties || {};
                var facilityId = props.FACILITYID || 'Unknown';
                var mhType = props.MHTYPE || 'Unknown';
                var rimElev = (typeof props.RIMELEV === 'number' && props.RIMELEV > 0) ? props.RIMELEV.toFixed(1) + ' ft' : 'Unknown';

                var popupContent = '<h3>Storm Manhole</h3>';
                popupContent += '<div class="popup-property"><strong>ID:</strong> ' + facilityId + '</div>';
                popupContent += '<div class="popup-property"><strong>Type:</strong> ' + mhType + '</div>';
                popupContent += '<div class="popup-property"><strong>Rim Elevation:</strong> ' + rimElev + '</div>';

                layer.bindPopup(popupContent);
                layer.bindTooltip('<strong>Storm Manhole</strong> (' + mhType + ')', { sticky: true });
            },
        });

        addLayerIfEnabled(layers.manhole, 'toggle-manhole');
        console.log('Manhole loaded');
    } catch (error) {
        console.error('Error loading manhole:', error);
        layers.manhole = null;
    }
}

async function loadRivers() {
    try {
        const response = await fetch('geojson_files/rivers_streams_local.geojson');
        const data = await response.json();

        layers.rivers = L.geoJSON(data, {
            style: {
                color: '#0066cc',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0,
            },
            onEachFeature: function(feature, layer) {
                var props = feature.properties || {};
                var name = props.NAME || 'Unnamed';
                var type = props.FEATURE_TY || props.FEATURE || 'Stream/River';

                layer.bindPopup(
                    '<h3>River/Stream</h3>' +
                    '<div class="popup-property"><strong>Name:</strong> ' + name + '</div>' +
                    '<div class="popup-property"><strong>Type:</strong> ' + type + '</div>'
                );
                layer.bindTooltip(
                    '<strong>River/Stream</strong>' + (props.NAME ? ' — ' + name : '') + '<br>' + type,
                    { sticky: true }
                );
            },
        });

        addLayerIfEnabled(layers.rivers, 'toggle-rivers');
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
                layer.bindPopup('<h3>Eastern Continental Divide</h3>');
                layer.bindTooltip('<strong>Eastern Continental Divide</strong>', { sticky: true });
            },
        });

        addLayerIfEnabled(layers.divide, 'toggle-divide');
        console.log('Divide loaded');
    } catch (error) {
        console.error('Error loading divide:', error);
        layers.divide = null;
    }
}

var zoningLayersByClass = {};

async function loadZoning() {
    try {
        const response = await fetch('geojson_files/zoning_districts.geojson');
        const data = await response.json();

        layers.zoning = L.geoJSON(data, {
            style: function(feature) {
                var color = getZoningColor(feature.properties.ZONINGCODE);
                return {
                    color: color,
                    weight: 1,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: 0.35,
                };
            },
            onEachFeature: function(feature, layer) {
                var props = feature.properties;
                var zoneClass = props.ZONECLASS || 'Unknown';
                var category = props.ZONINGCODE || ZONING_OTHER_LABEL;

                var popupContent = '<h3>Zoning District</h3>';
                popupContent += '<div class="popup-property"><strong>District:</strong> ' + zoneClass + '</div>';
                popupContent += '<div class="popup-property"><strong>Category:</strong> ' + category + '</div>';
                popupContent += '<div class="popup-property"><strong>Acres:</strong> ' + props.ACRES.toFixed(2) + '</div>';
                popupContent += '<div class="popup-property"><strong>Storm Inlets:</strong> ' + props.INLETS + '</div>';
                popupContent += '<div class="popup-property"><strong>Density:</strong> ' + props.DENSITY.toFixed(2) + ' inlets/acre</div>';

                layer.bindPopup(popupContent);
                layer.bindTooltip('<strong>' + zoneClass + '</strong> (' + category + ')', { sticky: true });

                if (!zoningLayersByClass[zoneClass]) zoningLayersByClass[zoneClass] = [];
                zoningLayersByClass[zoneClass].push(layer);
            },
        });

        addLayerIfEnabled(layers.zoning, 'toggle-zoning');
        buildZoningLegend(data.features);
        buildZoningTableData(data.features);
        renderZoningTable();
        console.log('Zoning districts loaded');
    } catch (error) {
        console.error('Error loading zoning districts:', error);
        layers.zoning = null;
    }
}

function buildZoningLegend(features) {
    var categories = {};
    features.forEach(function(f) {
        var cat = f.properties.ZONINGCODE || ZONING_OTHER_LABEL;
        if (!(cat in ZONING_COLORS)) cat = ZONING_OTHER_LABEL;
        categories[cat] = true;
    });

    var container = document.getElementById('zoning-legend-items');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(ZONING_COLORS).concat([ZONING_OTHER_LABEL]).forEach(function(cat) {
        if (!categories[cat]) return;
        var color = ZONING_COLORS[cat] || ZONING_OTHER_COLOR;
        var item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = '<span class="legend-color" style="background:' + color + ';"></span> ' + cat;
        container.appendChild(item);
    });
}

function buildZoningTableData(features) {
    var agg = {};
    features.forEach(function(f) {
        var p = f.properties;
        var zoneClass = p.ZONECLASS || 'Unknown';
        if (!agg[zoneClass]) {
            agg[zoneClass] = { zoneClass: zoneClass, zoningCode: p.ZONINGCODE, inlets: 0, acres: 0 };
        }
        agg[zoneClass].inlets += (p.INLETS || 0);
        agg[zoneClass].acres += (p.ACRES || 0);
    });

    zoningTableData = Object.keys(agg).map(function(key) {
        var row = agg[key];
        row.density = row.acres > 0 ? row.inlets / row.acres : 0;
        return row;
    });
}

function renderZoningTable() {
    var tbody = document.getElementById('zoning-table-rows');
    if (!tbody) return;

    var fieldMap = { ZONECLASS: 'zoneClass', INLETS: 'inlets', ACRES: 'acres', DENSITY: 'density' };
    var field = fieldMap[zoningSortField];
    var sorted = zoningTableData.slice().sort(function(a, b) {
        var av = a[field], bv = b[field];
        if (typeof av === 'string') {
            return zoningSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return zoningSortAsc ? av - bv : bv - av;
    });

    tbody.innerHTML = '';
    sorted.forEach(function(row) {
        var tr = document.createElement('tr');
        var densityMath = row.inlets + ' inlets ÷ ' + row.acres.toFixed(2) + ' acres = ' + row.density.toFixed(2) + '/acre';
        tr.innerHTML =
            '<td><span class="zoning-swatch" style="background:' + getZoningColor(row.zoningCode) + ';"></span>' + row.zoneClass + '</td>' +
            '<td>' + row.inlets + '</td>' +
            '<td>' + row.acres.toFixed(2) + '</td>' +
            '<td title="' + densityMath + '">' + row.density.toFixed(2) + '</td>';
        tr.addEventListener('click', function() {
            zoomToZoningClass(row.zoneClass);
        });
        tbody.appendChild(tr);
    });

    document.querySelectorAll('#zoning-table th[data-sort]').forEach(function(th) {
        th.classList.toggle('sorted', th.dataset.sort === zoningSortField);
        th.classList.toggle('sorted-asc', th.dataset.sort === zoningSortField && zoningSortAsc);
    });
}

function zoomToZoningClass(zoneClass) {
    var matchLayers = zoningLayersByClass[zoneClass];
    if (!matchLayers || matchLayers.length === 0) return;

    if (layers.zoning && !map.hasLayer(layers.zoning)) {
        map.addLayer(layers.zoning);
        var zoningCheckbox = document.getElementById('toggle-zoning');
        if (zoningCheckbox) zoningCheckbox.checked = true;
    }

    var bounds = L.latLngBounds([]);
    matchLayers.forEach(function(layer) {
        bounds.extend(layer.getBounds());
    });
    map.fitBounds(bounds, { maxZoom: 16, padding: [20, 20] });

    matchLayers.forEach(function(layer) {
        var original = { color: layer.options.color, weight: layer.options.weight, fillOpacity: layer.options.fillOpacity };
        layer.setStyle({ color: '#000000', weight: 4, fillOpacity: 0.6 });
        layer.bringToFront();
        setTimeout(function() {
            layer.setStyle(original);
        }, 1500);
    });
}

document.querySelectorAll('#zoning-table th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() {
        var field = th.dataset.sort;
        if (zoningSortField === field) {
            zoningSortAsc = !zoningSortAsc;
        } else {
            zoningSortField = field;
            zoningSortAsc = false;
        }
        renderZoningTable();
    });
});

document.querySelectorAll('[data-collapsible-toggle]').forEach(function(header) {
    var key = header.dataset.collapsibleToggle;
    var body = document.querySelector('[data-collapsible-body="' + key + '"]');
    var caret = document.querySelector('[data-collapsible-caret="' + key + '"]');
    if (!body) return;
    header.addEventListener('click', function() {
        var collapsed = body.style.display === 'none';
        setCollapsiblePanelState(key, collapsed);
    });
});

function setCollapsiblePanelState(key, expanded) {
    var body = document.querySelector('[data-collapsible-body="' + key + '"]');
    var caret = document.querySelector('[data-collapsible-caret="' + key + '"]');
    if (!body) return;
    body.style.display = expanded ? '' : 'none';
    if (caret) caret.innerHTML = expanded ? '&#9662;' : '&#9656;';
}

window.addEventListener('load', function() {
    loadSewershed();
    loadInlets();
    loadManhole();
    loadRivers();
    loadDivide();
    loadZoning();
    updateLegendVisibility();
});

// The legend should only ever list what's actually drawn on the map — each
// item's visibility mirrors its layer checkbox rather than always showing.
function updateLegendVisibility() {
    document.querySelectorAll('#legend [data-legend-for]').forEach(function(item) {
        var checkbox = document.getElementById(item.dataset.legendFor);
        item.style.display = (checkbox && checkbox.checked) ? '' : 'none';
    });
}

document.querySelectorAll('.layer-items input[type="checkbox"]').forEach(function(checkbox) {
    checkbox.addEventListener('change', updateLegendVisibility);
});

map.on('zoomend', updateElevationLabelVisibility);

var aboutToggle = document.getElementById('about-toggle');
var aboutPanel = document.getElementById('about-panel');
var aboutClose = document.getElementById('about-close');
if (aboutToggle && aboutPanel) {
    aboutToggle.addEventListener('click', function() {
        aboutPanel.style.display = (aboutPanel.style.display === 'none') ? 'block' : 'none';
    });
}
if (aboutClose && aboutPanel) {
    aboutClose.addEventListener('click', function() {
        aboutPanel.style.display = 'none';
    });
}

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

// Elevation coloring and the heatmap are both derived from the Storm Inlets
// dataset, so turning either sub-option on only makes sense with the parent
// inlets layer visible — check it for the user rather than showing an empty map.
function ensureInletsVisible() {
    var inletsCheckbox = document.getElementById('toggle-inlets');
    if (inletsCheckbox && !inletsCheckbox.checked) {
        inletsCheckbox.checked = true;
    }
    if (layers.inlets && !map.hasLayer(layers.inlets)) {
        map.addLayer(layers.inlets);
    }
    updateElevationLabelVisibility();
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
        updateElevationLabelVisibility();
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

var zoningToggle = document.getElementById('toggle-zoning');
if (zoningToggle) {
    zoningToggle.addEventListener('change', function(e) {
        if (layers.zoning) {
            if (e.target.checked) {
                map.addLayer(layers.zoning);
            } else {
                map.removeLayer(layers.zoning);
            }
        }
    });
}

var heatmapToggle = document.getElementById('toggle-heatmap');
if (heatmapToggle) {
    heatmapToggle.addEventListener('change', function(e) {
        if (e.target.checked) {
            ensureInletsVisible();
        }
        if (layers.heatmap) {
            if (e.target.checked) {
                map.addLayer(layers.heatmap);
            } else {
                map.removeLayer(layers.heatmap);
            }
        }
        var heatmapLegend = document.getElementById('heatmap-legend');
        if (heatmapLegend) heatmapLegend.style.display = e.target.checked ? 'block' : 'none';
    });
}

var elevationToggle = document.getElementById('toggle-elevation');
if (elevationToggle) {
    elevationToggle.addEventListener('change', function(e) {
        if (e.target.checked) {
            ensureInletsVisible();
        }
        elevationEnabled = e.target.checked;
        applyElevationColors();
        updateElevationLabelVisibility();
        updateElevationLegend();
    });
}

var STORM_INLET_REPORT_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfTbyUPif6ugLS-suRMPwnTCKwV3O3b8joUxdRjhHj6oRz1Eg/viewform';
// Entry IDs read from the form's own FB_PUBLIC_LOAD_DATA_ payload — these map
// to "Storm Inlet ID" and "Link to navigation directions" respectively.
var STORM_INLET_REPORT_ID_ENTRY = 'entry.1066851432';
var STORM_INLET_REPORT_DIRECTIONS_ENTRY = 'entry.895005448';

// Set whenever the user navigates to a specific inlet, so the report button
// can prefill the ID + directions link for whichever inlet they were just sent to.
var lastNearestInlet = null;

function openStormInletReport(inletId, directionsUrl) {
    var params = [];
    if (inletId) params.push(STORM_INLET_REPORT_ID_ENTRY + '=' + encodeURIComponent(inletId));
    if (directionsUrl) params.push(STORM_INLET_REPORT_DIRECTIONS_ENTRY + '=' + encodeURIComponent(directionsUrl));

    var url = STORM_INLET_REPORT_BASE_URL + (params.length > 0 ? '?usp=pp_url&' + params.join('&') : '?usp=dialog');
    window.open(url, '_blank');
}

function reportForLastNearest() {
    if (lastNearestInlet) {
        openStormInletReport(lastNearestInlet.inletId, lastNearestInlet.directionsUrl);
    } else {
        openStormInletReport();
    }
}

function reportForInlet(inletId, lat, lng) {
    var directionsUrl = null;
    if (window.userMarker) {
        var userLat = window.userMarker.getLatLng().lat;
        var userLng = window.userMarker.getLatLng().lng;
        directionsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${lat},${lng}`;
    }
    openStormInletReport(inletId, directionsUrl);
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
            var markerId = getInletId(marker.feature.properties);
            if (markerId === inletId.toString()) {
                selectedMarker = marker;
                var inletLat = marker.getLatLng().lat;
                var inletLng = marker.getLatLng().lng;

                // Open Google Maps navigation
                var googleMapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${inletLat},${inletLng}`;
                lastNearestInlet = { inletId: markerId, directionsUrl: googleMapsUrl };
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
        var nearestInletId = getInletId(nearestMarker.feature.properties);
        var distanceMeters = (nearestDistance * 1000).toFixed(0);
        var distanceMiles = (nearestDistance * 0.621371).toFixed(2);
        var infoDiv = document.getElementById('nearest-inlet-info');
        infoDiv.textContent = `Nearest inlet ID: ${nearestInletId} — ${distanceMeters}m (${distanceMiles} miles) away`;

        // Zoom the local map to the user's current location only now, on demand
        map.setView([userLat, userLng], 16);

        // Open Google Maps navigation
        var googleMapsUrl = `https://www.google.com/maps/dir/${userLat},${userLng}/${nearestLat},${nearestLng}`;
        lastNearestInlet = { inletId: nearestInletId, directionsUrl: googleMapsUrl };
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

                var yourLocationLegend = document.getElementById('legend-your-location');
                if (yourLocationLegend) yourLocationLegend.style.display = 'flex';
            } else {
                window.userMarker.setLatLng([latitude, longitude]);
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
