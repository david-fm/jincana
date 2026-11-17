# Jincana

**Jincana** es una geocaching de pistas: el jugador recibe una descripción
 textual y tiene que llegar al lugar exacto que describe. El mapa no enseña la
solución, solo la distancia; el GPS hace el resto.

La app es estática y funciona en cualquier navegador: **crea** una jincana
marcando puntos en el mapa, **expórtala** a un archivo `.jincana` y compártelo.
Quien lo recibe lo **carga** y juega.

![Tutorial de Jincana: crear una jincana de 3 puntos, exportarla y jugarla](tutorial/jincana-tutorial.gif)

*71 s · 1920×1080 · 30 fps* — el recorrido completo: marcar los puntos en el
mapa, **descargar** el `.jincana` y **cargarlo** hasta dejarlo listo para jugar.

> ▶ El clip de arriba se reproduce solo (GitHub no incrusta MP4 en el README,
> así que es un GIF de 8 MB). El vídeo original en MP4 y 1080p está aquí:
> [`tutorial/jincana-tutorial.mp4`](tutorial/jincana-tutorial.mp4) (30 MB).

---

## Índice

- [Puesta en marcha](#puesta-en-marcha)
- [Cómo se usa](#cómo-se-usa)
- [El formato `.jincana`](#el-formato-jincana)
- [Estructura del proyecto](#estructura-del-proyecto)
- [El tutorial en vídeo](#el-tutorial-en-vídeo)
- [Detalles de implementación](#detalles-de-implementación)
- [Licencia](#licencia)

---

## Puesta en marcha

La app es HTML + CSS + JavaScript sin build ni dependencias. Solo necesita un
servidor HTTP local (los navegadores bloquean `file://` y el GPS exige un
contexto seguro).

```bash
# Con Python
python3 -m http.server 8765

# O con Node
npx serve -l 8765
```

Y abre <http://localhost:8765/index.html>.

Requisitos:

- Un navegador moderno (Chrome, Safari, Firefox, Edge).
- **Conexión a internet**: Leaflet 1.9.4, la tipografía Inter y
  canvas-confetti se cargan desde CDN.
- **Permiso de ubicación** del navegador para jugar (la pestaña *Crear* también
  intenta centrar el mapa en tu posición actual, pero funciona sin GPS).

> En un móvil real, la app necesita servirse por **HTTPS** (o `localhost`) para
> que el navegador conceda la geolocalización.

---

## Cómo se usa

### 1. Crear (`admin.html`)

1. **Haz clic en el mapa**: se coloca un marcador y un círculo con el radio de
   llegada elegido; las coordenadas se rellenan solas.
2. **Escribe la pista** (el texto que verá el jugador). Opcionalmente, ponle una
   **contraseña** para que la pista no se muestre hasta introducirla.
3. **Guardar localización**. Cada punto aparece numerado en la lista de abajo.
4. **Reordena** los puntos arrastrando los elementos de la lista: el número es
   el orden en el que se revelan las pistas.
5. **Exportar .jincana** descarga el archivo con todos los puntos ya ordenados.

### 2. Jugar (`index.html`)

1. Arrastra el archivo `.jincana` (o `.json`) sobre la zona de importación, o
   pulsa **Cargar jincana de ejemplo** para probar con la demo de Madrid.
2. La app lee el GPS y muestra la **pista actual**, la **distancia** al
   objetivo y tu posición en el mapa. La ubicación objetivo **no** se dibuja.
3. Al entrar en el radio de llegada salta la comprobación automáticamente
   (con confeti); también puedes forzar el avance con **He llegado**.
4. El progreso se guarda en `localStorage`, así que puedes cerrar y volver.

---

## El formato `.jincana`

Un `.jincana` es JSON con esta estructura:

```json
{
  "version": "1.0",
  "nombre": "Mi Jincana",
  "localizaciones": [
    {
      "id": "tutorial-1",
      "pista": "Busca la fuente más antigua de la plaza principal.",
      "lat": 40.41689,
      "lng": -3.70379,
      "radio_metros": 20,
      "orden": 1,
      "password": "opcional"
    }
  ]
}
```

| Campo              | Tipo     | Obligatorio | Descripción                                                        |
| ------------------ | -------- | ----------- | ------------------------------------------------------------------ |
| `version`          | string   | sí          | Versión del formato (`1.0`).                                        |
| `nombre`           | string   | sí          | Título de la jincana, se muestra en la cabecera del juego.         |
| `localizaciones`   | array    | sí          | Lista de puntos, al menos uno.                                      |
| `….id`            | string   | no          | Identificador del punto (se genera al crearlo).                     |
| `….pista`         | string   | sí          | Texto de la pista. No puede estar vacío.                           |
| `….lat`           | number   | sí          | Latitud en grados decimales (`40.41689`).                           |
| `….lng`           | number   | sí          | Longitud en grados decimales (`-3.70379`).                          |
| `….radio_metros`  | number   | no          | Radio de llegada en metros (por defecto `20`, entre `5` y `500`).   |
| `….orden`         | number   | no          | Posición en la secuencia de juego (1 = primera pista).              |
| `….password`      | string   | no          | Si está, la pista permanece oculta hasta introducir la contraseña. |

La validación la hace `validateJincanaData()` en `js/utils.js`: exige
`version`, `nombre` y un array no vacío de localizaciones, y que cada una tenga
`pista` no vacía y coordenadas numéricas.

---

## Estructura del proyecto

```
.
├── index.html            # Vista de juego: importar y jugar
├── admin.html            # Vista de creación: mapa, formulario y exportación
├── css/
│   ├── style.css         # Tokens de diseño, reset y componentes base
│   ├── game.css          # Pantallas de juego, mapa, GPS, distancia
│   └── admin.css         # Estadísticas, formulario y lista de localizaciones
├── js/
│   ├── utils.js          # Haversine, localStorage, validación, descarga, XSS
│   ├── maps.js           # Envoltorio de Leaflet (mapa, marcadores, círculos)
│   ├── app.js            # Modal de confirmación y toasts (compartido)
│   ├── game.js           # Importación, GPS, distancia, llegada y victoria
│   └── admin.js          # CRUD de localizaciones, drag & drop y exportación
├── datos/
│   └── ejemplo.jincana   # Jincana de ejemplo (Madrid, 3 puntos): la que carga
│                         # el botón «Cargar jincana de ejemplo»
└── tutorial/
    ├── jincana-tutorial.mp4   # Tutorial final (1920×1080, 71 s)
    ├── jincana-tutorial.gif   # Previsualización para el README (560 px, 12 fps)
    ├── record-tutorial.mjs    # Grabación con Playwright de los 4 capítulos
    ├── build-composition.mjs  # Inyecta los tiempos reales en la composición
    ├── design.md              # Tokens de diseño del vídeo
    ├── out/mi-jincana.jincana # Archivo generado durante la grabación
    └── hyperframes/
        ├── composition.template.html  # Plantilla de la composición
        ├── index.html                 # Generado (no editar a mano)
        └── assets/*.mp4               # Capítulos grabados
```

---

## El tutorial en vídeo

El vídeo embebido arriba (`tutorial/jincana-tutorial.mp4`, 1920×1080, 30 fps,
H.264, 71 s) recorre el caso completo: **crear** una jincana de 3 puntos,
**descargar** el `.jincana` y **cargarlo** hasta dejarla lista para jugar.

GitHub no reproduce MP4 dentro del README: el elemento `<video>` lo elimina
el sanitizador y la sintaxis de imagen con un `.mp4` produce una imagen rota.
Por eso la previsualización es `tutorial/jincana-tutorial.gif` (560 px, 12 fps,
8 MB), que sí se anima solo; el MP4 se enlaza aparte.

El vídeo se produce en cuatro pasos, todos reproducibles:

```bash
# 1) Grabar los capítulos con Playwright (necesita la app servida en :8765)
python3 -m http.server 8765 &
node tutorial/record-tutorial.mjs

# 2) Inyectar los tiempos reales de cada capítulo en la composición
node tutorial/build-composition.mjs

# 3) Montar y renderizar el vídeo con HyperFrames
cd tutorial/hyperframes
npx hyperframes render --fps 30 --quality looks -o ../jincana-tutorial.mp4
cd ../..

# 4) Regenerar el GIF de previsualización del README
ffmpeg -i tutorial/jincana-tutorial.mp4 \
  -vf "fps=12,scale=560:-2:flags=lanczos,split[a][b];\
[a]palettegen=max_colors=128:stats_mode=diff[p];\
[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  -loop 0 tutorial/jincana-tutorial.gif
```

Detalles del proceso:

- **Grabación** (`record-tutorial.mjs`): cada capítulo se graba en su propio
  contexto de Playwright (`1280×720`, escalado a `1920×1080` con lanczos).
  El cursor real no aparece en la grabación, así que el script inyecta un
  puntero visible; la geolocalización del capítulo 4 se simula con
  `context.setGeolocation()` en Madrid (40.415, −3.705).
- **Montaje** (`build-composition.mjs`): lee `assets/manifest.json` y rellena los
  marcadores `{{CH1_START}}`, `{{TR2_DUR}}`, etc. de
  `composition.template.html`, de forma que los rótulos y las transiciones
  siguen encajando aunque cambie la duración de una grabación.
- **Render** (HyperFrames): la composición añade las cartelas de texto sobre los
  márgenes del vídeo, la lista de pasos y las transiciones con el panel azul de
  marca.

Requisitos: Node ≥ 20, `playwright` (o `playwright-core` en
`PLAYWRIGHT_MODULE`), `ffmpeg`/`ffprobe` y el CLI de HyperFrames
(`npx hyperframes`). Consulta `tutorial/design.md` para los tokens de color y
tipografía del vídeo.

---

## Detalles de implementación

- **Distancia**: fórmula de Haversine (`utils.js`), radio terrestre 6 371 000 m.
  El mapa muestra la distancia en metros hasta 1 km y en kilómetros a partir de
  ahí.
- **Radio de llegada**: si la distancia es menor que `radio_metros`, la app
  avanza sola (`checkAutoArrival`); el botón *He llegado* fuerza el avance tras
  un modal de confirmación.
- **Contraseñas**: la pista con `password` se oculta hasta acertar. El estado de
  desbloqueo se guarda junto al progreso.
- **Progreso**: `localStorage`, clave `jincana_progress`. Guarda la jincana
  entera, el índice actual, el estado de victoria y las pistas desbloqueadas.
- **Hash de jincana**: `hashJincana()` genera un identificador corto a partir de
  las localizaciones, para detectar si el archivo cargado es el mismo.
- **Seguridad**: el texto de las pistas se inserta con `escapeHtml()` para evitar
  XSS, y el archivo importado se valida antes de usarse.
- **Mapa**: Leaflet con teselas de OpenStreetMap. El mapa del juego se inicializa
  con el contenedor oculto (`display: none`), por lo que `startGame()` llama a
  `invalidateSize()` antes de arrancar el GPS: sin ese recálculo, Leaflet se
  queda con un tamaño 0×0 y ni pinta teselas ni centra el mapa.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
