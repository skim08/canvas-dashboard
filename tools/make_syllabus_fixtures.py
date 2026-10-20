"""K5 test files: a made-up syllabus as .docx and as .pdf (compressed content, a
2-byte ToUnicode font kept in an object stream, like Word's own PDF export)."""
import os, zipfile, zlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "src", "tests", "files")

PARAS = [
    "BIO 180 Introductory Biology, Spring 2027",
    "Lecture: MWF 10:30-11:20 AM in HUB 130",
    "Lab: Tuesdays 2:30-4:20 PM, HCK 132",
]
TABLE = [
    ["Week", "Date", "Topic", "Due"],
    ["1", "Mon, Mar 29", "Intro to evolution", ""],
    ["2", "Wed, Apr 7", "Natural selection", "Problem Set 1 due"],
    ["4", "Fri, Apr 23", "Midterm 1 (in class)", ""],
]
AFTER = [
    "No class Monday, May 31 (Memorial Day)",
    "Paper draft due 5/14 by 11:59 pm",
    "Final Exam: Tuesday, June 8, 8:30-10:20 AM, HUB 130",
]

def docx():
    W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    p = lambda t: f'<w:p><w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
    cell = lambda t: f'<w:tc><w:p><w:r><w:t>{t}</w:t></w:r></w:p></w:tc>'
    rows = "".join("<w:tr>" + "".join(cell(c) for c in r) + "</w:tr>" for r in TABLE)
    body = "".join(p(t) for t in PARAS) + f"<w:tbl>{rows}</w:tbl>" + "".join(p(t) for t in AFTER)
    doc = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {W}><w:body>{body}</w:body></w:document>'
    with zipfile.ZipFile(os.path.join(out, "sample-syllabus.docx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        z.writestr("word/document.xml", doc)

def pdf():
    lines = PARAS + [" | ".join(r) for r in TABLE] + AFTER
    chars = sorted(set("".join(lines)))
    code = {c: i + 1 for i, c in enumerate(chars)}  # 2-byte codes, not the characters themselves
    hexs = lambda t: "<" + "".join(f"{code[c]:04X}" for c in t) + ">"
    ops = ["BT", "/F1 11 Tf", "1 0 0 1 72 720 Tm"]
    for k, t in enumerate(lines):
        if k == 1:  # one line as TJ with kerning gaps, like Word does
            a, b = t.split(" ", 1)
            ops.append(f"[{hexs(a)} -250 {hexs(b)}] TJ")
        else:
            ops.append(f"{hexs(t)} Tj")
        ops.append("0 -14 Td")
    ops.append("ET")
    content = zlib.compress("\n".join(ops).encode("latin-1"))
    cmap_lines = "\n".join(f"<{code[c]:04X}> <{ord(c):04X}>" for c in chars)
    cmap = f"/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n{len(chars)} beginbfchar\n{cmap_lines}\nendbfchar\nendcmap\nend\nend".encode()
    font = b"<< /Type /Font /Subtype /Type0 /BaseFont /Calibri /Encoding /Identity-H /ToUnicode 6 0 R >>"
    page = b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    packed = font + b" " + page
    header = f"5 0 3 {len(font) + 1}".encode()
    objstm = zlib.compress(header + b" " + packed)
    first = len(header) + 1
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        None,  # 3 lives in the object stream
        b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(content) + content + b"\nendstream",
        None,  # 5 lives in the object stream
        b"<< /Length %d >>\nstream\n" % len(cmap) + cmap + b"\nendstream",
        b"<< /Type /ObjStm /N 2 /First %d /Length %d /Filter /FlateDecode >>\nstream\n" % (first, len(objstm)) + objstm + b"\nendstream",
    ]
    data = b"%PDF-1.5\n"
    for i, o in enumerate(objs, 1):
        if o is None: continue
        data += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    data += b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
    open(os.path.join(out, "sample-syllabus.pdf"), "wb").write(data)

docx(); pdf()
print("wrote", os.listdir(out))
