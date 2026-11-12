"""Construye data/bank.json y data/import-report.{json,md} a partir de los dos PDF.

Uso (desde app/):  python -I -X utf8 scripts/build_bank.py
Requiere `pdftotext` (poppler) en el PATH. Los PDF se buscan en la carpeta padre de app/.
Pasos: pdftotext -layout -> parse_gorgotsias.py / parse_messer.py -> fusión, validaciones, duplicados.
El texto original (enunciados/opciones) y las explicaciones se guardan en campos separados.
"""
import glob
import hashlib
import itertools
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(APP)
DATA = os.path.join(APP, "data")
WORK = os.path.join(DATA, "_work")
os.makedirs(WORK, exist_ok=True)

gor_pdf = glob.glob(os.path.join(ROOT, "*gorgotsias*.pdf"))[0]
msr_pdf = glob.glob(os.path.join(ROOT, "*messer*.pdf"))[0]


def sh(*args):
    subprocess.run(args, check=True)


sh("pdftotext", "-enc", "UTF-8", "-layout", gor_pdf, os.path.join(WORK, "gor.txt"))
sh("pdftotext", "-enc", "UTF-8", "-layout", msr_pdf, os.path.join(WORK, "msr.txt"))
sh(sys.executable, "-I", os.path.join(HERE, "parse_gorgotsias.py"), os.path.join(WORK, "gor.txt"), os.path.join(WORK, "gor.json"))
sh(sys.executable, "-I", os.path.join(HERE, "parse_messer.py"), os.path.join(WORK, "msr.txt"), os.path.join(WORK, "msr.json"))

gor = json.load(open(os.path.join(WORK, "gor.json"), encoding="utf8"))
msr = json.load(open(os.path.join(WORK, "msr.json"), encoding="utf8"))
ai_msr = json.load(open(os.path.join(DATA, "ai_explanations_messer.json"), encoding="utf8"))

TOPICS = {
    "cap1": "Chapter 1 · General Security Concepts",
    "cap2": "Chapter 2 · Threats, Vulnerabilities, and Mitigations",
    "cap3": "Chapter 3 · Implementation",
    "cap4": "Chapter 4 · Security Operations",
    "cap5": "Chapter 5 · Security Program Management and Oversight",
}


def norm(x):
    return re.sub(r"\s+", " ", x).strip()


def flat(x):
    return re.sub(r"[^0-9a-z]", "", x.lower())


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


def reflow(text):
    paras, cur = [], []
    for l in text.split("\n"):
        if l.strip():
            cur.append(l.strip())
        elif cur:
            paras.append(cur)
            cur = []
    if cur:
        paras.append(cur)
    return "\n\n".join(joinlines(p) for p in paras)


def parse_explanation(raw, options):
    """Divide 'Correct Answer: X. ...' + párrafos 'Option Y is incorrect.' (texto del PDF, sin reescribir)."""
    m = re.match(r"\s*Correct Answers?:\s*([A-H](?:\s*(?:,|and|&)\s*[A-H])*)\s*\.\s*", raw)
    letters = re.findall(r"[A-H]", m.group(1)) if m else []
    body = raw[m.end():] if m else raw
    # texto de la opción correcta que repite el PDF tras la letra
    lines = body.split("\n")
    idx = [i for i, l in enumerate(lines) if re.match(r"^Option [A-H] is incorrect", l)]
    main = "\n".join(lines[: idx[0]] if idx else lines)
    per = {}
    for n, i in enumerate(idx):
        j = idx[n + 1] if n + 1 < len(idx) else len(lines)
        letter = re.match(r"^Option ([A-H])", lines[i]).group(1)
        per[letter] = reflow("\n".join(lines[i:j]))
    return letters, reflow(main), per, (m.group(0) if m else "")


def stem_blocks_text(s):
    return [{"type": "text", "text": t} for t in s.split("\n\n") if t]


