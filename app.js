/* Human Proximity Atlas — static single-page app (no external libraries).
   Data: data/index.json, data/bait/<GENE>.json, data/protein/<GENE>.json, data/map.json,
   data/neighbourhoods.json, data/studies.json (written by export_data.py). */
"use strict";

const COMP_COL = {
  "Mitochondrion": "#eb6834", "ER / nuclear envelope": "#1baf7a", "Golgi": "#e34948",
  "Endosome / lysosome / vesicle": "#e34948", "Plasma membrane / junction": "#eda100",
  "Cytoskeleton / centrosome": "#e87ba4", "Cytosol / RNA granules": "#6250d6", "Nucleolus": "#008300",
  "Nucleus": "#2a78d6", "No prediction (low specificity)": "#b4b2a9"
};
const GITHUB = "https://github.com/gucascau/ProxLabToolkit";
const $ = (s, el = document) => el.querySelector(s);
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = (g) => String(g).replace(/[^A-Za-z0-9._-]/g, "_");
const fmtP = (p) => p == null ? "" : (p === 0 ? "< 1e-16" : p < 1e-3 ? p.toExponential(1) : p.toFixed(3));
const fmt = (x, d = 2) => x == null ? "" : Number(x).toFixed(d);
const num = (n) => Number(n).toLocaleString("en-US");
const geneLink = (g) => `<a href="#/gene/${encodeURIComponent(g)}">${esc(g)}</a>`;
const compChip = (c) => c ? `<span class="chip"><span class="dot" style="background:${COMP_COL[c] || "#b4b2a9"}"></span>${esc(c)}</span>` : "";
const cache = {};
async function getJSON(path) {
  if (window.PRELOAD && path in window.PRELOAD) return window.PRELOAD[path];   // test snapshots only
  if (!(path in cache)) {
    cache[path] = fetch(path).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => null);
  }
  return cache[path];
}
let INDEX = null, GENESET = null;

/* ---------- theme ---------- */
(function initTheme() {
  try { const t = localStorage.getItem("hpa-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("hpa-theme", next); } catch (e) { /* ignore */ }
    if (location.hash.startsWith("#/map")) route();
  });
})();

/* ---------- search with suggestions ---------- */
function attachSearch(input, box) {
  let sel = -1, items = [];
  const render = () => {
    const q = input.value.trim().toUpperCase();
    if (!q || !INDEX) { box.classList.remove("open"); return; }
    const starts = [], has = [];
    for (const g of INDEX.genes) {
      const u = g[0].toUpperCase();
      if (u.startsWith(q)) starts.push(g); else if (u.includes(q)) has.push(g);
      if (starts.length > 40) break;
    }
    items = starts.concat(has).slice(0, 12);
    sel = -1;
    box.innerHTML = items.map((g, i) => `<div data-i="${i}"><span>${esc(g[0])}</span><span class="muted small">${g[1] ? "bait" : ""}${g[1] && g[2] ? " · " : ""}${g[2] ? g[4] + " baits" : ""}</span></div>`).join("")
      || `<div class="muted">No match</div>`;
    box.classList.add("open");
  };
  const go = (g) => { box.classList.remove("open"); input.value = ""; location.hash = `#/gene/${encodeURIComponent(g)}`; };
  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    const rows = [...box.querySelectorAll("div[data-i]")];
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, rows.length - 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); e.preventDefault(); }
    else if (e.key === "Enter") {
      const q = input.value.trim().toUpperCase();
      const exact = INDEX && INDEX.genes.find((g) => g[0].toUpperCase() === q);
      if (sel >= 0 && items[sel]) go(items[sel][0]); else if (exact) go(exact[0]); else if (items[0]) go(items[0][0]);
      return;
    } else if (e.key === "Escape") { box.classList.remove("open"); return; }
    rows.forEach((r, i) => r.classList.toggle("sel", i === sel));
  });
  box.addEventListener("mousedown", (e) => { const d = e.target.closest("div[data-i]"); if (d) go(items[+d.dataset.i][0]); });
  input.addEventListener("blur", () => setTimeout(() => box.classList.remove("open"), 150));
}

