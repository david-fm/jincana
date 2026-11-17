/**
 * record-tutorial.mjs
 * ---------------------------------------------------------------------------
 * Graba con Playwright el flujo completo del tutorial de Jincana:
 *
 *   1. Inicio:   la pantalla de importación de index.html
 *   2. Crear:    se añaden 3 localizaciones en admin.html (mapa + pistas)
 *   3. Exportar: se descarga el archivo .jincana
 *   4. Jugar:    se carga ese .jincana y la partida queda lista
 *
 * Cada capítulo se graba en su propio contexto de navegador, de forma que
 * cada clip tiene una duración conocida y el montaje con HyperFrames puede
 * alinear los rótulos con exactitud.
 *
 * Detalles de la captura:
 *   · Viewport 1280x720 (16:9) y el vídeo se escala a 1920x1080 con lanczos
 *     en la conversión final, de modo que el texto de la app queda nítido.
 *   · Se inyecta un cursor visible (Playwright no graba el puntero del ratón).
 *   · El scroll es suave, para que el capítulo muestre la navegación real.
 *
 * Uso:
 *   node tutorial/record-tutorial.mjs [--base http://localhost:8765]
 */

import { mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ---------------------------------------------------------------- args --- */

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE = argOf('--base', 'http://localhost:8765');
const OUT = path.resolve(ROOT, argOf('--out', 'tutorial/hyperframes/assets'));
const JINCANA_OUT = path.resolve(ROOT, argOf('--jincana', 'tutorial/out/mi-jincana.jincana'));
const KEEP_RAW = argv.includes('--keep-raw');

const VIEW_W = 1280; // viewport del navegador
const VIEW_H = 720;
const OUT_W = 1920; // resolución final del vídeo
const OUT_H = 1080;
const FPS = 30;

/* --------------------------------------------------------------- playwright --- */

const PLAYWRIGHT_CANDIDATES = [
  process.env.PLAYWRIGHT_MODULE,
  'playwright',
  'playwright-core',
  '/private/tmp/rus/extension/tests/node_modules/playwright-core/index.mjs',
  '/private/tmp/shot/node_modules/playwright-core/index.mjs',
  '/Users/davidflorezmazuera/.npm/_npx/705bc6b22212b352/node_modules/playwright-core/index.mjs',
].filter(Boolean);

async function loadChromium() {
  for (const candidate of PLAYWRIGHT_CANDIDATES) {
    try {
      const mod = await import(candidate);
      if (mod.chromium) return mod.chromium;
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error(
    'No se encuentra Playwright. Instálalo con `npm i -D playwright` o exporta PLAYWRIGHT_MODULE con la ruta a playwright-core.'
  );
}

/* ------------------------------------------------------------------ datos --- */

/** Las tres localizaciones del tutorial (Madrid). */
const PUNTOS = [
  {
    lat: 40.41689,
    lng: -3.70379,
    pista: 'Busca la fuente más antigua de la plaza principal. Al pie de la fuente está la siguiente pista.',
    radio: 20,
  },
  {
    lat: 40.418,
    lng: -3.705,
    pista: 'Sube las escaleras del edificio de ladrillo y mira a la derecha: la tercera respuesta te espera.',
    radio: 20,
  },
  {
    lat: 40.415,
    lng: -3.702,
    pista: 'El final está donde empieza todo: en la puerta de entrada del parque central.',
    radio: 20,
  },
];

/** Posición simulada del jugador (para que el GPS del vídeo tenga sentido). */
const USUARIO = { latitude: 40.415, longitude: -3.705 };

/* ------------------------------------------------------------- utilidades --- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Convierte el .webm de Playwright a MP4 H.264 escalado a 1920x1080. */
async function webmToMp4(webm, mp4) {
  await execFileAsync('ffmpeg', [
    '-y', '-i', webm,
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-movflags', '+faststart',
    mp4,
  ]);
}

/** Duración en segundos de un media file. */
async function duration(file) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]);
  return Number.parseFloat(stdout.trim());
}

/**
 * Inyecta un cursor visible. Playwright no graba el puntero del ratón, así que
 * se dibuja uno con un anillo que pulsa al hacer clic.
 */
