"""Extrae el libro completo de Professor Messer (3 exámenes: A, B, C) de `pdftotext -layout`.

Uso: python -I -X utf8 parse_messer_full.py <texto_layout.txt> <salida.json>
Estructura por examen X: PBQ X1-X5 (imágenes), preguntas de opción X6-X90, clave rápida, respuestas detalladas
("The Answer: ...", "The incorrect answers:", "More information: SY0-701, Objective ...").
La respuesta se obtiene de DOS fuentes del propio PDF (clave rápida y "The Answer:"); se cruzan.
"""
import json
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
pages = open(SRC, encoding="utf8").read().split("\f")
BULLET = "❍"

HEADS = {
    "Performance-Based Questions": "pbq_q",
    "Multiple Choice Questions": "mcq_q",
    "Multiple Choice Quick Answers": "key",
    "Detailed Answers": "ans",
}
FOOT1 = re.compile(r"^\s*(\d+)\s+Practice Exam [ABC] - (Questions|Answers)\s*$")
FOOT2 = re.compile(r"^\s*Practice Exam [ABC] - (Questions|Answers)\s+(\d+)\s*$")
RIGHT = re.compile(r"(\s{2,}(Quick|Answer: \d+)|\s+The Details: \d+)\s*$")
FOOT3 = re.compile(r"^\s*Practice Exam [ABC] - (Questions|Answers)\s*$")
NUMLINE = re.compile(r"^\s{25,}(\d{1,3})\s*$")
QSTART = re.compile(r"^\s{0,8}([ABC])(\d+)\.\s*(.*)$")
OPT = re.compile(r"^\s*" + BULLET + r"\s+([A-H])\.\s+(.*)$")
LET = r"[A-H](?:\s*,\s*[A-H])*(?:\s*,?\s*and\s+[A-H])?"


def joinlines(parts):
    out = ""
    for x in parts:
        if not out:
            out = x
        elif re.search(r"[A-Za-z]-$", out) and x[:1].islower():
            out += x
        else:
            out += " " + x
    return out


HTTP_RE = re.compile(r"^(GET|POST|PUT|HEAD|DELETE)\s+(https?://|/)\S+")


def stem_blocks(stem):
    """Bloques del enunciado a partir de las líneas de maquetación.
    - Párrafos = separados por línea en blanco; un párrafo se parte tras una línea que termina en ':'.
    - Código/log: los párrafos que siguen a uno que termina en ':' (salvo el último, que es la frase de la
      pregunta) o que empiezan por una petición HTTP. Se conservan sus saltos de línea.
    - Viñetas '•': cada una es un bloque de texto propio.
    - La prosa partida por saltos de maquetación se une en un solo párrafo."""
    paras, cur = [], []
    for l in stem:
        if not l.strip():
            if cur:
                paras.append(cur)
                cur = []
        else:
            cur.append(l)
            if l.rstrip().endswith(":"):
                paras.append(cur)
                cur = []
    if cur:
        paras.append(cur)
    out = []
    after_colon = False
    for idx, pl in enumerate(paras):
        lines = [x.strip() for x in pl]
        last = idx == len(paras) - 1
        is_http = bool(HTTP_RE.match(lines[0]))
        if lines[0].startswith("•"):
            items, curi = [], []
            for x in lines:
                if x.startswith("•") and curi:
                    items.append(curi)
                    curi = []
                curi.append(x)
            items.append(curi)
            for it in items:
                out.append({"type": "text", "text": joinlines(it), "bullet": True})
            continue
        if (after_colon and not last) or is_http:
            out.append({"type": "code", "text": "\n".join(lines)})
            continue
        out.append({"type": "text", "text": joinlines(lines)})
        after_colon = lines[-1].endswith(":")
    # unir prosa consecutiva (no viñetas) partida por la maquetación
    merged = []
    for b in out:
        if (
            merged
            and b["type"] == "text"
            and merged[-1]["type"] == "text"
            and not b.get("bullet")
            and not merged[-1].get("bullet")
            and not merged[-1]["text"].endswith(":")
        ):
            merged[-1]["text"] = joinlines([merged[-1]["text"], b["text"]])
        else:
            merged.append(b)
    for b in merged:
        b.pop("bullet", None)
    return merged


