import json,re,collections,html
L=json.load(open('gm_all.json'))
BAD=re.compile(r"(blood|\bgor(e|y)\b|kiss|dating|\bdate\b|romance|romantic|girlfriend|boyfriend|(my|your|secret|school) crush|crush on|\bcouples?\b|young love|love (story|puzzle|ladder|test|letter)|gangsta|pregnan|sexy|\bsex|bikini|lingerie|nude|naked|drunk|beer|alcohol|vodka|casino|gambl|\bslots?\b|\bbet(ting)?\b|horror|scary|creepy|terrif|nightmare|granny|skibidi|murder|\bkill(er|ing)?\b.*(people|human|civilian)|torture|serial|cigar|\bsmoking\b|vape|weed|\bdrug|suicide|\bhell\b|devil|demon|satan|\bgang(s|ster)?\b|mafia|thug|hitman|assassin|sniper.*(city|people)|surgery|monkey mart|princess.*(date|kiss)|squid game|backrooms|huggy|poppy|siren head|five nights|fnaf|freddy|rainbow friends|minecraft|roblox|among us|fortnite|mario|sonic|pokemon|pikachu|spongebob|disney|barbie|lego|subway surf|temple run|angry birds|cut the rope|stumble guys|fall guys|geometry dash|slither|agar|krunker|shell shock|1v1\.lol|bloxd|stickman hook)",re.I)
SEC={'Racing':'Racing','Shooting':'Shooters','Sports':'Sports','Soccer':'Sports','Action':'Action','Stickman':'Action','Boys':'Action','Multiplayer':'Multiplayer','.IO':'Multiplayer','2 Player':'Multiplayer','Puzzle':'Puzzle','Adventure':'Adventure','3D':'Adventure','Arcade':'Arcade','Hypercasual':'Casual','Clicker':'Casual','Girls':'Casual','Cooking':'Casual'}
seen=set();out=[]
for g in L:
  t=html.unescape(g['title']).strip(); txt=' '.join([t,g.get('description',''),g.get('tags','')])
  if BAD.search(txt) or not g.get('url','').startswith('https://html5.gamemonetize.co/'): continue
  k=re.sub(r'[^a-z0-9]','',t.lower())
  if k in seen or len(k)<3: continue
  if not re.fullmatch(r"[\x20-\x7e]+",t): continue
  seen.add(k)
  c=SEC.get(g['category'],'Casual')
  tg=g.get('tags','').lower()
  score=min(len(g.get('description','')),400)/400 + (0.6 if '3d' in (tg+t.lower()) else 0) + (0.3 if c in('Racing','Shooters','Sports','Multiplayer','Action') else 0) + (0.2 if 'multiplayer' in tg else 0)
  out.append(dict(id=g['id'],t=t,c=c,u=g['url'],th=g['thumb'],d=re.sub(r'\s+',' ',html.unescape(g.get('description','')))[:150],s=round(score,3)))
print(len(out),collections.Counter(o['c'] for o in out))
json.dump(out,open('cand.json','w'))
