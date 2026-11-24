#!/usr/bin/env node
// Renders every docs/*.md into a self-contained HTML companion (docs/<name>.html)
// using the html-decks vertical-scroll design-document style (light default, dark toggle,
// auto-hide middle-left contents menu, inline SVG diagrams).
//
//   node docs/build-html.mjs                  build all pages, validate numbers and links
//   node docs/build-html.mjs --apply-numbers  first rewrite every <!-- num:key --> value in
//                                             README.md and docs/*.md from docs/_numbers.json
//
// Diagrams: a line `<!-- diagram:name -->` in markdown is replaced by the SVG from DIAGRAMS.
// Chart values are read from docs/_numbers.json, so they follow a model promotion.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DOCS, "..");
const NUM_RE = /<!-- num:([\w.\-]+) -->([\s\S]*?)<!-- \/num -->/g;
const numbers = JSON.parse(readFileSync(join(DOCS, "_numbers.json"), "utf8"));
const warnings = [];
const warn = (m) => warnings.push(m);

// Page order and short titles for navigation.
const PAGES = [
  ["index", "Overview"],
  ["quickstart", "Quickstart"],
  ["integrations", "Integrations"],
  ["deployment", "Deploy"],
  ["concepts", "Concepts"],
  ["use-cases", "50 use cases"],
  ["api-reference", "API reference"],
  ["help-guide", "Help guide"],
  ["faq", "FAQ"],
  ["benchmarks", "Benchmarks"],
  ["token-savings", "Token savings"],
  ["comparison", "Comparison"],
  ["why-keel", "Why Keel"],
  ["model-card", "Model card"],
  ["keel-pro", "Keel-Pro story"],
  ["architecture", "Architecture"],
  ["design-doc", "Design doc"],
  ["training-guide", "Training guide"],
  ["release-notes", "Release notes"],
  ["licenses", "Licenses"],
  ["press", "Press kit"],
];
const GROUPS = [
  ["Get started", ["index", "quickstart", "integrations", "deployment", "concepts", "use-cases"]],
  ["Reference", ["api-reference", "help-guide", "faq"]],
  ["Evidence", ["benchmarks", "token-savings", "comparison", "why-keel", "model-card", "keel-pro"]],
  ["Internals", ["architecture", "design-doc", "training-guide", "release-notes", "licenses", "press"]],
];

// ---------- numbers ----------
if (process.argv.includes("--apply-numbers")) {
  const files = [join(ROOT, "README.md"), ...mdFiles().map((f) => join(DOCS, f))];
  for (const f of files) {
    const before = readFileSync(f, "utf8");
    const after = before.replace(NUM_RE, (m, k, v) => (numbers[k] ? `<!-- num:${k} -->${numbers[k].value}<!-- /num -->` : m));
    if (after !== before) { writeFileSync(f, after, "utf8"); console.log(`numbers applied: ${f}`); }
  }
}
const nv = (k) => {
  if (!numbers[k]) { warn(`diagram uses unknown number key ${k}`); return "?"; }
  return numbers[k].value;
};
const nn = (k) => parseFloat(String(nv(k)).replace(/,/g, "")) || 0;

function mdFiles() {
  return readdirSync(DOCS).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
}

// ---------- markdown ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function slugify(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/ /g, "-");
}
function plain(md) {
  return md.replace(NUM_RE, "$2").replace(/`([^`]*)`/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|__/g, "").replace(/\*/g, "");
}

function inline(src, ctx) {
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = src;
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(NUM_RE, (_, k, v) => {
    ctx.nums.push([k, v]);
    return keep(`<span class="num" data-num="${esc(k)}">${inline(v, { ...ctx, nums: [] })}</span>`);
  });
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const h = rewriteHref(src.replace(/&amp;/g, "&"), ctx);
    return keep(`<img src="${esc(h)}" alt="${alt}" loading="lazy" style="max-width:100%;height:auto;border-radius:12px">`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const h = rewriteHref(href.replace(/&amp;/g, "&"), ctx);
    const ext = /^https?:/.test(h);
    return `<a href="${esc(h)}"${ext ? ' rel="noopener"' : ""}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}

