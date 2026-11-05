"""K14 + K15 + K19: builds the public Chrome Web Store upload (dist/<name>-<version>.zip).

The public build only reads from Canvas (K15), except for the Canvas inbox (K25): it can
send and reply to messages and star, archive or mark them read. src/build.js says so,
src/lib/canvasWrite.js is replaced by a stub that refuses, lib/canvas.js refuses every other
write, and the manifest is generated without Instructure's upload host. It keeps the
"cookies" permission, used only by src/lib/canvasMessages.js to read Canvas's CSRF token.
Your own folder (the owner build) is untouched.

Leaves out everything that isn't the extension itself: tests and their sample files,
the tools, the owner's personal syllabi and sample classes (owner-data/), the spec and
notes. Then checks that what's left still loads and can't write to Canvas.

Usage:  python3 tools/build_zip.py            public zip for the Chrome Web Store
        python3 tools/build_zip.py --beta     beta zip + INSTALL.md for loading unpacked (K19)
        add --out DIR to write somewhere other than dist/
Run tools/check_extension.py first."""
import json, os, re, sys, zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
args = sys.argv[1:]
BETA = "--beta" in args
OUT = args[args.index("--out") + 1] if "--out" in args else "dist"

EXCLUDE_DIRS = {"src/tests", "tools", "owner-data", "store", "dist", "docs", ".claude", ".git"}
EXCLUDE_FILES = {"SPEC.md", "CLAUDE.md", "GPA-CHECKLIST.md", "README.md", "CHANGELOG.md", "manifest.json", ".gitignore"}
# Only loaded for the owner (test mode extras, the one-time syllabus move); fine to be missing.
OPTIONAL_DYNAMIC = {"owner-data/syllabi.js", "owner-data/fixtures.js", "src/tests/sample/classes.js"}
# Words that must never ship: kept in owner-data/private-words.txt (not in git), one per line.
PRIVATE = [w.strip() for w in open("owner-data/private-words.txt", encoding="utf-8")] if os.path.exists("owner-data/private-words.txt") else []
PRIVATE = [w for w in PRIVATE if w and not w.startswith("#")]

# ---------- what the public build replaces ----------
BUILD_JS = f"""// K15 + K19: the public build{' (beta)' if BETA else ''}, written by tools/build_zip.py. Reads only.
export const BUILD = {{ kind: 'public', beta: {'true' if BETA else 'false'} }};
export const canWrite = () => false;
// K25: the Canvas inbox (send, reply, star, archive, mark read) works in every build.
export const canMessage = () => true;
"""
WRITE_STUB = """// K15: the public build only reads from Canvas. Nothing here can change anything there.
import { ReadOnlyError } from './canvas.js';

export const WRITES = false;
const refuse = async () => {
  throw new ReadOnlyError();
};
export const put = refuse;
export const post = refuse;
export const uploadFile = refuse;
export function formBody() {
  throw new ReadOnlyError();
}
"""
REPLACED = {"src/build.js": BUILD_JS, "src/lib/canvasWrite.js": WRITE_STUB}


def public_manifest():
    m = json.load(open("manifest.json"))
    # "cookies" stays (K25): messages need Canvas's CSRF token.
    m.pop("host_permissions", None)  # Instructure's upload host was only for F13
    if BETA:
        m["name"] = f"{m['name']} (Beta)"
        m["version_name"] = f"{m['version']} beta"
    return m


files = []
for dirpath, dirs, names in os.walk("."):
    rel = os.path.relpath(dirpath, ".")
    rel = "" if rel == "." else rel
    dirs[:] = [d for d in dirs if os.path.join(rel, d) not in EXCLUDE_DIRS and not d.startswith(".")]
    for n in names:
        p = os.path.join(rel, n)
        if n.startswith(".") or p in EXCLUDE_FILES: continue
        files.append(p)
files.sort()
shipped = set(files) | {"manifest.json"}
manifest = public_manifest()


def content(p):
    if p in REPLACED: return REPLACED[p]
    return open(p, encoding="utf-8").read()


problems = []
refs = list(manifest["icons"].values()) + list(manifest["action"]["default_icon"].values()) + [manifest["action"]["default_popup"], manifest["background"]["service_worker"], manifest["chrome_url_overrides"]["newtab"]]
for r in refs:
    if r not in shipped: problems.append(f"manifest names {r}, which isn't in the zip")