async function installCursor(page) {
  await page.evaluate(() => {
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;width:16px;height:16px;
      margin:-8px 0 0 -8px;border-radius:50%;background:#4361ee;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;opacity:0;will-change:transform;`;
    const ring = document.createElement('div');
    ring.style.cssText = `position:fixed;left:0;top:0;z-index:2147483646;width:38px;height:38px;
      margin:-19px 0 0 -19px;border-radius:50%;border:2px solid rgba(67,97,238,.6);
      pointer-events:none;opacity:0;will-change:transform,opacity;`;
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let x = 0;
    let y = 0;
    let pressed = false;
    const place = () => {
      dot.style.transform = `translate(${x}px, ${y}px) scale(${pressed ? 0.75 : 1})`;
      ring.style.transform = `translate(${x}px, ${y}px) scale(${pressed ? 0.55 : 1})`;
    };
    document.addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.opacity = '1';
      place();
    });
    document.addEventListener('mousedown', () => {
      pressed = true;
      place();
      ring.style.opacity = '1';
      setTimeout(() => {
        pressed = false;
        place();
      }, 160);
      setTimeout(() => {
        ring.style.opacity = '0';
      }, 420);
    });
  });
}

/** Scroll suave de la página. */
async function scrollTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await sleep(750);
}

/**
 * Graba un capítulo: abre un contexto con grabación de vídeo, ejecuta `body`
 * y guarda el resultado como MP4. Devuelve la duración del clip.
 */
async function recordChapter(browser, { name, geolocation = false, body }) {
  const videoDir = path.join(OUT, `_raw_${name}`);
  await rm(videoDir, { recursive: true, force: true });
  await mkdir(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    recordVideo: { dir: videoDir, size: { width: VIEW_W, height: VIEW_H } },
  });

  if (geolocation) {
    await context.grantPermissions(['geolocation'], { origin: BASE });
    await context.setGeolocation({ ...USUARIO, accuracy: 15 });
  }

  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`  ⚠ ${name}: error de página -> ${e.message}`));

  await body(page);

  // Un pequeño margen para que el vídeo capture el último fotograma estable.
  await sleep(700);

  const video = page.video();
  await page.close();
  const rawPath = await video.path();
  await context.close();

  const webm = path.join(OUT, `${name}.webm`);
  await rename(rawPath, webm);
  const mp4 = path.join(OUT, `${name}.mp4`);
  await webmToMp4(webm, mp4);
  if (!KEEP_RAW) await rm(webm, { force: true });

  const dur = await duration(mp4);
  console.log(`  ✓ ${name}.mp4  ${dur.toFixed(2)}s`);
  return {
    name,
    file: path.relative(path.join(ROOT, 'tutorial/hyperframes'), mp4),
    duration: dur,
  };
}

/* ------------------------------------------------------- acciones del flujo --- */

/** Convierte lat/lng a coordenadas de pantalla sobre el mapa de Leaflet. */
async function mapPointToScreen(page, mapId, lat, lng) {
  return page.evaluate(
    ({ mapId, lat, lng }) => {
      const map = mapInstances[mapId];
      const rect = document.getElementById(mapId).getBoundingClientRect();
      const p = map.latLngToContainerPoint([lat, lng]);
      return { x: rect.left + p.x, y: rect.top + p.y };
    },
    { mapId, lat, lng }
  );
}

/** Espera a que el mapa de Leaflet haya pintado los tiles. */
async function waitForTiles(page) {
  await page.waitForFunction(
    () => document.querySelectorAll('.leaflet-tile-loaded').length > 3,
    null,
    { timeout: 20000 }
  );
}

/* ---------------------------------------------------------------- capítulos --- */

async function chapterInicio(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#import-screen', { state: 'visible' });
  await installCursor(page);
  await sleep(1400);

  // El puntero señala la zona de importación y después la pestaña "Crear".
  await page.mouse.move(640, 430, { steps: 24 });
  await sleep(900);
  await page.mouse.move(1140, 96, { steps: 24 });
  await sleep(1400);
}

