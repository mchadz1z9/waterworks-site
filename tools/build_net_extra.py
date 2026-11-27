import json,re,glob,html,collections,os
exec(open('pick2.py').read().split("seen=set();out=[]")[0].replace("L=json.load(open('gm_all.json'))",""))  # BAD, SEC
SECS=['Racing','Shooters','Sports','Action','Adventure','Multiplayer','Puzzle','Arcade','Casual']
EXTRA={'shooter':'Shooters','shooting':'Shooters','football':'Sports','basketball':'Sports','soccer':'Sports','sport':'Sports','sports':'Sports','.io':'Multiplayer','io':'Multiplayer','multiplayer':'Multiplayer','2 player':'Multiplayer','racing':'Racing','driving':'Racing','car':'Racing','action':'Action','fighting':'Action','stickman':'Action','boys':'Action','adventure':'Adventure','3d':'Adventure','platformer':'Adventure','puzzle':'Puzzle','match-3':'Puzzle','strategy':'Puzzle','board':'Puzzle','cards':'Puzzle','arcade':'Arcade','classics':'Arcade','casual':'Casual','hypercasual':'Casual','clicker':'Casual','girls':'Casual','cooking':'Casual','dress-up':'Casual','kids':'Casual','educational':'Puzzle','quiz':'Puzzle','idle':'Casual','simulation':'Casual','bejeweled':'Puzzle','jigsaw':'Puzzle','mahjong':'Puzzle'}
KW=[('shoot','Shooters'),('gun','Shooters'),('sniper','Shooters'),('racing','Racing'),('driving','Racing'),('car','Racing'),('bike','Racing'),('sport','Sports'),('soccer','Sports'),('football','Sports'),('basket','Sports'),('ball','Sports'),('io','Multiplayer'),('multiplayer','Multiplayer'),('2 player','Multiplayer'),('fight','Action'),('action','Action'),('stickman','Action'),('adventure','Adventure'),('platform','Adventure'),('3d','Adventure'),('puzzle','Puzzle'),('match','Puzzle'),('mahjong','Puzzle'),('board','Puzzle'),('card','Puzzle'),('quiz','Puzzle'),('educational','Puzzle'),('arcade','Arcade'),('classic','Arcade'),('bubble','Arcade')]
def sec(c):
    c=(c or '').strip().lower()
    for k,v in KW:
        if k in c and not (k=='io' and c!='io' and '.io' not in c): return v
    for k,v in SEC.items():
        if k.lower()==c: return v
    return EXTRA.get(c,'Casual')
norm=lambda t:re.sub(r'[^a-z0-9]','',t.lower())
seen=set()
for f in glob.glob('pages/*.json'):
    try:
        for g in json.load(open(f)): seen.add(norm(html.unescape(g['title'])))
    except Exception: pass
SEEN={'gd':set(),'gp':set(),'hg':set()}
def ok_title(t,net='gd'):
    k=norm(t)
    if k in SEEN[net] or len(k)<3 or not re.fullmatch(r"[\x20-\x7e]+",t): return False
    SEEN[net].add(k); return True  # copies on other networks are kept: if a school blocks one network, the copy may still play
# GameDistribution
gd=[]
for f in sorted(glob.glob('gd/*.json'),key=lambda f:int(re.sub(r'\D','',f))):
    try: L=json.load(open(f))
    except Exception: continue
    for g in L or []:
        t=html.unescape(str(g.get('Title',''))).strip(); md5=str(g.get('Md5','')).lower()
        if not re.fullmatch(r'[a-f0-9]{32}',md5) or str(g.get('Type','')).lower()!='html5': continue
        try: cats=eval(g.get('Category') or '[]') if isinstance(g.get('Category'),str) else (g.get('Category') or [])
        except Exception: cats=[]
        try: tags=eval(g.get('Tag') or '[]') if isinstance(g.get('Tag'),str) else (g.get('Tag') or [])
        except Exception: tags=[]
        txt=' '.join([t,str(g.get('Description','')),' '.join(map(str,cats)),' '.join(map(str,tags))])
        txt=re.sub(r"\bno[ -](blood|violence|gore|guns?|killing)\b",' ',txt,flags=re.I)
        if BAD.search(txt) or not ok_title(t): continue
        tg=' '.join(dict.fromkeys(re.sub(r'[^a-z0-9 ]+',' ',' '.join(map(str,tags)).lower()).split()))[:70].rsplit(' ',1)[0]
        gd.append([md5,t,SECS.index(sec(cats[0] if cats else '')),tg])
