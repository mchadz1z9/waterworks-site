#!/usr/bin/env python3
"""Builds RivalCity.rbxlx: the city map (parts), the CityData module, and the server + client scripts.
Open the .rbxlx in Roblox Studio (File > Open from File), press Play to test, File > Publish to Roblox to share.
Run:  python3 build.py   (writes RivalCity.rbxlx next to this file)"""
import math, random, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(20261123)

# ---------------------------------------------------------------- XML helpers
MAT = {'SmoothPlastic': 272, 'Plastic': 256, 'Neon': 288, 'Glass': 1568, 'Concrete': 816, 'Grass': 1280, 'Wood': 512,
       'WoodPlanks': 528, 'Sand': 1296, 'Asphalt': 1376, 'Brick': 848, 'Metal': 1088, 'Slate': 800, 'Fabric': 1312, 'Marble': 784}
SHAPE = {'Ball': 0, 'Block': 1, 'Cylinder': 2}
_ref = [0]
def ref():
    _ref[0] += 1
    return 'RBX%06d' % _ref[0]
def esc(s): return html.escape(str(s), quote=True)
def f(x): return ('%.4f' % x).rstrip('0').rstrip('.') if isinstance(x, float) else str(x)

I3 = ((1, 0, 0), (0, 1, 0), (0, 0, 1))
def mat_mul(A, B): return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
def rot_y(a): c, s = math.cos(a), math.sin(a); return ((c, 0, s), (0, 1, 0), (-s, 0, c))
def rot_z(a): c, s = math.cos(a), math.sin(a); return ((c, -s, 0), (s, c, 0), (0, 0, 1))
def norm(v): l = math.sqrt(sum(x * x for x in v)) or 1; return tuple(x / l for x in v)
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def from_z(d):
    """rotation whose local +Z axis points along d (so the part's Front face, -Z, points the other way)"""
    Z = norm(d); up = (0, 1, 0) if abs(Z[1]) < 0.99 else (1, 0, 0)
    X = norm(cross(up, Z)); Y = cross(Z, X)
    return ((X[0], Y[0], Z[0]), (X[1], Y[1], Z[1]), (X[2], Y[2], Z[2]))
def facing(out):
    """rotation so the part's Front face (-Z) looks along the outward direction `out` (signs, doors)"""
    return from_z((-out[0], -out[1], -out[2]))
VERT = rot_z(math.pi / 2)  # a cylinder's length runs along X; this stands it up

def color_u8(c): return 0xFF000000 | (c[0] << 16) | (c[1] << 8) | c[2]

def part_xml(name, size, pos, color, mat='SmoothPlastic', R=I3, cls='Part', shape=None, collide=True, transp=0.0, children=''):
    x, y, z = pos
    cf = ''.join('<R%d%d>%s</R%d%d>' % (i, j, f(float(R[i][j])), i, j) for i in range(3) for j in range(3))
    props = [
        '<string name="Name">%s</string>' % esc(name),
        '<bool name="Anchored">true</bool>',
        '<bool name="CanCollide">%s</bool>' % ('true' if collide else 'false'),
        '<CoordinateFrame name="CFrame"><X>%s</X><Y>%s</Y><Z>%s</Z>%s</CoordinateFrame>' % (f(float(x)), f(float(y)), f(float(z)), cf),
        '<Vector3 name="size"><X>%s</X><Y>%s</Y><Z>%s</Z></Vector3>' % tuple(f(float(v)) for v in size),
        '<Color3uint8 name="Color3uint8">%d</Color3uint8>' % color_u8(color),
        '<token name="Material">%d</token>' % MAT[mat],
        '<token name="TopSurface">0</token><token name="BottomSurface">0</token>',
        '<float name="Transparency">%s</float>' % f(float(transp)),
    ]
    if shape is not None: props.append('<token name="shape">%d</token>' % SHAPE[shape])
    return '<Item class="%s" referent="%s"><Properties>%s</Properties>%s</Item>' % (cls, ref(), ''.join(props), children)

def container(cls, name, children):
    return '<Item class="%s" referent="%s"><Properties><string name="Name">%s</string></Properties>%s</Item>' % (cls, ref(), esc(name), ''.join(children))

