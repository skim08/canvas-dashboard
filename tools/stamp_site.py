"""K17: adds a version stamp (a short hash of the file) to the website's stylesheet and script
links, e.g. style.css?v=1a2b3c4d. GitHub Pages lets browsers reuse a saved copy for 10 minutes;
a new stamp after any change makes them fetch the new file right away.

Usage:  /usr/bin/python3 tools/stamp_site.py      (tools/build_zip.py runs it too)"""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")


def stamp():
    changed = []
    for page in sorted(f for f in os.listdir(DOCS) if f.endswith(".html")):
        path = os.path.join(DOCS, page)
        html = open(path, encoding="utf-8").read()

        def repl(m):
            name = m.group(2)
            digest = hashlib.sha1(open(os.path.join(DOCS, name), "rb").read()).hexdigest()[:8]
            return f'{m.group(1)}{name}?v={digest}"'

        new = re.sub(r'((?:href|src)=")((?:style\.css|updates\.js))(?:\?v=[0-9a-f]+)?"', repl, html)
        if new != html:
            open(path, "w", encoding="utf-8").write(new)
            changed.append(page)
    return changed


if __name__ == "__main__":
    print("stamped", ", ".join(stamp()) or "nothing (already current)")
