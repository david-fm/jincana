/**
 * maps.js
 * Wrapper para Leaflet - inicialización y helpers de mapa
 */

let mapInstances = {};

/**
 * Inicializa un mapa Leaflet en el contenedor dado.
 * Retorna la instancia del mapa.
 */
function initMap(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Contenedor #${containerId} no encontrado`);
    return null;
  }

  // Evitar reinicialización
  if (mapInstances[containerId]) {
    mapInstances[containerId].remove();
  }

  const center = options.center || [40.4168, -3.7038]; // Madrid por defecto
  const zoom = options.zoom || 15;

  const map = L.map(containerId).setView(center, zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  mapInstances[containerId] = map;
  return map;
}

/**
 * Añade un marcador al mapa con popup opcional.
 */
function addMarker(map, lat, lng, options = {}) {
  const marker = L.marker([lat, lng]).addTo(map);
  if (options.popup) {
    marker.bindPopup(options.popup);
  }
  if (options.openPopup) {
    marker.openPopup();
  }
  return marker;
}

/**
 * Añade un círculo al mapa (para mostrar el radio de llegada).
 */
function addCircle(map, lat, lng, radiusMeters, options = {}) {
  return L.circle([lat, lng], {
    radius: radiusMeters,
    color: options.color || '#4361ee',
    fillColor: options.fillColor || '#4361ee',
    fillOpacity: options.fillOpacity || 0.15,
    weight: options.weight || 2,
    dashArray: options.dashArray || '5, 10',
  }).addTo(map);
}

/**
 * Centra el mapa en una coordenada con animación.
 */
function centerMap(map, lat, lng, zoom = null) {
  if (!map || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    console.warn('centerMap recibido coordenadas inválidas:', lat, lng);
    return;
  }
  const targetZoom = zoom !== null ? zoom : map.getZoom();
  map.flyTo([lat, lng], targetZoom, { duration: 1 });
}

/**
 * Elimina todas las capas de un mapa excepto el tile layer.
 */
function clearMapLayers(map) {
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });
}

/**
 * Ajusta el mapa para que quepan todos los marcadores dados.
 */
function fitBounds(map, markers) {
  if (markers.length === 0) return;
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.1));
}

/**
 * Destruye una instancia de mapa.
 */
function destroyMap(containerId) {
  if (mapInstances[containerId]) {
    mapInstances[containerId].remove();
    delete mapInstances[containerId];
  }
}
