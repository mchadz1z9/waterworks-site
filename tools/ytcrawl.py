#!/usr/bin/env python3
"""Find kid-friendly YouTube channels by topic (Restricted Mode on) and collect their Shorts.
Stage 1: python3 ytcrawl.py channels   -> yt/channels.json
Stage 2: python3 ytcrawl.py shorts     -> yt/shorts.json
Only reads public pages. Gentle: a few requests at a time."""
import json, re, sys, os, time, random, urllib.request, urllib.parse, concurrent.futures as cf

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yt')
os.makedirs(OUT, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
HDR = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'PREF=f2=8000000&hl=en&gl=US; CONSENT=YES+'}  # f2=8000000 = Restricted Mode

# topic -> category chip in Rink Clips
TOPICS = {
 '🔬 Science shorts': ['science for kids','science experiments','chemistry experiments','physics demos','fun facts','space facts','how it works','engineering','robots','inventions','geology rocks','weather science','math tricks','optical illusions','human body facts','dinosaurs','oceans facts','biology for kids','science shorts','stem projects','magnets experiments','electricity experiments','volcano experiment','slow motion science','nasa','astronomy'],
 '🐾 Animal shorts': ['cute animals','funny dogs','funny cats','wildlife','animal facts','zoo','aquarium','pets','puppies','kittens','birds','horses','farm animals','reptiles','sharks','ocean animals','animal rescue','bunny','hamster','parrot talking','nature documentary shorts','insects','marine life','safari'],
 '⚽ Sports shorts': ['soccer skills','basketball highlights','hockey highlights','football highlights','baseball highlights','trick shots','tennis','golf trick shots','skateboarding','bmx','skiing','snowboarding','surfing','gymnastics','parkour','sports bloopers','volleyball','track and field','swimming','boxing training','martial arts kids','table tennis','badminton','cricket','rugby','f1 racing','nascar','motocross','climbing','frisbee trick shots','juggling football','nhl','nba','nfl','mlb','world cup'],
 '🎮 Gaming shorts': ['minecraft','minecraft builds','roblox','fortnite shorts','mario','pokemon','zelda','video game facts','speedrun','gaming funny moments','lego games','rocket league','sonic','kirby','animal crossing','minecraft redstone','geometry dash','among us'],
 '🧱 LEGO & builds': ['lego','lego builds','lego technic','lego speed build','marble run','domino','cardboard crafts','paper crafts','origami','woodworking','diy projects','3d printing','rubik cube','model trains','k\'nex'],
 '🎨 Art & DIY': ['drawing','painting','art for kids','satisfying art','clay art','pottery','sand art','chalk art','graffiti art','calligraphy','cake decorating','slime','diy crafts','sewing','knitting','animation','stop motion','pixel art'],
 '🍳 Food shorts': ['cooking','baking','recipes for kids','street food','candy making','chocolate','pizza','ice cream','food art','snack hacks','cookies','cake','pancakes','sushi making','bread baking','fruit cutting'],
 '😂 Comedy shorts': ['funny shorts','comedy sketches','family friendly comedy','funny fails','bloopers','jokes for kids','funny kids','silly','magic comedy','funny animation','impressions','cartoon shorts'],
 '✨ Satisfying': ['satisfying','oddly satisfying','asmr cutting','restoration','cleaning satisfying','soap cutting','kinetic sand','pressure washing','factory machines','how its made','hydraulic press','glass blowing','metal casting','wood turning'],
 '🚗 Cars & machines': ['cars','supercars','trucks','monster trucks','trains','planes','aviation','tractors','construction machines','rockets','boats','motorcycles','electric cars','car facts','lego cars','rc cars','drones'],
 '🎵 Music shorts': ['music','piano','guitar','drums','singing','beatbox','dance','a cappella','kids songs','music covers','violin','orchestra','marching band'],
 '🌍 World & travel': ['travel','geography facts','countries','history facts','world records','amazing places','nature','national parks','mountains','waterfalls','islands','cities','architecture','castles','museums'],
 '🎩 Magic & tricks': ['magic tricks','card tricks','illusions','life hacks','yo-yo tricks','skill toys','kendama','puzzles','riddles','brain teasers','escape room','speed cubing'],
}
BLOCK = re.compile(r"(horror|scary|creepy|terrifying|haunted|\bghosts?\b|demon|murder|\bkill(s|ed|er|ing)?\b|\bdead\b|\bdeath|blood|gore\b|\bguns?\b|weapon|knife|\bwar\b|crime|police chase|arrest|prison|drunk|\bbeer|alcohol|\bvap(e|ing)\b|smok(e|ing)\b|\bdrugs?\b|\bweed\b|\bcbd\b|casino|gambl|\bbet(s|ting)?\b|sexy|\bsex|hot girl|bikini|onlyfans|18\+|nsfw|twerk|\bkiss|dating|girlfriend|boyfriend|\bcrush\b|prank|\bfight|brawl|knock ?out|injur|surgery|pimple|\bzits?\b|\bcurse|\bdamn|\bhell\b|wtf|stupid|idiot|shut up|politic|trump|biden|election|religio|conspiracy|\bscam|crypto|bitcoin|stock market|forex|money glitch|free robux|giveaway|mukbang|weight loss|gone wrong|\bdiet\b)", re.I)

