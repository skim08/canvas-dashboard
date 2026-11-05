"""J8 + K14: draws the Neko icon: a white cat with happy eyes and a pink check for a smile,
on a blue square. Three colors (blue, white, pink) so it stays clean at every size. The 128 px
icon has 16 px of clear space around 96 px of art, as the Chrome Web Store asks. Rendered with
Chrome (headless), so Chrome must be installed.

Usage:  /usr/bin/python3 tools/make_icons.py     writes src/icons/*.png, store/icon-512.png and docs/img/icon.png"""
import os, subprocess, sys, tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

BLUE_TOP, BLUE = "#4b67e6", "#2c44b8"
PINK, WHITE = "#ff8fb3", "#ffffff"


def svg(size, pad, detail=True):
    s = size - 2 * pad
    k = s / 100  # drawn on a 100-unit grid
    P = lambda x: pad + x * k
    ear = f'stroke="{WHITE}" stroke-width="{4 * k}" stroke-linejoin="round"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLUE_TOP}"/><stop offset="1" stop-color="{BLUE}"/></linearGradient></defs>'
        f'<rect x="{P(0)}" y="{P(0)}" width="{s}" height="{s}" rx="{23 * k}" fill="url(#g)"/>'
        f'<path d="M{P(20)} {P(50)} L{P(25)} {P(15)} L{P(47)} {P(36)} Z" fill="{WHITE}" {ear}/>'
        f'<path d="M{P(80)} {P(50)} L{P(75)} {P(15)} L{P(53)} {P(36)} Z" fill="{WHITE}" {ear}/>'
        f'<ellipse cx="{P(50)}" cy="{P(60)}" rx="{34 * k}" ry="{27 * k}" fill="{WHITE}"/>'
        f'<path d="M{P(31)} {P(57)} q{6.5 * k} {-7.5 * k} {13 * k} 0 M{P(56)} {P(57)} q{6.5 * k} {-7.5 * k} {13 * k} 0" stroke="{BLUE}" stroke-width="{4.2 * k}" fill="none" stroke-linecap="round"/>'
        f'<path d="M{P(41.5)} {P(68)} l{5.5 * k} {5.5 * k} l{11.5 * k} {-11.5 * k}" stroke="{PINK}" stroke-width="{5.5 * k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
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
