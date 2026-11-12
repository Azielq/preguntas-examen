"""Extrae el banco de preguntas del PDF de Gorgotsias a partir de `pdftotext -layout`.

Uso: python -I parse_gorgotsias.py <texto.txt> <salida.json>
El texto de enunciados/opciones se conserva literal; sólo se normalizan los saltos de línea de maquetación.
Recorre el documento secuencialmente: los encabezados "Questions a-b" / "Answers a-b" cambian el modo.
"""
import json
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]

HEAD_RE = re.compile(
    r"^\s*(CHAPTER \d+|GENERAL SECURITY CONCEPTS|THREATS, VULNERABILITIES,? AND MITIGATIONS|IMPLEMENTATION|"
    r"SECURITY OPERATIONS|SECURITY PROGRAM MANAGEMENT AND OVERSIGHT|EXAM SIMULATOR #\d+|"
    r"Exam Simulator #\d+|Questions \d+-\d+|Answers \d+-\d+)\s*$"
)
MODE_RE = re.compile(r"^\s*(Questions|Answers) \d+-\d+\s*$")
CHAP_RE = re.compile(r"^\s*CHAPTER (\d+)\s*$")
SIM_RE = re.compile(r"^\s*EXAM SIMULATOR #(\d+)\s*$", re.I)
QSTART = re.compile(r"^\.?Question (\d+)(?:\.\.?|\s)\s*(.*)$")
ESTART = re.compile(r"^Explanation (\d+)(?:\.\.?|\s)\s*(.*)$")
OPT = re.compile(r"^\s*\(([A-H])\)\s+(.*)$")
OPT_LENIENT = re.compile(r"^\s*\(+([A-H])\)?\s+(.*)$")  # "(D texto" sin paréntesis de cierre (error del PDF)

pages = open(SRC, encoding="utf8").read().split("\f")
FIRST, LAST = 11, 1620

# --- 1. aplanar líneas de contenido con (página, texto, evento) -----------------
stream = []  # (page, line)
for p in range(FIRST, LAST + 1):
    lines = pages[p - 1].split("\n")
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip():
            if re.fullmatch(r"\s*\d{1,4}\s*", lines[i]):
                del lines[i]
            break
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    for l in lines:
        stream.append((p, l.rstrip()))

# --- 2. recorrido con máquina de estados ---------------------------------------
mode, section = None, None
qitems, aitems = [], []  # items en orden documental
curq = cura = None
state = None  # 'q' | 'qrep' | 'expl'

for p, l in stream:
    m = CHAP_RE.match(l)
    if m:
        section = ("cap", "cap" + m.group(1))
        continue
    m = SIM_RE.match(l)
    if m:
        section = ("sim", "sim" + m.group(1))
        continue
    m = MODE_RE.match(l)
    if m:
        mode = "Q" if m.group(1) == "Questions" else "A"
        state = None
        continue
    if HEAD_RE.match(l):
        continue
    if mode is None:
        continue
    qm = QSTART.match(l)
    if qm:
        n = int(qm.group(1))
        if mode == "Q":
            curq = {"group": section[0], "section": section[1], "n": n, "page": p, "q": [qm.group(2)]}
            qitems.append(curq)
            state = "q"
        else:
            cura = {"group": section[0], "section": section[1], "n": n, "page": p, "q": [qm.group(2)], "e": None}
            aitems.append(cura)
            state = "qrep"
        continue
    em = ESTART.match(l)
    if em and mode == "A" and cura is not None:
        cura["e"] = [em.group(2)]
        cura["enum"] = int(em.group(1))
        cura["epage"] = p
        state = "expl"
        continue
    if state == "q":
        curq["q"].append(l)
    elif state == "qrep":
        cura["q"].append(l)
    elif state == "expl":
        cura["e"].append(l)


# --- 3. estructurar -------------------------------------------------------------
def joinlines(parts):
    """Une líneas de maquetación. Si una línea termina en 'letra-' y la siguiente empieza en minúscula,
    se une sin espacio (palabras compuestas como 'off-peak' partidas por el ajuste de línea)."""
    out = ""
    for x in parts:
        if not out:
            out = x
        elif re.search(r"[A-Za-z]-$", out) and x[:1].islower():
            out += x
        else:
            out += " " + x
    return out


def reflow(ls):
    paras, cur = [], []
    for l in ls:
        if not l.strip():
            if cur:
                paras.append(cur)
                cur = []
        else:
            cur.append(l.strip())
    if cur:
        paras.append(cur)
    return "\n\n".join(joinlines(x) for x in paras)


def structure(lines):
    stem, opts, cur = [], [], None
    for l in lines:
        m = OPT.match(l)
        if not m:
            ml = OPT_LENIENT.match(l)
            if ml and opts is not None and ml.group(1) == chr(ord("A") + len(opts)):
                m = ml
        if m:
            cur = {"letter": m.group(1), "lines": [m.group(2)]}
            opts.append(cur)
        elif cur is None:
            stem.append(l)
        elif l.strip():
            cur["lines"].append(l.strip())
    return reflow(stem), [{"letter": o["letter"], "text": joinlines(o["lines"])} for o in opts]


def norm(x):
    return re.sub(r"\s+", " ", x).strip()


problems = []
amap = {}
for a in aitems:
    k = (a["group"], a["section"], a["n"])
    if k in amap:
        problems.append({"kind": "respuesta_duplicada", "key": list(k), "page": a["page"]})
    amap[k] = a

out = []
for q in qitems:
    stem, opts = structure(q["q"])
    rec = {
        "group": q["group"],
        "section": q["section"],
        "number": q["n"],
        "page": q["page"],
        "stem": stem,
        "options": opts,
        "fragment_q": "\n".join(q["q"]).strip("\n"),
    }
    a = amap.get((q["group"], q["section"], q["n"]))
    if a is None or a["e"] is None:
        problems.append({"kind": "sin_explicacion", "key": [q["group"], q["section"], q["n"]], "page": q["page"]})
    else:
        astem, aopts = structure(a["q"])
        rec["answer_page"] = a["epage"]
        rec["answer_repeat_matches"] = (norm(astem) == norm(stem) and [(o["letter"], norm(o["text"])) for o in aopts] == [(o["letter"], norm(o["text"])) for o in opts])
        rec["answer_repeat"] = None if rec["answer_repeat_matches"] else {"stem": astem, "options": aopts}
        rec["explanation_num_matches"] = a.get("enum") == q["n"]
        rec["explanation_raw"] = "\n".join(a["e"]).strip("\n")
        rec["fragment_a"] = "\n".join(a["q"]).strip("\n") + "\n\n" + "\n".join(a["e"]).strip("\n")
    out.append(rec)

json.dump({"questions": out, "problems": problems}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("preguntas:", len(out), "respuestas:", len(aitems), "problemas:", len(problems))