def script_xml(cls, name, source):
    assert ']]>' not in source
    return '<Item class="%s" referent="%s"><Properties><string name="Name">%s</string><ProtectedString name="Source"><![CDATA[%s]]></ProtectedString></Properties></Item>' % (cls, ref(), esc(name), source)

# ---------------------------------------------------------------- city layout
N, B, R = 5, 120, 32                      # blocks per side, block size (incl. sidewalk), road width
TOTAL = N * B + (N + 1) * R
H = TOTAL / 2
ROAD = [-H + R / 2 + i * (B + R) for i in range(N + 1)]        # road centre lines (x for N-S roads, z for E-W roads)
MID = [ROAD[j] + (B + R) / 2 for j in range(N)]                  # block centres
SIDE = 0.6                                                        # sidewalk / curb height
EAST = H                                                          # east edge of the city (the beach starts here)

GRID = [  # [z row][x column], z row 0 is north
    ['depot', 'dealer', 'tower', 'tower', 'gas'],
    ['police', 'tower', 'park', 'tower', 'shops'],
    ['shops', 'tower', 'plaza', 'tower', 'shops'],
    ['tower', 'shops', 'tower', 'park', 'shops'],
    ['houses', 'houses', 'houses', 'houses', 'houses'],
]
PALETTE = [(245, 245, 238), (255, 205, 130), (140, 200, 255), (255, 160, 150), (175, 230, 160), (215, 200, 255), (250, 225, 110), (130, 135, 150), (95, 140, 195), (255, 240, 220)]
SHOPS = ['PIZZA PALACE', 'TACO TOWN', 'COMIC CORNER', 'ICE CREAM', 'PET SHOP', 'BOOK NOOK', 'TOY TOWN', 'BAKERY', 'SNEAKERS', 'MUSIC', 'BURGER BARN', 'DONUTS']

parts = {'ground': [], 'roads': [], 'blocks': [], 'buildings': [], 'lamps': [], 'nature': [], 'landmarks': [], 'spawns': []}
houses = []
delivery, coins, places, showroom, parkspots, hills = [], [], [], [], [], []

def add(group, *a, **k): parts[group].append(part_xml(*a, **k))

# ground: grass everywhere except where the beach takes over (east)
gx0, gx1, gz = -H - 200, EAST + 14, H + 200
add('ground', 'Ground', (gx1 - gx0, 2, 2 * gz), ((gx0 + gx1) / 2, -1, 0), (92, 170, 70), 'Grass')

# roads: segments between intersections (no overlaps, so no flicker), dashed centre lines, crosswalks downtown
ASPH, PAINT, WHITE = (52, 55, 62), (250, 205, 40), (240, 240, 240)
for i, c in enumerate(ROAD):
    for j, m in enumerate(MID):
        add('roads', 'Road', (R, 0.2, B), (c, 0.1, m), ASPH, 'Asphalt')
        add('roads', 'Road', (B, 0.2, R), (m, 0.1, c), ASPH, 'Asphalt')
        for k in range(10):
            o = -B / 2 + 6 + k * 12
            add('roads', 'Line', (0.5, 0.05, 6), (c, 0.225, m + o), PAINT, collide=False)
            add('roads', 'Line', (6, 0.05, 0.5), (m + o, 0.225, c), PAINT, collide=False)
    for k, c2 in enumerate(ROAD):
        add('roads', 'Crossing', (R, 0.2, R), (c, 0.1, c2), ASPH, 'Asphalt')
        if 1 <= i <= 4 and 1 <= k <= 4 and (i in (2, 3) or k in (2, 3)):
            for s in (-1, 1):
                for q in range(6):
                    off = -R / 2 + 4 + q * 4.8
                    add('roads', 'Crosswalk', (2.4, 0.05, 5), (c + off, 0.225, c2 + s * (R / 2 + 3)), WHITE, collide=False)
                    add('roads', 'Crosswalk', (5, 0.05, 2.4), (c + s * (R / 2 + 3), 0.225, c2 + off), WHITE, collide=False)

