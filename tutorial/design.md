# design.md — Jincana (identidad del vídeo del tutorial)

Source of truth: these are the real design tokens of the Jincana web app
(`css/style.css`), reused so the tutorial looks like the product it explains.

## Colors

| Token          | Value     | Use in the composition                                       |
| -------------- | --------- | ------------------------------------------------------------ |
| `brand-ink`    | `#1a1a2e` | Texto principal, fondo de las tarjetas de cierre (oscurecido a `#14162e`) |
| `brand-muted`  | `#6c757d` | Texto secundario (descripciones, etiquetas)                   |
| `brand-accent` | `#4361ee` | Azul de marca: badges, pasos activos, panel de transición      |
| `brand-wash`   | `#eef1ff` | Fondo de los badges claros                                    |
| `surface`      | `#ffffff` | Tarjetas blancas sobre las lado del vídeo                     |
| `canvas`       | `#f8f9fa` | Fondo de la app (el que se ve en los márgenes del vídeo)      |
| `hairline`     | `#e9ecef` | Bordes de tarjetas                                            |
| `success`      | `#06d6a0` | Confirmaciones (verde del GPS en la app)                      |

Background of the title/end cards: `#14162e` (a darkened `brand-ink`, kept in
the same navy family — never pure black).

## Typography

- **Inter** (300–900) — the app's own font. It is the typeface already visible
  in every recorded frame, so the overlays must match it. Weight contrast is
  extreme on purpose: headlines 800, body 500, labels 600.
- **JetBrains Mono** (400–600) — reserved for technical data: the
  `.jincana` file name, the step counters, the export/import labels. It is the
  only second voice in the piece and it never appears in prose.

Sizes (rendered video, not web): headline 72–120px, card title 34px,
body 22px, mono label 18px, step number 64px.

## Rules

- One accent hue (`#4361ee`). No gradients on text, no neon, no purple.
- Cards are white on the app's `#f8f9fa` margins, exactly like the app's own cards.
- The transition panel is solid `brand-accent` with the wordmark in white.
- Text over the app's margins is always dark on light; the only inverted
  surfaces are the title and end cards.