function rewriteHref(href, ctx) {
  if (/^(https?:|mailto:|#)/.test(href)) {
    if (href.startsWith("#")) ctx.links.push({ page: ctx.page, anchor: href.slice(1) });
    return href;
  }
  const [path, anchor] = href.split("#");
  const m = path.match(/^([\w.\-]+)\.md$/);
  if (m && existsSync(join(DOCS, path))) {
    ctx.links.push({ page: m[1], anchor });
    return `${m[1]}.html${anchor ? "#" + anchor : ""}`;
  }
  if (!existsSync(resolve(DOCS, path))) warn(`${ctx.page}.md: broken link ${href}`);
  return href;
}

function splitRow(line) {
  let row = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cur = "", tick = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === "`") tick = !tick;
    if (ch === "\\" && row[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "|" && !tick) { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function blocks(md, ctx) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const isListItem = (l) => /^(\s{0,3})([-*]|\d+\.)\s+/.test(l);
  const startsBlock = (l) => /^(#{1,6}\s|```|>|\|)/.test(l) || isListItem(l) || /^<!--\s*diagram:/.test(l) || /^---+\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^```(\w*)/))) {
      const lang = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<div class="code"><div class="code-bar"><span>${esc(lang || "text")}</span><button type="button" class="copy">Copy</button></div><pre><code>${esc(buf.join("\n"))}</code></pre></div>`);
      continue;
    }
    if ((m = line.match(/^<!--\s*diagram:([\w-]+)\s*-->/))) {
      const d = DIAGRAMS[m[1]];
      if (!d) warn(`${ctx.page}.md: no SVG for diagram:${m[1]}`);
      else out.push(`<figure class="diagram" id="fig-${m[1]}"><div class="fig-scroll">${d.svg()}</div><figcaption>${inline(d.caption, ctx)}</figcaption></figure>`);
      i++;
      continue;
    }
    if (/^<!--.*-->\s*$/.test(line)) { i++; continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const level = m[1].length;
      const text = m[2].trim();
      let id = slugify(plain(text));
      const base = id;
      let n = 1;
      while (ctx.ids.has(id)) id = `${base}-${n++}`;
      ctx.ids.add(id);
      if (level === 1 && !ctx.title) { ctx.title = plain(text); i++; continue; }
      if (level === 2 || level === 3) ctx.toc.push({ level, id, text: plain(text) });
      out.push(`<h${level} id="${id}">${inline(text, ctx)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (line.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      const inner = blocks(buf.join("\n"), ctx);
      const strong = /^\*\*(maintainer review|draft|warning|important)/i.test(buf[0] || "");
      out.push(`<blockquote class="callout${strong ? " callout-strong" : ""}">${inner}</blockquote>`);
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (/:$/.test(c) ? (/^:/.test(c) ? "center" : "right") : "left"));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      const al = (j) => (aligns[j] && aligns[j] !== "left" ? ` style="text-align:${aligns[j]}"` : "");
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, j) => `<th${al(j)}>${inline(c, ctx)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, j) => `<td${al(j)}>${inline(c, ctx)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (isListItem(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const im = l.match(/^(\s{0,3})([-*]|\d+\.)\s+(.*)$/);
        if (im && (/^\s*\d+\./.test(l) === ordered)) {
          const indent = im[1].length + im[2].length + 1;
          const buf = [im[3]];
          i++;
          while (i < lines.length) {
            const nl = lines[i];
            if (!nl.trim()) {
              const next = lines[i + 1] || "";
              if (/^\s{2,}\S/.test(next) && !isListItem(next.trimStart().length === next.length ? next : "x")) { buf.push(""); i++; continue; }
              break;
            }
            if (/^\s{2,}/.test(nl)) { buf.push(nl.replace(new RegExp(`^\\s{0,${indent}}`), "")); i++; continue; }
            if (isListItem(nl) || startsBlock(nl)) break;
            buf.push(nl); i++;
          }
          items.push(buf.join("\n"));
          while (i < lines.length && !lines[i].trim() && isListItem(lines[i + 1] || "") && (/^\s*\d+\./.test(lines[i + 1]) === ordered)) i++;
        } else break;
      }
      const html = items.map((it) => {
        const inner = blocks(it, ctx);
        const single = inner.match(/^<p>([\s\S]*)<\/p>$/);
        return `<li>${single && !inner.includes("</p><p>") ? single[1] : inner}</li>`;
      }).join("");
      out.push(ordered ? `<ol>${html}</ol>` : `<ul>${html}</ul>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && startsBlock(lines[i]))) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(" "), ctx)}</p>`);
  }
  return out.join("\n");
}

// ---------- diagrams ----------
const T = (x, y, s, cls = "t", anchor = "middle") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(String(s))}</text>`;
const R = (x, y, w, h, cls = "box", rx = 10) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;
const A = (x1, y1, x2, y2, cls = "arrow") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#ah)"/>`;
const P = (d, cls = "arrow") => `<path d="${d}" class="${cls}" fill="none" marker-end="url(#ah)"/>`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahead"/></marker></defs>${body}</svg>`;
const box = (x, y, w, h, title, sub, cls = "box") => R(x, y, w, h, cls) + T(x + w / 2, y + (sub ? h / 2 - 4 : h / 2 + 6), title, cls === "box" ? "t tb" : `t tb on-${cls}`) + (sub ? T(x + w / 2, y + h / 2 + 20, sub, cls === "box" ? "t ts" : `t ts on-${cls}`) : "");

function hbars(rows, { max, unit = "", label, valueText }) {
  return `<div class="hbars" role="img" aria-label="${esc(label)}">${rows.map((r) => {
    const pct = Math.max(0.5, Math.min(100, (r.v / max) * 100)).toFixed(1);
    const cls = /warmbar/.test(r.cls || "") ? " warm" : /strong/.test(r.cls || "") ? " strong" : "";
    return `<div class="hb-row"><div class="hb-label">${esc(r.name)}</div><div class="hb-track"><div class="hb-bar${cls}" style="width:${pct}%"></div></div><div class="hb-val">${esc(valueText ? valueText(r) : `${r.v}${unit}`)}</div></div>`;
  }).join("")}</div>`;
}
const DIAGRAMS = {
  "keel-first": {
    caption: `Keel first, LLM fallback. Measured with the Keel-3 RC on the held-out suites at τ = 0.6: ${nv("tok.k3.ho.avoided")} LLM calls avoided, ${nv("tok.k3.ho.cut")} fewer LLM tokens.`,
    svg: () => svg(980, 300,
      box(20, 110, 170, 80, "Agent or app", "typed question") +
      A(190, 150, 250, 150) +
      box(250, 95, 210, 110, "Keel", "local · ms · $0", "accent") +
      A(460, 150, 540, 150) +
      `<polygon points="620,95 700,150 620,205 540,150" class="box"/>` + T(620, 146, "confidence", "t ts") + T(620, 168, "≥ τ ?", "t tb") +
      P("M700,150 L760,150 L760,70 L790,70", "arrow okline") + T(735, 60, "yes", "t ts ok-t") +
      box(790, 30, 175, 80, "Act on answer", `${nv("tok.k3.ho.avoided")} of cases`, "ok") +
      P("M700,150 L760,150 L760,230 L790,230", "arrow") + T(735, 252, "no", "t ts") +
      box(790, 190, 175, 80, "Ask the LLM", "Jev, MSD1 or LLM", "warm"),
      "Flow: the agent asks Keel; if confidence is at least tau it acts, otherwise it asks an LLM"),
  },
  "tau-gate": {
    caption: "The τ gate. Keel's calibrated confidence decides who answers. Raising τ sends more questions to the LLM: more accurate, more tokens.",
    svg: () => svg(940, 250,
      box(20, 85, 170, 80, "state + question") + A(190, 125, 240, 125) +
      box(240, 75, 190, 100, "Keel", "answer + confidence", "accent") + A(430, 125, 490, 125) +
      `<polygon points="570,70 650,125 570,180 490,125" class="box"/>` + T(570, 121, "confidence", "t ts") + T(570, 143, "≥ τ ?", "t tb") +
      P("M650,125 L700,125 L700,55 L740,55", "arrow okline") + T(690, 45, "yes", "t ts ok-t", "end") +
      box(740, 20, 180, 70, "Use Keel's answer", "~20 ms, free", "ok") +
      P("M650,125 L700,125 L700,195 L740,195", "arrow") + T(690, 222, "no", "t ts", "end") +
      box(740, 160, 180, 70, "LLM, human or policy", "the hard cases", "warm"),
      "Tau gate diagram"),
  },
  "token-bars": {
    caption: `LLM decision tokens saved by the Keel-3 RC at τ = 0.6, overall and by workload (held-out suites). Source: artifacts/parity/tokens/report-t1-r2e.md.`,
    svg: () => hbars([
      { name: "Held-out, all", v: nn("tok.k3.ho.cut"), cls: "bar strong" },
      { name: "Blind (choice)", v: nn("tok.k3.blind.cut"), cls: "bar strong" },
      { name: "Gating", v: nn("tok.k3.wl.gating") },
      { name: "Guardrail yes/no", v: nn("tok.k3.wl.guardrail") },
      { name: "Routing", v: nn("tok.k3.wl.routing") },
      { name: "Moderation", v: nn("tok.k3.wl.moderation") },
      { name: "Severity", v: nn("tok.k3.wl.severity") },
    ], { max: 100, unit: "% fewer", label: "Bar chart of token savings" }),
  },
  "tau-curve": {
    caption: "Token cut versus τ for the Keel-3 RC. Higher τ defers more questions to the LLM, so the cut shrinks. Held-out in teal, blind in amber.",
    svg: () => {
      const taus = [0.5, 0.6, 0.7, 0.8, 0.9];
      const ho = [nn("tok.k3.ho.cut.t05"), nn("tok.k3.ho.cut"), nn("tok.k3.ho.cut.t07"), nn("tok.k3.ho.cut.t08"), nn("tok.k3.ho.cut.t09")];
      const bl = [nn("tok.k3.blind.cut.t05"), nn("tok.k3.blind.cut"), nn("tok.k3.blind.cut.t07"), nn("tok.k3.blind.cut.t08"), nn("tok.k3.blind.cut.t09")];
      const X = (i) => 110 + i * 175, Y = (v) => 300 - v * 2.6;
      let b = "";
      for (const g of [0, 25, 50, 75, 100]) b += `<line x1="100" y1="${Y(g)}" x2="830" y2="${Y(g)}" class="grid"/>` + T(90, Y(g) + 6, `${g}%`, "t ts", "end");
      taus.forEach((t, i) => (b += T(X(i), 330, `τ ${t}`, "t ts")));
      const line = (vals, cls) => `<polyline points="${vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}" class="${cls}" fill="none"/>` + vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="6" class="${cls}-dot"/>` + T(X(i), Y(v) - 14, `${v}%`, "t tb")).join("");
      b += line(ho, "ln-a") + line(bl, "ln-b");
      b += R(600, 18, 16, 16, "bar", 3) + T(624, 31, "Held-out 100", "t ts", "start") + R(600, 44, 16, 16, "bar warmbar", 3) + T(624, 57, "Blind (choice)", "t ts", "start");
      return svg(860, 345, b, "Line chart of token cut by tau");
    },
  },
  "bench-bars": {
    caption: "Cases fully right on the 234-case blind suite, which no model was trained on. Source: artifacts/parity/scoreboard.md.",
    svg: () => hbars([
      { name: "Lexical (Keel-1)", v: nn("lex.blind") },
      { name: "Keel-2 (shipped)", v: nn("k2.blind") },
      { name: "Keel-3 RC", v: nn("k3.blind"), cls: "bar strong" },
      { name: "Keel-3-Pro (70M)", v: nn("pro.blind") },
      { name: "claude-haiku-4.5", v: nn("llm.blind"), cls: "bar warmbar" },
    ], { max: 234, label: "Blind suite results", valueText: (r) => `${r.v}/234` }),
  },
  "cost-bars": {
    caption: "Cash cost per 1 million decisions, log scale. Jev and MSD1 are computed from vendor list prices at 654 input tokens per decision; Keel is local electricity; the small LLM assumes $1/$5 per 1M tokens. See the table below.",
    svg: () => {
      const rows = [
        { name: "Keel (local)", v: 0.28, t: "≈ $0.01–0.28", cls: "bar strong" },
        { name: "Jev (vendor price)", v: 27.47, t: "$27.47" },
        { name: "MSD1 (vendor price)", v: 27.47, t: "$27.47" },
        { name: "Small LLM", v: 320, t: "≈ $320", cls: "bar warmbar" },
      ];
      const lg = (v) => Math.log10(v / 0.01) / Math.log10(1000 / 0.01);
      return hbars(rows.map((r) => ({ ...r, v: lg(r.v) * 100 })), { max: 100, label: "Cost per million decisions", valueText: (r) => r.t });
    },
  },
  "request-flow": {
    caption: "Request flow. Every box on the right runs inside one local Node process; nothing on the decision path touches the network.",
    svg: () => svg(1000, 430,
      box(20, 20, 200, 60, "Copilot CLI · VS Code") + box(20, 95, 200, 60, "Claude Code · Codex") + box(20, 170, 200, 60, "Cursor · MCP clients") +
      box(20, 265, 200, 60, "Jev / MSD1 SDKs") + box(20, 340, 200, 60, "curl · your app") +
      A(220, 50, 270, 110) + A(220, 125, 270, 125) + A(220, 200, 270, 140) +
      box(270, 85, 170, 80, "keel-mcp", "stdio → HTTP", "accent") +
      A(440, 125, 500, 185) + A(220, 295, 500, 210) + A(220, 370, 500, 230) +
      `<rect x="490" y="15" width="495" height="400" rx="14" class="frame"/>` + T(737, 42, "Keel server, localhost:8080", "t tb") +
      box(510, 160, 200, 90,       "HTTP routes", "Jev + MSD1 paths") +
            P("M710,185 L735,185 L735,90 L760,90", "arrow") +
      box(760, 60, 205, 60, "auth · switch · rate limit") + box(760, 135, 205, 60, "wire parse (wire.ts)") +
      box(760, 210, 205, 60, "ONNX cross-encoder", "", "accent") + box(760, 285, 205, 60, "calibrate · project") +
      A(862, 120, 862, 135) + A(862, 195, 862, 210) + A(862, 270, 862, 285) +
      P("M760,315 L610,315 L610,250", "arrow") + T(660, 340, "answer", "t ts") +
      box(510, 345, 200, 55, "lexical fallback", "if the model fails"),
      "Architecture: clients, MCP bridge, local server, model"),
  },
  "training-pipeline": {
    caption: "Training pipeline. Every candidate is benchmarked on suites it never saw; only one that passes the release gates becomes models/keel-3.",
    svg: () => svg(1000, 260,
      box(15, 20, 175, 60, "Synthetic families") + box(15, 100, 175, 60, "Public train splits") + box(15, 180, 175, 60, "Teacher soft labels") +
      A(190, 50, 240, 120) + A(190, 130, 240, 130) + A(190, 210, 240, 140) +
      box(240, 95, 150, 70, "build_data", "decontaminate") + A(390, 130, 430, 130) +
      box(430, 95, 150, 70, "train.py", "CPU, PyTorch", "accent") + A(580, 130, 620, 130) +
      box(620, 95, 150, 70, "export", "int8 ONNX + calibrate") + A(770, 130, 805, 130) +
      box(805, 20, 180, 70, "parity bench", "held-out + blind") + A(895, 90, 895, 110) +
      box(805, 110, 180, 60, "release gates", "G1–G6") + A(895, 170, 895, 185) +
      box(805, 185, 180, 60, "models/keel-3", "", "ok"),
      "Training pipeline"),
  },
  "question-types": {
    caption: "The three question types and what comes back. Probabilities are illustrative.",
    svg: () => {
      const col = (x, title, sub, bars, foot) => {
        let b = R(x, 10, 290, 260, "box") + T(x + 145, 44, title, "t tb") + T(x + 145, 70, sub, "t ts");
        bars.forEach(([lab, v], i) => {
          const y = 95 + i * 42;
          b += T(x + 20, y + 20, lab, "t ts", "start") + R(x + 110, y + 4, 150, 22, "track", 5) + R(x + 110, y + 4, 150 * v, 22, i === 0 ? "bar strong" : "bar", 5);
        });
        return b + T(x + 145, 250, foot, "t ts");
      };
      return svg(960, 280,
        col(10, "choice", "pick one option", [["edit", 0.78], ["ask", 0.17], ["stop", 0.05]], "choice + confidence") +
        col(335, "score", "ordered levels", [["low", 0.1], ["medium", 0.25], ["high", 0.65]], "expected level, e.g. 1.55") +
        col(660, "noul", "yes or no", [["yes", 0.91], ["no", 0.09]], "P(yes) = 0.91"),
        "Choice, score and noul question types");
    },
  },
  "agents-mcp": {
    caption: "One MCP server for every agent. The token lives in the server's environment, not in the prompt.",
    svg: () => svg(1000, 300,
      ["GitHub Copilot CLI", "VS Code Copilot", "Claude Code", "OpenAI Codex CLI", "Cursor"].map((n, i) => box(15, 10 + i * 56, 230, 46, n)).join("") +
      [0, 1, 2, 3, 4].map((i) => A(245, 33 + i * 56, 320, 145)).join("") +
      box(320, 85, 230, 120, "keel-mcp", "keel_status · keel_decide · keel_switch", "accent") +
      T(435, 230, "KEEL_URL · KEEL_TOKEN", "t ts") +
      A(550, 145, 640, 145) + T(595, 132, "HTTP", "t ts") +
      box(640, 95, 160, 100, "Keel server", ":8080") + A(800, 145, 840, 145) + box(840, 105, 145, 80, "ONNX model", "", "ok"),
      "Agents connect through the keel-mcp server"),
  },
  quickstart: {
    caption: "From clone to first decision.",
    svg: () => svg(1000, 150,
      box(10, 35, 220, 80, "npm install", "npm run dev") + A(230, 75, 260, 75) +
      box(260, 35, 220, 80, "Get your key", "KEEL_TOKEN") + A(480, 75, 510, 75) +
      box(510, 35, 220, 80, "POST /systemone", "state + questions", "accent") + A(730, 75, 760, 75) +
      box(760, 35, 230, 80, "Typed answer", "probabilities, ms", "ok"),
      "Quickstart steps"),
  },
  "pro-journey": {
    caption: "Keel-Pro end to end. The dot shows one trip around the loop: build data, train, score on the dev sample, keep the best, and repeat until the target is met. Then the finalist is scored once on the report sample and packaged.",
    svg: () => svg(1000, 330,
      `<style>.pj-dot{offset-path:path("M105,95 L305,95 L505,95 L705,95 L895,95 L895,245 L705,245 L505,245 L305,245");animation:pj 9s linear infinite}@keyframes pj{from{offset-distance:0%}to{offset-distance:100%}}@media (prefers-reduced-motion:reduce){.pj-dot{animation:none}}</style>` +
      box(15, 55, 180, 80, "1. Data", "public + synthetic") + A(195, 95, 215, 95) +
      box(215, 55, 180, 80, "2. Train", "LoRA on Qwen3.5", "accent") + A(395, 95, 415, 95) +
      box(415, 55, 180, 80, "3. Score (dev)", "1,633 DI questions") + A(595, 95, 615, 95) +
      `<polygon points="705,50 795,95 705,140 615,95" class="box"/>` + T(705, 91, "index ≥ 62?", "t tb") + T(705, 113, "dev sample", "t ts") +
      P("M705,50 L705,22 L305,22 L305,55", "arrow") + T(505, 16, "no → change one lever, train again", "t ts") +
      A(795, 95, 815, 95) + T(805, 85, "yes", "t ts ok-t") +
      box(815, 55, 165, 80, "4. Finalist", "", "ok") +
      A(897, 135, 897, 205) +
      box(815, 205, 165, 80, "5. Report score", "once, 3,272 rows") + A(815, 245, 795, 245) +
      box(615, 205, 180, 80, "6. Export", "GGUF Q8_0 / Q4_K_M") + A(615, 245, 595, 245) +
      box(415, 205, 180, 80, "7. Serve", "sidecar + Pro pin", "accent") + A(415, 245, 395, 245) +
      box(215, 205, 180, 80, "8. Publish", "model card, HF", "warm") +
      `<circle r="9" class="ln-a-dot pj-dot"/>`,
      "Keel-Pro pipeline: data, train, score, decide, finalist, report, export, serve, publish"),
  },
  "pro-iterations": {
    caption: "Decision Index (public 0.3) on our dev sample, one bar per training run. Amber bars are references from the DI board: Jev 1.14 and the best board entry (karpo-decision-31B, 0.4.1 board, 2026-11-21). Source: artifacts/parity/pro/di-results.md.",
    svg: () => hbars([
      { name: "Keel-Lite (CPU, today's default)", v: 5.27 },
      { name: "Stock Qwen3.5-9B, no training", v: 10.13 },
      { name: "it1 · 4B", v: 49.7 },
      { name: "it2 · 4B, longer prompts", v: 48.88 },
      { name: "it3 · 9B", v: 54.25 },
      { name: "it5 · 9B, letters read-out", v: 52.5 },
      { name: "it7 · 27B (4-bit)", v: 60.32 },
      { name: "it8 · 27B + long chord rows", v: 59.61 },
      { name: "soup78 · average of it7 + it8 (finalist)", v: 62.06, cls: "bar strong" },
      { name: "soup78 · REPORT sample, scored once", v: 61.96, cls: "bar strong" },
      { name: "soup78 · REPORT, fast engine (≤ 1 s rule)", v: 61.66, cls: "bar strong" },
      { name: "soup78 · FULL public suite (139,677 questions)", v: 62.73, cls: "bar strong" },
      { name: "Jev 1.14 (DI board)", v: 60.7, cls: "bar warmbar" },
      { name: "Best DI board entry (karpo-decision-31B)", v: 75.05, cls: "bar warmbar" },
    ], { max: 80, label: "Dev index per iteration" }),
  },
  "pro-areas": {
    caption: "The five DI skill areas for the finalist (soup78) on the report sample, as % skill above chance. Tools is strong; Knowledge & Reasoning is the weak spot. Source: soup78 report run.",
    svg: () => hbars([
      { name: "Tools & Automation", v: 81.7, cls: "bar strong" },
      { name: "Language Understanding", v: 62.5 },
      { name: "Arts & Human Taste", v: 62.1 },
      { name: "Retrieval & Classification", v: 61.2 },
      { name: "Knowledge & Reasoning", v: 48.0, cls: "bar warmbar" },
    ], { max: 100, unit: "", label: "Area skill for soup78 (report)" }),
  },
  "pro-letters": {
    caption: "How Keel-Pro answers. Options become letters; the model reads everything once and we take its probability for each letter. One forward pass, no text generation.",
    svg: () => svg(1000, 250,
      `<style>.pl-glow{animation:plg 2.4s ease-in-out infinite}@keyframes plg{0%,100%{opacity:.35}50%{opacity:1}}@media (prefers-reduced-motion:reduce){.pl-glow{animation:none;opacity:1}}</style>` +
      R(15, 30, 260, 190, "box") + T(145, 62, "Question", "t tb") +
      T(35, 105, "state: “deploy failed…”", "t ts", "start") + T(35, 135, "A. retry: run again", "t ts", "start") + T(35, 160, "B. rollback: undo", "t ts", "start") + T(35, 185, "C. page: call on-call", "t ts", "start") +
      A(275, 125, 345, 125) +
      box(345, 75, 230, 100, "Keel-Pro model", "one read, no generation", "accent") + A(575, 125, 645, 125) +
      R(645, 40, 330, 170, "box") + T(810, 68, "Probability per letter", "t tb") +
      R(670, 88, 60, 22, "bar", 4) + T(745, 105, "A 0.12", "t ts", "start") +
      `<rect x="670" y="123" width="230" height="22" rx="4" class="bar pl-glow"/>` + T(910, 140, "B 0.81", "t tb", "start") +
      R(670, 158, 30, 22, "bar", 4) + T(715, 175, "C 0.07", "t ts", "start"),
      "Letters read-out: options become letters, model outputs a probability per letter"),
  },
  "pro-prefix": {
    caption: "Why the fast engine is faster. Before: every question re-read the long shared text (17 questions = 17 full reads). After: the shared text is read once, then all questions are finished together from that point. Report-sample mean per request: 2,082 ms → 844 ms.",
    svg: () => svg(1000, 300,
      `<style>.pp-r{animation:ppr 3s linear infinite}@keyframes ppr{0%{opacity:.25}50%{opacity:1}100%{opacity:.25}}@media (prefers-reduced-motion:reduce){.pp-r{animation:none;opacity:1}}</style>` +
      T(240, 28, "Before: read the text again for each question", "t tb") +
      [0, 1, 2].map((i) => R(20, 50 + i * 70, 330, 44, "bar pp-r", 6) + T(185, 78 + i * 70, "shared text (state)", "t ts") + box(360, 50 + i * 70, 100, 44, `Q${i === 2 ? "17" : i + 1}`, "")).join("") +
      T(240, 270, "17 × long read", "t ts") +
      T(760, 28, "After: read it once, then branch", "t tb") +
      R(520, 120, 260, 50, "bar strong", 6) + T(650, 150, "shared text, once", "t tb") +
      [0, 1, 2].map((i) => A(780, 145, 840, 72 + i * 70) + box(840, 50 + i * 70, 130, 44, `Q${i === 2 ? "17" : i + 1}`, "", "ok")).join("") +
      T(760, 270, "1 long read + 17 short endings", "t ts"),
      "Before: shared text re-read per question. After: read once and branch to every question"),
  },
  "deploy-pick": {
    caption: "Which setup? Start at the top. Most teams need only Keel-Lite; add Keel-Pro when accuracy matters more than cost.",
    svg: () => svg(1000, 300,
      box(370, 15, 260, 60, "Need the best accuracy?", "", "accent") +
      A(450, 75, 210, 120) + T(300, 92, "no", "t ts") + A(550, 75, 790, 120) + T(700, 92, "yes", "t ts") +
      box(90, 120, 240, 60, "Shared by a team?") +
      box(670, 120, 240, 60, "NVIDIA GPU, 24 GB+?") +
      A(160, 180, 90, 225) + T(100, 205, "no", "t ts") + A(260, 180, 330, 225) + T(320, 205, "yes", "t ts") +
      A(740, 180, 670, 225) + T(680, 205, "yes", "t ts") + A(840, 180, 910, 225) + T(905, 205, "no", "t ts") +
      box(5, 225, 175, 65, "Keel-Lite, local", "npm start", "ok") +
      box(245, 225, 205, 65, "Keel-Lite container", "Docker · K8s · cloud", "ok") +
      box(560, 225, 220, 65, "Keel-Pro sidecar", "Compose · K8s GPU pod", "warm") +
      box(805, 225, 190, 65, "Keel-Pro GGUF", "llama.cpp, ~17 GB", "warm"),
      "Decision tree: accuracy need, team sharing and GPU size pick Keel-Lite local, Keel-Lite container, Keel-Pro sidecar or GGUF"),
  },
  "deploy-pod": {
    caption: "One pod (or one Compose network). Requests come in over TLS with the key; Keel answers Keel-Lite itself and passes Pro-pinned questions to the sidecar over localhost. The sidecar is never reachable from outside.",
    svg: () => svg(1000, 260,
      `<style>.dp-dot{offset-path:path("M60,130 L300,130 L470,130 L640,130 L760,130");animation:dpm 4s linear infinite}@keyframes dpm{from{offset-distance:0%}to{offset-distance:100%}}@media (prefers-reduced-motion:reduce){.dp-dot{animation:none}}</style>` +
      R(385, 20, 600, 220, "box") + T(685, 45, "one pod · shared localhost", "t tb") +
      box(10, 95, 140, 70, "Your agent", "Bearer key") + A(150, 130, 200, 130) +
      box(200, 95, 140, 70, "Ingress", "TLS") + A(340, 130, 400, 130) +
      box(400, 85, 220, 90, "Keel server :8080", "key · validation · Keel-Lite", "accent") +
      A(620, 130, 735, 130) + T(678, 118, "127.0.0.1", "t ts") +
      box(735, 85, 230, 90, "Keel-Pro sidecar :8090", "GPU · no external port", "warm") +
      T(685, 215, "KEEL_SECRET from a secret store · weights on a volume", "t ts") +
      `<circle r="8" class="ln-a-dot dp-dot"/>`,
      "Agent to ingress to Keel server, which calls the Keel-Pro sidecar over localhost inside one pod"),
  },
  "pro-status": {
    caption: "Where Keel-Pro stands. Green is done, amber is in progress, grey is not started.",
    svg: () => {
      const items = [
        ["Data (372k rows)", "ok"], ["Trainer + QLoRA", "ok"], ["Eval service + CIs", "ok"], ["≥ 3 iterations (9)", "ok"],
        ["GGUF export (30/30)", "ok"], ["Sidecar + Pro pin", "ok"], ["Dev ≥ 62 (62.06)", "ok"], ["Report score (once)", "ok"],
        ["Docs + model card", "ok"], ["Board latency ≤ 1 s", "ok"], ["Local commit", "ok"], ["Publish (needs your OK)", "box"],
      ];
      let b = "";
      items.forEach(([t, c], i) => { const x = 15 + (i % 4) * 245, y = 15 + Math.floor(i / 4) * 80; b += box(x, y, 230, 64, t, c === "ok" ? "done" : c === "warm" ? "in progress" : "to do", c); });
      return svg(1000, 255, b, "Status board");
    },
  },
};

// ---------- template ----------
const CSS = `
:root{--bg:#fbfaf6;--surface:#ffffff;--surface2:#f1efe8;--ink:#14171c;--ink2:#262b33;--line:#d9d5c9;--accent:#0b6170;--accent-ink:#ffffff;--accentSoft:#e2f0f1;--ok:#1d6b3a;--okSoft:#e3f2e7;--warm:#9a4a05;--warmSoft:#fbecdc;--danger:#a3261b;--code-bg:#f3f1ea;--link:#0a5a86;--shadow:0 1px 2px rgba(20,23,28,.06),0 6px 20px rgba(20,23,28,.05)}
html[data-theme=dark]{--bg:#0f1418;--surface:#161d22;--surface2:#1d262c;--ink:#f1f4f6;--ink2:#dbe2e6;--line:#33414a;--accent:#5fc4d2;--accent-ink:#06171b;--accentSoft:#173238;--ok:#6fd393;--okSoft:#15301f;--warm:#f2a65a;--warmSoft:#35250f;--danger:#ff8b7e;--code-bg:#11181d;--link:#8fd0ff;--shadow:none}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 19px/1.65 "Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;overflow-x:hidden}
code,pre{font-family:"Cascadia Mono","JetBrains Mono",Consolas,ui-monospace,Menlo,monospace}
a{color:var(--link);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}
.top{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.top-in{max-width:1180px;margin:0 auto;padding:12px 28px;display:flex;align-items:center;gap:18px}
.brand{white-space:nowrap;flex:none;display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;color:var(--ink);text-decoration:none}
.brand svg{width:28px;height:28px}
.top nav{display:flex;gap:4px;flex-wrap:wrap;margin-left:8px}
.top nav a{color:var(--ink2);text-decoration:none;font-size:17px;padding:6px 10px;border-radius:8px}
.top nav a[aria-current]{color:var(--ink);background:var(--surface2);font-weight:600}
.top nav a:hover{background:var(--surface2)}
.spacer{flex:1}
.btn{font:inherit;font-size:16px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.btn:hover{border-color:var(--ink2)}.btn svg{width:18px;height:18px}
.pbar{position:fixed;top:0;left:0;height:3px;background:var(--accent);width:0;z-index:40}
main{max-width:940px;margin:0 auto;padding:40px 28px 80px}
.crumb{font-size:17px;color:var(--ink2);margin:0 0 6px}
h1{font-size:50px;line-height:1.1;letter-spacing:-.02em;margin:6px 0 18px;font-weight:750}
.lede{font-size:22px;line-height:1.55;color:var(--ink2);margin:0 0 30px}
h2{font-size:33px;line-height:1.2;letter-spacing:-.01em;margin:64px 0 16px;padding-top:22px;border-top:1px solid var(--line);font-weight:700}
h3{font-size:25px;line-height:1.3;margin:40px 0 12px;font-weight:650}
h4{font-size:21px;margin:28px 0 8px}
h1,h2,h3,h4{scroll-margin-top:84px;position:relative;overflow-wrap:anywhere}
.anchor{opacity:0;margin-left:10px;text-decoration:none;color:var(--accent);font-weight:400}
h2:hover .anchor,h3:hover .anchor{opacity:1}
p{margin:0 0 18px}ul,ol{margin:0 0 20px;padding-left:28px}li{margin:6px 0}li>ul,li>ol{margin:6px 0}
strong{font-weight:650;color:var(--ink)}
:not(pre)>code{font-size:.86em;background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:1px 6px;overflow-wrap:anywhere}
.code{margin:0 0 24px;border:1px solid var(--line);border-radius:12px;background:var(--code-bg);overflow:hidden}
.code-bar{display:flex;justify-content:space-between;align-items:center;padding:6px 10px 6px 16px;border-bottom:1px solid var(--line);font-size:15px;color:var(--ink2)}
.copy{font:inherit;font-size:15px;background:transparent;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:2px 10px;cursor:pointer}
.copy:hover{border-color:var(--ink2)}
pre{margin:0;padding:16px 18px;overflow-x:auto;font-size:16.5px;line-height:1.55;color:var(--ink)}
.table-wrap{overflow-x:auto;margin:0 0 26px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:18px;line-height:1.45}
th,td{padding:11px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
th{background:var(--surface2);font-weight:650;color:var(--ink)}
tbody tr:last-child td{border-bottom:0}
.num{font-variant-numeric:tabular-nums;font-weight:650;color:var(--ink);background:var(--accentSoft);border-radius:5px;padding:0 4px}
.callout{margin:0 0 26px;padding:18px 22px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.callout-strong{background:var(--warmSoft);border-color:var(--warm)}
.callout>:last-child{margin-bottom:0}
hr{border:0;border-top:1px solid var(--line);margin:36px 0}
figure.diagram{margin:10px 0 34px;padding:22px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
.fig-scroll{overflow-x:auto}
figure svg{display:block;width:100%;height:auto;min-width:600px}
.hbars{display:grid;gap:12px}.hb-row{display:grid;grid-template-columns:210px 1fr 150px;align-items:center;gap:14px}
.hb-label{font-weight:600;text-align:right}.hb-track{background:var(--surface2);border-radius:6px;height:28px;overflow:hidden}
.hb-bar{height:100%;background:var(--accent);opacity:.6;border-radius:6px}.hb-bar.strong{opacity:1}.hb-bar.warm{background:var(--warm);opacity:1}
.hb-val{font-weight:650;font-variant-numeric:tabular-nums}
figcaption{font-size:17px;color:var(--ink2);margin-top:14px;line-height:1.5}
svg .box{fill:var(--surface2);stroke:var(--line);stroke-width:1.5}
svg .accent{fill:var(--accent);stroke:var(--accent)}svg .ok{fill:var(--okSoft);stroke:var(--ok);stroke-width:1.5}svg .warm{fill:var(--warmSoft);stroke:var(--warm);stroke-width:1.5}
svg .frame{fill:none;stroke:var(--line);stroke-width:1.5;stroke-dasharray:6 5}
svg .t{fill:var(--ink);font:500 17px "Segoe UI",system-ui,sans-serif}svg .tb{font-weight:650;font-size:18px}svg .ts{font-size:15.5px;fill:var(--ink2)}
svg .on-accent{fill:var(--accent-ink)}svg .on-ok,svg .on-warm{fill:var(--ink)}svg .ok-t{fill:var(--ok)}
svg .arrow{stroke:var(--ink2);stroke-width:2}svg .arrow.okline{stroke:var(--ok)}svg .ahead{fill:var(--ink2)}
svg .track{fill:var(--surface2)}svg .bar{fill:var(--accent);opacity:.55}svg .bar.strong{opacity:1}svg .warmbar{fill:var(--warm);opacity:1}
svg .grid{stroke:var(--line);stroke-width:1}
svg .ln-a{stroke:var(--accent);stroke-width:3}svg .ln-b{stroke:var(--warm);stroke-width:3}svg .ln-a-dot{fill:var(--accent)}svg .ln-b-dot{fill:var(--warm)}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:64px;padding-top:24px;border-top:1px solid var(--line)}
.pager a{display:block;flex:1;padding:14px 18px;border:1px solid var(--line);border-radius:12px;text-decoration:none;color:var(--ink);background:var(--surface)}
.pager a:hover{border-color:var(--accent)}.pager small{display:block;font-size:16px;color:var(--ink2)}.pager .next{text-align:right}
footer{font-size:16px;color:var(--ink2);margin-top:28px}
/* contents menu: middle-left, auto-hide */
.navtab{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:25;writing-mode:vertical-rl;rotate:180deg;font:600 16px/1 "Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-left:0;border-radius:0 10px 10px 0;padding:16px 9px;cursor:pointer;transition:opacity .2s}
.sidenav{position:fixed;left:14px;top:50%;transform:translate(calc(-100% - 30px),-50%);z-index:26;width:300px;max-height:76vh;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 10px 14px 14px;box-shadow:0 10px 40px rgba(0,0,0,.14);transition:transform .28s ease}
body.nav-open .sidenav{transform:translate(0,-50%)}body.nav-open .navtab{opacity:0;pointer-events:none}
.sidenav-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px 6px;font-weight:700;font-size:17px}
.sidenav-head button{font:inherit;font-size:15px;background:none;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:2px 8px;cursor:pointer}
.sidenav ol{list-style:none;margin:0;padding:0}.sidenav li{margin:0}
.sidenav a{display:block;padding:6px 8px;border-radius:7px;color:var(--ink2);text-decoration:none;font-size:16.5px;line-height:1.35}
.sidenav a.l3{padding-left:22px;font-size:16px}
.sidenav a:hover{background:var(--surface2);color:var(--ink)}
.sidenav a.active{background:var(--accentSoft);color:var(--ink);font-weight:650}

@media (max-width:1240px){.top nav{display:none}}
@media (max-width:700px){body{font-size:18px}main{padding:26px 18px 60px}h1{font-size:36px}h2{font-size:27px;margin-top:48px}h3{font-size:22px}.lede{font-size:19.5px}.top-in{padding:10px 16px;gap:10px}.brand span{display:none}table{font-size:17px}th,td{padding:9px 10px}pre{font-size:15.5px}figure.diagram{padding:14px}.sidenav{width:min(300px,84vw)}main{padding-left:38px}.navtab{font-size:14px;padding:12px 5px}.hb-row{grid-template-columns:1fr auto;gap:4px 10px}.hb-label{text-align:left;grid-column:1/-1}.hb-track{height:22px}.pager{flex-direction:column}}
.docmenu{position:fixed;inset:60px 12px auto auto;z-index:35;width:min(340px,92vw);max-height:80vh;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:0 10px 40px rgba(0,0,0,.16);display:none}
.docmenu.open{display:block}.docmenu h4{margin:10px 8px 4px;font-size:16px}.docmenu a{display:block;padding:7px 10px;border-radius:7px;color:var(--ink);text-decoration:none;font-size:17px}.docmenu a:hover{background:var(--surface2)}
@media print{.top,.navtab,.sidenav,.pbar,.copy,.pager,.docmenu{display:none!important}body{font-size:12pt}main{max-width:none;padding:0}h2{break-after:avoid}figure,table,.code{break-inside:avoid}}
`;

const JS = `
(function(){
var root=document.documentElement,body=document.body;
var tbtn=document.getElementById('theme');
function label(){var d=root.dataset.theme==='dark';tbtn.querySelector('span').textContent=d?'Light':'Dark';tbtn.setAttribute('aria-pressed',d)}
label();tbtn.addEventListener('click',function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('keel-docs-theme',root.dataset.theme)}catch(e){}label()});
var dm=document.getElementById('docmenu'),db=document.getElementById('alldocs');
db.addEventListener('click',function(e){e.stopPropagation();dm.classList.toggle('open')});document.addEventListener('click',function(e){if(!dm.contains(e.target))dm.classList.remove('open')});
document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){var t=b.closest('.code').querySelector('code').innerText;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1400)},function(){})})});
var pbar=document.querySelector('.pbar');
var nav=document.querySelector('.sidenav'),tab=document.querySelector('.navtab');
if(!nav)return;
var pinned=false,timer=null,hover=false,wide=matchMedia('(min-width:1101px)');
function open(){body.classList.add('nav-open')}function close(){if(!pinned&&!hover)body.classList.remove('nav-open')}
function peek(){if(!wide.matches)return;open();clearTimeout(timer);timer=setTimeout(close,1800)}
tab.addEventListener('click',function(){pinned=true;open()});
document.getElementById('navclose').addEventListener('click',function(){pinned=false;hover=false;body.classList.remove('nav-open')});
nav.addEventListener('mouseenter',function(){hover=true;clearTimeout(timer)});nav.addEventListener('mouseleave',function(){hover=false;timer=setTimeout(close,900)});
document.addEventListener('mousemove',function(e){if(e.clientX<110&&wide.matches){open();clearTimeout(timer);timer=setTimeout(close,1800)}});
nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){if(!wide.matches){pinned=false;body.classList.remove('nav-open')}})});
var links=[].slice.call(nav.querySelectorAll('a')),heads=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))});
var last=0,ticking=false;
window.addEventListener('scroll',function(){if(ticking)return;ticking=true;requestAnimationFrame(function(){ticking=false;var y=scrollY,h=document.documentElement.scrollHeight-innerHeight;pbar.style.width=(h>0?y/h*100:0)+'%';
var cur=-1;for(var i=0;i<heads.length;i++){if(heads[i]&&heads[i].getBoundingClientRect().top<120)cur=i}
links.forEach(function(a,i){a.classList.toggle('active',i===cur)});
if(Math.abs(y-last)>40){peek();last=y}})},{passive:true});
})();`;

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)"/><path d="M8 9h16M16 9v15M9 19c2 4 5 5 7 5s5-1 7-5" stroke="var(--accent-ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

function page(name, ctx, bodyHtml) {
  const idx = PAGES.findIndex(([p]) => p === name);
  const prev = idx > 0 ? PAGES[idx - 1] : null;
  const next = idx >= 0 && idx < PAGES.length - 1 ? PAGES[idx + 1] : null;
  const top = ["quickstart", "integrations", "concepts", "api-reference", "benchmarks", "token-savings", "faq"];
  const many = ctx.toc.filter((t) => t.level === 3).length > 30;
  const toc = ctx.toc.filter((t) => t.level === 2 || !many);
  const docmenu = GROUPS.map(([g, names]) => `<h4>${g}</h4>` + names.map((n) => `<a href="${n}.html">${esc(PAGES.find((p) => p[0] === n)[1])}</a>`).join("")).join("");
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.title)} · Keel docs</title>
<meta name="description" content="${esc(ctx.lede.slice(0, 180))}">
<script>try{var t=localStorage.getItem('keel-docs-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${CSS}</style>
</head>
<body>
<div class="pbar"></div>
<header class="top"><div class="top-in">
<a class="brand" href="index.html">${LOGO}<span>Keel docs</span></a>
<nav aria-label="Documentation">${top.map((p) => `<a href="${p}.html"${p === name ? ' aria-current="page"' : ""}>${esc(PAGES.find((x) => x[0] === p)[1])}</a>`).join("")}</nav>
<div class="spacer"></div>
<button class="btn alldocs" id="alldocs" type="button" aria-haspopup="true">All docs</button>
<button class="btn" id="theme" type="button" aria-label="Toggle dark theme">${MOON}<span>Dark</span></button>
</div></header>
<div class="docmenu" id="docmenu">${docmenu}</div>
${toc.length ? `<button class="navtab" type="button" aria-label="Open contents">Contents</button>
<aside class="sidenav" aria-label="On this page"><div class="sidenav-head"><span>On this page</span><button id="navclose" type="button" aria-label="Close contents">Close</button></div><ol>${toc.map((t) => `<li><a class="l${t.level}" href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ol></aside>` : ""}
<main>
<p class="crumb"><a href="index.html">Keel docs</a>${name !== "index" ? ` / ${esc(PAGES.find((p) => p[0] === name)?.[1] || ctx.title)}` : ""}</p>
<h1>${esc(ctx.title)}</h1>
${bodyHtml}
<nav class="pager" aria-label="Previous and next">${prev ? `<a href="${prev[0]}.html"><small>Previous</small>${esc(prev[1])}</a>` : "<span></span>"}${next ? `<a class="next" href="${next[0]}.html"><small>Next</small>${esc(next[1])}</a>` : "<span></span>"}</nav>
<footer>Generated from <a href="${name}.md">${name}.md</a> by <code>node docs/build-html.mjs</code>. Keel is released under the Apache-2.0 licence.</footer>
</main>
${toc.length ? "" : '<span id="navclose" hidden></span>'}
<script>${JS}</script>
</body>
</html>
`;
}

// ---------- build ----------
const rendered = {};
for (const file of mdFiles()) {
  const name = file.replace(/\.md$/, "");
  if (!PAGES.find((p) => p[0] === name)) warn(`${file} is not in PAGES; add it to the navigation`);
  const md = readFileSync(join(DOCS, file), "utf8");
  const ctx = { page: name, ids: new Set(), toc: [], links: [], nums: [], title: "", lede: "" };
  let html = blocks(md, ctx);
  html = html.replace(/^<p>/, '<p class="lede">');
  ctx.lede = plain((md.split(/\n\n/).find((b) => b.trim() && !b.startsWith("#") && !b.startsWith("<!--")) || "").replace(/\n/g, " "));
  for (const [k, v] of ctx.nums) {
    if (!numbers[k]) warn(`${file}: number key ${k} missing from _numbers.json`);
    else if (numbers[k].value !== v) warn(`${file}: ${k} is "${v}" but _numbers.json says "${numbers[k].value}" (run with --apply-numbers)`);
  }
  rendered[name] = { ctx, html };
}
for (const [name, { ctx, html }] of Object.entries(rendered)) {
  for (const l of ctx.links) {
    if (!l.anchor) continue;
    const target = rendered[l.page];
    if (target && !target.ctx.ids.has(decodeURIComponent(l.anchor))) warn(`${name}.md: link to ${l.page}#${l.anchor} has no matching heading`);
  }
  writeFileSync(join(DOCS, `${name}.html`), page(name, ctx, html), "utf8");
}
// README relative links are checked too (README is rendered by GitHub, not here).
{
  const readme = readFileSync(join(ROOT, "README.md"), "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of readme.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const [p, a] = href.split("#");
    if (!existsSync(resolve(ROOT, p))) warn(`README.md: broken link ${href}`);
    else if (a && p.startsWith("docs/") && p.endsWith(".md")) {
      const t = rendered[p.slice(5, -3)];
      if (t && !t.ctx.ids.has(a)) warn(`README.md: link to ${href} has no matching heading`);
    }
  }
}
console.log(`built ${Object.keys(rendered).length} pages`);
for (const w of warnings) console.warn(`WARN ${w}`);
process.exitCode = warnings.length ? 1 : 0;
