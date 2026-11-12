"""Verificación independiente del banco: cada enunciado y opción debe aparecer literalmente
(ignorando espacios, saltos de línea y signos de puntuación de ajuste) en una extracción distinta del PDF
(`pdftotext -raw`, sin -layout). Uso (desde app/): python -I -X utf8 scripts/verify_bank.py
Escribe data/verification-report.json y devuelve código 1 si falla alguna comprobación."""
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(APP)
WORK = os.path.join(APP, "data", "_work")

bank = json.load(open(os.path.join(APP, "data", "bank.json"), encoding="utf8"))


def flat(x):
    return re.sub(r"[^0-9a-z]", "", x.lower())


docs = {}
for did, pat in (("gorgotsias", "*gorgotsias*.pdf"), ("messer", "*messer*.pdf")):
    pdf = glob.glob(os.path.join(ROOT, pat))[0]
    out = os.path.join(WORK, f"{did}.raw.txt")
    subprocess.run(["pdftotext", "-enc", "UTF-8", "-raw", pdf, out], check=True)
    pages = open(out, encoding="utf8").read().split("\f")
    # quitar líneas que sean sólo números de página
    cleaned = []
    for p in pages:
        ls = p.split("\n")
        for i in range(len(ls) - 1, -1, -1):  # sólo el pie de página (última línea no vacía)
            if ls[i].strip():
                if re.fullmatch(r"\s*\d{1,4}\s*", ls[i]):
                    del ls[i]
                break
        cleaned.append("\n".join(ls))
    docs[did] = flat("".join(cleaned))
    # para Messer, quitar la columna "Quick Answer / The Details" intercalada
    if did == "messer":
        txt = "\n".join(cleaned)
        txt = re.sub(r"Quick\s*Answer:\s*\d+|The Details:\s*\d+", "", txt)
        txt = re.sub(r"(?m)^\s*(\d+\s+)?Practice Exam A - Questions\s*\d*\s*$", "", txt)
        docs[did] = flat(txt)

fails = []
checked = {"stems": 0, "options": 0}
for q in bank["questions"]:
    D = docs[q["doc"]]
    for b in q["stem"]:  # se comprueba cada bloque (el orden de lectura puede separar logs/código)
        checked["stems"] += 1
        if flat(b["text"]) not in D:
            fails.append({"id": q["id"], "what": "stem " + b["type"]})
    for o in q["options"]:
        checked["options"] += 1
        if flat(o["text"]) not in D:
            fails.append({"id": q["id"], "what": "option " + o["letter"]})

# integridad estructural
struct = []
ids = [q["id"] for q in bank["questions"]]
if len(ids) != len(set(ids)):
    struct.append("ids duplicados")
for q in bank["questions"]:
    letters = [o["letter"] for o in q["options"]]
    if letters != [chr(65 + i) for i in range(len(letters))]:
        struct.append(f"{q['id']}: letras no consecutivas {letters}")
    if q["answerStatus"] == "pdf" and not set(q["correct"]) <= set(letters):
        struct.append(f"{q['id']}: respuesta fuera de las opciones")
    if any(not o["text"].strip() for o in q["options"]) or not "".join(b["text"] for b in q["stem"]).strip():
        struct.append(f"{q['id']}: texto vacío")
    if "�" in json.dumps(q, ensure_ascii=False):
        struct.append(f"{q['id']}: carácter de reemplazo U+FFFD")

report = {"bankVersion": bank["bankVersion"], "checked": checked, "literalMismatches": fails, "structuralProblems": struct}
json.dump(report, open(os.path.join(APP, "data", "verification-report.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(json.dumps({"checked": checked, "literalMismatches": len(fails), "structuralProblems": len(struct)}))
for f in fails[:25]:
    print(" ", f)
for s in struct[:25]:
    print(" ", s)
sys.exit(1 if fails or struct else 0)
