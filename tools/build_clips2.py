#!/usr/bin/env python3
"""Build rink-rivals/clips-data2.js: up to 100,000 more Shorts from the crawl files, with the same extra filters as batch 1."""
import json, re, os, sys, collections
SP = os.path.dirname(os.path.abspath(__file__))
SITE = '/home/user/waterworks-site/rink-rivals/'
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 100000
EXTRA = re.compile(r"(omegle|ome\.tv|offensive|flirt|abuse|netflix|stand ?up comedy|\bcomedian|hangover|\bdate night|\bbra\b|lingerie|swimsuit|\bthong|booty|\bbutt\b|\bass\b|sucks|\bsuck\b|\bpee\b|\bpoop|toilet|vomit|puke|\bopps?\b|savage|rizz|gyat|skibidi|horny|\bnude|naked|\bstrip|pole dance|\bdies?\b|\bdied\b|suicid|self harm|depress|\bgun|\bshoot(ing|er)?\b|knife|weapon|attack|\bnato\b|russia|ukrain|israel|gaza|\bwar\b|military|missile|bomb|politic|trump|biden|president|election|terror|accident|crash|\bdead\b|\bkill)", re.I)
DENYCH = re.compile(r"(adam ray|family friendly$|bad parenting|dank|meme ?lord|roast|sidemen|\bksi\b|logan paul|jake paul|pewdiepie|nelk|faze|xqc|adin ross|kai cenat|niños|para ni|español|news|connects)", re.I)
FOREIGN = set('de la el los las que con para una por del ini yang dan itu bikin aku kamu nahi kya hai und der die das ist mit les des est une pour sur dans che sono não muito mas pero como esto esta este más tu su lo al y o en es un se le à ça je ne pas il mi ti ka ki ke ko na ne ho bhi aur'.split())
def foreign(t):
    w = re.findall(r"[a-zà-ÿ]+", t.lower()); return sum(x in FOREIGN for x in w) >= 2
have = set(re.findall(r'"([\w-]{11})"', open(SITE + 'clips-data.js', encoding='utf-8').read()))
chans = {}
for f in sys.argv[2:] or ['shorts2.json', 'shorts3.json']:
    p = os.path.join(SP, 'yt', f)
    if not os.path.exists(p): continue
    for cid, r in json.load(open(p)).items():
        c = chans.setdefault(cid, {'by': r['by'], 'cat': r['cat'], 'subs': r['subs'], 'v': []})
        c['v'] += r['v']
B, bi, C, ci, V = [], {}, [], {}, []
for c in sorted(chans.values(), key=lambda c: -c['subs']):
    if DENYCH.search(c['by']): continue
    vs = []
    for v in c['v']:
        if v['yt'] in have or EXTRA.search(v['title']) or foreign(v['title']): continue
        have.add(v['yt']); vs.append(v)
    if len(vs) < 4: continue
    if c['by'] not in bi: bi[c['by']] = len(B); B.append(c['by'])
    if c['cat'] not in ci: ci[c['cat']] = len(C); C.append(c['cat'])
    for v in vs[:48]:
        if len(V) >= TARGET: break
        V.append([v['yt'], v['title'], bi[c['by']], ci[c['cat']]])
    if len(V) >= TARGET: break
js = ('/* Rink Clips batch 2: ' + str(len(V)) + ' more Shorts from ' + str(len(B)) + ' channels. Generated; loads after the page and adds itself to the feed. */\n'
      '(function(){const A=window.RR_CLIPS||(window.RR_CLIPS=[]);\nconst B=' + json.dumps(B, ensure_ascii=False, separators=(',', ':')) + ',C=' + json.dumps(C, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'const V=' + json.dumps(V, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'for(const v of V)A.push({id:"yt:"+v[0],src:"yt",yt:v[0],title:v[1],by:B[v[2]],cat:C[v[3]],short:1});try{dispatchEvent(new Event("rr-clips-more"))}catch(e){}})();\n')
open(SITE + 'clips-data2.js', 'w', encoding='utf-8').write(js)
print('shorts', len(V), 'channels', len(B), 'bytes', len(js.encode()), collections.Counter(C[v[3]] for v in V).most_common())
