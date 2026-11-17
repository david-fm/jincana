/**
 * build-composition.mjs
 * ---------------------------------------------------------------------------
 * Genera `tutorial/hyperframes/index.html` a partir de
 * `tutorial/hyperframes/composition.template.html`, inyectando los tiempos
 * reales de cada capítulo (leídos de `assets/manifest.json`).
 *
 * Así, si se vuelve a grabar el tutorial, los rótulos y las transiciones
 * siguen encajando con los clips sin tocar el HTML a mano.
 *
 * Uso:
 *   node tutorial/build-composition.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HF = path.join(__dirname, 'hyperframes');

/** Duraciones fijas de las escenas que no dependen de la grabación. */
const TITLE_DUR = 5.0;
const END_DUR = 6.0;
/** Desfase de la transición respecto al corte entre escenas. */
const WIPE_LEAD = 0.35;
const WIPE_TAIL = 0.45;

const round = (n, d = 3) => Number(n.toFixed(d));

async function main() {
  const manifest = JSON.parse(await readFile(path.join(HF, 'assets/manifest.json'), 'utf8'));
  const caps = manifest.capitulos;
  if (!caps || caps.length !== 4) {
    throw new Error(`El manifiesto debe contener 4 capítulos (contiene ${caps?.length ?? 0}).`);
  }

  const timings = { TITLE_START: 0, TITLE_DUR };
  let cursor = TITLE_DUR;

  caps.forEach((cap, i) => {
    const n = i + 1;
    timings[`CH${n}_START`] = round(cursor);
    timings[`CH${n}_DUR`] = round(cap.duration);
    cursor += cap.duration;
  });

  timings.END_START = round(cursor);
  timings.END_DUR = END_DUR;
  timings.TOTAL = round(cursor + END_DUR);

  // Transiciones: el panel entra 0,35 s antes del corte y sale 0,45 s después.
  const cortes = [
    timings.CH1_START,
    timings.CH2_START,
    timings.CH3_START,
    timings.CH4_START,
    timings.END_START,
  ];
  cortes.forEach((corte, i) => {
    timings[`TR${i + 1}_START`] = round(corte - WIPE_LEAD);
    timings[`TR${i + 1}_DUR`] = round(WIPE_LEAD + WIPE_TAIL);
  });

  const template = await readFile(path.join(HF, 'composition.template.html'), 'utf8');
  const faltantes = Object.keys(timings).filter((k) => !template.includes(`{{${k}}}`));
  if (faltantes.length) {
    throw new Error(`La plantilla no usa estos marcadores: ${faltantes.join(', ')}`);
  }

  const html = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in timings)) throw new Error(`Marcador desconocido en la plantilla: {{${key}}}`);
    return String(timings[key]);
  });

  await writeFile(path.join(HF, 'index.html'), html);

  const resumen = caps
    .map((c, i) => `${c.name} ${timings[`CH${i + 1}_START`]}s → ${round(timings[`CH${i + 1}_START`] + c.duration)}s`)
    .join(' | ');
  console.log(`✓ index.html generado (${timings.TOTAL}s)`);
  console.log(`  ${resumen}`);
  console.log(`  cierre ${timings.END_START}s → ${timings.TOTAL}s`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
