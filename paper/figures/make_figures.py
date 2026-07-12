#!/usr/bin/env python3
"""Generate the two paper figures as SVG, then render PNGs.

Usage:
    python3 make_figures.py            # writes fig1-dsr.svg / fig2-architecture.svg
                                       # and renders 2400px-wide PNGs via rsvg-convert

Figure 1 — Design Science Research cycles (Hevner): Environment | Build & Evaluate | Knowledge Base.
Figure 2 — Layered system architecture of the YDNL prototype.

All wording lives in the constants below; edit and re-run to update the figures.
Corpus claims follow DATA.md: 12 synthetic draft patterns; fieldwork toward the
24-pattern corpus and master-drummer validation are IN PROGRESS, not completed.
"""

import subprocess
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ---------------------------------------------------------------- palette ---
NAVY = "#1f3a5f"          # arrows, dark box, strong borders
BLUE_BORDER = "#2e6da4"   # phase / component box borders
BLUE_FILL = "#dbe7f6"     # phase / component box fill
PANEL_FILL = "#edf3fb"    # centre panel / layer band fill
GREEN_BORDER = "#3a7d44"
GREEN_FILL = "#e2efe2"
GREEN_PANEL = "#eaf3ea"
TAN_BORDER = "#9c7c2c"
TAN_FILL = "#f6efdd"
PURPLE_BORDER = "#7a5fa8"
PURPLE_FILL = "#efeaf7"
RED = "#c0392b"
GREY = "#5a6a7a"
INK = "#1c2b3a"
FONT = "Helvetica, Arial, sans-serif"

# ------------------------------------------------------- figure 1 wording ---
ENVIRONMENT_ITEMS = [
    ["Yorùbá Dùndún and", "Bàtá performance practice"],
    ["Master drummers of", "Ondo and Oyo States"],
    ["FUTA Department of", "Music and Creative Arts"],
    ["Cultural and ritual", "context of each pattern"],
]
KNOWLEDGE_ITEMS = [
    ["Design Science Research", "(Hevner et al.)"],
    ["Yorùbá ethnomusicology", "and speech surrogacy"],
    ["Encoding standards:", "MusicXML, MEI, Humdrum"],
    ["Software engineering", "and schema design"],
]
PHASES = [
    # (title, body lines, green?)
    ("Phase 0 — Corpus Construction",
     ["12 synthetic seed patterns (6 Dùndún, 6 Bàtá);",
      "fieldwork toward a 24-pattern corpus in progress"], False),
    ("Phase 1 — Domain Analysis",
     ["produces the Structural", "Incompatibility Report"], False),
    ("Phase 2 — Schema & Format Design",
     ["data model, XSD / JSON Schema, cultural",
      "vocabulary; metrics fixed in advance"], False),
    ("Phase 3 — Prototype Build",
     ["React + Express + ydnl-core"], False),
    ("Phase 4 — Evaluation & Validation",
     ["ECS, BPR and RP computed on the corpus;",
      "master-drummer validation planned"], True),
]
CORPUS_TITLE = "Drum Pattern Corpus"
CORPUS_SUB = "shared artefact of record across all cycles"

# ------------------------------------------------------- figure 2 wording ---
LAYERS = [
    ("Presentation Layer — React Single Page Application", False,
     [["Timeline", "Encoder"], ["Pattern", "Renderer"],
      ["Searchable", "Library"], ["Benchmark", "View"]]),
    ("API Layer — Express REST Service (routes map to schema operations)", False,
     [["POST", "/encode"], ["POST", "/validate"], ["GET", "/patterns/{id}"],
      ["GET", "/search"], ["POST", "/benchmark"]]),
    ("Core Domain Library — ydnl-core (framework independent)", True,
     [["Data", "Model"], ["Schema", "Validator"], ["XML / JSON", "Serialisers"],
      ["MusicXML", "Benchmark", "Encoder"], ["Metric Fns", "ECS BPR RP"]]),
    ("Persistence Layer", False,
     [["JSON Pattern Corpus", "(prototype store)"],
      ["PostgreSQL relational schema", "(production — mirrors entity model)"]]),
]
FLOW_LABELS = ["JSON over HTTPS", "in process calls", "repository interface"]
CONTRACT_TITLE = ["VALIDATION", "CONTRACT"]
CONTRACT_BODY = [
    "XSD + JSON Schema", "",
    "Single source of truth", "for the file format,",
    "the relational schema,", "and runtime checks.", "",
    "Enforced at the API", "boundary and inside", "the core library.",
]

