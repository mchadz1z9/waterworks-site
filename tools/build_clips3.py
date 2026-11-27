#!/usr/bin/env python3
"""Rival Clips batch 3: regular videos (clips-long.js) and more Shorts incl. NBA + baseball (clips-data3.js).
Drops channels whose videos are blocked from playing on other websites (embed check results), and prunes them from batches 1-2."""
import json, re, os, subprocess, collections
SP = os.path.dirname(os.path.abspath(__file__)); SITE = os.environ.get('SITE', '/home/user/waterworks-site/rink-rivals/')
src2 = open(os.path.join(SP, 'build_clips2.py')).read()
for name in ['EXTRA', 'DENYCH', 'FOREIGN']:
    exec(re.search(r'^' + name + r' = .*$', src2, re.M).group(0))
def foreign(t):
    w = re.findall(r"[a-zà-ÿ]+", t.lower()); return sum(x in FOREIGN for x in w) >= 2
# blocked channels from the embed checks
BLOCKED = set()
for sf, rf in [('chsample.json', 'chres.json'), ('chsample2.json', 'chres2.json'), ('chsample3.json', 'chres3.json')]:
    if not os.path.exists(os.path.join(SP, rf)): continue
    res = json.load(open(os.path.join(SP, rf)))
    for vid, by in json.load(open(os.path.join(SP, sf))):
        if res.get(vid, '').startswith('blocked'): BLOCKED.add(by)
