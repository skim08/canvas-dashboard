"""Draws the extension icon: an accent rounded square with three list lines and a check."""
import zlib, struct, math

ACCENT = (66, 85, 201)
WHITE = (255, 255, 255)

def png(path, size):
    ss = 4
    n = size * ss
    r = n * 0.22
    def inside_round(x, y):
        cx = min(max(x, r), n - r); cy = min(max(y, r), n - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    def seg_dist(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    w = n * 0.075
    lines = [(0.44, 0.33, 0.76, 0.33), (0.44, 0.5, 0.76, 0.5), (0.44, 0.67, 0.66, 0.67)]
    check = [(0.22, 0.5, 0.29, 0.57), (0.29, 0.57, 0.38, 0.42)]
    rows = []
    for Y in range(size):
        row = bytearray([0])
        for X in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = X * ss + sx + 0.5; y = Y * ss + sy + 0.5
                    if not inside_round(x, y):
                        continue
                    col = ACCENT
                    for (a, b, c, d) in lines + check:
                        if seg_dist(x, y, a * n, b * n, c * n, d * n) <= w / 2:
                            col = WHITE
                            break
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            k = ss * ss
            alpha = acc[3] // k
            if alpha:
                cov = acc[3] / 255
                row += bytes([int(acc[0] / cov), int(acc[1] / cov), int(acc[2] / cov), alpha])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)

for s in (16, 32, 48, 128):
    png(f"src/icons/icon{s}.png", s)
print("icons written")
