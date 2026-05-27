/**
 * utils.js
 * Helpers compartidos para la app Jincana
 */

const JINCANA_STORAGE_KEY = 'jincana_progress';

/**
 * Genera un ID único simple
 */
function generateId() {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine.
 * Retorna la distancia en metros.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Guarda el progreso del jugador en localStorage.
 */
function saveProgress(progress) {
  try {
    localStorage.setItem(JINCANA_STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('No se pudo guardar el progreso:', e);
  }
}

/**
 * Carga el progreso del jugador desde localStorage.
 */
function loadProgress() {
  try {
    const raw = localStorage.getItem(JINCANA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('No se pudo cargar el progreso:', e);
    return null;
  }
}

/**
 * Elimina el progreso guardado.
 */
function clearProgress() {
  localStorage.removeItem(JINCANA_STORAGE_KEY);
}

/**
 * Descarga un objeto como archivo JSON con extensión .jincana
 */
function downloadAsJincanaFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.jincana') ? filename : `${filename}.jincana`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo como texto.
 * Retorna una Promise con el contenido.
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Valida que el objeto parsed sea una jincana válida.
 */
function validateJincanaData(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'El archivo no es un objeto JSON válido.' };
  if (!data.version || !data.nombre || !Array.isArray(data.localizaciones)) {
    return { valid: false, error: 'Estructura de jincana inválida. Faltan campos obligatorios.' };
  }
  if (data.localizaciones.length === 0) {
    return { valid: false, error: 'La jincana no tiene localizaciones.' };
  }
  for (const loc of data.localizaciones) {
    if (typeof loc.pista !== 'string' || loc.pista.trim() === '') {
      return { valid: false, error: 'Todas las localizaciones deben tener una pista.' };
    }
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return { valid: false, error: 'Todas las localizaciones deben tener coordenadas válidas.' };
    }
    if (loc.password !== undefined && typeof loc.password !== 'string') {
      return { valid: false, error: 'La contraseña de una localización debe ser un texto.' };
    }
  }
  return { valid: true };
}

/**
 * Genera un hash simple para identificar una jincana.
 */
function hashJincana(data) {
  const str = JSON.stringify(data.localizaciones.map(l => `${l.lat},${l.lng},${l.pista},${l.password || ''}`));
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Formatea una distancia en metros a texto legible.
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Ordena localizaciones por el campo "orden".
 */
function sortLocations(locations) {
  return [...locations].sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/**
 * Escapa HTML para prevenir XSS.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