async function chapterCrear(page) {
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await waitForTiles(page);
  await installCursor(page);

  // Encuadre fijo sobre la zona de los tres puntos (no depende del GPS).
  await page.evaluate(() => {
    mapInstances['admin-map'].setView([40.4172, -3.7039], 15);
  });
  await scrollTo(page, 0);
  await sleep(1200);

  for (const punto of PUNTOS) {
    // 1) El mapa arriba, centrado en el punto: se marca (marcador + radio).
    //    Centrar antes de hacer clic garantiza que el punto cae dentro del
    //    mapa visible (si no, el clic aterriza fuera y no se guarda nada).
    await scrollTo(page, 0);
    await page.evaluate(
      ({ lat, lng }) => mapInstances['admin-map'].setView([lat, lng], 15),
      { lat: punto.lat, lng: punto.lng }
    );
    await sleep(1400);
    const { x, y } = await mapPointToScreen(page, 'admin-map', punto.lat, punto.lng);
    await page.mouse.move(x, y, { steps: 22 });
    await sleep(500);
    await page.mouse.click(x, y);
    await sleep(1600);

    // 2) Abajo: la pista y el radio de llegada.
    await scrollTo(page, 430);
    await page.click('#loc-pista');
    await page.locator('#loc-pista').pressSequentially(punto.pista, { delay: 16 });
    await sleep(400);
    await page.fill('#loc-radio', String(punto.radio));
    await sleep(300);

    // 3) Guardar.
    await page.click('#btn-save');
    await sleep(1300);
  }

  // Vista final: la lista con las tres localizaciones ya creadas.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await sleep(1500);
}

async function chapterExportar(page) {
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await waitForTiles(page);
  await installCursor(page);

  // Se inyectan las 3 localizaciones ya creadas (estado equivalente al capítulo 2).
  await page.evaluate((puntos) => {
    // `locations` es un `let` de ámbito global en admin.js: se asigna el binding,
    // no la propiedad de window (el binding léxico tiene prioridad).
    locations = puntos.map((p, i) => ({
      id: `tutorial-${i + 1}`,
      pista: p.pista,
      lat: p.lat,
      lng: p.lng,
      radio_metros: p.radio,
      orden: i + 1,
    }));
    renderLocationsList();
    updateStats();
    refreshMapMarkers();
  }, PUNTOS);
  await sleep(2400);

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await sleep(1200);

  const boton = page.getByRole('button', { name: 'Exportar .jincana' });
  const box = await boton.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await sleep(600);
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    boton.click(),
  ]);

  const destino = path.resolve(JINCANA_OUT);
  await mkdir(path.dirname(destino), { recursive: true });
  await download.saveAs(destino);
  console.log(`  · descargado ${path.basename(destino)} (${download.suggestedFilename()})`);

  // Se espera al toast de confirmación.
  await sleep(1500);
}

async function chapterJugar(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#import-screen', { state: 'visible' });
  await installCursor(page);
  await sleep(1400);

  const texto = await readFile(JINCANA_OUT, 'utf8');

  // El puntero va a la zona de arrastre.
  const zona = await page.locator('#file-drop-zone').boundingBox();
  if (zona) {
    await page.mouse.move(zona.x + zona.width / 2, zona.y + zona.height / 2, { steps: 20 });
    await sleep(900);
  }

  // Arrastrar y soltar el archivo .jincana sobre la zona de importación.
  await page.evaluate(async (contenido) => {
    const file = new File([contenido], 'mi-jincana.jincana', { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const zone = document.getElementById('file-drop-zone');
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 800));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  }, texto);

  await sleep(3500);
  await waitForTiles(page);

  // GPS activo + distancia calculada.
  await page.waitForFunction(
    () => {
      const v = document.getElementById('distance-value');
      return v && /\d/.test(v.textContent) && v.textContent !== '—';
    },
    null,
    { timeout: 20000 }
  );
  await sleep(1200);

  // Se baja un poco para que se vean el GPS, la distancia y el botón de acción.
  await scrollTo(page, 420);
  await sleep(2600);
}

/* -------------------------------------------------------------------- main --- */

async function main() {
  await mkdir(OUT, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  console.log(`▶ Grabando el tutorial de Jincana (${VIEW_W}x${VIEW_H} → ${OUT_W}x${OUT_H}) desde ${BASE}`);

  const capitulos = [];
  try {
    capitulos.push(await recordChapter(browser, { name: '01-inicio', body: chapterInicio }));
    capitulos.push(await recordChapter(browser, { name: '02-crear', body: chapterCrear }));
    capitulos.push(await recordChapter(browser, { name: '03-exportar', body: chapterExportar }));
    capitulos.push(await recordChapter(browser, { name: '04-jugar', geolocation: true, body: chapterJugar }));
  } finally {
    await browser.close();
  }

  const manifest = {
    generado_por: 'tutorial/record-tutorial.mjs',
    base_url: BASE,
    viewport: `${VIEW_W}x${VIEW_H}`,
    salida: `${OUT_W}x${OUT_H}`,
    fps: FPS,
    capitulos,
  };
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('▶ Capítulos:', capitulos.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`).join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
