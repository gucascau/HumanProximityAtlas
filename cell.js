/* Human Proximity Atlas — schematic cell with the 20 proximity neighbourhoods (inline SVG, no libraries).
   cellFigure(nb, {selected, list, compact}) returns HTML; attachCell(root, nb, {navigate}) wires hover and click.
   Each drawn structure carries data-c="<neighbourhood>"; neighbourhoods 6, 10 and 17 (abundant / low-specificity / broadly bound) are not drawn.
   Numbers follow the map rebuilt on 2026-11-13 (proximity_map.py CURATED); re-curate NB_COL / NB_BADGE / the g() numbers
   whenever the map is rebuilt. */
"use strict";

const NB_COL = {
  11: "#e34948",                                   // endolysosome / Golgi / vesicles
  1: "#eb6834", 20: "#b8501f",                     // mitochondrion: matrix, membranes
  2: "#0f7a54", 18: "#3cc192",                     // ER membrane / nuclear envelope, ER lumen
  5: "#d18e00", 13: "#eda100",                     // plasma membrane: cell junctions, Rho GTPases / cortex
  12: "#d9568d",                                   // centrosome / cilium / cytoskeleton
  3: "#6250d6", 9: "#4232a8", 14: "#8e83dc", 19: "#7a6fd0", // stress granule, ribosome, cytosol, proteasome
  8: "#008300",                                    // nucleolus
  7: "#2a78d6", 4: "#173f73", 15: "#4b93e0", 16: "#5065c4", // nucleoplasm (TF), chromatin co-reg., hnRNP, chromatin modifiers
  6: "#9a988f", 10: "#9a988f", 17: "#9a988f"
};
const NB_NOT_DRAWN = new Set([6, 10, 17]);

/* badge positions (viewBox 0 0 800 560) */
const NB_BADGE = {
  11: [552, 300], 1: [614, 196], 15: [245, 290], 3: [520, 462], 2: [126, 418], 8: [340, 300], 7: [178, 322],
  20: [664, 168], 9: [540, 400], 5: [727, 300], 4: [214, 386], 18: [134, 304], 16: [420, 322], 12: [450, 190],
  14: [168, 160], 13: [72, 250], 19: [440, 470]
};