BLOCKED |= {'NFL', 'NFL Films', 'NFL Throwback', 'FIFA', 'FORMULA 1', 'F1 Academy', 'Mundo NFL', 'NFL Brasil'}
print('blocked channels:', len(BLOCKED))
json.dump(sorted(BLOCKED), open(os.path.join(SP, 'blocked_channels.json'), 'w'), ensure_ascii=False, indent=0)
# prune batches 1 and 2 in place (same file formats)
prune = r'''
const fs=require('fs');global.window={};global.addEventListener=()=>{};global.dispatchEvent=()=>{};global.Event=function(){};
const BL=new Set(JSON.parse(fs.readFileSync(process.argv[2])));const S=process.argv[3];
// batch 1: hand-picked list O (kept as JSON) + compact V
let s=fs.readFileSync(S+'clips-data.js','utf8');const i0=s.indexOf('const O=')+8,i1=s.indexOf('];',i0)+1;let O=JSON.parse(s.slice(i0,i1));
require(S+'clips-data.js');const all=window.RR_CLIPS;const n0=all.length;const oIds=new Set(O.map(o=>o.id));
O=O.filter(o=>!BL.has(o.by));const rest=all.filter(c=>!oIds.has(c.id)&&!BL.has(c.by));
const B=[],bi={},C=[],ci={},V=[];for(const c of rest){if(!(c.by in bi)){bi[c.by]=B.length;B.push(c.by)}if(!(c.cat in ci)){ci[c.cat]=C.length;C.push(c.cat)}V.push([c.yt,c.title,bi[c.by],ci[c.cat]])}
const head=s.slice(0,s.indexOf('window.RR_CLIPS'));
fs.writeFileSync(S+'clips-data.js',head+'window.RR_CLIPS=(function(){const O='+JSON.stringify(O)+';\nconst B='+JSON.stringify(B)+',C='+JSON.stringify(C)+';\nconst V='+JSON.stringify(V)+';\nfor(const v of V)O.push({id:"yt:"+v[0],src:"yt",yt:v[0],title:v[1],by:B[v[2]],cat:C[v[3]],short:1});return O;})();\n');
// batch 2
let s2=fs.readFileSync(S+'clips-data2.js','utf8');const b2=JSON.parse(s2.match(/const B=(\[.*?\]),C=/s)[1]);const v2=JSON.parse(s2.match(/const V=(\[.*\]);\nfor/s)[1]);
const v2n=v2.filter(v=>!BL.has(b2[v[2]]));fs.writeFileSync(S+'clips-data2.js',s2.replace(/const V=\[.*\];\nfor/s,()=>'const V='+JSON.stringify(v2n)+';\nfor'));
console.log('batch1',n0,'->',O.length+V.length,'batch2',v2.length,'->',v2n.length);
'''
open(os.path.join(SP, 'prune.js'), 'w').write(prune)
print(subprocess.run(['node', os.path.join(SP, 'prune.js'), os.path.join(SP, 'blocked_channels.json'), SITE], capture_output=True, text=True).stdout.strip() or 'prune failed')
have = set(re.findall(r'"([\w-]{11})"', open(SITE + 'clips-data.js', encoding='utf-8').read() + open(SITE + 'clips-data2.js', encoding='utf-8').read()))
HOOPS = re.compile(r"(\bnba\b|wnba|basketball|\bhoops?\b|\bdunks?\b|buzzer.?beater|three.?pointer|crossover|lakers|warriors|celtics|knicks|76ers|sixers|cavaliers|\bcavs\b|timberwolves|grizzlies|pelicans|raptors|trail ?blazers|clippers|mavericks|nuggets|pistons|hornets|lebron|steph curry|stephen curry|wembanyama|\bwemby\b|doncic|giannis|jokic|anthony edwards|ja morant|kevin durant|jayson tatum|gilgeous|march madness|g league|streetball|nba 2k)", re.I)
BALL = re.compile(r"(\bmlb\b|baseball|softball|home ?runs?\b|\bhomers?\b|pitcher|strikeouts?|\binnings?\b|world series|little league|yankees|dodgers|red sox|\bcubs\b.*(game|win|homer|hit|walk)|\bmets\b|braves|astros|phillies|padres|mariners|blue jays|orioles|brewers|diamondbacks|rockies|marlins|white sox|ohtani|aaron judge|mookie|juan soto|bobby witt|skenes|elly de la cruz|wiffle ?ball|batting|grand slam)", re.I)
def build(files, out, long, cap, label):
    chans = {}
    for f in files:
        p = os.path.join(SP, 'yt', f)
        if not os.path.exists(p): continue
        for cid, r in json.load(open(p)).items():
            c = chans.setdefault(r['by'], {'by': r['by'], 'cat': r['cat'], 'subs': r['subs'], 'v': []}); c['v'] += r['v']
    B, bi, C, ci, V = [], {}, [], {}, []
    for c in sorted(chans.values(), key=lambda c: -c['subs']):
        if DENYCH.search(c['by']) or c['by'] in BLOCKED: continue
        vs = []
        for v in c['v']:
            if v['yt'] in have or EXTRA.search(v['title']) or foreign(v['title']): continue
            if ('NBA' in c['cat'] and not (HOOPS.search(v['title']) or re.search(r'(nba|basketball|hoops)', c['by'], re.I))) or ('Baseball' in c['cat'] and not (BALL.search(v['title']) or re.search(r'(mlb|baseball)', c['by'], re.I))): continue
            have.add(v['yt']); vs.append(v)
        if len(vs) < 3: continue
        if c['by'] not in bi: bi[c['by']] = len(B); B.append(c['by'])
        if c['cat'] not in ci: ci[c['cat']] = len(C); C.append(c['cat'])
        for v in vs[:cap]:
            V.append([v['yt'], v['title'], bi[c['by']], ci[c['cat']]] + ([v.get('dur', 0)] if long else []))
    push = ('A.push({id:"yt:"+v[0],src:"yt",yt:v[0],title:v[1],by:B[v[2]],cat:C[v[3]],d:v[4]})' if long else
            'A.push({id:"yt:"+v[0],src:"yt",yt:v[0],title:v[1],by:B[v[2]],cat:C[v[3]],short:1})')
    js = ('/* Rival Clips ' + label + ': ' + str(len(V)) + ' from ' + str(len(B)) + ' channels. Generated; loads after the page and adds itself to the list. */\n'
          '(function(){const A=window.RR_CLIPS||(window.RR_CLIPS=[]);\nconst B=' + json.dumps(B, ensure_ascii=False, separators=(',', ':')) + ',C=' + json.dumps(C, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'const V=' + json.dumps(V, ensure_ascii=False, separators=(',', ':')) + ';\nfor(const v of V)' + push + ';try{dispatchEvent(new Event("rr-clips-more"))}catch(e){}})();\n')
    open(SITE + out, 'w', encoding='utf-8').write(js)
    print(out, len(V), 'from', len(B), 'channels', round(len(js.encode()) / 1e6, 1), 'MB', collections.Counter(C[v[3]] for v in V).most_common())
build(['sh_sports.json', 'sh_fourth.json'], 'clips-data3.js', False, 48, 'Shorts batch 3 (incl. NBA and baseball)')
build(['v_sports.json', 'v_main.json', 'v_fourth.json'], 'clips-long.js', True, 20, 'regular videos')