def palm(x, z, y0, h=None):
    h = h or random.uniform(16, 24)
    seg = 4
    for k in range(seg):
        lean = 0.35 * (k / seg)
        add('nature', 'PalmTrunk', (h / seg + 0.3, 1.3 - k * 0.12, 1.3 - k * 0.12), (x + lean, y0 + h / seg * (k + 0.5), z), (140, 105, 70) if k % 2 else (125, 92, 60), 'Wood', VERT, shape='Cylinder', collide=k == 0)
    top = (x + 0.35, y0 + h, z)
    add('nature', 'Coconuts', (1.6, 1.6, 1.6), (top[0], top[1] - 0.4, top[2]), (110, 80, 40), shape='Ball', collide=False)
    for a in range(7):
        th = a / 7 * 2 * math.pi + random.uniform(-.2, .2)
        d = norm((math.cos(th), -0.45, math.sin(th)))
        L = 8.5
        c = (top[0] + d[0] * L / 2, top[1] + d[1] * L / 2 + 0.6, top[2] + d[2] * L / 2)
        add('nature', 'Frond', (2.4, 0.25, L), c, random.choice([(60, 150, 60), (75, 165, 70), (50, 135, 55)]), 'Grass', from_z(d), collide=False)

def tree(x, z, y0, s=1.0):
    add('nature', 'TreeTrunk', (7 * s, 1.4 * s, 1.4 * s), (x, y0 + 3.5 * s, z), (110, 78, 50), 'Wood', VERT, shape='Cylinder')
    for (dx, dy, dz, r) in ((0, 9, 0, 6.5), (-3, 7.5, 1.5, 4.5), (3, 7.5, -1.5, 4.5), (0.5, 11.5, 0.5, 4)):
        add('nature', 'Leaves', (r * s, r * s, r * s), (x + dx * s, y0 + dy * s, z + dz * s), random.choice([(70, 150, 60), (85, 165, 70), (60, 135, 55)]), 'Grass', shape='Ball', collide=False)

def lamp(x, z, out):
    add('lamps', 'LampPost', (16, 0.7, 0.7), (x, SIDE + 8, z), (60, 64, 72), 'Metal', VERT, shape='Cylinder')
    ax, az = x + out[0] * 2.4, z + out[1] * 2.4
    add('lamps', 'LampArm', (0.5 if out[1] else 5, 0.5, 5 if out[1] else 0.5), (ax, SIDE + 16, az), (60, 64, 72), 'Metal')
    add('lamps', 'Lamp', (2.6 if out[1] else 1.6, 0.6, 1.6 if out[1] else 2.6), (x + out[0] * 4.6, SIDE + 15.6, z + out[1] * 4.6), (255, 240, 205))

def sign(text, pos, out, w, h, color=(30, 34, 48), group='buildings'):
    add(group, 'Sign:' + text, (w, h, 0.6), pos, color, R=facing((out[0], 0, out[1])))

