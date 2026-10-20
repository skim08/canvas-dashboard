"""B4 check: app.css may only use token values for font sizes, spacing and colors."""
import re, sys
css = open("src/styles/app.css").read()
problems = []
for n, line in enumerate(css.splitlines(), 1):
    s = line.strip()
    m = re.match(r"(font-size|padding|margin|gap|row-gap|column-gap)(-\w+)?\s*:\s*(.+);", s)
    if m:
        val = m.group(3)
        if re.fullmatch(r"calc\(-1 \* var\(--s\d\)\)", val):
            continue
        for v in val.split():
            if v in ("0", "auto") or v.startswith("var(--s") or v.startswith("var(--t-") or v.startswith("calc(-1 * var(--s"):
                continue
            problems.append(f"{n}: {s}")
    if re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(", s) and not s.startswith("/*"):
        problems.append(f"{n}: raw color: {s}")
    if re.match(r"font-weight\s*:", s) and "var(--w-" not in s:
        problems.append(f"{n}: {s}")
    if re.match(r"font-family\s*:", s) and "var(--font)" not in s and "monospace" not in s:
        problems.append(f"{n}: {s}")
print("\n".join(problems) if problems else "B4 check passed: no off-token font sizes, spacing, weights or colors.")
sys.exit(1 if problems else 0)
