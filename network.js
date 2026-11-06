/* Human Proximity Atlas — gene network view (inline SVG + a small force layout, no libraries).
   Data: data/network.json  {genes, compartment, compartments, bait: [gene index], edges: [[bait, protein, fused x100,
   n comparisons, support code, high, core code, max log2FC x10]]}. Uses COMP_COL, esc, num, getJSON, $ from app.js. */
"use strict";

const NET_SUPPORT = { 1: "Known physical (non-PL)", 2: "Co-complex (CORUM)", 3: "Known by proximity labelling",
  4: "Human Cell Map, same raw data", 5: "Novel", 0: "–" };
const NET_CORE = { 1: "core", 2: "recurrent", 3: "context-specific", 0: "" };
let NET = null;

async function loadNetwork() {
  if (NET) return NET;
  const d = await getJSON("data/network.json");
  if (!d) return null;
  const gi = new Map(d.genes.map((g, i) => [g.toUpperCase(), i]));
  const adj = d.genes.map(() => []);
  d.edges.forEach((e, k) => { adj[e[0]].push(k); adj[e[1]].push(k); });
  NET = { ...d, gi, adj, isBait: new Set(d.bait) };
  return NET;
}

/* partner order: best fused score, then number of comparisons, then max log2FC */
const rank = (a, b) => (b[2] - a[2]) || (b[3] - a[3]) || (b[7] - a[7]);

/* ego network: centre + top-N partners (by best fused score) + edges among them */
function egoNetwork(N, centre, opts) {
  const best = new Map();                                   // partner -> edge index to centre (strongest)
  for (const k of N.adj[centre]) {
    const e = N.edges[k];
    const asBait = e[0] === centre, other = asBait ? e[1] : e[0];
    if (other === centre) continue;
    if (opts.dir === "bait" && !asBait) continue;
    if (opts.dir === "prey" && asBait) continue;
    if (opts.filter === "known" && !(e[4] >= 1 && e[4] <= 3)) continue;
    if (opts.filter === "high" && !e[5]) continue;
    if (!best.has(other) || rank(N.edges[best.get(other)], e) > 0) best.set(other, k);
  }
  const total = best.size;
  const partners = [...best.entries()].sort((a, b) => rank(N.edges[a[1]], N.edges[b[1]])).slice(0, opts.max);
  const ids = [centre, ...partners.map((p) => p[0])];
  const pos = new Map(ids.map((g, i) => [g, i]));
  const links = partners.map(([g, k]) => ({ s: 0, t: pos.get(g), k, ego: true }));
  if (opts.among) {
    const seen = new Set();
    for (const g of ids.slice(1)) for (const k of N.adj[g]) {
      const e = N.edges[k];
      if (seen.has(k) || e[0] === centre || e[1] === centre) continue;
      if (pos.has(e[0]) && pos.has(e[1]) && e[0] !== e[1]) { seen.add(k); links.push({ s: pos.get(e[0]), t: pos.get(e[1]), k, ego: false }); }
    }
  }
  return { ids, links, total };
}

function forceLayout(n, links, W, H) {
  // start on a circle ordered as given (partners pre-sorted by compartment), centre in the middle
  const P = Array.from({ length: n }, (_, i) => i === 0 ? { x: W / 2, y: H / 2 } :
    { x: W / 2 + 0.36 * W * Math.cos(2 * Math.PI * i / (n - 1)), y: H / 2 + 0.38 * H * Math.sin(2 * Math.PI * i / (n - 1)) });
  const deg = new Array(n).fill(0); links.forEach((l) => { deg[l.s]++; deg[l.t]++; });
  const L0 = Math.min(W, H) * (n > 60 ? 0.46 : n > 25 ? 0.40 : 0.32);
  let temp = 30;
  for (let it = 0; it < 320; it++) {
    const F = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = dx * dx + dy * dy + 0.01;
      const f = (n > 60 ? 3600 : 5200) / d2; const d = Math.sqrt(d2); dx /= d; dy /= d;
      F[i].x += f * dx * 30; F[i].y += f * dy * 30; F[j].x -= f * dx * 30; F[j].y -= f * dy * 30;
    }
    for (const l of links) {
      const a = P[l.s], b = P[l.t]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const L = l.ego ? L0 : L0 * 0.45, k = l.ego ? 0.02 : 0.05 / Math.max(1, Math.sqrt(Math.min(deg[l.s], deg[l.t])));
      const f = k * (d - L); dx /= d; dy /= d;
      F[l.s].x += f * dx * 30; F[l.s].y += f * dy * 30; F[l.t].x -= f * dx * 30; F[l.t].y -= f * dy * 30;
    }
    for (let i = 1; i < n; i++) {
      F[i].x += (W / 2 - P[i].x) * 0.004 * 30; F[i].y += (H / 2 - P[i].y) * 0.006 * 30;
      const m = Math.hypot(F[i].x, F[i].y) || 1, s = Math.min(m, temp) / m;
      P[i].x = Math.max(40, Math.min(W - 40, P[i].x + F[i].x * s)); P[i].y = Math.max(24, Math.min(H - 24, P[i].y + F[i].y * s));
    }
    temp = Math.max(1.5, temp * 0.985);
  }
  return P;
}

