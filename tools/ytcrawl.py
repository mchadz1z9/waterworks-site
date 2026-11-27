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

MORE_TOPICS = {
 '🔬 Science shorts': ['kids science channel','experiment shorts','science facts shorts','space shorts','chemistry for kids','engineering shorts','animal science','earth science','ocean science','weather shorts','planets for kids','dinosaur facts','bug facts','human body for kids','cool inventions','satisfying science','magnet shorts','bridge building','paper airplane','water rockets','rube goldberg','lego science','marble machine','gyroscope','slow motion camera'],
 '🐾 Animal shorts': ['dog tricks','cat videos','baby animals','farm life','horse riding','goat videos','duck videos','penguin videos','otter videos','panda videos','elephant videos','dolphin videos','fish tank','aquascape','reptile channel','tortoise','guinea pig','hedgehog','corgi','golden retriever','husky','parrot tricks','bird feeder','wildlife camera','zoo keeper','animal sanctuary','pet care'],
 '⚽ Sports shorts': ['soccer tricks','freestyle football','basketball tricks','dunk highlights','hockey skills','hockey goals','baseball skills','golf shots','tennis shots','volleyball highlights','skate tricks','scooter tricks','bmx tricks','trampoline tricks','cheerleading','dance team','martial arts kids','karate kids','taekwondo','swimming tricks','diving','track athletes','ultimate frisbee','pickleball','table tennis tricks','bowling strikes','snowboard tricks','ski tricks','surfing waves','skateboard park','olympic highlights','nba highlights shorts','nhl highlights shorts','mlb highlights shorts','premier league shorts','world cup highlights'],
 '🎮 Gaming shorts': ['minecraft shorts','minecraft building tips','roblox shorts','roblox obby','fortnite creative','mario kart','smash bros','pokemon shorts','zelda shorts','splatoon','rocket league shorts','geometry dash shorts','sonic shorts','kirby shorts','stardew valley','terraria','animal crossing shorts','lego video games','gaming tips','speedrun shorts','nintendo shorts','retro games','indie games','game facts'],
 '🧱 LEGO & builds': ['lego shorts','lego mocs','lego technic builds','lego city','lego star wars builds','brick building','domino shorts','cardboard builds','rc builds','3d printing shorts','woodworking shorts','model making','miniature builds','kinetic sculpture','paper models','origami shorts','rubik cube tricks','puzzle builds','marble run shorts','knex builds'],
 '🎨 Art & DIY': ['drawing shorts','art challenge','painting shorts','sculpting','clay animation','cake art','latte art','sand art shorts','chalk drawing','spray paint art','calligraphy shorts','doodle','cartoon drawing','pixel art shorts','diy crafts shorts','slime shorts','sewing shorts','knitting shorts','perler beads','resin art','glass art','embroidery','crafts for kids','coloring'],
 '🍳 Food shorts': ['cooking shorts','baking shorts','easy recipes','cake decorating shorts','candy shorts','chocolate shorts','pizza shorts','ice cream shorts','street food shorts','food art shorts','cookie decorating','bread shorts','pancake art','sushi shorts','smoothie','snack ideas','lunch ideas kids','fruit carving','donut shorts','cupcake shorts'],
 '😂 Comedy shorts': ['funny animals','funny shorts clean','comedy shorts family','funny fails clean','sketch comedy kids','funny cartoons','animation shorts','funny dogs and cats','bloopers shorts','magic comedy shorts','funny sports moments','funny kids shorts'],
 '✨ Satisfying': ['satisfying shorts','oddly satisfying shorts','satisfying cleaning','restoration shorts','satisfying factory','how its made shorts','satisfying sand','satisfying slime','satisfying cutting','satisfying machines','power washing shorts','carpet cleaning','satisfying art','satisfying cooking','satisfying lego'],
 '🚗 Cars & machines': ['car shorts','supercar shorts','truck shorts','monster truck shorts','train shorts','airplane shorts','helicopter shorts','tractor shorts','excavator shorts','construction shorts','rocket launch shorts','boat shorts','motorcycle shorts','race car shorts','f1 shorts','nascar shorts','drone shorts','rc car shorts','car wash shorts','car detailing'],
 '🎵 Music shorts': ['piano shorts','guitar shorts','drum shorts','singing shorts','beatbox shorts','dance shorts','a cappella shorts','music covers shorts','violin shorts','trumpet','marching band shorts','ukulele','music for kids','orchestra shorts'],
 '🌍 World & travel': ['travel shorts','geography shorts','history shorts','world records shorts','amazing places shorts','nature shorts','national park shorts','mountain shorts','waterfall shorts','beach shorts','city shorts','architecture shorts','castle shorts','museum shorts','flags shorts','maps shorts'],
 '🎩 Magic & tricks': ['magic shorts','card trick shorts','illusion shorts','life hacks shorts','yo-yo shorts','kendama shorts','juggling shorts','riddle shorts','brain teaser shorts','puzzle shorts','trick shot shorts','skill shots','paper tricks','coin tricks'],
}

