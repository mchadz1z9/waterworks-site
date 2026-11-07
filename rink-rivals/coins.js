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
  const CAP=2000;   /* most you can earn in a day (the daily bonus doesn't count) */
  const save=()=>{ ls.set('rrCoins',String(Math.round(bal))); ls.set('rrInv',JSON.stringify(inv)); ls.set('rrEquip',JSON.stringify(eq)); ls.set('rrCoinDay',JSON.stringify(D)); render(); try{ dispatchEvent(new CustomEvent('rrcoin-change')); }catch(e){} };
  const fmt=n=>isOwner()?'∞':Math.round(n).toLocaleString();
  const dbl=()=>(+ls.get('rrCoin2x')||0)>Date.now();
  function add(n,why,quiet,noCap){ n=Math.round(+n||0); if(n<=0) return 0; if(isOwner()){ if(!quiet) toast(`+${n} 🪙 ${why||''}`); return n; } if(dbl()) n*=2; if(!noCap){ n=Math.min(n,Math.max(0,CAP-D.earned)); D.earned+=n; } if(n<=0) return 0; bal+=n; save(); if(!quiet) toast(`+${n.toLocaleString()} 🪙 ${why||''}`); return n; }
  function spend(n){ if(isOwner()) return true; if(bal<n) return false; bal-=n; save(); return true; }
  /* ---- what's in the shop ---- */
  const grant=g=>{ const q=J('rrGrant',{}); for(const k in g){ if(typeof g[k]==='number') q[k]=(q[k]||0)+g[k]; else if(Array.isArray(g[k])) q[k]=(q[k]||[]).concat(g[k]); } ls.set('rrGrant',JSON.stringify(q)); };
  const addStr=n=>{ if(window.RRSTR&&!RRSTR.owner&&RRSTR.set){ RRSTR.set(RRSTR.level+n); } else { const v=+ls.get('rrStrength')||0; ls.set('rrStrength',String(Math.round(v+n))); } };
  const ITEMS=[
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
  function mystery(){ if(Math.random()<.7){ const c=Math.round(Math.random()*600); bal+=c; save(); toast(c?`🎁 ${c} coins inside!`:'🎁 Empty… better luck next time'); }
    else { const pool=ITEMS.filter(i=>!i.many&&!inv[i.k]); const it=pool[Math.floor(Math.random()*pool.length)]; if(!it){ bal+=400; save(); toast('🎁 400 coins inside!'); return; } own(it); toast(`🎁 You got: ${it.ic} ${it.n}!`); } }
  function own(it){ if(it.buy&&!it.many){ inv[it.k]=1; it.buy(); } else if(it.buy) it.buy(); else inv[it.k]=1; if(it.slot&&!eq[it.slot]) eq[it.slot]=it.k; save(); }
  function buy(k){ const it=ITEMS.find(i=>i.k===k); if(!it) return; if(!it.many&&(inv[it.k]||(isOwner()&&!it.buy))){ if(it.slot){ eq[it.slot]=eq[it.slot]===it.k?null:it.k; save(); toast(eq[it.slot]?`${it.ic} Equipped`:'Unequipped'); } return; }
    if(!spend(it.p)){ toast(`You need ${it.p.toLocaleString()} 🪙`,'#f87171'); return; } if(it.many) inv[it.k]=(inv[it.k]||0)+1; own(it); if(it.k!=='mystery') toast(`${it.ic} ${it.n} — bought!`); }
  const has=k=>isOwner()||!!inv[k];
  const equipped=slot=>{ const k=eq[slot]; const it=ITEMS.find(i=>i.k===k); return it&&has(k)?it.val:null; };
  /* ---- earning ---- */
  { const st=J('rrCoinStreak',{d:'',n:0}); if(st.d!==today()){ const y=new Date(Date.now()-864e5).toDateString(); st.n=st.d===y?st.n+1:1; st.d=today(); ls.set('rrCoinStreak',JSON.stringify(st)); const b=Math.min(300,40+st.n*20); setTimeout(()=>add(b,`daily bonus · ${st.n} day streak 🔥`,false,true),2500); } }
  if(!NOGAME.includes(PAGE)) setInterval(()=>{ if(document.hidden) return; if(D.d!==today()) D={d:today(),earned:0,play:0,res:0}; if(D.play>=240) return; D.play+=4; add(4,'for playing',true); },60000);
  const lastRes={}; addEventListener('rr-result',()=>{ const now=Date.now(); if(lastRes[PAGE]&&now-lastRes[PAGE]<45000) return; lastRes[PAGE]=now; if(D.res>=900) return; D.res+=25; add(25,'game finished'); });
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
#rrShop .earn li{margin:6px 0}#rrShop .x{float:right}`; document.head.appendChild(s); }
  function render(){ if(!pill) return; pill.innerHTML=`${equipped('badge')||''}🪙 ${fmt(bal)}${dbl()?' <small>×2</small>':''}`; if(box) renderShop(); }
  let tT=null; function toast(t,col){ let el=document.getElementById('rrCoinT'); if(!el){ el=document.createElement('div'); el.id='rrCoinT'; document.body.appendChild(el); } el.textContent=t; el.style.color=col||'#fde68a'; el.style.opacity=1; clearTimeout(tT); tT=setTimeout(()=>el.style.opacity=0,2600); }
  function renderShop(){ const own=isOwner(), cats=[...new Set(ITEMS.map(i=>i.cat))];
    let h=`<div class="w"><button class="x" data-x>✕ Close</button><h2>🪙 Arcade Shop</h2><div class="bal">${fmt(bal)} coins${own?' — owner: everything is free':''}${dbl()?' · ⚡ double coins on':''}</div>
      <div class="tabs"><button data-tab="shop" class="${tab==='shop'?'on':''}">Shop</button><button data-tab="inv" class="${tab==='inv'?'on':''}">My stuff</button><button data-tab="earn" class="${tab==='earn'?'on':''}">How to earn</button></div>`;
    if(tab==='earn') h+=`<ul class="earn"><li>🔥 <b>Daily bonus</b> — come back every day; your streak makes it bigger (up to 300)</li><li>🏁 <b>Finish a game</b> — +25 every time a match, race or round ends (any game)</li><li>🎮 <b>Play</b> — +4 every minute you're playing a game</li><li>🏋️ <b>Gym</b> — coins for every rep</li><li>📜 <b>Rival City</b> — +25 for every quest you complete</li><li>⚡ <b>Double coins</b> from the shop doubles all of it</li></ul><div class="muted" style="color:#94a3b8;font-size:13px">You can earn up to ${CAP.toLocaleString()} coins a day (daily bonus not included). Today: ${D.earned.toLocaleString()}.</div>`;
    else for(const c of cats){ const list=ITEMS.filter(i=>i.cat===c&&(tab==='shop'||has(i.k)&&!i.many)); if(!list.length) continue; h+=`<h3>${c}</h3><div class="g">`+list.map(i=>{ const got=!i.many&&has(i.k), on=i.slot&&eq[i.slot]===i.k;
        const btn=got?(i.slot?`<button data-buy="${i.k}">${on?'✓ Equipped':'Equip'}</button>`:'<button disabled>✓ Owned</button>'):`<button class="buy" data-buy="${i.k}" ${!own&&bal<i.p?'disabled':''}>${own?'Free':i.p.toLocaleString()+' 🪙'}</button>`;
        return `<div class="it ${got?'own':''}"><b>${i.ic} ${i.n}</b><span>${i.d}</span>${btn}</div>`; }).join('')+'</div>'; }
    if(tab==='inv'&&!ITEMS.some(i=>!i.many&&has(i.k))) h+='<p style="color:#94a3b8">Nothing yet — buy something in the Shop tab.</p>';
    box.innerHTML=h+'</div>'; }
  function open(t){ css(); if(t) tab=t; if(!box){ box=document.createElement('div'); box.id='rrShop'; document.body.appendChild(box); box.addEventListener('click',e=>{ if(e.target===box||e.target.closest('[data-x]')){ box.remove(); box=null; return; } const tb=e.target.closest('[data-tab]'); if(tb){ tab=tb.dataset.tab; renderShop(); return; } const b=e.target.closest('[data-buy]'); if(b&&!b.disabled) buy(b.dataset.buy); }); box.addEventListener('keydown',e=>e.stopPropagation()); } renderShop(); }
  function mount(){ if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN||document.getElementById('rrCoin')) return; css(); pill=document.createElement('button'); pill.id='rrCoin'; pill.title='Arcade Coins — open the shop'; pill.onclick=()=>open(); document.body.appendChild(pill); render(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  addEventListener('storage',e=>{ if(e.key==='rrCoins'){ bal=Math.max(0,+e.newValue||0); render(); } });
  window.RRCOIN={ get bal(){ return isOwner()?Infinity:bal; }, add, spend, has, equipped, open, items:ITEMS, toast };
})();
