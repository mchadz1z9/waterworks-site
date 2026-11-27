import json,re,glob,html,collections
src=open('pick4.py').read()
exec(src.split("# GameDistribution")[0])   # BAD, SECS, sec(), ok_title()
SEEN.update({'pg':set(),'fm':set()})
GBAD=re.compile(r'\b(horror|scary|zombie apocalypse|gore|blood|dating|kiss|romance|casino|gambl|slot|poker|roulette|bikini|sexy|beer|drunk|cigar|weed|nsfw|adult|18\+|teen titans)\b',re.I)
def secOf(gs):
    for c in gs:
        s=sec(c)
        if s!='Casual' or c.lower() in ('casual','casual games','clicker','girls','cooking'): return s
    return 'Casual'
pg=[]
for f in sorted(glob.glob('pg3/*.json')):
    try: d=json.load(open(f))
    except Exception: continue
    s=d.get('slug',''); t=html.unescape(str(d.get('name') or '')).strip(); gs=[str(x) for x in (d.get('genre') or []) if x not in ('New',)]
    if not re.fullmatch(r'[a-z0-9-]{2,90}',s) or not t: continue
    txt=' '.join([t,d.get('desc',''),' '.join(gs)])
    if BAD.search(txt) or GBAD.search(' '.join(gs)+' '+t) or not ok_title(t,'pg'): continue
    icon=str(d.get('icon') or ''); m=re.match(r'https://static\.playgama\.com/p-img/pg/([a-z0-9/_-]{10,200})\?width=218$',icon)
    tg=' '.join(dict.fromkeys(re.sub(r'[^a-z0-9 ]+',' ',' '.join(gs).lower().replace(' games','')).split()))[:70].rsplit(' ',1)[0]
    pg.append([s,t,SECS.index(secOf(gs)),tg,m.group(1) if m else ''])
fm=[]
for g in json.load(open('fm.json'))['games']:
    p=str(g.get('package_id','')); t=html.unescape(str(g.get('name',''))).strip(); cats=[str(c) for c in g.get('categories') or []]
    if not re.fullmatch(r'[a-z0-9-]{2,90}',p) or not t: continue
    if BAD.search(t+' '+str(g.get('description',''))+' '+' '.join(cats)) or GBAD.search(t+' '+' '.join(cats)) or not ok_title(t,'fm'): continue
    th=str(g.get('thumb_180') or g.get('thumb') or ''); th=th if th.startswith('https://img.cdn.famobi.com/') and '"' not in th else ''
    fm.append([p,t,SECS.index(secOf(cats)),' '.join(cats)[:60],th.replace('https://img.cdn.famobi.com/portal/html5games/images/tmp/','')])
SITE='/home/user/waterworks-site/rink-rivals/'
js1=('/* '+str(len(pg))+' kid-filtered games from Playgama (official embed links). Packed: [slug, title, section, tags, icon id]. */\n'
 '(function(){const S='+json.dumps(SECS)+',R='+json.dumps(pg,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["pg",r[0],r[1],S[r[2]],"https://playgama.com/export/game/"+r[0],r[4]?"https://static.playgama.com/p-img/pg/"+r[4]+"?width=218":"",r[3],r[3],r[0]]));})();\n')
js2=('/* '+str(len(fm))+' kid-filtered games from the Famobi public feed. Packed: [package, title, section, categories, thumb]. */\n'
 '(function(){const S='+json.dumps(SECS)+',R='+json.dumps(fm,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["fm",r[0],r[1],S[r[2]],"https://play.famobi.com/"+r[0],r[4]?"https://img.cdn.famobi.com/portal/html5games/images/tmp/"+r[4]:"",r[3],r[3],r[0]]));})();\n')
open(SITE+'net-pg.js','w').write(js1); open(SITE+'net-fm.js','w').write(js2)
s=open(SITE+'net-all.js').read(); old=int(re.search(r'window\.NETTOTAL=(\d+);',s).group(1))
cnt=lambda f:len(json.loads(re.search(r',R=(\[.*\]);\n',open(SITE+f).read(),re.S).group(1)))
base=cnt('net-all.js')+cnt('net-gd.js')+cnt('net-gp.js')+cnt('net-hg.js'); tot=base+len(pg)+len(fm)+2
for f in ['net-games.js','net-all.js']:
    s=open(SITE+f).read(); s=re.sub(r'window\.NETTOTAL=\d+;','window.NETTOTAL='+str(tot)+';',s); open(SITE+f,'w').write(s)
print('pg',len(pg),'fm',len(fm),'total',tot,'MB',round(len(js1)/1e6,2))
print(collections.Counter(SECS[r[2]] for r in pg).most_common())
