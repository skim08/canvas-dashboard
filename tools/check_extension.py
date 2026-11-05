"""A1 + A7 + K1 checks: manifest is valid, every file it references exists, every
relative import resolves, and the shipped code only contacts the school's Canvas
the user chose in setup (plus Instructure's upload storage for F13)."""
import json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
problems = []
m = json.load(open("manifest.json"))
refs = list(m["icons"].values()) + list(m["action"]["default_icon"].values()) + [m["action"]["default_popup"], m["background"]["service_worker"], m["chrome_url_overrides"]["newtab"]]
for r in refs:
    if not os.path.exists(r): problems.append(f"manifest references missing file: {r}")
# K1 (approved 2026-10-20): your school's Canvas is granted at runtime, one site at a time
# (optional permission). Always granted: only Instructure's upload storage (F13, approved 2026-10-06).
if m["host_permissions"] != ["https://*.inscloudgate.net/*"]: problems.append(f"unexpected host permissions: {m['host_permissions']}")
if m.get("optional_host_permissions") != ["https://*/*"]: problems.append(f"unexpected optional host permissions: {m.get('optional_host_permissions')}")
if "connect-src 'self' https:;" not in m["content_security_policy"]["extension_pages"] + ";" : problems.append("unexpected connect-src")
# The runtime guard that keeps every request on your school's Canvas must stay in place.
canvas_src = open("src/lib/canvas.js", encoding="utf-8").read()
if "new URL(url).origin !== CANVAS_ORIGIN" not in canvas_src: problems.append("canvas.js: missing the one-school request guard (K1)")
if m["manifest_version"] != 3: problems.append("not Manifest V3")
# K22: describe it as working with Canvas, and say it isn't affiliated, wherever the name appears.
if "works with Canvas" not in m["description"] or "Not affiliated with Instructure" not in m["description"]: problems.append("manifest description must say \"works with Canvas\" and \"Not affiliated with Instructure\"")
for page in ["docs/index.html", "docs/privacy.html", "docs/terms.html", "docs/support.html"]:
    if os.path.exists(page) and "affiliated" not in open(page, encoding="utf-8").read(): problems.append(f"{page}: missing the not-affiliated note")

ALLOWED_HOSTS = {"canvas.uw.edu", "canvas.example.edu", "www.w3.org", "www.youtube.com", "example.com"}  # canvas.example.edu: the demo's pretend school (K16); ".example" never resolves  # w3 = SVG namespace; youtube/example.com only in test data (example.com stands in for a non-Canvas upload server, F13)
for dirpath, _, files in os.walk("src"):
    for f in files:
        p = os.path.join(dirpath, f)
        if not f.endswith((".js", ".html", ".css")): continue
        src = open(p, encoding="utf-8").read()
        for host in re.findall(r"https?://([a-zA-Z0-9.-]+)", src):
            if p.startswith(os.path.join("src", "tests")): continue  # tests name bad hosts to check they're refused; never contacted
            if host.endswith(".inscloudgate.net"):
                if "fixtures" not in p and "tests" not in p: problems.append(f"{p}: upload host outside test data (only canvas.js's pattern may name it)")
                continue
            # K17: the landing site is only ever opened as a link (privacy policy, terms), never fetched.
            # Links the student clicks (the website, the store page for "Rate it"), never fetched.
            if host in ("skim08.github.io", "chromewebstore.google.com") and p == os.path.join("src", "lib", "env.js"): continue
            if host not in ALLOWED_HOSTS: problems.append(f"{p}: outside URL {host}")
            # K1: no school is built in; canvas.uw.edu is only the sample data's school.
            if host == "canvas.uw.edu" and p not in (os.path.join("src", "lib", "env.js"), os.path.join("src", "lib", "fixtures.js")): problems.append(f"{p}: hard-coded school address (use CANVAS_ORIGIN)")
            if host == "www.youtube.com" and "fixtures" not in p and "tests" not in p: problems.append(f"{p}: youtube outside fixtures")
            if host == "example.com" and "tests" not in p and "fixtures" not in p: problems.append(f"{p}: example.com outside test data")
        for imp in re.findall(r"""(?:import|from)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]""", src):
            target = os.path.normpath(os.path.join(dirpath, imp))
            if not os.path.exists(target): problems.append(f"{p}: import not found {imp}")
        for ref in re.findall(r"""(?:src|href)="([^"#:]+)\"""", src) if f.endswith(".html") else []:
            target = os.path.normpath(os.path.join(dirpath, ref))
            if not os.path.exists(target): problems.append(f"{p}: missing {ref}")
        if re.search(r"\beval\(|new Function\(", src): problems.append(f"{p}: eval/new Function (blocked in MV3)")
        if f.endswith(".html") and re.search(r"<script>(?!\s*</script>)", src): problems.append(f"{p}: inline script (blocked by extension CSP)")
print("\n".join(problems) if problems else "Extension check passed: manifest valid, all files and imports resolve, only your school's Canvas is contacted (plus Instructure file storage for uploads).")
sys.exit(1 if problems else 0)