def structure(lines):
    stem, opts, cur = [], [], None
    for l in lines:
        m = OPT.match(l)
        if m:
            cur = {"letter": m.group(1), "lines": [m.group(2)]}
            opts.append(cur)
        elif cur is None:
            stem.append(l)
        elif l.strip():
            cur["lines"].append(l.strip())
    return stem_blocks(stem), [{"letter": o["letter"], "text": joinlines(o["lines"])} for o in opts]


def norm(x):
    return re.sub(r"\s+", " ", x).strip()


def flat(x):
    return re.sub(r"[^0-9a-z]", "", x.lower())


# ---- 1. recorrer páginas: estado (examen, sección) y pie impreso ---------------------------
state = (None, None)
streams = {"pbq_q": [], "mcq_q": [], "ans": []}
keytext = {}
printed = {}
page_state = {}
for p in range(9, len(pages) + 1):
    raw = pages[p - 1].split("\n")
    ne = [l.strip() for l in raw if l.strip()]
    if len(ne) >= 2:
        m = re.match(r"^Practice Exam ([ABC])$", ne[0])
        if m and ne[1] in HEADS:
            state = (m.group(1), HEADS[ne[1]])
    exam, sec = state
    lines = []
    for l in raw:
        m1, m2 = FOOT1.match(l), FOOT2.match(l)
        if FOOT3.match(l):
            continue
        mn = NUMLINE.match(l)
        if mn and not m1 and not m2:
            printed.setdefault(p, int(mn.group(1)))
            continue
        if m1:
            printed[p] = int(m1.group(1))
            continue
        if m2:
            printed[p] = int(m2.group(2))
            continue
        lines.append(l)
    page_state[p] = state
    if exam is None or sec is None:
        continue
    if sec == "key":
        keytext.setdefault(exam, []).append("\n".join(lines))
        continue
    if ne and ne[0] == f"Practice Exam {exam}" and len(ne) > 1 and ne[1] in HEADS:
        # quitar las dos líneas de encabezado
        removed = 0
        out = []
        for l in lines:
            if removed < 2 and l.strip():
                removed += 1
                continue
            out.append(l)
        lines = out
    for l in lines:
        l = (re.sub(r"\s{20,}\d{1,3}\s*$", "", RIGHT.sub("", l))).rstrip() if sec == "mcq_q" else l.rstrip()
        if sec == "mcq_q" and re.fullmatch(r"\s*(Quick|Answer: \d+|The Details: \d+)\s*", l):
            continue
        streams[sec].append((exam, p, l))

offsets = {printed[p] - p for p in printed}


def printed_of(p):
    return printed.get(p, p - 9)


# ---- 2. clave rápida -----------------------------------------------------------------------
key = {}
for exam, txts in keytext.items():
    for m in re.finditer(r"([ABC])(\d+)\.\s+(" + LET + r")(?=\s{2,}|\s*$|\n)", "\n".join(txts)):
        key[(m.group(1), int(m.group(2)))] = re.findall(r"[A-H]", m.group(3))

# ---- 3. preguntas de opción (sección de preguntas) -----------------------------------------
def blocks_of(stream):
    blocks, cur = [], None
    for exam, p, l in stream:
        m = QSTART.match(l)
        if m and m.group(1) == exam and not OPT.match(l):
            cur = {"exam": exam, "n": int(m.group(2)), "page": p, "lines": [m.group(3)], "pages": {p}}
            blocks.append(cur)
        elif cur is not None and cur["exam"] == exam:
            cur["lines"].append(l)
            cur["pages"].add(p)
    return blocks


qblocks = blocks_of(streams["mcq_q"])
pbq_q = blocks_of(streams["pbq_q"])
ablocks = blocks_of(streams["ans"])

