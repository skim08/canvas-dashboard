"""K14: every screenshot of Neko, made fresh from the current code in one go.

Takes them in demo mode (the made-up student, so nothing personal ever appears), with the
clock set to 1:30 PM so greetings and "due in" times look natural. Writes:

  store/screenshots/<version>/1-home.png … 5-themes.png   1280×800, for the Chrome Web Store
  docs/img/1-home.jpg … 5-themes.jpg                      2560×1600, for the website and README
  store/promo-tile-440x280.png                            the store's small promo tile
  docs/img/screenshots.json                               which version they show

tools/build_zip.py refuses to build when docs/img/screenshots.json is for an older version,
so the website, README and store images can't fall behind a release.

Usage:  /usr/bin/python3 tools/make_screenshots.py      (needs Google Chrome installed)"""
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SHOTS_DIR = os.path.join(ROOT, "tools", "shots")  # driver pages, written for the run and removed after

# The app page, with a fixed clock and paths that point back at src/.
NEWTAB_PREFIX = """<base href="/src/">
<script>
(function () {
  const at = new URLSearchParams(parent.location.search).get('at') || '13:30';
  const [hh, mm] = at.split(':').map(Number);
  const RD = Date;
  const target = new RD(); target.setHours(hh, mm, 0, 0);
  const off = target.getTime() - RD.now();
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
  window.Date = D;
})();
</script>
"""

# Loads the app in demo mode in a 1280×800 frame, sets the look, then clicks through `steps`.
DRIVER = """<!doctype html><html><head><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:1280px;height:800px;display:block}</style></head><body>
<script>
const q = new URLSearchParams(location.search);
localStorage.setItem('cd:demoMode', '1');
const f = document.createElement('iframe');
f.src = 'newtab.html' + (q.get('route') || '#/home');
document.body.append(f);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
f.onload = async () => {
  const d = f.contentDocument;
  const st = d.createElement('style');
  st.textContent = '.demo-banner,.dev-badge,.toast{display:none!important}';
  d.head.append(st);
  await wait(4000);
  const store = await f.contentWindow.eval("import('/src/ui/store.js')");
  const patch = { seenVersion: '9.9.9', personalized: true, nickname: 'Alex', theme: q.get('theme') || 'light' };
  if (q.get('palette')) patch.palette = q.get('palette');
  if (q.get('details')) patch.detailsView = q.get('details');
  store.updateSettings(patch);
  // No "finish setting up" reminder in marketing shots.
  await store.updateUser((ud) => { ud.syllabusSkip = Object.fromEntries((store.state.cache?.courses || []).map((c) => [c.id, true])); });
  await wait(800);
  for (const step of (q.get('steps') || '').split(',').filter(Boolean)) {
    if (step.startsWith('js:')) await f.contentWindow.eval(decodeURIComponent(step.slice(3)));
    else d.querySelector(`[data-key="${step}"]`)?.click();
    await wait(1200);
  }
  await wait(500);
  document.title = 'ready';
};
</script></body></html>
"""

# Two of your own events on the calendar shot (made-up, like the rest of the demo).
EVENTS = "js:" + urllib.parse.quote(
    "(async()=>{const s=await import('/src/ui/store.js');const t=await import('/src/lib/time.js');"
    "const today=t.dayKey(Date.now(),'America/Los_Angeles');await s.updateUser(ud=>{ud.events=["
    "{id:'s1',title:'Study group: Midterm 1',day:t.addDays(today,1),start:'16:00',end:'17:30',repeat:null,note:'',type:'event',skip:[],courseId:'1002'},"
    "{id:'s2',title:'Pre-class reading',day:t.addDays(today,-3),start:'08:00',end:'08:50',repeat:{days:['Mon','Wed','Fri'],until:null},note:'',type:'reading',skip:[],courseId:'1003'}]});})()",
    safe="",
)

# name, route, steps, palette, light/dark, details view, caption (website alt text)
SHOTS = [
    ("1-home", "#/home", "", "", "light", "", "Home: what's due, your grades and upcoming exams, with Neko's daily summary"),
    ("2-calendar", "#/calendar", EVENTS, "", "dark", "", "Week calendar in dark mode, with class times and your own events"),
    ("3-grades", "#/grades", "", "", "light", "", "Grades and projected GPA, with what you need on what's left"),
    ("4-inbox", "#/inbox", "conv:8201", "", "light", "side", "Inbox: read and reply to Canvas messages"),
    ("5-themes", "#/themes", "", "matcha", "light", "", "Themes: five animal mascots, each with its own colors"),
]

