import json,shutil,os,re
rows=json.load(open('rows.json')); T=json.load(open('ptest.json'))
keep=[]; drop=[]
for r in rows:
    t=T.get(r[0],{})
    ok=('fail' not in t) and (t.get('c',0)>0 or t.get('txt',0)>20 or t.get('els',0)>5)
    (keep if ok else drop).append(r)
for r in drop: shutil.rmtree('dist/'+r[0],ignore_errors=True)
# credits page: only kept games
s=open('dist/index.html').read()
for r in drop: s=re.sub(r'<tr><td><a href="'+re.escape(r[0])+r'/">.*?</tr>','',s)
open('dist/index.html','w').write(s)
SECS=["Racing","Shooters","Sports","Action","Adventure","Multiplayer","Puzzle","Arcade","Casual"]
R=[[r[0],r[1],SECS.index(r[2]),(r[3]+' js13k open source '+str(r[5])).strip(),r[4]] for r in keep]
SITE='/home/user/waterworks-site/rink-rivals/'
js=('/* '+str(len(R))+' open-source js13kGames entries, hosted on our own games site (no ads, hard to block). Packed: [slug, title, section, tags, thumb file]. */\n'
 '(function(){const G="https://rink-rivals-games.mitchellchad2026.workers.dev/",S='+json.dumps(SECS)+',R='+json.dumps(R,separators=(',',':'),ensure_ascii=False)+';\n'
 'window.NETX=(window.NETX||[]).concat(R.map(r=>["os",r[0],r[1],S[r[2]],G+r[0]+"/",r[4]?G+r[0]+"/"+r[4]:"",r[3],r[3],r[0]]));})();\n')
open(SITE+'net-js13k.js','w').write(js)
for f in ['net-all.js','net-games.js']:
    s=open(SITE+f).read(); n=int(re.search(r'window\.NETTOTAL=(\d+);',s).group(1)); 
    base=n-int(open('lastcount').read()) if os.path.exists('lastcount') else n
    s=re.sub(r'window\.NETTOTAL=\d+;','window.NETTOTAL='+str(base+len(R))+';',s); open(SITE+f,'w').write(s)
open('lastcount','w').write(str(len(R)))
print('kept',len(keep),'dropped',len(drop),'total now',base+len(R))