SUBJ = {
 '🔬 Science shorts': ['physics','chemistry','biology','astronomy','geology','robotics','coding for kids','electronics','inventions','experiments','volcanoes','solar system','black holes','microscope','optics','sound waves','fossils','rocks and minerals','weather','climate','energy','engineering','math'],
 '🐾 Animal shorts': ['dogs','cats','puppies','kittens','horses','cows','pigs','sheep','chickens','ducks','rabbits','hamsters','birds','parrots','owls','eagles','sharks','whales','dolphins','octopus','turtles','frogs','lizards','snakes','spiders','bees','butterflies','elephants','lions','tigers','bears','monkeys','giraffes','zebras','kangaroos','koalas','pandas','penguins','seals','otters','foxes','wolves','deer','squirrels','raccoons'],
 '⚽ Sports shorts': ['soccer','basketball','hockey','football','baseball','softball','volleyball','tennis','golf','bowling','skateboarding','surfing','snowboarding','skiing','bmx','motocross','gymnastics','swimming','diving','track','wrestling','karate','judo','fencing','archery','rowing','cycling','climbing','parkour','cheer','dance','frisbee','lacrosse','rugby','cricket','badminton','table tennis','pickleball','curling','figure skating'],
 '🎮 Gaming shorts': ['minecraft','roblox','fortnite','mario','pokemon','zelda','sonic','kirby','splatoon','rocket league','geometry dash','terraria','stardew valley','animal crossing','lego games','smash bros','mario kart','retro gaming','gaming setup','speedrun'],
 '🧱 LEGO & builds': ['lego','lego technic','lego city','lego ninjago','lego star wars','duplo','k nex','magnetic tiles','dominoes','marble run','cardboard','woodworking','3d printing','rc cars','model trains','miniatures','origami','paper craft','rubiks cube','puzzles'],
 '🎨 Art & DIY': ['drawing','painting','watercolor','acrylic painting','sketching','cartoon drawing','anime drawing','clay','polymer clay','pottery','sculpture','slime','crafts','sewing','knitting','crochet','embroidery','beadwork','resin','calligraphy','graffiti','chalk art','pixel art','animation','stop motion','face painting','nail art','cake art'],
 '🍳 Food shorts': ['cooking','baking','cake','cookies','cupcakes','bread','pizza','pasta','burgers','tacos','sushi','ramen','ice cream','chocolate','candy','donuts','pancakes','waffles','smoothies','fruit','vegetables','bbq','street food','snacks','lunchbox','breakfast'],
 '✨ Satisfying': ['satisfying','asmr','restoration','cleaning','pressure washing','soap','kinetic sand','slicing','factory','machines','printing','painting walls','lawn mowing','carpet cleaning','car detailing','organizing'],
 '🚗 Cars & machines': ['cars','supercars','classic cars','trucks','monster trucks','fire trucks','police cars','ambulance','tractors','excavators','cranes','bulldozers','trains','subway','planes','jets','helicopters','rockets','boats','ships','submarines','motorcycles','race cars','go karts','drones','robots'],
 '🎵 Music shorts': ['piano','guitar','drums','violin','cello','flute','saxophone','trumpet','ukulele','harp','singing','choir','beatbox','dj','band','orchestra'],
 '🌍 World & travel': ['travel','japan','italy','france','iceland','norway','canada','australia','new zealand','hawaii','alaska','egypt','greece','mexico','peru','national parks','mountains','beaches','islands','deserts','rainforest','caves','castles','skyscrapers','bridges','world records','history','flags','maps'],
 '🎩 Magic & tricks': ['magic','card tricks','illusions','life hacks','juggling','yo-yo','kendama','spinning tops','riddles','brain teasers','trick shots','paper airplanes','balloon animals'],
}
MODS = ['shorts', 'for kids', 'tips']
THIRD_TOPICS = {c: [w + ' ' + m for w in ws for m in MODS] for c, ws in SUBJ.items()}
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
    json.dump(list(found.values()), open(os.path.join(OUT, CHFILE), 'w'), indent=0)
    print('channels:', len(found))

