# Machina Vault (璇玑典藏)

> Archival Procedural Horology, Escapement Kinematics & Planetary Gearing Vector Engine.  
> Part of the GlassGallery Swiss-Archival Procedural Generative Suite.

## Features

- **Procedural Horology Archetypes**:
  - **Swiss Lever Escapement**: 15-tooth club escape wheel, ruby pallet stones, roller table, Breguet overcoil hairspring, and Gyromax balance wheel.
  - **Flying Tourbillon**: One-minute rotating carriage, 3-arm filigreed cage, co-axial balance, and 60-second graduation ring.
  - **Epicyclic Planetary Train**: Sun gear, planet gears, planet carrier spider plate, and internal ring gear (annulus).
- **Drafting Precision**:
  - Involute gear tooth profiles with calculated pitch radii and tooth thickness.
  - Millimeter coordinate neatlines, sub-millimeter tick marks, and corner alignment crosses.
  - Vermilion imperial seal chop: `璇玑典藏` (*Xuán Jī Diǎn Cáng*).
  - Metric chronometer pitch module scale bar (0 1.0 2.0mm MODULE 0.8 / 10:1 Scale).
- **Color Palettes**:
  - `vellum`: Archival Ivory Parchment & Charcoal Ink
  - `blueprint`: Cyanotype Prussian Blue & Drafting Cream
  - `obsidian`: Titanium Anthracite & Horological Gold
  - `sepia`: 18th-Century Horology Vellum & Bistre Brown
  - `patina`: Aged Verdigris Copper & Slate Steel
- **Embed Formfactor**:
  - Native 3:2 embed mode (`w=3&h=2`) via query param `?mode=embed`.
  - Resilient failover integration to `geometry-vault`.
  - PostMessage synchronization for parent themes.

## Usage

### Embed in HTML / Markdown
```html
<iframe src="https://machina-vault.glassgallery.my.id/?mode=embed&w=3&h=2&seed=Chronometer-Detent&palette=vellum"
        width="600" height="400" frameborder="0"
        style="border:none; aspect-ratio: 3/2; width:100%;"
        loading="lazy"></iframe>
```

### Programmatic API
```javascript
const MachinaDraw = require('./js/machinadraw.js');

const specimen = MachinaDraw.synthesize("Horology-Seed-001", {
  width: 600,
  height: 400,
  palette: "vellum"
});

console.log(specimen.id);        // "MCV-ESC-XXXXXX"
console.log(specimen.archetype); // "escapement" | "tourbillon" | "epicyclic"
console.log(specimen.svg);       // SVG XML string
```

## Deployment

```bash
docker compose up -d --build
```
Port: `8092`
URL: `https://machina-vault.glassgallery.my.id`
