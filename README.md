# Machina Vault (璇玑典藏)

> Archival Procedural Horology, Escapement Kinematics & Planetary Gearing Vector Engine.  
> Part of the GlassGallery Swiss-Archival Procedural Generative Suite.

## Features

- **Haute Horlogerie Kinematic Archetypes**:
  - **Swiss Lever Escapement & Breguet Overcoil**: 15-tooth club escape wheel, synthetic ruby pallet stones with shellac clamps, T-shaped fork, eccentric banking pins, 16 gold timing screws, 4 Gyromax slotted collets, Breguet overcoil hairspring with mobile stud, swan-neck micrometer regulator, and Incabloc shock setting.
  - **Flying Tourbillon Carriage**: 60-second chapter ring with 300 1/5th second micro-ticks, fixed 64-tooth fourth wheel, 3-arm aerodynamic titanium cage with circular perlage graining and mirror anglage, off-center planetary escape wheel, co-axial Glucydur balance, and central ruby chaton with blued screws.
  - **Multi-Stage Epicyclic Planetary Train**: Involute gear tooth geometry (20° pressure angle line of action), 56-tooth outer annulus chassis with blued screws, 24-tooth central sun gear, tri-lobe spider carrier plate with perlage, and 3 16-tooth planetary gears with ruby pivots.
  - **Astronomical Equation of Time & Moonphase Complication**: Asymmetrical kidney cam (*camme en rein*) modeling real solar variance ($\pm 16\text{ min}$ over 365.2422 days), 12 zodiac month sectors, ruby-roller feeler lever with differential transmission, and 59-tooth synodic lunar star wheel with twin crater-stippled gold moons and steel jumper spring.
- **Drafting Precision & Archival Layout**:
  - Radiant SVG gradient defs for synthetic corundum rubies, 18K yellow gold, heat-blued steel, and circular perlage graining.
  - Lossless 6-character accession ID encoding and deterministic recovery: `MCV-ESC-XXXXXX`, `MCV-TOR-XXXXXX`, `MCV-EPI-XXXXXX`, `MCV-AST-XXXXXX`.
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