function cellSVG() {
  const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const g = (c, body, extra = "") => `<g class="nbr" data-c="${c}"${extra}>${body}</g>`;
  // cell outline: four cubic segments
  const SEG = [[[120, 110], [250, 60], [520, 70], [640, 120]], [[640, 120], [720, 160], [740, 300], [715, 400]],
               [[715, 400], [690, 490], [560, 525], [380, 520]], [[380, 520], [210, 515], [80, 480], [55, 380]],
               [[55, 380], [30, 280], [50, 150], [120, 110]]];
  const bez = (s, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]); };
  const cellD = `M${P(...SEG[0][0])} ` + SEG.map((s) => `C${P(...s[1])} ${P(...s[2])} ${P(...s[3])}`).join(" ") + " Z";
  // ellipse arc around the nucleus (centre 300,330)
  const arc = (rx, ry, a0, a1) => {
    const pt = (a) => [300 + rx * Math.cos(a * Math.PI / 180), 330 + ry * Math.sin(a * Math.PI / 180)];
    return `M${P(...pt(a0))} A${rx},${ry} 0 0 1 ${P(...pt(a1))}`;
  };
  const ellPt = (rx, ry, a) => [300 + rx * Math.cos(a * Math.PI / 180), 330 + ry * Math.sin(a * Math.PI / 180)];

  let s = `<svg viewBox="0 0 800 560" role="img" aria-label="Schematic human cell showing the 20 proximity neighbourhoods">
  <defs><clipPath id="cellClip"><path d="${cellD}"/></clipPath></defs>`;

  // neighbouring cell + junctions (5)
  const nbrD = `M${P(SEG[1][0][0] + 34, SEG[1][0][1] - 40)} C${P(SEG[1][1][0] + 34, SEG[1][1][1])} ${P(SEG[1][2][0] + 34, SEG[1][2][1])} ${P(SEG[1][3][0] + 34, SEG[1][3][1] + 40)}`;
  let junc = "";
  for (let t = 0.28; t <= 0.62; t += 0.034) {
    const [x, y] = bez(SEG[1], t);
    junc += `<line x1="${(x + 4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 30).toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }
  s += g(5, `<path d="${nbrD}" fill="none" stroke="${NB_COL[5]}" stroke-width="7" stroke-opacity=".45" stroke-linecap="round"/>
    <g stroke="${NB_COL[5]}" stroke-width="2.4">${junc}</g>`);

  // cytosol (14) and proteasome barrels (19)
  s += g(14, `<path d="${cellD}" fill="${NB_COL[14]}" fill-opacity=".13"/>`);
  s += g(19, `${[[205, 150], [585, 138], [470, 520 - 50]].map(([x, y], i) => `<g transform="translate(${x},${y}) rotate(${i * 35 - 20})" fill="${NB_COL[19]}">
      <rect x="-9" y="-4" width="18" height="8" rx="3"/><rect x="-11" y="-6" width="3" height="12" rx="1"/><rect x="8" y="-6" width="3" height="12" rx="1"/></g>`).join("")}`);

  s += `<g clip-path="url(#cellClip)">`;
  // microtubules from the centrosome (17)
  let mt = "";
  for (let a = -175; a <= 70; a += 22) {
    const r = 330, x2 = 450 + r * Math.cos(a * Math.PI / 180), y2 = 190 + r * Math.sin(a * Math.PI / 180);
    mt += `<path d="M450,190 Q${P(450 + r * 0.5 * Math.cos((a + 8) * Math.PI / 180), 190 + r * 0.5 * Math.sin((a + 8) * Math.PI / 180))} ${P(x2, y2)}"/>`;
  }
  s += g(12, `<g fill="none" stroke="${NB_COL[12]}" stroke-width="1.6" stroke-opacity=".45">${mt}</g>`);

  // ER sheets: membrane (2) under lumen (18), ribosomes (9) on the outer face; nuclear envelope (2)
  const sheets = [[172, 142, 118, 222], [190, 160, 122, 214], [208, 178, 128, 206]];
  s += g(2, sheets.map(([rx, ry, a0, a1]) => `<path d="${arc(rx, ry, a0, a1)}" fill="none" stroke="${NB_COL[2]}" stroke-width="13" stroke-linecap="round"/>`).join("") +
    `<ellipse cx="300" cy="330" rx="152" ry="122" fill="none" stroke="${NB_COL[2]}" stroke-width="8"/>`);
  s += g(18, sheets.map(([rx, ry, a0, a1]) => `<path d="${arc(rx, ry, a0, a1)}" fill="none" stroke="${NB_COL[18]}" stroke-width="5.5" stroke-linecap="round"/>`).join(""));
  let ribo = "";
  for (const [rx, ry, a0, a1] of sheets) for (let a = a0 + 4; a < a1; a += 7) { const [x, y] = ellPt(rx + 9, ry + 9, a); ribo += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`; }
  // free polysome: dots on a spiral
  for (let i = 0; i < 12; i++) { const a = i * 0.75, r = 6 + i * 1.7; ribo += `<circle cx="${(540 + r * Math.cos(a)).toFixed(1)}" cy="${(400 + r * Math.sin(a)).toFixed(1)}" r="3.4"/>`; }
  s += g(9, `<g fill="${NB_COL[9]}">${ribo}</g>`);

  // Golgi stack + TGN vesicles (11)
  let golgi = "";
  for (let i = 0; i < 4; i++) {
    const r = 72 + i * 13, a = 38 - i * 3;
    const p0 = [430 + r * Math.cos(-a * Math.PI / 180), 310 + r * Math.sin(-a * Math.PI / 180)], p1 = [430 + r * Math.cos(a * Math.PI / 180), 310 + r * Math.sin(a * Math.PI / 180)];
    golgi += `<path d="M${P(...p0)} A${r},${r} 0 0 1 ${P(...p1)}" fill="none" stroke="${NB_COL[11]}" stroke-width="7.5" stroke-linecap="round"/>`;
  }
  golgi += [[540, 256], [548, 350], [532, 236], [556, 372], [528, 372]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${NB_COL[11]}"/>`).join("");
  s += g(11, golgi);

  // endolysosomes (11)
  s += g(11, [[605, 452, 17], [660, 410, 13], [560, 492, 9], [470, 140, 8]].map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${NB_COL[11]}" fill-opacity=".22" stroke="${NB_COL[11]}" stroke-width="3"/>
     <circle cx="${x - r * 0.3}" cy="${y + r * 0.2}" r="${r * 0.22}" fill="${NB_COL[11]}" fill-opacity=".6"/>`).join(""));

  // stress granules / P-bodies (3)
  const blob = (x, y, r, k) => {
    let d = "";
    for (let i = 0; i <= 36; i++) { const a = i / 36 * 2 * Math.PI, rr = r * (1 + 0.18 * Math.sin(3 * a + k)); d += `${i ? "L" : "M"}${P(x + rr * Math.cos(a), y + rr * Math.sin(a))}`; }
    return d + "Z";
  };
  s += g(3, [[520, 462, 16, 0], [478, 496, 9, 1.3], [628, 262, 8, 2.1]].map(([x, y, r, k]) =>
    `<path d="${blob(x, y, r, k)}" fill="${NB_COL[3]}" fill-opacity=".55" stroke="${NB_COL[3]}" stroke-width="1.5" stroke-linejoin="round"/>`).join(""));

  // mitochondria: matrix (1); inner membrane + cristae, outer membrane and peroxisome (20)
  const mitos = [[600, 200, 70, 32, -25], [652, 330, 44, 20, 75]];
  const cristae = (rx, ry) => { let d = ""; for (let x = -rx + 16; x < rx - 10; x += 14) { const h = ry * Math.sqrt(1 - (x / rx) ** 2) - 4; d += `M${x},${(-h).toFixed(1)} q5,${(h * 0.6).toFixed(1)} 0,${(h * 1.2).toFixed(1)} `; } return d; };
  s += g(1, mitos.map(([x, y, rx, ry, rot]) => `<ellipse cx="${x}" cy="${y}" rx="${rx - 7}" ry="${ry - 6}" transform="rotate(${rot} ${x} ${y})" fill="${NB_COL[1]}" fill-opacity=".35"/>`).join(""));
  s += g(20, mitos.map(([x, y, rx, ry, rot]) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${NB_COL[20]}" stroke-width="3">
      <ellipse rx="${rx - 7}" ry="${ry - 6}"/><path d="${cristae(rx - 7, ry - 6)}" stroke-width="2.4"/></g>`).join(""));
  s += g(20, mitos.map(([x, y, rx, ry, rot]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="none" stroke="${NB_COL[20]}" stroke-width="4"/>`).join("") +
    `<circle cx="520" cy="150" r="11" fill="${NB_COL[20]}" fill-opacity=".25" stroke="${NB_COL[20]}" stroke-width="3"/><rect x="515" y="145" width="10" height="10" rx="2" fill="${NB_COL[20]}" fill-opacity=".6"/>`);

  // nucleus: nucleoplasm (7), chromatin (4, 16), hnRNP / speckle bodies (15), nuclear bodies (16), nucleolus (8)
  s += g(7, `<ellipse cx="300" cy="330" rx="148" ry="118" fill="${NB_COL[7]}" fill-opacity=".14"/>`);
  const squig = (x, y, n, rot) => { let d = `M${x - n * 9},${y}`; for (let i = 0; i < n; i++) d += ` q4.5,${i % 2 ? 9 : -9} 9,0 t9,0`; return `<path d="${d}" transform="rotate(${rot} ${x} ${y})"/>`; };
  s += g(4, `<g fill="none" stroke="${NB_COL[4]}" stroke-width="5" stroke-linecap="round" stroke-opacity=".8">
    ${squig(214, 386, 3, -20)}${squig(268, 236, 3, 10)}${squig(352, 420, 3, 15)}</g>`);
  s += g(16, `<g fill="none" stroke="${NB_COL[16]}" stroke-width="5" stroke-linecap="round" stroke-opacity=".8">
    ${squig(190, 270, 2, 70)}${squig(425, 375, 2, -60)}</g>`);
  s += g(15, [[245, 290, 13, 0.4], [288, 392, 10, 1.7], [398, 396, 11, 2.6]].map(([x, y, r, k]) =>
    `<path d="${blob(x, y, r, k)}" fill="${NB_COL[15]}" fill-opacity=".6" stroke="${NB_COL[15]}" stroke-width="1.2"/>`).join(""));
  let spl = "";
  for (const [cx, cy] of [[396, 248], [252, 345]]) for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 5 + (i % 3) * 5; spl += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="2.6"/>`; }
  s += g(15, `<g fill="${NB_COL[15]}">${spl}</g>`);
  s += g(16, [[420, 322, 8], [330, 368, 6], [200, 232, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${NB_COL[16]}" stroke-width="3"/>`).join(""));
  s += g(8, `<circle cx="340" cy="300" r="42" fill="${NB_COL[8]}" fill-opacity=".28" stroke="${NB_COL[8]}" stroke-width="2"/>
    ${[[325, 288], [355, 292], [338, 318], [322, 312], [352, 318], [343, 278]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${NB_COL[8]}" fill-opacity=".55"/>`).join("")}`);
  s += `</g>`; // end clip

  // plasma membrane (13, Rho GTPases / cortex) drawn on top of the cytosol edge
  s += g(13, `<path d="${cellD}" fill="none" stroke="${NB_COL[13]}" stroke-width="9" stroke-linejoin="round"/>`);
  // centrosome + primary cilium (12)
  s += g(12, `<path d="M384,96 C382,70 374,45 366,18" fill="none" stroke="${NB_COL[5]}" stroke-width="15" stroke-linecap="round" stroke-opacity=".55"/>
    <path d="M384,96 C382,70 374,45 366,18" fill="none" stroke="${NB_COL[12]}" stroke-width="6" stroke-linecap="round"/>
    <rect x="377" y="94" width="14" height="22" rx="3" fill="${NB_COL[12]}"/>
    <g transform="translate(450,190)"><rect x="-6" y="-14" width="12" height="28" rx="3" fill="${NB_COL[12]}"/><rect x="-14" y="-6" width="28" height="12" rx="3" fill="${NB_COL[12]}"/></g>`);

  // numbered badges (part of each neighbourhood's group)
  for (const [c, [x, y]] of Object.entries(NB_BADGE)) {
    s += `<g class="nbr badge-c" data-c="${c}"><circle cx="${x}" cy="${y}" r="12" fill="${NB_COL[c]}" stroke="#fff" stroke-width="2"/>
      <text x="${x}" y="${y + 4}" text-anchor="middle">${c}</text></g>`;
  }
  return s + `</svg>`;
}

function cellFigure(nb, opts = {}) {
  const byC = new Map((nb || []).map((c) => [c.component, c]));
  const list = opts.list ? `<ol class="cell-list">${[...byC.values()].sort((a, b) => a.component - b.component).map((c) => {
    const low = NB_NOT_DRAWN.has(c.component);
    return `<li class="nbr${low ? " low" : ""}" data-c="${c.component}"><span class="num" style="background:${NB_COL[c.component]}">${c.component}</span>
      <span class="nm">${esc(c.name)}</span><span class="muted small">${num(c.n)}</span></li>`;
  }).join("")}</ol><p class="small muted" style="margin:6px 0 0">6, 10 and 17 (abundant, low-specificity and broadly bound proteins) are not drawn.</p>` : "";
  return `<div class="cellfig${opts.compact ? " compact" : ""}${list ? " withlist" : ""}" data-selected="${opts.selected || ""}">
    <div class="cellsvg">${cellSVG()}</div>${list ? `<div>${list}</div>` : ""}</div>`;
}

function attachCell(root, nb, opts = {}) {
  const fig = root.classList && root.classList.contains("cellfig") ? root : root.querySelector(".cellfig");
  if (!fig) return;
  const byC = new Map((nb || []).map((c) => [String(c.component), c]));
  const svg = fig.querySelector("svg"), tip = document.getElementById("tooltip");
  const mark = (c) => {
    svg.classList.toggle("dim", !!c);
    fig.querySelectorAll(".nbr").forEach((e) => e.classList.toggle("hi", !!c && e.dataset.c === c));
  };
  const sel = fig.dataset.selected;
  const rest = () => mark(sel || "");
  rest();
  fig.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest(".nbr"); if (!t) return;
    mark(t.dataset.c);
    const c = byC.get(t.dataset.c);
    if (c && tip) {
      tip.hidden = false;
      tip.innerHTML = `<b>${c.component} · ${esc(c.name)}</b><br><span class="muted">${esc(c.compartment)} · ${num(c.n)} proteins</span>
        <br><span class="small">${esc((c.top_proteins || "").split(", ").slice(0, 6).join(", "))}</span>`;
    }
  });
  fig.addEventListener("mousemove", (ev) => { if (tip && !tip.hidden) { tip.style.left = ev.clientX + 14 + "px"; tip.style.top = ev.clientY + 10 + "px"; } });
  fig.addEventListener("mouseleave", () => { rest(); if (tip) tip.hidden = true; });
  fig.addEventListener("click", (ev) => {
    const t = ev.target.closest(".nbr"); if (!t) return;
    if (tip) tip.hidden = true;
    if (opts.navigate !== false) location.hash = `#/neighbourhoods?c=${t.dataset.c}`;
  });
}
