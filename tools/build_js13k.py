import json,re,os,glob,zipfile,shutil,html,io,collections,subprocess
NETDIR='/tmp/claude-0/-home-user/a785dd05-4d1d-5619-bd94-c8cdb344fb8e/scratchpad/net/'
exec(open(NETDIR+'pick2.py').read().split("SEC=")[0].replace("L=json.load(open('gm_all.json'))",""))   # BAD (kid filter)
OUT='dist'; shutil.rmtree(OUT,ignore_errors=True); os.makedirs(OUT)
# titles + year from the js13k year files
TITLE={}; YEAR={}
for y in range(2012,2027):
    s=open(f'y{y}.bin','rb').read().decode('utf-8','replace')
    for p in [p.strip() for p in re.split(r'[\x00-\x1f�\x7f]+',s) if len(p.strip())>=2]:
        sl=re.sub(r'[^a-z0-9]+','-',p.lower()).strip('-')
        if sl not in TITLE: TITLE[sl]=p; YEAR[sl]=y
OKL={'MIT':r'permission is hereby granted, free of charge','Apache-2.0':r'apache license','BSD':r'redistribution and use in source and binary forms','AGPL':r'gnu affero general public license','LGPL':r'gnu lesser general public license','GPL':r'gnu general public license','MPL-2.0':r'mozilla public license','Unlicense':r'this is free and unencumbered software','CC0':r'(cc0|creative commons zero|no copyright)','ISC':r'permission to use, copy, modify, and/?or distribute','WTFPL':r'do what the fuck you want','Zlib':r"provided 'as-is', without any express"}
PKG_OK={'mit','isc','apache-2.0','bsd-2-clause','bsd-3-clause','gpl-3.0','gpl-2.0','gpl-3.0-or-later','gpl-3.0-only','lgpl-3.0','agpl-3.0','mpl-2.0','cc0-1.0','unlicense','wtfpl','zlib','cc-by-4.0','cc-by-sa-4.0','0bsd'}
NAMEPAT=r'(MIT|Apache[- ]?2(\.0)?|BSD|GPL(v?[23])?|GNU GPL|MPL|CC0|Unlicense|ISC|WTFPL|zlib|CC[- ]BY(-SA)?( [34]\.0)?)'
def lic_of(d):
    for f in glob.glob(d+'/LICEN[SC]E*')+glob.glob(d+'/Licen[sc]e*')+glob.glob(d+'/licen[sc]e*')+glob.glob(d+'/COPYING*'):
        try: t=open(f,errors='ignore').read()
        except Exception: continue
        tl=t.lower()
        if 'version https://git-lfs' in tl: continue
        if re.search(r'non-?commercial|noderivatives|no derivatives|by-nc|by-nd',tl): return None,None
        for k,p in OKL.items():
            if re.search(p,tl): return k,t
        if re.search(r'attribution 4\.0|creative commons attribution',tl): return 'CC-BY',t
    for f in glob.glob(d+'/README*')+glob.glob(d+'/readme*'):
        try: t=open(f,errors='ignore').read()
        except Exception: continue
        for m in re.finditer(r'licen[sc]',t,re.I):
            w=t[max(0,m.start()-60):m.start()+160]
            if re.search(r'non-?commercial|\bNC\b|no derivatives|all rights reserved',w,re.I): return None,None
            mm=re.search(NAMEPAT,w)
            if mm: return mm.group(1),None
    if os.path.exists(d+'/package.json'):
        try: j=json.load(open(d+'/package.json'))
        except Exception: j={}
        l=str(j.get('license','')).strip().lower()
        if l in PKG_OK: return j.get('license'),None
    return None,None
