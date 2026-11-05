// K17: patch notes, from changelog.json (written from CHANGELOG.md by tools/build_zip.py).
// On the Patch notes page: every version. On the home page: just the latest.
(async () => {
  const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let versions = [];
  try {
    versions = (await (await fetch('changelog.json', { cache: 'no-cache' })).json()).versions;
  } catch {
    return;
  }
  const card = (v, i, limit) =>
    `<article class="update" id="v${esc(v.version)}"><header><h2>Version ${esc(v.version)}</h2>${i === 0 ? '<span class="tag-latest">Latest</span>' : ''}<time datetime="${v.date}">${fmt(v.date)}</time></header>` +
    `<ul>${v.items.slice(0, limit || v.items.length).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` +
    (limit ? `<p class="more"><a href="updates.html#v${esc(v.version)}">${v.items.length > limit ? `See all ${v.items.length} changes` : 'See all patch notes'} <span aria-hidden="true">→</span></a></p>` : '') +
    `</article>`;
  const all = document.getElementById('updates');
  if (all) all.innerHTML = versions.map((v, i) => card(v, i)).join('');
  const latest = document.getElementById('latest-update');
  if (latest && versions[0]) latest.innerHTML = `<p class="kicker">What's new</p>${card(versions[0], 0, 6)}`;
})();
