/**
 * MachinaDraw: Haute Horlogerie & Kinematic Chronometry Vector Synthesis Engine
 * Version: 2.0.0 (Masterwork Swiss-Archival Chronometry Edition)
 * Seal Chop: 璇玑典藏 (Xuán Jī Diǎn Cáng · Celestial Horology & Kinematic Archive)
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
  var CONFIG_DICT = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var MAX_HASH = 1544804416; // 34^6 for lossless 6-character recovery

  function fnv1a(str) {
    var FNV_PRIME = 0x01000193;
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }
    return Math.abs(hash) % MAX_HASH;
  }

  function Mulberry32(seed) {
    return function () {
      var t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateSequenceIdentifier(hashVal, typeKey) {
    var prefix = "MCV";
    var typeCode = typeKey === 'escapement' ? 'ESC' : (typeKey === 'tourbillon' ? 'TOR' : (typeKey === 'astronomical' ? 'AST' : 'EPI'));
    var suffix = "";
    var mutableHash = Math.abs(hashVal) % MAX_HASH;
    for (var i = 0; i < 6; i++) {
      suffix += CONFIG_DICT.charAt(mutableHash % CONFIG_DICT.length);
      mutableHash = Math.floor(mutableHash / CONFIG_DICT.length);
    }
    return prefix + "-" + typeCode + "-" + suffix;
  }

  function recoverHashFromId(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    var clean = identifier.trim().toUpperCase();
    var parts = clean.split('-');
    if (parts.length < 2) return null;
    var suffix = parts[parts.length - 1];
    if (suffix.length !== 6) return null;
    
    var recoveredHash = 0;
    var multiplier = 1;
    for (var i = 0; i < 6; i++) {
      var char = suffix.charAt(i);
      var val = CONFIG_DICT.indexOf(char);
      if (val === -1) return null;
      recoveredHash += val * multiplier;
      multiplier *= CONFIG_DICT.length;
    }
    return recoveredHash;
  }

  // --- 2. Color Palettes (Haute Horlogerie Specifications) ---
  var PALETTES = {
    vellum: {
      name: "Archival Vellum",
      paper: "#EFE9DC",
      ink: "#1A1A1A",
      metal: "#4A453E",
      gold: "#C9A04C",
      ruby: "#BA131A",
      blued: "#244473",
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
      blued: "#4EA8DE",
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
      blued: "#3A608F",
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
      blued: "#324E6B",
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
      blued: "#2C4A63",
      accent: "#8B1A1A",
      grid: "#C4CFCA",
      meta: "#68808C"
    }
  };

  // --- 3. Mathematical Geometry & Curve Generators ---
  function rad(deg) { return (deg * Math.PI) / 180; }

  // Procedural Involute/Epicycloidal Gear Path Generator with Addendum/Dedendum
  function createGearPath(cx, cy, teeth, module, options) {
    options = options || {};
    var pressureAngle = options.pressureAngle || 20;

    var rp = (teeth * module) / 2; // Pitch radius
    var ha = module;              // Addendum
    var hd = 1.25 * module;       // Dedendum
    var ra = rp + ha;             // Tip radius
    var rd = Math.max(1, rp - hd);// Root radius
    var rb = rp * Math.cos(rad(pressureAngle)); // Base radius

    var dTheta = (2 * Math.PI) / teeth;
    var halfTooth = dTheta * 0.26;
    var rootGap = dTheta * 0.24;

    var points = [];

    for (var i = 0; i < teeth; i++) {
      var angle = i * dTheta;
      var a0 = angle - rootGap;
      var a1 = angle - halfTooth;
      var a2 = angle - halfTooth * 0.45;
      var a3 = angle + halfTooth * 0.45;
      var a4 = angle + halfTooth;
      var a5 = angle + rootGap;

      points.push((i === 0 ? 'M ' : 'L ') + (cx + rd * Math.cos(a0)).toFixed(2) + ' ' + (cy + rd * Math.sin(a0)).toFixed(2));
      points.push('Q ' + (cx + rb * Math.cos(a1)).toFixed(2) + ' ' + (cy + rb * Math.sin(a1)).toFixed(2) + ' ' +
                  (cx + rp * Math.cos(a1)).toFixed(2) + ' ' + (cy + rp * Math.sin(a1)).toFixed(2));
      points.push('L ' + (cx + ra * Math.cos(a2)).toFixed(2) + ' ' + (cy + ra * Math.sin(a2)).toFixed(2));
      points.push('A ' + ra.toFixed(2) + ' ' + ra.toFixed(2) + ' 0 0 1 ' +
                  (cx + ra * Math.cos(a3)).toFixed(2) + ' ' + (cy + ra * Math.sin(a3)).toFixed(2));
      points.push('L ' + (cx + rp * Math.cos(a4)).toFixed(2) + ' ' + (cy + rp * Math.sin(a4)).toFixed(2));
      points.push('Q ' + (cx + rb * Math.cos(a4)).toFixed(2) + ' ' + (cy + rb * Math.sin(a4)).toFixed(2) + ' ' +
                  (cx + rd * Math.cos(a5)).toFixed(2) + ' ' + (cy + rd * Math.sin(a5)).toFixed(2));
    }
    points.push('Z');
    return {
      d: points.join(' '),
      rp: rp,
      ra: ra,
      rd: rd,
      rb: rb
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

      points.push('L ' + x1 + ' ' + y1);
      points.push('L ' + x2 + ' ' + y2);
      points.push('L ' + x3 + ' ' + y3);
    }
    points.push('Z');
    return points.join(' ');
  }

  // Archimedean Spiral with Terminal Breguet Overcoil (Curved Raised Terminal Loop)
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
    // Terminal Breguet Overcoil: Raised s-curve loop terminating at the stud
    var endTh = totalTheta;
    var p0x = (cx + (outerR + 5) * Math.cos(endTh + 0.3)).toFixed(2);
    var p0y = (cy + (outerR + 5) * Math.sin(endTh + 0.3)).toFixed(2);
    var p1x = (cx + (outerR + 9) * Math.cos(endTh + 0.78)).toFixed(2);
    var p1y = (cy + (outerR + 9) * Math.sin(endTh + 0.78)).toFixed(2);
    pts.push('Q ' + p0x + ' ' + p0y + ' ' + p1x + ' ' + p1y);
    return pts.join(' ');
  }

  // Astronomical Equation of Time Kidney Cam (Camme en Rein)
  function createKidneyCamPath(cx, cy, baseR, scaleFactor) {
    var pts = [];
    var steps = 120;
    for (var i = 0; i < steps; i++) {
      var theta = (i * 2 * Math.PI) / steps;
      // Equation of Time astronomical variance approximation formula (in minutes)
      var eqMins = 9.87 * Math.sin(2 * theta) - 7.53 * Math.cos(theta) - 1.5 * Math.sin(theta);
      var r = baseR + eqMins * (1.8 * scaleFactor);
      var x = (cx + r * Math.cos(theta)).toFixed(2);
      var y = (cy + r * Math.sin(theta)).toFixed(2);
      pts.push((i === 0 ? 'M ' : 'L ') + x + ' ' + y);
    }
    pts.push('Z');
    return pts.join(' ');
  }

  // 59-Tooth Moonphase Star Wheel (Roue Étoile de Lune pour Cycle Synodique)
  function createMoonStarWheelPath(cx, cy, radius, teeth) {
    teeth = teeth || 59;
    var dTheta = (2 * Math.PI) / teeth;
    var rRoot = radius * 0.88;
    var pts = [];
    for (var i = 0; i < teeth; i++) {
      var a = i * dTheta;
      var aTip = a + dTheta * 0.35;
      var aDrop = a + dTheta * 0.85;

      var x0 = (cx + rRoot * Math.cos(a)).toFixed(2);
      var y0 = (cy + rRoot * Math.sin(a)).toFixed(2);
      var x1 = (cx + radius * Math.cos(aTip)).toFixed(2);
      var y1 = (cy + radius * Math.sin(aTip)).toFixed(2);
      var x2 = (cx + rRoot * Math.cos(aDrop)).toFixed(2);
      var y2 = (cy + rRoot * Math.sin(aDrop)).toFixed(2);

      if (i === 0) pts.push('M ' + x0 + ' ' + y0);
      else pts.push('L ' + x0 + ' ' + y0);
      pts.push('L ' + x1 + ' ' + y1);
      pts.push('L ' + x2 + ' ' + y2);
    }
    pts.push('Z');
    return pts.join(' ');
  }

  // --- 4. Haute Horlogerie Component Renderers ---

  // Refracted Synthetic Ruby Jewel Bearing with Mirror-Beveled Chaton
  function renderRubyJewel(cx, cy, r, scale, p) {
    var svg = [];
    var chatonR = r * 1.55;
    var wellR = r * 0.42;

    // Brass/18K Gold Chaton Setting
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + chatonR.toFixed(2) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.5" />');
    // Mirror-Polished Anglage Ring
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + (r * 1.15).toFixed(2) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.3" />');
    // Synthetic Corundum Ruby Capstone
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + r.toFixed(2) + '" fill="url(#rubyGrad)" stroke="' + p.ink + '" stroke-width="0.45" />');
    // Pivot Well & Oil Meniscus
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + wellR.toFixed(2) + '" fill="' + p.ink + '" opacity="0.8" />');
    // Specular Light Glint
    svg.push('<circle cx="' + (cx - r * 0.35).toFixed(2) + '" cy="' + (cy - r * 0.35).toFixed(2) + '" r="' + (r * 0.22).toFixed(2) + '" fill="#FFFFFF" opacity="0.75" />');
    return svg.join('\n');
  }

  // Flame-Blued Steel Screw with Mirror-Polished Chamfer
  function renderBluedScrew(cx, cy, r, angleDeg, scale, p) {
    var radAng = rad(angleDeg);
    var cosA = Math.cos(radAng);
    var sinA = Math.sin(radAng);
    var svg = [];

    // Screw Head
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + r.toFixed(2) + '" fill="url(#bluedGrad)" stroke="' + p.ink + '" stroke-width="0.45" />');
    // Polished Countersink Reflection
    svg.push('<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + (r * 0.85).toFixed(2) + '" fill="none" stroke="#FFFFFF" stroke-width="0.25" opacity="0.45" />');
    // Screw Slot
    var len = r * 0.72;
    var x1 = cx - cosA * len;
    var y1 = cy - sinA * len;
    var x2 = cx + cosA * len;
    var y2 = cy + sinA * len;
    svg.push('<line x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '" stroke="' + p.paper + '" stroke-width="' + Math.max(0.45, r * 0.32).toFixed(2) + '" stroke-linecap="butt" />');
    return svg.join('\n');
  }

  // Technical Engineering Leader Callout with 45-degree Dogleg
  function renderLeaderCallout(targetX, targetY, elbowX, textX, textY, label, subtext, scale, p, align) {
    var svg = [];
    align = align || 'left';
    var anchor = align === 'right' ? 'end' : 'start';
    var fontSize = Math.max(5.8, 6.4 * scale);
    var subSize = Math.max(4.8, 5.2 * scale);

    // Leader Line
    svg.push('<polyline points="' + targetX.toFixed(1) + ',' + targetY.toFixed(1) + ' ' + elbowX.toFixed(1) + ',' + textY.toFixed(1) + ' ' + textX.toFixed(1) + ',' + textY.toFixed(1) + '" fill="none" stroke="' + p.meta + '" stroke-width="0.5" stroke-dasharray="2 1.5" />');
    // Target Pin Point
    svg.push('<circle cx="' + targetX.toFixed(1) + '" cy="' + targetY.toFixed(1) + '" r="1.3" fill="' + p.accent + '" />');
    // Primary Monospace Label
    svg.push('<text x="' + textX.toFixed(1) + '" y="' + (textY - 2.0).toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + fontSize.toFixed(1) + '" font-weight="600" text-anchor="' + anchor + '" fill="' + p.ink + '" letter-spacing="0.3">' + label + '</text>');
    if (subtext) {
      svg.push('<text x="' + textX.toFixed(1) + '" y="' + (textY + subSize + 1.0).toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + subSize.toFixed(1) + '" font-weight="400" text-anchor="' + anchor + '" fill="' + p.meta + '" letter-spacing="0.2">' + subtext + '</text>');
    }
    return svg.join('\n');
  }

  // --- 5. Haute Horlogerie Mechanism Generators ---

  // Archetype 1: Swiss Lever Escapement & Free-Sprung Glucydur Balance
  function renderSwissLeverEscapement(prng, cx, cy, scale, p) {
    var svg = [];

    var escRadius = 80 * scale;
    var balRadius = 110 * scale;

    var escCx = cx - 115 * scale;
    var escCy = cy + 28 * scale;

    var leverPivotX = cx - 22 * scale;
    var leverPivotY = cy - 8 * scale;

    var balCx = cx + 98 * scale;
    var balCy = cy - 14 * scale;

    // 1. Line of Centers & Kinematic Reference Lines
    svg.push('<line x1="' + (escCx - 35 * scale).toFixed(1) + '" y1="' + escCy.toFixed(1) + '" x2="' + (balCx + 45 * scale).toFixed(1) + '" y2="' + escCy.toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.65" />');
    svg.push('<line x1="' + escCx.toFixed(1) + '" y1="' + (escCy - escRadius - 25 * scale).toFixed(1) + '" x2="' + escCx.toFixed(1) + '" y2="' + (escCy + escRadius + 25 * scale).toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.65" />');
    svg.push('<line x1="' + balCx.toFixed(1) + '" y1="' + (balCy - balRadius - 25 * scale).toFixed(1) + '" x2="' + balCx.toFixed(1) + '" y2="' + (balCy + balRadius + 25 * scale).toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.65" />');

    // Action Angle Arc (52.5° Lift Angle)
    var arcR = 38 * scale;
    svg.push('<path d="M ' + (escCx + arcR).toFixed(1) + ' ' + escCy.toFixed(1) + ' A ' + arcR.toFixed(1) + ' ' + arcR.toFixed(1) + ' 0 0 1 ' + (escCx + arcR * Math.cos(rad(52.5))).toFixed(1) + ' ' + (escCy - arcR * Math.sin(rad(52.5))).toFixed(1) + '" fill="none" stroke="' + p.accent + '" stroke-width="0.8" stroke-dasharray="2 2" />');
    svg.push('<text x="' + (escCx + arcR + 6 * scale).toFixed(1) + '" y="' + (escCy - 12 * scale).toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + (7 * scale).toFixed(1) + '" font-weight="600" fill="' + p.accent + '">52.5° LEVÉE</text>');

    // 2. Escape Wheel (15 Club Teeth)
    var escPath = createEscapeWheelPath(escCx, escCy, 15, escRadius);
    svg.push('<path d="' + escPath + '" fill="none" stroke="' + p.ink + '" stroke-width="1.3" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (escRadius * 0.94).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="2 3" stroke-width="0.5" />');
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (escRadius * 0.62).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.8" />');

    // 5-Spoke Star Wheel with Teardrop Cutouts
    for (var s = 0; s < 5; s++) {
      var sa = s * Math.PI * 0.4 + rad(18);
      var sx1 = escCx + Math.cos(sa) * (escRadius * 0.2);
      var sy1 = escCy + Math.sin(sa) * (escRadius * 0.2);
      var sx2 = escCx + Math.cos(sa) * (escRadius * 0.62);
      var sy2 = escCy + Math.sin(sa) * (escRadius * 0.62);
      svg.push('<line x1="' + sx1.toFixed(1) + '" y1="' + sy1.toFixed(1) + '" x2="' + sx2.toFixed(1) + '" y2="' + sy2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.2" />');
    }

    // Escape Pinion with 8 Leaves & Jewel Chaton
    svg.push('<circle cx="' + escCx.toFixed(1) + '" cy="' + escCy.toFixed(1) + '" r="' + (12 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.2" />');
    svg.push(renderRubyJewel(escCx, escCy, 4.5 * scale, scale, p));

    // 3. Pallet Fork (L'Ancre Suisse) with Jeweled Pallet Stones
    var leverAngle = rad(-14);
    var forkTipX = leverPivotX + Math.cos(leverAngle) * (62 * scale);
    var forkTipY = leverPivotY + Math.sin(leverAngle) * (62 * scale);

    var entryX = leverPivotX - Math.cos(leverAngle + 0.48) * (52 * scale);
    var entryY = leverPivotY - Math.sin(leverAngle + 0.48) * (52 * scale);
    var exitX = leverPivotX - Math.cos(leverAngle - 0.52) * (50 * scale);
    var exitY = leverPivotY - Math.sin(leverAngle - 0.52) * (50 * scale);

    // T-Shaped Pallet Fork Body with Anglage Relief
    svg.push('<path d="M ' + forkTipX.toFixed(1) + ' ' + forkTipY.toFixed(1) +
             ' L ' + (leverPivotX + 9 * scale).toFixed(1) + ' ' + (leverPivotY - 5 * scale).toFixed(1) +
             ' L ' + exitX.toFixed(1) + ' ' + exitY.toFixed(1) +
             ' L ' + (leverPivotX - 11 * scale).toFixed(1) + ' ' + (leverPivotY + 7 * scale).toFixed(1) +
             ' L ' + entryX.toFixed(1) + ' ' + entryY.toFixed(1) +
             ' L ' + (leverPivotX - 3 * scale).toFixed(1) + ' ' + (leverPivotY - 9 * scale).toFixed(1) +
             ' Z" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.3" stroke-linejoin="round" />');

    // Safety Dart (Guard Pin / Flèche de Sécurité)
    svg.push('<line x1="' + forkTipX.toFixed(1) + '" y1="' + forkTipY.toFixed(1) + '" x2="' + (forkTipX + 11 * scale).toFixed(1) + '" y2="' + (forkTipY - 2 * scale).toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.2" stroke-linecap="round" />');

    // Ruby Pallet Stones (Synthetic Corundum with Shellac Bevels)
    svg.push('<rect x="' + (entryX - 6 * scale).toFixed(1) + '" y="' + (entryY - 4 * scale).toFixed(1) + '" width="' + (12 * scale).toFixed(1) + '" height="' + (8 * scale).toFixed(1) + '" rx="1" transform="rotate(-32 ' + entryX.toFixed(1) + ' ' + entryY.toFixed(1) + ')" fill="url(#rubyGrad)" stroke="' + p.ink + '" stroke-width="0.75" />');
    svg.push('<rect x="' + (exitX - 6 * scale).toFixed(1) + '" y="' + (exitY - 4 * scale).toFixed(1) + '" width="' + (12 * scale).toFixed(1) + '" height="' + (8 * scale).toFixed(1) + '" rx="1" transform="rotate(38 ' + exitX.toFixed(1) + ' ' + exitY.toFixed(1) + ')" fill="url(#rubyGrad)" stroke="' + p.ink + '" stroke-width="0.75" />');

    // Pallet Lever Pivot Chaton
    svg.push(renderRubyJewel(leverPivotX, leverPivotY, 3.8 * scale, scale, p));

    // Eccentric Banking Pins with Adjusting Slots
    svg.push(renderBluedScrew(leverPivotX + 35 * scale, leverPivotY - 25 * scale, 3.8 * scale, 45, scale, p));
    svg.push(renderBluedScrew(leverPivotX + 38 * scale, leverPivotY + 27 * scale, 3.8 * scale, 135, scale, p));

    // 4. Glucydur Free-Sprung Balance Wheel & Breguet Overcoil
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + balRadius.toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="2" />');
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (balRadius - 7 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" />');

    // 4 Crossed Balance Arms with Relief Cutouts
    for (var b = 0; b < 4; b++) {
      var ba = b * Math.PI * 0.5 + rad(22);
      var bx1 = balCx + Math.cos(ba) * (18 * scale);
      var by1 = balCy + Math.sin(ba) * (18 * scale);
      var bx2 = balCx + Math.cos(ba) * (balRadius - 7 * scale);
      var by2 = balCy + Math.sin(ba) * (balRadius - 7 * scale);
      svg.push('<line x1="' + bx1.toFixed(1) + '" y1="' + by1.toFixed(1) + '" x2="' + bx2.toFixed(1) + '" y2="' + by2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.6" />');
    }

    // 16 Peripheral Gold Timing Screws & 4 Slotted Gyromax Collets
    for (var sc = 0; sc < 16; sc++) {
      var scAngle = sc * (Math.PI * 2 / 16);
      var scx = balCx + Math.cos(scAngle) * (balRadius + 3.8 * scale);
      var scy = balCy + Math.sin(scAngle) * (balRadius + 3.8 * scale);
      svg.push('<circle cx="' + scx.toFixed(1) + '" cy="' + scy.toFixed(1) + '" r="' + (2.6 * scale).toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.5" />');
      if (sc % 4 === 0) {
        // Gyromax Slotted Weight
        var massX = balCx + Math.cos(scAngle) * (balRadius - 12 * scale);
        var massY = balCy + Math.sin(scAngle) * (balRadius - 12 * scale);
        svg.push('<circle cx="' + massX.toFixed(1) + '" cy="' + massY.toFixed(1) + '" r="' + (4.2 * scale).toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.5" />');
        svg.push('<line x1="' + (massX - 2.5 * scale).toFixed(1) + '" y1="' + massY.toFixed(1) + '" x2="' + (massX + 2.5 * scale).toFixed(1) + '" y2="' + massY.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="0.75" />');
      }
    }

    // Roller Table & Ruby Impulse Pin
    svg.push('<circle cx="' + balCx.toFixed(1) + '" cy="' + balCy.toFixed(1) + '" r="' + (22 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.1" />');
    var pinAngle = rad(195);
    var pinX = balCx + Math.cos(pinAngle) * (16 * scale);
    var pinY = balCy + Math.sin(pinAngle) * (16 * scale);
    svg.push('<circle cx="' + pinX.toFixed(1) + '" cy="' + pinY.toFixed(1) + '" r="' + (2.8 * scale).toFixed(1) + '" fill="url(#rubyGrad)" stroke="' + p.ink + '" stroke-width="0.5" />');

    // 12.5-Turn Coiled Breguet Hairspring (Raised Terminal Overcoil)
    var springPath = createHairspringPath(balCx, balCy, 12 * scale, 65 * scale, 8.5);
    svg.push('<path d="' + springPath + '" fill="none" stroke="' + p.metal + '" stroke-width="0.9" opacity="0.95" />');

    // Mobile Stud Carrier (Porte-Piton Mobile) & Swan-Neck Micrometric Regulator
    var studX = balCx + Math.cos(rad(240)) * (72 * scale);
    var studY = balCy + Math.sin(rad(240)) * (72 * scale);
    svg.push('<polygon points="' + studX.toFixed(1) + ',' + studY.toFixed(1) + ' ' + (studX + 8 * scale).toFixed(1) + ',' + (studY - 6 * scale).toFixed(1) + ' ' + (studX + 10 * scale).toFixed(1) + ',' + (studY + 5 * scale).toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.6" />');

    // Swan-Neck Micrometric Spring (Col de Cygne)
    var swanPath = 'M ' + (balCx - 18 * scale).toFixed(1) + ' ' + (balCy - 48 * scale).toFixed(1) +
                   ' C ' + (balCx - 42 * scale).toFixed(1) + ' ' + (balCy - 35 * scale).toFixed(1) + ', ' +
                   (balCx - 42 * scale).toFixed(1) + ' ' + (balCy - 6 * scale).toFixed(1) + ', ' +
                   (balCx - 24 * scale).toFixed(1) + ' ' + (balCy + 10 * scale).toFixed(1);
    svg.push('<path d="' + swanPath + '" fill="none" stroke="' + p.metal + '" stroke-width="1.4" stroke-linecap="round" />');
    svg.push(renderBluedScrew(balCx - 40 * scale, balCy - 20 * scale, 3.2 * scale, 60, scale, p));

    // Center Incabloc Lyre Shock Spring & Ruby Capstone Setting
    svg.push(renderRubyJewel(balCx, balCy, 6 * scale, scale, p));
    svg.push('<path d="M ' + (balCx - 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             ' C ' + (balCx - 5 * scale).toFixed(1) + ' ' + (balCy - 9 * scale).toFixed(1) + ', ' + (balCx + 5 * scale).toFixed(1) + ' ' + (balCy - 9 * scale).toFixed(1) + ', ' + (balCx + 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             ' C ' + (balCx + 6 * scale).toFixed(1) + ' ' + (balCy + 8 * scale).toFixed(1) + ', ' + (balCx - 6 * scale).toFixed(1) + ' ' + (balCy + 8 * scale).toFixed(1) + ', ' + (balCx - 9 * scale).toFixed(1) + ' ' + (balCy - 2 * scale).toFixed(1) +
             '" fill="none" stroke="url(#goldGrad)" stroke-width="0.9" />');

    // Engineering Leader Callouts
    svg.push(renderLeaderCallout(escCx - escRadius * 0.5, escCy - escRadius * 0.7, escCx - 40 * scale, escCx - 48 * scale, cy - 90 * scale, "[01] ROUE D'ÉCHAPPEMENT 15D", "Acier trempé • Involute", scale, p, 'right'));
    svg.push(renderLeaderCallout(entryX, entryY, leverPivotX - 35 * scale, leverPivotX - 42 * scale, cy + 92 * scale, "[02] ANCRE & RUBIS 52.5°", "Levées rubis synthétique", scale, p, 'right'));
    svg.push(renderLeaderCallout(balCx + balRadius * 0.6, balCy - balRadius * 0.6, balCx + 45 * scale, balCx + 52 * scale, cy - 90 * scale, "[03] BALANCIER GLUCYDUR", "Masselottes Gyromax or 18k", scale, p, 'left'));
    svg.push(renderLeaderCallout(studX, studY, balCx + 35 * scale, balCx + 42 * scale, cy + 92 * scale, "[04] SPIRAL BREGUET", "Courbe terminale isochrone", scale, p, 'left'));

    return svg.join('\n');
  }

  // Archetype 2: Flying Tourbillon One-Minute Filigreed Carriage
  function renderFlyingTourbillon(prng, cx, cy, scale, p) {
    var svg = [];

    var cageR = 138 * scale;
    var innerCageR = 112 * scale;

    // 1. Outer 60-Second Graduation Chapter Ring (Dual Neatlines + 300 Sub-Ticks)
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (cageR + 25 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.8" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (cageR + 15 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.6" stroke-dasharray="3 3" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (cageR + 8 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.8" />');

    // 60-Second Major & 1/5th Second Minor Graduations (300 ticks)
    for (var sec = 0; sec < 60; sec++) {
      var secAng = (sec * Math.PI * 2) / 60 - Math.PI * 0.5;
      var isMajor = sec % 5 === 0;
      var isQuarter = sec % 15 === 0;
      var tickLen = isQuarter ? 10 * scale : (isMajor ? 7 * scale : 3.5 * scale);
      var tx1 = cx + Math.cos(secAng) * (cageR + 15 * scale);
      var ty1 = cy + Math.sin(secAng) * (cageR + 15 * scale);
      var tx2 = cx + Math.cos(secAng) * (cageR + 15 * scale + tickLen);
      var ty2 = cy + Math.sin(secAng) * (cageR + 15 * scale + tickLen);
      svg.push('<line x1="' + tx1.toFixed(1) + '" y1="' + ty1.toFixed(1) + '" x2="' + tx2.toFixed(1) + '" y2="' + ty2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="' + (isMajor ? 1.2 : 0.55) + '" />');

      if (isMajor) {
        var numX = cx + Math.cos(secAng) * (cageR + 32 * scale);
        var numY = cy + Math.sin(secAng) * (cageR + 32 * scale) + (2.8 * scale);
        svg.push('<text x="' + numX.toFixed(1) + '" y="' + numY.toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + (isQuarter ? 8.2 * scale : 6.8 * scale).toFixed(1) + '" font-weight="' + (isQuarter ? 700 : 500) + '" text-anchor="middle" fill="' + p.ink + '">' + sec + '</text>');
      }
    }

    // 2. Fixed Fourth Wheel (Mounted underneath cage with 64 epicycloidal teeth)
    var fourthGear = createGearPath(cx, cy, 64, 2.1 * scale);
    svg.push('<path d="' + fourthGear.d + '" fill="none" stroke="' + p.metal + '" stroke-width="0.7" opacity="0.55" stroke-dasharray="2 2" />');

    // 3. Filigreed Titanium 3-Arm Flying Carriage
    for (var arm = 0; arm < 3; arm++) {
      var armAng = (arm * Math.PI * 2) / 3 - Math.PI * 0.5;
      var aCos = Math.cos(armAng);
      var aSin = Math.sin(armAng);
      var pCos = Math.cos(armAng + Math.PI * 0.5);
      var pSin = Math.sin(armAng + Math.PI * 0.5);

      // Swept Aerodynamic Arm Profile with Perlage Fill
      var armPath = 'M ' + (cx + pCos * 14 * scale).toFixed(1) + ' ' + (cy + pSin * 14 * scale).toFixed(1) +
                    ' C ' + (cx + aCos * 38 * scale + pCos * 16 * scale).toFixed(1) + ' ' + (cy + aSin * 38 * scale + pSin * 16 * scale).toFixed(1) + ', ' +
                    (cx + aCos * 85 * scale + pCos * 12 * scale).toFixed(1) + ' ' + (cy + aSin * 85 * scale + pSin * 12 * scale).toFixed(1) + ', ' +
                    (cx + aCos * innerCageR).toFixed(1) + ' ' + (cy + aSin * innerCageR).toFixed(1) +
                    ' C ' + (cx + aCos * 85 * scale - pCos * 12 * scale).toFixed(1) + ' ' + (cy + aSin * 85 * scale - pSin * 12 * scale).toFixed(1) + ', ' +
                    (cx + aCos * 38 * scale - pCos * 16 * scale).toFixed(1) + ' ' + (cy + aSin * 38 * scale - pSin * 16 * scale).toFixed(1) + ', ' +
                    (cx - pCos * 14 * scale).toFixed(1) + ' ' + (cy - pSin * 14 * scale).toFixed(1) + ' Z';
      svg.push('<path d="' + armPath + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.3" opacity="0.95" />');
      svg.push('<path d="' + armPath + '" fill="url(#perlagePattern)" stroke="none" opacity="0.4" />');

      // Internal Elliptical Lightening Cutout & Anglage Bevel
      var cutoutCx = cx + aCos * 62 * scale;
      var cutoutCy = cy + aSin * 62 * scale;
      svg.push('<circle cx="' + cutoutCx.toFixed(1) + '" cy="' + cutoutCy.toFixed(1) + '" r="' + (8.5 * scale).toFixed(1) + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="0.8" />');

      // Carriage Pillar Connecting Screw (Flame-Blued Steel)
      var screwX = cx + aCos * (innerCageR - 8 * scale);
      var screwY = cy + aSin * (innerCageR - 8 * scale);
      svg.push(renderBluedScrew(screwX, screwY, 3.2 * scale, arm * 120, scale, p));
    }

    // 4. Co-Axial Glucydur Balance Wheel Mounted Inside Tourbillon Cage
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (92 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.6" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (86 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" />');

    // 12 Gold Inertia Collets on Balance Rim
    for (var col = 0; col < 12; col++) {
      var cAng = col * (Math.PI * 2 / 12);
      var colX = cx + Math.cos(cAng) * (92 * scale);
      var colY = cy + Math.sin(cAng) * (92 * scale);
      svg.push('<circle cx="' + colX.toFixed(1) + '" cy="' + colY.toFixed(1) + '" r="' + (2.4 * scale).toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.5" />');
    }

    // Coiled Breguet Overcoil Spiral
    var tourbillonSpring = createHairspringPath(cx, cy, 14 * scale, 56 * scale, 6.5);
    svg.push('<path d="' + tourbillonSpring + '" fill="none" stroke="' + p.metal + '" stroke-width="0.85" />');

    // 5. Planetary Escape Pinion & Wheel Rotating Around Fourth Wheel
    var escOffX = cx + 44 * scale;
    var escOffY = cy + 22 * scale;
    var subEscape = createEscapeWheelPath(escOffX, escOffY, 15, 32 * scale);
    svg.push('<path d="' + subEscape + '" fill="none" stroke="' + p.ink + '" stroke-width="0.9" />');
    svg.push(renderRubyJewel(escOffX, escOffY, 3.2 * scale, scale, p));

    // 6. Central Cage Capstone with Mirror-Polished Gold Chaton & 2 Blued Screws
    svg.push(renderRubyJewel(cx, cy, 6.5 * scale, scale, p));
    svg.push(renderBluedScrew(cx - 10.5 * scale, cy - 6 * scale, 2.2 * scale, 35, scale, p));
    svg.push(renderBluedScrew(cx + 10.5 * scale, cy + 6 * scale, 2.2 * scale, 125, scale, p));

    // Engineering Leader Callouts (Positioned in 4 diagonal corner quadrants)
    svg.push(renderLeaderCallout(cx - innerCageR * 0.6, cy - innerCageR * 0.5, cx - 145 * scale, cx - 152 * scale, cy - 120 * scale, "[01] CAGE TRI-AXE SQUELETTÉE", "Titane grade 5 • Masse 0.28g", scale, p, 'right'));
    svg.push(renderLeaderCallout(escOffX + 15 * scale, escOffY, cx + 145 * scale, cx + 152 * scale, cy - 120 * scale, "[02] ÉCHAPPEMENT PLANÉTAIRE", "Engrenage direct sur roue fixe", scale, p, 'left'));
    svg.push(renderLeaderCallout(cx + 92 * scale * 0.6, cy + 92 * scale * 0.5, cx + 145 * scale, cx + 152 * scale, cy + 120 * scale, "[03] BALANCIER CO-AXIAL LIBRE", "12 Masselottes Gyromax or 18k", scale, p, 'left'));
    svg.push(renderLeaderCallout(cx - 10.5 * scale, cy - 6 * scale, cx - 145 * scale, cx - 152 * scale, cy + 120 * scale, "[04] VIS ACIER BLEUI AU FEU", "Fixation du pont de cage", scale, p, 'right'));

    return svg.join('\n');
  }

  // Archetype 3: Multi-Stage Epicyclic Planetary Differential Gear Train
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

    // 1. Line of Centers & Pitch/Base Circle Construction Drafting Lines
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + sunRp.toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="3 3" stroke-width="0.55" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + carrierOrbitR.toFixed(1) + '" fill="none" stroke="' + p.grid + '" stroke-dasharray="6 3 2 3" stroke-width="0.75" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + ringRp.toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-dasharray="3 3" stroke-width="0.55" />');

    // Involute Line of Action (20° Pressure Angle Contact Line)
    var paAngle = rad(20);
    svg.push('<line x1="' + (cx - carrierOrbitR * 1.2).toFixed(1) + '" y1="' + (cy - Math.sin(paAngle) * carrierOrbitR * 1.2).toFixed(1) + '" x2="' + (cx + carrierOrbitR * 1.2).toFixed(1) + '" y2="' + (cy + Math.sin(paAngle) * carrierOrbitR * 1.2).toFixed(1) + '" stroke="' + p.accent + '" stroke-dasharray="2 3" stroke-width="0.65" opacity="0.6" />');

    // 2. Outer Annulus Ring Body (Internal Ring Gear Chassis)
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (ringRp + 26 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="2" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (ringRp + 16 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" />');

    // 6 Perimeter Mounting Lugs with Blued Steel Screws
    for (var lug = 0; lug < 6; lug++) {
      var lugA = lug * (Math.PI / 3);
      var lx = cx + Math.cos(lugA) * (ringRp + 21 * scale);
      var ly = cy + Math.sin(lugA) * (ringRp + 21 * scale);
      svg.push(renderBluedScrew(lx, ly, 3.2 * scale, lug * 60, scale, p));
    }

    // Inward Gear Teeth for Ring Gear
    var ringTeethCount = 48;
    for (var rt = 0; rt < ringTeethCount; rt++) {
      var rAngle = (rt * Math.PI * 2) / ringTeethCount;
      var rx1 = cx + Math.cos(rAngle) * ringRp;
      var ry1 = cy + Math.sin(rAngle) * ringRp;
      var rx2 = cx + Math.cos(rAngle) * (ringRp - 5.5 * scale);
      var ry2 = cy + Math.sin(rAngle) * (ringRp - 5.5 * scale);
      svg.push('<line x1="' + rx1.toFixed(1) + '" y1="' + ry1.toFixed(1) + '" x2="' + rx2.toFixed(1) + '" y2="' + ry2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.2" />');
    }

    // 3. Planet Carrier Spider Plate (Tri-Lobe Triangular Carrier with Anglage)
    var numPlanets = 3;
    var carrierPath = [];
    for (var pl = 0; pl < numPlanets; pl++) {
      var pAngle = (pl * Math.PI * 2) / numPlanets - Math.PI * 0.5;
      var plx = cx + Math.cos(pAngle) * carrierOrbitR;
      var ply = cy + Math.sin(pAngle) * carrierOrbitR;
      var pLeft = pAngle - rad(24);
      var pRight = pAngle + rad(24);

      var clx = cx + Math.cos(pLeft) * (carrierOrbitR - 12 * scale);
      var cly = cy + Math.sin(pLeft) * (carrierOrbitR - 12 * scale);
      var crx = cx + Math.cos(pRight) * (carrierOrbitR - 12 * scale);
      var cry = cy + Math.sin(pRight) * (carrierOrbitR - 12 * scale);

      if (pl === 0) carrierPath.push('M ' + clx.toFixed(1) + ' ' + cly.toFixed(1));
      else carrierPath.push('L ' + clx.toFixed(1) + ' ' + cly.toFixed(1));
      carrierPath.push('Q ' + plx.toFixed(1) + ' ' + ply.toFixed(1) + ' ' + crx.toFixed(1) + ' ' + cry.toFixed(1));
    }
    carrierPath.push('Z');
    svg.push('<path d="' + carrierPath.join(' ') + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.2" opacity="0.95" />');
    svg.push('<path d="' + carrierPath.join(' ') + '" fill="url(#perlagePattern)" stroke="none" opacity="0.35" />');

    // 4. 3 Planetary Involute Gears
    for (var pIdx = 0; pIdx < numPlanets; pIdx++) {
      var pAng = (pIdx * Math.PI * 2) / numPlanets - Math.PI * 0.5;
      var px = cx + Math.cos(pAng) * carrierOrbitR;
      var py = cy + Math.sin(pAng) * carrierOrbitR;

      var planetGear = createGearPath(px, py, zPlanet, m);
      svg.push('<path d="' + planetGear.d + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.15" />');

      // Lightening Circular Hole in Planet Gears
      svg.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (planetRp * 0.45).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.75" />');

      // Planetary Arbor with Ruby Jewel Bearing
      svg.push(renderRubyJewel(px, py, 3.5 * scale, scale, p));
    }

    // 5. Central Sun Gear (24 Teeth)
    var sunGear = createGearPath(cx, cy, zSun, m);
    svg.push('<path d="' + sunGear.d + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.3" />');
    svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (sunRp * 0.55).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="0.9" />');

    // 5-Spoke Cutouts on Sun Gear
    for (var sp = 0; sp < 5; sp++) {
      var spa = sp * (Math.PI * 2 / 5);
      var spx1 = cx + Math.cos(spa) * (sunRp * 0.22);
      var spy1 = cy + Math.sin(spa) * (sunRp * 0.22);
      var spx2 = cx + Math.cos(spa) * (sunRp * 0.55);
      var spy2 = cy + Math.sin(spa) * (sunRp * 0.55);
      svg.push('<line x1="' + spx1.toFixed(1) + '" y1="' + spy1.toFixed(1) + '" x2="' + spx2.toFixed(1) + '" y2="' + spy2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.1" />');
    }

    // Central Mainspring Arbor Jewel Setting
    svg.push(renderRubyJewel(cx, cy, 5.5 * scale, scale, p));

    // Engineering Leader Callouts
    svg.push(renderLeaderCallout(cx - (ringRp + 18 * scale) * 0.7, cy - (ringRp + 18 * scale) * 0.7, cx - 125 * scale, cx - 132 * scale, cy - 85 * scale, "[01] COURONNE INTÉRIEURE (Z=56)", "Denture interne • m=2.4", scale, p, 'right'));
    svg.push(renderLeaderCallout(cx, cy - carrierOrbitR, cx + 125 * scale, cx + 132 * scale, cy - 85 * scale, "[02] SATELLITE PLANÉTAIRE (Z=16)", "Palier rubis dans châton or", scale, p, 'left'));
    svg.push(renderLeaderCallout(cx + sunRp * 0.7, cy + sunRp * 0.7, cx + 125 * scale, cx + 132 * scale, cy + 85 * scale, "[03] ROUE SOLAIRE (Z=24)", "Rapport réduction i=3.333", scale, p, 'left'));
    svg.push(renderLeaderCallout(cx - 18 * scale, cy + carrierOrbitR * 0.8, cx - 125 * scale, cx - 132 * scale, cy + 85 * scale, "[04] ARAIGNÉE PORTE-SATELLITES", "Finition perlage circulaire", scale, p, 'right'));

    return svg.join('\n');
  }

  // Archetype 4: Astronomical Equation of Time & Moonphase Complication
  function renderAstronomicalEquationOfTime(prng, cx, cy, scale, p) {
    var svg = [];

    var camBaseR = 75 * scale;
    var moonWheelR = 68 * scale;

    var camCx = cx - 90 * scale;
    var camCy = cy + 10 * scale;

    var moonCx = cx + 85 * scale;
    var moonCy = cy - 8 * scale;

    // 1. Astrological / Calendar 365-Day Chapter Ring around Kidney Cam
    svg.push('<circle cx="' + camCx.toFixed(1) + '" cy="' + camCy.toFixed(1) + '" r="' + (camBaseR + 26 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.4" />');
    svg.push('<circle cx="' + camCx.toFixed(1) + '" cy="' + camCy.toFixed(1) + '" r="' + (camBaseR + 18 * scale).toFixed(1) + '" fill="none" stroke="' + p.metal + '" stroke-width="0.6" stroke-dasharray="2 2" />');

    // 12 Monthly Zodiac Ticks & Radial Sectors
    for (var m = 0; m < 12; m++) {
      var mAng = (m * Math.PI * 2) / 12;
      var mx1 = camCx + Math.cos(mAng) * (camBaseR + 18 * scale);
      var my1 = camCy + Math.sin(mAng) * (camBaseR + 18 * scale);
      var mx2 = camCx + Math.cos(mAng) * (camBaseR + 26 * scale);
      var my2 = camCy + Math.sin(mAng) * (camBaseR + 26 * scale);
      svg.push('<line x1="' + mx1.toFixed(1) + '" y1="' + my1.toFixed(1) + '" x2="' + mx2.toFixed(1) + '" y2="' + my2.toFixed(1) + '" stroke="' + p.ink + '" stroke-width="1.1" />');

      // Month Roman Ordinal
      var numX = camCx + Math.cos(mAng + Math.PI / 12) * (camBaseR + 32 * scale);
      var numY = camCy + Math.sin(mAng + Math.PI / 12) * (camBaseR + 32 * scale) + (2.5 * scale);
      svg.push('<text x="' + numX.toFixed(1) + '" y="' + numY.toFixed(1) + '" font-family="\'JetBrains Mono\', monospace" font-size="' + (6.2 * scale).toFixed(1) + '" font-weight="600" text-anchor="middle" fill="' + p.meta + '">' + (m + 1) + 'M</text>');
    }

    // 2. Equation of Time Kidney Cam (Camme en Rein)
    var kidneyPath = createKidneyCamPath(camCx, camCy, camBaseR, scale);
    svg.push('<path d="' + kidneyPath + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.6" />');
    svg.push('<path d="' + kidneyPath + '" fill="url(#perlagePattern)" stroke="none" opacity="0.4" />');

    // Feeler Lever (Doigt de Palpeur) with Ruby Roller
    var feelerPivotX = camCx + 55 * scale;
    var feelerPivotY = camCy - 75 * scale;
    var feelerTipX = camCx + Math.cos(rad(-30)) * (camBaseR + 10 * scale);
    var feelerTipY = camCy + Math.sin(rad(-30)) * (camBaseR + 10 * scale);

    svg.push('<path d="M ' + feelerPivotX.toFixed(1) + ' ' + feelerPivotY.toFixed(1) +
             ' L ' + (feelerPivotX - 25 * scale).toFixed(1) + ' ' + (feelerPivotY + 35 * scale).toFixed(1) +
             ' L ' + feelerTipX.toFixed(1) + ' ' + feelerTipY.toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.3" />');
    svg.push(renderRubyJewel(feelerTipX, feelerTipY, 3.2 * scale, scale, p));
    svg.push(renderBluedScrew(feelerPivotX, feelerPivotY, 3.5 * scale, 45, scale, p));

    // Tension Spring for Feeler Lever
    var springArc = 'M ' + feelerPivotX.toFixed(1) + ' ' + feelerPivotY.toFixed(1) +
                    ' C ' + (feelerPivotX + 18 * scale).toFixed(1) + ' ' + (feelerPivotY + 12 * scale).toFixed(1) + ', ' +
                    (feelerPivotX + 22 * scale).toFixed(1) + ' ' + (feelerPivotY + 36 * scale).toFixed(1) + ', ' +
                    (feelerPivotX + 12 * scale).toFixed(1) + ' ' + (feelerPivotY + 48 * scale).toFixed(1);
    svg.push('<path d="' + springArc + '" fill="none" stroke="' + p.metal + '" stroke-width="1" />');

    // Central Kidney Cam Arbor Chaton
    svg.push(renderRubyJewel(camCx, camCy, 5.5 * scale, scale, p));

    // 3. 59-Tooth Moonphase Star Wheel & Lunar Disc
    var moonStarPath = createMoonStarWheelPath(moonCx, moonCy, moonWheelR, 59);
    svg.push('<path d="' + moonStarPath + '" fill="' + p.paper + '" stroke="' + p.ink + '" stroke-width="1.1" />');

    // Inner Lunar Disc Aperture with 2 Golden Moons
    svg.push('<circle cx="' + moonCx.toFixed(1) + '" cy="' + moonCy.toFixed(1) + '" r="' + (moonWheelR * 0.72).toFixed(1) + '" fill="' + (p === PALETTES.blueprint ? '#071520' : '#1A1A1A') + '" stroke="' + p.ink + '" stroke-width="1.2" />');

    // Moon 1 (Top Moon Disk in Gold with Crater Stipples)
    var moon1X = moonCx;
    var moon1Y = moonCy - 24 * scale;
    var moon1R = 14 * scale;
    svg.push('<circle cx="' + moon1X.toFixed(1) + '" cy="' + moon1Y.toFixed(1) + '" r="' + moon1R.toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.6" />');
    svg.push('<circle cx="' + (moon1X - 4 * scale).toFixed(1) + '" cy="' + (moon1Y - 2 * scale).toFixed(1) + '" r="' + (2.5 * scale).toFixed(1) + '" fill="' + p.metal + '" opacity="0.35" />');
    svg.push('<circle cx="' + (moon1X + 3 * scale).toFixed(1) + '" cy="' + (moon1Y + 3 * scale).toFixed(1) + '" r="' + (3.2 * scale).toFixed(1) + '" fill="' + p.metal + '" opacity="0.35" />');

    // Moon 2 (Bottom Moon Disk in Gold with Crater Stipples)
    var moon2X = moonCx;
    var moon2Y = moonCy + 24 * scale;
    var moon2R = 14 * scale;
    svg.push('<circle cx="' + moon2X.toFixed(1) + '" cy="' + moon2Y.toFixed(1) + '" r="' + moon2R.toFixed(1) + '" fill="url(#goldGrad)" stroke="' + p.ink + '" stroke-width="0.6" />');
    svg.push('<circle cx="' + (moon2X + 4 * scale).toFixed(1) + '" cy="' + (moon2Y - 3 * scale).toFixed(1) + '" r="' + (2.8 * scale).toFixed(1) + '" fill="' + p.metal + '" opacity="0.35" />');

    // Jumper Spring (Sautoir de Lune) for 59-Tooth Indexing
    var sautoirX = moonCx - moonWheelR - 12 * scale;
    var sautoirY = moonCy + 15 * scale;
    svg.push('<path d="M ' + (sautoirX - 10 * scale).toFixed(1) + ' ' + (sautoirY - 35 * scale).toFixed(1) +
             ' L ' + sautoirX.toFixed(1) + ' ' + sautoirY.toFixed(1) +
             ' L ' + (moonCx - moonWheelR + 2 * scale).toFixed(1) + ' ' + (moonCy + 6 * scale).toFixed(1) + '" fill="none" stroke="' + p.ink + '" stroke-width="1.3" />');
    svg.push(renderBluedScrew(sautoirX - 10 * scale, sautoirY - 35 * scale, 3.2 * scale, 90, scale, p));

    // Central Moon Arbor Chaton
    svg.push(renderRubyJewel(moonCx, moonCy, 4.8 * scale, scale, p));

    // Differential Gearing Liaison Line between Cam & Moon
    svg.push('<line x1="' + (camCx + camBaseR * 0.7).toFixed(1) + '" y1="' + camCy.toFixed(1) + '" x2="' + (moonCx - moonWheelR * 0.7).toFixed(1) + '" y2="' + moonCy.toFixed(1) + '" stroke="' + p.grid + '" stroke-dasharray="4 2 1 2" stroke-width="0.75" />');

    // Engineering Leader Callouts
    svg.push(renderLeaderCallout(camCx - camBaseR * 0.5, camCy - camBaseR * 0.6, camCx - 50 * scale, camCx - 58 * scale, cy - 95 * scale, "[01] CAMME D'ÉQUATION EN REIN", "Variation solaire ±16 min • 365j", scale, p, 'right'));
    svg.push(renderLeaderCallout(feelerTipX, feelerTipY, cx - 15 * scale, cx - 8 * scale, cy - 105 * scale, "[02] PALPEUR À GALET RUBIS", "Transmission différentielle", scale, p, 'left'));
    svg.push(renderLeaderCallout(moonCx + moonWheelR * 0.6, moonCy - moonWheelR * 0.6, moonCx + 45 * scale, moonCx + 52 * scale, cy - 95 * scale, "[03] ROUE DE LUNE 59 DENTS", "Cycle synodique 29j 12h 44m", scale, p, 'left'));
    svg.push(renderLeaderCallout(camCx, camCy + camBaseR * 0.8, camCx - 50 * scale, camCx - 58 * scale, cy + 95 * scale, "[04] SECTEURS ZODIACAUX 12M", "Graduation mensuelle solaire", scale, p, 'right'));

    return svg.join('\n');
  }

  // --- 6. Swiss-Archival Frame, Seal Stamp & Scale Bar ---

  // Archival Frame Neatlines (Swiss-Archival Standard)
  function renderArchivalFrame(width, height, margin, borderGap, strokeColor, metaColor, outerW, innerW) {
    var borderW = width - margin * 2;
    var borderH = height - margin * 2;
    var innerRectW = borderW - borderGap * 2;
    var innerRectH = borderH - borderGap * 2;
    var cx = width / 2;
    var cy = height / 2;
    var minDim = Math.min(width, height);

    var elements = [];

    // Outer Thick Neatline & Inner Precision Line
    elements.push('<rect x="' + margin + '" y="' + margin + '" width="' + borderW + '" height="' + borderH + '" fill="none" stroke="' + strokeColor + '" stroke-width="' + outerW.toFixed(2) + '" />');
    elements.push('<rect x="' + (margin + borderGap) + '" y="' + (margin + borderGap) + '" width="' + innerRectW + '" height="' + innerRectH + '" fill="none" stroke="' + metaColor + '" stroke-width="' + innerW.toFixed(2) + '" />');

    // Central Drafting Projection Guidelines
    elements.push('<g opacity="0.16">');
    elements.push('  <circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + ((minDim / 2) * 0.86).toFixed(1) + '" fill="none" stroke="' + metaColor + '" stroke-width="0.5" stroke-dasharray="2 3" />');
    elements.push('  <line x1="' + cx.toFixed(1) + '" y1="' + (margin + borderGap + 4) + '" x2="' + cx.toFixed(1) + '" y2="' + (height - margin - borderGap - 4) + '" stroke="' + metaColor + '" stroke-width="0.5" stroke-dasharray="3 4" />');
    elements.push('  <line x1="' + (margin + borderGap + 4) + '" y1="' + cy.toFixed(1) + '" x2="' + (width - margin - borderGap - 4) + '" y2="' + cy.toFixed(1) + '" stroke="' + metaColor + '" stroke-width="0.5" stroke-dasharray="3 4" />');
    elements.push('</g>');

    // Corner Alignment Crosshairs
    var crossLen = 5;
    var corners = [
      [margin + 4, margin + 4],
      [margin + borderW - 4, margin + 4],
      [margin + 4, margin + borderH - 4],
      [margin + borderW - 4, margin + borderH - 4]
    ];
    corners.forEach(function (pt) {
      elements.push('<line x1="' + (pt[0] - crossLen) + '" y1="' + pt[1] + '" x2="' + (pt[0] + crossLen) + '" y2="' + pt[1] + '" stroke="' + metaColor + '" stroke-width="0.5" opacity="0.65" />');
      elements.push('<line x1="' + pt[0] + '" y1="' + (pt[1] - crossLen) + '" x2="' + pt[0] + '" y2="' + (pt[1] + crossLen) + '" stroke="' + metaColor + '" stroke-width="0.5" opacity="0.65" />');
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

  // Metric Chronometer Pitch Module Gauge (4-Segment Alternating Rule)
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

  // --- 7. Main Synthesis Engine (Data Model Generation) ---
  function synthesize(seed, options) {
    options = options || {};
    var hashVal;
    var recoveredTypeKey = null;
    var typeCodeMap = { 'ESC': 'escapement', 'TOR': 'tourbillon', 'EPI': 'epicyclic', 'AST': 'astronomical' };

    if (typeof seed === 'number') {
      hashVal = seed >>> 0;
    } else {
      var seedStr = String(seed || "GlassGallery-Machina").trim();
      var parts = seedStr.toUpperCase().split('-');
      if (parts.length === 3 && parts[0] === 'MCV' && typeCodeMap[parts[1]]) {
        recoveredTypeKey = typeCodeMap[parts[1]];
      }
      var recovered = recoverHashFromId(seedStr);
      hashVal = recovered !== null ? recovered : fnv1a(seedStr);
    }

    var prng = Mulberry32(hashVal);

    // Pick Mechanism Archetype (Escapement, Tourbillon, Epicyclic, Astronomical)
    var archetypes = ['escapement', 'tourbillon', 'epicyclic', 'astronomical'];
    var typeKey;
    if (options.archetype && archetypes.indexOf(options.archetype) !== -1) {
      typeKey = options.archetype;
    } else if (recoveredTypeKey) {
      typeKey = recoveredTypeKey;
    } else {
      var typeIdx = Math.floor(prng() * archetypes.length);
      typeKey = archetypes[typeIdx];
    }

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
    } else if (typeKey === 'epicyclic') {
      mechanismTitle = "Train d'Engrenages Épicycloïdal Planétaire";
      beatRate = "Constante Chronométrique";
      jewelsCount = "19 Rubis Synthétiques";
      reductionRatio = "i = 3.333 : 1 (Z_c=56, Z_s=24)";
      escapementAngle = "20.0° Pressure Angle";
      balanceInertia = "18.2 mg·cm²";
      trainEfficiency = "98.1% Epicyclic";
    } else {
      mechanismTitle = "Équation du Temps & Astrolabe Lunaire";
      beatRate = "365.2422 Jours / An";
      jewelsCount = "32 Rubis Synthétiques";
      reductionRatio = "Synodique 29j 12h 44m";
      escapementAngle = "Camme en Rein ±16 min";
      balanceInertia = "14.6 mg·cm²";
      trainEfficiency = "97.8% Différentiel";
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
      hash: hashVal,
      accessionId: seqId,
      identifier: seqId,
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

  // --- 8. Standalone SVG Plate Generator (Swiss-Archival Format) ---
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

    // Archetype-Specific Scaling & Generous Vertical/Horizontal Margins
    var maxSpanW = width - (margin + borderGap) * 2 - 50;
    var maxSpanH = height - (margin + borderGap) * 2 - 80;
    var scale;
    if (specimen.archetype === 'tourbillon') {
      scale = Math.min(maxSpanW / 410, maxSpanH / 380);
    } else if (specimen.archetype === 'escapement') {
      scale = Math.min(maxSpanW / 470, maxSpanH / 290);
    } else if (specimen.archetype === 'astronomical') {
      scale = Math.min(maxSpanW / 440, maxSpanH / 300);
    } else {
      scale = Math.min(maxSpanW / 390, maxSpanH / 270);
    }
    scale = Math.min(scale, 1.05);
    var mechCy = cy - 2;

    var prng = Mulberry32(specimen.hashVal);
    var mechanismSvg;
    if (specimen.archetype === 'escapement') {
      mechanismSvg = renderSwissLeverEscapement(prng, cx, mechCy, scale, p);
    } else if (specimen.archetype === 'tourbillon') {
      mechanismSvg = renderFlyingTourbillon(prng, cx, mechCy, scale, p);
    } else if (specimen.archetype === 'astronomical') {
      mechanismSvg = renderAstronomicalEquationOfTime(prng, cx, mechCy, scale, p);
    } else {
      mechanismSvg = renderEpicyclicGearTrain(prng, cx, mechCy, scale, p);
    }

    // Archival Frame Neatlines (Dual Swiss-Archival Borders)
    var frameSvg = renderArchivalFrame(width, height, margin, borderGap, strokeColor, metaColor, outerLineWidth, innerLineWidth);

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

    // SVG Defs with Radiant Ruby, 18K Gold, Blued Steel Gradients & Perlage Pattern
    var defsSvg = [
      '  <defs>',
      '    <radialGradient id="rubyGrad" cx="35%" cy="35%" r="65%">',
      '      <stop offset="0%" stop-color="#FF5C5C" />',
      '      <stop offset="45%" stop-color="' + p.ruby + '" />',
      '      <stop offset="88%" stop-color="#5E0005" />',
      '      <stop offset="100%" stop-color="#2D0002" />',
      '    </radialGradient>',
      '    <radialGradient id="goldGrad" cx="32%" cy="32%" r="68%">',
      '      <stop offset="0%" stop-color="#FFF2B8" />',
      '      <stop offset="42%" stop-color="' + p.gold + '" />',
      '      <stop offset="85%" stop-color="#8F6B12" />',
      '      <stop offset="100%" stop-color="#4F3B08" />',
      '    </radialGradient>',
      '    <linearGradient id="bluedGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="#5482C4" />',
      '      <stop offset="60%" stop-color="' + p.blued + '" />',
      '      <stop offset="100%" stop-color="#10223D" />',
      '    </linearGradient>',
      '    <pattern id="perlagePattern" width="14" height="14" patternUnits="userSpaceOnUse">',
      '      <circle cx="7" cy="7" r="6" fill="none" stroke="' + p.grid + '" stroke-width="0.35" opacity="0.3" />',
      '      <circle cx="0" cy="0" r="6" fill="none" stroke="' + p.grid + '" stroke-width="0.35" opacity="0.3" />',
      '      <circle cx="14" cy="0" r="6" fill="none" stroke="' + p.grid + '" stroke-width="0.35" opacity="0.3" />',
      '      <circle cx="0" cy="14" r="6" fill="none" stroke="' + p.grid + '" stroke-width="0.35" opacity="0.3" />',
      '      <circle cx="14" cy="14" r="6" fill="none" stroke="' + p.grid + '" stroke-width="0.35" opacity="0.3" />',
      '    </pattern>',
      '  </defs>'
    ].join('\n');

    var lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" style="background-color:' + p.paper + '">',
      defsSvg,
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

  // --- 9. Canvas Direct Renderer (300 DPI Export Support) ---
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
      var specimen = synthesize(seed, options);
      if (options.includeSvg !== false) {
        specimen.svg = generateSvgPlate(specimen, options);
      }
      return specimen;
    },
    generateSvgPlate: generateSvgPlate,
    renderToCanvas: renderToCanvas,
    fnv1a: fnv1a,
    recoverHashFromId: recoverHashFromId,
    generateSequenceIdentifier: generateSequenceIdentifier
  };
});
