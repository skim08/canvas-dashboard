"""B5 check: every text color token meets WCAG AA (4.5:1) on every background it's used on."""
import re, sys
css = open("src/styles/tokens.css").read()
def block(sel):
    i = css.index(sel); j = css.index("}", i)
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", css[i:j]))
# J1 + J8: every palette, light and dark.
base_light, base_dark = block(":root {"), block(':root[data-theme="dark"]')
themes = [("pink light", base_light), ("pink dark", base_dark)]
# Classic (J1) and the animal themes (J8). A palette overrides some tokens; the rest come from the pink base.
for pal in ("classic", "matcha", "ocean", "polar", "honey"):
    themes.append((f"{pal} light", {**base_light, **block(f':root[data-palette="{pal}"] {{')}))
    themes.append((f"{pal} dark", {**base_dark, **block(f':root[data-palette="{pal}"][data-theme="dark"]')}))
def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)
pairs = [(t, b) for t in ["text", "text-muted", "text-faint", "accent"] for b in ["bg", "surface", "surface-2"]]
pairs += [("red", "red-soft"), ("amber", "amber-soft"), ("green", "green-soft"), ("red", "surface"), ("amber", "surface"), ("green", "surface"), ("red", "bg"), ("amber", "bg"), ("on-accent", "accent"), ("lime", "lime-soft"), ("text", "red-soft"), ("text-muted", "red-soft"), ("text", "amber-soft"), ("accent", "accent-soft"), ("amber", "surface-2")]
bad = 0
for name, t in themes:
    for fg, bg in pairs:
        r = ratio(t[fg], t[bg])
        flag = "OK " if r >= 4.5 else "LOW"
        if r < 4.5: bad += 1
        print(f"{name:13} {flag} {r:5.2f}  {fg} on {bg}")
print(f"\n{bad} pair(s) below 4.5:1")
sys.exit(1 if bad else 0)
