"""J8 + K14: draws the Neko icon: a white cat head (short ears, two dot eyes, a small
pink nose) on Classic blue. Flat shapes in three colors, so it stays clean at every size.
The 128 px icon has 16 px of clear space around 96 px of art, as the Chrome Web Store asks.
Rendered with Chrome (headless), so Chrome must be installed.

Usage:  /usr/bin/python3 tools/make_icons.py     writes src/icons/*.png, store/icon-512.png and docs/img/icon.png"""
import os, subprocess, sys, tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

BLUE, WHITE, PINK = "#4255c9", "#ffffff", "#f08cb0"  # Classic theme's accent, white, Neko's pink


def svg(size, pad, detail=True):
    s = size - 2 * pad
    k = s / 100  # drawn on a 100-unit grid
    P = lambda x: pad + x * k
    ears = f'stroke="{WHITE}" stroke-width="{5 * k}" stroke-linejoin="round"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<rect x="{P(0)}" y="{P(0)}" width="{s}" height="{s}" rx="{23 * k}" fill="{BLUE}"/>'
        f'<path d="M{P(20)} {P(52)} L{P(25)} {P(25)} L{P(44)} {P(38)} Z M{P(80)} {P(52)} L{P(75)} {P(25)} L{P(56)} {P(38)} Z" fill="{WHITE}" {ears}/>'
        f'<ellipse cx="{P(50)}" cy="{P(61)}" rx="{33 * k}" ry="{26 * k}" fill="{WHITE}"/>'
        f'<circle cx="{P(38)}" cy="{P(60)}" r="{4.6 * k}" fill="{BLUE}"/><circle cx="{P(62)}" cy="{P(60)}" r="{4.6 * k}" fill="{BLUE}"/>'
        f'<path d="M{P(46.5)} {P(67)} h{7 * k} l{-3.5 * k} {3.8 * k} z" fill="{PINK}" stroke="{PINK}" stroke-width="{2 * k}" stroke-linejoin="round"/>'
        "</svg>"
    )


SIZES = [("src/icons/icon16.png", 16, 0, False), ("src/icons/icon32.png", 32, 0, False), ("src/icons/icon48.png", 48, 0, True), ("src/icons/icon128.png", 128, 16, True), ("store/icon-512.png", 512, 0, True), ("docs/img/icon.png", 64, 0, True)]

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
