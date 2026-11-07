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
    const l0=lvlOf(LIFE); bal+=n; LIFE+=n; ls.set('rrCoinLife',String(LIFE)); logIt(n,why||'earned'); track('earn',n); save(); if(!quiet) toast(`+${n.toLocaleString()} 🪙 ${why||''}`);
    const l1=lvlOf(LIFE); if(l1>l0){ const rw=l1*25; bal+=rw; logIt(rw,`Arcade Level ${l1} reward`); save(); setTimeout(()=>toast(`⬆️ ARCADE LEVEL ${l1}! +${rw} 🪙 · coins now +${Math.round(lvlBonus()*100)}%`,'#c084fc'),900); }
    for(const [m,rw] of [[1000,100],[5000,400],[25000,1500],[100000,5000]]) if(LIFE>=m&&LIFE-n<m){ bal+=rw; logIt(rw,`Milestone: ${m.toLocaleString()} coins earned`); save(); setTimeout(()=>toast(`🏅 Milestone: ${m.toLocaleString()} coins earned! +${rw}`,'#facc15'),1800); }
    return n; }
  function spend(n,why){ if(isOwner()){ track('spend',n); return true; } if(bal<n) return false; bal-=n; logIt(-n,why||'spent'); track('spend',n); save(); return true; }
  /* ---- what's in the shop ---- */
  const grant=g=>{ const q=J('rrGrant',{}); for(const k in g){ if(typeof g[k]==='number') q[k]=(q[k]||0)+g[k]; else if(Array.isArray(g[k])) q[k]=(q[k]||[]).concat(g[k]); } ls.set('rrGrant',JSON.stringify(q)); };
  const addStr=n=>{ if(window.RRSTR&&!RRSTR.owner&&RRSTR.set){ RRSTR.set(RRSTR.level+n); } else { const v=+ls.get('rrStrength')||0; ls.set('rrStrength',String(Math.round(v+n))); } };
  const ITEMS=[
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
  function mystery(){ if(Math.random()<.7){ const c=Math.round(Math.random()*600); bal+=c; if(c) logIt(c,'Mystery box'); save(); toast(c?`🎁 ${c} coins inside!`:'🎁 Empty… better luck next time'); }
    else { const pool=ITEMS.filter(i=>!i.many&&!inv[i.k]); const it=pool[Math.floor(Math.random()*pool.length)]; if(!it){ bal+=400; save(); toast('🎁 400 coins inside!'); return; } own(it); toast(`🎁 You got: ${it.ic} ${it.n}!`); } }
  function own(it){ if(it.buy&&!it.many){ inv[it.k]=1; it.buy(); } else if(it.buy) it.buy(); else inv[it.k]=1; if(it.slot&&!eq[it.slot]) eq[it.slot]=it.k; save(); }
  function buy(k){ const it=ITEMS.find(i=>i.k===k); if(!it) return; if(!it.many&&(inv[it.k]||(isOwner()&&!it.buy))){ if(it.slot){ eq[it.slot]=eq[it.slot]===it.k?null:it.k; save(); toast(eq[it.slot]?`${it.ic} Equipped`:'Unequipped'); } return; }
    const pr=priceOf(it); if(!spend(pr,`${it.ic} ${it.n}`)){ toast(`You need ${pr.toLocaleString()} 🪙`,'#f87171'); return; } if(it.many) inv[it.k]=(inv[it.k]||0)+1; own(it); if(it.k!=='mystery') toast(`${it.ic} ${it.n} — bought!`); }
  const has=k=>isOwner()||!!inv[k];
  /* two items on sale every day */
  const DEALS=(()=>{ const r=seedR(today()+'d'), pool=ITEMS.filter(i=>i.k!=='mystery'), out=[]; while(out.length<2&&pool.length) out.push(pool.splice(Math.floor(r()*pool.length),1)[0].k); return out; })();
  const priceOf=it=>DEALS.includes(it.k)?Math.round(it.p*.6/5)*5:it.p;
  const equipped=slot=>{ const k=eq[slot]; const it=ITEMS.find(i=>i.k===k); return it&&has(k)?it.val:null; };
  /* ---- earning ---- */
  { const st=J('rrCoinStreak',{d:'',n:0}); if(st.d!==today()){ const y=new Date(Date.now()-864e5).toDateString(); st.n=st.d===y?st.n+1:1; st.d=today(); ls.set('rrCoinStreak',JSON.stringify(st)); const b=Math.min(300,40+st.n*20); setTimeout(()=>add(b,`daily bonus · ${st.n} day streak 🔥`,false,true),2500); } }
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
#rrShop .deal{border-color:#f97316!important;box-shadow:0 0 0 1px #f97316 inset}#rrShop .hist div{display:flex;justify-content:space-between;border-bottom:1px solid #1e293b;padding:5px 0;font-size:14px}`; document.head.appendChild(s); }
  function render(){ if(!pill) return; pill.innerHTML=`${equipped('badge')||''}🪙 ${fmt(bal)}${dbl()?' <small>×2</small>':''} <small style="opacity:.8">Lv ${lvl()}</small>${(D.m||[]).some(m=>m.got>=m.goal&&!m.claimed)||!D.spun?' <small>❗</small>':''}`; if(box) renderShop(); }
  let tT=null; function toast(t,col){ let el=document.getElementById('rrCoinT'); if(!el){ el=document.createElement('div'); el.id='rrCoinT'; document.body.appendChild(el); } el.textContent=t; el.style.color=col||'#fde68a'; el.style.opacity=1; clearTimeout(tT); tT=setTimeout(()=>el.style.opacity=0,2600); }
  function renderShop(){ const own=isOwner(), cats=[...new Set(ITEMS.map(i=>i.cat))];
    const L=lvl(), lp=own?1:(LIFE-40*L*L)/Math.max(1,nextAt(L)-40*L*L), TB=[['shop','🛒 Shop'],['missions','✅ Missions'],['wheel','🎡 Wheel'],['bank','🏦 Bank'],['inv','🎒 My stuff'],['hist','📜 History'],['earn','❓ How to earn']];
    let h=`<div class="w"><button class="x" data-x>✕ Close</button><h2>🪙 Arcade Shop</h2><div class="bal">${fmt(bal)} coins${own?' — owner: everything is free':''}${dbl()?' · ⚡ double coins on':''}</div>
      <div style="font-size:13px;color:#d8b4fe;margin-top:4px">⭐ Arcade Level ${L} · coins +${Math.round(lvlBonus()*100)}%${own?'':` · ${LIFE.toLocaleString()} / ${nextAt(L).toLocaleString()} lifetime coins to level ${L+1}`}</div><div class="lvl"><i style="width:${Math.round(clamp01(lp)*100)}%"></i></div>
      <div class="tabs" style="flex-wrap:wrap">${TB.map(([k,n])=>`<button data-tab="${k}" class="${tab===k?'on':''}">${n}${k==='missions'&&(D.m||[]).some(m=>m.got>=m.goal&&!m.claimed)||k==='wheel'&&!D.spun?' ❗':''}</button>`).join('')}</div>`;
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
    if(tab==='earn') h+=`<ul class="earn"><li>✅ <b>Daily missions</b> — three a day, plus 300 for finishing all three</li><li>🎡 <b>Lucky Wheel</b> — a free spin every day (up to 2,500)</li><li>⭐ <b>Arcade Level</b> — every coin you earn counts toward your level; each level gives +2% coins (up to +50%) and a level-up reward</li><li>🏦 <b>Bank</b> — 2% interest a day</li><li>🔥 <b>Daily bonus</b> — come back every day; your streak makes it bigger (up to 300)</li><li>🏁 <b>Finish a game</b> — +25 every time a match, race or round ends (any game)</li><li>🎮 <b>Play</b> — +4 every minute you're playing a game</li><li>🏋️ <b>Gym</b> — coins for every rep</li><li>📜 <b>Rival City</b> — +25 for every quest you complete</li><li>⚡ <b>Double coins</b> from the shop doubles all of it</li></ul><div class="muted" style="color:#94a3b8;font-size:13px">You can earn up to ${CAP.toLocaleString()} coins a day (daily bonus not included). Today: ${D.earned.toLocaleString()}.</div>`;
    else for(const c of cats){ const list=ITEMS.filter(i=>i.cat===c&&(tab==='shop'||has(i.k)&&!i.many)); if(!list.length) continue; h+=`<h3>${c}</h3><div class="g">`+list.map(i=>{ const got=!i.many&&has(i.k), on=i.slot&&eq[i.slot]===i.k;
        const btn=got?(i.slot?`<button data-buy="${i.k}">${on?'✓ Equipped':'Equip'}</button>`:'<button disabled>✓ Owned</button>'):`<button class="buy" data-buy="${i.k}" ${!own&&bal<priceOf(i)?'disabled':''}>${own?'Free':priceOf(i).toLocaleString()+' 🪙'}</button>`;
        return `<div class="it ${got?'own':''}"><b>${i.ic} ${i.n}</b><span>${i.d}</span>${btn}</div>`; }).join('')+'</div>'; }
    if(tab==='inv'&&!ITEMS.some(i=>!i.many&&has(i.k))) h+='<p style="color:#94a3b8">Nothing yet — buy something in the Shop tab.</p>';
    box.innerHTML=h+'</div>'; }
  function open(t){ css(); if(t) tab=t; if(!box){ box=document.createElement('div'); box.id='rrShop'; document.body.appendChild(box); box.addEventListener('click',e=>{ if(e.target===box||e.target.closest('[data-x]')){ box.remove(); box=null; return; } const tb=e.target.closest('[data-tab]'); if(tb){ tab=tb.dataset.tab; renderShop(); return; } const b=e.target.closest('[data-buy]'); if(b&&!b.disabled) buy(b.dataset.buy);
      const cl=e.target.closest('[data-claim]'); if(cl&&!cl.disabled){ const k=cl.dataset.claim; if(k==='all'){ D.allClaimed=true; bal+=300; logIt(300,'All daily missions'); toast('🎁 +300 🪙 — all missions done!'); } else { const m=D.m[+k]; if(m&&m.got>=m.goal&&!m.claimed){ m.claimed=true; bal+=m.r; logIt(m.r,'Mission: '+mName(m)); toast(`✅ +${m.r} 🪙`); } } save(); }
      if(e.target.closest('[data-spin]')) spin(); const bk=e.target.closest('[data-bank]'); if(bk) bankMove(bk.dataset.bank); if(e.target.closest('[data-ex]')) exchange(); }); box.addEventListener('keydown',e=>e.stopPropagation()); } renderShop(); }
  function mount(){ if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN||document.getElementById('rrCoin')) return; css(); pill=document.createElement('button'); pill.id='rrCoin'; pill.title='Arcade Coins — open the shop'; pill.onclick=()=>open(); document.body.appendChild(pill); render(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  addEventListener('storage',e=>{ if(e.key==='rrCoins'){ bal=Math.max(0,+e.newValue||0); render(); } });
  window.RRCOIN={ get bal(){ return isOwner()?Infinity:bal; }, get level(){ return lvl(); }, add, spend, has, equipped, open, items:ITEMS, toast, track };
})();
