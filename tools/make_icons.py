"""J8 + K14: draws the Neko icon (Neko the cat on a Blush pink square, with a check).
16 and 32 px: a plain white cat shape so it stays crisp in the toolbar. 48 and 128 px: the
full face with a check badge. The 128 px icon has 16 px of clear space around 96 px of art,
as the Chrome Web Store asks. Rendered with Chrome (headless), so Chrome must be installed.

Usage:  /usr/bin/python3 tools/make_icons.py     writes src/icons/*.png and store/icon-512.png"""
import os, subprocess, sys, tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# full art (pad 0) for toolbar sizes; pad 16 on 128 for the store.
def svg(size, pad, detail=True):
    s = size - 2 * pad
    k = s / 100  # draw on a 100-unit grid
    def P(x): return pad + x * k
    ink = '#4a2a38'
    parts = []
    parts.append(f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ec4"/><stop offset="1" stop-color="#c23a6e"/></linearGradient>'
                 f'<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>')
    r = 22 * k
    parts.append(f'<rect x="{P(0)}" y="{P(0)}" width="{s}" height="{s}" rx="{r}" fill="url(#g)"/>')
    parts.append(f'<rect x="{P(0)}" y="{P(0)}" width="{s}" height="{s}" rx="{r}" fill="url(#sh)"/>')
    sw = 3.2 * k if detail else 0  # tiny sizes: a clean white shape, no outline
    fur = '#fffaf7' if detail else '#ffffff'; inner = '#ffb3cd'
    # ears
    parts.append(f'<path d="M{P(19)} {P(50)} L{P(23)} {P(16)} L{P(45)} {P(33)} Z M{P(81)} {P(50)} L{P(77)} {P(16)} L{P(55)} {P(33)} Z" fill="{fur}" stroke="{ink}" stroke-width="{sw}" stroke-linejoin="round"/>' if detail else f'<path d="M{P(14)} {P(52)} L{P(18)} {P(10)} L{P(46)} {P(30)} Z M{P(86)} {P(52)} L{P(82)} {P(10)} L{P(54)} {P(30)} Z" fill="{fur}"/>')
    if detail:
        parts.append(f'<path d="M{P(26)} {P(40)} L{P(27.5)} {P(25)} L{P(38)} {P(33.5)} Z M{P(74)} {P(40)} L{P(72.5)} {P(25)} L{P(62)} {P(33.5)} Z" fill="{inner}"/>')
    # head
    parts.append(f'<ellipse cx="{P(50)}" cy="{P(58)}" rx="{34*k}" ry="{28*k}" fill="{fur}" stroke="{ink}" stroke-width="{sw}"/>' if detail else f'<ellipse cx="{P(50)}" cy="{P(60)}" rx="{38*k}" ry="{31*k}" fill="{fur}"/>')
    # eyes
    er = (4.2 if detail else 6.2) * k
    ey = 55 if detail else 58
    parts.append(f'<ellipse cx="{P(37 if detail else 34)}" cy="{P(ey)}" rx="{er}" ry="{er*1.2}" fill="{ink}"/><ellipse cx="{P(63 if detail else 66)}" cy="{P(ey)}" rx="{er}" ry="{er*1.2}" fill="{ink}"/>')
    if detail:
        parts.append(f'<circle cx="{P(38.4)}" cy="{P(53)}" r="{1.5*k}" fill="#fff"/><circle cx="{P(64.4)}" cy="{P(53)}" r="{1.5*k}" fill="#fff"/>')
        parts.append(f'<ellipse cx="{P(28)}" cy="{P(66)}" rx="{6*k}" ry="{3.8*k}" fill="{inner}"/><ellipse cx="{P(72)}" cy="{P(66)}" rx="{6*k}" ry="{3.8*k}" fill="{inner}"/>')
        parts.append(f'<path d="M{P(47)} {P(62)} h{6*k} l{-3*k} {3.4*k} z" fill="#e8668f" stroke="#e8668f" stroke-width="{1.2*k}" stroke-linejoin="round"/>')
        parts.append(f'<path d="M{P(44)} {P(68)} q{3*k} {3.6*k} {6*k} 0 q{3*k} {3.6*k} {6*k} 0" stroke="{ink}" stroke-width="{2.2*k}" fill="none" stroke-linecap="round"/>')
    # check badge
    if detail:
        cx, cy, cr = P(79), P(79), 13.5 * k
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{cr}" fill="#ffffff" stroke="{ink}" stroke-width="{2.6*k}"/>')
        parts.append(f'<path d="M{cx-6*k} {cy+0.5*k} l{4*k} {4*k} l{8*k} {-8.5*k}" stroke="#c23a6e" stroke-width="{3.6*k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(parts)}</svg>'


SIZES = [("src/icons/icon16.png", 16, 0, False), ("src/icons/icon32.png", 32, 0, False), ("src/icons/icon48.png", 48, 0, True), ("src/icons/icon128.png", 128, 16, True), ("store/icon-512.png", 512, 0, True)]

def render(markup, size, out, tmp):
    page = os.path.join(tmp, "icon.html")
    open(page, "w").write(f"<!doctype html><html><head><style>html,body{{margin:0;background:transparent}}</style></head><body>{markup}</body></html>")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={os.path.join(tmp, 'profile')}", "--hide-scrollbars", "--default-background-color=00000000", f"--window-size={size},{size}", f"--screenshot={os.path.abspath(out)}", f"file://{page}"], check=True, capture_output=True)

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if not os.path.exists(CHROME):
        sys.exit("Google Chrome not found; it's used to draw the PNGs.")
    with tempfile.TemporaryDirectory() as tmp:
        for out, size, pad, detail in SIZES:
            render(svg(size, pad, detail), size, out, tmp)
            print("wrote", out)
