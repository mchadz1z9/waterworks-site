/* Arcade Coins: the site-wide currency and shop (coins.js) */
(function(){ if(window.RRCOIN||document.getElementById('rrCoinJs')) return; const s=document.createElement('script'); s.id='rrCoinJs'; s.src='coins.js'; (document.head||document.documentElement).appendChild(s); })();
(function(){ if(window.RREMOTES||document.getElementById('rrEmoJs')) return; const s=document.createElement('script'); s.id='rrEmoJs'; s.src='emotes.js'; (document.head||document.documentElement).appendChild(s); })();
(function(){ if(window.RRVIDEO||document.getElementById('rrVcJs')) return; const s=document.createElement('script'); s.id='rrVcJs'; s.src='video.js'; (document.head||document.documentElement).appendChild(s); })();
(function(){ if(window.RRACCT||document.getElementById('rrAcctJs')) return; const s=document.createElement('script'); s.id='rrAcctJs'; s.src='acct.js'; (document.head||document.documentElement).appendChild(s); })();
/* Arcade Rivals: if a network (a school filter, say) blocks the game server's own address, switch every page to the site's
   backup route (/rr on this site). Switches back on its own once the direct address works again. */
(function(){ if(!/^https?:$/.test(location.protocol)) return; const D='https://rink-rivals-rooms.mitchellchad2026.workers.dev';
  let relay=false; try{ relay=localStorage.getItem('rrSrv')==='relay'; }catch(e){}
  const ping=(u,ms)=>new Promise(r=>{ let done=false; const c=window.AbortController?new AbortController():null, t=setTimeout(()=>{ if(c) c.abort(); if(!done){ done=true; r(false); } },ms);
    fetch(u,{cache:'no-store',signal:c?c.signal:undefined}).then(x=>{ clearTimeout(t); if(!done){ done=true; r(x.status<500); } }).catch(()=>{ clearTimeout(t); if(!done){ done=true; r(false); } }); });
  setTimeout(async()=>{ const direct=await ping(D+'/',6000);
    if(!relay&&!direct){ if(await ping(location.origin+'/rr/',6000)){ try{ localStorage.setItem('rrSrv','relay'); if(!sessionStorage.getItem('rrSw')){ sessionStorage.setItem('rrSw','1'); location.reload(); } }catch(e){} } }
    else if(relay&&direct){ try{ localStorage.setItem('rrSrv','direct'); }catch(e){} } },1200); })();
/* Arcade Rivals site config: a full-screen update announcement that everyone sees when they open the site,
   and admin player edits that the games pick up. All set from the /admin page. Read-only here. */
