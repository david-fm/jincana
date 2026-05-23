/**
 * admin.js
 * Lógica del modo creación/administrador
 */

let locations = [];
let adminMap = null;
let tempMarker = null;
let tempCircle = null;
let editingId = null;
let listMarkers = [];

/* ============================================
   Inicialización
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initAdminMap();
  renderLocationsList();
  updateStats();
});

function initAdminMap() {
  adminMap = initMap('admin-map', { zoom: 13 });
  if (!adminMap) return;

  // Intentar geolocalizar al admin para centrar el mapa
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        centerMap(adminMap, pos.coords.latitude, pos.coords.longitude, 15);
      },
      () => {
        // Fallback: Madrid
        centerMap(adminMap, 40.4168, -3.7038, 13);
      },
      { timeout: 5000 }
    );
  }

  adminMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setFormCoords(lat, lng);
    showTempMarker(lat, lng);
  });
}

/* ============================================
   Formulario y marcadores temporales
   ============================================ */

function setFormCoords(lat, lng) {
  document.getElementById('loc-lat').value = lat.toFixed(6);
  document.getElementById('loc-lng').value = lng.toFixed(6);
}

function getFormCoords() {
  const lat = parseFloat(document.getElementById('loc-lat').value);
  const lng = parseFloat(document.getElementById('loc-lng').value);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

function showTempMarker(lat, lng) {
  if (tempMarker) adminMap.removeLayer(tempMarker);
  if (tempCircle) adminMap.removeLayer(tempCircle);

  const radio = parseInt(document.getElementById('loc-radio').value) || 20;

  tempMarker = addMarker(adminMap, lat, lng, { popup: 'Localización seleccionada', openPopup: true });
  tempCircle = addCircle(adminMap, lat, lng, radio, {
    color: '#4361ee',
    fillColor: '#4361ee',
    fillOpacity: 0.1,
  });

  centerMap(adminMap, lat, lng);
}

/* ============================================
   CRUD Localizaciones
   ============================================ */

function saveLocation() {
  const pista = document.getElementById('loc-pista').value.trim();
  const coords = getFormCoords();
  const radio = parseInt(document.getElementById('loc-radio').value) || 20;

  if (!pista) {
    showToast('Escribe una pista para esta localización.', 'warning');
    return;
  }
  if (!coords) {
    showToast('Haz clic en el mapa para seleccionar una ubicación.', 'warning');
    return;
  }

  if (editingId) {
    // Editar existente
    const idx = locations.findIndex((l) => l.id === editingId);
    if (idx !== -1) {
      locations[idx] = {
        ...locations[idx],
        pista,
        lat: coords.lat,
        lng: coords.lng,
        radio_metros: radio,
      };
      showToast('Localización actualizada.', 'success');
    }
    editingId = null;
    document.getElementById('btn-save').innerHTML = '<span>Guardar localización</span>';
    document.getElementById('btn-cancel').classList.add('hidden');
  } else {
    // Crear nueva
    locations.push({
      id: generateId(),
      pista,
      lat: coords.lat,
      lng: coords.lng,
      radio_metros: radio,
      orden: locations.length + 1,
    });
    showToast('Localización añadida.', 'success');
  }

  resetForm();
  renderLocationsList();
  updateStats();
}

function editLocation(id) {
  const loc = locations.find((l) => l.id === id);
  if (!loc) return;

  editingId = id;
  document.getElementById('loc-id').value = id;
  document.getElementById('loc-pista').value = loc.pista;
  document.getElementById('loc-lat').value = loc.lat.toFixed(6);
  document.getElementById('loc-lng').value = loc.lng.toFixed(6);
  document.getElementById('loc-radio').value = loc.radio_metros;

  document.getElementById('btn-save').innerHTML = '<span>Actualizar localización</span>';
  document.getElementById('btn-cancel').classList.remove('hidden');

  showTempMarker(loc.lat, loc.lng);
  centerMap(adminMap, loc.lat, loc.lng, 16);
}

function deleteLocation(id) {
  showConfirmModal('¿Eliminar localización?', 'Esta acción no se puede deshacer.', 'Eliminar', 'Cancelar').then((confirmed) => {
    if (!confirmed) return;
    locations = locations.filter((l) => l.id !== id);
    // Reordenar
    locations.forEach((l, i) => (l.orden = i + 1));
    if (editingId === id) cancelEdit();
    renderLocationsList();
    updateStats();
    showToast('Localización eliminada.', 'info');
  });
}

function cancelEdit() {
  editingId = null;
  resetForm();
  document.getElementById('btn-save').innerHTML = '<span>Guardar localización</span>';
  document.getElementById('btn-cancel').classList.add('hidden');
}

function resetForm() {
  document.getElementById('loc-id').value = '';
  document.getElementById('loc-pista').value = '';
  document.getElementById('loc-lat').value = '';
  document.getElementById('loc-lng').value = '';
  document.getElementById('loc-radio').value = '20';
  if (tempMarker) adminMap.removeLayer(tempMarker);
  if (tempCircle) adminMap.removeLayer(tempCircle);
  tempMarker = null;
  tempCircle = null;
}

/* ============================================
   Renderizado de lista
   ============================================ */

function renderLocationsList() {
  const container = document.getElementById('locations-list');
  if (locations.length === 0) {
    container.innerHTML = `
      <div class="list-empty">
        <div class="list-empty-icon">📍</div>
        <p>Aún no has añadido localizaciones</p>
        <p class="mt-1" style="font-size: 0.85rem;">Haz clic en el mapa y rellena los datos</p>
      </div>
    `;
    clearMapLayers(adminMap);
    listMarkers = [];
    return;
  }

  const sorted = sortLocations(locations);
  container.innerHTML = '';
  sorted.forEach((loc, index) => {
    const item = document.createElement('div');
    item.className = 'location-item animate-fade-in';
    item.setAttribute('draggable', 'true');
    item.dataset.id = loc.id;
    item.innerHTML = `
      <div class="location-number">${index + 1}</div>
      <div class="location-content">
        <div class="location-pista" title="${escapeHtml(loc.pista)}">${escapeHtml(loc.pista)}</div>
        <div class="location-meta">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} · Radio: ${loc.radio_metros}m</div>
      </div>
      <div class="location-actions">
        <button class="btn btn-ghost" title="Editar" onclick="editLocation('${loc.id}')">✏️</button>
        <button class="btn btn-ghost" title="Eliminar" onclick="deleteLocation('${loc.id}')">🗑️</button>
      </div>
    `;

    // Drag & Drop events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);

    container.appendChild(item);
  });

  // Actualizar marcadores en el mapa
  refreshMapMarkers();
}

/* ============================================
   Drag & Drop
   ============================================ */

let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();

  if (dragSrcEl !== this) {
    const draggedId = dragSrcEl.dataset.id;
    const targetId = this.dataset.id;

    const draggedIdx = locations.findIndex((l) => l.id === draggedId);
    const targetIdx = locations.findIndex((l) => l.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = locations.splice(draggedIdx, 1);
      locations.splice(targetIdx, 0, removed);
      locations.forEach((l, i) => (l.orden = i + 1));
      renderLocationsList();
      updateStats();
    }
  }
  return false;
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.location-item').forEach((item) => item.classList.remove('dragging'));
}