SECMAP=[('shooter','Shooters'),('racing','Racing'),('sport','Sports'),('multiplayer','Multiplayer'),('party','Multiplayer'),('puzzle','Puzzle'),('strategy','Puzzle'),('card','Puzzle'),('tabletop','Puzzle'),('educational','Puzzle'),('platformer','Adventure'),('adventure','Adventure'),('rpg','Adventure'),('action','Action'),('fighting','Action'),('arcade','Arcade'),('rhythm','Arcade'),('music','Arcade'),('casual','Casual'),('simulation','Casual')]
rows=[]; why=collections.Counter(); credits=[]
for d in sorted(glob.glob('repos/*')):
    sl=os.path.basename(d); w=d+'/.website'
    if not os.path.exists(d+'/.ok'): continue
    if not os.path.exists(w+'/game.zip'): why['no zip']+=1; continue
    meta=open(w+'/README.md',errors='ignore').read() if os.path.exists(w+'/README.md') else ''
    fm=re.search(r'^---(.*?)---',meta,re.S); genres=re.findall(r'^\s*-\s*([a-z0-9-]+)',fm.group(1),re.M) if fm else []
    desc=re.sub(r'\s+',' ',re.sub(r'[#*_`>\[\]]','',(meta[fm.end():] if fm else meta))).strip()[:220]
    title=TITLE.get(sl,sl.replace('-',' ').title())
    txt=' '.join([title,desc,' '.join(genres)])
    if BAD.search(txt) or re.search(r'\b(webxr|web xr|vr headset|oculus|decentraland|server category|socket\.io|nsfw)\b',txt,re.I): why['content/needs server or VR']+=1; continue
    lic,ltxt=lic_of(d)
    if not lic: why['no open license']+=1; continue
    try: z=zipfile.ZipFile(w+'/game.zip')
    except Exception: why['bad zip']+=1; continue
    zp=w+'/game.zip'
    def R(n):
        try: return z.read(n)
        except Exception: return subprocess.run(['unzip','-p',zp,n],capture_output=True,timeout=30).stdout
    names=[n for n in z.namelist() if not n.endswith('/') and '__MACOSX' not in n]
    idx=[n for n in names if n.split('/')[-1].lower()=='index.html']
    if not idx: why['no index.html']+=1; continue
    root=min(idx,key=len)[:-len('index.html')]
    if any(re.search(r'socket\.io|require\(["\']express',R(n).decode('utf-8','ignore')) for n in names if n.endswith(('.js','.html'))): why['needs a server']+=1; continue
    od=f'{OUT}/{sl}'; os.makedirs(od,exist_ok=True); total=0
    for n in names:
        if not n.startswith(root): continue
        rel=n[len(root):]
        if not rel or '..' in rel or rel.startswith('/'): continue
        data=R(n); total+=len(data)
        if total>8_000_000: break
        p=os.path.join(od,rel); os.makedirs(os.path.dirname(p),exist_ok=True); open(p,'wb').write(data)
    th=''
    for ext in ('png','jpg','jpeg','gif','webp'):
        f=f'{w}/thumbnail.{ext}'
        if os.path.exists(f) and os.path.getsize(f)>200 and not open(f,'rb').read(30).startswith(b'version https'):
            shutil.copy(f,f'{od}/rr-thumb.{ext}'); th=f'rr-thumb.{ext}'; break
    author=''
    m=re.search(r'Copyright\s*(\(c\)|©)?\s*(\d{4})?\s*([^\n]{2,60})',ltxt or '',re.I)
    if m: author=m.group(3).strip()
    open(f'{od}/RR-LICENSE.txt','w').write((ltxt or f'This game is released under the {lic} license (as stated by its author in the source repository).\n')+f'\n\nSource: https://github.com/js13kGames/{sl}\nMade for the js13kGames competition {YEAR.get(sl,"")}.\n')
    sec='Arcade'
    for g in genres:
        hit=[v for k,v in SECMAP if k in g]
        if hit: sec=hit[0]; break
    rows.append([sl,title,sec,' '.join(genres)[:60],th,YEAR.get(sl,0),lic]); credits.append((title,sl,YEAR.get(sl,''),lic,author))
print('kept',len(rows),dict(why))
json.dump(rows,open('rows.json','w'))
c=collections.Counter(r[2] for r in rows); print(c.most_common()); print(collections.Counter(r[6] for r in rows).most_common(12))
# credits page at the root of the games site
open(f'{OUT}/index.html','w').write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arcade Rivals · open-source games</title><style>body{font:15px system-ui;background:#0b1120;color:#e2e8f0;max-width:900px;margin:auto;padding:20px}a{color:#7dd3fc}td{padding:4px 8px;border-top:1px solid #1e293b}</style><h1>Open-source games on Arcade Rivals</h1><p>These games were made for the <a href="https://js13kgames.com">js13kGames</a> competition and released by their authors under open licenses. Each game keeps its license file (RR-LICENSE.txt). Thank you to every author!</p><table>'+''.join(f'<tr><td><a href="{html.escape(s)}/">{html.escape(t)}</a></td><td>{y}</td><td>{html.escape(str(l))}</td><td>{html.escape(a)}</td><td><a href="https://github.com/js13kGames/{html.escape(s)}">source</a></td></tr>' for t,s,y,l,a in sorted(credits,key=lambda x:x[0].lower()))+'</table>')