def stage_shorts():
    chans = json.load(open(os.path.join(OUT, CHFILE)))
    have = set()
    try:
        old = ''.join(open(f, encoding='utf-8').read() for f in ['/home/user/waterworks-site/rink-rivals/clips-data.js','/home/user/waterworks-site/rink-rivals/clips.html'] if os.path.exists(f))
        have = set(re.findall(r'"([\w-]{11})"', old))
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
                if len(keep) >= PER: break
            if len(keep) >= 6: res[ch['id']] = {'by': ch['title'], 'cat': ch['cat'], 'subs': ch['subs'], 'v': keep}
            if n % 50 == 0: print(n, '/', len(chans), 'channels ·', sum(len(r['v']) for r in res.values()), 'shorts', flush=True)
    json.dump(res, open(os.path.join(OUT, SHFILE), 'w'))
    print('channels with shorts:', len(res), 'shorts:', sum(len(r['v']) for r in res.values()))

SPORTS_TOPICS = {
 '🏀 NBA shorts': ['nba','nba highlights','nba shorts','nba top plays','nba dunks','nba buzzer beaters','basketball highlights','nba skills','nba funny moments','wnba','nba g league','college basketball','march madness','high school basketball','basketball mixtapes','basketball trick shots','streetball','nba 2k shorts','lakers','warriors','celtics','knicks','bulls','heat','mavericks','nuggets','bucks','suns','thunder','76ers','cavaliers','timberwolves','spurs','rockets','grizzlies','pacers','magic basketball','kings basketball','pelicans','hawks','nets','hornets','pistons','raptors','jazz','blazers','clippers','wizards','lebron james','stephen curry','victor wembanyama','luka doncic','giannis','nikola jokic','anthony edwards','ja morant','kevin durant','jayson tatum','shai gilgeous-alexander','nba draft','nba all star','basketball training','basketball drills'],
 '⚾ Baseball shorts': ['mlb','mlb highlights','mlb shorts','baseball highlights','baseball shorts','mlb top plays','home runs','diving catches','baseball skills','little league','little league world series','college baseball','softball highlights','baseball trick plays','baseball funny moments','pitching','baseball hitting drills','yankees','dodgers','red sox','cubs','mets','braves','astros','phillies','padres','giants baseball','cardinals baseball','mariners','blue jays','orioles','rangers baseball','twins','guardians','tigers baseball','brewers','royals','rays','reds','pirates','angels baseball','diamondbacks','rockies','marlins','nationals','white sox','athletics baseball','shohei ohtani','aaron judge','mookie betts','juan soto','bobby witt jr','paul skenes','elly de la cruz','world series','home run derby','mlb all star','baseball cards','wiffle ball'],
}
FOURTH_TOPICS = {
 '🔬 Science shorts': ['science youtuber','engineering channel','experiments channel','space channel','nature documentary shorts','physics fun','chemistry fun','robot builds','science magic','amazing facts'],
 '🐾 Animal shorts': ['animal channel','pet channel','dog channel','cat channel','wildlife channel','zookeeper','aquarium channel','farm channel','bird channel','reptile keeper'],
 '⚽ Sports shorts': ['sports channel','soccer channel','hockey channel','skate channel','trick shot channel','olympics','extreme sports','sports highlights channel','golf channel','tennis channel','nfl highlights','college football highlights','football skills','flag football'],
 '🎮 Gaming shorts': ['gaming channel','minecraft channel','roblox channel','nintendo channel','gaming shorts channel','game dev','indie games','retro games channel','speedrunner','gaming tips'],
 '🧱 LEGO & builds': ['lego channel','builder channel','maker channel','diy channel','rc channel','model channel','woodworking channel','3d print channel','engineering builds','cardboard channel'],
 '🎨 Art & DIY': ['art channel','drawing channel','painting channel','craft channel','sculpture channel','animation channel','cake artist','clay artist','artist shorts','diy ideas'],
 '🍳 Food shorts': ['cooking channel','baking channel','chef shorts','recipe channel','food channel','dessert channel','bbq channel','food review kids','snack channel','candy channel'],
 '😂 Comedy shorts': ['clean comedy channel','funny family channel','funny animals channel','animated comedy','sketch channel','funny sports channel','kids comedy','prank free comedy','wholesome funny','funny moments clean'],
 '✨ Satisfying': ['satisfying channel','restoration channel','cleaning channel','factory channel','machine channel','asmr satisfying channel','process videos','how its made channel','craftsman','satisfying art'],
 '🚗 Cars & machines': ['car channel','truck channel','train channel','plane channel','construction channel','tractor channel','rc car channel','motorsport','racing channel','space launch channel'],
 '🎵 Music shorts': ['music channel','piano channel','guitar channel','drum channel','singer channel','dance channel','band channel','beatbox channel','violin channel','music teacher'],
 '🌍 World & travel': ['travel channel','geography channel','history channel','nature channel','national geographic kids','world facts channel','city tour','country facts','explorer channel','maps channel'],
 '🎩 Magic & tricks': ['magic channel','magician','card magic channel','illusion channel','juggling channel','yo-yo channel','skill channel','puzzle channel','riddle channel','life hack channel'],
}
LONGCAT = lambda c: c.replace(' shorts', '')