/* ============================================
   Marcadores en mapa
   ============================================ */

function refreshMapMarkers() {
  if (!adminMap) return;
  clearMapLayers(adminMap);
  listMarkers = [];

  const sorted = sortLocations(locations);
  sorted.forEach((loc, index) => {
    const marker = addMarker(adminMap, loc.lat, loc.lng, {
      popup: `<b>#${index + 1}</b><br>${escapeHtml(loc.pista)}`,
    });

    addCircle(adminMap, loc.lat, loc.lng, loc.radio_metros, {
      color: '#4361ee',
      fillColor: '#4361ee',
      fillOpacity: 0.08,
      weight: 1,
    });

    listMarkers.push(marker);
  });

  if (listMarkers.length > 1) {
    fitBounds(adminMap, listMarkers);
  } else if (listMarkers.length === 1) {
    centerMap(adminMap, sorted[0].lat, sorted[0].lng, 16);
  }
}

/* ============================================
   Estadísticas
   ============================================ */

function updateStats() {
  document.getElementById('stat-count').textContent = locations.length;

  if (locations.length < 2) {
    document.getElementById('stat-distance').textContent = '—';
    return;
  }

  const sorted = sortLocations(locations);
  let total = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    total += haversineDistance(sorted[i].lat, sorted[i].lng, sorted[i + 1].lat, sorted[i + 1].lng);
  }
  document.getElementById('stat-distance').textContent = formatDistance(total);
}

/* ============================================
   Exportar y borrar
   ============================================ */

function exportJincana() {
  if (locations.length === 0) {
    showToast('Añade al menos una localización antes de exportar.', 'warning');
    return;
  }

  const data = {
    version: '1.0',
    nombre: 'Mi Jincana',
    localizaciones: sortLocations(locations).map((l) => ({
      id: l.id,
      pista: l.pista,
      lat: l.lat,
      lng: l.lng,
      radio_metros: l.radio_metros,
      orden: l.orden,
    })),
  };

  const filename = `jincana_${new Date().toISOString().slice(0, 10)}`;
  downloadAsJincanaFile(data, filename);
  showToast('Archivo .jincana descargado.', 'success');
}

function clearAll() {
  if (locations.length === 0) return;
  showConfirmModal('¿Borrar todo?', 'Se eliminarán todas las localizaciones. Esta acción no se puede deshacer.', 'Borrar todo', 'Cancelar').then((confirmed) => {
    if (!confirmed) return;
    locations = [];
    cancelEdit();
    renderLocationsList();
    updateStats();
    showToast('Todas las localizaciones han sido eliminadas.', 'info');
  });
}

/* ============================================
   Helpers
   ============================================ */