questions = []
for r in gor["questions"]:
    sec = r["section"]
    topic = TOPICS.get(sec, "Exam Simulator #" + sec[3:])
    qid = f"gor-{sec}-{r['number']:04d}"
    letters, main, per, prefix = parse_explanation(r["explanation_raw"], r["options"])
    reasons, notes = [], []
    opt_by = {o["letter"]: o["text"] for o in r["options"]}
    # la explicación repite el texto de la opción correcta tras la letra: comprobar coherencia
    if letters:
        correct_txt = flat(opt_by.get(letters[0], ""))
        if correct_txt and correct_txt not in flat(r["explanation_raw"])[: len(correct_txt) + 40]:
            # el texto de la opción correcta no aparece al inicio de la explicación
            reasons.append(f"Contradicción en el PDF: la explicación que figura con este número (pág. {r['answer_page']}) indica la letra {letters[0]} con un texto que no es la opción {letters[0]} de esta pregunta (pág. {r['page']}); parece pertenecer a otra pregunta. No se resolvió automáticamente.")
    else:
        reasons.append("No se pudo leer la letra de la respuesta correcta.")
    if r["answer_repeat_matches"] is False:
        a = r["answer_repeat"]
        same_opts = [(o["letter"], flat(o["text"])) for o in a["options"]] == [(o["letter"], flat(o["text"])) for o in r["options"]]
        whole_q = flat(r["stem"] + "".join(o["text"] for o in r["options"]))
        whole_a = flat(a["stem"] + "".join(o["text"] for o in a["options"]))
        if whole_q == whole_a:
            notes.append(f"La copia de la pregunta en la sección de respuestas (pág. {r['answer_page']}) sólo difiere en la maquetación (ej. '((A)').")
        elif same_opts:
            notes.append(f"La copia de la pregunta en la sección de respuestas (pág. {r['answer_page']}) difiere ligeramente del enunciado (variación del propio PDF); se conserva el texto de la sección de preguntas.")
        elif not reasons:
            notes.append(f"La copia de la pregunta en la sección de respuestas (pág. {r['answer_page']}) tiene el texto de las opciones desordenado (error de maquetación del PDF); la explicación concuerda con las opciones de la sección de preguntas (pág. {r['page']}).")
        else:
            reasons.append(
                f"Contradicción en el PDF: en la sección de respuestas (pág. {r['answer_page']}) las opciones de esta pregunta son distintas "
                f"(A: «{a['options'][0]['text'][:60]}…») y la explicación no corresponde a las opciones de la pág. {r['page']}."
            )
    if r["explanation_num_matches"] is False:
        notes.append("La explicación está numerada con otro número en el PDF; se vinculó por posición y el contenido concuerda con la pregunta.")
    q = {
        "id": qid,
        "doc": "gorgotsias",
        "group": r["group"],
        "section": sec,
        "topic": topic,
        "number": r["number"],
        "originalLabel": f"Question {r['number']}",
        "page": r["page"],
        "printedPage": r["page"],
        "stem": stem_blocks_text(r["stem"]),
        "options": [{"id": f"{qid}-{o['letter']}", "letter": o["letter"], "text": o["text"]} for o in r["options"]],
        "selectionType": "multiple" if len(letters) > 1 else "single",
        "correct": letters,
        "answerStatus": "pdf" if not reasons else "pending",
        "answerSource": {"doc": "gorgotsias", "page": r["answer_page"], "printedPage": r["answer_page"], "kind": "explanation"},
        "explanation": {"origin": "pdf", "language": "en", "text": main, "perOption": per},
        "review": {"status": "ok" if not reasons else "pending", "reasons": reasons, "notes": notes},
        "fragment": {
            "questionPage": r["page"],
            "question": f"Question {r['number']}. " + r["fragment_q"],
            "answerPage": r["answer_page"],
            "answer": f"Question {r['number']}. " + r["fragment_a"],
        },
        "duplicates": [],
        "similar": [],
    }
    questions.append(q)