/* ---------- sortable, filterable, paged table ---------- */
function table(el, { columns, rows, pageSize = 50, filter = true, csvName = "table.csv", sort = null }) {
  let state = { q: "", page: 0, sortKey: sort ? sort[0] : null, dir: sort ? sort[1] : 1 };
  el.innerHTML = `<div class="toolbar">${filter ? `<input class="field" placeholder="Filter rows" style="width:200px">` : ""}
    <span class="muted small cnt"></span><button class="btn csv" style="margin-left:auto">Download CSV</button></div>
    <div class="tablewrap"><table><thead></thead><tbody></tbody></table></div><div class="pager"></div>`;
  const draw = () => {
    let r = rows;
    if (state.q) { const q = state.q.toLowerCase(); r = r.filter((row) => columns.some((c) => String(c.text ? c.text(row) : row[c.key] ?? "").toLowerCase().includes(q))); }
    if (state.sortKey != null) {
      const c = columns.find((x) => x.key === state.sortKey);
      const v = (row) => (c.sortv ? c.sortv(row) : row[c.key]);
      r = [...r].sort((a, b) => { const x = v(a), y = v(b); if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
    }
    const pages = Math.max(1, Math.ceil(r.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const view = r.slice(state.page * pageSize, (state.page + 1) * pageSize);
    $("thead", el).innerHTML = "<tr>" + columns.map((c) => `<th class="${c.num ? "num" : ""}" data-k="${c.key}" title="${esc(c.title || "")}">${esc(c.label)} <span class="arr">${state.sortKey === c.key ? (state.dir > 0 ? "▲" : "▼") : ""}</span></th>`).join("") + "</tr>";
    $("tbody", el).innerHTML = view.map((row) => "<tr>" + columns.map((c) => `<td class="${c.num ? "num" : ""}">${c.html ? c.html(row) : esc(row[c.key] ?? "")}</td>`).join("") + "</tr>").join("");
    $(".cnt", el).textContent = `${num(r.length)} rows`;
    $(".pager", el).innerHTML = pages > 1 ? `<button class="btn" data-p="-1">‹ Prev</button> page ${state.page + 1} / ${pages} <button class="btn" data-p="1">Next ›</button>` : "";
    el._filtered = r;
  };
  el.addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (th) { const k = th.dataset.k; state.dir = state.sortKey === k ? -state.dir : (columns.find((c) => c.key === k).num ? -1 : 1); state.sortKey = k; draw(); }
    const p = e.target.closest("[data-p]"); if (p) { state.page += +p.dataset.p; if (state.page < 0) state.page = 0; draw(); }
    if (e.target.closest(".csv")) {
      const lines = [columns.map((c) => c.label).join(",")].concat(el._filtered.map((row) => columns.map((c) => `"${String(c.text ? c.text(row) : row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")));
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = csvName; a.click();
    }
  });
  const f = $("input", el); if (f) f.addEventListener("input", () => { state.q = f.value; state.page = 0; draw(); });
  draw();
}

/* ---------- pages ---------- */
function setNav(h) { document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", h.startsWith(a.getAttribute("href")))); }

function home() {
  const s = INDEX.stats;
  $("#app").innerHTML = `<section class="hero">
    <h1>Human Proximity Atlas</h1>
    <p class="lead">A uniform reanalysis of public proximity-labelling proteomics (BioID, TurboID, APEX) with
    <a href="#/toolkit">ProxLabToolkit</a>: ${num(s.baits)} bait proteins, ${num(s.pairs)} bait–protein proximity pairs,
    and a proximity map that places ${num(s.assigned)} human proteins in subcellular neighbourhoods.</p>
    <div class="hero-search"><input id="heroSearch" type="search" placeholder="Search a bait or protein (e.g. VHL, LMNA, CCDC77)" autocomplete="off"><div class="suggest" id="heroSuggest"></div></div>
    <div class="examples small">Try: ${["VHL", "LMNA", "TARDBP", "CEP120", "CCDC77", "MFN2"].map(geneLink).join(" ")}</div></section>
    <div class="tiles">
      <div class="tile"><div class="v">${num(s.projects)}</div><div class="l">projects (ProteomeXchange)</div></div>
      <div class="tile"><div class="v">${num(s.comparisons)}</div><div class="l">bait-vs-control comparisons</div></div>
      <div class="tile"><div class="v">${num(s.baits)}</div><div class="l">bait proteins</div></div>
      <div class="tile"><div class="v">${num(s.proteins)}</div><div class="l">binding proteins</div></div>
      <div class="tile"><div class="v">${num(s.assigned)}</div><div class="l">proteins localized on the map</div></div>
    </div>
    <div class="grid4">
      <a class="card" href="#/map"><h3>Proximity map →</h3><p class="muted">Explore ${num(s.mapped)} proteins arranged by their proximity profiles across ${num(s.baits)} baits, coloured by predicted compartment.</p></a>
      <a class="card" href="#/neighbourhoods"><h3>Neighbourhoods →</h3><p class="muted">Twenty proximity neighbourhoods with marker proteins, baits and disease-gene enrichment.</p></a>
      <a class="card" href="#/studies"><h3>Studies →</h3><p class="muted">The ${num(s.projects)} reanalysed projects with technology, cell line and reliability tier.</p></a>
      <a class="card" href="#/toolkit"><h3>ProxLabToolkit →</h3><p class="muted">The consensus statistical framework used to score every comparison. Open source.</p></a>
    </div>
    <h2>Explore the cell</h2>
    <p class="muted small" style="margin-top:-4px">Hover over a structure to see its proximity neighbourhood; click to open it.</p>
    <div id="homecell"></div>
    <h2>About this atlas</h2>
    <div class="card"><p class="small">Published proximity-labelling studies differ in search software, statistics, controls and thresholds, so their
      results cannot be compared directly. We collected human label-free datasets from ProteomeXchange, processed every raw file with the same
      FragPipe workflow, matched each bait to appropriate controls and scored all comparisons with ProxLabToolkit, which combines six
      differential-abundance methods with a spectral-count model into one consensus result.</p>
      <p class="small">Because each protein is captured by many baits, the collection also forms a proximity map: non-negative matrix factorisation
      resolves 20 subcellular neighbourhoods and assigns ${num(s.assigned)} proteins to a compartment (${num(s.confident)} with high or medium
      confidence), including proteins with no UniProt localisation. Disease genes concentrate in specific neighbourhoods, and the map ranks
      candidate disease genes from their proximity neighbours.</p></div>`;
  attachSearch($("#heroSearch"), $("#heroSuggest"));
  getJSON("data/neighbourhoods.json").then((nb) => { const el = $("#homecell"); if (nb && el) { el.innerHTML = cellFigure(nb, { list: true }); attachCell(el, nb); } });
}

async function genePage(gene, tab) {
  const entry = GENESET.get(gene.toUpperCase());
  if (!entry) { $("#app").innerHTML = `<h1>${esc(gene)}</h1><p class="muted">Not found in the atlas (not a bait or binding protein).</p>`; return; }
  const g = entry[0];
  const [bait, prot] = await Promise.all([entry[1] ? getJSON(`data/bait/${safe(g)}.json`) : null,
                                          entry[2] ? getJSON(`data/protein/${safe(g)}.json`) : null]);
  const info = bait || prot;
  const m = prot && prot.map;
  $("#app").innerHTML = `<h1 style="margin-top:22px">${esc(g)}</h1>
    <div class="muted">${esc(info.name || "")}</div>
    <div style="margin-top:6px">${info.uniprot ? `<a class="chip" href="https://www.uniprot.org/uniprotkb/${esc(info.uniprot)}" target="_blank" rel="noopener">UniProt ${esc(info.uniprot)}</a>` : ""}
      ${info.function ? `<span class="chip">${esc(info.function)}</span>` : ""}${m ? compChip(m.compartment) : ""}
      ${bait ? `<span class="badge high">bait · ${bait.comparisons.length} comparison${bait.comparisons.length > 1 ? "s" : ""}</span>` : ""}
      ${prot ? `<span class="badge">bound by ${new Set(prot.rows.map((r) => r[0])).size} baits</span>` : ""}</div>
    <div class="tabs">${bait ? `<button data-t="bait">As bait</button>` : ""}${prot ? `<button data-t="prot">As binding protein</button>` : ""}<button data-t="net">Network</button></div>
    <div id="tab"></div>`;
  const show = (t) => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    $("#tooltip").hidden = true;
    if (t === "bait") baitTab(bait); else if (t === "net") networkTab(g); else protTab(prot);
  };
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.t)));
  show(tab === "net" ? "net" : tab === "prot" && prot ? "prot" : bait ? "bait" : "prot");
}

function baitTab(b) {
  const el = $("#tab");
  const comps = b.comparisons;
  el.innerHTML = `<div class="grid2"><div class="card"><h3>Bait</h3><dl class="kv">
      <dt>Function class</dt><dd>${esc(b.function || "–")}</dd><dt>UniProt location</dt><dd>${esc(b.location || "–")}</dd>
      <dt>Comparisons</dt><dd>${comps.length} (${new Set(comps.map((c) => c.pxd)).size} project${new Set(comps.map((c) => c.pxd)).size > 1 ? "s" : ""})</dd>
      <dt>Binding proteins</dt><dd>${num(new Set(b.rows.map((r) => r[0])).size)} unique</dd></dl></div>
      <div class="card"><h3>How to read this</h3><p class="small muted">Binding = consensus adjusted P ≤ 0.05 and log2 fold change &gt; 0.25 against matched controls (ProxLabToolkit).
      Fused score: dual-branch (spectral count × intensity) confidence, 0–1. Support: best published evidence (BioGRID, BioPlex, CORUM, HuRI, IntAct, Human Cell Map).
      ${b.core_assessed ? "Core: bound in ≥ 80% of this bait's comparisons where quantified." : ""}</p></div></div>
    <h2>Binding proteins</h2><div class="toolbar"><label>Comparison <select class="field" id="csel"><option value="-1">All comparisons (best per protein)</option>
      ${comps.map((c, i) => `<option value="${i}">${esc(c.condition)} · ${esc(c.pxd)}${c.representative ? " (representative)" : ""}</option>`).join("")}</select></label>
      <label><input type="checkbox" id="bg"> show biotin carboxylases</label></div><div id="itab"></div>
    ${comps.length > 1 ? `<h2>Across comparisons</h2><p class="small muted">Proteins bound in the most comparisons (colour: log2 fold change; grey: not called binding).</p><div class="heat card" id="heat"></div>` : ""}
    <h2>Comparisons</h2><div id="ctab"></div>`;
  table($("#ctab"), {
    rows: comps, pageSize: 20, filter: comps.length > 10, csvName: `${b.gene}_comparisons.csv`, columns: [
      { key: "condition", label: "Bait condition" },
      { key: "pxd", label: "Project", html: (r) => `<a href="#/studies?q=${esc(r.pxd)}">${esc(r.pxd)}</a>` },
      { key: "technology", label: "Technology" }, { key: "cell_line", label: "Cell line" },
      { key: "controls", label: "Controls", html: (r) => `<span title="${esc(r.controls)}" style="display:inline-block;max-width:260px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom">${esc((r.controls || "").replace(/;/g, "; "))}</span>` }, { key: "n_bait", label: "Bait / ctrl runs", html: (r) => `${r.n_bait} / ${r.n_ctrl}`, num: true },
      { key: "n_binding", label: "Binding", num: true }, { key: "bait_rank", label: "Bait rank", num: true, title: "rank of the bait among its own enriched proteins" },
      { key: "tier", label: "Tier", num: true, title: "project reliability tier (1 = best)" }]
  });
  const draw = () => {
    const ci = +$("#csel").value, showBg = $("#bg").checked;
    let rows = b.rows.filter((r) => showBg || !r[7]);
    const nComp = {};
    b.rows.forEach((r) => { nComp[r[0]] = (nComp[r[0]] || 0) + 1; });
    if (ci >= 0) rows = rows.filter((r) => r[1] === ci);
    else { const best = {}; rows.forEach((r) => { if (!best[r[0]] || (r[4] ?? 0) > (best[r[0]][4] ?? 0)) best[r[0]] = r; }); rows = Object.values(best); }
    table($("#itab"), {
      rows, csvName: `${b.gene}_binding_proteins.csv`, sort: ["fused", -1], columns: [
        { key: 0, label: "Protein", html: (r) => geneLink(r[0]), text: (r) => r[0] },
        { key: "lfc", label: "log2FC", num: true, sortv: (r) => r[2], html: (r) => fmt(r[2]), text: (r) => r[2] },
        { key: "p", label: "adj. P", num: true, sortv: (r) => r[3], html: (r) => fmtP(r[3]), text: (r) => r[3] },
        { key: "fused", label: "Fused score", num: true, sortv: (r) => r[4], html: (r) => fmt(r[4]), text: (r) => r[4] },
        { key: "conf", label: "Confidence", sortv: (r) => r[5], html: (r) => r[5] ? `<span class="badge ${r[5] === "High" ? "high" : ""}">${esc(r[5])}</span>` : "", text: (r) => r[5] },
        { key: "ev", label: "Evidence", sortv: (r) => r[6], text: (r) => r[6], html: (r) => esc(r[6] || "") },
        { key: "nc", label: "# comparisons", num: true, sortv: (r) => nComp[r[0]], text: (r) => nComp[r[0]], html: (r) => `${nComp[r[0]]}/${comps.length}` },
        { key: "sup", label: "Published support", sortv: (r) => (b.info[r[0]] || [])[0], text: (r) => (b.info[r[0]] || [])[0], html: (r) => esc(((b.info[r[0]] || [])[0] || "").replace(/^\d /, "")) },
        ...(b.core_assessed ? [{ key: "core", label: "Core / periphery", sortv: (r) => (b.info[r[0]] || [])[2], text: (r) => (b.info[r[0]] || [])[2], html: (r) => esc((b.info[r[0]] || [])[2] || "") }] : [])]
    });
  };
  $("#csel").addEventListener("change", draw); $("#bg").addEventListener("change", draw); draw();
  if (comps.length > 1) heatmap($("#heat"), b);
}

function heatmap(el, b) {
  const comps = b.comparisons, cnt = {}, val = {};
  b.rows.forEach((r) => { if (r[7]) return; cnt[r[0]] = (cnt[r[0]] || 0) + 1; val[r[0] + "|" + r[1]] = r[2]; });
  const preys = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a]).slice(0, 60);
  const cw = 13, ch = 14, left = 210, top = 70;
  const W = left + preys.length * cw + 20, H = top + comps.length * ch + 10;
  const blue = (v) => { const t = Math.max(0, Math.min(1, (v - 0.25) / 5)); const a = [214, 228, 245], z = [24, 79, 149]; return `rgb(${a.map((x, i) => Math.round(x + (z[i] - x) * t)).join(",")})`; };
  let svg = `<svg width="${W}" height="${H}" role="img" aria-label="binding across comparisons">`;
  preys.forEach((p, j) => { svg += `<text transform="translate(${left + j * cw + 9},${top - 4}) rotate(-60)">${esc(p)}</text>`; });
  comps.forEach((c, i) => {
    svg += `<text x="${left - 6}" y="${top + i * ch + 10}" text-anchor="end">${esc((c.condition || "").slice(0, 26))} · ${esc(c.pxd)}</text>`;
    preys.forEach((p, j) => {
      const v = val[p + "|" + i];
      svg += `<rect x="${left + j * cw}" y="${top + i * ch}" width="${cw - 1}" height="${ch - 1}" rx="2" fill="${v == null ? "var(--surface2)" : blue(v)}"><title>${esc(p)} · ${esc(c.condition)}: ${v == null ? "not binding" : "log2FC " + fmt(v)}</title></rect>`;
    });
  });
  el.innerHTML = svg + "</svg>";
}

function protTab(p) {
  const el = $("#tab"), m = p.map;
  const nb = m && m.neighbours ? m.neighbours.split(", ") : [];
  el.innerHTML = `<div class="grid2">
    <div class="card"><h3>Proximity-map prediction</h3>${m ? `<dl class="kv">
      <dt>Compartment</dt><dd>${compChip(m.compartment)}</dd>
      <dt>Neighbourhood</dt><dd><a href="#/neighbourhoods?c=${m.component}">${m.component} · ${esc(m.neighbourhood)}</a></dd>
      <dt>Confidence</dt><dd><span class="badge ${m.confidence === "High" ? "high" : ""}">${esc(m.confidence)}</span> <span class="small muted">score ${fmt(m.score)} · reproduced in ${Math.round((m.reproducibility || 0) * 100)}% of refits</span></dd>
      <dt>Runner-up</dt><dd class="small">${esc(m.second || "")} (${fmt(m.second_score)})</dd>
      <dt>Evidence</dt><dd class="small">bound by ${m.n_baits} baits from ${m.n_projects ?? "?"} projects</dd>
      ${m.neighbour_function ? `<dt>Neighbours suggest</dt><dd class="small">${esc(m.neighbour_function)}</dd>` : ""}
      ${m.poorly || m.no_uniprot_location ? `<dt>Note</dt><dd class="small">${m.poorly ? "poorly characterised" : ""}${m.poorly && m.no_uniprot_location ? "; " : ""}${m.no_uniprot_location ? "no UniProt subcellular location" : ""}</dd>` : ""}
      </dl>` : `<p class="muted small">Bound by fewer than two baits, so not placed on the proximity map.</p>`}
      <canvas id="mini" style="width:100%;height:220px;margin-top:10px;${m ? "" : "display:none"}"></canvas>
      ${m && m.component && m.component !== 6 && m.component !== 19 ? `<div id="protcell" style="margin-top:10px"></div>` : ""}</div>
    <div class="card"><h3>Reference annotations</h3><dl class="kv">
      <dt>UniProt</dt><dd class="small">${esc((m && m.uniprot) || p.location || "–")}</dd>
      <dt>Human Protein Atlas</dt><dd class="small">${esc((m && m.hpa) || "–")} ${m && m.hpa_reliability ? `<span class="muted">(${esc(m.hpa_reliability)})</span>` : ""}</dd>
      <dt>Human Cell Map</dt><dd class="small">${esc((m && m.hcm) || "–")}</dd></dl>
      ${nb.length ? `<h3>Nearest neighbours on the map</h3><div>${nb.map((g) => `<a class="chip" href="#/gene/${encodeURIComponent(g)}">${esc(g)}</a>`).join("")}</div>` : ""}
      ${(p.disease_sets = p.disease_sets.filter((x) => !x.endsWith("All GWAS genes"))).length || p.candidate.length ? `<h3>Disease</h3>
        ${p.disease_sets.length ? `<div class="small">${p.disease_sets.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
        ${p.candidate.length ? `<div class="small" style="margin-top:6px">Candidate (top 1% by map neighbours): ${p.candidate.map((c) => `<span class="chip">${esc(c.set)} · rank ${c.rank}${c.novel === false ? " · shares CORUM complex" : ""}</span>`).join("")}</div>` : ""}` : ""}
    </div></div>
    <h2>Baits that bind ${esc(p.gene)}</h2><div id="btab"></div>`;
  table($("#btab"), {
    rows: p.rows, csvName: `${p.gene}_baits.csv`, sort: ["fused", -1], columns: [
      { key: 0, label: "Bait", html: (r) => geneLink(r[0]), text: (r) => r[0] },
      { key: "cmp", label: "Comparison", sortv: (r) => r[1], text: (r) => r[1], html: (r) => `<span class="small">${esc(r[1].split("|").slice(1).join(" · "))}</span>` },
      { key: "lfc", label: "log2FC", num: true, sortv: (r) => r[2], html: (r) => fmt(r[2]), text: (r) => r[2] },
      { key: "p", label: "adj. P", num: true, sortv: (r) => r[3], html: (r) => fmtP(r[3]), text: (r) => r[3] },
      { key: "fused", label: "Fused score", num: true, sortv: (r) => r[4], html: (r) => fmt(r[4]), text: (r) => r[4] },
      { key: "conf", label: "Confidence", sortv: (r) => r[5], text: (r) => r[5], html: (r) => r[5] ? `<span class="badge ${r[5] === "High" ? "high" : ""}">${esc(r[5])}</span>` : "" },
      { key: "sup", label: "Published support", sortv: (r) => r[6], text: (r) => r[6], html: (r) => esc((r[6] || "").replace(/^\d /, "")) }]
  });
  if (m) getJSON("data/map.json").then((mp) => mp && drawMap($("#mini"), mp, { highlight: p.gene, mini: true }));
  if ($("#protcell")) getJSON("data/neighbourhoods.json").then((nb) => {
    if (!nb) return;
    $("#protcell").innerHTML = cellFigure(nb, { compact: true, selected: String(m.component) });
    attachCell($("#protcell"), nb);
  });
}

/* ---------- proximity map (canvas) ---------- */
function drawMap(canvas, mp, opt = {}) {
  const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const xs = mp.x, ys = mp.y, n = xs.length, pad = 14;
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const sc = Math.min((rect.width - 2 * pad) / (maxx - minx), (rect.height - 2 * pad) / (maxy - miny));
  const ox = (rect.width - (maxx - minx) * sc) / 2, oy = (rect.height - (maxy - miny) * sc) / 2;
  const X = (i) => ox + (xs[i] - minx) * sc, Y = (i) => oy + (maxy - ys[i]) * sc;
  const off = opt.off || new Set(), confMax = opt.confMax ?? 3, hi = opt.highlight ? new Set([].concat(opt.highlight)) : null;
  ctx.clearRect(0, 0, rect.width, rect.height);
  const order = [...Array(n).keys()].sort((a, b) => mp.confidence[b] - mp.confidence[a]);
  for (const i of order) {
    const c = mp.compartments[mp.compartment[i]];
    const visible = !off.has(c) && mp.confidence[i] <= confMax;
    ctx.globalAlpha = hi ? 0.18 : (visible ? (mp.confidence[i] <= 1 ? 0.85 : 0.4) : 0.06);
    ctx.fillStyle = COMP_COL[c] || "#b4b2a9";
    const r = opt.mini ? 1.3 : (mp.confidence[i] <= 1 ? 2.1 : 1.5);
    ctx.beginPath(); ctx.arc(X(i), Y(i), r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!opt.mini && !hi) {
    const med = {};
    for (let i = 0; i < n; i++) { (med[mp.component[i]] = med[mp.component[i]] || []).push(i); }
    ctx.font = "600 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    for (const [k, idx] of Object.entries(med)) {
      const mx = idx.map(X).sort((a, b) => a - b)[idx.length >> 1], my = idx.map(Y).sort((a, b) => a - b)[idx.length >> 1];
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(); ctx.globalAlpha = 0.8;
      ctx.fillRect(mx - 9, my - 7, 18, 14); ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.fillText(k, mx, my);
    }
  }
  if (hi) {
    for (let i = 0; i < n; i++) if (hi.has(mp.genes[i])) {
      ctx.fillStyle = COMP_COL[mp.compartments[mp.compartment[i]]] || "#000";
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(i), Y(i), opt.mini ? 5 : 6, 0, 6.283); ctx.fill(); ctx.stroke();
    }
  }
  canvas._pts = { X, Y, n };
}

async function mapPage(query) {
  const mp = await getJSON("data/map.json");
  if (!mp) { $("#app").innerHTML = "<p>Map data not found.</p>"; return; }
  const comps = [...new Set(mp.compartments.map((c) => c.replace(/^(Golgi|Endosome \/ lysosome \/ vesicle)$/, "Golgi / endolysosome")))];
  const counts = {}; mp.compartment.forEach((k) => { const c = mp.compartments[k]; counts[c] = (counts[c] || 0) + 1; });
  $("#app").innerHTML = `<h1 style="margin-top:22px">Proximity map</h1>
    <p class="muted">${num(mp.genes.length)} proteins bound by ≥ 2 baits, arranged by t-SNE of their NMF neighbourhood profiles (k = 20). Numbers mark neighbourhoods. Hover for details, click to open a protein.</p>
    <div class="mapwrap"><div class="mapcanvas"><canvas id="map"></canvas></div>
    <div><div class="card legend"><h3>Compartments</h3><div id="leg"></div>
      <h3>Confidence</h3><select class="field" id="conf"><option value="3">All proteins</option><option value="2">High + Medium + Low</option><option value="1">High + Medium</option><option value="0">High only</option></select>
      <h3>Highlight</h3><input class="field" id="hl" placeholder="genes, comma-separated" style="width:100%"><p class="small muted" style="margin:6px 0 0">e.g. ${esc("CEP290, OFD1, CCDC77")}</p></div></div></div>`;
  const off = new Set();
  const legendItems = [
    ["Mitochondrion"], ["ER / nuclear envelope"], ["Golgi", "Endosome / lysosome / vesicle"], ["Plasma membrane / junction"],
    ["Cytoskeleton / centrosome"], ["Cytosol / RNA granules"], ["Nucleolus"], ["Nucleus"], ["No prediction (low specificity)"]];
  $("#leg").innerHTML = legendItems.map((g, i) => `<div class="row" data-i="${i}"><span class="dot" style="background:${COMP_COL[g[0]]}"></span>${esc(g.length > 1 ? "Golgi / endolysosome" : g[0])} <span class="muted small" style="margin-left:auto">${num(g.reduce((a, c) => a + (counts[c] || 0), 0))}</span></div>`).join("");
  const canvas = $("#map");
  const redraw = () => {
    const hl = $("#hl").value.split(/[\s,;]+/).filter(Boolean).map((x) => x.toUpperCase());
    const hiGenes = hl.length ? mp.genes.filter((g) => hl.includes(g.toUpperCase())) : null;
    drawMap(canvas, mp, { off, confMax: +$("#conf").value, highlight: hiGenes && hiGenes.length ? hiGenes : null });
  };
  $("#leg").addEventListener("click", (e) => {
    const row = e.target.closest(".row"); if (!row) return;
    legendItems[+row.dataset.i].forEach((c) => (off.has(c) ? off.delete(c) : off.add(c)));
    row.classList.toggle("off"); redraw();
  });
  $("#conf").addEventListener("change", redraw);
  $("#hl").addEventListener("input", redraw);
  if (query.get("hl")) $("#hl").value = query.get("hl");
  redraw();
  const tip = $("#tooltip");
  const nearest = (ev) => {
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, P = canvas._pts;
    let best = -1, bd = 64;
    for (let i = 0; i < P.n; i++) { const dx = P.X(i) - x, dy = P.Y(i) - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  canvas.addEventListener("mousemove", (ev) => {
    const i = nearest(ev);
    if (i < 0) { tip.hidden = true; return; }
    tip.hidden = false; tip.style.left = ev.clientX + 14 + "px"; tip.style.top = ev.clientY + 10 + "px";
    tip.innerHTML = `<b>${esc(mp.genes[i])}</b><br>${esc(mp.compartments[mp.compartment[i]])}<br><span class="muted">neighbourhood ${mp.component[i]} · ${esc(INDEX.neighbourhoods[mp.component[i]] || "")}<br>${esc(mp.confidences[mp.confidence[i]])} confidence</span>`;
  });
  canvas.addEventListener("mouseleave", () => { tip.hidden = true; });
  canvas.addEventListener("click", (ev) => { const i = nearest(ev); if (i >= 0) { tip.hidden = true; location.hash = `#/gene/${encodeURIComponent(mp.genes[i])}`; } });
  window.onresize = () => { if (location.hash.startsWith("#/map")) redraw(); };
}

async function neighbourhoodsPage(query) {
  const nb = await getJSON("data/neighbourhoods.json");
  const focus = +query.get("c");
  $("#app").innerHTML = `<h1 style="margin-top:22px">Proximity neighbourhoods</h1>
    <p class="muted">Twenty NMF components of the proximity map. Compartment: most enriched UniProt class; disease: gene sets significantly enriched (BH ≤ 0.05, robust to bait-count and annotation bias).</p>
    <div id="cellbox" style="margin:14px 0 22px">${cellFigure(nb, { list: true, selected: focus || "" })}</div>
    <div class="grid2" id="nbgrid"></div>`;
  attachCell($("#cellbox"), nb);
  $("#nbgrid").innerHTML = nb.map((c) => `<div class="card" id="nb${c.component}" style="${focus === c.component ? "outline:2px solid var(--brand)" : ""}">
    <h3>${c.component} · ${esc(c.name)}</h3><div>${compChip(c.compartment)}<span class="badge">${num(c.n)} proteins</span>
    <a class="badge" href="#/map?hl=${encodeURIComponent((c.top_proteins || "").split(", ").slice(0, 6).join(","))}">show on map</a></div>
    <p class="small"><span class="muted">Top GO terms:</span> ${esc([c.go, c.go2, c.go3].filter(Boolean).join("; "))}</p>
    <p class="small"><span class="muted">Top proteins:</span> ${(c.top_proteins || "").split(", ").map(geneLink).join(", ")}</p>
    <p class="small"><span class="muted">Top baits:</span> ${(c.top_baits || "").split(", ").map(geneLink).join(", ")}</p>
    ${(c.disease = c.disease.filter((d) => d.set !== "All GWAS genes")).length ? `<p class="small"><span class="muted">Disease enrichment:</span> ${c.disease.slice(0, 6).map((d) => `<span class="chip">${esc(d.set)} · OR ${fmt(d.odds_ratio, 1)}</span>`).join("")}</p>` : ""}
  </div>`).join("");
  if (focus) { const el = $(`#nb${focus}`); if (el) el.scrollIntoView({ block: "center" }); }
}

async function studiesPage(query) {
  const st = await getJSON("data/studies.json");
  $("#app").innerHTML = `<h1 style="margin-top:22px">Studies</h1>
    <p class="muted">Public proximity-labelling projects reanalysed uniformly (FragPipe → ProxLabToolkit). Only quality-passing comparisons are included.
    Reliability tier: 1 = concordant with the original analysis or strong published support.</p><div id="stab"></div>`;
  const repoLink = (r) => r.repository === "MassIVE" && r.massive ? `https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=${r.massive}` : `https://www.ebi.ac.uk/pride/archive/projects/${r.pxd}`;
  table($("#stab"), {
    rows: st, pageSize: 100, csvName: "HPA_studies.csv", sort: ["comparisons", -1], columns: [
      { key: "pxd", label: "Project", html: (r) => `<a href="${repoLink(r)}" target="_blank" rel="noopener">${esc(r.pxd)}</a>` },
      { key: "pmid", label: "PubMed", html: (r) => r.pmid ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${esc(r.pmid)}" target="_blank" rel="noopener">${esc(r.pmid)}</a>` : "" },
      { key: "technology", label: "Technology" }, { key: "cell_line", label: "Cell line" },
      { key: "comparisons", label: "Comparisons", num: true }, { key: "baits", label: "Baits", num: true },
      { key: "pairs", label: "Binding pairs", num: true, html: (r) => num(r.pairs) }, { key: "tier", label: "Tier", num: true },
      { key: "bait_genes", label: "Bait genes", html: (r) => `<span class="small">${(r.bait_genes || "").split(",").slice(0, 8).map(geneLink).join(", ")}${(r.bait_genes || "").split(",").length > 8 ? " …" : ""}</span>`, text: (r) => r.bait_genes }]
  });
  if (query.get("q")) { const f = $("#stab input"); f.value = query.get("q"); f.dispatchEvent(new Event("input")); }
}

function downloadsPage() {
  const files = [
    ["HPA_binding_pairs.tsv.gz", "All bait–protein binding pairs per comparison: log2FC, P, adjusted P, fused score, confidence, evidence, published support."],
    ["HPA_comparisons.tsv.gz", "The bait-vs-control comparisons: project, technology, bait and control samples, QC."],
    ["HPA_localization_predictions.tsv.gz", "Proximity-map predictions for 7,133 proteins: neighbourhood, compartment, confidence, reproducibility, neighbours, reference annotations."],
    ["HPA_neighbourhoods.tsv", "The 20 proximity neighbourhoods (NMF components) with top GO terms, proteins and baits."],
    ["HPA_studies.tsv", "Reanalysed projects with metadata, QC and reliability tier."],
    ["HPA_disease_enrichment.tsv.gz", "Disease gene-set enrichment per neighbourhood (OMIM, ClinVar, GWAS Catalog, COSMIC CGC, IntOGen)."],
    ["HPA_disease_candidates.tsv.gz", "Candidate disease genes ranked by proximity-map neighbours, with CORUM novelty flags."]];
  $("#app").innerHTML = `<h1 style="margin-top:22px">Downloads</h1>
    <p class="muted">Tab-separated tables (version ${esc(INDEX.stats.version)}). Binding: consensus adjusted P ≤ 0.05 and log2FC &gt; 0.25.</p>
    <div class="tablewrap"><table><thead><tr><th>File</th><th>Contents</th></tr></thead><tbody>
    ${files.map((f) => `<tr><td><a href="downloads/${f[0]}" download>${f[0]}</a></td><td style="white-space:normal">${esc(f[1])}</td></tr>`).join("")}</tbody></table></div>
    <p class="note" style="margin-top:16px">Raw data: the original ProteomeXchange projects (see <a href="#/studies">Studies</a>). Processing code: <a href="${GITHUB}" target="_blank" rel="noopener">ProxLabToolkit on GitHub</a>.</p>`;
}

function toolkitPage() {
  $("#app").innerHTML = `<h1 style="margin-top:22px">ProxLabToolkit</h1>
    <p class="lead">A consensus statistical framework for proximity-labelling proteomics. Every comparison in this atlas was scored with it.</p>
    <div class="grid2"><div class="card"><h3>What it does</h3><ul class="small">
      <li>Six differential-abundance methods on the same intensities (Limma, ROTS, DEP, proDA, DEqMS, MSstats)</li>
      <li>Correlation-corrected Fisher combination into one consensus P value per protein</li>
      <li>A spectral-count branch fused with the intensity branch into a 0–1 confidence score</li>
      <li>Quality control: bait self-enrichment, over-calling, endogenously biotinylated carboxylases flagged</li></ul></div>
    <div class="card"><h3>Get it</h3><p class="small">Source code, installation and tutorial:</p>
      <p><a class="btn" href="${GITHUB}" target="_blank" rel="noopener">github.com/gucascau/ProxLabToolkit</a></p>
      <p class="small muted">Input: FragPipe outputs (combined_protein, PSM tables, MSstats export) and a sample annotation.</p></div></div>`;
}

function aboutPage() {
  const s = INDEX.stats;
  $("#app").innerHTML = `<h1 style="margin-top:22px">About</h1>
    <div class="grid2"><div class="card"><h3>The atlas</h3><p class="small">We collected human label-free DDA proximity-labelling datasets from ProteomeXchange, processed all raw files with one FragPipe workflow,
      annotated baits and matched controls, and scored ${num(s.comparisons)} bait-vs-control comparisons with ProxLabToolkit. After quality control the atlas covers
      ${num(s.projects)} projects, ${num(s.baits)} baits and ${num(s.pairs)} binding pairs.</p>
      <p class="small">The proximity map decomposes the protein × bait matrix by non-negative matrix factorisation into 20 neighbourhoods and assigns ${num(s.assigned)} proteins
      to a compartment (${num(s.confident)} with high or medium confidence), validated against UniProt, the Human Protein Atlas and the Human Cell Map.</p></div>
    <div class="card"><h3>How to cite</h3><p class="small">Human Proximity Atlas, version ${esc(s.version)}. Manuscript in preparation.</p>
      <p class="small muted">Please also cite the original studies whose data you use (PubMed links on the Studies page).</p>
      <h3>Contact</h3><p class="small">Questions and corrections: open an issue on <a href="${GITHUB}/issues" target="_blank" rel="noopener">GitHub</a>.</p></div></div>`;
}

/* ---------- router ---------- */
async function route() {
  const h = location.hash || "#/";
  const [path, qs] = h.slice(1).split("?");
  const query = new URLSearchParams(qs || "");
  setNav(h);
  $("#tooltip").hidden = true;
  window.onresize = null;
  const parts = path.split("/").filter(Boolean);
  window.scrollTo(0, 0);
  if (!parts.length) home();
  else if (parts[0] === "gene" && parts[1]) await genePage(decodeURIComponent(parts[1]), query.get("tab"));
  else if (parts[0] === "map") await mapPage(query);
  else if (parts[0] === "neighbourhoods") await neighbourhoodsPage(query);
  else if (parts[0] === "studies") await studiesPage(query);
  else if (parts[0] === "downloads") downloadsPage();
  else if (parts[0] === "toolkit") toolkitPage();
  else if (parts[0] === "about") aboutPage();
  else home();
  document.title = parts[0] === "gene" && parts[1] ? `${decodeURIComponent(parts[1])} · Human Proximity Atlas` : "Human Proximity Atlas";
}

(async function start() {
  INDEX = await getJSON("data/index.json");
  if (!INDEX) { $("#app").innerHTML = `<p>Could not load data/index.json. Serve this folder over HTTP (e.g. <span class="mono">python3 -m http.server</span>).</p>`; return; }
  GENESET = new Map(INDEX.genes.map((g) => [g[0].toUpperCase(), g]));
  $("#ver").textContent = `v${INDEX.stats.version.split(" ")[0]}`;
  attachSearch($("#topSearch"), $("#topSuggest"));
  window.addEventListener("hashchange", route);
  route();
})();
