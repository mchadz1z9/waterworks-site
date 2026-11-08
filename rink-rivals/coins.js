/* Arcade Coins 🪙 — one currency for the whole site, saved on this device (like strength).
   Earn them in every game (finished matches, time played, gym reps, Rival City quests, a daily bonus) and spend them in the
   Arcade Shop: things you get inside the games — Rival City cash and cars, gym strength and pets, motocross paint, Sports Arcade kits.
   Games read what you own from localStorage: rrInv (owned items), rrEquip (what's equipped) and rrGrant (things waiting to be handed over). */
(function(){ if(window.RRCOIN) return;
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  const J=(k,d)=>{ try{ return JSON.parse(ls.get(k)||'null')||d; }catch(e){ return d; } };
  const isOwner=()=>{ if(ls.get('rrOwner')==='1'||/\bowner\b/.test(String(ls.get('rrMyTag')||'').toLowerCase())) return true; try{ return sessionStorage.getItem('rrRole')==='full'; }catch(e){ return false; } };
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'')||'index';
  const NOGAME=['','index','clips','about','hq-owa9rwwt9kplpdbu','sports-arcade','launch','admin'];
  const today=()=>new Date().toDateString();
  let bal=Math.max(0,+ls.get('rrCoins')||0); const inv=J('rrInv',{}), eq=J('rrEquip',{});
  let D=J('rrCoinDay',{}); if(D.d!==today()) D={d:today(),earned:0,play:0,res:0};
  /* v2: Arcade Level (from everything you've ever earned), a history of every coin, daily missions, the lucky wheel, daily deals, the bank */
  let LIFE=Math.max(0,+ls.get('rrCoinLife')||0); const LOG=J('rrCoinLog',[]);
  const lvlOf=L=>Math.floor(Math.sqrt(L/40)), lvl=()=>isOwner()?99:lvlOf(LIFE), lvlBonus=()=>Math.min(.5,lvl()*.02), nextAt=l=>40*(l+1)*(l+1);
  const logIt=(n,why)=>{ LOG.unshift({n:Math.round(n),w:String(why||'').replace(/^— /,'').slice(0,60),t:Date.now()}); LOG.length=Math.min(LOG.length,40); ls.set('rrCoinLog',JSON.stringify(LOG)); };
  const seedR=(seed)=>{ let x=0; for(const ch of seed) x=(x*31+ch.charCodeAt(0))>>>0; return ()=>{ x=(x*1664525+1013904223)>>>0; return x/4294967296; }; };
  const MPOOL=[{k:'games',n:'Finish {g} games',g:[2,3,5],r:120},{k:'mins',n:'Play for {g} minutes',g:[10,20,30],r:100},{k:'pages',n:'Play {g} different games',g:[2,3,4],r:150},
    {k:'earn',n:'Earn {g} coins',g:[150,300,500],r:120},{k:'spend',n:'Spend {g} coins in the shop',g:[150,300],r:100},{k:'spin',n:'Spin the Lucky Wheel',g:[1],r:60}];
  if(!D.m){ const r=seedR(today()+'m'), pool=MPOOL.slice(); D.m=[]; for(let i=0;i<3;i++){ const m=pool.splice(Math.floor(r()*pool.length),1)[0]; D.m.push({k:m.k,goal:m.g[Math.floor(r()*m.g.length)],got:0,r:m.r,claimed:false}); } D.pages=[]; D.spun=0; D.allClaimed=false; }
  function track(k,n){ let ch=false; for(const m of D.m||[]) if(m.k===k&&m.got<m.goal){ m.got=Math.min(m.goal,m.got+(n||1)); ch=true; if(m.got>=m.goal) toast(`✅ Mission done: ${mName(m)} — claim it in the shop`,'#4ade80'); } if(ch) save(); }
  const mName=m=>MPOOL.find(q=>q.k===m.k).n.replace('{g}',m.goal.toLocaleString());
  const CAP=2000;   /* most you can earn in a day (the daily bonus doesn't count) */
  const save=()=>{ ls.set('rrCoins',String(Math.round(bal))); ls.set('rrInv',JSON.stringify(inv)); ls.set('rrEquip',JSON.stringify(eq)); ls.set('rrCoinDay',JSON.stringify(D)); render(); try{ dispatchEvent(new CustomEvent('rrcoin-change')); }catch(e){} };
  const fmt=n=>isOwner()?'∞':Math.round(n).toLocaleString(), clamp01=v=>Math.max(0,Math.min(1,v||0));
  const dbl=()=>(+ls.get('rrCoin2x')||0)>Date.now();
  function add(n,why,quiet,noCap){ n=Math.round(+n||0); if(n<=0) return 0; if(isOwner()){ if(!quiet) toast(`+${n} 🪙 ${why||''}`); track('earn',n); return n; } if(dbl()) n*=2; n=Math.round(n*(1+lvlBonus())); if(!noCap){ n=Math.min(n,Math.max(0,CAP-D.earned)); D.earned+=n; } if(n<=0) return 0;
    passXP(n); const l0=lvlOf(LIFE); bal+=n; LIFE+=n; ls.set('rrCoinLife',String(LIFE)); logIt(n,why||'earned'); track('earn',n); save(); if(!quiet) toast(`+${n.toLocaleString()} 🪙 ${why||''}`);
    const l1=lvlOf(LIFE); if(l1>l0){ const rw=l1*25; bal+=rw; logIt(rw,`Arcade Level ${l1} reward`); save(); setTimeout(()=>toast(`⬆️ ARCADE LEVEL ${l1}! +${rw} 🪙 · coins now +${Math.round(lvlBonus()*100)}%`,'#c084fc'),900); }
    for(const [m,rw] of [[1000,100],[5000,400],[25000,1500],[100000,5000]]) if(LIFE>=m&&LIFE-n<m){ bal+=rw; logIt(rw,`Milestone: ${m.toLocaleString()} coins earned`); save(); setTimeout(()=>toast(`🏅 Milestone: ${m.toLocaleString()} coins earned! +${rw}`,'#facc15'),1800); }
    return n; }
  function spend(n,why){ if(isOwner()){ track('spend',n); return true; } if(bal<n) return false; bal-=n; logIt(-n,why||'spent'); track('spend',n); save(); return true; }
  /* ---- what's in the shop ---- */
  const grant=g=>{ const q=J('rrGrant',{}); for(const k in g){ if(typeof g[k]==='number') q[k]=(q[k]||0)+g[k]; else if(Array.isArray(g[k])) q[k]=(q[k]||[]).concat(g[k]); } ls.set('rrGrant',JSON.stringify(q)); };
  const addStr=n=>{ if(window.RRSTR&&!RRSTR.owner&&RRSTR.set){ RRSTR.set(RRSTR.level+n); } else { const v=+ls.get('rrStrength')||0; ls.set('rrStrength',String(Math.round(v+n))); } };
  const ITEMS=[
    {k:'wcheck',cat:'🎨 Car wraps — every racing game',ic:'🏁',n:'Checkered flag',d:'Black-and-white race checkers all over',p:350,slot:'wrap',val:{t: 'checker', c: ['#f8fafc', '#111827']}},
    {k:'wcheckgold',cat:'🎨 Car wraps — every racing game',ic:'🏆',n:'Gold checkers',d:'Gold and black checkers',p:600,slot:'wrap',val:{t: 'checker', c: [[2, 1.6, 0.3], '#111827']}},
    {k:'wflames',cat:'🎨 Car wraps — every racing game',ic:'🔥',n:'Hot rod flames',d:'Classic yellow-to-red flames licking down the sides',p:450,slot:'wrap',val:{t: 'flames', c: ['#facc15', '#f97316', '#dc2626']}},
    {k:'wblueflames',cat:'🎨 Car wraps — every racing game',ic:'💙',n:'Blue flames',d:'Blue-hot flames',p:500,slot:'wrap',val:{t: 'flames', c: ['#e0f2fe', '#38bdf8', '#1d4ed8']}},
    {k:'wcamo',cat:'🎨 Car wraps — every racing game',ic:'🌲',n:'Woodland camo',d:'Army greens and browns',p:350,slot:'wrap',val:{t: 'camo', c: ['#4d5d2a', '#2f3a1a', '#6b5b3a', '#1c1f12']}},
    {k:'warctic',cat:'🎨 Car wraps — every racing game',ic:'❄️',n:'Arctic camo',d:'Snow whites and greys',p:350,slot:'wrap',val:{t: 'camo', c: ['#e5e7eb', '#9ca3af', '#f8fafc', '#6b7280']}},
    {k:'wdesert',cat:'🎨 Car wraps — every racing game',ic:'🏜️',n:'Desert camo',d:'Sand and tan',p:350,slot:'wrap',val:{t: 'camo', c: ['#d6b98c', '#a68a5b', '#e7d3b0', '#7c6544']}},
    {k:'wdigital',cat:'🎨 Car wraps — every racing game',ic:'👾',n:'Digital camo',d:'Pixel camo in blues',p:400,slot:'wrap',val:{t: 'digital', c: ['#1e3a8a', '#3b82f6', '#93c5fd', '#0f172a']}},
    {k:'wtiger',cat:'🎨 Car wraps — every racing game',ic:'🐯',n:'Tiger stripes',d:'Orange with black tiger stripes',p:450,slot:'wrap',val:{t: 'tiger', c: ['#f97316', '#111827']}},
    {k:'wzebra',cat:'🎨 Car wraps — every racing game',ic:'🦓',n:'Zebra',d:'Black and white zebra stripes',p:400,slot:'wrap',val:{t: 'zebra', c: ['#f8fafc', '#111827']}},
    {k:'wleopard',cat:'🎨 Car wraps — every racing game',ic:'🐆',n:'Leopard',d:'Golden with dark spots',p:450,slot:'wrap',val:{t: 'leopard', c: ['#d4a24c', '#3b2a12']}},
    {k:'wlightning',cat:'🎨 Car wraps — every racing game',ic:'⚡',n:'Lightning bolts',d:'Yellow bolts down both sides',p:400,slot:'wrap',val:{t: 'lightning', c: [[2.4, 2.2, 0.3]]}},
    {k:'wretro',cat:'🎨 Car wraps — every racing game',ic:'📼',n:'Retro stripes',d:'Seventies orange, red and yellow bands',p:350,slot:'wrap',val:{t: 'bands3', c: ['#f59e0b', '#ea580c', '#b91c1c']}},
    {k:'wsunset',cat:'🎨 Car wraps — every racing game',ic:'🌅',n:'Sunset fade',d:'Yellow to orange to purple',p:400,slot:'wrap',val:{t: 'bands', c: ['#fde047', '#fb923c', '#f43f5e', '#a21caf', '#4c1d95']}},
    {k:'wrainbow',cat:'🎨 Car wraps — every racing game',ic:'🌈',n:'Rainbow',d:'Every colour of the rainbow',p:450,slot:'wrap',val:{t: 'bands', c: ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6']}},
    {k:'wwaves',cat:'🎨 Car wraps — every racing game',ic:'🌊',n:'Ocean waves',d:'Rolling blue waves',p:450,slot:'wrap',val:{t: 'waves', c: ['#0ea5e9', '#0369a1', '#e0f2fe']}},
    {k:'wdots',cat:'🎨 Car wraps — every racing game',ic:'🔴',n:'Polka dots',d:'White with red polka dots',p:300,slot:'wrap',val:{t: 'dots', c: ['#f8fafc', '#dc2626']}},
    {k:'whearts',cat:'🎨 Car wraps — every racing game',ic:'💖',n:'Hearts',d:'Pink with little hearts',p:350,slot:'wrap',val:{t: 'hearts', c: ['#f9a8d4', '#be123c']}},
    {k:'wstars',cat:'🎨 Car wraps — every racing game',ic:'⭐',n:'Starfield',d:'Navy with white stars',p:400,slot:'wrap',val:{t: 'stars', c: ['#1e3a8a', '#f8fafc']}},
    {k:'wsnow',cat:'🎨 Car wraps — every racing game',ic:'☃️',n:'Snowflakes',d:'Ice blue with snowflakes',p:350,slot:'wrap',val:{t: 'stars', c: ['#7dd3fc', '#ffffff']}},
    {k:'wcarbon',cat:'🎨 Car wraps — every racing game',ic:'⬛',n:'Carbon fibre',d:'Woven black carbon',p:500,slot:'wrap',val:{t: 'carbon', c: ['#111827', '#27272a']}},
    {k:'wcircuit',cat:'🎨 Car wraps — every racing game',ic:'🔌',n:'Circuit board',d:'Green board with gold traces',p:550,slot:'wrap',val:{t: 'circuit', c: ['#14532d', [2, 1.6, 0.3]]}},
    {k:'wgraffiti',cat:'🎨 Car wraps — every racing game',ic:'🎨',n:'Graffiti',d:'Spray-paint splats in every colour',p:500,slot:'wrap',val:{t: 'graffiti', c: ['#f8fafc']}},
    {k:'whazard',cat:'🎨 Car wraps — every racing game',ic:'⚠️',n:'Hazard stripes',d:'Black and yellow warning stripes',p:400,slot:'wrap',val:{t: 'hazard', c: ['#facc15', '#111827']}},
    {k:'wpolice',cat:'🎨 Car wraps — every racing game',ic:'🚓',n:'Interceptor',d:'Black and white with a blue stripe',p:450,slot:'wrap',val:{t: 'police', c: ['#f8fafc', '#111827', '#1d4ed8']}},
    {k:'wpixel',cat:'🎨 Car wraps — every racing game',ic:'🕹️',n:'Arcade pixels',d:'Retro arcade colours',p:450,slot:'wrap',val:{t: 'digital', c: ['#111827', '#f43f5e', '#22d3ee', '#facc15']}},
    {k:'wgoldleaf',cat:'🎨 Car wraps — every racing game',ic:'🪙',n:'Gold leaf',d:'Patches of real gold',p:800,slot:'wrap',val:{t: 'goldleaf', c: [[2, 1.6, 0.35], [2.4, 2, 0.6]]}},
    {k:'pgold',cat:'🏎️ Cars — every racing game',ic:'🥇',n:'Gold chrome paint',d:'Your car in shining gold (NASCAR, Drift, Kart, Rival City)',p:500,slot:'paint',val:['#d4a017','#111827']},
    {k:'pblack',cat:'🏎️ Cars — every racing game',ic:'🖤',n:'Midnight black paint',d:'Murdered-out black with red trim',p:300,slot:'paint',val:['#0b0b0f','#ef4444']},
    {k:'pred',cat:'🏎️ Cars — every racing game',ic:'❤️',n:'Candy red paint',d:'Deep candy red with white trim',p:300,slot:'paint',val:['#dc2626','#f8fafc']},
    {k:'pice',cat:'🏎️ Cars — every racing game',ic:'🧊',n:'Ice blue paint',d:'Ice blue and white',p:300,slot:'paint',val:['#38bdf8','#f8fafc']},
    {k:'ptoxic',cat:'🏎️ Cars — every racing game',ic:'☢️',n:'Toxic green paint',d:'Lime green and black',p:300,slot:'paint',val:['#84cc16','#111827']},
    {k:'ppink',cat:'🏎️ Cars — every racing game',ic:'🩷',n:'Hot pink paint',d:'Hot pink with pale pink trim',p:300,slot:'paint',val:['#ec4899','#fdf2f8']},
    {k:'pgalaxy',cat:'🏎️ Cars — every racing game',ic:'🌌',n:'Galaxy purple paint',d:'Deep purple with glowing pink trim',p:600,slot:'paint',val:['#6d28d9',[2,.6,2.2]]},
    {k:'gblue',cat:'🏎️ Cars — every racing game',ic:'💙',n:'Blue underglow',d:'Neon lights under your car',p:400,slot:'glow',val:[.3,1.2,2.4]},
    {k:'gpink',cat:'🏎️ Cars — every racing game',ic:'💗',n:'Pink underglow',d:'Neon pink lights under your car',p:400,slot:'glow',val:[2.4,.4,1.6]},
    {k:'ggreen',cat:'🏎️ Cars — every racing game',ic:'💚',n:'Green underglow',d:'Neon green lights under your car',p:400,slot:'glow',val:[.4,2.4,.6]},
    {k:'wgt',cat:'🏎️ Cars — every racing game',ic:'🪽',n:'GT spoiler',d:'A big rear wing',p:350,slot:'wing',val:{c:'#111827'}},
    {k:'wcarbon',cat:'🏎️ Cars — every racing game',ic:'🛩️',n:'Carbon swan-neck wing',d:'A tall race wing with gold endplates',p:700,slot:'wing',val:{c:'#1f2937',e:[2,1.6,.3],tall:1}},
    {k:'xflames',cat:'🏎️ Cars — every racing game',ic:'🔥',n:'Exhaust flames',d:'Flames shoot out the back when you\'re flat out',p:600,slot:'exhaust',val:{c:[2.4,1.1,.2]}},
    {k:'swhite',cat:'🏎️ Cars — every racing game',ic:'🏁',n:'White racing stripes',d:'Two stripes down the middle',p:200,slot:'stripe',val:'#f8fafc'},
    {k:'sgold',cat:'🏎️ Cars — every racing game',ic:'✨',n:'Gold racing stripes',d:'Shiny gold stripes',p:350,slot:'stripe',val:[2,1.6,.3]},
    {k:'armgold',cat:'🎽 Gear — worn in every game',ic:'💛',n:'Gold armband',d:'On your bicep in every game your player shows up in',p:200,slot:'arm',val:{c:[2,1.6,.3]}},
    {k:'armcap',cat:'🎽 Gear — worn in every game',ic:'©️',n:'Captain armband',d:'The captain\'s armband — yellow with a badge',p:400,slot:'arm',val:{c:'#facc15',c2:'#111827'}},
    {k:'armred',cat:'🎽 Gear — worn in every game',ic:'❤️',n:'Red armbands (both arms)',d:'A red band on each arm',p:250,slot:'arm',val:{c:'#dc2626',both:1}},
    {k:'wristwhite',cat:'🎽 Gear — worn in every game',ic:'🤍',n:'White wristbands',d:'Classic sweatbands',p:100,slot:'wrist',val:{c:'#f8fafc'}},
    {k:'wristneon',cat:'🎽 Gear — worn in every game',ic:'💚',n:'Neon wristbands',d:'Glowing green wristbands',p:200,slot:'wrist',val:{c:[.4,2.4,.5]}},
    {k:'headred',cat:'🎽 Gear — worn in every game',ic:'🎀',n:'Red headband',d:'Sweatband round your head',p:120,slot:'head',val:{t:'band',c:'#dc2626'}},
    {k:'capblue',cat:'🎽 Gear — worn in every game',ic:'🧢',n:'Blue cap',d:'A team cap',p:200,slot:'head',val:{t:'cap',c:'#1d4ed8',c2:'#1e3a8a'}},
    {k:'crown',cat:'🎽 Gear — worn in every game',ic:'👑',n:'Gold crown',d:'Rule every game',p:3000,slot:'head',val:{t:'crown',c:[2.2,1.7,.3]}},
    {k:'shades',cat:'🎽 Gear — worn in every game',ic:'🕶️',n:'Sunglasses',d:'Too cool',p:250,slot:'face',val:{c:'#0a0a0a'}},
    {k:'chain',cat:'🎽 Gear — worn in every game',ic:'📿',n:'Gold chain',d:'With a big medallion',p:800,slot:'neck',val:{c:[2,1.6,.3],c2:[2.4,2,.5]}},
    {k:'capered',cat:'🎽 Gear — worn in every game',ic:'🦸',n:'Hero cape',d:'A red superhero cape that flows behind you',p:1500,slot:'back',val:{c:'#dc2626',c2:'#facc15'}},
    {k:'caperoyal',cat:'🎽 Gear — worn in every game',ic:'🟣',n:'Royal cape',d:'Purple velvet with gold trim',p:2500,slot:'back',val:{c:'#6d28d9',c2:[2,1.6,.3]}},
    {k:'city50k',cat:'🏙️ Rival City',ic:'💵',n:'$50,000 cash',d:'Paid straight into your Rival City wallet',p:150,buy:()=>grant({cityCash:50000}),many:1},
    {k:'city1m',cat:'🏙️ Rival City',ic:'💰',n:'$1,000,000 cash',d:'A million dollars in Rival City',p:1500,buy:()=>grant({cityCash:1000000}),many:1},
    {k:'cityhyper',cat:'🏙️ Rival City',ic:'🏎️',n:'Hypercar',d:'The 4-seat hypercar, parked in your garage',p:900,buy:()=>grant({cityCars:['hyper']})},
    {k:'cityheli',cat:'🏙️ Rival City',ic:'🚁',n:'Helicopter',d:'Your own helicopter in Rival City',p:1400,buy:()=>grant({cityCars:['heli']})},
    {k:'str500',cat:'🏋️ Gym',ic:'💪',n:'+500 strength',d:'Instantly stronger — bigger muscles in every game',p:250,buy:()=>addStr(500),many:1},
    {k:'str5k',cat:'🏋️ Gym',ic:'🦾',n:'+5,000 strength',d:'A huge strength boost',p:2000,buy:()=>addStr(5000),many:1},
    {k:'petgoldie',cat:'🏋️ Gym',ic:'🦮',n:'Golden Retriever pet',d:'Coin-shop pet: every rep ×2.2',p:600},
    {k:'petrobo',cat:'🏋️ Gym',ic:'🤖',n:'Robo Dog pet',d:'Coin-shop pet: every rep ×4',p:2500},
    {k:'mxgold',cat:'🏍️ Motocross',ic:'🏆',n:'Gold paint',d:'Gold & black bike and gear',p:300,slot:'mx',val:['#facc15','#111827']},
    {k:'mxneon',cat:'🏍️ Motocross',ic:'💜',n:'Neon paint',d:'Neon purple & pink',p:300,slot:'mx',val:['#a855f7','#f472b6']},
    {k:'mxice',cat:'🏍️ Motocross',ic:'🧊',n:'Ice paint',d:'Ice blue & white',p:300,slot:'mx',val:['#38bdf8','#f8fafc']},
    {k:'kitgold',cat:'🏟️ Sports Arcade',ic:'✨',n:'Gold kit',d:'Your player wears gold in every Sports Arcade game',p:250,slot:'kit',val:'#facc15'},
    {k:'kitblack',cat:'🏟️ Sports Arcade',ic:'🖤',n:'Blackout kit',d:'All-black shirt',p:250,slot:'kit',val:'#111827'},
    {k:'kitpink',cat:'🏟️ Sports Arcade',ic:'🩷',n:'Pink kit',d:'Hot pink shirt',p:250,slot:'kit',val:'#ec4899'},
    {k:'x2',cat:'⭐ Everywhere',ic:'⚡',n:'Double coins · 1 hour',d:'Every coin you earn counts twice',p:300,buy:()=>ls.set('rrCoin2x',String(Math.max(Date.now(),+ls.get('rrCoin2x')||0)+3600000)),many:1},
    {k:'mystery',cat:'⭐ Everywhere',ic:'🎁',n:'Mystery box',d:'0–600 coins back, or a random item',p:150,buy:()=>mystery(),many:1},
    {k:'badgestar',cat:'⭐ Everywhere',ic:'🌟',n:'Star badge',d:'A shiny star on your coin counter',p:500,slot:'badge',val:'🌟'},
    {k:'badgecrown',cat:'⭐ Everywhere',ic:'👑',n:'Crown badge',d:'A crown on your coin counter',p:5000,slot:'badge',val:'👑'}];
  /* v3: exclusives — only from crates or the Arcade Pass. rar: 1 common, 2 rare, 3 epic, 4 legendary */
  const EXC=[{k:'xflame',ic:'🔥',n:'Flame wristbands',rar:1,slot:'wrist',val:{c:[2.4,.8,.1]}},{k:'xhorns',ic:'😈',n:'Devil horns',rar:1,slot:'head',val:{t:'horns',c:'#b91c1c'}},
    {k:'xneoncap',ic:'🧢',n:'Neon cap',rar:1,slot:'head',val:{t:'cap',c:[.4,2.2,.6],c2:'#111827'}},{k:'xredshades',ic:'🕶️',n:'Laser shades',rar:1,slot:'face',val:{c:[2.4,.2,.2]}},
    {k:'xhalo',ic:'😇',n:'Halo',rar:2,slot:'head',val:{t:'halo',c:[2.4,2.2,1]}},{k:'xdiachain',ic:'💎',n:'Diamond chain',rar:2,slot:'neck',val:{c:[1.4,2.2,2.4],c2:[2,2.4,2.4]}},
    {k:'xicewings',ic:'❄️',n:'Ice wings',rar:2,slot:'back',val:{t:'wings',c:[.8,1.8,2.4]}},{k:'xangel',ic:'🪽',n:'Angel wings',rar:3,slot:'back',val:{t:'wings',c:'#f8fafc',big:1}},
    {k:'xgalaxy',ic:'🌌',n:'Galaxy cape',rar:3,slot:'back',val:{c:[.6,.2,1.6],c2:[2.2,2.2,2.4]}},{k:'xfirecrown',ic:'🔥',n:'Fire crown',rar:4,slot:'head',val:{t:'crown',c:[2.4,.7,.1]}},
    {k:'xdragon',ic:'🐉',n:'Dragon wings',rar:4,slot:'back',val:{t:'wings',c:[.2,1.6,.3],big:1}},
    {k:'pcape',ic:'🎖️',n:'Season cape',rar:3,pass:1,slot:'back',val:{c:'#0ea5e9',c2:[2.4,2,.4]}},{k:'pwings',ic:'🎖️',n:'Season wings',rar:3,pass:1,slot:'back',val:{t:'wings',c:[2.4,2,.4],big:1}},{k:'pcrown',ic:'🎖️',n:'Season crown',rar:4,pass:1,slot:'head',val:{t:'crown',c:[.5,2.2,2.4]}}];
  const EXCC=[
    {k:'cxholo',ic:'🪩',n:'Holographic wrap',rar:3,car:1,slot:'wrap',val:{t:'holo'}},{k:'cxgalaxy',ic:'🌌',n:'Galaxy wrap',rar:3,car:1,slot:'wrap',val:{t:'galaxy',c:['#0b0b2b','#ffffff','#a855f7','#ec4899']}},
    {k:'cxlavawrap',ic:'🌋',n:'Lava cracks wrap',rar:2,car:1,slot:'wrap',val:{t:'lava',c:['#1c1917',[2.4,.6,.08]]}},{k:'cxneon',ic:'💜',n:'Neon pulse wrap',rar:3,car:1,slot:'wrap',val:{t:'neon',c:[[2.2,.3,1.8],[.3,1.6,2.4]]}},
    {k:'cxmatrix',ic:'🟩',n:'Matrix rain wrap',rar:4,car:1,slot:'wrap',val:{t:'matrix',c:['#020617',[.3,2.4,.5]]}},{k:'cxcamopink',ic:'🩷',n:'Pink camo wrap',rar:1,car:1,slot:'wrap',val:{t:'camo',c:['#f9a8d4','#ec4899','#fbcfe8','#9d174d']}},
    {k:'cxorange',ic:'🟧',n:'Orange stripes',rar:1,car:1,slot:'stripe',val:'#f97316'},{k:'cxred',ic:'🔴',n:'Red underglow',rar:1,car:1,slot:'glow',val:[2.4,.3,.3]},
    {k:'cxchrome',ic:'🪞',n:'Chrome wing',rar:2,car:1,slot:'wing',val:{c:'#e5e7eb',e:[1.6,2,2.4],tall:1}},{k:'cxblue',ic:'🔵',n:'Blue flames',rar:2,car:1,slot:'exhaust',val:{c:[.4,1.2,2.4]}},
    {k:'cxlava',ic:'🌋',n:'Lava paint',rar:3,car:1,slot:'paint',val:['#7c2d12',[2.4,.7,.1]]},{k:'cxgreenfl',ic:'💚',n:'Toxic flames',rar:3,car:1,slot:'exhaust',val:{c:[.5,2.4,.4]}},
    {k:'cxrainbow',ic:'🌈',n:'Rainbow underglow',rar:4,car:1,slot:'glow',val:'rainbow'},{k:'cxdiamond',ic:'💎',n:'Diamond paint',rar:4,car:1,slot:'paint',val:['#a5f3fc',[2,2.4,2.4]]},
  ];
  EXC.push(...EXCC);
  const RAR=['','Common','Rare','Epic','Legendary'], RCOL=['','#94a3b8','#38bdf8','#c084fc','#fbbf24'], REFUND=[0,60,150,400,1500];
  for(const x of EXC) ITEMS.push({...x,cat:'✨ Exclusives',d:`${RAR[x.rar]}${x.pass?' · Arcade Pass':' · from crates'}`,p:0,ex:1});
  function mystery(){ if(Math.random()<.7){ const c=Math.round(Math.random()*600); bal+=c; if(c) logIt(c,'Mystery box'); save(); toast(c?`🎁 ${c} coins inside!`:'🎁 Empty… better luck next time'); }
    else { const pool=ITEMS.filter(i=>!i.many&&!i.ex&&!inv[i.k]); const it=pool[Math.floor(Math.random()*pool.length)]; if(!it){ bal+=400; save(); toast('🎁 400 coins inside!'); return; } own(it); toast(`🎁 You got: ${it.ic} ${it.n}!`); } }
  function own(it){ if(it.buy&&!it.many){ inv[it.k]=1; it.buy(); } else if(it.buy) it.buy(); else inv[it.k]=1; if(it.slot&&!eq[it.slot]) eq[it.slot]=it.k; save(); }
  function buy(k){ const it=ITEMS.find(i=>i.k===k); if(!it) return; if(!it.many&&(inv[it.k]||(isOwner()&&!it.buy))){ if(it.slot){ eq[it.slot]=eq[it.slot]===it.k?null:it.k; save(); toast(eq[it.slot]?`${it.ic} Equipped`:'Unequipped'); } return; }
    const pr=priceOf(it); if(!spend(pr,`${it.ic} ${it.n}`)){ toast(`You need ${pr.toLocaleString()} 🪙`,'#f87171'); return; } if(it.many) inv[it.k]=(inv[it.k]||0)+1; own(it); if(it.k!=='mystery') toast(`${it.ic} ${it.n} — bought!`); }
  const has=k=>isOwner()||!!inv[k];
  /* two items on sale every day */
  const DEALS=(()=>{ const r=seedR(today()+'d'), pool=ITEMS.filter(i=>i.k!=='mystery'&&!i.ex), out=[]; while(out.length<2&&pool.length) out.push(pool.splice(Math.floor(r()*pool.length),1)[0].k); return out; })();
  const priceOf=it=>DEALS.includes(it.k)?Math.round(it.p*.6/5)*5:it.p;
  const equipped=slot=>{ const k=eq[slot]; const it=ITEMS.find(i=>i.k===k); return it&&has(k)?it.val:null; };
  /* ---- earning ---- */
  { const st=J('rrCoinStreak',{d:'',n:0}); if(st.d!==today()){ const y=new Date(Date.now()-864e5).toDateString(); st.n=st.d===y?st.n+1:1; st.d=today(); ls.set('rrCoinStreak',JSON.stringify(st)); const day=((st.n-1)%7)+1, CAL=[50,75,100,150,200,300,0]; setTimeout(()=>{ if(day===7){ inv.crateEpic=(inv.crateEpic||0)+1; save(); toast('📅 Day 7! A free EPIC crate — open it in the shop','#c084fc'); add(150,'day 7 login',true,true); } else add(CAL[day-1],`login day ${day}/7 · ${st.n} day streak 🔥`,false,true); },2500); } }
  if(!NOGAME.includes(PAGE)) setInterval(()=>{ if(document.hidden) return; if(D.d!==today()) D={d:today(),earned:0,play:0,res:0}; if(D.play>=240) return; D.play+=4; add(4,'for playing',true); track('mins',1); },60000);
  if(!NOGAME.includes(PAGE)&&D.pages&&!D.pages.includes(PAGE)){ D.pages.push(PAGE); setTimeout(()=>track('pages',1),3000); }
  const lastRes={}; addEventListener('rr-result',()=>{ const now=Date.now(); if(lastRes[PAGE]&&now-lastRes[PAGE]<45000) return; lastRes[PAGE]=now; if(D.res>=900) return; D.res+=25; add(25,'game finished'); track('games',1); });
  /* ---- the Lucky Wheel: one free spin a day, more for 100 coins ---- */
  const WHEEL=[{t:'25 🪙',c:25,w:24,col:'#334155'},{t:'50 🪙',c:50,w:20,col:'#1d4ed8'},{t:'100 🪙',c:100,w:16,col:'#15803d'},{t:'⚡ ×2 30 min',x2:1,w:10,col:'#7c3aed'},{t:'200 🪙',c:200,w:10,col:'#b45309'},{t:'🎁 Mystery',mys:1,w:10,col:'#db2777'},{t:'500 🪙',c:500,w:6,col:'#dc2626'},{t:'💎 2,500 🪙',c:2500,w:1.5,col:'#0891b2'}];
  let spinning=false, wheelRot=0, wheelMsg='';
  function spin(){ if(spinning) return; const free=isOwner()||!D.spun; if(!free&&!spend(100,'Lucky Wheel spin')){ toast('An extra spin costs 100 🪙','#f87171'); return; } D.spun=(D.spun||0)+1; track('spin',1); save();
    let r=Math.random()*WHEEL.reduce((a,b)=>a+b.w,0), i=0; for(;i<WHEEL.length-1;i++){ r-=WHEEL[i].w; if(r<=0) break; }
    const seg=360/WHEEL.length; wheelRot+=360*5+(360-(i*seg+seg/2))-(wheelRot%360); spinning=true; wheelMsg=''; renderShop();
    setTimeout(()=>{ spinning=false; const P=WHEEL[i]; if(P.c){ bal+=P.c; LIFE+=P.c; ls.set('rrCoinLife',String(LIFE)); logIt(P.c,'Lucky Wheel'); } else if(P.x2) ls.set('rrCoin2x',String(Math.max(Date.now(),+ls.get('rrCoin2x')||0)+1800000)); else mystery(); wheelMsg=`You won: ${P.t}!`; save(); toast(`🎡 ${wheelMsg}`,'#fde68a'); },3200); }
  /* ---- the Coin Bank: coins in the bank grow 2% a day (up to 100,000) ---- */
  const BANK=J('rrCoinBank',{a:0,t:Date.now()});
  function bankTick(){ const days=(Date.now()-BANK.t)/864e5; if(days>0&&BANK.a>0){ const before=BANK.a; BANK.a=Math.min(100000,BANK.a*Math.pow(1.02,days)); const gain=BANK.a-before; if(gain>=1) logIt(gain,'Bank interest'); } BANK.t=Date.now(); ls.set('rrCoinBank',JSON.stringify(BANK)); }
  bankTick();
  function bankMove(v){ bankTick(); if(v==='in'){ const n=Math.min(Math.floor(bal),Math.max(0,100000-Math.floor(BANK.a))); if(n<=0) return; bal-=n; BANK.a+=n; logIt(-n,'Deposited in the bank'); } else { const n=Math.floor(BANK.a); if(n<=0) return; BANK.a-=n; bal+=n; logIt(n,'Withdrew from the bank'); } ls.set('rrCoinBank',JSON.stringify(BANK)); save(); }
  /* ---- the exchange: trade gym strength for coins ---- */
  function exchange(){ if(isOwner()){ toast('Owner: you already have ∞ of both 👑'); return; } const sv=window.RRSTR?RRSTR.level:(+ls.get('rrStrength')||0); if(sv<100){ toast('You need 100 strength to trade','#f87171'); return; }
    if(window.RRSTR&&RRSTR.spend) RRSTR.spend(100); else ls.set('rrStrength',String(Math.max(0,sv-100))); bal+=20; logIt(20,'Traded 100 strength'); save(); toast('💱 100 strength → 20 🪙'); }


  /* ---- your car's look in every racing game: paint, underglow, wing, exhaust flames, stripes ---- */

  /* ---- car wraps: patterns printed on the sides and hood of your car (built once per car shape, some animated) ---- */
  const WRC={};
  function wrapRects(w,L,W,H){ const key=w.t+'|'+(w.c||[]).join()+'|'+L+'|'+W+'|'+H; if(WRC[key]) return WRC[key]; const out=[], u0=-L*.47, u1=L*.47, v0=Math.min(.3,H*.4), v1=H-.02, hv=Math.max(.1,v1-v0), uL=u1-u0, r=seedR(key), c=w.c||[];
    const S=(u,v,su,sv,col,ly,a)=>out.push(['s',u,v,su,sv,col,ly||1,a]), Tp=(u,z,su,sz,col,ly,a)=>out.push(['t',u,z,su,sz,col,ly||1,a]);
    const base=(col,a)=>{ S((u0+u1)/2,(v0+v1)/2,uL,hv,col,0,a); Tp((u0+u1)/2,0,uL,W*.9,col,0,a); };
    const rs=(n,f)=>{ for(let i=0;i<n;i++) f(u0+r()*uL,v0+r()*hv,(r()-.5)*W*.85,i); };
    switch(w.t){
      case 'checker': { const cs=Math.max(.18,hv/3); for(let u=u0;u<u1-1e-3;u+=cs) for(let v=v0,j=0;v<v1-1e-3;v+=cs,j++){ const iu=Math.round((u-u0)/cs); S(u+cs/2,v+Math.min(cs,v1-v)/2,cs,Math.min(cs,v1-v),c[(iu+j)%2],0); }
        for(let u=u0;u<u1-1e-3;u+=cs) for(let z=-W*.45,j=0;z<W*.45-1e-3;z+=cs,j++){ const iu=Math.round((u-u0)/cs); Tp(u+cs/2,z+cs/2,cs,cs,c[(iu+j)%2],0); } break; }
      case 'flames': for(let k=0;k<5;k++){ const vc=v0+hv*(k+.5)/5, len=uL*(.32+.3*r()); for(let i=0;i<7;i++){ const sl=len/7, h=hv/5*1.25*(1-i/8); S(u1-(i+.5)*sl,vc,sl*1.05,h,c[Math.min(2,Math.floor(i/2.4))]); } }
        for(let k=0;k<4;k++){ const zc=-W*.36+W*.72*(k+.5)/4, len=uL*(.25+.2*r()); for(let i=0;i<6;i++){ const sl=len/6; Tp(u1-(i+.5)*sl,zc,sl*1.05,W*.18*(1-i/7),c[Math.min(2,Math.floor(i/2))]); } } break;
      case 'camo': base(c[0]); rs(30,(u,v,z,i)=>{ const col=c[1+i%3], a=.25+r()*.5, b=.15+r()*.3; S(u,v,a,Math.min(b,hv*.6),col); S(u+a*.3,v+b*.2,a*.7,Math.min(b*1.2,hv*.6),col); if(i<18){ Tp(u,z,a,b*1.6,col); Tp(u+a*.3,z+b*.4,a*.7,b,col); } }); break;
      case 'digital': base(c[0]); rs(120,(u,v,z,i)=>{ const q=.11, col=c[1+i%(c.length-1)]; S(Math.round(u/q)*q,Math.min(v1-q/2,Math.round(v/q)*q),q,q,col); if(i%2) Tp(Math.round(u/q)*q,Math.round(z/q)*q,q,q,col); }); break;
      case 'tiger': case 'zebra': case 'hazard': { if(w.t!=='hazard') base(c[0]); else base(c[0]); const n=w.t==='hazard'?Math.round(uL/.35):w.t==='zebra'?14:11; for(let k=0;k<n;k++){ const us=u0+uL*(k+.3+(w.t==='hazard'?0:r()*.4))/n, wd=w.t==='hazard'?.17:w.t==='zebra'?.12:.07+r()*.06; for(let i=0;i<6;i++){ const v=v0+hv*(i+.5)/6; const uu=us+(i-3)*(w.t==='hazard'?.06:.04)*(w.t==='tiger'&&k%2?-1:1); if(uu>u0&&uu<u1) S(uu,v,wd*(w.t==='tiger'?1-Math.abs(i-2.5)/4:1),hv/6+.005,c[1]); }
          for(let i=0;i<5;i++){ const z=-W*.4+W*.8*(i+.5)/5, uu=us+(i-2)*.05; if(uu>u0&&uu<u1) Tp(uu,z,wd,W*.8/5+.005,c[1]); } } break; }
      case 'leopard': base(c[0]); rs(36,(u,v,z,i)=>{ const s2=.09+r()*.07; S(u,Math.min(v1-s2/2,v),s2,s2,c[1]); S(u,Math.min(v1-s2/2,v),s2*.45,s2*.45,c[0],2); if(i<20){ Tp(u,z,s2,s2,c[1]); Tp(u,z,s2*.45,s2*.45,c[0],2); } }); break;
      case 'lightning': for(let k=0;k<3;k++){ let u=u1-uL*(.1+k*.3), v=v1-.02; for(let i=0;i<5;i++){ const du=-(.25+r()*.2), dv=-hv/5; S(u+du/2,v+dv*.5,Math.abs(du),.06,c[0]); u+=du; v+=dv; S(u,v+dv*.5+.02,.06,hv/5,c[0]); } } for(let k=0;k<2;k++) Tp((u0+u1)/2,(k?-1:1)*W*.2,uL*.9,.05,c[0]); break;
      case 'bands3': for(let i=0;i<3;i++){ S((u0+u1)/2,v0+hv*(.45+i*.13),uL,hv*.1,c[i]); Tp((u0+u1)/2,(i-1)*W*.14,uL,W*.1,c[i]); } break;
      case 'bands': for(let i=0;i<c.length;i++){ S((u0+u1)/2,v0+hv*(i+.5)/c.length,uL,hv/c.length+.003,c[i]); Tp((u0+u1)/2,-W*.45+W*.9*(i+.5)/c.length,uL,W*.9/c.length+.003,c[i]); } break;
      case 'waves': base(c[1]); for(let b=0;b<3;b++) for(let i=0;i<14;i++){ const u=u0+uL*(i+.5)/14, v=v0+hv*(.2+b*.3)+Math.sin(i*.9+b)*hv*.08; S(u,v,uL/14+.01,hv*.12,b===1?c[2]:c[0]); Tp(u,-W*.3+b*W*.3+Math.sin(i*.9+b)*.08,uL/14+.01,W*.1,b===1?c[2]:c[0]); } break;
      case 'dots': case 'hearts': base(c[0]); for(let iu=0;iu<Math.floor(uL/.32);iu++) for(let iv=0;iv<Math.max(1,Math.floor(hv/.24));iv++){ const u=u0+.16+iu*.32, v=v0+.12+iv*.24+(iu%2?.06:0); if(v>v1-.06) continue; if(w.t==='dots') S(u,v,.12,.12,c[1]); else { S(u-.03,v+.02,.06,.06,c[1]); S(u+.03,v+.02,.06,.06,c[1]); S(u,v-.025,.07,.06,c[1]); } }
        for(let iu=0;iu<Math.floor(uL/.32);iu++) for(let iz=0;iz<4;iz++) Tp(u0+.16+iu*.32,-W*.33+iz*W*.22,.12,.12,c[1]); break;
      case 'stars': base(c[0]); rs(34,(u,v,z,i)=>{ const q=.035+r()*.03; S(u,Math.min(v1-q*1.5,v),q*3,q,c[1]); S(u,Math.min(v1-q*1.5,v),q,q*3,c[1]); if(i<20){ Tp(u,z,q*3,q,c[1]); Tp(u,z,q,q*3,c[1]); } }); break;
      case 'carbon': base(c[0]); for(let u=u0;u<u1;u+=.09) for(let v=v0;v<v1-.04;v+=.09){ if(Math.round((u-u0)/.09+(v-v0)/.09)%2) S(u+.045,v+.045,.09,.045,c[1]); } for(let u=u0;u<u1;u+=.12) for(let z=-W*.44;z<W*.44;z+=.12) if(Math.round((u-u0)/.12+(z+W)/.12)%2) Tp(u+.06,z+.06,.12,.06,c[1]); break;
      case 'circuit': base(c[0]); rs(26,(u,v,z,i)=>{ const h=r()<.5, len=.2+r()*.6; S(u,v,h?len:.025,h?.025:Math.min(len,hv),c[1]); S(u+(h?len/2:0),v+(h?0:Math.min(len,hv)/2),.06,.06,c[1]); if(i<16) Tp(u,z,h?len:.025,h?.025:len*.5,c[1]); }); break;
      case 'graffiti': base(c[0]); { const P=['#ef4444','#f97316','#facc15','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#111827']; rs(30,(u,v,z,i)=>{ const col=P[i%P.length], a=.15+r()*.4, b=.1+r()*.22; S(u,v,a,Math.min(b,hv*.7),col); S(u+a*.4,v-b*.2,a*.4,Math.min(b*.6,hv*.5),col,2); if(i<18) Tp(u,z,a,b*1.4,col); }); } break;
      case 'police': S(u0+uL*.15,(v0+v1)/2,uL*.3,hv,c[1],0); S(u1-uL*.15,(v0+v1)/2,uL*.3,hv,c[1],0); S((u0+u1)/2,(v0+v1)/2,uL*.4,hv,c[0],0); S((u0+u1)/2,v0+hv*.35,uL,hv*.12,c[2]); Tp((u0+u1)/2,0,uL,W*.9,c[1],0); Tp((u0+u1)/2,0,uL,W*.2,c[0]); break;
      case 'goldleaf': rs(34,(u,v,z,i)=>{ const a=.12+r()*.3, b=.08+r()*.2; S(u,v,a,Math.min(b,hv*.5),c[i%2]); if(i<18) Tp(u,z,a,b*1.5,c[i%2]); }); break;
      case 'galaxy': base(c[0]); rs(14,(u,v,z,i)=>{ const col=c[2+i%2], a=.4+r()*.6, b=.12+r()*.2; S(u,v,a,Math.min(b,hv*.6),col.map?col:col,2); if(i<8) Tp(u,z,a,b*2,col,2); }); rs(50,(u,v,z,i)=>{ S(u,Math.min(v1-.02,v),.03,.03,[2.4,2.4,2.4],3); if(i<26) Tp(u,z,.03,.03,[2.4,2.4,2.4],3); }); break;
      case 'lava': base(c[0]); rs(30,(u,v,z,i)=>{ const h=r()<.5, len=.12+r()*.35; S(u,v,h?len:.03,h?.03:Math.min(len,hv),c[1],2,'pulse'); if(i<16) Tp(u,z,h?len:.03,h?.03:len,c[1],2,'pulse'); }); break;
      case 'holo': base('#ffffff','holo'); break;
      case 'neon': base('#0b0b18'); for(let i=0;i<4;i++){ S((u0+u1)/2,v0+hv*(i+.5)/4,uL,.03,c[i%2],2,'pulse'); } for(let i=0;i<5;i++) Tp((u0+u1)/2,-W*.4+W*.8*i/4,uL,.03,c[i%2],2,'pulse'); break;
      case 'matrix': base(c[0]); for(let k=0;k<Math.floor(uL/.16);k++) for(let j=0;j<Math.max(2,Math.floor(hv/.1));j++) S(u0+.08+k*.16,v0+.05+j*.1,.04,.06,c[1],2,'m'+((k*7)%10)+'_'+j); for(let k=0;k<Math.floor(uL/.16);k++) for(let j=0;j<6;j++) Tp(u0+.08+k*.16,-W*.4+j*W*.16,.04,.06,c[1],2,'m'+((k*3)%10)+'_'+j); break; }
    WRC[key]=out; return out; }
  function drawWrap(Q,w,L,W,H){ const t=performance.now()/1000, bv0=Math.min(.3,H*.4), bh=Math.max(.1,H-.02-bv0);
    for(const [f,u,v,su,sv,col,ly,a] of wrapRects(w,L,W,H)){ let c=col;
      if(a==='holo') c=[.9+.6*Math.sin(t*2+u*1.3),.9+.6*Math.sin(t*2+u*1.3+2.1),.9+.6*Math.sin(t*2+u*1.3+4.2)];
      else if(a==='pulse'){ const k=.55+.45*Math.sin(t*4+u*2); c=Array.isArray(col)?col.map(x=>x*k):col; }
      else if(a&&a[0]==='m'){ const [ph,j]=a.slice(1).split('_').map(Number), k=((t*3+ph)%6)-j*.6; c=col.map(x=>x*Math.max(.08,1-Math.abs(k)*.5)); }
      const e=.011+(ly||0)*.004; if(f==='s'){ Q(u,v,W/2+e,su,sv,.006,c); Q(u,v,-(W/2+e),su,sv,.006,c); } else { Q(u,H+e,v,su,.006,sv,c);
        /* the same pattern on the back and the front of the car: the strip of the roof pattern nearest each end, folded down */ for(const [w0,face] of [[-L*.47,-1],[L*.47-bh,1]]){ const a0=Math.max(u-su/2,w0), a1=Math.min(u+su/2,w0+bh); if(a1<=a0) continue; const vv=face<0?bv0+((a0+a1)/2-w0):bv0+(w0+bh-(a0+a1)/2); Q(face*(L/2+e),vv,v,.006,a1-a0,sv,c); } } } }
  /* a wrap with a background colours the whole car (unless you've picked a paint) */
  const WRAPBODY={checker:0,camo:0,digital:0,tiger:0,zebra:0,leopard:0,stars:0,carbon:0,circuit:0,graffiti:0,galaxy:0,lava:0,matrix:0,dots:0,hearts:0,waves:1,police:1};
  function carPaint(){ const pt=equipped('paint'); if(pt) return pt; const w=equipped('wrap'); if(!w) return null; if(w.t==='holo') return ['#e5e7eb','#f8fafc']; if(w.t==='neon') return ['#0b0b18','#111827']; const i=WRAPBODY[w.t]; if(i==null||!w.c) return null; const c0=w.c[i]; return typeof c0==='string'?[c0,typeof w.c[1]==='string'?w.c[1]:'#111827']:null; }
  function carDeco(P,L,W,H,spd,ax){ const g=equipped('glow'), w=equipped('wing'), x=equipped('exhaust'), st=equipped('stripe'), wr=equipped('wrap'); if(!g&&!w&&!x&&!st&&!wr) return;
    const Q=ax==='z'?(f,y,s,sf,sy,ss,col)=>P(s,y,f,ss,sy,sf,col):P, t=performance.now()/1000;
    if(wr) try{ drawWrap(Q,wr,L,W,H); }catch(e){}
    if(g){ const c=g==='rainbow'?[1.2+1.2*Math.sin(t*3),1.2+1.2*Math.sin(t*3+2.1),1.2+1.2*Math.sin(t*3+4.2)]:g; Q(0,.05,0,L*.92,.03,W*1.04,c); Q(0,.04,0,L*1.1,.01,W*1.4,c.map?c.map(v=>v*.35):c); }
    if(st) for(const s of [-1,1]) Q(0,H+.012,s*W*.11,L*.96,.02,W*.08,st);
    if(w){ const hh=w.tall?.55:.35; Q(-L*.46,H+hh,0,.4,.05,W*.98,w.c); for(const s of [-1,1]){ Q(-L*.46,H+hh/2,s*W*.3,.1,hh,.05,'#111827'); Q(-L*.46,H+hh,s*W*.49,.5,.22,.03,w.e||w.c); } }
    if(x&&spd>.35) for(const s of [-1,1]){ const f=.5+Math.random()*.8*Math.min(1.5,spd); Q(-L/2-.28*f,.35,s*W*.2,.55*f,.13,.13,x.c); Q(-L/2-.12*f,.35,s*W*.2,.25*f,.08,.08,[2.4,2.4,1.6]); } }
  /* ---- crates: open them for exclusive gear (duplicates turn back into coins) ---- */
  const CRATES={common:{n:'Arcade Crate',ic:'📦',p:200,inv:'crateCommon',w:[0,70,24,5,1]},epic:{n:'Epic Crate',ic:'🎁',p:800,inv:'crateEpic',w:[0,30,40,24,6]},legend:{n:'Legendary Crate',ic:'👑',p:3000,inv:'crateLegend',w:[0,0,30,45,25]},car:{n:'Car Crate',ic:'🏎️',p:500,inv:'crateCar',w:[0,45,33,16,6],car:1}};
  let crateAnim=null;
  function openCrate(k){ const C=CRATES[k]; if(!C||crateAnim) return; if((inv[C.inv]||0)>0) inv[C.inv]--; else if(!spend(C.p,`${C.ic} ${C.n}`)){ toast(`A ${C.n} costs ${C.p.toLocaleString()} 🪙`,'#f87171'); return; }
    let r=Math.random()*100, rar=1; for(let i=1;i<=4;i++){ r-=C.w[i]; if(r<=0){ rar=i; break; } } const pool=EXC.filter(x=>x.rar===rar&&!x.pass&&(!C.car||x.car)), win=pool[Math.floor(Math.random()*pool.length)];
    const strip=[]; for(let i=0;i<34;i++){ const rr=Math.random()<.6?1:Math.random()<.7?2:Math.random()<.8?3:4, pp=EXC.filter(x=>x.rar===rr&&!x.pass&&(!C.car||x.car)); strip.push(pp[Math.floor(Math.random()*pp.length)]); } strip[28]=win;
    crateAnim={strip,win,done:false}; tab='crates'; renderShop(); requestAnimationFrame(()=>requestAnimationFrame(()=>{ const el=box&&box.querySelector('.reel'); if(el){ crateAnim.tx=-(28*110)+(el.parentNode.clientWidth/2-55); el.style.transform=`translateX(${crateAnim.tx}px)`; } }));
    setTimeout(()=>{ const dup=!isOwner()&&inv[win.k]; if(dup){ const c=REFUND[win.rar]; bal+=c; logIt(c,`Duplicate ${win.n}`); } else { inv[win.k]=1; const it=ITEMS.find(i=>i.k===win.k); if(it&&it.slot&&!eq[it.slot]) eq[it.slot]=win.k; }
      crateAnim.done=true; crateAnim.dup=dup; save(); toast(dup?`Duplicate ${win.ic} ${win.n} → ${REFUND[win.rar]} 🪙`:`${RAR[win.rar].toUpperCase()}! ${win.ic} ${win.n}`,RCOL[win.rar]); renderShop(); },4200); }
  /* ---- the Arcade Pass: a new season every month, 30 tiers of rewards ---- */
  const SEASON=new Date().getFullYear()+'-'+(new Date().getMonth()+1);
  let PASS=J('rrPass',{}); if(PASS.s!==SEASON) PASS={s:SEASON,xp:0,claimed:[]};
  const TIERXP=150, TIERS=30, tierOf=()=>isOwner()?TIERS:Math.min(TIERS,Math.floor(PASS.xp/TIERXP));
  const passReward=t=>t===10?{item:'pcape'}:t===20?{item:'pwings'}:t===30?{item:'pcrown'}:t%5===0?{crate:t>=25?'epic':'common'}:{coins:40+t*10};
  const rwText=r=>r.item?(()=>{ const x=EXC.find(e=>e.k===r.item); return `${x.ic} ${x.n}`; })():r.crate?`${CRATES[r.crate].ic} ${CRATES[r.crate].n}`:`${r.coins} 🪙`;
  function passXP(n){ if(isOwner()) return; PASS.xp+=n; ls.set('rrPass',JSON.stringify(PASS)); }
  function claimTier(t){ if(t>tierOf()||PASS.claimed.includes(t)) return; const r=passReward(t); PASS.claimed.push(t); ls.set('rrPass',JSON.stringify(PASS));
    if(r.coins){ bal+=r.coins; logIt(r.coins,`Arcade Pass tier ${t}`); } else if(r.crate){ const C=CRATES[r.crate]; inv[C.inv]=(inv[C.inv]||0)+1; } else { inv[r.item]=1; } save(); toast(`🎖️ Tier ${t}: ${rwText(r)}`,'#38bdf8'); }
  /* ---- golden coins: every few minutes one floats across the screen — click it! ---- */
  function golden(){ if(document.hidden||!pill||document.getElementById('rrGold')) return; const g=document.createElement('button'); g.id='rrGold'; const big=Math.random()<.12; g.textContent=big?'💰':'🪙';
    g.style.cssText=`position:fixed;z-index:2147482550;left:${10+Math.random()*70}vw;top:${15+Math.random()*55}vh;font-size:${big?54:42}px;background:none;border:none;cursor:pointer;filter:drop-shadow(0 0 12px #facc15);animation:rrGoldB .9s ease-in-out infinite alternate`;
    g.onclick=()=>{ const c=big?Math.round(150+Math.random()*350):Math.round(20+Math.random()*80); g.remove(); add(c,big?'💰 GOLDEN BAG!':'golden coin',false,true); }; document.body.appendChild(g); setTimeout(()=>g.remove(),9000); }
  setInterval(()=>{ if(Math.random()<.5) golden(); },(4+Math.random()*3)*60000);
  /* ---- secret codes ---- */
  const CODES={RIVALS:{c:250},ARCADE:{c:300},GOLDRUSH:{c:500,x2:1},SEVENTEEN0:{c:170},HATTRICK:{c:333},PROTAG:{c:200},CRATEME:{crate:'common'},LEGEND:{crate:'epic'}};
  function redeem(raw){ const k=String(raw||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); const used=J('rrCodes',[]); const C=CODES[k]; if(!C) return toast('❌ That code doesn\'t exist','#f87171'); if(used.includes(k)) return toast('You already used that code','#fbbf24');
    used.push(k); ls.set('rrCodes',JSON.stringify(used)); if(C.c){ bal+=C.c; logIt(C.c,`Code ${k}`); } if(C.x2) ls.set('rrCoin2x',String(Math.max(Date.now(),+ls.get('rrCoin2x')||0)+3600000)); if(C.crate){ const cr=CRATES[C.crate]; inv[cr.inv]=(inv[cr.inv]||0)+1; } save(); toast(`🎟️ Code ${k} redeemed!`,'#4ade80'); }
  /* ---- the coin counter and the shop window ---- */
  let pill=null, box=null, tab='shop';
  function css(){ if(document.getElementById('rrCoinCss')) return; const s=document.createElement('style'); s.id='rrCoinCss'; s.textContent=`
#rrCoin{position:fixed;left:10px;bottom:72px;z-index:2147482500;background:linear-gradient(135deg,#78350f,#ca8a04);color:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:7px 13px;font:800 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}
#rrCoin:hover{filter:brightness(1.12)}#rrCoinT{position:fixed;left:12px;bottom:112px;z-index:2147482501;font:800 14px system-ui,sans-serif;color:#fde68a;background:rgba(15,23,42,.92);border-radius:10px;padding:6px 10px;pointer-events:none;transition:opacity .4s}
#rrShop{position:fixed;inset:0;z-index:2147482600;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
#rrShop .w{width:min(860px,94vw);max-height:88vh;overflow:auto;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:18px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#rrShop h2{margin:0 0 4px;font-size:24px}#rrShop .bal{font-size:20px;font-weight:800;color:#fde68a}#rrShop .tabs{display:flex;gap:8px;margin:12px 0}
#rrShop .tabs button,#rrShop .it button,#rrShop .x{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:999px;padding:7px 14px;font-weight:700;cursor:pointer}
#rrShop .tabs button.on{background:#ca8a04;color:#1c1917;border-color:#fde68a}#rrShop h3{margin:14px 0 6px;font-size:15px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em}
#rrShop .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}#rrShop .it{background:#111c33;border:1px solid #273449;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
#rrShop .it b{font-size:15px}#rrShop .it span{font-size:12px;color:#94a3b8;flex:1}#rrShop .it.own{border-color:#4ade80}#rrShop .it button:disabled{opacity:.45;cursor:default}#rrShop .it button.buy{background:#ca8a04;color:#1c1917;border-color:#fde68a}
#rrShop .earn li{margin:6px 0}#rrShop .x{float:right}#rrShop .lvl{height:8px;border-radius:6px;background:#1e293b;overflow:hidden;margin:6px 0 2px}#rrShop .lvl i{display:block;height:100%;background:linear-gradient(90deg,#a855f7,#ec4899)}
#rrShop .ms{display:flex;gap:10px;align-items:center;background:#111c33;border:1px solid #273449;border-radius:12px;padding:10px 12px;margin:8px 0}#rrShop .ms .bar{flex:1;height:8px;background:#1e293b;border-radius:6px;overflow:hidden}#rrShop .ms .bar i{display:block;height:100%;background:#4ade80}
#rrShop .ms button,#rrShop .bk button{background:#ca8a04;color:#1c1917;border:1px solid #fde68a;border-radius:999px;padding:7px 14px;font-weight:800;cursor:pointer}#rrShop .ms button:disabled,#rrShop .bk button:disabled{opacity:.45}
#rrShop .wh{position:relative;width:280px;height:280px;margin:10px auto}#rrShop .wh .disc{width:100%;height:100%;border-radius:50%;border:6px solid #fde68a;transition:transform 3s cubic-bezier(.17,.67,.2,1)}#rrShop .wh .ptr{position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-size:30px}
#rrShop .wh .lab{position:absolute;left:50%;top:50%;width:0;height:0}#rrShop .wh .lab span{position:absolute;transform-origin:0 0;font:800 12px system-ui;color:#fff;white-space:nowrap}
#rrShop .deal{border-color:#f97316!important;box-shadow:0 0 0 1px #f97316 inset}#rrShop .crw{overflow:hidden;border:2px solid #334155;border-radius:14px;margin:10px 0;position:relative;height:120px;background:#0b1222}#rrShop .crw:after{content:'';position:absolute;left:50%;top:0;bottom:0;width:3px;background:#facc15;box-shadow:0 0 12px #facc15}
#rrShop .reel{display:flex;gap:0;transition:transform 4s cubic-bezier(.12,.75,.2,1);padding:10px 0}#rrShop .reel div{flex:0 0 100px;margin:0 5px;height:96px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:34px;background:#111c33;border:2px solid}
#rrShop .reel div small{font-size:10px;color:#cbd5e1;text-align:center}#rrShop .pass{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}#rrShop .pass div{background:#111c33;border:1px solid #273449;border-radius:12px;padding:8px;text-align:center;font-size:12px}
#rrShop .pass div.ok{border-color:#38bdf8}#rrShop .pass div.got{opacity:.55}#rrShop .pass button,#rrShop .cr button,#rrShop .code button{background:#ca8a04;color:#1c1917;border:1px solid #fde68a;border-radius:999px;padding:5px 12px;font-weight:800;cursor:pointer}#rrShop .pass button:disabled{opacity:.4}
#rrShop .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}#rrShop .cal div{background:#111c33;border:1px solid #273449;border-radius:12px;padding:10px 4px;text-align:center;font-size:13px}#rrShop .cal div.now{border-color:#facc15;box-shadow:0 0 0 1px #facc15 inset}#rrShop .cal div.done{opacity:.55}
#rrShop .code input{background:#0b1222;border:1px solid #334155;border-radius:10px;color:#fff;padding:8px 12px;font-size:16px;text-transform:uppercase}@keyframes rrGoldB{from{transform:translateY(0) rotate(-8deg)}to{transform:translateY(-14px) rotate(8deg)}}
#rrShop .hist div{display:flex;justify-content:space-between;border-bottom:1px solid #1e293b;padding:5px 0;font-size:14px}`; document.head.appendChild(s); }
  const passReady=()=>{ const T=tierOf(); for(let t=1;t<=T;t++) if(!PASS.claimed.includes(t)) return true; return false; }, crateCount=()=>(inv.crateCommon||0)+(inv.crateEpic||0)+(inv.crateLegend||0)+(inv.crateCar||0);
  function render(){ if(!pill) return; pill.innerHTML=`${equipped('badge')||''}🪙 ${fmt(bal)}${dbl()?' <small>×2</small>':''} <small style="opacity:.8">Lv ${lvl()}</small>${(D.m||[]).some(m=>m.got>=m.goal&&!m.claimed)||!D.spun||passReady()||crateCount()?' <small>❗</small>':''}`; if(box&&!(crateAnim&&!crateAnim.done)&&!(tab==='rewards'&&document.activeElement&&document.activeElement.id==='rrCodeIn')) renderShop(); }
  let tT=null; function toast(t,col){ let el=document.getElementById('rrCoinT'); if(!el){ el=document.createElement('div'); el.id='rrCoinT'; document.body.appendChild(el); } el.textContent=t; el.style.color=col||'#fde68a'; el.style.opacity=1; clearTimeout(tT); tT=setTimeout(()=>el.style.opacity=0,2600); }
  function renderShop(){ const own=isOwner(), cats=[...new Set(ITEMS.map(i=>i.cat))];
    const L=lvl(), lp=own?1:(LIFE-40*L*L)/Math.max(1,nextAt(L)-40*L*L), TB=[['shop','🛒 Shop'],['crates','📦 Crates'],['pass','🎖️ Pass'],['missions','✅ Missions'],['wheel','🎡 Wheel'],['rewards','📅 Rewards'],['bank','🏦 Bank'],['inv','🎒 My stuff'],['hist','📜 History'],['earn','❓ How to earn']];
    let h=`<div class="w"><button class="x" data-x>✕ Close</button><h2>🪙 Arcade Shop</h2><div class="bal">${fmt(bal)} coins${own?' — owner: everything is free':''}${dbl()?' · ⚡ double coins on':''}</div>
      <div style="font-size:13px;color:#d8b4fe;margin-top:4px">⭐ Arcade Level ${L} · coins +${Math.round(lvlBonus()*100)}%${own?'':` · ${LIFE.toLocaleString()} / ${nextAt(L).toLocaleString()} lifetime coins to level ${L+1}`}</div><div class="lvl"><i style="width:${Math.round(clamp01(lp)*100)}%"></i></div>
      <div class="tabs" style="flex-wrap:wrap">${TB.map(([k,n])=>`<button data-tab="${k}" class="${tab===k?'on':''}">${n}${k==='missions'&&(D.m||[]).some(m=>m.got>=m.goal&&!m.claimed)||k==='wheel'&&!D.spun||k==='pass'&&passReady()||k==='crates'&&crateCount()?' ❗':''}</button>`).join('')}</div>`;
    if(tab==='crates'){ h+=`<div style="color:#94a3b8;font-size:13px">Crates hold exclusive gear you can't buy anywhere else. Duplicates turn back into coins. Odds — Arcade Crate: 70% common · 24% rare · 5% epic · 1% legendary.</div>`;
      if(crateAnim){ h+=`<div class="crw"><div class="reel" style="${crateAnim.tx!=null?`transition:none;transform:translateX(${crateAnim.tx}px)`:''}">${crateAnim.strip.map(x=>`<div style="border-color:${RCOL[x.rar]}">${x.ic}<small>${x.n}</small></div>`).join('')}</div></div>`; if(crateAnim.done){ const w=crateAnim.win; h+=`<div style="text-align:center;font-size:20px;font-weight:800;color:${RCOL[w.rar]}">${RAR[w.rar].toUpperCase()} — ${w.ic} ${w.n}${crateAnim.dup?` (duplicate → ${REFUND[w.rar]} 🪙)`:' — equip it in My stuff!'}</div><div style="text-align:center;margin:6px"><button class="x" style="float:none" data-again>OK</button></div>`; } }
      h+=`<div class="g">`+Object.entries(CRATES).map(([k,C])=>`<div class="it cr"><b style="font-size:20px">${C.ic} ${C.n}</b><span>${C.w.slice(1).map((v,i)=>v?`${RAR[i+1]} ${v}%`:'').filter(Boolean).join(' · ')}${inv[C.inv]?`<br><b style="color:#4ade80">You have ${inv[C.inv]}</b>`:''}</span><button data-crate="${k}" ${crateAnim&&!crateAnim.done?'disabled':''}>${inv[C.inv]?'Open one':own?'Open (free)':'Open · '+C.p.toLocaleString()+' 🪙'}</button></div>`).join('')+'</div>';
      h+=`<h3>The collection — ${EXC.filter(x=>has(x.k)).length}/${EXC.length}</h3><div class="g">`+EXC.map(x=>`<div class="it" style="border-color:${RCOL[x.rar]};opacity:${has(x.k)?1:.45}"><b>${has(x.k)?x.ic:'❔'} ${x.n}</b><span style="color:${RCOL[x.rar]}">${RAR[x.rar]}${x.pass?' · Arcade Pass':''}</span></div>`).join('')+'</div>'; box.innerHTML=h+'</div>'; return; }
    if(tab==='pass'){ const T=tierOf(), into=own?TIERXP:PASS.xp-T*TIERXP; h+=`<div style="font-size:18px;font-weight:800">🎖️ Arcade Pass · Season ${SEASON} · Tier ${T}/${TIERS}</div><div style="color:#94a3b8;font-size:13px">Every coin you earn is pass XP (${TIERXP} per tier). Resets each month with new rewards to grab. Tier 10, 20 and 30 are season-only gear.</div><div class="lvl"><i style="width:${T>=TIERS?100:Math.round(clamp01(into/TIERXP)*100)}%"></i></div><div class="pass">`+
      Array.from({length:TIERS},(_,i)=>i+1).map(t=>{ const r=passReward(t), got=PASS.claimed.includes(t)||own&&false, ok=t<=T; return `<div class="${ok?'ok':''} ${PASS.claimed.includes(t)?'got':''}"><b>Tier ${t}</b><div style="margin:4px 0;min-height:30px">${rwText(r)}</div><button data-tier="${t}" ${ok&&!PASS.claimed.includes(t)?'':'disabled'}>${PASS.claimed.includes(t)?'✓':ok?'Claim':'🔒'}</button></div>`; }).join('')+'</div>'; box.innerHTML=h+'</div>'; return; }
    if(tab==='rewards'){ const st=J('rrCoinStreak',{n:1}), day=((Math.max(1,st.n)-1)%7)+1, CAL=['50','75','100','150','200','300','🎁 Epic crate']; h+=`<h3>📅 Login calendar — day ${day} of 7 · ${st.n} day streak</h3><div class="cal">${CAL.map((c,i)=>`<div class="${i+1===day?'now':i+1<day?'done':''}"><b>Day ${i+1}</b><div style="margin-top:6px;font-size:15px">${i<6?c+' 🪙':c}</div></div>`).join('')}</div><div style="color:#94a3b8;font-size:13px;margin-top:6px">Come back every day — miss a day and the calendar starts over.</div>
      <h3>🎟️ Secret codes</h3><div class="code"><input id="rrCodeIn" maxlength="20" placeholder="ENTER CODE"> <button data-redeem>Redeem</button></div><div style="color:#94a3b8;font-size:13px;margin-top:6px">Codes get shared in the chat, on announcements and around the site. Some give coins, some give crates.</div>
      <h3>🪙 Golden coins</h3><div style="color:#94a3b8;font-size:14px">Every few minutes a golden coin floats onto the screen — click it before it vanishes! Sometimes it's a 💰 golden bag worth up to 500.</div>`; box.innerHTML=h+'</div>'; return; }
    if(tab==='missions'){ h+=`<div style="color:#94a3b8;font-size:13px">Three new missions every day. Finish all three for a 300 🪙 bonus.</div>`+(D.m||[]).map((m,i)=>`<div class="ms"><div style="min-width:190px"><b>${mName(m)}</b><div style="font-size:12px;color:#94a3b8">${Math.min(m.got,m.goal).toLocaleString()} / ${m.goal.toLocaleString()} · reward ${m.r} 🪙</div></div><div class="bar"><i style="width:${Math.round(Math.min(1,m.got/m.goal)*100)}%"></i></div><button data-claim="${i}" ${m.got>=m.goal&&!m.claimed?'':'disabled'}>${m.claimed?'✓ Claimed':'Claim'}</button></div>`).join('')+
        `<div class="ms"><b style="flex:1">🎁 All three missions</b><button data-claim="all" ${(D.m||[]).every(m=>m.claimed)&&!D.allClaimed?'':'disabled'}>${D.allClaimed?'✓ Claimed':'Claim 300 🪙'}</button></div>`; box.innerHTML=h+'</div>'; return; }
    if(tab==='wheel'){ const seg=360/WHEEL.length, grad=WHEEL.map((w,i)=>`${w.col} ${i*seg}deg ${(i+1)*seg}deg`).join(',');
      h+=`<div class="wh"><div class="ptr">🔻</div><div class="disc" style="background:conic-gradient(${grad});transform:rotate(${wheelRot}deg)"><div class="lab">${WHEEL.map((w,i)=>`<span style="transform:rotate(${i*seg+seg/2-90}deg) translate(38px,-6px)">${w.t}</span>`).join('')}</div></div></div>
        <div style="text-align:center"><button class="x" style="float:none;background:#ca8a04;color:#1c1917;font-size:18px" data-spin ${spinning?'disabled':''}>${spinning?'Spinning…':own||!D.spun?'🎡 Free spin!':'🎡 Spin again · 100 🪙'}</button><div style="margin-top:8px;color:#fde68a;font-weight:800">${wheelMsg}</div></div>`; box.innerHTML=h+'</div>'; return; }
    if(tab==='bank'){ bankTick(); h+=`<div class="bk" style="background:#111c33;border:1px solid #273449;border-radius:14px;padding:14px"><div style="font-size:22px;font-weight:800">🏦 ${own?'∞':Math.floor(BANK.a).toLocaleString()} coins in the bank</div><div style="color:#94a3b8;font-size:13px;margin:4px 0 10px">Coins in the bank grow 2% every day, even while you're away (the bank holds up to 100,000).</div>
        <button data-bank="in">Deposit everything</button> <button data-bank="out">Withdraw everything</button></div>
        <div class="bk" style="background:#111c33;border:1px solid #273449;border-radius:14px;padding:14px;margin-top:10px"><b>💱 Exchange</b><div style="color:#94a3b8;font-size:13px;margin:4px 0 10px">Trade gym strength for coins: 100 strength → 20 🪙</div><button data-ex>Trade 100 strength</button></div>`; box.innerHTML=h+'</div>'; return; }
    if(tab==='hist'){ h+=`<div class="hist">${LOG.length?LOG.map(e=>`<div><span>${new Date(e.t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} · ${e.w}</span><b style="color:${e.n>=0?'#4ade80':'#f87171'}">${e.n>=0?'+':''}${e.n.toLocaleString()}</b></div>`).join(''):'<p style="color:#94a3b8">Nothing yet.</p>'}</div>`; box.innerHTML=h+'</div>'; return; }
    if(tab==='shop'){ const dl=ITEMS.filter(i=>DEALS.includes(i.k)); if(dl.length) h+=`<h3>🔥 Today's deals — 40% off</h3><div class="g">`+dl.map(i=>{ const got=!i.many&&has(i.k); return `<div class="it deal ${got?'own':''}"><b>${i.ic} ${i.n}</b><span>${i.d}</span>${got?'<button disabled>✓ Owned</button>':`<button class="buy" data-buy="${i.k}" ${!own&&bal<priceOf(i)?'disabled':''}>${own?'Free':`<s style="opacity:.6">${i.p}</s> ${priceOf(i).toLocaleString()} 🪙`}</button>`}</div>`; }).join('')+'</div>'; }
    if(tab==='earn') h+=`<ul class="earn"><li>📦 <b>Crates</b> — exclusive gear (wings, halos, horns, the Fire crown…), duplicates turn into coins</li><li>🎖️ <b>Arcade Pass</b> — 30 tiers every month: coins, crates and season-only gear</li><li>🪙 <b>Golden coins</b> — click them when they pop up</li><li>📅 <b>Login calendar</b> — 7 days, the 7th is a free Epic crate</li><li>🎟️ <b>Secret codes</b> — find them around the site</li><li>✅ <b>Daily missions</b> — three a day, plus 300 for finishing all three</li><li>🎡 <b>Lucky Wheel</b> — a free spin every day (up to 2,500)</li><li>⭐ <b>Arcade Level</b> — every coin you earn counts toward your level; each level gives +2% coins (up to +50%) and a level-up reward</li><li>🏦 <b>Bank</b> — 2% interest a day</li><li>🔥 <b>Daily bonus</b> — come back every day; your streak makes it bigger (up to 300)</li><li>🏁 <b>Finish a game</b> — +25 every time a match, race or round ends (any game)</li><li>🎮 <b>Play</b> — +4 every minute you're playing a game</li><li>🏋️ <b>Gym</b> — coins for every rep</li><li>📜 <b>Rival City</b> — +25 for every quest you complete</li><li>⚡ <b>Double coins</b> from the shop doubles all of it</li></ul><div class="muted" style="color:#94a3b8;font-size:13px">You can earn up to ${CAP.toLocaleString()} coins a day (daily bonus not included). Today: ${D.earned.toLocaleString()}.</div>`;
    else for(const c of cats){ const list=ITEMS.filter(i=>i.cat===c&&(tab==='shop'?!i.ex:has(i.k)&&!i.many)); if(!list.length) continue; h+=`<h3>${c}</h3><div class="g">`+list.map(i=>{ const got=!i.many&&has(i.k), on=i.slot&&eq[i.slot]===i.k;
        const btn=got?(i.slot?`<button data-buy="${i.k}">${on?'✓ Equipped':'Equip'}</button>`:'<button disabled>✓ Owned</button>'):`<button class="buy" data-buy="${i.k}" ${!own&&bal<priceOf(i)?'disabled':''}>${own?'Free':priceOf(i).toLocaleString()+' 🪙'}</button>`;
        return `<div class="it ${got?'own':''}" ${i.ex?`style="border-color:${RCOL[i.rar]}"`:''}><b>${i.ic} ${i.n}</b><span ${i.ex?`style="color:${RCOL[i.rar]}"`:''}>${i.d}</span>${btn}</div>`; }).join('')+'</div>'; }
    if(tab==='inv'&&!ITEMS.some(i=>!i.many&&has(i.k))) h+='<p style="color:#94a3b8">Nothing yet — buy something in the Shop tab.</p>';
    box.innerHTML=h+'</div>'; }
  function open(t){ css(); if(t) tab=t; if(!box){ box=document.createElement('div'); box.id='rrShop'; document.body.appendChild(box); box.addEventListener('click',e=>{ if(e.target===box||e.target.closest('[data-x]')){ box.remove(); box=null; return; } const tb=e.target.closest('[data-tab]'); if(tb){ tab=tb.dataset.tab; renderShop(); return; } const b=e.target.closest('[data-buy]'); if(b&&!b.disabled) buy(b.dataset.buy);
      const cl=e.target.closest('[data-claim]'); if(cl&&!cl.disabled){ const k=cl.dataset.claim; if(k==='all'){ D.allClaimed=true; bal+=300; logIt(300,'All daily missions'); toast('🎁 +300 🪙 — all missions done!'); } else { const m=D.m[+k]; if(m&&m.got>=m.goal&&!m.claimed){ m.claimed=true; bal+=m.r; logIt(m.r,'Mission: '+mName(m)); toast(`✅ +${m.r} 🪙`); } } save(); }
      const cr=e.target.closest('[data-crate]'); if(cr&&!cr.disabled){ crateAnim=null; openCrate(cr.dataset.crate); } if(e.target.closest('[data-again]')){ crateAnim=null; renderShop(); }
      const tr=e.target.closest('[data-tier]'); if(tr&&!tr.disabled) claimTier(+tr.dataset.tier); if(e.target.closest('[data-redeem]')){ const i=box.querySelector('#rrCodeIn'); redeem(i&&i.value); }
      if(e.target.closest('[data-spin]')) spin(); const bk=e.target.closest('[data-bank]'); if(bk) bankMove(bk.dataset.bank); if(e.target.closest('[data-ex]')) exchange(); }); box.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&e.target.id==='rrCodeIn') redeem(e.target.value); }); } renderShop(); }
  function mount(){ if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN||document.getElementById('rrCoin')) return; css(); pill=document.createElement('button'); pill.id='rrCoin'; pill.title='Arcade Coins — open the shop'; pill.onclick=()=>open(); document.body.appendChild(pill); render(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  addEventListener('storage',e=>{ if(e.key==='rrCoins'){ bal=Math.max(0,+e.newValue||0); render(); } });
  window.RRCOIN={ carPaint, carDeco, get bal(){ return isOwner()?Infinity:bal; }, get level(){ return lvl(); }, add, spend, has, equipped, open, items:ITEMS, toast, track };
})();
