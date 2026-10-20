// K5: the text of a syllabus file, read on this computer with nothing downloaded.
// Word (.docx) files are zipped XML; PDFs keep their text in (usually compressed)
// content streams. Both are opened with the browser's own decompressor.
// Scanned PDFs (pictures of pages) have no text to read: the caller says so.

const latin1 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
};

async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------- ZIP (for .docx) ----------

async function unzipEntry(buf, wanted) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not-zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      return method === 0 ? data : inflate(data, 'deflate-raw');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// Paragraphs one per line; table rows as "cell | cell | cell".
export async function textFromDocx(buf) {
  const xml = await unzipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('not-docx');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  const lines = [];
  const textOf = (el) => {
    let s = '';
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.localName === 't') s += c.textContent;
        else if (c.localName === 'tab') s += ' ';
        else if (c.localName === 'br' || c.localName === 'cr') s += '\n';
        else if (c.localName === 'p' && s && !s.endsWith('\n')) {
          s += ' ';
          walk(c);
        } else walk(c);
      }
    };
    walk(el);
    return s;
  };
  const body = [...doc.getElementsByTagName('*')].find((e) => e.localName === 'body') || doc.documentElement;
  const visit = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType !== 1) continue;
      if (c.localName === 'p') lines.push(...textOf(c).split('\n'));
      else if (c.localName === 'tbl') {
        for (const tr of [...c.childNodes].filter((x) => x.localName === 'tr')) {
          lines.push([...tr.childNodes].filter((x) => x.localName === 'tc').map((tc) => textOf(tc).replace(/\s+/g, ' ').trim()).join(' | '));
        }
      } else visit(c);
    }
  };
  visit(body);
  return lines.map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

// ---------- PDF ----------

// PDF literal string "(…)" starting at i → [bytes, next index]
function readLiteral(s, i) {
  const out = [];
  let depth = 1;
  i++;
  while (i < s.length && depth) {
    const ch = s[i];
    if (ch === '\\') {
      const n = s[i + 1];
      const map = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (n in map) {
        out.push(map[n]);
        i += 2;
      } else if (/[0-7]/.test(n)) {
        const m = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
        out.push(parseInt(m, 8) & 255);
        i += 1 + m.length;
      } else if (n === '\r' || n === '\n') {
        i += n === '\r' && s[i + 2] === '\n' ? 3 : 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) break;
    out.push(ch.charCodeAt(0) & 255);
    i++;
  }
  return [out, i + 1];
}

function hexBytes(h) {
  const clean = h.replace(/[^0-9a-f]/gi, '');
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt((clean[i] + (clean[i + 1] || '0')), 16));
  return out;
}

// ToUnicode CMap → { width: bytes per code, map: Map(code → text) }
function parseCMap(text) {
  const map = new Map();
  let width = 1;
  const cs = text.match(/begincodespacerange\s*<([0-9a-f]+)>/i);
  if (cs) width = Math.max(1, Math.ceil(cs[1].length / 2));
  const uni = (h) => {
    const b = hexBytes(h);
    let s = '';
    for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
    return b.length === 1 ? String.fromCharCode(b[0]) : s;
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(m[1], 16), uni(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<[0-9a-f]+>|\[[^\]]*\])/gi)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3].startsWith('[')) {
        [...m[3].matchAll(/<([0-9a-f]+)>/gi)].forEach((x, k) => map.set(lo + k, uni(x[1])));
      } else {
        const base = hexBytes(m[3].slice(1, -1));
        for (let c = lo; c <= hi; c++) {
          const b = [...base];
          b[b.length - 1] += c - lo;
          map.set(c, uni(b.map((x) => x.toString(16).padStart(2, '0')).join('')));
        }
      }
    }
  }
  return { width, map };
}