(function(){ if(window.RRSITE) return;
  const qs=new URLSearchParams(location.search);
  const SERVER=(qs.get('server')||((()=>{try{if(localStorage.getItem('rrSrv')==='relay')return location.origin.replace(/^http/,'ws')+'/rr'}catch(e){}return 'wss://rink-rivals-rooms.mitchellchad2026.workers.dev'})())).replace(/^ws/,'http');
  const OFF=/[?&]test\b/.test(location.search)||location.protocol==='file:';
  const PAGE=window.RR_ADMIN?'admin':(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  /* overrides are cached so the games (which build rosters synchronously on load) can read them without waiting */
  function cacheOv(ov){ try{ ls.set('rrServerOv',JSON.stringify(Array.isArray(ov)?ov:[])); }catch(e){} }

  const THEMES={blue:['#1e3a8a','#0ea5e9'],green:['#065f46','#22c55e'],purple:['#4c1d95','#a855f7'],red:['#7f1d1d','#ef4444'],orange:['#7c2d12','#f59e0b'],pink:['#831843','#ec4899'],teal:['#134e4a','#14b8a6'],gold:['#78350f','#fbbf24']};
  const TK=Object.keys(THEMES);
  function hashStr(x){ let h=0; for(let i=0;i<x.length;i++){ h=(h*31+x.charCodeAt(i))>>>0; } return h; }
  function pickIcon(ann){ if(ann.icon) return ann.icon; const t=((ann.title||'')+' '+(ann.body||'')).toLowerCase();
    const map=[['blackjack','🃏'],['card','🃏'],['poker','🃏'],['trade','🔁'],['player','🏅'],['football','🏈'],['hockey','🏒'],['soccer','⚽'],['basketball','🏀'],['race','🏁'],['online','🌐'],['chat','💬'],['fix','🛠️'],['new','✨'],['win','🏆'],['update','📣']];
    for(const [k,e] of map) if(t.includes(k)) return e; return '📣'; }
  function cover(ann){ const th=THEMES[ann.theme]||THEMES[TK[hashStr(ann.title||ann.id||'x')%TK.length]]; return {grad:`linear-gradient(135deg,${th[0]},${th[1]})`,icon:pickIcon(ann)}; }
  function showAnn(ann){ if(!ann||(!ann.title&&!ann.body)) return; if(PAGE==='admin') return;
    if(ls.get('rrAnnSeen')===ann.id) return; if(document.getElementById('rrAnn')) return;
    const d=document.createElement('div'); d.id='rrAnn'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    const cv=cover(ann);
    d.innerHTML=`<div class="rra-card"><button class="rra-x" aria-label="Close">×</button>
      <div class="rra-cover" style="background:${cv.grad}"><span class="rra-ico">${esc(cv.icon)}</span><span class="rra-tag">Arcade Rivals update</span></div>
      ${ann.title?`<h2>${esc(ann.title)}</h2>`:''}<div class="rra-body">${esc(ann.body||'').replace(/\n/g,'<br>')}</div>
      <button class="rra-go">${esc(ann.btn||"Let's play ▸")}</button></div>`;
    const close=()=>{ ls.set('rrAnnSeen',ann.id); d.remove(); };
    const go=()=>{ if(ann.link){ try{ window.open(ann.link,'_blank','noopener'); }catch(e){} } close(); };
    d.querySelector('.rra-x').onclick=close; d.querySelector('.rra-go').onclick=go;
    d.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    (document.body||document.documentElement).appendChild(d); setTimeout(()=>{ const g=d.querySelector('.rra-go'); g&&g.focus(); },30);
  }

  /* a slim dismissible banner across the top of every page, set from /admin */
  function showBanner(s){ if(PAGE==='admin') return; const ex=document.getElementById('rrBanner'); if(ex) ex.remove();
    const off=()=>{ try{ document.body.classList.remove('rrHasBanner'); }catch(e){} };
    if(!s||!s.bannerOn||!s.banner||!s.banner.text){ off(); return; } const bid=s.bannerId||'b'; if(ls.get('rrBannerSeen')===bid){ off(); return; }
    const th=THEMES[s.banner.theme]||THEMES.blue; const d=document.createElement('div'); d.id='rrBanner';
    d.style.background=`linear-gradient(90deg,${th[0]},${th[1]})`;
    d.innerHTML=`<span>${esc(s.banner.text)}</span><button aria-label="Dismiss">×</button>`;
    d.querySelector('button').onclick=()=>{ ls.set('rrBannerSeen',bid); d.remove(); off(); };
    (document.body||document.documentElement).appendChild(d); try{ document.body.classList.add('rrHasBanner'); }catch(e){} }
  /* ---------- tournaments ---------- */
  function pid(){ let p=ls.get('rrPid'); if(!p||p.length<8){ p=Array.from({length:12},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); ls.set('rrPid',p); } return p; }
  function joinedIds(){ try{ return JSON.parse(ls.get('rrTourJoined')||'[]'); }catch(e){ return []; } }
  function setJoined(ids){ ls.set('rrTourJoined',JSON.stringify(ids.slice(-50))); }
  function fmtTime(s){ if(!s) return ''; const d=new Date(s); if(isNaN(d.getTime())) return s; try{ return d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return s; } }
  /* repeating tournaments (daily, weekdays, weekends, weekly): show the next edition, each with its own sign-up list */
  function edition(t){ if(!t||!t.rep) return t; const base=new Date(t.time); if(isNaN(base.getTime())) return t; const now=new Date(); for(let k=-1;k<9;k++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+k,base.getHours(),base.getMinutes()); if(d.getTime()<now.getTime()-2*3600000) continue; const wd=d.getDay();
      if(t.rep==='weekdays'&&(wd===0||wd===6)) continue; if(t.rep==='weekends'&&wd>0&&wd<6) continue; if(t.rep==='weekly'&&wd!==base.getDay()) continue; if(d.getTime()<base.getTime()-60000) continue;
      const occ=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; return {...t,id:t.id+'_'+occ,baseId:t.id,occ,time:d.toISOString(),joins:(t.joins||[]).filter(j=>j.occ===occ)}; } return t; }
  const REPN={daily:'every day',weekdays:'every weekday',weekends:'weekends',weekly:'every week'};
  function pickTourney(list){ list=list.map(edition); if(!list.length) return null; const now=Date.now();
    const up=list.filter(t=>{ const d=Date.parse(t.time); return isFinite(d)&&d>now-3*3600000; }).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
    return up[0]||list.slice().sort((a,b)=>b.ts-a.ts)[0]; }
  let curTour=null, tourList=[];
  function showTourney(list){ if(PAGE==='admin') return; list=Array.isArray(list)?list:[];
    tourList=list.map(edition).filter(t=>{ const d=Date.parse(t.time); return !isFinite(d)||d>Date.now()-3*3600000; }).sort((a,b)=>(Date.parse(a.time)||9e15)-(Date.parse(b.time)||9e15)); const t=pickTourney(list); curTour=t; const ex=document.getElementById('rrTourBtn');
    if(!t){ if(ex) ex.remove(); const p=document.getElementById('rrTour'); if(p) p.remove(); return; }
    let b=ex; if(!b){ b=document.createElement('button'); b.id='rrTourBtn'; b.type='button'; b.onclick=()=>openTour(curTour); (document.body||document.documentElement).appendChild(b); }
    b.innerHTML=`🏆 Tournament${joinedIds().includes(t.id)?' ✓':''}`;
    if(ls.get('rrTourSeen')!==t.id && !document.getElementById('rrTour') && !document.getElementById('rrAnn')) openTour(t,true); }
  function openTour(t,auto){ if(!t) return; const old=document.getElementById('rrTour'); if(old) old.remove(); if(auto) ls.set('rrTourSeen',t.id);
    const joined=joinedIds().includes(t.id), n=(t.joins&&t.joins.length)||0, when=fmtTime(t.time);
    const d=document.createElement('div'); d.id='rrTour'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    d.innerHTML=`<div class="rra-card"><button class="rra-x" aria-label="Close">×</button>
      <div class="rra-cover" style="background:linear-gradient(135deg,#78350f,#fbbf24)"><span class="rra-ico">🏆</span><span class="rra-tag">Arcade Rivals tournament</span></div>
      <h2>${esc(t.name)}</h2>
      <div class="rra-meta">${t.game?`<span>🎮 ${esc(t.game)}</span>`:''}${when?`<span>🗓️ ${esc(when)}</span>`:''}${t.rep?`<span>🔁 ${REPN[t.rep]}</span>`:''}<span class="rra-cnt">👥 ${n} joined</span></div>
      ${t.desc?`<div class="rra-body">${esc(t.desc).replace(/\n/g,'<br>')}</div>`:''}
      <div class="rra-btns"><button class="rra-join${joined?' on':''}">${joined?"✓ You're in — tap to leave":'Join tournament'}</button>${t.page?`<a class="rra-go2" href="${esc(t.page)}">Go to game ▸</a>`:''}</div>${tourList.length>1?`<div style="margin-top:12px;font-size:13px;opacity:.85">More tournaments:</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${tourList.filter(x=>x.id!==t.id).slice(0,8).map(x=>`<button class="rra-oth" data-tid="${esc(x.id)}" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:999px;padding:6px 12px;cursor:pointer;font-weight:700">🏆 ${esc(x.name)} · ${esc(fmtTime(x.time))}</button>`).join('')}</div>`:''}</div>`;
    const close=()=>d.remove(); d.querySelector('.rra-x').onclick=close; d.addEventListener('click',e=>{ if(e.target===d) close(); });
    d.querySelectorAll('.rra-oth').forEach(b=>b.onclick=()=>openTour(tourList.find(x=>x.id===b.dataset.tid))); const jb=d.querySelector('.rra-join'); jb.onclick=()=>{ joinedIds().includes(t.id)?leaveTour(t,jb,d):joinTour(t,jb,d); };
    (document.body||document.documentElement).appendChild(d); }
  function joinTour(t,btn,d){ let name=ls.get('rrOnlineName'); if(!name){ name=prompt('Your name for the tournament:',''); if(name==null) return; name=String(name).replace(/[<>]/g,'').trim().slice(0,20); if(!name) return; ls.set('rrOnlineName',name); }
    btn.disabled=true; btn.textContent='Joining…';
    fetch(SERVER+'/tourney',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'join',id:t.baseId||t.id,occ:t.occ||'',name,pid:pid()})}).then(r=>r.json()).then(r=>{ const ids=joinedIds(); if(!ids.includes(t.id)){ ids.push(t.id); if(window.RRCOIN) RRCOIN.add(50,'joined a tournament 🏆',false,true); } setJoined(ids);
      btn.disabled=false; btn.classList.add('on'); btn.textContent="✓ You're in — tap to leave"; if(r&&r.joined!=null){ const c=d.querySelector('.rra-cnt'); if(c) c.textContent=`👥 ${r.joined} joined`; } const bb=document.getElementById('rrTourBtn'); if(bb) bb.innerHTML='🏆 Tournament ✓'; }).catch(()=>{ btn.disabled=false; btn.textContent='Join tournament'; }); }
  function leaveTour(t,btn,d){ btn.disabled=true; btn.textContent='Leaving…';
    fetch(SERVER+'/tourney',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'leave',id:t.baseId||t.id,occ:t.occ||'',pid:pid()})}).then(()=>{ setJoined(joinedIds().filter(x=>x!==t.id)); btn.disabled=false; btn.classList.remove('on'); btn.textContent='Join tournament'; const bb=document.getElementById('rrTourBtn'); if(bb) bb.innerHTML='🏆 Tournament'; }).catch(()=>{ btn.disabled=false; btn.textContent="✓ You're in — tap to leave"; }); }

  /* ---------- graphics: a colour grade and vignette over every 3D game, with a High / Low switch ---------- */
  const GFX=()=>{ const g=ls.get('rrGfx'); return g==='low'||g==='ultra'?g:'high'; };
  if(GFX()==='low'){ try{ Object.defineProperty(window,'devicePixelRatio',{get:()=>1,configurable:true}); }catch(e){} }
  function gfxApply(){ const gl=document.getElementById('gl'); if(!gl) return; const hi=GFX()!=='low';
    gl.style.filter=hi?(GFX()==='ultra'?'saturate(1.12) contrast(1.04)':'saturate(1.18) contrast(1.07) brightness(1.03)'):''; let v=document.getElementById('rrVig');
    if(hi&&!v&&gl.parentNode){ v=document.createElement('div'); v.id='rrVig'; v.style.cssText='position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.34) 100%);border-radius:inherit'; gl.insertAdjacentElement('afterend',v); }
    if(!hi&&v) v.remove();
    const tools=document.querySelector('.tools'); if(tools&&!document.getElementById('rrGfxBtn')){ const b=document.createElement('button'); b.id='rrGfxBtn'; b.title='Graphics quality: Low (fastest) → High → Ultra 4K (sharpest, needs a strong computer)'; tools.appendChild(b); b.onclick=()=>{ ls.set('rrGfx',{low:'high',high:'ultra',ultra:'low'}[GFX()]); location.reload(); }; }
    const b=document.getElementById('rrGfxBtn'); if(b) b.textContent=GFX()==='ultra'?'💎 Graphics: Ultra 4K':hi?'✨ Graphics: High':'⚡ Graphics: Low'; }
  if(PAGE!=='admin'){ if(document.readyState==='loading') addEventListener('DOMContentLoaded',gfxApply); else gfxApply(); }
  /* ---------- admin controls that reach every page ---------- */
  const admDev=()=>!!ls.get('rrAdmUrl');
  function cover2(id,html){ let o=document.getElementById(id); if(!html){ if(o) o.remove(); return; } if(!document.body) return void addEventListener('DOMContentLoaded',()=>cover2(id,html)); if(!o){ o=document.createElement('div'); o.id=id; o.style.cssText='position:fixed;inset:0;z-index:'+(id==='rrBan'?2147483640:2147483600)+';display:flex;align-items:center;justify-content:center;padding:20px;background:#05080f;color:#f8fafc;font:600 18px system-ui,sans-serif;text-align:center'; document.body.appendChild(o); } o.innerHTML=html; }
  function gate(set){ set=set||{}; try{ ls.set('rrSiteGate',JSON.stringify({maint:set.maint,maintMsg:set.maintMsg,off:set.off,hidden:set.hidden,events:set.events})); ls.set('rrSiteEvents',JSON.stringify(set.events||{})); }catch(e){}
    if(PAGE==='admin') return; const adm=admDev();
    cover2('rrMaint',set.maint&&!adm?`<div><div style="font-size:64px">🛠️</div><h2 style="margin:8px 0">Arcade Rivals is down for maintenance</h2><p style="color:#cbd5e1;max-width:520px">${esc(set.maintMsg||'We\'re making some changes. Check back soon!')}</p></div>`:'');
    const off=(set.off||[]).includes(PAGE); cover2('rrOff',off&&!adm?`<div><div style="font-size:64px">⛔</div><h2 style="margin:8px 0">This game is switched off for now</h2><p style="color:#cbd5e1">An admin has turned it off for a while. Try another game!</p><a href="./" style="display:inline-block;margin-top:10px;background:#fbbf24;color:#0a0d18;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:800">🏠 Home</a></div>`:'');
    if(PAGE===''||PAGE==='index'){ const hide=set.hidden||[], offs=set.off||[], run=()=>document.querySelectorAll('a.card').forEach(a=>{ const g=(a.getAttribute('href')||'').replace(/\.html$/,'').replace(/^\.?\//,''); a.style.display=hide.includes(g)&&!adm?'none':''; a.style.opacity=offs.includes(g)?'.45':''; a.title=offs.includes(g)?'Switched off by an admin':''; }); if(document.readyState==='loading') addEventListener('DOMContentLoaded',run); else run(); } }
  try{ gate(JSON.parse(ls.get('rrSiteGate')||'null')); }catch(e){}
  function banScreen(b){ if(b&&b.proxy){ cover2('rrBan',`<div><div style="font-size:64px">🛡️</div><h2 style="margin:8px 0">Turn off your proxy or VPN</h2><p style="color:#fde68a">${esc(b.reason||'')}</p><button onclick="location.reload()" style="font:800 16px system-ui;border:0;border-radius:12px;padding:12px 22px;background:#22c55e;color:#052e16;cursor:pointer;margin-top:8px">I turned it off — reload</button></div>`); return; }
  cover2('rrBan',b?`<div><div style="font-size:64px">🚫</div><h2 style="margin:8px 0">${b.invite?'Invite only right now 🔒':'You\'ve been banned from Arcade Rivals'}</h2>${b.reason?`<p style="color:#fca5a5">Reason: ${esc(b.reason)}</p>`:''}<p style="color:#cbd5e1">${b.until?'The ban ends '+new Date(b.until).toLocaleString():'This ban does not expire.'}</p></div>`:''); try{ b?ls.set('rrBanned',JSON.stringify(b)):localStorage.removeItem('rrBanned'); }catch(e){} }
  try{ const b=JSON.parse(ls.get('rrBanned')||'null'); if(b&&(!b.until||b.until>Date.now())&&PAGE!=='admin') banScreen(b); }catch(e){}
  function popup(title,text){ if(!document.body) return void addEventListener('DOMContentLoaded',()=>popup(title,text)); const o=document.createElement('div'); o.style.cssText='position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.6);font:600 17px system-ui,sans-serif';
    o.innerHTML=`<div style="max-width:440px;width:100%;background:#0f172a;color:#f8fafc;border:2px solid #fbbf24;border-radius:18px;padding:20px 22px;text-align:center"><div style="font-size:40px">📨</div><h3 style="margin:6px 0 8px;font-size:22px">${esc(title)}</h3><p style="color:#e2e8f0;white-space:pre-wrap">${esc(text)}</p><button style="margin-top:10px;font:800 16px system-ui;background:#fbbf24;border:0;border-radius:999px;padding:9px 22px;cursor:pointer">OK</button></div>`;
    o.querySelector('button').onclick=()=>o.remove(); document.body.appendChild(o); }
  function runCmds(cmds){ for(const c of cmds||[]){ const d=c.data||{};
      if(c.kind==='msg') popup(d.title||'Message from the admin',d.text||'');
      if(c.kind==='reload') setTimeout(()=>location.reload(),300);
      if(c.kind==='kick'){ popup('Kicked',d.text||'You were kicked by an admin.'); setTimeout(()=>{ location.href='./'; },2500); }
      if(c.kind==='rename'&&d.name&&d.why==='generic'){ if(!document.getElementById('rrNm')){ popup('Pick a real name ✏️','Everyone needs a real name to play on Arcade Rivals — +d.name+ is just a placeholder. Pick one now!'); setTimeout(()=>location.reload(),2500); } continue; }
      if(c.kind==='rename'&&d.name){ ls.set('rrOnlineName',d.name); popup(d.why==='reserved'||d.why==='taken'?'That name is taken':d.why==='locked'?'Name change needs approval':d.why==='approved'?'Name change approved ✅':'Your name was changed',d.why==='reserved'||d.why==='taken'?`"${d.was||'That name'}" already belongs to someone else, so for now you're "${d.name}". Pick a different name!`:d.why==='locked'?`Names are locked right now. You're still "${d.name}" — an admin has to approve "${d.was}".`:d.why==='approved'?`You're now "${d.name}".`:`An admin changed your name to "${d.name}".`); if(/^Player\d+$/.test(d.name)) setTimeout(()=>location.reload(),2500); }
      if(c.kind==='goto'&&d.page) setTimeout(()=>{ location.href=d.page==='home'?'./':d.page; },400);
      const city=o=>{ if(PAGE==='city') dispatchEvent(new CustomEvent('rr-gift',{detail:o})); else { try{ const sv=JSON.parse(ls.get('rrCity')||'{}'); if(o.setcash!=null) sv.money=o.setcash; if(o.car){ sv.cars=sv.cars||['hatch']; if(!sv.cars.includes(o.car)) sv.cars.push(o.car); } if(o.gun){ sv.guns=sv.guns||{}; sv.guns[o.gun]=(sv.guns[o.gun]||0)+60; } if(o.reset){ localStorage.removeItem('rrCity'); return; } ls.set('rrCity',JSON.stringify(sv)); }catch(e){} } };
      if(c.kind==='setcash'){ city({setcash:+d.n||0}); popup('💵 Rival City cash set',`An admin set your Rival City money to $${(+d.n||0).toLocaleString()}.`); }
      if(c.kind==='givecar'&&d.model){ city({car:d.model}); popup('🚗 Gift from the admin','A new car is waiting in your Rival City garage!'); }
      if(c.kind==='givegun'&&d.gun){ city({gun:d.gun}); popup('🔫 Gift from the admin',`You got a ${d.gun} (with ammo) in Rival City.`); }
      if(c.kind==='resetcity'){ city({reset:true}); popup('Rival City reset','An admin reset your Rival City progress.'); if(PAGE==='city') setTimeout(()=>location.reload(),1500); }
      if(c.kind==='setstr'&&window.RRSTR){ RRSTR.set(+d.n||0); popup('💪 Strength set',`An admin set your strength to ${+d.n||0}.`); }
      if(c.kind==='freeze'){ cover2('rrFreeze',`<div><div style="font-size:70px">🧊</div><h2>You've been frozen by an admin</h2><p style="color:#bae6fd">${esc(d.text||'Take a short break…')}</p></div>`); setTimeout(()=>cover2('rrFreeze',''),(d.secs||10)*1000); }
      if(c.kind==='flip'){ document.documentElement.style.transition='transform .6s'; document.documentElement.style.transform='rotate(180deg)'; setTimeout(()=>{ document.documentElement.style.transform=''; },(d.secs||10)*1000); }
      if(c.kind==='confetti') fx('confetti',5000);
      if(['shake','invert','mirror','rainbow','spin','blur','comic','tiny','disco','upside'].includes(c.kind)) troll(c.kind,d.secs||10);
      if(c.kind==='emoji') fx('e:'+(d.e||'🎉'),(d.secs||10)*1000);
      if(c.kind==='airhorn') airhorn();
      if(c.kind==='say'&&d.text){ try{ const u=new SpeechSynthesisUtterance(d.text); u.rate=1; speechSynthesis.speak(u); }catch(e){} popup('🔊 The admin says',d.text); }
      if(c.kind==='award'&&d.text){ fx('confetti',6000); popup('🏆 You got an award!',d.text); }
      if(c.kind==='ask'&&d.text) askPop(d.text);
      if(c.kind==='sagift'&&d.what==='puck'){ const n=+d.n||0; try{ if(PAGE==='sa-puckclicker'&&typeof window.eval('typeof S')==='string'&&window.eval('typeof S')==='object'){ window.eval('S.cur[S.lv]+='+n+';S.life[S.lv]+='+n+';try{localStorage.pk1=JSON.stringify(S)}catch(e){}'); } else { const j=JSON.parse(localStorage.getItem('pk1')||'null'); if(j&&j.cur){ j.cur[j.lv||0]=(j.cur[j.lv||0]||0)+n; j.life[j.lv||0]=(j.life[j.lv||0]||0)+n; localStorage.setItem('pk1',JSON.stringify(j)); } else ls.set('saPuckGift',String((+ls.get('saPuckGift')||0)+n)); } }catch(e){} fx('confetti',3500); popup('🎁 Sports Arcade gift',`You got ${n.toLocaleString()} Puck Clicker points!`); }
      if(c.kind==='heal'){ city({heal:true}); popup('❤️ Healed','An admin healed you to full health in Rival City.'); }
      if(c.kind==='wanted'){ city({wanted:+d.n||0}); popup('🚨 Wanted level',`An admin set your Rival City wanted level to ${+d.n||0} star${+d.n===1?'':'s'}.`); }
      if(c.kind==='gift'){ const n=+d.n||0; if(d.what==='str'&&window.RRSTR){ RRSTR.add(Math.min(100,n)); popup('🎁 Gift from the admin',`+${n} strength${d.note?'\n'+d.note:''}`); }
        if(d.what==='cash'){ if(PAGE==='city') dispatchEvent(new CustomEvent('rr-gift',{detail:{cash:n}})); else { try{ const sv=JSON.parse(ls.get('rrCity')||'{}'); sv.money=(sv.money||2500)+n; ls.set('rrCity',JSON.stringify(sv)); }catch(e){} } popup('🎁 Gift from the admin',`+$${n.toLocaleString()} in Rival City${d.note?'\n'+d.note:''}`); } } } }
  /* admin fun effects */
  function troll(kind,secs){ if(!document.body) return void addEventListener('DOMContentLoaded',()=>troll(kind,secs)); let st=document.getElementById('rrTrollCss'); if(!st){ st=document.createElement('style'); st.id='rrTrollCss'; st.textContent='@keyframes rrShk{0%,100%{transform:translate(0,0)}25%{transform:translate(-9px,5px) rotate(-1deg)}50%{transform:translate(8px,-6px) rotate(1deg)}75%{transform:translate(-5px,-4px)}}@keyframes rrSpn{to{transform:rotate(360deg)}}@keyframes rrHue{to{filter:hue-rotate(360deg) saturate(2)}}@keyframes rrDsc{0%{background:#f0f}25%{background:#0ff}50%{background:#ff0}75%{background:#0f0}}html.rr-shake body{animation:rrShk .25s infinite}html.rr-invert{filter:invert(1) hue-rotate(180deg)}html.rr-mirror body{transform:scaleX(-1)}html.rr-rainbow body{animation:rrHue 2s linear infinite}html.rr-spin body{animation:rrSpn 3s linear infinite}html.rr-blur body{filter:blur(4px)}html.rr-comic *{font-family:"Comic Sans MS","Comic Sans",cursive!important}html.rr-tiny body{transform:scale(.5);transform-origin:50% 0}html.rr-upside body{transform:scaleY(-1)}html.rr-disco body::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.28;z-index:2147483600;animation:rrDsc .5s steps(1) infinite}'; document.head.appendChild(st); }
    const cl='rr-'+kind; document.documentElement.classList.add(cl); clearTimeout(troll['t'+kind]); troll['t'+kind]=setTimeout(()=>document.documentElement.classList.remove(cl),secs*1000); }
  function airhorn(){ try{ const A=new (window.AudioContext||window.webkitAudioContext)(), g=A.createGain(); g.gain.value=.25; g.connect(A.destination); for(const [t,len] of [[0,.25],[.32,.25],[.64,.9]]) for(const f of [440,554,660]){ const o=A.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.connect(g); o.start(A.currentTime+t); o.stop(A.currentTime+t+len); } setTimeout(()=>A.close(),2500); }catch(e){} }
  function askPop(q){ if(!document.body) return void addEventListener('DOMContentLoaded',()=>askPop(q)); const o=document.createElement('div'); o.style.cssText='position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.7);padding:16px;font-family:system-ui,sans-serif';
    o.innerHTML=`<div style="max-width:440px;width:100%;background:#0f172a;color:#f8fafc;border:2px solid #60a5fa;border-radius:18px;padding:20px 22px;text-align:center"><div style="font-size:40px">❓</div><h3 style="margin:6px 0 8px;font-size:20px">The admin asks:</h3><p style="font-size:17px;margin:0 0 12px">${esc(q)}</p><input maxlength="500" placeholder="Your answer" style="width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid #334155;background:#020617;color:#fff"><div style="display:flex;gap:8px;justify-content:center;margin-top:12px"><button data-s style="font:700 15px system-ui;border:0;border-radius:10px;padding:10px 20px;background:#22c55e;color:#052e16;cursor:pointer">Send answer</button><button data-x style="font:700 15px system-ui;border:0;border-radius:10px;padding:10px 20px;background:#334155;color:#fff;cursor:pointer">Skip</button></div></div>`;
    const inp=o.querySelector('input'), go=()=>{ const a=inp.value.trim(); if(a){ try{ const q2=JSON.parse(ls.get('rrAns')||'[]'); q2.push({q,a}); ls.set('rrAns',JSON.stringify(q2.slice(-5))); }catch(e){} setTimeout(beat,200); } o.remove(); };
    o.querySelector('[data-s]').onclick=go; inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') go(); }; o.querySelector('[data-x]').onclick=()=>o.remove(); document.body.appendChild(o); setTimeout(()=>inp.focus(),50); }
  /* falling effects (snow, confetti, hearts…) drawn on a see-through layer */
  let fxRun=null; function fx(kind,ms){ if(fxRun){ fxRun.stop(); fxRun=null; } if(!kind) return; if(!document.body) return void addEventListener('DOMContentLoaded',()=>fx(kind,ms));
    const cv=document.createElement('canvas'); cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000'; document.body.appendChild(cv); const c=cv.getContext('2d'); let W=0,H=0; const rs=()=>{ W=cv.width=innerWidth; H=cv.height=innerHeight; }; rs(); addEventListener('resize',rs);
    const EM={snow:['❄','❅','•'],hearts:['❤️','💖','💕'],leaves:['🍁','🍂','🍃'],stars:['⭐','✨','🌟']}; if(String(kind).startsWith('e:')) EM[kind]=[...kind.slice(2)]; const n=kind==='confetti'?160:60, P=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*-H,v:.5+Math.random()*1.5,s:kind==='snow'?8+Math.random()*10:14+Math.random()*12,r:Math.random()*6,c:`hsl(${Math.random()*360},90%,60%)`,e:(EM[kind]||['•'])[Math.floor(Math.random()*3)]}));
    let on=true, t0=performance.now(); const step=t=>{ if(!on) return; c.clearRect(0,0,W,H); for(const p of P){ p.y+=p.v*(kind==='confetti'?3:1.4); p.x+=Math.sin((t/1000)+p.r)*.6; p.r+=.03; if(p.y>H+20){ p.y=-20; p.x=Math.random()*W; }
        if(kind==='confetti'){ c.save(); c.translate(p.x,p.y); c.rotate(p.r); c.fillStyle=p.c; c.fillRect(-4,-2,8,4); c.restore(); } else { c.globalAlpha=kind==='snow'?.85:.8; c.font=p.s+'px sans-serif'; c.fillStyle='#fff'; c.fillText(p.e,p.x,p.y); c.globalAlpha=1; } }
      if(ms&&t-t0>ms){ fxRun&&fxRun.stop(); fxRun=null; if(fxKind) fx(fxKind); return; } requestAnimationFrame(step); }; requestAnimationFrame(step); fxRun={stop:()=>{ on=false; cv.remove(); }}; }
  /* countdown to an event, shown as a slim bar on every page */
  let cdT=null; function countdown(cd){ clearInterval(cdT); const el0=document.getElementById('rrCount'); if(!cd){ if(el0) el0.remove(); return; } if(!document.body) return void addEventListener('DOMContentLoaded',()=>countdown(cd));
    let el=el0; if(!el){ el=document.createElement('a'); el.id='rrCount'; el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:8px;z-index:2147482000;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font:800 14px system-ui,sans-serif;padding:7px 16px;border-radius:999px;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.35);white-space:nowrap'; document.body.appendChild(el); }
    if(cd.page) el.href=cd.page; const tick=()=>{ const ms=cd.at-Date.now(); if(ms<-3600000){ el.remove(); clearInterval(cdT); return; } if(ms<=0){ el.textContent=`🔴 LIVE NOW: ${cd.title}${cd.page?' — join!':''}`; return; } const h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60, s=Math.floor(ms/1000)%60; el.textContent=`⏳ ${cd.title} — ${h?h+'h ':''}${m}m ${String(s).padStart(2,'0')}s`; }; tick(); cdT=setInterval(tick,1000); }
  function home(set){ if(!(PAGE===''||PAGE==='index')) return; const run=()=>{ let m=document.getElementById('rrMotd'); if(set.motd){ if(!m){ m=document.createElement('div'); m.id='rrMotd'; m.style.cssText='max-width:1100px;margin:10px auto;padding:12px 16px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font:700 16px system-ui,sans-serif;text-align:center'; document.body.insertBefore(m,document.body.firstChild.nextSibling); } m.textContent='📣 '+set.motd; } else if(m) m.remove();
      document.querySelectorAll('a.card').forEach(a=>{ const g=(a.getAttribute('href')||'').replace(/\.html$/,'').replace(/^\.?\//,''); const f=set.featured&&g===set.featured; a.style.outline=f?'3px solid #fbbf24':''; a.style.boxShadow=f?'0 0 26px rgba(251,191,36,.55)':''; if(f&&!a.querySelector('.rrFeat')){ const b=document.createElement('em'); b.className='rrFeat'; b.textContent='⭐ FEATURED'; b.style.cssText='position:absolute;top:8px;left:8px;background:#fbbf24;color:#111;font:800 11px system-ui;padding:2px 8px;border-radius:999px;font-style:normal;z-index:2'; a.appendChild(b); a.parentNode.insertBefore(a,a.parentNode.firstChild); } if(!f){ const b=a.querySelector('.rrFeat'); if(b) b.remove(); } }); };
    if(document.readyState==='loading') addEventListener('DOMContentLoaded',run); else run(); }
  function pollPop(p){ if(!p||PAGE==='admin') return; if(ls.get('rrPollDone')===p.id) return; if(!document.body) return void addEventListener('DOMContentLoaded',()=>pollPop(p)); if(document.getElementById('rrPoll')) return;
    const o=document.createElement('div'); o.id='rrPoll'; o.style.cssText='position:fixed;right:14px;bottom:70px;z-index:2147482500;max-width:320px;background:#0f172a;color:#f8fafc;border:2px solid #a855f7;border-radius:16px;padding:14px;font:600 15px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)';
    o.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px"><b>🗳️ ${esc(p.q)}</b><button data-x style="background:none;border:0;color:#94a3b8;font-size:18px;cursor:pointer">✕</button></div>${p.opts.map((t,i)=>`<button data-v="${i}" style="display:block;width:100%;margin-top:6px;text-align:left;font:700 14px system-ui;background:#1e293b;color:#fff;border:1px solid #334155;border-radius:10px;padding:8px 10px;cursor:pointer">${esc(t)}</button>`).join('')}`;
    o.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.x!=null){ ls.set('rrPollDone',p.id); o.remove(); return; } fetch(SERVER+'/vote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:p.id,opt:+b.dataset.v,pid:pid()})}).catch(()=>{}); ls.set('rrPollDone',p.id); o.innerHTML='<b>🗳️ Thanks for voting!</b>'; setTimeout(()=>o.remove(),1800); }; document.body.appendChild(o); }
  let fxKind=null;
  function apply(st){ if(!st) return; gate(st.settings||{}); try{ const pn=(st.settings||{}).pin||''; if(pn!==ls.get('rrPin')){ ls.set('rrPin',pn); } dispatchEvent(new CustomEvent('rr-pin',{detail:pn})); }catch(e){} { const s2=st.settings||{}; if(PAGE!=='admin'){ if((s2.effect||'')!==fxKind){ fxKind=s2.effect||''; fx(fxKind); } countdown(s2.countdown||null); home(s2); pollPop(st.poll); } } if('ov' in st) cacheOv(st.ov); try{ ls.set('rrSiteAt',String(Date.now())); }catch(e){} if(st.ann) showAnn(st.ann); if(st.settings) showBanner(st.settings); showTourney(st.tourneys||[]); }

  const css=document.createElement('style'); css.textContent=`#rrAnn,#rrTour{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,6,14,.82);backdrop-filter:blur(3px);font-family:'DM Sans',system-ui,sans-serif;animation:rraIn .25s ease}
@keyframes rraIn{from{opacity:0}to{opacity:1}}
.rra-card{position:relative;width:min(640px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(160deg,#182446,#0c1227);color:#eef2fb;border:2px solid #3b4e86;border-radius:22px;padding:0 30px 26px;box-shadow:0 30px 90px rgba(0,0,0,.65);text-align:center}
.rra-cover{margin:0 -30px 14px;padding:26px 20px 18px;border-radius:20px 20px 24px 24px;position:relative;overflow:hidden;box-shadow:inset 0 -30px 50px rgba(0,0,0,.25)}
.rra-cover::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 85% -10%,rgba(255,255,255,.35),transparent 55%)}
.rra-ico{display:block;font-size:66px;line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));position:relative}
.rra-tag{display:block;margin-top:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;font-size:14px;position:relative;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.rra-card h2{margin:4px 0 12px;font-size:34px;line-height:1.1}
.rra-body{font-size:19px;line-height:1.5;color:#cdd6ec;white-space:pre-wrap;word-wrap:break-word}
.rra-go{margin-top:22px;font:800 19px 'DM Sans',system-ui,sans-serif;border:0;border-radius:14px;padding:13px 30px;background:#22c55e;color:#052e16;cursor:pointer}
.rra-go:hover{background:#16a34a}
.rra-x{position:absolute;z-index:3;top:12px;right:14px;width:40px;height:40px;border-radius:12px;border:0;background:rgba(0,0,0,.25);color:#fff;font-size:26px;line-height:1;cursor:pointer}
.rra-x:hover{background:rgba(255,255,255,.22)}
@media(max-width:560px){.rra-card h2{font-size:26px}.rra-body{font-size:17px}}
#rrBanner{position:fixed;top:0;left:0;right:0;z-index:99998;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 44px 8px 16px;color:#fff;font:700 15px 'DM Sans',system-ui,sans-serif;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.35)}
#rrBanner span{word-break:break-word}
#rrBanner button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:8px;background:rgba(0,0,0,.25);color:#fff;font-size:18px;line-height:1;cursor:pointer}
#rrTourBtn{position:fixed;top:12px;right:16px;z-index:99990;border:0;border-radius:999px;padding:9px 15px;font:800 14px 'DM Sans',system-ui,sans-serif;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#3a2206;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4)}
#rrTourBtn:hover{filter:brightness(1.07)}
body.rrHasBanner #rrTourBtn{top:48px}
.rra-meta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:2px 0 10px;color:#e8c98a;font-weight:700;font-size:15px}
.rra-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.rra-join{font:800 18px 'DM Sans',system-ui,sans-serif;border:0;border-radius:14px;padding:13px 26px;background:#fbbf24;color:#3a2206;cursor:pointer}
.rra-join.on{background:#22c55e;color:#052e16}
.rra-join:disabled{opacity:.6;cursor:default}
.rra-go2{align-self:center;font:800 16px 'DM Sans',system-ui,sans-serif;text-decoration:none;border-radius:14px;padding:13px 20px;background:#334155;color:#cbd5e1}`;
  (document.head||document.documentElement).appendChild(css);

  const RRSITE={ show:showAnn, applied:null,
    refresh(){ if(OFF) return Promise.resolve(null); return fetch(SERVER+'/site',{cache:'no-store'}).then(r=>r.json()).then(st=>{ RRSITE.applied=st; apply(st); return st; }).catch(()=>null); },
    /* daily play-time board + daily challenge (used by the home page) */
    daily(op,extra){ if(OFF) return Promise.resolve(null); return fetch(SERVER+'/daily',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({op,pid:pid(),name:ls.get('rrOnlineName')||'Player'},extra||{}))}).then(r=>r.json()).catch(()=>null); },
    pid };
  window.RRSITE=RRSITE;

  /* game pages get the arcade lobby behind them (a still picture, so it costs the game nothing) and dark colors */
  if(PAGE&&PAGE!=='index'&&PAGE!=='admin'&&!document.getElementById('arena')&&document.body){
    const de=document.documentElement; de.dataset.theme='dark'; de.classList.add('rrArc');
    const css2=document.createElement('style'); css2.textContent='html.rrArc{background:#04060e} html.rrArc body{background:transparent!important} #arena.rrBg{position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block}';
    (document.head||de).appendChild(css2);
    const c=document.createElement('canvas'); c.id='arena'; c.className='rrBg'; c.dataset.still='1'; c.dataset.dim='.35'; c.setAttribute('aria-hidden','true'); document.body.insertBefore(c,document.body.firstChild);
    const sc=document.createElement('script'); sc.src='lobby3d.js'; sc.defer=true; (document.head||de).appendChild(sc); }

  /* parties work on every page */
  if(PAGE!=='admin'&&!window.RRPARTY&&!document.querySelector('script[src$="party.js"]')){ const sc=document.createElement('script'); sc.src='party.js'; sc.defer=true; (document.head||document.documentElement).appendChild(sc); }

  /* count play time: a heartbeat every minute while the page is open and visible */
  /* a fingerprint of this device (browser, screen, time zone…) so a ban survives clearing the browser's data */
  function devFp(){ try{ const n=navigator, s=screen, str=[n.userAgent,n.language,n.hardwareConcurrency,n.deviceMemory,s.width+'x'+s.height,s.colorDepth,(Intl.DateTimeFormat().resolvedOptions()||{}).timeZone,n.platform,n.maxTouchPoints].join('|'); let h1=0xdeadbeef, h2=0x41c6ce57; for(let i=0;i<str.length;i++){ const c=str.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677); } h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909); return (h2>>>0).toString(36)+(h1>>>0).toString(36); }catch(e){ return ''; } }
  function beat(){ if(OFF||PAGE==='admin'||document.visibilityState!=='visible') return;
    fetch(SERVER+'/play',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({pid:pid(),name:ls.get('rrOnlineName')||'Player',game:PAGE||'home',fp:devFp(),ans:(()=>{ try{ return JSON.parse(ls.get('rrAns')||'[]'); }catch(e){ return []; } })()})}).then(r=>r.json()).then(d=>{ if(!d) return; if(d.ok) ls.set('rrAns','[]'); banScreen(d.ban||null); runCmds(d.cmds); }).catch(()=>{}); }
  if(!OFF&&PAGE!=='admin'){ setTimeout(beat,2500); let lastB=Date.now(); setInterval(()=>{ const hid=document.visibilityState==='hidden'; if(Date.now()-lastB>=(hid?80000:30000)-500){ lastB=Date.now(); beat(); } },10000); setInterval(()=>{ if(document.visibilityState!=='hidden') RRSITE.refresh(); },180000);   /* check in every 30 s while you're looking, every 80 s in a background tab (saves server requests) */ document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') beat(); }); }
  /* show a cached announcement instantly, then refresh from the server */
  try{ const c=JSON.parse(ls.get('rrSiteCfgCache')||'null'); if(c&&c.ann) showAnn(c.ann); }catch(e){}
  if(!OFF) RRSITE.refresh().then(st=>{ if(st) try{ ls.set('rrSiteCfgCache',JSON.stringify({ann:st.ann})); }catch(e){} });
})();
/* Arcade Rivals updater: checks every 3 minutes (and whenever you come back to the tab) whether a newer version of the
   site has gone live. If it has, a bar offers a one-tap refresh, so nobody gets stuck on an old version. */
(function(){ if(window.RRUPD||window.RR_ADMIN||location.protocol==='file:') return; if(/[?&]test\b/.test(location.search)&&!/[?&]updtest\b/.test(location.search)) return; window.RRUPD=1;
  let base=null, shown=false;
  const get=()=>fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>j&&j.v).catch(()=>null);
  function bar(){ if(!document.body){ addEventListener('DOMContentLoaded',bar); return; } const b=document.createElement('div'); b.id='rrUpd';
    b.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483400;display:flex;gap:10px;align-items:center;background:#0f172a;color:#f8fafc;border:2px solid #22c55e;border-radius:999px;padding:8px 10px 8px 16px;font:700 14px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:94vw';
    b.innerHTML='<span>🔄 A new update is live!</span><button style="border:0;border-radius:999px;padding:7px 14px;font:800 14px system-ui;background:#22c55e;color:#052e16;cursor:pointer">Refresh</button><button style="border:0;background:none;color:#94a3b8;font:700 13px system-ui;cursor:pointer">Later</button>';
    const [r,l]=b.querySelectorAll('button'); r.onclick=()=>location.reload(); l.onclick=()=>b.remove(); document.body.appendChild(b); }
  async function check(){ const v=await get(); if(!v) return; if(base==null){ base=v; return; } if(v!==base&&!shown){ shown=true; bar(); } }
  check(); setInterval(()=>{ if(!document.hidden) check(); },600000); document.addEventListener('visibilitychange',()=>{ if(!document.hidden) check(); });
  window.RRUPDATE={ check, get base(){ return base; } };
})();