def get(url, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=HDR)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            time.sleep(1.5 * (k + 1) + random.random())
    return ''

def initial_data(html):
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html, re.S)
    if not m: return None
    try: return json.loads(m.group(1))
    except Exception: return None

def walk(o, key, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key: out.append(v)
            else: walk(v, key, out)
    elif isinstance(o, list):
        for v in o: walk(v, key, out)
    return out

def txt(o):
    if not o: return ''
    if 'simpleText' in o: return o['simpleText']
    return ''.join(r.get('text', '') for r in o.get('runs', []))

def subs_num(s):
    m = re.search(r'([\d.,]+)\s*([KMB]?)\s*subscribers', s or '', re.I)
    if not m: return 0
    n = float(m.group(1).replace(',', '')); return int(n * {'': 1, 'K': 1e3, 'M': 1e6, 'B': 1e9}[m.group(2).upper()])

def english(t):
    letters = [c for c in t if c.isalpha()]
    return letters and sum(c.isascii() for c in letters) / len(letters) > .9

def search_channels(q):
    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote_plus(q) + '&sp=EgIQAg%253D%253D'
    d = initial_data(get(url))
    res = []
    for c in walk(d, 'channelRenderer', []) if d else []:
        title = txt(c.get('title')); base = c.get('navigationEndpoint', {}).get('browseEndpoint', {}).get('canonicalBaseUrl', '')
        subs = max(subs_num(txt(c.get('subscriberCountText'))), subs_num(txt(c.get('videoCountText'))))
        res.append({'id': c.get('channelId'), 'title': title, 'url': base, 'subs': subs})
    return res

def channel_shorts(ch):
    path = ch['url'] if ch['url'].startswith('/@') else '/channel/' + ch['id']
    d = initial_data(get('https://www.youtube.com' + path + '/shorts'))
    if not d: return []
    out = []
    for s in walk(d, 'shortsLockupViewModel', []):
        try:
            vid = s['onTap']['innertubeCommand']['reelWatchEndpoint']['videoId']
            title = s.get('overlayMetadata', {}).get('primaryText', {}).get('content', '')
            views = s.get('overlayMetadata', {}).get('secondaryText', {}).get('content', '')
            out.append({'yt': vid, 'title': title, 'views': views})
        except Exception: pass
    return out

def stage_channels():
    found = {}
    jobs = [(cat, q) for cat, qs in TOPICS.items() for q in qs]
    with cf.ThreadPoolExecutor(6) as ex:
        futs = {ex.submit(search_channels, q): (cat, q) for cat, q in jobs}
        for n, f in enumerate(cf.as_completed(futs)):
            cat, q = futs[f]
            for c in f.result():
                if not c['id'] or c['subs'] < 50000 or BLOCK.search(c['title']) or not english(c['title']): continue
                if c['id'] not in found: found[c['id']] = dict(c, cat=cat, q=q)
            if n % 25 == 0: print(n, '/', len(jobs), 'queries ·', len(found), 'channels', flush=True)
    json.dump(list(found.values()), open(os.path.join(OUT, 'channels.json'), 'w'), indent=0)
    print('channels:', len(found))

def stage_shorts():
    chans = json.load(open(os.path.join(OUT, 'channels.json')))
    have = set()
    try:
        old = open('/home/user/waterworks-site/rink-rivals/clips.html', encoding='utf-8').read()
        have = set(re.findall(r'"yt":"([\w-]{11})"', old))
    except Exception: pass
    res = {}
    def one(ch):
        return ch, channel_shorts(ch)
    with cf.ThreadPoolExecutor(6) as ex:
        for n, (ch, shorts) in enumerate(ex.map(one, chans)):
            keep = []
            for s in shorts:
                t = s['title'].strip()
                if not t or s['yt'] in have or BLOCK.search(t) or not english(t): continue
                keep.append({'yt': s['yt'], 'title': t[:90]})
                have.add(s['yt'])
                if len(keep) >= 24: break
            if len(keep) >= 6: res[ch['id']] = {'by': ch['title'], 'cat': ch['cat'], 'subs': ch['subs'], 'v': keep}
            if n % 50 == 0: print(n, '/', len(chans), 'channels ·', sum(len(r['v']) for r in res.values()), 'shorts', flush=True)
    json.dump(res, open(os.path.join(OUT, 'shorts.json'), 'w'))
    print('channels with shorts:', len(res), 'shorts:', sum(len(r['v']) for r in res.values()))

if __name__ == '__main__':
    {'channels': stage_channels, 'shorts': stage_shorts}[sys.argv[1]]()