if manifest.get("host_permissions"): problems.append("public manifest still asks for a host")
for p in files:
    if not p.endswith(".js"): continue
    src = content(p)
    for kind, imp in re.findall(r"""(import\s*\(|(?:^|\s)(?:import|from))\s*['"](\.{1,2}/[^'"]+)['"]""", src, re.M):
        target = os.path.normpath(os.path.join(os.path.dirname(p), imp))
        if target in shipped: continue
        if "(" in kind and target in OPTIONAL_DYNAMIC: continue
        problems.append(f"{p} imports {imp}, which isn't in the zip")
    hits = [w for w in PRIVATE if w in src]
    if hits: problems.append(f"{p}: contains private details ({len(hits)} word(s) from owner-data/private-words.txt)")
    # K15: no write paths. Only canvas.js may fetch with a method, and it refuses non-GET in this build.
    if "chrome.cookies" in src and p != "src/lib/canvasMessages.js": problems.append(f"{p}: reads cookies (only the inbox may, K25)")
    if re.search(r"fetch\([^)]*method:\s*'(POST|PUT|DELETE|PATCH)'", src): problems.append(f"{p}: sends a write request")
canvas_src = content("src/lib/canvas.js")
if "if (method !== 'GET' && !writeAllowed(url, method)) throw new ReadOnlyError();" not in canvas_src: problems.append("canvas.js: the read-only guard is missing")
if "const MESSAGE_WRITES = { POST: /^\\/api\\/v1\\/conversations(\\/\\d+\\/add_message)?$/, PUT: /^\\/api\\/v1\\/conversations\\/\\d+$/ };" not in canvas_src: problems.append("canvas.js: the inbox-only write rule (K25) changed; check it still allows only conversations")
# K17: the website's patch notes come from CHANGELOG.md, refreshed on every build.
def changelog_entries():
    out = []
    for line in open("CHANGELOG.md", encoding="utf-8"):
        m = re.match(r"^## (\S+) \((\d{4}-\d{2}-\d{2})\)", line)
        if m: out.append({"version": m.group(1), "date": m.group(2), "items": []})
        elif line.startswith("- ") and out: out[-1]["items"].append(line[2:].strip())
    return out
notes = changelog_entries()
open(os.path.join("docs", "changelog.json"), "w", encoding="utf-8").write(json.dumps({"versions": notes}, indent=2, ensure_ascii=False) + "\n")
if not notes or notes[0]["version"] != json.load(open("manifest.json"))["version"]: problems.append("CHANGELOG.md's newest entry isn't this version")

# K14: the website, README and store screenshots must show this version.
shots = os.path.join("docs", "img", "screenshots.json")
shot_version = json.load(open(shots)).get("version") if os.path.exists(shots) else None
if shot_version != json.load(open("manifest.json"))["version"]:
    problems.append(f"screenshots are for {shot_version or 'no version'}, not {json.load(open('manifest.json'))['version']}: run /usr/bin/python3 tools/make_screenshots.py")
if problems:
    print("\n".join(problems)); sys.exit(1)

os.makedirs(OUT, exist_ok=True)
name = re.sub(r"[^a-z0-9]+", "-", json.load(open("manifest.json"))["name"].lower()).strip("-")
out = os.path.join(OUT, f"{name}-{manifest['version']}{'-beta' if BETA else ''}.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    for p in files:
        if p in REPLACED: z.writestr(p, REPLACED[p])
        else: z.write(p, p)

if BETA:
    install = os.path.join(OUT, "INSTALL.md")
    open(install, "w").write(f"""# Install the {manifest['name']} beta

1. Unzip `{os.path.basename(out)}` into a folder you'll keep (for example, Documents). Don't delete the folder later: Chrome loads the extension from it.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the folder you unzipped.
5. Open a new tab and follow the setup. Or choose **Try it with sample data** to look around first.

To update, unzip the new version over the same folder, then click the reload arrow on the extension's card in `chrome://extensions`. Your data stays.

Not affiliated with Instructure or any school. Works with Canvas.
""")
size = os.path.getsize(out) / 1024
print(f"Built {out}: {len(files) + 1} files, {size:.0f} KB. Public{' beta' if BETA else ''} build: reads only, except Canvas messages (K25); no upload host; left out tests, tools, owner-data and notes." + (f" Wrote {os.path.join(OUT, 'INSTALL.md')}." if BETA else ""))
