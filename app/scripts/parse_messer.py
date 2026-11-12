"""Extrae preguntas y clave de respuestas del PDF de Professor Messer (extracto de 25 páginas).

Uso: python -I parse_messer.py <texto_layout.txt> <salida.json>
Estructura detectada:
  - PDF págs. 1-14  : preguntas A46-A90 (opción múltiple), columna derecha con "Quick Answer / The Details" (se descarta)
  - PDF pág. 17     : "Multiple Choice Quick Answers" (A6-A90)  -> clave oficial de las preguntas presentes
  - PDF págs. 19-25 : "Detailed Answers" de PBQ A1-A5 (se conservan como imágenes de página, ver export_pbq)
Página impresa = página PDF + 16.
"""
import json
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
pages = open(SRC, encoding="utf8").read().split("\f")
BULLET = "❍"  # ❍
OFFSET = 16

RIGHT = re.compile(r"\s{2,}(Quick|Answer: \d+|The Details: \d+)\s*$")
FOOT = re.compile(r"^\s*(\d+\s+Practice Exam A - Questions|Practice Exam A - Questions\s+\d+)\s*$")
QSTART = re.compile(r"^\s*A(\d+)\.\s+(.*)$")
OPT = re.compile(r"^\s*" + BULLET + r"\s+([A-H])\.\s+(.*)$")


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


def stem_blocks(stem):
    """Bloques del enunciado: prosa (sangría >= 4) o literal/código (sangría < 4; conserva saltos de línea)."""
    out, seg, kind = [], [], None

    def flush():
        if seg:
            text = "\n".join(seg) if kind == "code" else joinlines(seg)
            out.append({"type": kind, "text": text})
            seg.clear()

    for i, l in enumerate(stem):
        if not l.strip():
            flush()
            kind = None
            continue
        ind = len(l) - len(l.lstrip())
        k = "code" if (i > 0 and ind < 4) else "text"
        if k != kind:
            flush()
            kind = k
        seg.append(l.strip())
    flush()
    # bloques intermedios tras un párrafo que termina en ":" (p. ej. entradas de log separadas por línea en blanco)
    for i in range(1, len(out) - 1):
        if out[i]["type"] == "text" and (out[i - 1]["text"].endswith(":") or out[i - 1]["type"] == "code" and out[i - 1].get("_c")):
            out[i]["type"] = "code"
            out[i]["_c"] = True
    for b in out:
        b.pop("_c", None)
    return out


stream = []
for p in range(1, 15):
    for l in pages[p - 1].split("\n"):
        if FOOT.match(l):
            continue
        l = RIGHT.sub("", l).rstrip()
        # quita restos de columna derecha pegados ("Quick" / "Answer: 33" / "The Details: 84" solos en la línea)
        if re.fullmatch(r"\s*(Quick|Answer: \d+|The Details: \d+)\s*", l):
            continue
        stream.append((p, l))

blocks, cur = [], None
for p, l in stream:
    m = QSTART.match(l)
    if m and not OPT.match(l):
        cur = {"n": int(m.group(1)), "page": p, "lines": [m.group(2)]}
        blocks.append(cur)
    elif cur is not None:
        cur["lines"].append(l)

# clave rápida
key = {}
kp = pages[16]
for m in re.finditer(r"A(\d+)\.\s+([A-H](?:\s*,?\s*(?:and\s+)?[A-H])*)(?=\s{2,}|\s*$|\n)", kp):
    letters = re.findall(r"[A-H]", m.group(2))
    key[int(m.group(1))] = letters

questions = []
for b in blocks:
    stem, opts, curo, paras = [], [], None, []
    for l in b["lines"]:
        m = OPT.match(l)
        if m:
            curo = {"letter": m.group(1), "lines": [m.group(2)]}
            opts.append(curo)
        elif curo is None:
            stem.append(l)
        elif l.strip():
            curo["lines"].append(l.strip())
    blocks_out = stem_blocks(stem)
    questions.append(
        {
            "number": b["n"],
            "page": b["page"],
            "printedPage": b["page"] + OFFSET,
            "stem": blocks_out,
            "options": [{"letter": o["letter"], "text": joinlines(o["lines"])} for o in opts],
            "key": key.get(b["n"]),
        }
    )

json.dump({"questions": questions, "key": {str(k): v for k, v in key.items()}}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("preguntas:", len(questions), "clave:", len(key))
