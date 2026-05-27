/**
 * game.js
 * Lógica del modo juego
 */

let jincanaData = null;
let jincanaHash = null;
let currentIndex = 0;
let watchId = null;
let gameMap = null;
let userMarker = null;
let targetMarker = null;
let targetCircle = null;
let isVictory = false;
let isTransitioning = false;
let unlockedPasswords = {};

/* ============================================
   Inicialización y carga de progreso guardado
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  setupFileDrop();
  initGameMap();

  const saved = loadProgress();
  if (saved && saved.jincanaData) {
    tryRestoreProgress(saved);
  }

  const passwordInput = document.getElementById('clue-password-input');
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptUnlock();
      }
    });
  }
});

function tryRestoreProgress(saved) {
  const validation = validateJincanaData(saved.jincanaData);
  if (!validation.valid) {
    clearProgress();
    return;
  }
  jincanaData = saved.jincanaData;
  jincanaHash = saved.jincanaHash || hashJincana(jincanaData);
  currentIndex = saved.currentIndex || 0;
  isVictory = saved.isVictory || false;
  unlockedPasswords = saved.unlockedPasswords || {};

  if (isVictory) {
    showVictory();
  } else {
    startGame(true); // iniciar geolocalización al restaurar progreso
  }
}

/* ============================================
   Importación de archivo
   ============================================ */

function setupFileDrop() {
  const zone = document.getElementById('file-drop-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    input.value = '';
  });
}

async function processFile(file) {
  try {
    const text = await readFileAsText(file);
    const data = JSON.parse(text);
    const validation = validateJincanaData(data);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      return;
    }
    jincanaData = data;
    jincanaHash = hashJincana(data);
    currentIndex = 0;
    isVictory = false;
    saveGameState();
    startGame(true);
    showToast(`Jincana "${data.nombre}" cargada. ¡Buena suerte!`, 'success');
  } catch (err) {
    showToast('No se pudo leer el archivo. Asegúrate de que sea un .jincana válido.', 'error');
    console.error(err);
  }
}

/* ============================================
   Demo
   ============================================ */

function loadDemo() {
  jincanaData = {
    version: '1.0',
    nombre: 'Jincana de Ejemplo',
    localizaciones: [
      {
        id: 'demo-1',
        pista: 'Busca la fuente más antigua de la plaza principal. Allí encontrarás la siguiente pista oculta.',
        lat: 40.4168,
        lng: -3.7038,
        radio_metros: 20,
        orden: 1,
      },
      {
        id: 'demo-2',
        pista: 'Sube las escaleras del edificio con la fachada azul. La respuesta está en la segunda planta.',
        password: 'azul123',
        lat: 40.418,
        lng: -3.705,
        radio_metros: 20,
        orden: 2,
      },
      {
        id: 'demo-3',
        pista: 'El final está donde empieza todo: en la puerta de entrada del parque central.',
        lat: 40.415,
        lng: -3.702,
        radio_metros: 20,
        orden: 3,
      },
    ],
  };
  jincanaHash = hashJincana(jincanaData);
  currentIndex = 0;
  isVictory = false;
  saveGameState();
  startGame(true);
  showToast('Jincana de ejemplo cargada.', 'success');
}

/* ============================================
   Inicio del juego
   ============================================ */

function startGame(requestGeolocation = true) {
  document.getElementById('import-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('active');
  document.getElementById('victory-screen').classList.remove('active');

  updateGameHeader();
  renderCurrentClue();
  renderMap();

  if (requestGeolocation) {
    startGeolocation();
  }
}

function updateGameHeader() {
  if (!jincanaData) return;
  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;
  document.getElementById('game-title').textContent = jincanaData.nombre;
  document.getElementById('game-progress').textContent = `${currentIndex + 1} / ${sorted.length}`;
}

function renderCurrentClue() {
  if (!jincanaData) return;
  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;
  const loc = sorted[currentIndex];
  const clueText = document.getElementById('clue-text');
  const passwordPrompt = document.getElementById('clue-password-prompt');
  const passwordInput = document.getElementById('clue-password-input');
  const passwordError = document.getElementById('clue-password-error');

  passwordError.classList.add('hidden');
  passwordInput.value = '';

  if (loc.password) {
    const locKey = loc.id || `${currentIndex}`;
    if (unlockedPasswords[locKey]) {
      clueText.textContent = loc.pista;
      clueText.classList.remove('hidden');
      passwordPrompt.classList.add('hidden');
    } else {
      clueText.classList.add('hidden');
      passwordPrompt.classList.remove('hidden');
      passwordInput.focus();
    }
  } else {
    clueText.textContent = loc.pista;
    clueText.classList.remove('hidden');
    passwordPrompt.classList.add('hidden');
  }
}

/* ============================================
   Mapa del juego
   ============================================ */

function initGameMap() {
  gameMap = initMap('game-map', { zoom: 15 });
}

function renderMap() {
  if (!gameMap || !jincanaData) return;
  clearMapLayers(gameMap);

  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;

  const loc = sorted[currentIndex];
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number' || isNaN(loc.lat) || isNaN(loc.lng)) {
    console.error('Coordenadas inválidas para la localización actual:', loc);
    return;
  }

  // En modo juego NO mostramos el objetivo en el mapa (solo la pista como texto)
  // Solo limpiamos capas previas; el mapa se centrará en la ubicación del usuario
  // cuando el GPS esté activo (ver updateUserMarker)
}

