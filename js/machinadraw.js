/**
 * MachinaDraw: Precision Horological & Kinematic Gearing Vector Synthesis Engine
 * Version: 1.0.0 (Swiss-Archival Chronometry Edition)
 * Seal Chop: 璇玑典藏 (Xuán Jī Diǎn Cáng · Celestial Horology & Kinematic Collection)
 * Scale: Metric Chronometer Pitch Module Gauge (0 1.0 2.0mm MODULE 0.8)
 * Author: Azzar Budiyanto
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MachinaDraw = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // --- 1. Deterministic PRNG & Hashing Utilities ---
  function fnv1a(str) {
    var FNV_PRIME = 0x01000193;
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
  }

  function Mulberry32(seed) {
    return function () {
      var t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  function encodeBase32(val, len) {
    var res = "";
    val = val >>> 0;
    for (var i = 0; i < len; i++) {
      res = ALPHABET[val % 32] + res;
      val = Math.floor(val / 32);
    }
    return res;
  }

  function decodeBase32(str) {
    var val = 0;
    for (var i = 0; i < str.length; i++) {
      var idx = ALPHABET.indexOf(str[i].toUpperCase());
      if (idx === -1) idx = 0;
      val = val * 32 + idx;
    }
    return val >>> 0;
  }

  function generateSequenceIdentifier(hashVal, typeKey) {
    var prefix = "MCV";
    var typeCode = typeKey === 'escapement' ? 'ESC' : (typeKey === 'tourbillon' ? 'TOR' : 'EPI');
    var high = (hashVal >>> 16) & 0xFFFF;
    var low = hashVal & 0xFFFF;
    var p1 = encodeBase32(high, 2);
    var p2 = encodeBase32(low, 4);
    return prefix + "-" + typeCode + "-" + p1 + p2;
  }

  function recoverHashFromId(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    var parts = identifier.trim().toUpperCase().split('-');
    if (parts.length === 3 && parts[0] === 'MCV') {
      var suffix = parts[2];
      if (suffix.length >= 6) {
        var high = decodeBase32(suffix.substring(0, 2));
        var low = decodeBase32(suffix.substring(2));
        return ((high << 16) | low) >>> 0;
      }
    }
    return null;
  }

  // --- 2. Color Palettes ---
  var PALETTES = {
    vellum: {
      name: "Archival Vellum",
      paper: "#EFE9DC",
      ink: "#1A1A1A",
      metal: "#4A453E",
      gold: "#B8934A",
      ruby: "#BA131A",
      accent: "#8B1A1A",
      grid: "#CDC4B4",
      meta: "#7A7068"
    },
    blueprint: {
      name: "Cyanotype Blueprint",
      paper: "#0B1E2E",
      ink: "#EFE9DC",
      metal: "#6E93B3",
      gold: "#38EF7D",
      ruby: "#E63946",
      accent: "#E63946",
      grid: "#1C3B54",
      meta: "#8EAAC1"
    },
    obsidian: {
      name: "Titanium Obsidian",
      paper: "#121316",
      ink: "#EAEAEA",
      metal: "#63666A",
      gold: "#D4AF37",
      ruby: "#BA131A",
      accent: "#D4AF37",
      grid: "#24262C",
      meta: "#8C8E94"
    },
    sepia: {
      name: "Horology Sepia",
      paper: "#F4ECE1",
      ink: "#382923",
      metal: "#7A665A",
      gold: "#B85D19",
      ruby: "#BA131A",
      accent: "#8B1A1A",
      grid: "#D6C7B7",
      meta: "#8C7A6B"
    },
    patina: {
      name: "Verdigris Patina",
      paper: "#E8ECE6",
      ink: "#243038",
      metal: "#516A75",
      gold: "#2A7B72",
      ruby: "#BA131A",
      accent: "#8B1A1A",
      grid: "#C4CFCA",
      meta: "#68808C"
    }
  };

  // --- 3. Geometric & Involute Gear Curve Utilities ---
  function rad(deg) { return (deg * Math.PI) / 180; }

  // Procedural Involute/Epicycloidal Gear Path Generator
  function createGearPath(cx, cy, teeth, module, options) {
    options = options || {};
    var rootFillet = options.fillet || 0.3;
    var pressureAngle = options.pressureAngle || 20;

    var rp = (teeth * module) / 2; // Pitch radius
    var ha = module;              // Addendum
    var hd = 1.25 * module;       // Dedendum
    var ra = rp + ha;             // Tip radius
    var rd = Math.max(1, rp - hd);// Root radius
    var rb = rp * Math.cos(rad(pressureAngle)); // Base radius

    var dTheta = (2 * Math.PI) / teeth;
    var halfTooth = dTheta * 0.26; // Half tooth thickness angle at pitch circle
    var rootGap = dTheta * 0.24;

    var points = [];

    for (var i = 0; i < teeth; i++) {
      var angle = i * dTheta;

      // 1. Root valley start
      var a0 = angle - rootGap;
      var a1 = angle - halfTooth;
      var a2 = angle - halfTooth * 0.45;
      var a3 = angle + halfTooth * 0.45;
      var a4 = angle + halfTooth;
      var a5 = angle + rootGap;

      // Root fillet left
      points.push((i === 0 ? 'M ' : 'L ') + (cx + rd * Math.cos(a0)).toFixed(2) + ' ' + (cy + rd * Math.sin(a0)).toFixed(2));
      // Involute flank rising
      points.push('Q ' + (cx + rb * Math.cos(a1)).toFixed(2) + ' ' + (cy + rb * Math.sin(a1)).toFixed(2) + ' ' +
                  (cx + rp * Math.cos(a1)).toFixed(2) + ' ' + (cy + rp * Math.sin(a1)).toFixed(2));
      // Tooth crest / tip arc
      points.push('L ' + (cx + ra * Math.cos(a2)).toFixed(2) + ' ' + (cy + ra * Math.sin(a2)).toFixed(2));
      points.push('A ' + ra.toFixed(2) + ' ' + ra.toFixed(2) + ' 0 0 1 ' +
                  (cx + ra * Math.cos(a3)).toFixed(2) + ' ' + (cy + ra * Math.sin(a3)).toFixed(2));
      // Involute flank descending
      points.push('L ' + (cx + rp * Math.cos(a4)).toFixed(2) + ' ' + (cy + rp * Math.sin(a4)).toFixed(2));
      points.push('Q ' + (cx + rb * Math.cos(a4)).toFixed(2) + ' ' + (cy + rb * Math.sin(a4)).toFixed(2) + ' ' +
                  (cx + rd * Math.cos(a5)).toFixed(2) + ' ' + (cy + rd * Math.sin(a5)).toFixed(2));
    }
    points.push('Z');
    return {
      d: points.join(' '),
      rp: rp,
      ra: ra,
      rd: rd
    };
  }

  // Escape Wheel Club Tooth Path Generator (15-tooth horological ratchet)
  function createEscapeWheelPath(cx, cy, teeth, radius) {
    teeth = teeth || 15;
    var dTheta = (2 * Math.PI) / teeth;
    var rTip = radius;
    var rImpulse = radius * 0.94;
    var rLock = radius * 0.88;
    var rRoot = radius * 0.72;

    var points = [];
    for (var i = 0; i < teeth; i++) {
      var a = i * dTheta;
      var p0 = a;
      var p1 = a + dTheta * 0.08;
      var p2 = a + dTheta * 0.14;
      var p3 = a + dTheta * 0.35;

      var x0 = (cx + rRoot * Math.cos(p0)).toFixed(2);
      var y0 = (cy + rRoot * Math.sin(p0)).toFixed(2);
      var x1 = (cx + rTip * Math.cos(p1)).toFixed(2);
      var y1 = (cy + rTip * Math.sin(p1)).toFixed(2);
      var x2 = (cx + rImpulse * Math.cos(p2)).toFixed(2);
      var y2 = (cy + rImpulse * Math.sin(p2)).toFixed(2);
      var x3 = (cx + rLock * Math.cos(p3)).toFixed(2);
      var y3 = (cy + rLock * Math.sin(p3)).toFixed(2);

      if (i === 0) points.push('M ' + x0 + ' ' + y0);
      else points.push('L ' + x0 + ' ' + y0);

      // Stalk rising to club tip
      points.push('L ' + x1 + ' ' + y1);
      // Impulse face
      points.push('L ' + x2 + ' ' + y2);
      // Locking face
      points.push('L ' + x3 + ' ' + y3);
    }
    points.push('Z');
    return points.join(' ');
  }

  // Archimedean Spiral (Breguet Hairspring)
  function createHairspringPath(cx, cy, innerR, outerR, turns) {
    var totalTheta = turns * 2 * Math.PI;
    var steps = Math.round(turns * 48);
    var dTheta = totalTheta / steps;
    var dr = (outerR - innerR) / steps;

    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var th = i * dTheta;
      var r = innerR + i * dr;
      var x = (cx + r * Math.cos(th)).toFixed(2);
      var y = (cy + r * Math.sin(th)).toFixed(2);
      pts.push((i === 0 ? 'M ' : 'L ') + x + ' ' + y);
    }
    // Terminal Breguet Overcoil (raised curved outer loop)
    var endTh = totalTheta;
    var p0x = (cx + (outerR + 4) * Math.cos(endTh + 0.3)).toFixed(2);
    var p0y = (cy + (outerR + 4) * Math.sin(endTh + 0.3)).toFixed(2);
    var p1x = (cx + (outerR + 7) * Math.cos(endTh + 0.75)).toFixed(2);
    var p1y = (cy + (outerR + 7) * Math.sin(endTh + 0.75)).toFixed(2);
    pts.push('Q ' + p0x + ' ' + p0y + ' ' + p1x + ' ' + p1y);
    return pts.join(' ');
  }

  // --- 4. High-Fidelity Horological Generators ---

  // Archetype A: Swiss Lever Escapement & Balance Assembly
  function renderSwissLeverEscapement(prng, cx, cy, scale, p) {
    var svg = [];

    // Geometry parameters
    var escRadius = 84 * scale;
    var leverLength = 105 * scale;
    var balRadius = 118 * scale;

    var escCx = cx - 110 * scale;
    var escCy = cy + 38 * scale;

    var leverPivotX = cx - 20 * scale;
    var leverPivotY = cy - 6 * scale;

    var balCx = cx + 105 * scale;
    var balCy = cy - 18 * scale;

    // 1. Line of Centers (Kinematic Reference Axes)
    svg.push('<line x1="' + (escCx - 30 * scale).toFixed(1) + '" y1="' + escCy.toFixed(1) + '" x2="' + (balCx + 40 * scale).toFixed(1) + '" y2="' + escCy.toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.75" />');
    svg.push('<line x1="' + escCx.toFixed(1) + '" y1="' + (escCy - escRadius - 20 * scale).toFixed(1) + '" x2="' + escCx.toFixed(1) + '" y2="' + (escCy + escRadius + 20 * scale).toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.75" />');
    svg.push('<line x1="' + balCx.toFixed(1) + '" y1="' + (balCy - balRadius - 20 * scale).toFixed(1) + '" x2="' + balCx.toFixed(1) + '" y2="' + (balCy + balRadius + 20 * scale).toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.75" />');

    // 2. Escape Wheel (15 Teeth)
    var escPath = createEscapeWheelPath(escCx, escCy, 15, escRadius);
    svg.push('<path d="' + escPath + '" fill="none" stroke="' + p.ink + '" stroke-width="1.2" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (escRadius * 0.94).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="2 3" stroke-width="0.6" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (escRadius * 0.6).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.8" />');

    // Lightening 4-Spoke Arms for Escape Wheel
    for (var s = 0; s < 4; s++) {
      var sa = s * Math.PI * 0.5 + Math.PI * 0.25;
      var sx1 = escCx + Math.cos(sa) * (escRadius * 0.18);
      var sy1 = escCy + Math.sin(sa) * (escRadius * 0.18);
      var sx2 = escCx + Math.cos(sa) * (escRadius * 0.6);
      var sy2 = escCy + Math.sin(sa) * (escRadius * 0.6);
      svg.push('<line x1="' + sx1.toFixed(1) + '" y1="' + sy1.toFixed(1) + '" x2="' + sx2.toFixed(1) + '" y2="' + sy2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.1" />');
    }

    // Escape Pinion and Center Chaton
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (12 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.5" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (6 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (2.5 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');

    // 3. Pallet Fork (Lever Body with Entry & Exit Synthetic Rubies)
    var leverAngle = rad(-14);
    var forkTipX = leverPivotX + Math.cos(leverAngle) * (62 * scale);
    var forkTipY = leverPivotY + Math.sin(leverAngle) * (62 * scale);

    var entryX = leverPivotX - Math.cos(leverAngle + 0.48) * (52 * scale);
    var entryY = leverPivotY - Math.sin(leverAngle + 0.48) * (52 * scale);
    var exitX = leverPivotX - Math.cos(leverAngle - 0.52) * (50 * scale);
    var exitY = leverPivotY - Math.sin(leverAngle - 0.52) * (50 * scale);

    // T-Shaped Pallet Fork Body
    svg.push('<path d="M ' + forkTipX.toFixed(1) + ' ' + forkTipY.toFixed(1) +
             ' L ' + (leverPivotX + 8 * scale).toFixed(1) + ' ' + (leverPivotY - 4 * scale).toFixed(1) +
             ' L ' + exitX.toFixed(1) + ' ' + exitY.toFixed(1) +
             ' L ' + (leverPivotX - 10 * scale).toFixed(1) + ' ' + (leverPivotY + 6 * scale).toFixed(1) +
             ' L ' + entryX.toFixed(1) + ' ' + entryY.toFixed(1) +
             ' L ' + (leverPivotX - 2 * scale).toFixed(1) + ' ' + (leverPivotY - 8 * scale).toFixed(1) +
             ' Z" fill="none" stroke="' + p.ink + '" stroke-width="1.4" stroke-linejoin="round" />');

    // Fork Notch and Horns at Balance Table
    svg.push('<path d="M ' + (forkTipX - 4 * scale).toFixed(1) + ' ' + (forkTipY - 6 * scale).toFixed(1) +
             ' L ' + (forkTipX + 8 * scale).toFixed(1) + ' ' + forkTipY.toFixed(1) +
             ' L ' + (forkTipX - 4 * scale).toFixed(1) + ' ' + (forkTipY + 6 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.1" />');

    // Ruby Pallet Stones (Jeweled Impulse Surfaces)
    svg.push('<rect x="' + (entryX - 6 * scale).toFixed(1) + '" y="' + (entryY - 4 * scale).toFixed(1) + '" width="' + (12 * scale).toFixed(1) + '" height="' + (8 * scale).toFixed(1) + '" rx="1" transform="rotate(-32 ' + entryX.toFixed(1) + ' ' + entryY.toFixed(1) + ')" fill="' + p.ruby + '" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('<rect x="' + (exitX - 6 * scale).toFixed(1) + '" y="' + (exitY - 4 * scale).toFixed(1) + '" width="' + (12 * scale).toFixed(1) + '" height="' + (8 * scale).toFixed(1) + '" rx="1" transform="rotate(38 ' + exitX.toFixed(1) + ' ' + exitY.toFixed(1) + ')" fill="' + p.ruby + '" stroke="' + p.ink + '" stroke-width="0.75" />');

    // Pallet Lever Pivot Chaton
    svg.push('<circle cx="' + leverPivotX.toFixed(1) + '" cy="' + leverPivotY.toFixed(1) + '" r="' + (9 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1" />');
    svg.push('<circle cx="' + leverPivotX.toFixed(1) + '" cy="' + leverPivotY.toFixed(1) + '" r="' + (4 * scale).toFixed(1) + '" fill="' + p.gold + '" />');
    svg.push('<circle cx="' + leverPivotX.toFixed(1) + '" cy="' + leverPivotY.toFixed(1) + '" r="' + (1.8 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');

    // Banking Pins (Limits)
    svg.push('<circle cx="' + (leverPivotX + 35 * scale).toFixed(1) + '" cy="' + (leverPivotY - 26 * scale).toFixed(1) + '" r="' + (3.5 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('<circle cx="' + (leverPivotX + 38 * scale).toFixed(1) + '" cy="' + (leverPivotY + 28 * scale).toFixed(1) + '" r="' + (3.5 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.75" />');

    // 4. Glucydur / Gyromax Balance Wheel
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + balRadius.toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.8" />');
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (balRadius - 7 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.8" />');

    // Balance Arms (2 Swept Arms with Cutouts)
    for (var b = 0; b < 2; b++) {
      var ba = b * Math.PI + rad(25);
      var bx1 = balCx + Math.cos(ba) * (20 * scale);
      var by1 = balCy + Math.sin(ba) * (20 * scale);
      var bx2 = balCx + Math.cos(ba) * (balRadius - 7 * scale);
      var by2 = balCy + Math.sin(ba) * (balRadius - 7 * scale);
      svg.push('<line x1="' + bx1.toFixed(1) + '" y1="' + by1.toFixed(1) + '" x2="' + bx2.toFixed(1) + '" y2="' + by2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="2" />');
    }

    // 16 Gold Peripheral Timing / Inertia Screws
    for (var sc = 0; sc < 16; sc++) {
      var scAngle = sc * (Math.PI * 2 / 16);
      var scx = balCx + Math.cos(scAngle) * (balRadius + 3.5 * scale);
      var scy = balCy + Math.sin(scAngle) * (balRadius + 3.5 * scale);
      svg.push('<circle cx="' + scx.toFixed(1) + '" cy="' + scy.toFixed(1) + '" r="' + (2.4 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.6" />');
    }

    // Roller Table & Ruby Impulse Pin
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (24 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.2" />');
    var pinAngle = rad(195);
    var pinX = balCx + Math.cos(pinAngle) * (18 * scale);
    var pinY = balCy + Math.sin(pinAngle) * (18 * scale);
    svg.push('<circle cx="' + pinX.toFixed(1) + '" cy="' + pinY.toFixed(1) + '" r="' + (2.8 * scale).toFixed(1) + '" fill="' + p.ruby + '" stroke="' + p.ink + '" stroke-width="0.5" />');

    // Coiled Hairspring (Breguet Overcoil Spiral)
    var springPath = createHairspringPath(balCx, balCy, 12 * scale, 68 * scale, 7.5);
    svg.push('<path d="' + springPath + '" fill="none" stroke="' + p.metal + '" stroke-width="0.85" opacity="0.9" />');

    // Center Jewel Chaton with Incabloc Shock Springs
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (12 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.2" />');
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (6 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.6" />');
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (2.8 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');
    // Incabloc Lyre Spring Wire
    svg.push('<path d="M ' + (balCx - 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             ' C ' + (balCx - 5 * scale).toFixed(1) + ' ' + (balCy - 9 * scale).toFixed(1) + ', ' + (balCx + 5 * scale).toFixed(1) + ' ' + (balCy - 9 * scale).toFixed(1) + ', ' + (balCx + 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             ' C ' + (balCx + 6 * scale).toFixed(1) + ' ' + (balCy + 8 * scale).toFixed(1) + ', ' + (balCx - 6 * scale).toFixed(1) + ' ' + (balCy + 8 * scale).toFixed(1) + ', ' + (balCx - 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             '" fill="none" stroke="' + p.gold + '" stroke-width="0.8" />');

    return svg.join('\n');
  }

  // Archetype B: Flying Tourbillon One-Minute Carriage
  function renderFlyingTourbillon(prng, cx, cy, scale, p) {
    var svg = [];

    var cageR = 145 * scale;
    var innerCageR = 120 * scale;

    // 1. Outer 60-Second Graduation Aperture Ring
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (cageR + 25 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.8" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (cageR + 15 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.6" stroke-dasharray="3 3" />');

    for (var sec = 0; sec < 60; sec++) {
      var secAng = (sec * Math.PI * 2) / 60 - Math.PI * 0.5;
      var isMajor = sec % 5 === 0;
      var tickLen = isMajor ? 9 * scale : 4 * scale;
      var tx1 = cx + Math.cos(secAng) * (cageR + 16 * scale);
      var ty1 = cy + Math.sin(secAng) * (cageR + 16 * scale);
      var tx2 = cx + Math.cos(secAng) * (cageR + 16 * scale + tickLen);
      var ty2 = cy + Math.sin(secAng) * (cageR + 16 * scale + tickLen);
      svg.push('<line x1="' + tx1.toFixed(1) + '" y1="' + ty1.toFixed(1) + '" x2="' + tx2.toFixed(1) + '" y2="' + ty2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="' + (isMajor ? 1.2 : 0.6) + '" />');

      if (isMajor && sec % 15 === 0) {
        var numX = cx + Math.cos(secAng) * (cageR + 34 * scale);
        var numY = cy + Math.sin(secAng) * (cageR + 34 * scale) + (3 * scale);
        svg.push('<text x="' + numX.toFixed(1) + '" y="' + numY.toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + (8 * scale).toFixed(1) + '" font-weight="600" text-anchor="middle" fill="' + p.ink + '">' + sec + '</text>');
      }
    }

    // 2. Fixed Fourth Wheel (Mounted underneath cage)
    var fourthGear = createGearPath(cx, cy, 64, 2.2 * scale);
    svg.push('<path d="' + fourthGear.d + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" opacity="0.6" stroke-dasharray="2 2" />');

    // 3. Rotating Tourbillon Cage: Filigreed 3-Arm Titanium Carriage
    for (var arm = 0; arm < 3; arm++) {
      var armAng = (arm * Math.PI * 2) / 3 - Math.PI * 0.5;
      var aCos = Math.cos(armAng);
      var aSin = Math.sin(armAng);
      var pCos = Math.cos(armAng + Math.PI * 0.5);
      var pSin = Math.sin(armAng + Math.PI * 0.5);

      // Swept Aerodynamic Arm Profile with Lightening Hole
      var armPath = 'M ' + (cx + pCos * 14 * scale).toFixed(1) + ' ' + (cy + pSin * 14 * scale).toFixed(1) +
                    ' C ' + (cx + aCos * 40 * scale + pCos * 16 * scale).toFixed(1) + ' ' + (cy + aSin * 40 * scale + pSin * 16 * scale).toFixed(1) + ', ' +
                    (cx + aCos * 90 * scale + pCos * 12 * scale).toFixed(1) + ' ' + (cy + aSin * 90 * scale + pSin * 12 * scale).toFixed(1) + ', ' +
                    (cx + aCos * innerCageR).toFixed(1) + ' ' + (cy + aSin * innerCageR).toFixed(1) +
                    ' C ' + (cx + aCos * 90 * scale - pCos * 12 * scale).toFixed(1) + ' ' + (cy + aSin * 90 * scale - pSin * 12 * scale).toFixed(1) + ', ' +
                    (cx + aCos * 40 * scale - pCos * 16 * scale).toFixed(1) + ' ' + (cy + aSin * 40 * scale - pSin * 16 * scale).toFixed(1) + ', ' +
                    (cx - pCos * 14 * scale).toFixed(1) + ' ' + (cy - pSin * 14 * scale).toFixed(1) + ' Z';
      svg.push('<path d="' + armPath + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.4" opacity="0.95" />');

      // Internal Elliptical Lightening Cutout
      var cutoutCx = cx + aCos * 65 * scale;
      var cutoutCy = cy + aSin * 65 * scale;
      svg.push('<circle cx="' + cutoutCx.toFixed(1) + '" cy="' + cutoutCy.toFixed(1) + '" r="' + (9 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="0.8" />');

      // Gold Poising Screw at Tip of Each Arm
      var screwX = cx + aCos * (innerCageR - 6 * scale);
      var screwY = cy + aSin * (innerCageR - 6 * scale);
      svg.push('<circle cx="' + screwX.toFixed(1) + '" cy="' + screwY.toFixed(1) + '" r="' + (2.5 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.5" />');
    }

    // 4. Co-Axial Balance Wheel Mounted Inside Tourbillon Cage
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (98 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.6" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (92 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" />');

    // 12 Gold Inertia Collets on Balance Rim
    for (var col = 0; col < 12; col++) {
      var cAng = col * (Math.PI * 2 / 12);
      var colX = cx + Math.cos(cAng) * (98 * scale);
      var colY = cy + Math.sin(cAng) * (98 * scale);
      svg.push('<circle cx="' + colX.toFixed(1) + '" cy="' + colY.toFixed(1) + '" r="' + (2.2 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.5" />');
    }

    // Breguet Overcoil Spiral
    var tourbillonSpring = createHairspringPath(cx, cy, 14 * scale, 58 * scale, 6.5);
    svg.push('<path d="' + tourbillonSpring + '" fill="none" stroke="' + p.metal + '" stroke-width="0.85" />');

    // 5. Off-Center Internal Escape Wheel (Planetary Pinion inside Tourbillon)
    var escOffX = cx + 46 * scale;
    var escOffY = cy + 24 * scale;
    var subEscape = createEscapeWheelPath(escOffX, escOffY, 15, 34 * scale);
    svg.push('<path d="' + subEscape + '" fill="none" stroke="' + p.ink + '" stroke-width="0.9" />');
    svg.push('<circle cx="' + escOffX.toFixed(1) + '" cy="' + escOffY.toFixed(1) + '" r="' + (5 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.5" />');
    svg.push('<circle cx="' + escOffX.toFixed(1) + '" cy="' + escOffY.toFixed(1) + '" r="' + (2 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');

    // 6. Central Cage Capstone & Mirror-Polished Gold Jewel Chaton
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (15 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.4" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (8 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.8" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (3.5 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');

    // Blued Steel Screws Securing Center Chaton
    for (var sc = 0; sc < 2; sc++) {
      var sca = sc * Math.PI + Math.PI * 0.25;
      var scX = cx + Math.cos(sca) * (11.5 * scale);
      var scY = cy + Math.sin(sca) * (11.5 * scale);
      svg.push('<circle cx="' + scX.toFixed(1) + '" cy="' + scY.toFixed(1) + '" r="' + (1.6 * scale).toFixed(1) + '" fill="' + p.metal + '" stroke="' + p.ink + '" stroke-width="0.4" />');
      svg.push('<line x1="' + (scX - 1.2 * scale).toFixed(1) + '" y1="' + scY.toFixed(1) + '" x2="' + (scX + 1.2 * scale).toFixed(1) + '" y2="' + scY.toFixed(1) + '" stroke="' + p.paper + '" stroke-width="0.4" />');
    }

    return svg.join('\n');
  }

  // Archetype C: Multi-Stage Epicyclic Planetary Gear Train
  function renderEpicyclicGearTrain(prng, cx, cy, scale, p) {
    var svg = [];

    var m = 2.4 * scale; // Module
    var zSun = 24;       // Sun gear teeth
    var zPlanet = 16;    // Planet gear teeth
    var zRing = zSun + 2 * zPlanet; // 56 teeth (Inward annulus)

    var sunRp = (zSun * m) / 2;
    var planetRp = (zPlanet * m) / 2;
    var ringRp = (zRing * m) / 2;
    var carrierOrbitR = sunRp + planetRp; // Center of planets

    // 1. Line of Centers & Pitch Circle Construction Lines
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + sunRp.toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="3 3" stroke-width="0.6" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + carrierOrbitR.toFixed(1) + '" fill="none" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.75" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + ringRp.toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="3 3" stroke-width="0.6" />');

    // 2. Outer Annulus Ring Body (Internal Gear Chassis)
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (ringRp + 28 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="2" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (ringRp + 18 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.8" />');

    // Inward Gear Teeth for Ring Gear
    var ringTeethCount = 48;
    for (var rt = 0; rt < ringTeethCount; rt++) {
      var rAngle = (rt * Math.PI * 2) / ringTeethCount;
      var rx1 = cx + Math.cos(rAngle) * ringRp;
      var ry1 = cy + Math.sin(rAngle) * ringRp;
      var rx2 = cx + Math.cos(rAngle) * (ringRp - 5 * scale);
      var ry2 = cy + Math.sin(rAngle) * (ringRp - 5 * scale);
      svg.push('<line x1="' + rx1.toFixed(1) + '" y1="' + ry1.toFixed(1) + '" x2="' + rx2.toFixed(1) + '" y2="' + ry2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.2" />');
    }

    // 3. Planet Carrier Spider Plate (Tri-Lobe Triangular Carrier)
    var numPlanets = 3;
    var carrierPath = [];
    for (var pl = 0; pl < numPlanets; pl++) {
      var pAngle = (pl * Math.PI * 2) / numPlanets - Math.PI * 0.5;
      var plx = cx + Math.cos(pAngle) * carrierOrbitR;
      var ply = cy + Math.sin(pAngle) * carrierOrbitR;
      var pLeft = pAngle - rad(25);
      var pRight = pAngle + rad(25);

      var lx = cx + Math.cos(pLeft) * (carrierOrbitR - 12 * scale);
      var ly = cy + Math.sin(pLeft) * (carrierOrbitR - 12 * scale);
      var rx = cx + Math.cos(pRight) * (carrierOrbitR - 12 * scale);
      var ry = cy + Math.sin(pRight) * (carrierOrbitR - 12 * scale);

      if (pl === 0) carrierPath.push('M ' + lx.toFixed(1) + ' ' + ly.toFixed(1));
      else carrierPath.push('L ' + lx.toFixed(1) + ' ' + ly.toFixed(1));
      carrierPath.push('Q ' + plx.toFixed(1) + ' ' + ply.toFixed(1) + ' ' + rx.toFixed(1) + ' ' + ry.toFixed(1));
    }
    carrierPath.push('Z');
    svg.push('<path d="' + carrierPath.join(' ') + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.2" opacity="0.9" />');

    // 4. 3 Planetary Gears
    for (var pIdx = 0; pIdx < numPlanets; pIdx++) {
      var pAng = (pIdx * Math.PI * 2) / numPlanets - Math.PI * 0.5;
      var px = cx + Math.cos(pAng) * carrierOrbitR;
      var py = cy + Math.sin(pAng) * carrierOrbitR;

      var planetGear = createGearPath(px, py, zPlanet, m);
      svg.push('<path d="' + planetGear.d + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.1" />');

      // Lightening Holes in Planet Gears
      svg.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (planetRp * 0.45).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.8" />');

      // Planetary Arbor & Ruby Bearing
      svg.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (6 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.6" />');
      svg.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (2.5 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');
    }

    // 5. Central Sun Gear
    var sunGear = createGearPath(cx, cy, zSun, m);
    svg.push('<path d="' + sunGear.d + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.3" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (sunRp * 0.55).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.9" />');

    // Sun Gear 5-Spoke Cutouts
    for (var sp = 0; sp < 5; sp++) {
      var spa = sp * (Math.PI * 2 / 5);
      var spx1 = cx + Math.cos(spa) * (sunRp * 0.2);
      var spy1 = cy + Math.sin(spa) * (sunRp * 0.2);
      var spx2 = cx + Math.cos(spa) * (sunRp * 0.55);
      var spy2 = cy + Math.sin(spa) * (sunRp * 0.55);
      svg.push('<line x1="' + spx1.toFixed(1) + '" y1="' + spy1.toFixed(1) + '" x2="' + spx2.toFixed(1) + '" y2="' + spy2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.1" />');
    }

    // Central Mainspring Arbor Chaton
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (11 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.4" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (5.5 * scale).toFixed(1) + '" fill="' + p.gold + '" stroke="' + p.ink + '" stroke-width="0.7" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (2.4 * scale).toFixed(1) + '" fill="' + p.ruby + '" />');

    return svg.join('\n');
  }

  // --- 5. Swiss-Archival Frame, Seal Chop & Scale Bar ---
  function renderArchivalFrame(width, height, margin, p) {
    var borderW = width - margin * 2;
    var borderH = height - margin * 2;
    var innerGap = 6;
    var innerW = borderW - innerGap * 2;
    var innerH = borderH - innerGap * 2;
    var cx = width / 2;
    var cy = height / 2;
    var minDim = Math.min(width, height);

    var elements = [];

    // Outer Thick Neatline & Inner Precision Line
    elements.push('<rect x="' + margin + '" y="' + margin + '" width="' + borderW + '" height="' + borderH + '" fill="none" stroke="' + p.ink + '" stroke-width="1.1" />');
    elements.push('<rect x="' + (margin + innerGap) + '" y="' + (margin + innerGap) + '" width="' + innerW + '" height="' + innerH + '" fill="none" stroke="' + p.grid + '" stroke-width="0.5" />');

    // Central Drafting Projection Guidelines
    elements.push('<g opacity="0.18">');
    elements.push('  <circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + ((minDim / 2) * 0.88).toFixed(1) + '" fill="none" stroke="' + p.meta + '" stroke-width="0.6" stroke-dasharray="2 3" />');
    elements.push('  <line x1="' + cx.toFixed(1) + '" y1="' + (margin + innerGap + 4) + '" x2="' + cx.toFixed(1) + '" y2="' + (height - margin - innerGap - 4) + '" stroke="' + p.meta + '" stroke-width="0.5" stroke-dasharray="3 4" />');
    elements.push('  <line x1="' + (margin + innerGap + 4) + '" y1="' + cy.toFixed(1) + '" x2="' + (width - margin - innerGap - 4) + '" y2="' + cy.toFixed(1) + '" stroke="' + p.meta + '" stroke-width="0.5" stroke-dasharray="3 4" />');
    elements.push('</g>');

    // Corner Alignment Crosses
    var crossLen = 5;
    var corners = [
      [margin + 4, margin + 4],
      [margin + borderW - 4, margin + 4],
      [margin + 4, margin + borderH - 4],
      [margin + borderW - 4, margin + borderH - 4]
    ];
    corners.forEach(function (pt) {
      elements.push('<line x1="' + (pt[0] - crossLen) + '" y1="' + pt[1] + '" x2="' + (pt[0] + crossLen) + '" y2="' + pt[1] + '" stroke="' + p.meta + '" stroke-width="0.5" opacity="0.7" />');
      elements.push('<line x1="' + pt[0] + '" y1="' + (pt[1] - crossLen) + '" x2="' + pt[0] + '" y2="' + (pt[1] + crossLen) + '" stroke="' + p.meta + '" stroke-width="0.5" opacity="0.7" />');
    });

    return elements.join('\n');
  }

  // Archival Vermilion Seal Chop: 璇 玑 典 藏 (Xuán Jī Diǎn Cáng)
  function renderSealChop(x, y, size) {
    var chopColor = "#B83227"; // Imperial cinnabar vermilion
    var sealInset = Math.max(1.5, size * 0.06);
    var sealFontSize = Math.round(size * 0.36);
    var sealBorderWidth = Math.max(1.2, size * 0.05).toFixed(2);
    var sealInnerWidth = Math.max(0.5, size * 0.02).toFixed(2);

    var svg = [];
    svg.push('<g class="archival-seal" transform="translate(' + x.toFixed(2) + ', ' + y.toFixed(2) + ')">');
    svg.push('  <rect width="' + size + '" height="' + size + '" fill="' + chopColor + '" fill-opacity="0.06" stroke="' + chopColor + '" stroke-width="' + sealBorderWidth + '" />');
    svg.push('  <rect x="' + sealInset.toFixed(2) + '" y="' + sealInset.toFixed(2) + '" width="' + (size - sealInset * 2).toFixed(2) + '" height="' + (size - sealInset * 2).toFixed(2) + '" fill="none" stroke="' + chopColor + '" stroke-width="' + sealInnerWidth + '" />');
    svg.push('  <line x1="' + (size / 2).toFixed(2) + '" y1="' + sealInset.toFixed(2) + '" x2="' + (size / 2).toFixed(2) + '" y2="' + (size - sealInset).toFixed(2) + '" stroke="' + chopColor + '" stroke-opacity="0.35" stroke-width="0.5" />');
    svg.push('  <line x1="' + sealInset.toFixed(2) + '" y1="' + (size / 2).toFixed(2) + '" x2="' + (size - sealInset).toFixed(2) + '" y2="' + (size / 2).toFixed(2) + '" stroke="' + chopColor + '" stroke-opacity="0.35" stroke-width="0.5" />');
    svg.push('  <text x="' + (size * 0.28).toFixed(2) + '" y="' + (size * 0.38).toFixed(2) + '" font-family="\'Noto Serif SC\', \'Source Han Serif\', \'Songti SC\', \'SimSun\', serif" font-weight="bold" font-size="' + sealFontSize + '" fill="' + chopColor + '" text-anchor="middle">璇</text>');
    svg.push('  <text x="' + (size * 0.72).toFixed(2) + '" y="' + (size * 0.38).toFixed(2) + '" font-family="\'Noto Serif SC\', \'Source Han Serif\', \'Songti SC\', \'SimSun\', serif" font-weight="bold" font-size="' + sealFontSize + '" fill="' + chopColor + '" text-anchor="middle">典</text>');
    svg.push('  <text x="' + (size * 0.28).toFixed(2) + '" y="' + (size * 0.80).toFixed(2) + '" font-family="\'Noto Serif SC\', \'Source Han Serif\', \'Songti SC\', \'SimSun\', serif" font-weight="bold" font-size="' + sealFontSize + '" fill="' + chopColor + '" text-anchor="middle">玑</text>');
    svg.push('  <text x="' + (size * 0.72).toFixed(2) + '" y="' + (size * 0.80).toFixed(2) + '" font-family="\'Noto Serif SC\', \'Source Han Serif\', \'Songti SC\', \'SimSun\', serif" font-weight="bold" font-size="' + sealFontSize + '" fill="' + chopColor + '" text-anchor="middle">藏</text>');
    svg.push('</g>');
    return svg.join('\n');
  }

  // Metric Chronometer Pitch Module Gauge
  function renderScaleBar(x, y, scaleFactor, p) {
    var barW = Math.round(64 * scaleFactor);
    var barH = Math.max(3, Math.round(3.5 * scaleFactor));
    var segW = barW / 4;
    var tickH = Math.max(2, Math.round(3 * scaleFactor));
    var scaleFontSize = Math.max(7, Math.round(7.5 * scaleFactor));
    var captionFontSize = Math.max(6, Math.round(6.5 * scaleFactor));

    var svg = [];
    svg.push('<g class="drafting-scale-bar" transform="translate(' + x.toFixed(2) + ', ' + y.toFixed(2) + ')">');
    svg.push('  <rect x="0" y="0" width="' + segW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="' + p.ink + '" />');
    svg.push('  <rect x="' + segW.toFixed(2) + '" y="0" width="' + segW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('  <rect x="' + (segW * 2).toFixed(2) + '" y="0" width="' + segW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="' + p.ink + '" />');
    svg.push('  <rect x="' + (segW * 3).toFixed(2) + '" y="0" width="' + segW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('  <rect x="0" y="0" width="' + barW.toFixed(2) + '" height="' + barH.toFixed(2) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.75" />');

    svg.push('  <line x1="0" y1="' + (-tickH) + '" x2="0" y2="0" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('  <line x1="' + (segW * 2).toFixed(2) + '" y1="' + (-tickH) + '" x2="' + (segW * 2).toFixed(2) + '" y2="0" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('  <line x1="' + barW.toFixed(2) + '" y1="' + (-tickH) + '" x2="' + barW.toFixed(2) + '" y2="0" stroke="' + p.ink + '" stroke-width="0.75" />');

    svg.push('  <text x="0" y="' + (-tickH - 2) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + p.ink + '" text-anchor="middle">0</text>');
    svg.push('  <text x="' + (segW * 2).toFixed(2) + '" y="' + (-tickH - 2) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + p.ink + '" text-anchor="middle">1.0</text>');
    svg.push('  <text x="' + barW.toFixed(2) + '" y="' + (-tickH - 2) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + p.ink + '" text-anchor="middle">2.0mm</text>');
    svg.push('  <text x="0" y="' + (barH + captionFontSize + 2) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + captionFontSize + '" font-weight="500" fill="' + p.meta + '">CHRONOMETRIC SCALE 1:1</text>');
    svg.push('</g>');
    return svg.join('\n');
  }

  // --- 6. Main Synthesis Engine (Data Model Generation) ---
  function synthesize(seed, options) {
    options = options || {};
    var hashVal;
    if (typeof seed === 'number') {
      hashVal = seed >>> 0;
    } else {
      var seedStr = String(seed || "GlassGallery-Machina");
      var recovered = recoverHashFromId(seedStr);
      hashVal = recovered !== null ? recovered : fnv1a(seedStr);
    }

    var prng = Mulberry32(hashVal);

    // Pick Mechanism Archetype (Escapement, Tourbillon, Epicyclic)
    var archetypes = ['escapement', 'tourbillon', 'epicyclic'];
    var typeIdx = Math.floor(prng() * archetypes.length);
    var typeKey = archetypes[typeIdx];

    var seqId = generateSequenceIdentifier(hashVal, typeKey);

    var mechanismTitle;
    var beatRate;
    var jewelsCount;
    var reductionRatio;
    var escapementAngle;
    var balanceInertia;
    var trainEfficiency;

    if (typeKey === 'escapement') {
      mechanismTitle = "Échappement à Ancre Suisse & Spiral Breguet";
      beatRate = "28,800 A/h (4.0 Hz)";
      jewelsCount = "21 Rubis Synthétiques";
      reductionRatio = "Échappement 15 Dents";
      escapementAngle = "52.5° Lift Angle";
      balanceInertia = "12.5 mg·cm²";
      trainEfficiency = "94.2% Involute";
    } else if (typeKey === 'tourbillon') {
      mechanismTitle = "Tourbillon Volant à Cage Tri-Axe 60s";
      beatRate = "21,600 A/h (3.0 Hz)";
      jewelsCount = "25 Rubis Synthétiques";
      reductionRatio = "1 Tour / Minute (0.0167 Hz)";
      escapementAngle = "Tri-Axial 360° Spherical";
      balanceInertia = "9.8 mg·cm²";
      trainEfficiency = "96.5% Cage Inertia";
    } else {
      mechanismTitle = "Train d'Engrenages Épicycloïdal Planétaire";
      beatRate = "Constante Chronométrique";
      jewelsCount = "19 Rubis Synthétiques";
      reductionRatio = "i = 3.333 : 1";
      escapementAngle = "20.0° Pressure Angle";
      balanceInertia = "18.2 mg·cm²";
      trainEfficiency = "98.1% Epicyclic";
    }

    // Calibre Serial & Taxonomy
    var calibreNum = (100 + (hashVal % 899)).toString();
    var calibreSuffix = String.fromCharCode(65 + ((hashVal >>> 8) % 6));
    var calibreStr = "CALIBRE GG-" + calibreNum + calibreSuffix;

    var metrics = {
      calibre: calibreStr,
      mechanism: mechanismTitle,
      frequency: beatRate,
      jewels: jewelsCount,
      ratio: reductionRatio,
      module: "m = 0.8 mm (Scale 1:1)",
      escapementAngle: escapementAngle,
      balanceInertia: balanceInertia,
      trainEfficiency: trainEfficiency,
      hashHex: "0x" + hashVal.toString(16).toUpperCase(),
      narrative: String(seed || "GlassGallery-Machina")
    };

    return {
      hashVal: hashVal,
      accessionId: seqId,
      hexHash: "0x" + hashVal.toString(16).toUpperCase(),
      calibre: calibreStr,
      mechanism: mechanismTitle,
      archetype: typeKey,
      beatRate: beatRate,
      jewelsCount: jewelsCount,
      reductionRatio: reductionRatio,
      metrics: metrics
    };
  }

  // --- 7. Standalone SVG Plate Generator (Swiss-Archival Format) ---
  function generateSvgPlate(targetSpecimen, options) {
    options = options || {};
    var specimen = targetSpecimen;
    if (!specimen || !specimen.archetype) {
      specimen = synthesize(options.seed || options.narrative || "GlassGallery-Machina", options);
    }

    var width = options.width || 600;
    var height = options.height || 400; // 3:2 default ratio
    var minDim = Math.min(width, height);
    var margin = options.margin || Math.round(minDim * 0.024);
    var borderGap = Math.max(3, Math.round(minDim * 0.007));
    var outerLineWidth = Math.max(1.0, (minDim / 600) * 1.0);
    var innerLineWidth = Math.max(0.5, (minDim / 600) * 0.5);

    var paletteKey = (options.palette || 'vellum').toLowerCase();
    var p = PALETTES[paletteKey] || PALETTES.vellum;
    var strokeColor = options.stroke || p.ink;
    var metaColor = options.metaColor || p.meta;

    var cx = width / 2;
    var cy = height / 2;

    var maxSpanW = width - (margin + borderGap) * 2 - 40;
    var maxSpanH = height - (margin + borderGap) * 2 - 76;
    var scale;
    if (specimen.archetype === 'tourbillon') {
      scale = Math.min(maxSpanW / 380, maxSpanH / 370);
    } else if (specimen.archetype === 'escapement') {
      scale = Math.min(maxSpanW / 440, maxSpanH / 270);
    } else {
      scale = Math.min(maxSpanW / 360, maxSpanH / 250);
    }
    scale = Math.min(scale, 1.15);
    var mechCy = cy - 2;

    var prng = Mulberry32(specimen.hashVal);
    var mechanismSvg;
    if (specimen.archetype === 'escapement') {
      mechanismSvg = renderSwissLeverEscapement(prng, cx, mechCy, scale, p);
    } else if (specimen.archetype === 'tourbillon') {
      mechanismSvg = renderFlyingTourbillon(prng, cx, mechCy, scale, p);
    } else {
      mechanismSvg = renderEpicyclicGearTrain(prng, cx, mechCy, scale, p);
    }

    // Archival Frame Neatlines (Dual Swiss-Archival Borders)
    var borderW = width - margin * 2;
    var borderH = height - margin * 2;
    var innerW = borderW - borderGap * 2;
    var innerH = borderH - borderGap * 2;

    var frameSvg = [
      '<rect x="' + margin + '" y="' + margin + '" width="' + borderW + '" height="' + borderH + '" fill="none" stroke="' + strokeColor + '" stroke-width="' + outerLineWidth.toFixed(2) + '" />',
      '<rect x="' + (margin + borderGap) + '" y="' + (margin + borderGap) + '" width="' + innerW + '" height="' + innerH + '" fill="none" stroke="' + metaColor + '" stroke-width="' + innerLineWidth.toFixed(2) + '" />'
    ].join('\n');

    // Archival Vermilion Seal Chop: 璇 玑 典 藏 (Bottom-Right)
    var sealSize = Math.max(26, Math.round(minDim * 0.062));
    var sealX = width - margin - borderGap - sealSize - Math.round(minDim * 0.02);
    var sealY = height - margin - borderGap - sealSize - Math.max(4, Math.round(minDim * 0.012));
    var sealSvg = renderSealChop(sealX, sealY, sealSize);

    // Metric Scale Bar (Bottom-Left)
    var scaleFactor = minDim / 600;
    var barH = Math.max(3, Math.round(3.5 * scaleFactor));
    var scaleBarCaptionFontSize = Math.max(6, Math.round(6.5 * scaleFactor));
    var scaleBarX = margin + borderGap + Math.round(minDim * 0.02);
    var scaleBarY = height - margin - borderGap - barH - scaleBarCaptionFontSize - Math.max(4, Math.round(minDim * 0.012));
    var scaleBarSvg = renderScaleBar(scaleBarX, scaleBarY, scaleFactor, p);

    // Top Designation & Bottom Latin Taxon
    var captionFontSize = Math.max(7, Math.round(8 * scaleFactor));
    var topSerialY = margin + borderGap + Math.round(minDim * 0.035);
    var serialText = '<text x="' + cx.toFixed(1) + '" y="' + topSerialY.toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + (captionFontSize * 1.05).toFixed(1) + '" font-weight="600" text-anchor="middle" fill="' + metaColor + '" letter-spacing="2">[ ' + specimen.calibre + ' • ' + specimen.accessionId + ' ]</text>';

    var bottomTitleY = sealY + sealSize * 0.65;
    var latinTaxon = '<text x="' + cx.toFixed(1) + '" y="' + bottomTitleY.toFixed(1) + '" font-family="\'Noto Serif SC\', \'Noto Serif\', serif" font-style="italic" font-weight="700" font-size="' + (captionFontSize * 1.35).toFixed(1) + '" text-anchor="middle" fill="' + strokeColor + '">' + specimen.mechanism + '.</text>';

    var lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" style="background-color:' + p.paper + '">',
      '  <!-- Archival Drafting Paper Surface -->',
      '  <rect width="100%" height="100%" fill="' + p.paper + '" />',
      '',
      '  <!-- Drafting Frame & Neatlines -->',
      '  ' + frameSvg,
      '',
      '  <!-- Calibre Top Nomenclature -->',
      '  ' + serialText,
      '',
      '  <!-- Horological Vector Mechanism -->',
      '  <g class="horological-mechanism">',
      '    ' + mechanismSvg,
      '  </g>',
      '',
      '  <!-- Calibre Bottom Title -->',
      '  ' + latinTaxon,
      '',
      '  <!-- Imperial Vermilion Seal Chop -->',
      '  ' + sealSvg,
      '',
      '  <!-- Metric Module Scale Bar -->',
      '  ' + scaleBarSvg,
      '</svg>'
    ];

    return lines.join('\n');
  }

  // --- 8. Canvas Direct Renderer (300 DPI Export Support) ---
  function renderToCanvas(data, canvas, options) {
    options = options || {};
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");
    var svgString = generateSvgPlate(data, {
      width: width,
      height: height,
      palette: options.palette || "vellum"
    });

    var blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var img = new Image();

    return new Promise(function (resolve, reject) {
      img.onload = function () {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = function (err) {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  return {
    PALETTES: PALETTES,
    synthesize: synthesize,
    generateSpecimen: function(options) {
      options = options || {};
      var seed = options.narrative || options.seed || options.id || "GlassGallery-Machina";
      return synthesize(seed, options);
    },
    generateSvgPlate: generateSvgPlate,
    renderToCanvas: renderToCanvas,
    fnv1a: fnv1a,
    recoverHashFromId: recoverHashFromId,
    generateSequenceIdentifier: generateSequenceIdentifier
  };
});
