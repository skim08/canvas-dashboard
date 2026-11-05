"""K15 + K19: checks the builds themselves.
Owner build (this folder): keeps writes, cookies and the upload host.
Public build (tools/build_zip.py): read-only except Canvas messages (K25), no upload host, nothing personal.
Beta build (--beta): the public build plus INSTALL.md and a Beta label."""
import json, os, subprocess, sys, tempfile, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
fails = []
def check(cond, msg):
    if not cond: fails.append(msg)

owner = json.load(open("manifest.json"))
check("cookies" in owner["permissions"], "owner manifest lost the cookies permission")
check(owner.get("host_permissions") == ["https://*.inscloudgate.net/*"], "owner manifest lost the upload host")
check("kind: 'owner'" in open("src/build.js").read(), "src/build.js isn't the owner build")

for beta in (False, True):
    with tempfile.TemporaryDirectory() as out:
        r = subprocess.run([sys.executable, "tools/build_zip.py", "--out", out] + (["--beta"] if beta else []), capture_output=True, text=True)
        check(r.returncode == 0, f"build failed ({'beta' if beta else 'public'}): {r.stdout}{r.stderr}")
        if r.returncode: continue
        z = zipfile.ZipFile([os.path.join(out, f) for f in os.listdir(out) if f.endswith(".zip")][0])
        names = set(z.namelist())
        m = json.loads(z.read("manifest.json"))
        label = "beta" if beta else "public"
        check("cookies" in m["permissions"], f"{label}: lost the cookies permission messages need (K25)")
        check("host_permissions" not in m, f"{label}: asks for a host")
        check(m.get("optional_host_permissions") == ["https://*/*"], f"{label}: can't ask for the school's Canvas")
        build = z.read("src/build.js").decode()
        check("kind: 'public'" in build and "canWrite = () => false" in build, f"{label}: build.js isn't read-only")
        check("canMessage = () => true" in build, f"{label}: build.js lost the inbox (K25)")
        check(("beta: true" in build) == beta, f"{label}: beta flag wrong")
        stub = z.read("src/lib/canvasWrite.js").decode()
        check("fetch" not in stub and "cookies" not in stub, f"{label}: canvasWrite.js can still write")
        check(not any(n.startswith(("owner-data/", "src/tests/", "tools/", "docs/")) for n in names), f"{label}: ships owner-data, tests, tools or docs")
        check("src/lib/fixtures.js" in names, f"{label}: demo data missing (K16)")
        js = {n: z.read(n).decode("utf-8", "ignore") for n in names if n.endswith(".js")}
        everything = "".join(js.values())
        private = [w.strip() for w in open("owner-data/private-words.txt", encoding="utf-8")] if os.path.exists("owner-data/private-words.txt") else []
        for word in [w for w in private if w and not w.startswith("#")]:
            check(word not in everything, f"{label}: contains a private word")
        readers = sorted(n for n, src in js.items() if "chrome.cookies" in src)
        check(readers == ["src/lib/canvasMessages.js"], f"{label}: only the inbox may read cookies (K25), but these do: {readers}")
        if beta:
            check(os.path.exists(os.path.join(out, "INSTALL.md")), "beta: no INSTALL.md")
            check(m["name"].endswith("(Beta)"), "beta: name has no Beta label")

print("\n".join(fails) if fails else "Build tests passed: owner build keeps every feature; public and beta builds are read-only except Canvas messages, ask only for what they use, and contain nothing personal.")
sys.exit(1 if fails else 0)
