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
  const DENY=new Set(['rrSrv','rrSw','rrGfx','rrAcct','rrOwner','rrOwnerStr','rrMyTag','rrAdmUrl','rrAdmG','rrPid','rrKicked','rrBanned','rrSiteGate','rrSiteCfgCache','rrServerOv','rrSiteEvents','rrSiteAt','rrMute','rrPin','rrParty','rrLast']);
  const syncable=k=>!!k&&!DENY.has(k)&&/^(rr|rinkRivals|sa[A-Z]|pk1$)/.test(k);
  function collect(){ const o={}; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(syncable(k)) o[k]=localStorage.getItem(k); } }catch(e){} return o; }
  function applyData(data){ let o={}; try{ o=JSON.parse(data||'{}'); }catch(e){} for(const k in o) if(syncable(k)) ls.set(k,o[k]); }
  const hash=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
  let A=J('rrAcct',null); const saveA=()=>{ if(A) ls.set('rrAcct',JSON.stringify(A)); else ls.del('rrAcct'); render(); };
  const api=(op,body,keep)=>fetch(SERVER+'/acct',{method:'POST',body:JSON.stringify({op,...(body||{})}),keepalive:!!keep}).then(r=>r.json()).catch(()=>({err:'net'}));
  const meta=()=>({life:Math.round(+ls.get('rrCoinLife')||0),str:Math.round(+ls.get('rrStrength')||0)});
  let busy=false, lastSync=0;
  async function push(force,keep){ if(!A||busy) return; const snap=JSON.stringify(collect()), h=hash(snap); if(!force&&h===A.h) return; busy=true; const r=await api('push',{token:A.token,data:snap,...meta()},keep); busy=false;
    if(r.ok){ A.ver=r.ver; A.h=h; lastSync=Date.now(); saveA(); } else if(r.err==='auth'){ A=null; saveA(); } }
  async function pull(){ if(!A) return; const r=await api('pull',{token:A.token,since:A.ver||0}); if(r.err==='auth'){ A=null; saveA(); return; } if(!r.ok) return;
    A.crew=r.crew||null; if(r.name) A.name=r.name;
    if(!r.same&&r.ver>(A.ver||0)){ applyData(r.data); A.ver=r.ver; A.h=hash(JSON.stringify(collect())); saveA(); lastSync=Date.now();
      try{ if(!sessionStorage.getItem('rrAcctRl')){ sessionStorage.setItem('rrAcctRl','1'); toast('☁️ Synced your progress from your other device…'); setTimeout(()=>location.reload(),900); return; } }catch(e){} }
    lastSync=Date.now(); saveA(); }
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
      else h+=`<div class="m">Account name</div><input id="aN" maxlength="20"><div class="m">PIN</div><input id="aP" type="password" inputmode="numeric" maxlength="8"><button data-go="login">Log in on this device</button><p>Logging in replaces the progress on this device with your account's.</p>`; }
    else { h+=`<div class="tabs"><button data-t="acct" class="${tab!=='crew'?'on':''}">☁️ Account</button><button data-t="crew" class="${tab==='crew'?'on':''}">🏴 Crew</button></div>`;
      if(tab!=='crew') h+=`<p class="ok">✓ Logged in on this device — your progress saves by itself.</p><div class="row"><span>Last synced</span><b>${lastSync?new Date(lastSync).toLocaleTimeString():'—'}</b></div><div class="row"><span>Crew</span><b>${A.crew?'['+esc(A.crew)+']':'none'}</b></div>
        <p>On another device: open 👤, choose “I already have one”, and enter <b>${esc(A.name)}</b> and your PIN.</p><button data-go="sync">☁️ Save now</button> <button class="g" data-go="pin">Change PIN</button> <button class="g" data-go="out">Log out</button>`;
      else h+=crewHTML(); }
    h+=`<div style="margin-top:8px">${msg}</div></div>`; box.innerHTML=h; }
  function crewHTML(){ const c=crewCache; let h='';
    if(c===undefined||c==='loading') return '<p>Loading…</p>';
    if(c){ h+=`<h3 style="margin:6px 0">🏴 [${esc(c.tag)}] ${esc(c.name)}</h3><div class="m">${c.members.length} member${c.members.length>1?'s':''} · crew total ${(c.total||0).toLocaleString()} lifetime coins</div>${c.code?`<p>Invite code: <b style="font-size:20px;color:#fde68a;letter-spacing:.1em">${esc(c.code)}</b> — friends enter it in 👤 → Crew → Join.</p>`:''}`+
        c.members.map((m,i)=>`<div class="row"><span>${i+1}. ${esc(m.disp)}</span><b>${(m.life||0).toLocaleString()} 🪙 · 💪 ${(m.str||0).toLocaleString()}</b></div>`).join('')+`<p><button class="g" data-go="leave">Leave crew</button></p>`; }
    else h+=`<p>Team up! Crews add up every member's lifetime coins on the crew leaderboard.</p><div class="m">Crew name</div><input id="cN" maxlength="20"><div class="m">Tag (2–5 letters, shows next to your name)</div><input id="cT" maxlength="5" style="text-transform:uppercase"><button data-go="ccreate">Create crew</button>
      <h3 style="margin:14px 0 4px">Join with an invite code</h3><input id="cC" maxlength="6" style="text-transform:uppercase" placeholder="ABC123"><button data-go="cjoin">Join crew</button>`;
    h+=`<h3 style="margin:14px 0 4px">🏆 Top crews</h3>`+(topCache?topCache.map((r,i)=>`<div class="row"><span>${i+1}. [${esc(r.tag)}] ${esc(r.name)} · ${r.n} member${r.n>1?'s':''}</span><b>${(r.total||0).toLocaleString()} 🪙</b></div>`).join('')||'<p>No crews yet — be the first!</p>':'<p>Loading…</p>'); return h; }
  async function loadCrew(){ crewCache='loading'; renderBox(); const [a,b]=await Promise.all([api('crewInfo',{token:A.token}),api('crewTop',{token:A.token})]); crewCache=a.ok?a.crew:null; topCache=b.ok?b.rows:[]; if(A){ A.crew=crewCache?crewCache.tag:null; saveA(); } }
  const say=(t,ok)=>{ const keep={}; box.querySelectorAll('input').forEach(i=>keep[i.id]=i.value); msg=`<span class="${ok?'ok':'err'}">${t}</span>`; renderBox(); for(const id in keep){ const i=box.querySelector('#'+id); if(i) i.value=keep[id]; } };
  async function go(k){ const v=id=>{ const e=box.querySelector('#'+id); return e?e.value.trim():''; };
    if(k==='create'){ const n=v('aN'), p=v('aP'); if(n.length<2) return say('Pick a name (2+ letters)'); if(!/^\d{4,8}$/.test(p)) return say('PIN must be 4–8 numbers'); if(p!==v('aP2')) return say('The PINs don’t match');
      say('Creating…',true); const snap=JSON.stringify(collect()); const r=await api('create',{name:n,pin:p,data:snap,...meta()}); if(r.err==='taken') return say('That name is taken — if it’s yours, use “I already have one”'); if(!r.ok) return say('Couldn’t reach the server — try again');
      A={name:r.name,token:r.token,ver:r.ver,h:hash(snap)}; ls.set('rrName',r.name); saveA(); tab='acct'; lastSync=Date.now(); say('✓ Account made — your progress is saved!',true); toast('☁️ Account created'); }
    if(k==='login'){ const n=v('aN'), p=v('aP'); if(!n||!p) return say('Enter your name and PIN'); say('Logging in…',true); const r=await api('login',{name:n,pin:p});
      if(r.err==='nouser') return say('No account with that name'); if(r.err==='locked') return say(`Too many wrong PINs — try again in ${r.mins} min`); if(r.err==='pin') return say(`Wrong PIN (${r.left} tries left)`); if(!r.ok) return say('Couldn’t reach the server — try again');
      applyData(r.data); A={name:r.name,token:r.token,ver:r.ver,crew:r.crew,h:''}; A.h=hash(JSON.stringify(collect())); ls.set('rrName',r.name); saveA(); say('✓ Logged in — loading your progress…',true); setTimeout(()=>location.reload(),900); }
    if(k==='sync'){ await push(true); say('✓ Saved to your account',true); }
    if(k==='out'){ if(!confirm('Log out on this device? Your progress stays saved in your account.')) return; await push(true); api('logout',{token:A.token}); A=null; saveA(); msg=''; tab='new'; renderBox(); }
    if(k==='pin'){ const p=prompt('New PIN (4–8 numbers):'); if(!p) return; if(!/^\d{4,8}$/.test(p)) return say('PIN must be 4–8 numbers'); const r=await api('setpin',{token:A.token,pin:p}); say(r.ok?'✓ PIN changed':'Couldn’t change it',r.ok); }
    if(k==='ccreate'){ const r=await api('crewCreate',{token:A.token,name:v('cN'),tag:v('cT')}); if(r.err==='taken') return say('That tag is taken'); if(!r.ok) return say('Name 2+ letters, tag 2–5 letters'); crewCache=r.crew; A.crew=r.crew.tag; saveA(); say(`✓ Crew [${r.crew.tag}] created — share the invite code!`,true); loadCrew(); }
    if(k==='cjoin'){ const r=await api('crewJoin',{token:A.token,code:v('cC')}); if(r.err==='nocrew') return say('No crew with that code'); if(r.err==='full') return say('That crew is full (30)'); if(!r.ok) return say('Couldn’t join'); A.crew=r.crew.tag; saveA(); say(`✓ You joined [${r.crew.tag}]!`,true); loadCrew(); }
    if(k==='leave'){ if(!confirm('Leave your crew?')) return; await api('crewLeave',{token:A.token}); A.crew=null; saveA(); say('You left the crew',true); loadCrew(); } }
  function open(t){ css(); if(t) tab=t; msg=''; if(!box){ box=document.createElement('div'); box.id='rrAcct'; document.body.appendChild(box);
      box.addEventListener('click',e=>{ if(e.target===box||e.target.closest('[data-x]')){ box.remove(); box=null; return; } const tb=e.target.closest('[data-t]'); if(tb){ tab=tb.dataset.t; msg=''; if(tab==='crew'&&A) loadCrew(); renderBox(); return; } const g=e.target.closest('[data-go]'); if(g) go(g.dataset.go); });
      box.addEventListener('keydown',e=>e.stopPropagation()); }
    if(tab==='crew'&&A) loadCrew(); renderBox(); }
  function mount(){ if(document.getElementById('rrAcctB')) return; css(); pill=document.createElement('button'); pill.id='rrAcctB'; pill.title='Your account — progress on every device'; pill.onclick=()=>open(); document.body.appendChild(pill); render(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  window.RRACCT={ get name(){ return A&&A.name; }, get crew(){ return A&&A.crew; }, open, push:()=>push(true) };
})();