/* ============================================
   Geolocalización
   ============================================ */

function startGeolocation() {
  if (!navigator.geolocation) {
    showGPSStatus('error', 'Tu navegador no soporta geolocalización.');
    return;
  }

  showGPSStatus('loading', 'Solicitando permiso de ubicación...');

  watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    }
  );
}

function stopGeolocation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function onPositionUpdate(position) {
  const { latitude, longitude, accuracy } = position.coords;

  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    console.warn('GPS devolvió coordenadas inválidas:', latitude, longitude);
    return;
  }

  updateUserMarker(latitude, longitude);
  updateDistance(latitude, longitude);

  const indicator = document.getElementById('gps-indicator');
  indicator.classList.add('active', 'pulse');

  showGPSStatus('active', `Precisión: ±${Math.round(accuracy)} metros`);

  checkAutoArrival(latitude, longitude);
}

function resumeGeolocation() {
  if (watchId !== null) {
    stopGeolocation();
  }
  startGeolocation();
}

function onPositionError(error) {
  const indicator = document.getElementById('gps-indicator');
  indicator.classList.remove('active', 'pulse');

  let msg = 'No se pudo obtener tu ubicación.';
  if (error.code === 1) msg = 'Permiso de ubicación denegado. Activa la ubicación en tu dispositivo.';
  if (error.code === 2) msg = 'No se pudo determinar tu posición. Inténtalo en un lugar abierto.';
  if (error.code === 3) msg = 'Tiempo de espera agotado. Comprueba tu señal GPS.';

  showGPSStatus('error', msg);
}

function showGPSStatus(type, message) {
  const indicator = document.getElementById('gps-indicator');
  const label = document.getElementById('gps-label');
  const value = document.getElementById('gps-value');
  const btnResume = document.getElementById('btn-resume-gps');

  indicator.classList.remove('active', 'pulse');
  if (type === 'error') {
    indicator.style.background = '#ef476f';
    btnResume.classList.remove('hidden');
  } else if (type === 'loading') {
    indicator.style.background = '#ffd166';
    btnResume.classList.add('hidden');
  } else if (type === 'active') {
    indicator.style.background = '';
    btnResume.classList.add('hidden');
  } else {
    indicator.style.background = '';
    btnResume.classList.remove('hidden');
  }

  label.textContent = type === 'error' ? 'Error de ubicación' : type === 'loading' ? 'Cargando...' : type === 'active' ? 'Ubicación activa' : 'Esperando ubicación...';
  value.textContent = message;
}

