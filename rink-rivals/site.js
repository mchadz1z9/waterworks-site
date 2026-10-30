/* Rink Rivals site config: a full-screen update announcement that everyone sees when they open the site,
   and admin player edits that the games pick up. All set from the /admin page. Read-only here. */
(function(){ if(window.RRSITE) return;
  const qs=new URLSearchParams(location.search);
  const SERVER=(qs.get('server')||'wss://rink-rivals-rooms.mitchellchad2026.workers.dev').replace(/^ws/,'http');
  const OFF=/[?&]test\b/.test(location.search)||location.protocol==='file:';
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
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
      <div class="rra-cover" style="background:${cv.grad}"><span class="rra-ico">${esc(cv.icon)}</span><span class="rra-tag">Rink Rivals update</span></div>
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
  function pickTourney(list){ if(!list.length) return null; const now=Date.now();
    const up=list.filter(t=>{ const d=Date.parse(t.time); return isFinite(d)&&d>now-3*3600000; }).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
    return up[0]||list.slice().sort((a,b)=>b.ts-a.ts)[0]; }
  let curTour=null;
  function showTourney(list){ if(PAGE==='admin') return; list=Array.isArray(list)?list:[];
    const t=pickTourney(list); curTour=t; const ex=document.getElementById('rrTourBtn');
    if(!t){ if(ex) ex.remove(); const p=document.getElementById('rrTour'); if(p) p.remove(); return; }
    let b=ex; if(!b){ b=document.createElement('button'); b.id='rrTourBtn'; b.type='button'; b.onclick=()=>openTour(curTour); (document.body||document.documentElement).appendChild(b); }
    b.innerHTML=`🏆 Tournament${joinedIds().includes(t.id)?' ✓':''}`;
    if(ls.get('rrTourSeen')!==t.id && !document.getElementById('rrTour') && !document.getElementById('rrAnn')) openTour(t,true); }
  function openTour(t,auto){ if(!t) return; const old=document.getElementById('rrTour'); if(old) old.remove(); if(auto) ls.set('rrTourSeen',t.id);
    const joined=joinedIds().includes(t.id), n=(t.joins&&t.joins.length)||0, when=fmtTime(t.time);
    const d=document.createElement('div'); d.id='rrTour'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    d.innerHTML=`<div class="rra-card"><button class="rra-x" aria-label="Close">×</button>
      <div class="rra-cover" style="background:linear-gradient(135deg,#78350f,#fbbf24)"><span class="rra-ico">🏆</span><span class="rra-tag">Rink Rivals tournament</span></div>
      <h2>${esc(t.name)}</h2>
      <div class="rra-meta">${t.game?`<span>🎮 ${esc(t.game)}</span>`:''}${when?`<span>🗓️ ${esc(when)}</span>`:''}<span class="rra-cnt">👥 ${n} joined</span></div>
      ${t.desc?`<div class="rra-body">${esc(t.desc).replace(/\n/g,'<br>')}</div>`:''}
      <div class="rra-btns"><button class="rra-join${joined?' on':''}">${joined?"✓ You're in — tap to leave":'Join tournament'}</button>${t.page?`<a class="rra-go2" href="${esc(t.page)}">Go to game ▸</a>`:''}</div></div>`;
    const close=()=>d.remove(); d.querySelector('.rra-x').onclick=close; d.addEventListener('click',e=>{ if(e.target===d) close(); });
    const jb=d.querySelector('.rra-join'); jb.onclick=()=>{ joinedIds().includes(t.id)?leaveTour(t,jb,d):joinTour(t,jb,d); };
    (document.body||document.documentElement).appendChild(d); }
  function joinTour(t,btn,d){ let name=ls.get('rrOnlineName'); if(!name){ name=prompt('Your name for the tournament:',''); if(name==null) return; name=String(name).replace(/[<>]/g,'').trim().slice(0,20); if(!name) return; ls.set('rrOnlineName',name); }
    btn.disabled=true; btn.textContent='Joining…';
    fetch(SERVER+'/tourney',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'join',id:t.id,name,pid:pid()})}).then(r=>r.json()).then(r=>{ const ids=joinedIds(); if(!ids.includes(t.id)) ids.push(t.id); setJoined(ids);
      btn.disabled=false; btn.classList.add('on'); btn.textContent="✓ You're in — tap to leave"; if(r&&r.joined!=null){ const c=d.querySelector('.rra-cnt'); if(c) c.textContent=`👥 ${r.joined} joined`; } const bb=document.getElementById('rrTourBtn'); if(bb) bb.innerHTML='🏆 Tournament ✓'; }).catch(()=>{ btn.disabled=false; btn.textContent='Join tournament'; }); }
  function leaveTour(t,btn,d){ btn.disabled=true; btn.textContent='Leaving…';
    fetch(SERVER+'/tourney',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'leave',id:t.id,pid:pid()})}).then(()=>{ setJoined(joinedIds().filter(x=>x!==t.id)); btn.disabled=false; btn.classList.remove('on'); btn.textContent='Join tournament'; const bb=document.getElementById('rrTourBtn'); if(bb) bb.innerHTML='🏆 Tournament'; }).catch(()=>{ btn.disabled=false; btn.textContent="✓ You're in — tap to leave"; }); }

  function apply(st){ if(!st) return; if('ov' in st) cacheOv(st.ov); try{ ls.set('rrSiteAt',String(Date.now())); }catch(e){} if(st.ann) showAnn(st.ann); if(st.settings) showBanner(st.settings); showTourney(st.tourneys||[]); }

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
.rra-x{position:absolute;top:12px;right:14px;width:40px;height:40px;border-radius:12px;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:26px;line-height:1;cursor:pointer}
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
    refresh(){ if(OFF) return Promise.resolve(null); return fetch(SERVER+'/site',{cache:'no-store'}).then(r=>r.json()).then(st=>{ RRSITE.applied=st; apply(st); return st; }).catch(()=>null); } };
  window.RRSITE=RRSITE;
  /* show a cached announcement instantly, then refresh from the server */
  try{ const c=JSON.parse(ls.get('rrSiteCfgCache')||'null'); if(c&&c.ann) showAnn(c.ann); }catch(e){}
  if(!OFF) RRSITE.refresh().then(st=>{ if(st) try{ ls.set('rrSiteCfgCache',JSON.stringify({ann:st.ann})); }catch(e){} });
})();