// Every object's text (including ones packed inside object streams), plus stream data.
async function pdfObjects(bytes) {
  const raw = latin1(bytes);
  const objects = new Map(); // id → { dict, data (string|null) }
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m;
  while ((m = re.exec(raw))) {
    const id = Number(m[1]);
    const end = raw.indexOf('endobj', re.lastIndex);
    if (end < 0) break;
    const body = raw.slice(re.lastIndex, end);
    const si = body.search(/stream\r?\n/);
    let dict = body;
    let data = null;
    if (si >= 0) {
      dict = body.slice(0, si);
      const start = re.lastIndex + si + body.slice(si).match(/stream\r?\n/)[0].length;
      // The decompressor refuses trailing bytes, so cut exactly: /Length when it's a
      // plain number, else up to "endstream" minus its line break.
      const len = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
      let stop = raw.lastIndexOf('endstream', end);
      if (len && start + Number(len[1]) <= stop) stop = start + Number(len[1]);
      else while (stop > start && (raw[stop - 1] === '\n' || raw[stop - 1] === '\r')) stop--;
      let chunk = bytes.subarray(start, stop);
      try {
        if (/\/FlateDecode/.test(dict)) chunk = await inflate(chunk, 'deflate');
        data = /\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/.test(dict) ? null : latin1(chunk);
      } catch {
        data = null;
      }
    }
    objects.set(id, { dict, data });
    re.lastIndex = end;
  }
  // PDF 1.5+: small objects (fonts, pages) are packed into compressed object streams.
  for (const { dict, data } of [...objects.values()]) {
    if (!data || !/\/Type\s*\/ObjStm/.test(dict)) continue;
    const n = Number(dict.match(/\/N\s+(\d+)/)?.[1] || 0);
    const first = Number(dict.match(/\/First\s+(\d+)/)?.[1] || 0);
    const nums = data.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k++) {
      const id = nums[2 * k];
      const from = first + nums[2 * k + 1];
      const to = k + 1 < n ? first + nums[2 * k + 3] : data.length;
      if (!objects.has(id)) objects.set(id, { dict: data.slice(from, to), data: null });
    }
  }
  return objects;
}

