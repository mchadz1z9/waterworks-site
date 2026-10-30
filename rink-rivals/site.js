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
    if(!s||!s.bannerOn||!s.banner||!s.banner.text) return; const bid=s.bannerId||'b'; if(ls.get('rrBannerSeen')===bid) return;
    const th=THEMES[s.banner.theme]||THEMES.blue; const d=document.createElement('div'); d.id='rrBanner';
    d.style.background=`linear-gradient(90deg,${th[0]},${th[1]})`;
    d.innerHTML=`<span>${esc(s.banner.text)}</span><button aria-label="Dismiss">×</button>`;
    d.querySelector('button').onclick=()=>{ ls.set('rrBannerSeen',bid); d.remove(); };
    (document.body||document.documentElement).appendChild(d); }
  function apply(st){ if(!st) return; if('ov' in st) cacheOv(st.ov); try{ ls.set('rrSiteAt',String(Date.now())); }catch(e){} if(st.ann) showAnn(st.ann); if(st.settings) showBanner(st.settings); }

  const css=document.createElement('style'); css.textContent=`#rrAnn{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,6,14,.82);backdrop-filter:blur(3px);font-family:'DM Sans',system-ui,sans-serif;animation:rraIn .25s ease}
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
#rrBanner button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:8px;background:rgba(0,0,0,.25);color:#fff;font-size:18px;line-height:1;cursor:pointer}`;
  (document.head||document.documentElement).appendChild(css);

  const RRSITE={ show:showAnn, applied:null,
    refresh(){ if(OFF) return Promise.resolve(null); return fetch(SERVER+'/site',{cache:'no-store'}).then(r=>r.json()).then(st=>{ RRSITE.applied=st; apply(st); return st; }).catch(()=>null); } };
  window.RRSITE=RRSITE;
  /* show a cached announcement instantly, then refresh from the server */
  try{ const c=JSON.parse(ls.get('rrSiteCfgCache')||'null'); if(c&&c.ann) showAnn(c.ann); }catch(e){}
  if(!OFF) RRSITE.refresh().then(st=>{ if(st) try{ ls.set('rrSiteCfgCache',JSON.stringify({ann:st.ann})); }catch(e){} });
})();