def building(cx, cz, w, d, h, col, out, label=None, shop=False):
    """a building on the sidewalk with window bands, a door facing `out` (a road), and an optional sign"""
    base = SIDE
    add('buildings', 'Building', (w, h, d), (cx, base + h / 2, cz), col, 'Concrete' if not shop else 'SmoothPlastic')
    add('buildings', 'Roof', (w + 0.8, 0.8, d + 0.8), (cx, base + h + 0.4, cz), tuple(max(0, v - 40) for v in col))
    if h > 40:
        add('buildings', 'RoofBox', (w * 0.3, 4, d * 0.3), (cx + w * 0.15, base + h + 2.8, cz - d * 0.1), (150, 155, 165), 'Metal')
    floors = max(1, min(10, int((h - 8) // 11)))
    step = (h - 8) / floors
    glass = (125, 175, 215)
    for k in range(floors):
        y = base + 7 + step * k + step * 0.45
        for (fx, fz, sw, sd) in ((0, -1, w - 4, 0.3), (0, 1, w - 4, 0.3), (-1, 0, 0.3, d - 4), (1, 0, 0.3, d - 4)):
            if k == 0 and (fx, fz) == out: continue
            add('buildings', 'Window', (sw, min(5, step * 0.55), sd), (cx + fx * (w / 2 + 0.1), y, cz + fz * (d / 2 + 0.1)), glass, 'Glass')
    # entrance
    ox, oz = out
    fx, fz = cx + ox * (w / 2 + 0.15), cz + oz * (d / 2 + 0.15)
    add('buildings', 'Door', (7, 9, 0.4), (fx, base + 4.5, fz), (45, 60, 80), 'Glass', facing((ox, 0, oz)))
    if shop:
        add('buildings', 'Awning', (w - 4 if oz else 6, 0.4, 6 if oz else d - 4), (cx + ox * (w / 2 + 3), base + 11, cz + oz * (d / 2 + 3)), random.choice([(220, 60, 60), (40, 150, 90), (60, 110, 220), (240, 150, 30)]), 'Fabric', collide=False)
    if label:
        sign(label, (cx + ox * (w / 2 + 0.4), base + (13.5 if shop else h - 4), cz + oz * (d / 2 + 0.4)), out, min(w, d) - 6, 4.5)
    delivery.append((fx + ox * 6, base + 1, fz + oz * 6))

def lot_out(cx, cz, bx, bz):
    """which side of a building in quadrant (bx,bz) of a block faces a road: the outer edge, x first"""
    return (bx, 0)

shop_i = 0
for zi in range(N):
    for xi in range(N):
        kind = GRID[zi][xi]
        cx, cz = MID[xi], MID[zi]
        # sidewalk slab under every block (parks get a grass top)
        add('blocks', 'Sidewalk', (B, SIDE, B), (cx, SIDE / 2, cz), (200, 200, 206), 'Concrete')
        for s in (-1, 1):
            lamp(cx + s * (B / 2 - 3), cz + s * (B / 2 - 3), (s, 0))
            lamp(cx - s * (B / 2 - 3), cz + s * (B / 2 - 3), (0, s))
        for k in range(8):
            t = random.uniform(-B / 2 + 8, B / 2 - 8)
            side = random.randrange(4)
            p = [(t, -B / 2 + 4), (t, B / 2 - 4), (-B / 2 + 4, t), (B / 2 - 4, t)][side]
            coins.append((cx + p[0], SIDE, cz + p[1]))
        dist = max(abs(xi - 2), abs(zi - 2))
        if kind in ('tower', 'shops'):
            q = (B - 20) / 2
            for bx in (-1, 1):
                for bz in (-1, 1):
                    w = q - random.choice([6, 8, 10]); d = q - random.choice([6, 8, 10])
                    if kind == 'tower':
                        h = random.uniform(55, 95) + (2 - dist) * 30 + random.uniform(0, 30)
                        building(cx + bx * q / 2, cz + bz * q / 2, w, d, h, random.choice(PALETTE[:9]), (bx, 0))
                    else:
                        h = random.uniform(22, 34)
                        name = SHOPS[shop_i % len(SHOPS)]; shop_i += 1
                        building(cx + bx * q / 2, cz + bz * q / 2, w, d, h, random.choice(PALETTE), (bx, 0), label=name, shop=True)
        elif kind in ('park', 'plaza'):
            add('blocks', 'Lawn' if kind == 'park' else 'Plaza', (B - 14, 0.2, B - 14), (cx, SIDE + 0.1, cz), (100, 180, 80) if kind == 'park' else (225, 215, 195), 'Grass' if kind == 'park' else 'Concrete')
            for k in range(10):
                a = k / 10 * 2 * math.pi
                (palm if k % 2 else tree)(cx + math.cos(a) * (B / 2 - 16), cz + math.sin(a) * (B / 2 - 16), SIDE + 0.2)
            if kind == 'plaza':
                y = SIDE + 0.2
                add('landmarks', 'FountainBase', (2, 30, 30), (cx, y + 1, cz), (210, 205, 195), 'Marble', VERT, shape='Cylinder')
                add('landmarks', 'FountainWater', (0.3, 26, 26), (cx, y + 2.1, cz), (70, 170, 230), 'Glass', VERT, shape='Cylinder', collide=False, transp=0.25)
                add('landmarks', 'FountainPillar', (8, 3, 3), (cx, y + 5, cz), (210, 205, 195), 'Marble', VERT, shape='Cylinder')
                add('landmarks', 'FountainBowl', (1.2, 10, 10), (cx, y + 9, cz), (210, 205, 195), 'Marble', VERT, shape='Cylinder')
                add('landmarks', 'FountainSpout', (3, 2, 2), (cx, y + 10.8, cz), (90, 190, 240), 'Neon', VERT, shape='Cylinder', collide=False, transp=0.3)
                for (dx, dz) in ((-26, 0), (26, 0), (0, -26), (0, 26)):
                    add('spawns', 'SpawnLocation', (7, 1, 7), (cx + dx, SIDE + 0.7, cz + dz), (90, 200, 120), cls='SpawnLocation')
                sign('RIVAL CITY', (cx, SIDE + 22, cz - 8), (0, -1), 30, 7, color=(230, 60, 90), group='landmarks')
                add('landmarks', 'SignPole', (14, 1, 1), (cx - 12, SIDE + 7, cz - 8), (60, 64, 72), 'Metal', VERT, shape='Cylinder')
                add('landmarks', 'SignPole', (14, 1, 1), (cx + 12, SIDE + 7, cz - 8), (60, 64, 72), 'Metal', VERT, shape='Cylinder')
                places.append(('Spawn Plaza', '⛲', (cx, SIDE + 1, cz + 30)))
            else:
                places.append(('City Park' if not any(p[0] == 'City Park' for p in places) else 'Lakeside Park', '🌴', (cx, SIDE + 1, cz)))
        elif kind == 'depot':
            add('landmarks', 'Warehouse', (90, 26, 70), (cx, SIDE + 13, cz - 6), (190, 150, 110), 'Brick')
            add('landmarks', 'WarehouseRoof', (92, 1, 72), (cx, SIDE + 26.5, cz - 6), (120, 90, 70))
            for k in (-30, 0, 30):
                add('landmarks', 'RollerDoor', (18, 16, 0.4), (cx + k, SIDE + 8, cz + 29.2), (90, 95, 105), 'Metal', facing((0, 0, 1)))
            sign('📦 DELIVERY DEPOT', (cx, SIDE + 21, cz + 29.4), (0, 1), 50, 6, color=(200, 120, 20), group='landmarks')
            add('landmarks', 'Prompt:Depot', (6, 4, 3), (cx + 40, SIDE + 2, cz + 34), (240, 180, 60), 'Wood')
            add('landmarks', 'DeskSign', (5, 1.2, 0.3), (cx + 40, SIDE + 4.8, cz + 35.6), (255, 220, 90), 'Neon', collide=False)
            places.append(('Delivery Depot', '📦', (cx + 40, SIDE + 1, cz + 42)))
        elif kind == 'dealer':
            add('landmarks', 'ShowroomFloor', (84, 0.4, 54), (cx, SIDE + 0.2, cz - 4), (240, 240, 245), 'Marble')
            add('landmarks', 'ShowroomRoof', (88, 1, 58), (cx, SIDE + 16.5, cz - 4), (40, 44, 56))
            for (dx, dz, sw, sd) in ((0, -31, 84, 0.4), (-42, 0, 0.4, 54), (42, 0, 0.4, 54)):
                add('landmarks', 'ShowroomGlass', (sw, 16, sd), (cx + dx, SIDE + 8.2, cz - 4 + dz + (0 if dz else 0)), (170, 210, 240), 'Glass', transp=0.45)
            for k in (-30, 0, 30):
                add('landmarks', 'ShowroomPillar', (1, 16, 1), (cx + k, SIDE + 8.2, cz + 23), (40, 44, 56), 'Metal')
            sign('🚗 RIVAL MOTORS', (cx, SIDE + 19.5, cz + 23.4), (0, 1), 46, 5.5, color=(30, 90, 200), group='landmarks')
            add('landmarks', 'Prompt:Dealer', (5, 3.5, 3), (cx, SIDE + 1.9, cz + 30), (60, 130, 230), 'SmoothPlastic')
            for k in (-26, 0, 26):
                showroom.append((cx + k, SIDE + 0.4, cz - 6))
            places.append(('Rival Motors', '🚗', (cx, SIDE + 1, cz + 36)))
        elif kind == 'gas':
            add('landmarks', 'Canopy', (60, 1.5, 34), (cx, SIDE + 18, cz + 10), (230, 50, 50))
            for (dx, dz) in ((-26, -14), (26, -14), (-26, 14), (26, 14)):
                add('landmarks', 'CanopyPost', (18, 1.2, 1.2), (cx + dx, SIDE + 9, cz + 10 + dz), (240, 240, 240), 'Metal', VERT, shape='Cylinder')
            for dx in (-14, 0, 14):
                add('landmarks', 'Pump', (2, 6, 3), (cx + dx, SIDE + 3, cz + 10), (240, 240, 245))
                add('landmarks', 'PumpScreen', (1.6, 1.4, 0.2), (cx + dx, SIDE + 4.8, cz + 11.55), (40, 200, 120), 'Neon', collide=False)
            building(cx, cz - 30, 50, 24, 14, (250, 240, 225), (0, 1), label='GAS & SNACKS', shop=True)
            places.append(('Gas Station', '⛽', (cx, SIDE + 1, cz + 34)))
        elif kind == 'police':
            add('landmarks', 'Police', (80, 30, 60), (cx, SIDE + 15, cz - 8), (235, 238, 245), 'Concrete')
            add('landmarks', 'PoliceStripe', (80.4, 4, 60.4), (cx, SIDE + 22, cz - 8), (40, 80, 180))
            for k in range(-3, 4):
                add('landmarks', 'Window', (6, 6, 0.3), (cx + k * 10, SIDE + 10, cz + 22.15), (125, 175, 215), 'Glass')
            add('landmarks', 'Door', (9, 10, 0.4), (cx, SIDE + 5, cz + 22.2), (45, 60, 80), 'Glass', facing((0, 0, 1)))
            sign('POLICE', (cx, SIDE + 26.5, cz + 22.4), (0, 1), 30, 5, color=(30, 60, 150), group='landmarks')
            places.append(('Police Station', '🚓', (cx, SIDE + 1, cz + 32)))
        elif kind == 'houses':
            add('blocks', 'Lawn', (B - 10, 0.2, B - 10), (cx, SIDE + 0.1, cz), (105, 185, 85), 'Grass')
            for bx in (-1, 1):
                for bz in (-1, 1):
                    hx, hz = cx + bx * 27, cz + bz * 24
                    out = (0, bz)
                    col = random.choice([(250, 235, 200), (200, 225, 250), (250, 210, 210), (210, 240, 205), (240, 240, 240), (255, 225, 160)])
                    roof = random.choice([(150, 60, 50), (70, 80, 100), (110, 70, 50), (60, 110, 80)])
                    hp = []
                    y = SIDE + 0.2
                    hp.append(part_xml('Walls', (26, 12, 20), (hx, y + 6, hz), col, 'WoodPlanks'))
                    hp.append(part_xml('Roof', (27.5, 7, 11), (hx, y + 15.5, hz - 5.25), roof, R=I3, cls='WedgePart'))
                    hp.append(part_xml('Roof', (27.5, 7, 11), (hx, y + 15.5, hz + 5.25), roof, R=rot_y(math.pi), cls='WedgePart'))
                    hp.append(part_xml('Chimney', (2.5, 6, 2.5), (hx + 8, y + 17, hz + 3), (150, 90, 70), 'Brick'))
                    dz = hz + bz * 10.2
                    hp.append(part_xml('Door', (4.5, 8, 0.4), (hx - 6, y + 4, dz), (120, 70, 40), 'Wood', facing((0, 0, bz))))
                    for wx in (3, 9):
                        hp.append(part_xml('Window', (4, 4, 0.3), (hx + wx - 3, y + 7, dz), (150, 200, 235), 'Glass', facing((0, 0, bz))))
                    hp.append(part_xml('Path', (4.5, 0.1, 12), (hx - 6, SIDE + 0.25, hz + bz * 16), (190, 185, 175), 'Concrete'))
                    hp.append(part_xml('SignPost', (0.5, 5, 0.5), (hx + 6, y + 2.5, hz + bz * 17), (120, 90, 60), 'Wood'))
                    houses.append(container('Model', 'House_%d' % (len(houses) + 1), hp))
                    delivery.append((hx - 6, SIDE + 1, hz + bz * 18))
                    palm(hx + bx * 11, hz + bz * 16, SIDE + 0.2, random.uniform(14, 18))
            if xi == 2: places.append(('Neighborhood', '🏡', (cx, SIDE + 1, ROAD[4] + 10)))

# parked cars along curbs, anyone can drive them
for k in range(10):
    i, j = random.randrange(1, N), random.randrange(N)
    if k % 2: parkspots.append((ROAD[i] + R / 2 - 4, 0.3, MID[j] + random.uniform(-30, 30), 0.0))
    else: parkspots.append((MID[j] + random.uniform(-30, 30), 0.3, ROAD[i] - R / 2 + 4, math.pi / 2))

# beach: a promenade, palms; the sand and the swimmable ocean are terrain, made by the server script
add('landmarks', 'Promenade', (14, SIDE, TOTAL + 40), (EAST + 7, SIDE / 2, 0), (225, 215, 195), 'Concrete')
for k in range(-12, 13):
    palm(EAST + 10, k * 30, SIDE, random.uniform(18, 26))
    if k % 3 == 0: lamp(EAST + 3, k * 30 + 15, (-1, 0))
add('landmarks', 'Lifeguard', (6, 8, 6), (EAST + 40, 4.2, -60), (240, 80, 70), 'Wood')
add('landmarks', 'LifeguardDeck', (8, 0.6, 8), (EAST + 40, 8.5, -60), (250, 250, 250), 'Wood')
for k in range(6):
    add('landmarks', 'Umbrella', (0.6, 8, 8), (EAST + 30 + (k % 2) * 12, 6, 40 + k * 22), random.choice([(240, 70, 80), (60, 140, 240), (250, 200, 40)]), 'Fabric', VERT, shape='Cylinder', collide=False)
    add('landmarks', 'UmbrellaPole', (6, 0.3, 0.3), (EAST + 30 + (k % 2) * 12, 3, 40 + k * 22), (240, 240, 240), 'Metal', VERT, shape='Cylinder')
places.append(('Beach', '🏖️', (EAST + 28, 2, 0)))
places.append(('My House', '🏠', (0, 0, 0)))

# hills just outside the grass so the world has an edge
for k in range(-6, 7):
    hills.append((-H - 215, -30, k * 95, random.uniform(70, 95)))
    hills.append((k * 95 - 40, -30, -H - 215, random.uniform(70, 95)))
    hills.append((k * 95 - 40, -30, H + 215, random.uniform(70, 95)))

# ---------------------------------------------------------------- CityData module (shared by server and client)
def v3(p): return 'Vector3.new(%s, %s, %s)' % tuple(f(float(x)) for x in p)
CARS = [
    ('hatch', 'City Hatch', 0, 70, (230, 75, 75), 10, 5.6, 1.4, 'hatch'),
    ('taxi', 'Rival Taxi', 800, 78, (250, 200, 30), 11, 5.8, 1.4, 'taxi'),
    ('truck', 'Pickup Truck', 1800, 82, (70, 150, 90), 12.5, 6.4, 1.8, 'truck'),
    ('sport', 'Sport Coupe', 3500, 105, (50, 120, 240), 11, 5.8, 1.2, 'coupe'),
    ('super', 'Hypercar', 9000, 140, (150, 70, 230), 11.5, 6.2, 1.1, 'super'),
]
lua = ['-- generated by build.py: places, roads, spots and the car catalogue for Rival City', 'return {']
lua.append('\tHousePrice = 5000,')
lua.append('\tRoadX = {%s},' % ', '.join(f(float(x)) for x in ROAD))
lua.append('\tRoadZ = {%s},' % ', '.join(f(float(x)) for x in ROAD))
lua.append('\tRoadMin = %s, RoadMax = %s,' % (f(float(ROAD[0])), f(float(ROAD[-1]))))
lua.append('\tBeach = { SandX = %s, SandW = 64, SeaX = %s, SeaW = 440, Length = %s },' % (f(EAST + 46.0), f(EAST + 298.0), f(float(TOTAL + 400))))
lua.append('\tHills = {%s},' % ', '.join('{ Pos = %s, R = %s }' % (v3(h[:3]), f(float(h[3]))) for h in hills))
lua.append('\tCars = {')
for (cid, name, price, speed, col, L, Wd, Hh, style) in CARS:
    lua.append('\t\t{ Id = "%s", Name = "%s", Price = %d, Speed = %d, Color = Color3.fromRGB(%d, %d, %d), Len = %s, Wid = %s, H = %s, Style = "%s" },' % (cid, name, price, speed, *col, f(float(L)), f(float(Wd)), f(float(Hh)), style))
lua.append('\t},')
lua.append('\tPlaces = {')
for (name, icon, p) in places:
    lua.append('\t\t{ Name = "%s", Icon = "%s", Pos = %s%s },' % (name, icon, v3(p), ', Home = true' if name == 'My House' else ''))
lua.append('\t},')
lua.append('\tDeliverySpots = {%s},' % ', '.join(v3(p) for p in delivery))
lua.append('\tCoinSpots = {%s},' % ', '.join(v3(p) for p in coins))
lua.append('\tShowroom = {%s},' % ', '.join('CFrame.new(%s, %s, %s)' % tuple(f(float(x)) for x in p) for p in showroom))
lua.append('\tParkSpots = {%s},' % ', '.join('CFrame.new(%s, %s, %s) * CFrame.Angles(0, %s, 0)' % (f(float(p[0])), f(float(p[1])), f(float(p[2])), f(float(p[3]))) for p in parkspots))
lua.append('}')
CITYDATA = '\n'.join(lua) + '\n'

# ---------------------------------------------------------------- assemble the place
def read(n): return open(os.path.join(HERE, 'src', n), encoding='utf-8').read()
groups = [container('Folder', k.capitalize(), v) for k, v in parts.items() if k != 'spawns']
groups.append(container('Folder', 'Houses', houses))
workspace = '<Item class="Workspace" referent="%s"><Properties><string name="Name">Workspace</string></Properties>%s%s%s%s</Item>' % (
    ref(), container('Folder', 'Map', groups), ''.join(parts['spawns']), container('Folder', 'Cars', []), container('Folder', 'Coins', []))
lighting = '<Item class="Lighting" referent="%s"><Properties><string name="Name">Lighting</string><token name="Technology">3</token><float name="ClockTime">9</float></Properties></Item>' % ref()
replicated = '<Item class="ReplicatedStorage" referent="%s"><Properties><string name="Name">ReplicatedStorage</string></Properties>%s</Item>' % (ref(), script_xml('ModuleScript', 'CityData', CITYDATA))
server = '<Item class="ServerScriptService" referent="%s"><Properties><string name="Name">ServerScriptService</string></Properties>%s</Item>' % (ref(), script_xml('Script', 'GameServer', read('GameServer.server.lua')))
starter = '<Item class="StarterPlayer" referent="%s"><Properties><string name="Name">StarterPlayer</string></Properties><Item class="StarterPlayerScripts" referent="%s"><Properties><string name="Name">StarterPlayerScripts</string></Properties>%s</Item></Item>' % (
    ref(), ref(), script_xml('LocalScript', 'Client', read('Client.client.lua')))
xml = '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="4"><External>null</External><External>nil</External>%s%s%s%s%s</roblox>' % (
    workspace, lighting, replicated, server, starter)
out = os.path.join(HERE, 'RivalCity.rbxlx')
open(out, 'w', encoding='utf-8').write(xml)
open(os.path.join(HERE, 'src', 'CityData.lua'), 'w', encoding='utf-8').write(CITYDATA)
total = sum(len(v) for v in parts.values()) + sum(h.count('class="') for h in houses)
print('wrote', out, '%.1f MB' % (len(xml) / 1e6), '·', total, 'parts ·', len(delivery), 'delivery spots ·', len(places), 'places ·', len(houses), 'houses')