TILE = """<!doctype html><html><head><style>
html,body{margin:0;width:440px;height:280px;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif}
.t{width:440px;height:280px;box-sizing:border-box;padding:34px 36px;background:linear-gradient(160deg,#4b67e6 0%,#2c44b8 100%);display:flex;flex-direction:column;justify-content:center;gap:14px;position:relative;color:#fff}
.row{display:flex;align-items:center;gap:16px}
.name{font-size:46px;font-weight:700;letter-spacing:-.5px}
.tag{font-size:19px;line-height:1.35;font-weight:500;max-width:330px;color:#e6ebff}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:13px;font-weight:600;color:#2c44b8;background:#fff;border-radius:999px;padding:5px 11px}
.chip.pink{background:#ff8fb3;color:#3a1020}
</style></head><body><div class="t">
<div class="row"><img src="/store/icon-512.png" width="74" height="74" style="border-radius:17px;box-shadow:0 0 0 2px rgba(255,255,255,.35)"><span class="name">Neko</span></div>
<div class="tag">Your classes, deadlines and grades in one calm place.</div>
<div class="chips"><span class="chip">Due dates</span><span class="chip">GPA</span><span class="chip">Calendar</span><span class="chip pink">Inbox</span></div>
</div></body></html>
"""


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def chrome(url, out, w, h, scale, tmp, budget=25000):
    prof = tempfile.mkdtemp(dir=tmp)
    try:
        subprocess.run([CHROME, "--headless=new", "--no-first-run", f"--user-data-dir={prof}", "--hide-scrollbars", f"--window-size={w},{h}", f"--force-device-scale-factor={scale}", f"--virtual-time-budget={budget}", f"--screenshot={out}", url], capture_output=True, timeout=180, check=True)
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def main():
    if not os.path.exists(CHROME):
        sys.exit("Google Chrome not found; it takes the screenshots.")
    version = json.load(open(os.path.join(ROOT, "manifest.json")))["version"]
    store_dir = os.path.join(ROOT, "store", "screenshots", version)
    img_dir = os.path.join(ROOT, "docs", "img")
    os.makedirs(store_dir, exist_ok=True)
    os.makedirs(SHOTS_DIR, exist_ok=True)
    newtab = open(os.path.join(ROOT, "src", "newtab.html")).read().replace("<head>", "<head>\n" + NEWTAB_PREFIX, 1)
    open(os.path.join(SHOTS_DIR, "newtab.html"), "w").write(newtab)
    open(os.path.join(SHOTS_DIR, "shot.html"), "w").write(DRIVER)
    open(os.path.join(SHOTS_DIR, "tile.html"), "w").write(TILE)
    port = free_port()
    server = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "devserver.py"), str(port), ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with tempfile.TemporaryDirectory() as tmp:
            for name, route, steps, palette, theme, details, _ in SHOTS:
                q = urllib.parse.urlencode({"route": route, "steps": steps, "palette": palette, "theme": theme, "details": details, "at": "13:30"})
                url = f"http://127.0.0.1:{port}/tools/shots/shot.html?{q}"
                chrome(url, os.path.join(store_dir, f"{name}.png"), 1280, 800, 1, tmp)
                big = os.path.join(tmp, f"{name}@2x.png")
                chrome(url, big, 1280, 800, 2, tmp)
                subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "88", big, "--out", os.path.join(img_dir, f"{name}.jpg")], capture_output=True, check=True)
                print("wrote", name)
            chrome(f"http://127.0.0.1:{port}/tools/shots/tile.html", os.path.join(ROOT, "store", "promo-tile-440x280.png"), 440, 280, 1, tmp, budget=3000)
            print("wrote store/promo-tile-440x280.png")
    finally:
        server.terminate()
        shutil.rmtree(SHOTS_DIR, ignore_errors=True)
    json.dump({"version": version, "shots": [{"file": f"{n}.jpg", "alt": alt} for n, *_, alt in SHOTS]}, open(os.path.join(img_dir, "screenshots.json"), "w"), indent=2)
    print(f"Screenshots for {version}: store/screenshots/{version}/, docs/img/ (website and README) and the promo tile.")


if __name__ == "__main__":
    main()