function updateUserMarker(lat, lng) {
  if (!gameMap) return;
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `<div style="width:16px;height:16px;background:#06d6a0;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(gameMap);
  }
  // Centrar el mapa en la ubicación del usuario (modo juego no revela el objetivo)
  centerMap(gameMap, lat, lng, gameMap.getZoom() || 16);
}

/* ============================================
   Distancia y llegada
   ============================================ */

function updateDistance(userLat, userLng) {
  if (!jincanaData) return;
  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;

  const loc = sorted[currentIndex];
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number' || isNaN(loc.lat) || isNaN(loc.lng)) return;

  const dist = haversineDistance(userLat, userLng, loc.lat, loc.lng);

  const distEl = document.getElementById('distance-value');
  distEl.textContent = formatDistance(dist);

  distEl.classList.remove('near', 'very-near');
  if (dist <= loc.radio_metros) {
    distEl.classList.add('near');
  } else if (dist <= loc.radio_metros * 3) {
    distEl.classList.add('very-near');
  }

  // Guardar distancia en estado para referencia
  saveGameState();
}

function checkAutoArrival(userLat, userLng) {
  if (isVictory || isTransitioning) return;
  if (!jincanaData) return;
  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;

  const loc = sorted[currentIndex];
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number' || isNaN(loc.lat) || isNaN(loc.lng)) return;

  const dist = haversineDistance(userLat, userLng, loc.lat, loc.lng);

  if (dist <= loc.radio_metros) {
    triggerArrival();
  }
}

async function confirmArrived() {
  const confirmed = await showConfirmModal(
    '¿Confirmar llegada?',
    'Solo confirma si realmente has llegado a la localización. No se puede deshacer.',
    'Sí, he llegado',
    'Cancelar'
  );
  if (confirmed) {
    triggerArrival();
  }
}

function triggerArrival() {
  if (isVictory || isTransitioning) return;
  if (!jincanaData) return;
  isTransitioning = true;

  const sorted = sortLocations(jincanaData.localizaciones);

  // Confetti!
  launchConfetti();

  currentIndex++;

  if (currentIndex >= sorted.length) {
    isVictory = true;
    saveGameState();
    stopGeolocation();
    isTransitioning = false;
    showVictory();
    return;
  }

  // Reset password unlock state for the new clue
  const nextLoc = sorted[currentIndex];
  const locKey = nextLoc.id || `${currentIndex}`;
  if (nextLoc.password && !unlockedPasswords[locKey]) {
    // Need to unlock again
  }

  // Actualizar UI con siguiente pista
  updateGameHeader();
  renderCurrentClue();
  renderMap();
  saveGameState();
  isTransitioning = false;

  showToast('¡Correcto! Aquí tienes la siguiente pista.', 'success');
}

function launchConfetti() {
  if (typeof confetti !== 'undefined') {
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }
}

/* ============================================
   Victoria y reinicio
   ============================================ */

function showVictory() {
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('victory-screen').classList.add('active');
  launchConfetti();
}

async function resetProgress() {
  const confirmed = await showConfirmModal(
    '¿Reiniciar progreso?',
    'Perderás todo tu avance en esta jincana.',
    'Reiniciar',
    'Cancelar'
  );
  if (!confirmed) return;

  clearProgress();
  currentIndex = 0;
  isVictory = false;
  jincanaData = null;
  jincanaHash = null;
  unlockedPasswords = {};
  stopGeolocation();

  document.getElementById('import-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('victory-screen').classList.remove('active');

  // Resetear UI
  document.getElementById('distance-value').textContent = '—';
  document.getElementById('distance-value').classList.remove('near', 'very-near');
  document.getElementById('gps-indicator').classList.remove('active', 'pulse');
  document.getElementById('gps-indicator').style.background = '';
  document.getElementById('gps-label').textContent = 'Esperando ubicación...';
  document.getElementById('gps-value').textContent = 'Activa la ubicación de tu dispositivo';

  if (gameMap) {
    clearMapLayers(gameMap);
    userMarker = null;
    targetMarker = null;
    targetCircle = null;
  }
}

/* ============================================
   Contraseña de pistas
   ============================================ */

function attemptUnlock() {
  if (!jincanaData) return;
  const sorted = sortLocations(jincanaData.localizaciones);
  if (currentIndex < 0 || currentIndex >= sorted.length) return;
  const loc = sorted[currentIndex];
  if (!loc.password) return;

  const input = document.getElementById('clue-password-input');
  const error = document.getElementById('clue-password-error');
  const entered = input.value;

  if (entered === loc.password) {
    const locKey = loc.id || `${currentIndex}`;
    unlockedPasswords[locKey] = true;
    error.classList.add('hidden');
    renderCurrentClue();
    showToast('¡Pista desbloqueada!', 'success');
  } else {
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

// Allow Enter key to submit password

/* ============================================
   Persistencia
   ============================================ */

function saveGameState() {
  if (!jincanaData) return;
  saveProgress({
    jincanaData,
    jincanaHash,
    currentIndex,
    isVictory,
    unlockedPasswords,
    updatedAt: Date.now(),
  });
}

/* ============================================
   Helpers
   ============================================ */