async function networkTab(gene) {
  const el = $("#tab");
  el.innerHTML = `<p class="muted">Loading network…</p>`;
  const N = await loadNetwork();
  const c = N && N.gi.get(gene.toUpperCase());
  if (c == null) { el.innerHTML = `<p class="muted">${esc(gene)} has no proximity partners in the atlas.</p>`; return; }
  const isBait = N.isBait.has(c);
  el.innerHTML = `<div class="toolbar">
      <label>Partners <select class="field" id="nMax"><option>15</option><option selected>30</option><option>50</option><option>100</option></select></label>
      <label>Show <select class="field" id="nFilter"><option value="all">all binding partners</option><option value="known">published support only</option><option value="high">high confidence only</option></select></label>
      <label>Role <select class="field" id="nDir"><option value="both">${esc(gene)} as bait and as binding protein</option><option value="bait"${isBait ? "" : " disabled"}>${esc(gene)} as bait</option><option value="prey">${esc(gene)} as binding protein</option></select></label>
      <label><input type="checkbox" id="nAmong" checked> links between partners</label>
      <span style="margin-left:auto"></span><button class="btn" id="nTsv">Edges (TSV)</button><button class="btn" id="nSvg">SVG</button></div>
    <div class="netwrap"><svg id="netsvg" viewBox="0 0 960 620" role="img" aria-label="Proximity network of ${esc(gene)}"></svg></div>
    <div class="netlegend small muted" id="nLegend"></div>`;
  const svg = $("#netsvg"), tip = $("#tooltip"), W = 960, H = 620;
  const col = (g) => { const k = N.compartment[g]; return k >= 0 ? COMP_COL[N.compartments[k]] : "#b4b2a9"; };
  const supCol = (e) => e[4] === 1 || e[4] === 2 ? "var(--ink2)" : e[4] === 3 ? "#2a78d6" : "var(--muted)";
  let cur = null;

  const draw = () => {
    const opts = { max: +$("#nMax").value, filter: $("#nFilter").value, dir: $("#nDir").value, among: $("#nAmong").checked };
    const net = egoNetwork(N, c, opts);
    // order partners by compartment so the initial circle groups colours
    const order = [0, ...net.ids.slice(1).map((g, i) => [g, i + 1]).sort((a, b) => (N.compartment[a[0]] - N.compartment[b[0]]) || (a[0] - b[0])).map((x) => x[1])];
    const remap = new Map(order.map((o, i) => [o, i]));
    const ids = order.map((o) => net.ids[o]);
    const links = net.links.map((l) => ({ ...l, s: remap.get(l.s), t: remap.get(l.t) }));
    const P = forceLayout(ids.length, links, W, H);
    cur = { ids, links, P };
    if (ids.length === 1) { svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="muted">No partners pass this filter.</text>`; }
    else render();
    $("#nLegend").innerHTML = `Showing ${num(ids.length - 1)} of ${num(net.total)} partners (ranked by best fused score, then number of comparisons, then log2FC) and ${num(links.filter((l) => !l.ego).length)} links between them.
      <br><b>Nodes</b>: colour = predicted compartment (grey = not on the map); square = bait in the atlas, circle = binding protein only. Click a node to open it; drag to move.
      <br><b>Lines</b>: dark = known physical or CORUM, blue = known by proximity labelling, grey dashed = novel; width = best fused score. Thin faint lines connect partners that bind each other.`;
  };

  const render = () => {
    const { ids, links, P } = cur;
    const R = (i) => i === 0 ? 15 : 7.5;
    let s = `<g class="links">`;
    links.forEach((l, li) => {
      const e = N.edges[l.k], w = l.ego ? 0.8 + 2.6 * Math.min(1, e[2] / 100) : 0.8;
      s += `<line data-l="${li}" x1="${P[l.s].x.toFixed(1)}" y1="${P[l.s].y.toFixed(1)}" x2="${P[l.t].x.toFixed(1)}" y2="${P[l.t].y.toFixed(1)}"
        stroke="${l.ego ? supCol(e) : "var(--muted)"}" stroke-width="${w.toFixed(2)}" stroke-opacity="${l.ego ? 0.8 : 0.28}"${l.ego && (e[4] === 5 || e[4] === 0) ? ` stroke-dasharray="4 3"` : ""}/>`;
    });
    s += `</g><g class="nodes">`;
    ids.forEach((g, i) => {
      const x = P[i].x, y = P[i].y, r = R(i), bait = N.isBait.has(g);
      const shape = bait ? `<rect x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${2 * r}" height="${2 * r}" rx="${i ? 2.5 : 5}"` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"`;
      s += `<g class="node${i === 0 ? " centre" : ""}" data-i="${i}">${shape} fill="${col(g)}" stroke="${i === 0 ? "var(--ink)" : "var(--surface)"}" stroke-width="${i === 0 ? 2.5 : 1.5}"/>
        <text x="${x.toFixed(1)}" y="${(y + r + 11).toFixed(1)}" text-anchor="middle"${i === 0 ? ' class="cl"' : ""}>${esc(N.genes[g])}</text></g>`;
    });
    svg.innerHTML = s + `</g>`;
  };

  const edgeInfo = (i) => {
    const { ids, links } = cur, g = ids[i];
    const l = links.find((x) => x.ego && (x.t === i || x.s === i));
    let t = `<b>${esc(N.genes[g])}</b>${N.isBait.has(g) ? ` <span class="muted">(bait)</span>` : ""}<br><span class="muted">${esc(N.compartment[g] >= 0 ? N.compartments[N.compartment[g]] : "not on the map")}</span>`;
    if (l && i !== 0) {
      const e = N.edges[l.k];
      t += `<br>${esc(N.genes[e[0]])} → ${esc(N.genes[e[1]])}: best fused ${(e[2] / 100).toFixed(2)}, max log2FC ${(e[7] / 10).toFixed(1)}, ${e[3]} comparison${e[3] > 1 ? "s" : ""}${e[5] ? ", high confidence" : ""}
        <br>${esc(NET_SUPPORT[e[4]])}${NET_CORE[e[6]] ? ` · ${NET_CORE[e[6]]}` : ""}`;
    }
    const k = links.filter((x) => !x.ego && (x.s === i || x.t === i)).length;
    if (i !== 0 && k) t += `<br><span class="muted">${k} link${k > 1 ? "s" : ""} to other partners</span>`;
    return t;
  };

  // hover, click, drag
  let drag = null, moved = false;
  const pt = (ev) => { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; };
  const hilite = (i) => {
    svg.classList.toggle("focus", i != null);
    svg.querySelectorAll(".node").forEach((n) => n.classList.remove("hi"));
    svg.querySelectorAll("line").forEach((ln) => ln.classList.remove("hi"));
    if (i == null) return;
    const nb = new Set([i]);
    cur.links.forEach((l, li) => { if (l.s === i || l.t === i) { nb.add(l.s); nb.add(l.t); svg.querySelector(`line[data-l="${li}"]`).classList.add("hi"); } });
    nb.forEach((j) => svg.querySelector(`.node[data-i="${j}"]`).classList.add("hi"));
  };
  svg.addEventListener("pointerdown", (ev) => {
    const n = ev.target.closest(".node"); if (!n) return;
    drag = +n.dataset.i; moved = false; svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (drag != null) {
      const p = pt(ev); cur.P[drag].x = Math.max(20, Math.min(W - 20, p.x)); cur.P[drag].y = Math.max(16, Math.min(H - 16, p.y));
      moved = true; render(); hilite(drag); tip.hidden = true; return;
    }
    const n = ev.target.closest(".node");
    if (!n) { hilite(null); tip.hidden = true; return; }
    const i = +n.dataset.i; hilite(i);
    tip.hidden = false; tip.innerHTML = edgeInfo(i);
    tip.style.left = ev.clientX + 14 + "px"; tip.style.top = ev.clientY + 10 + "px";
  });
  svg.addEventListener("pointerup", () => {
    const i = drag; drag = null;
    if (i != null && !moved && i !== 0) { tip.hidden = true; location.hash = `#/gene/${encodeURIComponent(N.genes[cur.ids[i]])}?tab=net`; }
  });
  svg.addEventListener("pointerleave", () => { if (drag == null) { hilite(null); tip.hidden = true; } });

  ["#nMax", "#nFilter", "#nDir", "#nAmong"].forEach((id) => $(id).addEventListener("change", draw));
  const save = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $("#nTsv").addEventListener("click", () => {
    const rows = ["bait\tbinding_protein\tbest_fused_score\tmax_log2FC\tn_comparisons\thigh_confidence\tsupport\tcore_class\tlink_type"];
    cur.links.forEach((l) => { const e = N.edges[l.k]; rows.push([N.genes[e[0]], N.genes[e[1]], (e[2] / 100).toFixed(2), (e[7] / 10).toFixed(1), e[3], e[5] ? "yes" : "no", NET_SUPPORT[e[4]], NET_CORE[e[6]], l.ego ? "to query" : "between partners"].join("\t")); });
    save(`${gene}_proximity_network.tsv`, rows.join("\n") + "\n", "text/tab-separated-values");
  });
  $("#nSvg").addEventListener("click", () => {
    const cs = getComputedStyle(document.documentElement);
    let x = svg.outerHTML.replace(/var\(--([a-z0-9]+)\)/g, (m, v) => cs.getPropertyValue(`--${v}`).trim() || "#888");
    x = x.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" font-size="10" `);
    save(`${gene}_proximity_network.svg`, x, "image/svg+xml");
  });
  draw();
}