def consume_flat(text, opt):
    """Longitud de `text` que cubre el texto de la opción `opt` (ignorando espacios/puntuación) o None."""
    target = [c for c in opt.lower() if c.isalnum()]
    j = 0
    for i, c in enumerate(text):
        if j == len(target):
            return i
        if not c.isalnum():
            continue
        if c.lower() != target[j]:
            return None
        j += 1
    return len(text) if j == len(target) else None


# ---- 4. respuestas detalladas ---------------------------------------------------------------
def parse_answer(block):
    lines = block["lines"]
    # pregunta repetida: hasta la línea "The Answer:"
    idx = next((i for i, l in enumerate(lines) if re.match(r"^\s*The Answers?:", l)), None)
    if idx is None:
        return None
    qpart, rest = lines[:idx], lines[idx:]
    stem, opts = structure(qpart)
    # "The Answer: B. Passive reconnaissance" puede ocupar varias líneas hasta la primera línea en blanco
    head = []
    j = 0
    while j < len(rest) and (j == 0 or rest[j].strip()):
        head.append(rest[j].strip())
        j += 1
    head_txt = norm(" ".join(head))
    m = re.match(r"The Answers?:\s*(.*)$", head_txt)
    remaining = m.group(1) if m else head_txt
    # Se consumen elementos "X. <texto exacto de la opción X>" separados por coma / "and".
    # El resto (si la explicación empieza sin línea en blanco) se antepone a la explicación.
    opt_by = {o["letter"]: o["text"] for o in opts}
    letters, consumed = [], []
    while True:
        mm = re.match(r"^[\s,]*(?:and\s+)?([A-H])\.\s+", remaining)
        if not mm or mm.group(1) not in opt_by:
            break
        L = mm.group(1)
        after = remaining[mm.end():]
        used = consume_flat(after, opt_by[L])
        if used is None:
            letters = None
            break
        letters.append(L)
        consumed.append(L + ". " + after[:used].strip())
        remaining = after[used:]
    leftover = remaining.strip(" ,.") if letters else ""
    variant = False
    if letters is None:  # el texto de la respuesta no repite literalmente la opción: se toman sólo las letras
        variant = True
        first = m.group(1) if m else head_txt
        letters = []
        mm2 = re.match(r"^\s*([A-H])\.\s", first)
        if mm2 and mm2.group(1) in opt_by:
            letters = [mm2.group(1)]
        leftover, consumed = "", [norm(" ".join(head))[:200]]
    answer_text = " | ".join(consumed)
    body = ([leftover, ""] if leftover else []) + rest[j:]
    # separar secciones
    k_inc = next((i for i, l in enumerate(body) if re.match(r"^\s*The incorrect answers?:", l)), None)
    k_more = next((i for i, l in enumerate(body) if re.match(r"^\s*More information:", l)), None)
    end_main = min(x for x in (k_inc, k_more, len(body)) if x is not None)
    main_lines = body[:end_main]
    paras, cur = [], []
    for l in main_lines:
        if l.strip():
            cur.append(l.strip())
        elif cur:
            paras.append(cur)
            cur = []
    if cur:
        paras.append(cur)
    main = "\n\n".join(joinlines(pp) for pp in paras)
    per = {}
    if k_inc is not None:
        seg = body[k_inc + 1 : k_more if k_more is not None else len(body)]
        cur_l, buf = None, []
        for l in seg:
            m2 = re.match(r"^\s*([A-H])\.\s+(.*)$", l)
            if m2 and len(l) - len(l.lstrip()) <= 8 and (cur_l is None or not l.startswith(" " * 12)):
                if cur_l:
                    per[cur_l] = buf
                cur_l, buf = m2.group(1), [("T", m2.group(2))]
            elif cur_l and l.strip():
                buf.append(("B", l.strip()))
        if cur_l:
            per[cur_l] = buf
    per_out = {}
    for letter, buf in per.items():
        title = buf[0][1]
        body_txt = joinlines([t for kind, t in buf[1:]])
        per_out[letter] = {"title": title, "text": body_txt}
    objective = None
    if k_more is not None:
        more = norm(" ".join(l.strip() for l in body[k_more + 1 :] if l.strip()))
        mo = re.search(r"SY0-701, Objective ([\d.]+) - (.*?)\s*(https?://\S+)?$", more)
        if mo:
            objective = {"code": mo.group(1), "title": mo.group(2).strip(), "url": mo.group(3)}
        else:
            objective = {"raw": more}
    return {
        "stem": stem,
        "options": opts,
        "letters": letters,
        "answer_text_variant": variant,
        "answer_text": answer_text,
        "main": main,
        "per": per_out,
        "objective": objective,
        "raw": "\n".join(lines).strip("\n"),
    }