export async function textFromPdf(buf) {
  const bytes = new Uint8Array(buf);
  if (latin1(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('not-pdf');
  const objects = await pdfObjects(bytes);
  // Font resource names (/F1) → their ToUnicode maps. Names can repeat across pages;
  // Word and Google Docs exports use the same font objects throughout, so this is close enough.
  const cmapOfFont = new Map();
  for (const [id, o] of objects) {
    const tu = o.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (tu && objects.get(Number(tu[1]))?.data) cmapOfFont.set(id, parseCMap(objects.get(Number(tu[1])).data));
  }
  const fontByName = new Map();
  for (const o of objects.values()) {
    for (const block of o.dict.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
      for (const f of block[1].matchAll(/\/([^\s/<>]+)\s+(\d+)\s+\d+\s+R/g)) if (!fontByName.has(f[1])) fontByName.set(f[1], Number(f[2]));
    }
    const ref = o.dict.match(/\/Font\s+(\d+)\s+\d+\s+R/);
    if (ref && objects.get(Number(ref[1]))) {
      for (const f of objects.get(Number(ref[1])).dict.matchAll(/\/([^\s/<>]+)\s+(\d+)\s+\d+\s+R/g)) if (!fontByName.has(f[1])) fontByName.set(f[1], Number(f[2]));
    }
  }
  // Pages in order: content streams referenced from /Page objects.
  const contents = [];
  for (const o of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(o.dict)) continue;
    const c = o.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/);
    if (!c) continue;
    const ids = [...c[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => Number(x[1]));
    contents.push(ids.map((id) => objects.get(id)?.data || '').join('\n'));
  }
  if (!contents.length) for (const o of objects.values()) if (o.data && /\bBT\b/.test(o.data)) contents.push(o.data);

  const lines = [];
  for (const stream of contents) {
    let line = '';
    let cmap = null;
    let lastY = null;
    const operands = [];
    const flush = () => {
      if (line.trim()) lines.push(line.replace(/\s+/g, ' ').trim());
      line = '';
    };
    const decode = (bytesArr) => {
      if (!cmap) return String.fromCharCode(...bytesArr);
      let s = '';
      for (let i = 0; i + cmap.width <= bytesArr.length; i += cmap.width) {
        let code = 0;
        for (let k = 0; k < cmap.width; k++) code = (code << 8) | bytesArr[i + k];
        s += cmap.map.get(code) ?? '';
      }
      return s;
    };
    const s = stream;
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '%') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
        continue;
      }
      if (ch === '(') {
        const [b, next] = readLiteral(s, i);
        operands.push({ str: b });
        i = next;
        continue;
      }
      if (ch === '<' && s[i + 1] !== '<') {
        const end = s.indexOf('>', i);
        operands.push({ str: hexBytes(s.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
      if (ch === '[') {
        const arr = [];
        i++;
        while (i < s.length && s[i] !== ']') {
          if (s[i] === '(') {
            const [b, next] = readLiteral(s, i);
            arr.push({ str: b });
            i = next;
          } else if (s[i] === '<') {
            const end = s.indexOf('>', i);
            arr.push({ str: hexBytes(s.slice(i + 1, end)) });
            i = end + 1;
          } else {
            const m = s.slice(i).match(/^-?\d*\.?\d+/);
            if (m) {
              arr.push(Number(m[0]));
              i += m[0].length;
            } else i++;
          }
        }
        operands.push({ arr });
        i++;
        continue;
      }
      if (ch === '<' && s[i + 1] === '<') {
        const end = s.indexOf('>>', i);
        i = end < 0 ? s.length : end + 2;
        continue;
      }
      const tok = s.slice(i).match(/^[^\s()<>[\]{}/%]+|^\/[^\s()<>[\]{}/%]*/)?.[0] || ch;
      i += tok.length;
      if (tok.startsWith('/') || /^-?\d*\.?\d+$/.test(tok)) {
        operands.push(tok);
        continue;
      }
      // An operator.
      if (tok === 'Tf') {
        const name = String(operands[operands.length - 2] || '').slice(1);
        cmap = cmapOfFont.get(fontByName.get(name)) || null;
      } else if (tok === 'Tj' || tok === "'" || tok === '"') {
        if (tok !== 'Tj') flush();
        const o = operands[operands.length - 1];
        if (o?.str) line += decode(o.str);
      } else if (tok === 'TJ') {
        const o = operands[operands.length - 1];
        for (const part of o?.arr || []) {
          if (typeof part === 'number') {
            if (part < -180) line += ' ';
          } else line += decode(part.str);
        }
      } else if (tok === 'Td' || tok === 'TD') {
        const ty = Number(operands[operands.length - 1]);
        const tx = Number(operands[operands.length - 2]);
        if (Math.abs(ty) > 0.5) flush();
        else if (tx > 2 && line && !line.endsWith(' ')) line += ' ';
      } else if (tok === 'Tm') {
        const y = Number(operands[operands.length - 1]);
        if (lastY != null && Math.abs(y - lastY) > 0.5) flush();
        else if (line && !line.endsWith(' ')) line += ' ';
        lastY = y;
      } else if (tok === 'T*') flush();
      else if (tok === 'ET' && line && !line.endsWith(' ')) line += ' ';
      operands.length = 0;
    }
    flush();
  }
  return lines.join('\n');
}

// Any supported file → text. Throws Error('unsupported' | 'empty') for the caller to explain.
export async function textFromFile(file) {
  const name = (file.name || '').toLowerCase();
  const buf = await file.arrayBuffer();
  let text = '';
  if (name.endsWith('.docx')) text = await textFromDocx(buf);
  else if (name.endsWith('.pdf')) text = await textFromPdf(buf);
  else if (/\.(txt|md|html?)$/.test(name)) text = new TextDecoder().decode(buf);
  else throw new Error('unsupported');
  if (/\.html?$/.test(name)) text = new DOMParser().parseFromString(text, 'text/html').body.innerText || '';
  if (!text.replace(/\s/g, '').length) throw new Error('empty');
  return text;
}