# GamePix
gp=[]
for f in sorted(glob.glob('gp/*.json'),key=lambda f:int(re.sub(r'\D','',f))):
    try: d=json.load(open(f))
    except Exception: continue
    for g in d.get('items',[]):
        t=html.unescape(str(g.get('title',''))).strip(); ns=str(g.get('namespace','')); gid=re.sub(r'\D','',str(g.get('id','')))
        if not re.fullmatch(r'[a-z0-9-]{2,80}',ns) or not gid: continue
        if BAD.search(t+' '+str(g.get('description',''))+' '+str(g.get('category',''))) or not ok_title(t,'gp'): continue
        gp.append([int(gid),ns,t,SECS.index(sec(g.get('category'))),str(g.get('category','')).lower()])

# HTMLGames
hg=[]
try: H=json.load(open('hg.json'))
except Exception: H=[]
for g in H:
    t=html.unescape(str(g.get('name',''))).strip(); m=re.match(r'https://cdn\.htmlgames\.com/([A-Za-z0-9_-]{2,60})/index\.html$',str(g.get('url','')))
    if not m: continue
    if BAD.search(t+' '+str(g.get('description',''))+' '+str(g.get('category',''))) or not ok_title(t,'hg'): continue
    hg.append([m.group(1),t,SECS.index(sec(g.get('category'))),str(g.get('category','')).lower()[:40]])
js3=('/* '+str(len(hg))+' games from the HTMLGames.com public feed. Packed: [folder, title, section, category]. */\n'
 '(function(){const S='+json.dumps(SECS)+',R='+json.dumps(hg,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["hg",r[0],r[1],S[r[2]],"https://cdn.htmlgames.com/"+r[0]+"/index.html","https://cdn.htmlgames.com/"+r[0]+"/img/icon/image-300x200.jpg",r[3],r[3],r[0]]));})();\n')
SITE='/home/user/waterworks-site/rink-rivals/'
js1=('/* '+str(len(gd))+' kid-filtered games from the GameDistribution public catalog. Packed: [md5, title, section, tags]. */\n'
 '(function(){const S='+json.dumps(SECS)+',R='+json.dumps(gd,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["gd",r[0],r[1],S[r[2]],"https://html5.gamedistribution.com/"+r[0]+"/","https://img.gamedistribution.com/"+r[0]+"-512x384.jpg",r[3],r[3],r[0]]));})();\n')
js2=('/* '+str(len(gp))+' kid-filtered games from the GamePix public feed. Packed: [id, slug, title, section, category]. */\n'
 '(function(){const S='+json.dumps(SECS)+',R='+json.dumps(gp,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["gp",String(r[0]),r[2],S[r[3]],"https://play.gamepix.com/"+r[1]+"/embed?sid=1","https://img.gamepix.com/games/"+r[1]+"/cover/"+r[1]+".png?w=320",r[4],r[4],r[1]]));})();\n')
open(SITE+'net-gd.js','w').write(js1); open(SITE+'net-gp.js','w').write(js2); open(SITE+'net-hg.js','w').write(js3)
gm=len(json.loads(re.search(r',R=(\[.*\]);\n',open(SITE+'net-all.js').read(),re.S).group(1)))
tot=gm+len(gd)+len(gp)+len(hg)
for f in ['net-games.js','net-all.js']:
    s=open(SITE+f).read(); s=re.sub(r'window\.NETTOTAL=(\d+|R\.length);','window.NETTOTAL='+str(tot)+';',s); open(SITE+f,'w').write(s)
print('gm',gm,'gd',len(gd),'gp',len(gp),'hg',len(hg),'total',tot,'MB',round(len(js1)/1e6,2),round(len(js2)/1e6,2))
print(collections.Counter(SECS[r[2]] for r in gd).most_common(), collections.Counter(SECS[r[3]] for r in gp).most_common())