amap = {}
for b in ablocks:
    amap.setdefault((b["exam"], b["n"]), []).append(b)

questions, problems = [], []
for b in qblocks:
    stem, opts = structure(b["lines"])
    k = (b["exam"], b["n"])
    rec = {
        "exam": b["exam"],
        "number": b["n"],
        "page": b["page"],
        "printedPage": printed_of(b["page"]),
        "stem": stem,
        "options": opts,
        "key": key.get(k),
        "fragment_q": "\n".join(l for l in b["lines"]).strip("\n"),
    }
    ab = amap.get(k)
    if not ab:
        problems.append({"kind": "sin_respuesta_detallada", "key": list(k)})
    else:
        if len(ab) > 1:
            problems.append({"kind": "respuesta_detallada_duplicada", "key": list(k)})
        pa = parse_answer(ab[0])
        if pa is None:
            problems.append({"kind": "sin_linea_The_Answer", "key": list(k), "page": ab[0]["page"]})
        else:
            rec["answer_page"] = ab[0]["page"]
            rec["answer_printedPage"] = printed_of(ab[0]["page"])
            rec["answer_pages"] = sorted(ab[0]["pages"])
            rec["ans"] = pa
            rec["repeat_matches"] = (
                [(o["letter"], flat(o["text"])) for o in pa["options"]] == [(o["letter"], flat(o["text"])) for o in opts]
                and flat(" ".join(x["text"] for x in pa["stem"])) == flat(" ".join(x["text"] for x in stem))
            )
    questions.append(rec)

# PBQ: páginas de la pregunta y de la respuesta
def page_ranges(blocks):
    out = {}
    for b in blocks:
        out[(b["exam"], b["n"])] = sorted(b["pages"])
    return out


pbq = []
qr, ar = page_ranges(pbq_q), page_ranges([b for b in ablocks if b["n"] <= 5])
for ex in "ABC":
    for n in range(1, 6):
        k = (ex, n)
        qb = next((b for b in pbq_q if (b["exam"], b["n"]) == k), None)
        ab = next((b for b in ablocks if (b["exam"], b["n"]) == k), None)
        if not qb or not ab:
            problems.append({"kind": "pbq_incompleto", "key": list(k)})
            continue
        pbq.append(
            {
                "exam": ex,
                "number": n,
                "title": norm(joinlines([l.strip() for l in qb["lines"][:3] if l.strip()]))[:200],
                "question_pages": sorted(qb["pages"]),
                "answer_pages": sorted(ab["pages"]),
                "printed_question": [printed_of(p) for p in sorted(qb["pages"])],
                "printed_answer": [printed_of(p) for p in sorted(ab["pages"])],
                "question_text": "\n".join(qb["lines"]).strip("\n"),
                "answer_text": "\n".join(ab["lines"]).strip("\n"),
            }
        )

json.dump(
    {"questions": questions, "pbq": pbq, "key": {f"{a}{n}": v for (a, n), v in key.items()}, "problems": problems, "pageOffsets": sorted(offsets)},
    open(OUT, "w", encoding="utf8"),
    ensure_ascii=False,
    indent=1,
)
print("preguntas:", len(questions), "pbq:", len(pbq), "claves:", len(key), "problemas:", len(problems), "offsets:", sorted(offsets))