# Messer
for r in msr["questions"]:
    qid = f"msr-a{r['number']:03d}"
    letters = r["key"] or []
    ai = ai_msr.get(str(r["number"]))
    reasons = [] if letters else ["Sin respuesta en la clave del PDF."]
    questions.append(
        {
            "id": qid,
            "doc": "messer",
            "group": "pe-a",
            "section": "pe-a",
            "topic": "Practice Exam A",
            "number": r["number"],
            "originalLabel": f"A{r['number']}",
            "page": r["page"],
            "printedPage": r["printedPage"],
            "stem": r["stem"],
            "options": [{"id": f"{qid}-{o['letter']}", "letter": o["letter"], "text": o["text"]} for o in r["options"]],
            "selectionType": "multiple" if len(letters) > 1 else "single",
            "correct": letters,
            "answerStatus": "pdf" if letters else "pending",
            "answerSource": {"doc": "messer", "page": 17, "printedPage": 33, "kind": "quick_key"},
            "explanation": {"origin": "ai", "language": "es", "text": ai, "perOption": {}} if ai else None,
            "review": {"status": "ok" if not reasons else "pending", "reasons": reasons, "notes": []},
            "fragment": {
                "questionPage": r["page"],
                "questionImage": f"pages/messer/p-{r['page']:02d}.jpg",
                "answerPage": 17,
                "answerImage": "pages/messer/p-17.jpg",
            },
            "duplicates": [],
            "similar": [],
        }
    )

# ---- duplicados / similares ---------------------------------------------------------------
def qtext(q):
    return " ".join(b["text"] for b in q["stem"])


def sig(q):
    return flat(qtext(q)) + "|" + "|".join(flat(o["text"]) for o in q["options"])


groups = defaultdict(list)
for q in questions:
    groups[sig(q)].append(q)
for g in groups.values():
    if len(g) > 1:
        for q in g:
            q["duplicates"] = [x["id"] for x in g if x["id"] != q["id"]]

by_id = {q["id"]: q for q in questions}


def shingles(q):
    words = re.findall(r"[a-z0-9]+", (qtext(q) + " " + " ".join(o["text"] for o in q["options"])).lower())
    return {" ".join(words[i : i + 4]) for i in range(max(1, len(words) - 3))}


sh_cache = {q["id"]: shingles(q) for q in questions}
inverted = defaultdict(set)
for qid, s in sh_cache.items():
    for x in s:
        inverted[x].add(qid)
cands = defaultdict(Counter)
for qid, s in sh_cache.items():
    for x in s:
        if len(inverted[x]) <= 12:
            for o in inverted[x]:
                if o > qid:
                    cands[qid][o] += 1
seen_pairs = set()
for qid, c in cands.items():
    for o, cnt in c.items():
        a, b = sh_cache[qid], sh_cache[o]
        j = len(a & b) / len(a | b)
        if j >= 0.6 and o not in by_id[qid]["duplicates"]:
            seen_pairs.add((qid, o, round(j, 2)))
for a, b, j in seen_pairs:
    by_id[a]["similar"].append({"id": b, "score": j})
    by_id[b]["similar"].append({"id": a, "score": j})

# respuestas distintas entre duplicados idénticos
dup_conflicts = []
for g in groups.values():
    if len(g) > 1 and len({tuple(x["correct"]) for x in g}) > 1:
        dup_conflicts.append([x["id"] for x in g])
        for q in g:
            q["review"]["notes"].append("Duplicado idéntico con una letra correcta distinta en otra ubicación: " + ", ".join(x["id"] for x in g if x["id"] != q["id"]))

for q in questions:
    q["scorable"] = q["answerStatus"] == "pdf" and q["review"]["status"] == "ok" and len(q["correct"]) > 0
    q["contentHash"] = hashlib.sha1(
        json.dumps([q["stem"], [(o["letter"], o["text"]) for o in q["options"]], q["correct"]], ensure_ascii=False, sort_keys=True).encode("utf8")
    ).hexdigest()[:10]