def secs(t):
    p = [int(x) for x in re.findall(r'\d+', t or '')]
    s = 0
    for x in p: s = s * 60 + x
    return s

def channel_videos(ch):
    path = ch['url'] if ch['url'].startswith('/@') else '/channel/' + ch['id']
    d = initial_data(get('https://www.youtube.com' + path + '/videos'))
    if not d: return []
    out = []
    for l in walk(d, 'lockupViewModel', []):
        try:
            vid = l.get('contentId'); 
            title = l['metadata']['lockupMetadataViewModel']['title']['content']
            badges = walk(l.get('contentImage', {}), 'thumbnailBadgeViewModel', [])
            dur = secs(badges[0].get('text', '')) if badges else 0
            if vid and len(vid) == 11: out.append({'yt': vid, 'title': title, 'dur': dur})
        except Exception: pass
    return out

def stage_videos():
    chans = []
    seen = set()
    for f in CHFILE.split(','):
        p = os.path.join(OUT, f)
        if not os.path.exists(p): continue
        for c in json.load(open(p)):
            if c.get('id') and c['id'] not in seen: seen.add(c['id']); chans.append(c)
    res = {}
    def one(ch): return ch, channel_videos(ch)
    with cf.ThreadPoolExecutor(6) as ex:
        for n, (ch, vids) in enumerate(ex.map(one, chans)):
            keep = []
            for v in vids:
                t = v['title'].strip()
                if not t or not (75 <= v['dur'] <= 40 * 60) or BLOCK.search(t) or not english(t): continue
                keep.append({'yt': v['yt'], 'title': t[:100], 'dur': v['dur']})
                if len(keep) >= PER: break
            if len(keep) >= 3: res[ch['id']] = {'by': ch['title'], 'cat': LONGCAT(ch['cat']), 'subs': ch['subs'], 'v': keep}
            if n % 50 == 0: print(n, '/', len(chans), 'channels ·', sum(len(r['v']) for r in res.values()), 'videos', flush=True)
            if n % 300 == 0: json.dump(res, open(os.path.join(OUT, SHFILE), 'w'))
    json.dump(res, open(os.path.join(OUT, SHFILE), 'w'))
    print('channels with videos:', len(res), 'videos:', sum(len(r['v']) for r in res.values()))

PER = int(os.environ.get('PER', '24')); CHFILE = os.environ.get('CHFILE', 'channels.json'); SHFILE = os.environ.get('SHFILE', 'shorts.json')
if os.environ.get('MORE'):
    TOPICS = MORE_TOPICS
if os.environ.get('THIRD'):
    TOPICS = THIRD_TOPICS
if os.environ.get('SPORTS'):
    TOPICS = SPORTS_TOPICS
if os.environ.get('FOURTH'):
    TOPICS = FOURTH_TOPICS
if __name__ == '__main__':
    {'channels': stage_channels, 'shorts': stage_shorts, 'videos': stage_videos}[sys.argv[1]]()