# ------------------------------------------------------------ svg helpers ---
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def rrect(x, y, w, h, fill, stroke, sw=2.5, r=10):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

def text(x, y, s, size=15, fill=INK, weight="normal", anchor="middle",
         style="normal", spacing=None):
    sp = f' letter-spacing="{spacing}"' if spacing else ""
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" font-style="{style}" '
            f'text-anchor="{anchor}"{sp}>{esc(s)}</text>')

def lines(x, y, rows, size=15, lh=None, **kw):
    lh = lh or size * 1.45
    return "\n".join(text(x, y + i * lh, s, size=size, **kw)
                     for i, s in enumerate(rows))

def harrow(x1, x2, y, color=NAVY, sw=5, head=14):
    """Horizontal arrow from x1 to x2 (direction inferred)."""
    d = 1 if x2 > x1 else -1
    tip, back = x2, x2 - d * head
    return (f'<line x1="{x1}" y1="{y}" x2="{back}" y2="{y}" '
            f'stroke="{color}" stroke-width="{sw}"/>'
            f'<polygon points="{tip},{y} {back},{y-head*0.7} {back},{y+head*0.7}" '
            f'fill="{color}"/>')

def varrow(x, y1, y2, color=NAVY, sw=5, head=14):
    d = 1 if y2 > y1 else -1
    tip, back = y2, y2 - d * head
    return (f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{back}" '
            f'stroke="{color}" stroke-width="{sw}"/>'
            f'<polygon points="{x},{tip} {x-head*0.7},{back} {x+head*0.7},{back}" '
            f'fill="{color}"/>')

