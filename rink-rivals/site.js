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

  function showAnn(ann){ if(!ann||(!ann.title&&!ann.body)) return; if(PAGE==='admin') return;
    if(ls.get('rrAnnSeen')===ann.id) return; if(document.getElementById('rrAnn')) return;
    const d=document.createElement('div'); d.id='rrAnn'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    d.innerHTML=`<div class="rra-card"><button class="rra-x" aria-label="Close">×</button><div class="rra-tag">📣 Rink Rivals update</div>
      ${ann.title?`<h2>${esc(ann.title)}</h2>`:''}<div class="rra-body">${esc(ann.body||'').replace(/\n/g,'<br>')}</div>
      <button class="rra-go">Let's play ▸</button></div>`;
    const close=()=>{ ls.set('rrAnnSeen',ann.id); d.remove(); };
    d.querySelector('.rra-x').onclick=close; d.querySelector('.rra-go').onclick=close;
    d.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    (document.body||document.documentElement).appendChild(d); setTimeout(()=>{ const g=d.querySelector('.rra-go'); g&&g.focus(); },30);
  }

  function apply(st){ if(!st) return; if('ov' in st) cacheOv(st.ov); try{ ls.set('rrSiteAt',String(Date.now())); }catch(e){} if(st.ann) showAnn(st.ann); }

  const css=document.createElement('style'); css.textContent=`#rrAnn{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,6,14,.82);backdrop-filter:blur(3px);font-family:'DM Sans',system-ui,sans-serif;animation:rraIn .25s ease}
@keyframes rraIn{from{opacity:0}to{opacity:1}}
.rra-card{position:relative;width:min(640px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(160deg,#182446,#0c1227);color:#eef2fb;border:2px solid #3b4e86;border-radius:22px;padding:30px 30px 26px;box-shadow:0 30px 90px rgba(0,0,0,.65);text-align:center}
.rra-tag{font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ffd166;font-size:14px}
.rra-card h2{margin:10px 0 12px;font-size:34px;line-height:1.1}
.rra-body{font-size:19px;line-height:1.5;color:#cdd6ec;white-space:pre-wrap;word-wrap:break-word}
.rra-go{margin-top:22px;font:800 19px 'DM Sans',system-ui,sans-serif;border:0;border-radius:14px;padding:13px 30px;background:#22c55e;color:#052e16;cursor:pointer}
.rra-go:hover{background:#16a34a}
.rra-x{position:absolute;top:12px;right:14px;width:40px;height:40px;border-radius:12px;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:26px;line-height:1;cursor:pointer}
.rra-x:hover{background:rgba(255,255,255,.22)}
@media(max-width:560px){.rra-card h2{font-size:26px}.rra-body{font-size:17px}}`;
  (document.head||document.documentElement).appendChild(css);

  const RRSITE={ show:showAnn, applied:null,
    refresh(){ if(OFF) return Promise.resolve(null); return fetch(SERVER+'/site',{cache:'no-store'}).then(r=>r.json()).then(st=>{ RRSITE.applied=st; apply(st); return st; }).catch(()=>null); } };
  window.RRSITE=RRSITE;
  /* show a cached announcement instantly, then refresh from the server */
  try{ const c=JSON.parse(ls.get('rrSiteCfgCache')||'null'); if(c&&c.ann) showAnn(c.ann); }catch(e){}
  if(!OFF) RRSITE.refresh().then(st=>{ if(st) try{ ls.set('rrSiteCfgCache',JSON.stringify({ann:st.ann})); }catch(e){} });
})();
