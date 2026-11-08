/* Arcade Rivals accounts: your progress (coins, strength, gear, Rival City, every game's save) on any device.
   Make an account with a name + PIN on one device; on another device log in once with the same name + PIN.
   After that the device stays logged in — no PIN again — and progress syncs by itself. Crews live here too. */
(function(){ if(window.RRACCT) return;
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }, del:k=>{ try{ localStorage.removeItem(k); }catch(e){} } };
  const J=(k,d)=>{ try{ return JSON.parse(ls.get(k)||'null')||d; }catch(e){ return d; } };
  const qs=new URLSearchParams(location.search);
  const SERVER=(qs.get('server')||((()=>{ try{ if(localStorage.getItem('rrSrv')==='relay') return location.origin+'/rr'; }catch(e){} return 'https://rink-rivals-rooms.mitchellchad2026.workers.dev'; })())).replace(/^ws/,'http');
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN) return;
  /* what follows you between devices: every game save. What doesn't: device settings and anything to do with admin or security */
  const DENY=new Set(['rrSrv','rrSw','rrGfx','rrAcct','rrOwner','rrOwnerStr','rrMyTag','rrAdmUrl','rrAdmG','rrPid','rrKicked','rrBanned','rrSiteGate','rrSiteCfgCache','rrServerOv','rrSiteEvents','rrSiteAt','rrMute','rrPin','rrParty','rrLast','rrStreakPend']);
  const syncable=k=>!!k&&!DENY.has(k)&&/^(rr|rinkRivals|sa[A-Z]|pk1$)/.test(k);
  function collect(){ const o={}; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(syncable(k)) o[k]=localStorage.getItem(k); } }catch(e){} return o; }
  function applyData(data){ let o={}; try{ o=JSON.parse(data||'{}'); }catch(e){} for(const k in o) if(syncable(k)) ls.set(k,o[k]); }
  /* logging in on a device that already has progress MERGES it with the account: bigger numbers win, lists and items are combined — nothing is lost */
  function mergeVal(a,b){ if(a==null) return b; if(b==null) return a; let x,y; try{ x=JSON.parse(a); y=JSON.parse(b); }catch(e){ return a.length>=b.length?a:b; } if(x&&y&&typeof x==='object'&&x._lww&&y._lww) return JSON.stringify(x._lww>=y._lww?x:y); return JSON.stringify(mergeObj(x,y)); }
  function mergeObj(x,y){ if(typeof x==='number'&&typeof y==='number') return Math.max(x,y); if(Array.isArray(x)&&Array.isArray(y)){ const seen=new Set(), out=[]; for(const v of x.concat(y)){ const k=JSON.stringify(v); if(seen.has(k)) continue; seen.add(k); out.push(v); } return out.slice(0,Math.max(x.length,y.length,Math.min(out.length,500))); }
    if(x&&y&&typeof x==='object'&&typeof y==='object'){ const o={...y}; for(const k in x) o[k]=k in y?mergeObj(x[k],y[k]):x[k]; return o; } if(typeof x==='boolean'&&typeof y==='boolean') return x||y; return x!=null?x:y; }
  function mergeIn(remote){ let o={}; try{ o=JSON.parse(remote||'{}'); }catch(e){} for(const k in o){ if(!syncable(k)) continue; const cur=ls.get(k); ls.set(k,cur==null?o[k]:mergeVal(cur,o[k])); } }
  const hash=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
  let A=J('rrAcct',null); const saveA=()=>{ if(A) ls.set('rrAcct',JSON.stringify(A)); else ls.del('rrAcct'); render(); };
  const api=(op,body,keep)=>fetch(SERVER+'/acct',{method:'POST',body:JSON.stringify({op,...(body||{})}),keepalive:!!keep}).then(r=>r.json()).catch(()=>({err:'net'}));
  const meta=()=>({life:Math.round(+ls.get('rrCoinLife')||0),str:Math.round(+ls.get('rrStrength')||0)});
  /* the owner's account makes every device it logs in on the owner (infinite coins, strength, everything unlocked) */
  function ownerOn(){ if(ls.get('rrOwner')==='1') return; ls.set('rrOwner','1'); try{ if(!sessionStorage.getItem('rrOwnRl')){ sessionStorage.setItem('rrOwnRl','1'); setTimeout(()=>location.reload(),600); } }catch(e){} }
  let busy=false, lastSync=0;
  async function push(force,keep){ if(!A||busy) return; const snap=JSON.stringify(collect()), h=hash(snap); if(!force&&h===A.h) return; busy=true; const r=await api('push',{token:A.token,data:snap,...meta(),pub:JSON.stringify(pubData()),pg:PAGE||'index'},keep); busy=false;
    if(r.ok){ A.ver=r.ver; A.h=h; lastSync=Date.now(); saveA(); } else if(r.err==='auth'){ A=null; saveA(); } }
  async function pull(){ if(!A) return; const r=await api('pull',{token:A.token,since:A.ver||0}); if(r.err==='auth'){ A=null; saveA(); return; } if(!r.ok) return;
    A.crew=r.crew||null; if(r.name) A.name=r.name; if(r.owner) ownerOn();
    if(!r.same&&r.ver>(A.ver||0)){ applyData(r.data); A.ver=r.ver; A.h=hash(JSON.stringify(collect())); saveA(); lastSync=Date.now();
      try{ if(!sessionStorage.getItem('rrAcctRl')){ sessionStorage.setItem('rrAcctRl','1'); toast('☁️ Synced your progress from your other device…'); setTimeout(()=>location.reload(),900); return; } }catch(e){} }
    lastSync=Date.now(); saveA(); }
  /* an owner device that isn't signed in yet signs itself into the owner account (the server checks the device really is an owner device) */
  const ownerDevice=()=>{ if(ls.get('rrOwner')==='1'||/\bowner\b/i.test(String(ls.get('rrMyTag')||''))) return true; try{ return sessionStorage.getItem('rrRole')==='full'; }catch(e){ return false; } };
  if(!A&&ownerDevice()&&ls.get('rrPid')) setTimeout(async()=>{ if(A) return; const r=await api('ownerAuto',{pid:ls.get('rrPid')}); if(!r.ok) return; mergeIn(r.data); ls.set('rrOwner','1'); A={name:r.name,token:r.token,ver:r.ver,crew:r.crew,h:''}; saveA(); await push(true); toast(`👑 Signed in as ${r.name} automatically`); try{ if(!sessionStorage.getItem('rrOwnRl')){ sessionStorage.setItem('rrOwnRl','1'); setTimeout(()=>location.reload(),900); } }catch(e){} },1200);
  if(A) setTimeout(()=>api('ping',{token:A.token,pg:PAGE||'index'}),4000);
  if(A){ setTimeout(()=>pull().then(()=>push()),1500); setInterval(()=>push(),90000); addEventListener('visibilitychange',()=>{ if(document.hidden) push(false,true); }); addEventListener('pagehide',()=>push(false,true)); }
  /* ---- the account window ---- */
  let pill=null, box=null, tab='acct', msg='', crewCache=null, topCache=null;
  function css(){ if(document.getElementById('rrAcctCss')) return; const s=document.createElement('style'); s.id='rrAcctCss'; s.textContent=`
#rrAcctB{position:fixed;left:10px;bottom:112px;z-index:2147482500;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#eff6ff;border:1px solid #93c5fd;border-radius:999px;padding:6px 12px;font:800 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}
#rrAcct{position:fixed;inset:0;z-index:2147482700;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
#rrAcct .w{width:min(560px,94vw);max-height:88vh;overflow:auto;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:18px;padding:18px 20px}
#rrAcct h2{margin:0 0 6px}#rrAcct p,#rrAcct .m{color:#94a3b8;font-size:14px}#rrAcct input{width:100%;box-sizing:border-box;background:#0b1222;border:1px solid #334155;border-radius:10px;color:#fff;padding:10px 12px;font-size:16px;margin:4px 0 10px}
#rrAcct button{background:#2563eb;color:#fff;border:1px solid #93c5fd;border-radius:999px;padding:8px 16px;font-weight:800;cursor:pointer;margin:2px}#rrAcct button.g{background:#1e293b;border-color:#334155}#rrAcct .x{float:right}
#rrAcct .tabs{display:flex;gap:8px;margin:10px 0}#rrAcct .tabs button.on{background:#ca8a04;color:#1c1917;border-color:#fde68a}#rrAcct .err{color:#f87171;font-weight:700}#rrAcct .ok{color:#4ade80;font-weight:700}
#rrAcct .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e293b;font-size:14px}`; document.head.appendChild(s); }
  function toast(t){ if(window.RRCOIN&&RRCOIN.toast) RRCOIN.toast(t); }
  function render(){ if(!pill) return; pill.textContent=A?`👤 ${A.name}${A.crew?` [${A.crew}]`:''} ☁️`:'👤 Save progress'; if(box) renderBox(); }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function renderBox(){ let h=`<div class="w"><button class="g x" data-x>✕</button><h2>👤 ${A?esc(A.name):'Your account'}</h2>`;
    if(!A){ h+=`<p>Make an account and your coins, strength, gear, Rival City and every game's progress follow you to any computer, tablet or phone. On this device you'll stay logged in — the PIN is only for logging in somewhere new.</p>
      <div class="tabs"><button data-t="new" class="${tab!=='login'?'on':''}">Create account</button><button data-t="login" class="${tab==='login'?'on':''}">I already have one</button></div>`;
      if(tab!=='login') h+=`<div class="m">Name</div><input id="aN" maxlength="20" value="${esc(ls.get('rrName')||'')}"><div class="m">PIN (4–8 numbers — remember it!)</div><input id="aP" type="password" inputmode="numeric" maxlength="8"><div class="m">PIN again</div><input id="aP2" type="password" inputmode="numeric" maxlength="8"><button data-go="create">Create account &amp; save my progress</button>`;
      else h+=`<div class="m">Account name</div><input id="aN" maxlength="20"><div class="m">PIN</div><input id="aP" type="password" inputmode="numeric" maxlength="8"><button data-go="login">Log in on this device</button><p>Logging in combines this device's progress with your account — nothing gets reset.</p>`; }
    else { h+=`<div class="tabs" style="flex-wrap:wrap"><button data-t="acct" class="${tab==='acct'||tab==='new'||tab==='login'?'on':''}">☁️ Account</button><button data-t="crew" class="${tab==='crew'?'on':''}">🏴 Crew</button><button data-t="trade" class="${tab==='trade'?'on':''}">🔄 Trades${TR.inc.length?' ('+TR.inc.length+')':''}</button><button data-t="card" class="${tab==='card'?'on':''}">🪪 Player card</button><button data-t="friends" class="${tab==='friends'?'on':''}">👥 Friends${FR.inc.length+FR.gifts.length?' ('+(FR.inc.length+FR.gifts.length)+')':''}</button></div>`;
      if(tab==='friends') h+=friendsHTML(); else if(tab==='trade') h+=tradeHTML(); else if(tab==='card') h+=`<canvas id="pc" width="640" height="360" style="width:100%;border-radius:14px"></canvas><p><button data-go="pcdl">⬇️ Download card</button> <span class="m">Share it with your friends!</span></p>`; else if(tab!=='crew') h+=`<p class="ok">✓ Logged in on this device — your progress saves by itself.</p><div class="row"><span>Last synced</span><b>${lastSync?new Date(lastSync).toLocaleTimeString():'—'}</b></div><div class="row"><span>Crew</span><b>${A.crew?'['+esc(A.crew)+']':'none'}</b></div>
        <p>On another device: open 👤, choose “I already have one”, and enter <b>${esc(A.name)}</b> and your PIN.</p><button data-go="sync">☁️ Save now</button> <button class="g" data-go="pin">Change PIN</button> <button class="g" data-go="out">Log out</button>`;
      else h+=crewHTML(); }
    h+=`<div style="margin-top:8px">${msg}</div></div>`; box.innerHTML=h; if(tab==='card') setTimeout(drawCard,0); }
  function crewHTML(){ const c=crewCache; let h='';
    if(c===undefined||c==='loading') return '<p>Loading…</p>';
    if(c){ h+=`<h3 style="margin:6px 0">🏴 [${esc(c.tag)}] ${esc(c.name)}</h3><div class="m">${c.members.length} member${c.members.length>1?'s':''} · crew total ${(c.total||0).toLocaleString()} lifetime coins</div>${c.code?`<p>Invite code: <b style="font-size:20px;color:#fde68a;letter-spacing:.1em">${esc(c.code)}</b> — friends enter it in 👤 → Crew → Join.</p>`:''}`+
        c.members.map((m,i)=>`<div class="row"><span>${i+1}. <a href="#" data-prof="${esc(m.disp)}" style="color:#93c5fd">${esc(m.disp)}</a></span><b>${(m.life||0).toLocaleString()} 🪙 · 💪 ${(m.str||0).toLocaleString()}</b></div>`).join('')+`<p><button class="g" data-go="leave">Leave crew</button></p>`; }
    else h+=`<p>Team up! Crews add up every member's lifetime coins on the crew leaderboard.</p><div class="m">Crew name</div><input id="cN" maxlength="20"><div class="m">Tag (2–6 letters, shows next to your name)</div><input id="cT" maxlength="6" style="text-transform:uppercase"><button data-go="ccreate">Create crew</button>
      <h3 style="margin:14px 0 4px">Join with an invite code</h3><input id="cC" maxlength="6" style="text-transform:uppercase" placeholder="ABC123"><button data-go="cjoin">Join crew</button>`;
    h+=`<h3 style="margin:14px 0 4px">🏆 Top crews</h3>`+(topCache?topCache.map((r,i)=>`<div class="row"><span>${i+1}. [${esc(r.tag)}] ${esc(r.name)} · ${r.n} member${r.n>1?'s':''}</span><b>${(r.total||0).toLocaleString()} 🪙</b></div>`).join('')||'<p>No crews yet — be the first!</p>':'<p>Loading…</p>'); return h; }

  /* ---- trading ---- */
  const TR={inc:[],out:[]}; const DONE=()=>J('rrTradeDone',[]);
  const C=()=>window.RRCOIN, nmOf=k=>C()?C().itemName(k):k, pk=t=>{ try{ return JSON.parse(t||'{}'); }catch(e){ return {}; } };
  const listTxt=o=>[...(o.items||[]).map(nmOf),o.coins?`${o.coins.toLocaleString()} 🪙`:''].filter(Boolean).join(', ')||'nothing';
  async function tradePoll(){ if(!A||!C()) return; const r=await api('tradeList',{token:A.token}); if(!r.ok) return; TR.inc=r.inc||[]; TR.out=r.out||[];
    const done=DONE(); for(const t of TR.out){ if(t.st==='open'||done.includes(t.id)) continue; const g=pk(t.give), w=pk(t.want);
      if(t.st==='accepted'){ C().tradeGive(w.items||[],w.coins||0); toast(`🔄 ${t.too} accepted your trade! You got ${listTxt(w)}`); } else { C().tradeGive(g.items||[],g.coins||0); toast(t.st==='declined'?`🔄 ${t.too} said no — your items are back`:'🔄 Trade cancelled — items back'); }
      done.push(t.id); ls.set('rrTradeDone',JSON.stringify(done.slice(-200))); api('tradeClaim',{token:A.token,id:t.id}); }
    TR.out=TR.out.filter(t=>t.st==='open'); if(TR.inc.length&&pill) pill.textContent=`👤 ${A.name}${A.crew?` [${A.crew}]`:''} 🔄${TR.inc.length}`; if(box&&tab==='trade') renderBox(); }
  if(A){ setTimeout(tradePoll,6000); setInterval(()=>{ if(!document.hidden) tradePoll(); },60000); }
  function tradeHTML(){ if(!C()) return '<p>Loading…</p>'; const T=C().tradeable(), mine=T.filter(i=>i.own), RC=['#e2e8f0','#94a3b8','#38bdf8','#c084fc','#fbbf24'];
    let h=`<h3 style="margin:6px 0">📥 Offers for you</h3>`+(TR.inc.length?TR.inc.map(t=>`<div style="background:#111c33;border:1px solid #273449;border-radius:12px;padding:10px;margin:6px 0"><b>${esc(t.frm)}</b> offers <b style="color:#4ade80">${esc(listTxt(pk(t.give)))}</b><br>and wants <b style="color:#fbbf24">${esc(listTxt(pk(t.want)))}</b>${t.msg?`<div class="m">“${esc(t.msg)}”</div>`:''}<div style="margin-top:6px"><button data-acc="${t.id}">✓ Accept</button> <button class="g" data-dec="${t.id}">✕ Decline</button></div></div>`).join(''):'<p>No offers right now.</p>');
    h+=TR.out.length?`<h3 style="margin:10px 0 4px">📤 Waiting for an answer</h3>`+TR.out.map(t=>`<div class="row"><span>To ${esc(t.too)}: ${esc(listTxt(pk(t.give)))} → ${esc(listTxt(pk(t.want)))}</span><button class="g" data-can="${t.id}">Cancel</button></div>`).join(''):'';
    h+=`<h3 style="margin:14px 0 4px">➕ New trade</h3><div class="m">Their account name</div><input id="tTo" maxlength="20">
      <div class="m">You give (tick up to 10)</div><div style="max-height:150px;overflow:auto;background:#0b1222;border:1px solid #334155;border-radius:10px;padding:6px">${mine.length?mine.map(i=>`<label style="display:block;color:${RC[i.rar]};font-size:14px"><input type="checkbox" data-gv="${i.k}" style="width:auto;margin:2px 6px"> ${esc(i.ic)} ${esc(i.n)}</label>`).join(''):'<span class="m">You don’t own any tradeable items yet</span>'}</div>
      <div class="m" style="margin-top:6px">…and coins</div><input id="tGc" type="number" min="0" value="0">
      <div class="m">You want (tick up to 10)</div><div style="max-height:150px;overflow:auto;background:#0b1222;border:1px solid #334155;border-radius:10px;padding:6px">${T.slice().sort((a,b)=>b.rar-a.rar).map(i=>`<label style="display:block;color:${RC[i.rar]};font-size:14px"><input type="checkbox" data-wt="${i.k}" style="width:auto;margin:2px 6px"> ${esc(i.ic)} ${esc(i.n)}</label>`).join('')}</div>
      <div class="m" style="margin-top:6px">…and coins</div><input id="tWc" type="number" min="0" value="0"><div class="m">Message (optional)</div><input id="tMsg" maxlength="80"><button data-go="tsend">Send trade offer</button>
      <p class="m">What you give is held until they answer. If they say no (or you cancel), you get it back.</p>`; return h; }
  async function tradeGo(el){ const g=k=>box.querySelector('#'+k), id=+(el.dataset.acc||el.dataset.dec||el.dataset.can||0);
    if(el.dataset.go==='tsend'){ const gi=[...box.querySelectorAll('[data-gv]:checked')].map(x=>x.dataset.gv).slice(0,10), wi=[...box.querySelectorAll('[data-wt]:checked')].map(x=>x.dataset.wt).slice(0,10), gc=Math.max(0,+g('tGc').value|0), wc=Math.max(0,+g('tWc').value|0), to=g('tTo').value.trim();
      if(!to) return say('Type their account name'); if(!gi.length&&!gc) return say('Pick something to give'); if(!wi.length&&!wc) return say('Pick something you want');
      if(!C().tradeTake(gi,gc)) return say('You don’t have that many coins'); const r=await api('tradeSend',{token:A.token,to,give:{items:gi,coins:gc},want:{items:wi,coins:wc},msg:g('tMsg').value});
      if(!r.ok){ C().tradeGive(gi,gc); return say(r.err==='nouser'?'No account with that name':r.err==='many'?'You have 10 offers waiting already':'Couldn’t send it'); } say(`✓ Offer sent to ${esc(r.to)}`,true); tradePoll(); return; }
    if(el.dataset.acc){ const t=TR.inc.find(x=>x.id===id); if(!t) return; const w=pk(t.want), gv=pk(t.give); if(!C().tradeTake(w.items||[],w.coins||0)) return say('You don’t have everything they want');
      const r=await api('tradeRespond',{token:A.token,id,accept:true}); if(!r.ok){ C().tradeGive(w.items||[],w.coins||0); return say('That offer is gone'); } C().tradeGive(gv.items||[],gv.coins||0); say(`✓ Trade done! You got ${esc(listTxt(gv))}`,true); push(true); tradePoll(); return; }
    if(el.dataset.dec){ await api('tradeRespond',{token:A.token,id,accept:false}); say('Declined',true); tradePoll(); return; }
    if(el.dataset.can){ await api('tradeCancel',{token:A.token,id}); say('Cancelled — your items come back in a moment',true); tradePoll(); } }
  /* ---- player card ---- */
  function drawCard(){ const cv=box&&box.querySelector('#pc'); if(!cv) return; const P=pubData(); drawCardData(cv,{name:A?A.name:'Player',crew:A&&A.crew,own:P.own,lvl:P.lvl,life:P.life,str:P.str,reb:P.reb,ach:P.ach,achN:P.achN,crates:P.crates,best:P.items.slice(0,4)}); }
  function drawCardData(cv,d){ if(!cv) return; const x=cv.getContext('2d'), W=640, H=360, own=!!d.own;
    const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'#1e1b4b'); g.addColorStop(.6,'#4c1d95'); g.addColorStop(1,'#be185d'); x.fillStyle=g; x.fillRect(0,0,W,H);
    x.strokeStyle='#facc15'; x.lineWidth=6; x.strokeRect(8,8,W-16,H-16); x.fillStyle='rgba(255,255,255,.06)'; for(let i=0;i<12;i++){ x.beginPath(); x.arc(560-i*12,60+i*20,40+i*6,0,7); x.fill(); }
    const T=(t,X,Y,sz,col,al)=>{ x.font=`800 ${sz}px system-ui,sans-serif`; x.textAlign=al||'left'; x.fillStyle=col; x.fillText(t,X,Y); };
    T('ARCADE RIVALS · PLAYER CARD',30,46,16,'#fde68a'); T(d.name||'Player',30,98,46,'#fff'); if(d.crew) T(`[${d.crew}]`,30,128,22,'#c4b5fd'); if(own) T('👑 OWNER',W-30,98,26,'#facc15','right');
    const stats=[['⭐ Arcade Level',own?'∞':d.lvl||0],['🪙 Lifetime coins',own?'∞':(d.life||0).toLocaleString()],['💪 Strength',own?'∞':(d.str||0).toLocaleString()],['🔁 Rebirths',own?'∞':d.reb||0],['🏆 Achievements',`${d.ach||0}/${d.achN||0}`],['📦 Crates opened',d.crates||0]];
    stats.forEach(([a,b],i)=>{ const cx=30+(i%3)*200, cy=180+Math.floor(i/3)*62; x.fillStyle='rgba(0,0,0,.28)'; x.fillRect(cx,cy-30,186,52); T(String(b),cx+10,cy+2,24,'#fff'); T(a,cx+10,cy+18,12,'#ddd6fe'); });
    const best=d.best||[]; T('Rarest items:',30,322,15,'#fde68a'); T(best.length?best.map(i=>`${i.ic} ${i.n}`).join('  ·  '):'— none yet —',140,322,15,'#fff'); }

  /* ---- public profile, friends and gifts ---- */
  const GAMEN={hockey:'🏒 Hockey',basketball:'🏀 Basketball',football:'🏈 Football',baseball:'⚾ Baseball',soccer:'⚽ Soccer',mx:'🏍️ Motocross',nascar:'🏁 NASCAR',kart:'🏎️ Kart',drift:'💨 Drift',f1:'🏎️ F1',city:'🏙️ Rival City',weightlifting:'🏋️ the Gym',protag:'🏃 Pro Tag',obby:'🧗 Obby',golf:'⛳ Golf',bowling:'🎳 Bowling',poker:'🃏 Poker',blackjack:'🂡 Blackjack',chess:'♟️ Chess',hub:'🌐 the Hub',index:'the home page','sports-arcade':'🏟️ the Arcade'};
  function pubData(){ const n=k=>+ls.get(k)||0, Cn=C(), own=ls.get('rrOwner')==='1', gear={}; if(Cn) for(const sl of ['arm','wrist','head','face','neck','back']){ const v=Cn.equipped(sl); if(v) gear[sl]=v; }
    const ach=Cn&&Cn.achievements?Cn.achievements():[], items=Cn?Cn.tradeable().filter(i=>i.own&&i.rar).sort((a,b)=>b.rar-a.rar).slice(0,8).map(i=>({ic:i.ic,n:i.n,r:i.rar})):[], J2=k=>{ try{ return JSON.parse(ls.get(k)||'{}')||{}; }catch(e){ return {}; } };
    const gym=J2('rinkRivalsGymV2'), pt=J2('rrProTag'), city=J2('rrCity'), rec=[]; if(gym.best){ for(const [k,l] of [['bench','Bench'],['squat','Squat'],['dead','Deadlift']]) if(gym.best[k]) rec.push([`🏋️ ${l}`,`${Math.round(gym.best[k]).toLocaleString()} lb`]); }
    if(pt.wins) rec.push(['🏃 Pro Tag wins',pt.wins]); if(city.money) rec.push(['🏙️ Rival City cash',own?'∞':'$'+Math.round(city.money).toLocaleString()]); if(city.qd) rec.push(['📜 City quests',Object.keys(city.qd).length]);
    let pet=null, room=null; try{ pet=JSON.parse(ls.get('rrPet')||'null'); }catch(e){} try{ const r=JSON.parse(ls.get('rrRoom')||'null'); if(r&&Array.isArray(r.i)) room={f:r.f|0,w:r.w|0,i:r.i.slice(0,60)}; }catch(e){}
    return {own:own?1:0,lvl:Cn&&Cn.level!=null?Cn.level:0,life:Math.round(n('rrCoinLife')),str:Math.round(n('rrStrength')),reb:n('rrRebirths'),ach:ach.filter(a=>a.got).length,achN:ach.length,crates:(J('rrCoinStat',{}).crates||0),gear,items,rec,pet:pet&&{ic:pet.ic,n:pet.n,lv:pet.lv||0},room}; }
  const FR={friends:[],inc:[],out:[],gifts:[],now:Date.now()};
  async function frPoll(){ if(!A) return; const r=await api('friendList',{token:A.token}); if(!r.ok) return; Object.assign(FR,r); if(box&&tab==='friends') renderBox(); if(pill&&(r.inc.length||r.gifts.length)&&!pill.textContent.includes('🎁')) pill.textContent+=r.gifts.length?' 🎁':' 👥'; }
  if(A){ setTimeout(frPoll,7000); setInterval(()=>{ if(!document.hidden) frPoll(); },120000); }
  const online=f=>FR.now-(f.seen||0)<4*60000;
  function friendsHTML(){ let h='';
    if(FR.gifts.length) h+=`<h3 style="margin:6px 0">🎁 Gifts for you</h3>`+FR.gifts.map(g=>{ const w=pk(g.what); return `<div class="row"><span>From <b>${esc(g.frm)}</b>${g.msg?` — “${esc(g.msg)}”`:''}</span><button data-gopen="${g.id}">🎁 Open</button></div>`; }).join('');
    if(FR.inc.length) h+=`<h3 style="margin:10px 0 4px">📨 Friend requests</h3>`+FR.inc.map(f=>`<div class="row"><span>${esc(f.name)}</span><span><button data-facc="${esc(f.name)}">✓ Accept</button> <button class="g" data-frem="${esc(f.name)}">✕</button></span></div>`).join('');
    h+=`<h3 style="margin:10px 0 4px">👥 Friends (${FR.friends.length})</h3>`+(FR.friends.length?FR.friends.sort((a,b)=>(online(b)-online(a))||(b.seen-a.seen)).map(f=>`<div class="row"><span>${online(f)?'🟢':'⚪'} <a href="#" data-prof="${esc(f.name)}" style="color:#93c5fd">${esc(f.name)}</a>${f.crew?` [${esc(f.crew)}]`:''}<br><span class="m">${online(f)?'playing '+(GAMEN[f.pg]||esc(f.pg)):f.seen?'last seen '+new Date(f.seen).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'offline'}</span></span><span>${online(f)&&f.pg?`<a href="${esc(f.pg==='index'?'./':f.pg)}" style="color:#4ade80;font-weight:800;margin-right:6px">Join ▶</a>`:''}<button class="g" data-gift="${esc(f.name)}">🎁</button></span></div>`).join(''):'<p>No friends yet — add someone by their account name.</p>');
    if(FR.out.length) h+=`<div class="m" style="margin-top:6px">Waiting for: ${FR.out.map(f=>esc(f.name)).join(', ')}</div>`;
    h+=`<h3 style="margin:12px 0 4px">➕ Add a friend</h3><input id="fAdd" maxlength="20" placeholder="Their account name"><button data-go="fadd">Send friend request</button>`;
    if(giftTo){ const T=C()?C().tradeable().filter(i=>i.own):[]; h+=`<div id="giftBox" style="margin-top:12px;background:#111c33;border:1px solid #facc15;border-radius:14px;padding:12px"><b>🎁 Send a gift to ${esc(giftTo)}</b>
      <div class="m">Coins</div><input id="gC" type="number" min="0" value="0"><div class="m">An item (optional)</div><select id="gI" style="width:100%;padding:8px;border-radius:10px;background:#0b1222;color:#fff;border:1px solid #334155;margin-bottom:8px"><option value="">— none —</option>${T.map(i=>`<option value="${i.k}">${esc(i.ic)} ${esc(i.n)}</option>`).join('')}</select>
      <div class="m">Wrap a crate (paid from your coins)</div><select id="gK" style="width:100%;padding:8px;border-radius:10px;background:#0b1222;color:#fff;border:1px solid #334155;margin-bottom:8px"><option value="">— none —</option><option value="common">📦 Arcade Crate · 200 🪙</option><option value="epic">🎁 Epic Crate · 800 🪙</option><option value="legend">👑 Legendary Crate · 3,000 🪙</option></select>
      <div class="m">Message</div><input id="gM" maxlength="80" placeholder="Happy birthday!"><button data-go="gsend">Send gift 🎁</button> <button class="g" data-go="gcancel">Cancel</button></div>`; }
    return h; }
  let giftTo=null; const CRP={common:200,epic:800,legend:3000};
  async function frGo(el){ const d=el.dataset, v=id=>{ const e=box.querySelector('#'+id); return e?e.value.trim():''; };
    if(d.go==='fadd'){ const r=await api('friendAdd',{token:A.token,to:v('fAdd')}); say(r.err==='nouser'?'No account with that name':r.ok?(r.now==='friends'?'✓ You are now friends!':'✓ Friend request sent'):'Couldn’t add them',r.ok); frPoll(); return; }
    if(d.facc){ await api('friendAccept',{token:A.token,name:d.facc}); say('✓ Friend added',true); frPoll(); return; }
    if(d.frem){ await api('friendRemove',{token:A.token,name:d.frem}); frPoll(); return; }
    if(d.gift){ giftTo=d.gift; renderBox(); return; } if(d.go==='gcancel'){ giftTo=null; renderBox(); return; }
    if(d.go==='gsend'){ const coins=Math.max(0,+v('gC')|0), item=v('gI'), crate=v('gK'), cost=coins+(crate?CRP[crate]:0); if(!coins&&!item&&!crate) return say('Pick something to give');
      if(!C().tradeTake(item?[item]:[],cost)) return say('You don’t have enough coins for that'); const r=await api('giftSend',{token:A.token,to:giftTo,what:{items:item?[item]:[],coins,crate},msg:v('gM')});
      if(!r.ok){ C().tradeGive(item?[item]:[],cost); return say(r.err==='many'?'That’s enough gifts for today':'Couldn’t send it'); } say(`✓ Gift sent to ${esc(giftTo)} 🎁`,true); giftTo=null; frPoll(); return; }
    if(d.gopen){ const r=await api('giftOpen',{token:A.token,id:+d.gopen}); if(!r.ok) return frPoll(); const w=pk(r.what); C().tradeGive(w.items||[],w.coins||0); if(w.crate&&C().giveCrate) C().giveCrate(w.crate);
      say(`🎁 You got ${esc(listTxt(w))}${w.crate?` + a ${w.crate==='legend'?'Legendary':w.crate==='epic'?'Epic':'Arcade'} Crate`:''}!`,true); toast('🎁 Gift opened!'); push(true); frPoll(); return; } }
  /* ---- anyone's profile: card, gear, items and records ---- */
  let pbox=null;
  async function profile(name){ css(); if(!A){ open('new'); return; } if(pbox) pbox.remove(); pbox=document.createElement('div'); pbox.id='rrAcct'; pbox.innerHTML='<div class="w"><p>Loading…</p></div>'; document.body.appendChild(pbox);
    pbox.addEventListener('click',async e=>{ if(e.target===pbox||e.target.closest('[data-x]')){ pbox.remove(); pbox=null; return; } const b=e.target.closest('[data-pf]'); if(!b) return; const a=b.dataset.pf;
      if(a==='add'){ const r=await api('friendAdd',{token:A.token,to:name}); b.textContent=r.ok?(r.now==='friends'?'✓ Friends':'✓ Request sent'):'Couldn’t add'; b.disabled=true; }
      if(a==='room'){ pbox.remove(); pbox=null; if(window.RRVISIT) RRVISIT(name); else location.href='hub?room='+encodeURIComponent(name); return; }
      if(a==='gift'||a==='trade'){ pbox.remove(); pbox=null; if(a==='gift') giftTo=name; open(a==='gift'?'friends':'trade'); if(a==='trade') setTimeout(()=>{ const i=box&&box.querySelector('#tTo'); if(i) i.value=name; },300); } });
    const r=await api('profile',{token:A.token,name}); if(!r.ok){ pbox.querySelector('.w').innerHTML='<button class="g x" data-x>✕</button><p>No account with that name.</p>'; return; }
    const P=pk(r.pub), on=r.now-(r.seen||0)<4*60000, me=A&&r.name.toLowerCase()===A.name.toLowerCase(), RC=['#e2e8f0','#94a3b8','#38bdf8','#c084fc','#fbbf24'];
    pbox.querySelector('.w').innerHTML=`<button class="g x" data-x>✕</button><h2>${P.own?'👑 ':''}${esc(r.name)} ${r.crew?`<span style="color:#c4b5fd">[${esc(r.crew)}]</span>`:''}</h2><div class="m">${on?'🟢 Online — '+(GAMEN[r.pg]||esc(r.pg)):'⚪ '+(r.seen?'Last seen '+new Date(r.seen).toLocaleString():'Offline')}</div>
      <canvas id="ppc" width="640" height="360" style="width:100%;border-radius:14px;margin-top:8px"></canvas>
      ${Object.keys(P.gear||{}).length?`<h3 style="margin:10px 0 4px">🎽 Wearing</h3><div>${Object.entries(P.gear).map(([sl,v])=>`<span style="display:inline-block;background:#1e293b;border-radius:999px;padding:4px 10px;margin:2px;font-size:13px">${esc(sl)}: ${esc(v.t||'')}${typeof v.c==='string'?` <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${esc(v.c)}"></span>`:''}</span>`).join('')}</div>`:''}
      ${(P.items||[]).length?`<h3 style="margin:10px 0 4px">✨ Best items</h3><div>${P.items.map(i=>`<span style="display:inline-block;border:1px solid ${RC[i.r]};color:${RC[i.r]};border-radius:999px;padding:4px 10px;margin:2px;font-size:13px">${esc(i.ic)} ${esc(i.n)}</span>`).join('')}</div>`:''}
      ${(P.rec||[]).length?`<h3 style="margin:10px 0 4px">📊 Records</h3>${P.rec.map(([a,b])=>`<div class="row"><span>${esc(a)}</span><b>${esc(String(b))}</b></div>`).join('')}`:''}
      ${P.pet?`<div class="m" style="margin-top:6px">🐾 Pet: ${esc(P.pet.ic||'')} ${P.pet.lv?'Lv '+P.pet.lv+' ':''}${esc(P.pet.n||'')}</div>`:''}
      <p style="margin-top:10px"><button data-pf="room">🏠 ${me?'My room':'Visit their room'}${P.room&&P.room.i?` (${P.room.i.length})`:''}</button></p>
      ${me?'':`<p style="margin-top:10px">${r.friend==='ok'?'<button disabled>✓ Friends</button>':`<button data-pf="add">${r.friend==='pending'?'Request pending':'➕ Add friend'}</button>`} <button data-pf="gift">🎁 Send a gift</button> <button class="g" data-pf="trade">🔄 Trade</button></p>`}`;
    drawCardData(pbox.querySelector('#ppc'),{name:r.name,crew:r.crew,own:P.own,lvl:P.lvl,life:P.life,str:P.str,reb:P.reb,ach:P.ach,achN:P.achN,crates:P.crates,best:(P.items||[]).slice(0,4)}); }
  document.addEventListener('click',e=>{ const a=e.target.closest('[data-prof]'); if(!a) return; e.preventDefault(); profile(a.dataset.prof); });
  async function loadCrew(){ crewCache='loading'; renderBox(); const [a,b]=await Promise.all([api('crewInfo',{token:A.token}),api('crewTop',{token:A.token})]); crewCache=a.ok?a.crew:null; topCache=b.ok?b.rows:[]; if(A){ A.crew=crewCache?crewCache.tag:null; saveA(); } }
  const say=(t,ok)=>{ const keep={}; box.querySelectorAll('input[id],select[id]').forEach(i=>keep[i.id]=i.value); msg=`<span class="${ok?'ok':'err'}">${t}</span>`; renderBox(); for(const id in keep){ const i=box.querySelector('#'+id); if(i) i.value=keep[id]; } };
  async function go(k){ const v=id=>{ const e=box.querySelector('#'+id); return e?e.value.trim():''; };
    if(k==='create'){ const n=v('aN'), p=v('aP'); if(n.length<2) return say('Pick a name (2+ letters)'); if(!/^\d{4,8}$/.test(p)) return say('PIN must be 4–8 numbers'); if(p!==v('aP2')) return say('The PINs don’t match');
      say('Creating…',true); const snap=JSON.stringify(collect()); const r=await api('create',{name:n,pin:p,data:snap,...meta()}); if(r.err==='taken') return say('That name is taken — if it’s yours, use “I already have one”'); if(!r.ok) return say('Couldn’t reach the server — try again');
      A={name:r.name,token:r.token,ver:r.ver,h:hash(snap)}; ls.set('rrName',r.name); saveA(); tab='acct'; lastSync=Date.now(); say('✓ Account made — your progress is saved!',true); toast('☁️ Account created'); }
    if(k==='login'){ const n=v('aN'), p=v('aP'); if(!n||!p) return say('Enter your name and PIN'); say('Logging in…',true); const r=await api('login',{name:n,pin:p});
      if(r.err==='nouser') return say('No account with that name'); if(r.err==='locked') return say(`Too many wrong PINs — try again in ${r.mins} min`); if(r.err==='pin') return say(`Wrong PIN (${r.left} tries left)`); if(!r.ok) return say('Couldn’t reach the server — try again');
      mergeIn(r.data); if(r.owner) ownerOn(); A={name:r.name,token:r.token,ver:r.ver,crew:r.crew,h:''}; if(!ls.get('rrName')) ls.set('rrName',r.name); saveA(); say('✓ Logged in — combining this device with your account…',true); await push(true); setTimeout(()=>location.reload(),900); }
    if(k==='pcdl'){ const cv=box.querySelector('#pc'); if(cv){ const a=document.createElement('a'); a.download=`${(A&&A.name)||'player'}-card.png`; a.href=cv.toDataURL('image/png'); a.click(); } return; }
    if(k==='sync'){ await push(true); say('✓ Saved to your account',true); }
    if(k==='out'){ if(!confirm('Log out on this device? Your progress stays saved in your account.')) return; await push(true); api('logout',{token:A.token}); A=null; saveA(); msg=''; tab='new'; renderBox(); }
    if(k==='pin'){ const p=prompt('New PIN (4–8 numbers):'); if(!p) return; if(!/^\d{4,8}$/.test(p)) return say('PIN must be 4–8 numbers'); const r=await api('setpin',{token:A.token,pin:p}); say(r.ok?'✓ PIN changed':'Couldn’t change it',r.ok); }
    if(k==='ccreate'){ const r=await api('crewCreate',{token:A.token,name:v('cN'),tag:v('cT')}); if(r.err==='taken') return say('That tag is taken'); if(!r.ok) return say('Name 2+ letters, tag 2–6 letters'); crewCache=r.crew; A.crew=r.crew.tag; saveA(); say(`✓ Crew [${r.crew.tag}] created — share the invite code!`,true); loadCrew(); }
    if(k==='cjoin'){ const r=await api('crewJoin',{token:A.token,code:v('cC')}); if(r.err==='nocrew') return say('No crew with that code'); if(r.err==='full') return say('That crew is full (30)'); if(!r.ok) return say('Couldn’t join'); A.crew=r.crew.tag; saveA(); say(`✓ You joined [${r.crew.tag}]!`,true); loadCrew(); }
    if(k==='leave'){ if(!confirm('Leave your crew?')) return; await api('crewLeave',{token:A.token}); A.crew=null; saveA(); say('You left the crew',true); loadCrew(); } }
  function open(t){ css(); if(t) tab=t; msg=''; if(!box){ box=document.createElement('div'); box.id='rrAcct'; document.body.appendChild(box);
      box.addEventListener('click',e=>{ if(e.target===box||e.target.closest('[data-x]')){ box.remove(); box=null; return; } const tb=e.target.closest('[data-t]'); if(tb){ tab=tb.dataset.t; msg=''; if(tab==='crew'&&A) loadCrew(); if(tab==='trade'&&A) tradePoll(); if(tab==='friends'&&A) frPoll(); renderBox(); return; } const fg=e.target.closest('[data-go="fadd"],[data-facc],[data-frem],[data-gift],[data-go="gcancel"],[data-go="gsend"],[data-gopen]'); if(fg){ frGo(fg); return; } const tg=e.target.closest('[data-acc],[data-dec],[data-can],[data-go="tsend"]'); if(tg){ tradeGo(tg); return; } const g=e.target.closest('[data-go]'); if(g) go(g.dataset.go); });
      box.addEventListener('keydown',e=>e.stopPropagation()); }
    if(tab==='crew'&&A) loadCrew(); renderBox(); }
  function mount(){ if(document.getElementById('rrAcctB')) return; css(); pill=document.createElement('button'); pill.id='rrAcctB'; pill.title='Your account — progress on every device'; pill.onclick=()=>open(); document.body.appendChild(pill); render(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  window.RRACCT={ profile, peek:async name=>{ if(!A) return null; const r=await api('profile',{token:A.token,name}); return r&&r.ok?pk(r.pub):null; }, friends:()=>FR.friends, get name(){ return A&&A.name; }, get crew(){ return A&&A.crew; }, open, push:()=>push(true) };
})();
