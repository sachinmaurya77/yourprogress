"""Turn study text into multiple-choice questions.

How it works (no AI service needed):
1. Clean the text and split it into sentences.
2. Pick the best key term in each sentence (a defined term, acronym,
   proper noun, number or repeated important word).
3. Replace that term with a blank to make the question.
4. Use similar terms from the same material as wrong options.
"""
import random
import re
from collections import Counter

STOP = set(
    "a about above after again all also am an and any are as at be because been before being below "
    "between both but by can could did do does doing down during each few for from further had has "
    "have having he her here hers him his how i if in into is it its just may me might more most must "
    "my no nor not of off on once only or other our out over own same shall she should so some such "
    "than that the their them then there these they this those through to too under until up very was "
    "we were what when where which while who whom why will with would you your".split()
)


def clean_text(text):
    text = text.replace("\r", "")
    text = re.sub(r"-\n(?=[a-z])", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    lines = [ln.strip() for ln in text.split("\n")]
    out, prev = [], ""
    for i, ln in enumerate(lines):
        if not ln:
            out.append("")
            prev = ""
            continue
        nxt = next((x for x in lines[i + 1:] if x), "")
        short = len(ln.split()) <= 8 and not re.search(r"[.,;:!?)]$", ln)
        fresh = prev == "" or re.search(r"[.!?:]$", prev)
        if short and fresh and (not nxt or not nxt[:1].islower()):
            out += ["", ln, ""]  # looks like a heading: keep it on its own
        else:
            out.append(ln)
        prev = ln
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def sentences_of(text):
    t = re.sub(r"[•●▪◦■►]", "\n\n", text)
    t = re.sub(
        r"\b(e\.g|i\.e|etc|vs|Fig|Dr|Mr|Ms|Mrs|No|approx)\.",
        lambda m: m.group(0)[:-1] + "\x02",
        t,
        flags=re.I,
    )
    out = []
    for para in re.split(r"\n\s*\n", t):
        para = re.sub(r"\s*\n\s*", " ", para)
        para = re.sub(r"\s+", " ", para).strip()
        if not para:
            continue
        para = re.sub(r'([.!?])\s+(?=[A-Z0-9"“(])', "\\1\x01", para)
        for s in para.split("\x01"):
            out.append(s.replace("\x02", ".").strip())
    return out


def valid_sentence(s):
    words = len(s.split())
    if words < 8 or words > 34 or len(s) < 45 or len(s) > 260:
        return False
    if re.search(r"https?:|www\.|@", s):
        return False
    if len(re.findall(r"\d", s)) / len(s) > 0.12:
        return False
    if not re.match(r'^[A-Z"“(]', s):
        return False
    if re.match(r"^(figure|fig\.|table|chapter|unit|page|copyright|note:)", s, re.I):
        return False
    return True


def word_freq(text):
    words = re.findall(r"[a-z][a-z\-]{3,}", text.lower())
    return Counter(w for w in words if w not in STOP)


DEFINITION = re.compile(
    r"^(?:The |An? )?([A-Za-z][A-Za-z0-9\-/ ]{2,38}?) "
    r"(?:is|are|refers to|means|can be defined as|is defined as|is called|are called)\b"
)


def candidates_for(s, freq):
    found = []
    m = DEFINITION.match(s)
    if m:
        t = m.group(1).strip()
        if len(t.split()) <= 4 and t.lower() not in STOP:
            found.append((t, "subj", 100 + freq.get(t.lower(), 0)))
    for t in re.findall(r"\b[A-Z][A-Z0-9]{1,9}\b", s):
        if t not in ("THE", "IS", "OR", "AND"):
            found.append((t, "acr", 60 + freq.get(t.lower(), 0)))
    for mm in re.finditer(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b", s):
        if mm.start() == 0:
            continue
        t = mm.group(0)
        if t.lower() in STOP:
            continue
        found.append((t, "cap", 40 + len(t.split()) * 6 + freq.get(t.lower(), 0)))
    for t in re.findall(r"\b\d+(?:\.\d+)?%?", s):
        found.append((t, "num", 28))
    for t in re.findall(r"\b[a-z][a-z\-]{5,}\b", s):
        if t in STOP:
            continue
        f = freq.get(t, 0)
        if f >= 2:
            found.append((t, "word", f * 2 + len(t)))
    return found


def blank_out(s, term, kind):
    if kind == "subj":
        s = re.sub(r"^(The |An? )", "", s)
    start = 0
    while True:
        i = s.find(term, start)
        if i < 0:
            return None
        before = s[i - 1] if i > 0 else ""
        after = s[i + len(term)] if i + len(term) < len(s) else ""
        if (not before or not before.isalnum()) and (not after or not after.isalnum()):
            return s[:i] + "_____" + s[i + len(term):]
        start = i + 1


def number_distractors(ans):
    pct = ans.endswith("%")
    raw = ans.replace("%", "")
    n = float(raw)
    is_int = "." not in raw
    dec = len(raw.split(".")[1]) if "." in raw else 0

    def fmt(v):
        return (str(int(round(v))) if is_int else f"{v:.{dec}f}") + ("%" if pct else "")

    near = [n + 1, n - 1, n + 2, n - 2, n + 5, n - 5, n + 10, n - 10]
    far = [n * 2, n / 2, n * 10, n + 20]
    random.shuffle(near)
    random.shuffle(far)
    seen, result = {ans}, []
    for v in near + far:
        f = fmt(v)
        if len(result) < 3 and v >= 0 and f not in seen:
            seen.add(f)
            result.append(f)
    return result


def pick_distractors(ans, kind, pools):
    if kind == "num":
        return number_distractors(ans)
    lc = ans.lower()
    wc = len(ans.split())
    pool = pools["subj"] + pools["cap"] if kind == "subj" else pools.get(kind, [])
    pool = [x for x in pool if x.lower() != lc and x.lower() not in lc and lc not in x.lower()]
    if len(pool) < 6:
        pool += [x for x in pools["word"] if x.lower() != lc]
    pool = list(dict.fromkeys(pool))
    scored = sorted(
        ((abs(len(x) - len(ans)) + abs(len(x.split()) - wc) * 6 + random.random() * 5, x) for x in pool)
    )[:8]
    picks = [x for _, x in random.sample(scored, min(3, len(scored)))]
    upper = ans[:1].isupper()
    result = []
    for x in picks:
        words = x.split()
        proper = any(c.isupper() for c in x[1:]) or (len(words) > 1 and all(w[:1].isupper() for w in words))
        if kind == "acr" or proper:
            result.append(x)  # acronyms and proper names keep their capitals
        else:
            result.append(x[0].upper() + x[1:] if upper else x[0].lower() + x[1:])
    return result


def generate_mcqs(text, count):
    sents = [s for s in sentences_of(text) if valid_sentence(s)]
    if not sents:
        return []
    freq = word_freq(text)
    pools = {"subj": [], "acr": [], "cap": [], "word": []}
    items = []
    for s in sents:
        cands = candidates_for(s, freq)
        for t, kind, _ in cands:
            if kind != "num":
                pools[kind].append(t)
        if not cands:
            continue
        cands.sort(key=lambda c: -c[2])
        score = cands[0][2]
        if re.search(r"\b(is|are|refers to|called|defined|used to|consists|known as|means)\b", s, re.I):
            score += 15
        items.append({"s": s, "term": cands[0][0], "kind": cands[0][1], "score": score})
    pools["word"] = [w for w, f in freq.most_common() if f >= 2 and len(w) >= 5][:80]
    for k in pools:
        pools[k] = list(dict.fromkeys(pools[k]))
    if not items:
        return []

    n = min(count, len(items))
    order, used = [], set()
    size = len(items) / n
    for b in range(n):  # take the best sentence from each part of the text
        lo = int(b * size)
        hi = max(lo + 1, int((b + 1) * size))
        best = None
        for i in range(lo, min(hi, len(items))):
            if best is None or items[i]["score"] > items[best]["score"]:
                best = i
        if best is not None:
            order.append(best)
            used.add(best)
    rest = sorted((i for i in range(len(items)) if i not in used), key=lambda i: -items[i]["score"])
    order += rest

    made, answer_count = [], {}
    for i in order:
        if len(made) >= count:
            break
        it = items[i]
        key = it["term"].lower()
        if answer_count.get(key, 0) >= 2:
            continue
        question = blank_out(it["s"], it["term"], it["kind"])
        if not question:
            continue
        wrong = pick_distractors(it["term"], it["kind"], pools)
        if len(wrong) < 3:
            continue
        options = [it["term"]] + wrong
        random.shuffle(options)
        answer_count[key] = answer_count.get(key, 0) + 1
        made.append((i, {"q": question, "options": options, "answer": options.index(it["term"])}))
    made.sort(key=lambda x: x[0])
    return [q for _, q in made]