# PBQ de Messer (soluciones detalladas en imágenes; el PDF no incluye los enunciados interactivos)
pbq_defs = [
    ("A1", [19, 20], "Match the description with the most accurate attack type. Not all attack types will be used."),
    ("A2", [21, 22], None),
    ("A3", [23], "Select the most appropriate security category. Some categories may be used more than once."),
    ("A4", [24], "Match the appropriate authentication factor to each description. Each authentication factor will be used once."),
    ("A5", [25], "Configure the following stateful firewall rules"),
]
msr_text = open(os.path.join(WORK, "msr.txt"), encoding="utf8").read().split("\f")
a2 = re.search(r"A2\.\s+(.*?)\n\n", msr_text[20], re.S)
pbqs = []
for label, pgs, title in pbq_defs:
    pbqs.append(
        {
            "id": f"msr-pbq-{label.lower()}",
            "doc": "messer",
            "originalLabel": label,
            "kind": "pbq-solution",
            "title": title or (norm(a2.group(1)) if a2 else None),
            "pages": pgs,
            "printedPages": [p + 16 for p in pgs],
            "images": [f"pages/messer/p-{p:02d}.jpg" for p in pgs],
            "text": "\n\n".join(msr_text[p - 1].strip("\n") for p in pgs),
            "note": "Solución detallada del PDF (imagen). El extracto no incluye el enunciado interactivo original, por eso no se puntúa.",
            "scorable": False,
        }
    )

# ---- salida ---------------------------------------------------------------------------------
version = hashlib.sha1("".join(q["contentHash"] + q["id"] for q in questions).encode()).hexdigest()[:10]
bank = {
    "bankVersion": version,
    "generatedAt": date.today().isoformat(),
    "documents": [
        {"id": "gorgotsias", "title": "CompTIA Security+ SY0-701 Practice Tests & PBQs (Nikolaos Gorgotsias / ExamsDigest)", "file": os.path.basename(gor_pdf), "pages": 1620},
        {"id": "messer", "title": "Professor Messer SY0-701 Practice Exams v18 (extracto: Practice Exam A)", "file": os.path.basename(msr_pdf), "pages": 25},
    ],
    "questions": questions,
    "pbq": pbqs,
}
json.dump(bank, open(os.path.join(DATA, "bank.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

stats = {}
for d in ("gorgotsias", "messer"):
    qs = [q for q in questions if q["doc"] == d]
    stats[d] = {
        "found": len(qs),
        "answerFromPdf": sum(q["answerStatus"] == "pdf" for q in qs),
        "aiProposedAnswers": sum(q["answerStatus"] == "ai_proposed" for q in qs),
        "pending": sum(q["review"]["status"] == "pending" for q in qs),
        "scorable": sum(q["scorable"] for q in qs),
        "multiple": sum(q["selectionType"] == "multiple" for q in qs),
        "explanationFromPdf": sum(bool(q["explanation"]) and q["explanation"]["origin"] == "pdf" for q in qs),
        "explanationAi": sum(bool(q["explanation"]) and q["explanation"]["origin"] == "ai" for q in qs),
        "withNotes": sum(bool(q["review"]["notes"]) for q in qs),
        "bySection": dict(Counter(q["section"] for q in qs)),
    }
report = {
    "bankVersion": version,
    "stats": stats,
    "pbqSolutions": len(pbqs),
    "pending": [{"id": q["id"], "label": q["originalLabel"], "page": q["page"], "reasons": q["review"]["reasons"]} for q in questions if q["review"]["status"] == "pending"],
    "notes": [{"id": q["id"], "notes": q["review"]["notes"]} for q in questions if q["review"]["notes"]],
    "identicalDuplicateGroups": len([g for g in groups.values() if len(g) > 1]),
    "questionsInIdenticalDuplicateGroups": sum(len(g) for g in groups.values() if len(g) > 1),
    "duplicateAnswerConflicts": dup_conflicts,
    "similarPairs": len(seen_pairs),
    "answerLetterDistribution": dict(Counter(l for q in questions if q["doc"] == "gorgotsias" for l in q["correct"])),
}
json.dump(report, open(os.path.join(DATA, "import-report.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in report.items() if k not in ("notes",)}, ensure_ascii=False, indent=1))