def svg_doc(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">\n{body}\n</svg>\n')

# -------------------------------------------------------------- figure 1 ----
def figure1():
    W, H = 1200, 640
    b = []

    # side panels
    b.append(rrect(40, 115, 252, 372, TAN_FILL, TAN_BORDER, sw=3, r=14))
    b.append(text(166, 158, "ENVIRONMENT", size=21, fill="#7a5f14",
                  weight="bold", spacing="1"))
    b.append(f'<line x1="70" y1="172" x2="262" y2="172" stroke="{TAN_BORDER}" stroke-width="1.5"/>')
    y = 210
    for item in ENVIRONMENT_ITEMS:
        b.append(lines(66, y, item, size=15.5, anchor="start"))
        y += 22.5 * len(item) + 22

    b.append(rrect(908, 115, 252, 372, PURPLE_FILL, PURPLE_BORDER, sw=3, r=14))
    b.append(text(1034, 158, "KNOWLEDGE BASE", size=21, fill="#5b4485",
                  weight="bold", spacing="1"))
    b.append(f'<line x1="938" y1="172" x2="1130" y2="172" stroke="{PURPLE_BORDER}" stroke-width="1.5"/>')
    y = 210
    for item in KNOWLEDGE_ITEMS:
        b.append(lines(934, y, item, size=15.5, anchor="start"))
        y += 22.5 * len(item) + 22

    # centre panel — height follows the phase stack (ends ~519) plus padding
    b.append(rrect(368, 38, 464, 503, PANEL_FILL, NAVY, sw=3.5, r=16))
    b.append(text(600, 76, "DESIGN SCIENCE — BUILD & EVALUATE", size=20,
                  fill=NAVY, weight="bold", spacing="0.5"))

    py = 96
    for title, body_rows, green in PHASES:
        bh = 34 + 21 * len(body_rows)
        fill, border = (GREEN_FILL, GREEN_BORDER) if green else (BLUE_FILL, BLUE_BORDER)
        tfill = GREEN_BORDER if green else NAVY
        b.append(rrect(392, py, 416, bh, fill, border, sw=2.5, r=8))
        b.append(text(410, py + 25, title, size=16, fill=tfill,
                      weight="bold", anchor="start"))
        b.append(lines(410, py + 46, body_rows, size=14.5, lh=21, anchor="start"))
        py += bh
        if (title, body_rows, green) != PHASES[-1]:
            b.append(varrow(600, py - 2, py + 16, sw=4, head=11))
            py += 16

    # corpus box
    b.append(varrow(600, 543, 567))
    b.append(rrect(428, 569, 344, 56, NAVY, NAVY, r=10))
    b.append(text(600, 593, CORPUS_TITLE, size=17, fill="#ffffff", weight="bold"))
    b.append(text(600, 615, CORPUS_SUB, size=13.5, fill="#c9d6e8"))

    # relevance / rigor cycles
    b.append(harrow(294, 366, 240))
    b.append(harrow(366, 294, 420))
    b.append(f'<text x="333" y="330" font-family="{FONT}" font-size="14" '
             f'fill="#8a5a1a" font-weight="bold" text-anchor="middle" '
             f'letter-spacing="1.5" transform="rotate(-90 333 330)">RELEVANCE CYCLE</text>')
    b.append(harrow(834, 906, 240))
    b.append(harrow(906, 834, 420))
    b.append(f'<text x="868" y="330" font-family="{FONT}" font-size="14" '
             f'fill="#8a2a3a" font-weight="bold" text-anchor="middle" '
             f'letter-spacing="1.5" transform="rotate(-90 868 330)">RIGOR CYCLE</text>')

    return svg_doc(W, H, "\n".join(b))

# -------------------------------------------------------------- figure 2 ----
def figure2():
    W, H = 1200, 720
    b = []
    x0, bw = 40, 810                       # layer band geometry
    band_tops, band_h = [], {}

    ys = 30
    heights = [140, 150, 150, 120]
    for (title, green, boxes), bh in zip(LAYERS, heights):
        band_tops.append(ys)
        band_h[ys] = bh
        fill, border = (GREEN_PANEL, GREEN_BORDER) if green else (PANEL_FILL, NAVY)
        tfill = GREEN_BORDER if green else NAVY
        b.append(rrect(x0, ys, bw, bh, fill, border, sw=3, r=12))
        b.append(text(x0 + 22, ys + 30, title, size=17.5, fill=tfill,
                      weight="bold", anchor="start"))
        # inner boxes
        n = len(boxes)
        pad, gap = 24, 16
        iw = (bw - 2 * pad - (n - 1) * gap) / n
        iy = ys + 44
        ih = bh - 44 - 14
        bfill, bborder = (GREEN_FILL, GREEN_BORDER) if green else (BLUE_FILL, BLUE_BORDER)
        for i, rows in enumerate(boxes):
            ix = x0 + pad + i * (iw + gap)
            b.append(rrect(ix, iy, iw, ih, bfill, bborder, sw=2, r=8))
            lh = 20
            ty = iy + ih / 2 - (len(rows) - 1) * lh / 2 + 5
            b.append(lines(ix + iw / 2, ty, rows, size=13.5, lh=lh))
        ys += bh
        # connector
        if (title, green, boxes) != LAYERS[-1]:
            b.append(varrow(x0 + bw / 2, ys + 3, ys + 27, sw=4, head=11))
            label = FLOW_LABELS[len(band_tops) - 1]
            b.append(text(x0 + bw / 2 + 18, ys + 20, label, size=13.5,
                          fill=GREY, style="italic", anchor="start"))
            ys += 30

    # validation contract panel
    vx, vy, vw, vh = 895, 170, 265, 480
    b.append(rrect(vx, vy, vw, vh, NAVY, NAVY, r=14))
    b.append(lines(vx + vw / 2, vy + 44, CONTRACT_TITLE, size=20, lh=28,
                   fill="#ffffff", weight="bold", spacing="1"))
    b.append(f'<line x1="{vx+30}" y1="{vy+92}" x2="{vx+vw-30}" y2="{vy+92}" '
             f'stroke="#7d93b5" stroke-width="1.5"/>')
    yy = vy + 126
    for row in CONTRACT_BODY:
        if row:
            size = 16 if row == "XSD + JSON Schema" else 14.5
            b.append(text(vx + vw / 2, yy, row, size=size, fill="#e8eef7"))
        yy += 24 if row else 14

    # red arrows: contract -> API / core / persistence bands
    for target_y in (band_tops[1] + heights[1] / 2,
                     band_tops[2] + heights[2] / 2,
                     band_tops[3] + heights[3] / 2):
        b.append(harrow(vx - 2, x0 + bw + 8, target_y, color=RED, sw=3.5, head=11))

    return svg_doc(W, H, "\n".join(b))

# --------------------------------------------------------------- render -----
def main():
    outputs = {"fig1-dsr": figure1(), "fig2-architecture": figure2()}
    for name, svg in outputs.items():
        svg_path = HERE / f"{name}.svg"
        svg_path.write_text(svg, encoding="utf-8")
        print(f"wrote {svg_path}")
        if shutil.which("rsvg-convert"):
            png_path = HERE / f"{name}.png"
            subprocess.run(["rsvg-convert", "-w", "2400", "-o", str(png_path),
                            str(svg_path)], check=True)
            print(f"wrote {png_path}")
        else:
            print("rsvg-convert not found — install librsvg to render PNGs")

if __name__ == "__main__":
    main()
