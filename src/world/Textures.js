// Procedural canvas textures — zero external assets, zero licensing risk.
import * as THREE from 'three';
import { rng } from '../core/utils.js';

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Metal deck plating — base color with panel seams, rivets, wear
export function deckPlate() {
  return canvasTex(512, 512, (g, w, h) => {
    const R = rng(1337);
    g.fillStyle = '#3d4854';
    g.fillRect(0, 0, w, h);
    // large panels
    const cell = 128;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const v = 0.86 + R() * 0.24;
        g.fillStyle = `rgb(${(61 * v) | 0},${(72 * v) | 0},${(84 * v) | 0})`;
        g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
        // brushed streaks
        g.strokeStyle = `rgba(255,255,255,${0.02 + R() * 0.03})`;
        for (let i = 0; i < 6; i++) {
          const yy = y + 8 + R() * (cell - 16);
          g.beginPath();
          g.moveTo(x + 6, yy);
          g.lineTo(x + cell - 6, yy);
          g.stroke();
        }
        // rivets in corners
        g.fillStyle = 'rgba(20,26,34,0.9)';
        for (const [rx, ry] of [[10, 10], [cell - 10, 10], [10, cell - 10], [cell - 10, cell - 10]]) {
          g.beginPath();
          g.arc(x + rx, y + ry, 3, 0, 7);
          g.fill();
        }
        // occasional wear patch
        if (R() < 0.3) {
          g.fillStyle = `rgba(30,36,44,${0.25 + R() * 0.3})`;
          g.beginPath();
          g.ellipse(x + R() * cell, y + R() * cell, 12 + R() * 30, 8 + R() * 20, R() * 3, 0, 7);
          g.fill();
        }
      }
    }
    g.strokeStyle = 'rgba(12,16,22,0.85)';
    g.lineWidth = 3;
    for (let x = 0; x <= w; x += cell) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += cell) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { repeat: [3, 3] });
}

export function deckRoughness() {
  return canvasTex(512, 512, (g, w, h) => {
    const R = rng(777);
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 100 + R() * 110;
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      g.fillRect(R() * w, R() * h, 2 + R() * 26, 2 + R() * 26);
    }
  }, { repeat: [3, 3], srgb: false });
}

// Hazard stripe strip for roof edges / obstacles (yellow/black chevrons)
export function hazardStripes() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#d8a018';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#161a20';
    const s = 32;
    for (let x = -s; x < w + s; x += s) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + s / 2, 0);
      g.lineTo(x + s, 0);
      g.lineTo(x + s / 2, h);
      g.closePath();
      g.fill();
    }
    // grime
    const R = rng(55);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 60; i++) g.fillRect(R() * w, R() * h, 2 + R() * 8, 1 + R() * 4);
  }, { repeat: [4, 1] });
}

// Building facade — dark panels with lit/unlit window grid (emissive map pair)
export function facade(seed = 7, litRatio = 0.42, hue = '#ffd9a0') {
  const R = rng(seed);
  const winMask = [];
  const cols = 8;
  const rows = 16;
  for (let i = 0; i < cols * rows; i++) winMask.push(R() < litRatio);
  const albedo = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#10151d';
    g.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = winMask[y * cols + x];
        g.fillStyle = lit ? hue : '#05070c';
        g.globalAlpha = lit ? 0.85 : 1;
        g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
        g.globalAlpha = 1;
      }
    }
  });
  const emissive = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!winMask[y * cols + x]) continue;
        const warm = R() < 0.75;
        g.fillStyle = warm ? hue : '#9fdcff';
        g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
      }
    }
  });
  return { albedo, emissive };
}

// Holo-sign panel — glowing glyph bars (abstract signage, no font assets)
export function holoSign(seed = 3, color = '#35e0ff') {
  return canvasTex(256, 128, (g, w, h) => {
    const R = rng(seed);
    g.fillStyle = 'rgba(4,10,16,0.92)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(4, 4, w - 8, h - 8);
    // glyph bars: vertical strokes of varying height — reads as alien text
    g.fillStyle = color;
    let x = 18;
    while (x < w - 24) {
      const gw = 6 + R() * 14;
      const gh = 20 + R() * (h - 56);
      const gy = (h - gh) / 2 + (R() - 0.5) * 10;
      g.globalAlpha = 0.6 + R() * 0.4;
      g.fillRect(x, gy, gw * (R() < 0.3 ? 0.4 : 1), gh);
      if (R() < 0.4) g.fillRect(x, gy - 8, gw, 3); // diacritic tick
      x += gw + 8 + R() * 10;
    }
    g.globalAlpha = 1;
  });
}

// Soft round particle sprite (dust/puff) + 4-point star spark
export function puffSprite() {
  return canvasTex(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

export function sparkSprite() {
  return canvasTex(64, 64, (g, w, h) => {
    g.translate(w / 2, h / 2);
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, w / 2, 0, 7);
    g.fill();
    // cross flare
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(-1.5, -h / 2, 3, h);
    g.fillRect(-w / 2, -1.5, w, 3);
  });
}

// Cloud blob sheet — soft puffs on transparent bg
export function cloudSprite() {
  return canvasTex(256, 128, (g, w, h) => {
    const R = rng(99);
    for (let i = 0; i < 26; i++) {
      const x = w * 0.15 + R() * w * 0.7;
      const y = h * 0.3 + R() * h * 0.4;
      const r = 14 + R() * 30;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    }
  });
}

// Circuit-panel texture for crates/blocks — subtle tech detail
export function cratePanel() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(4242);
    g.fillStyle = '#2c3646';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(53,224,255,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      let x = 12 + R() * (w - 24);
      let y = 12 + R() * (h - 24);
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 3; s++) {
        if (R() < 0.5) x += (R() - 0.5) * 80;
        else y += (R() - 0.5) * 80;
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = 'rgba(53,224,255,0.5)';
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 8;
    g.strokeRect(0, 0, w, h);
  });
}
