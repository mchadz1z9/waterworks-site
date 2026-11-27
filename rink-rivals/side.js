/* Arcade Rivals app sidebar (Neon Tokyo layout): a slim neon rail on the main pages, a bottom tab bar on phones */
(function(){ if(window.__rrSide) return; window.__rrSide=1;
  /* ---------- app sidebar (Neon Tokyo layout) on the main pages ---------- */
  try{ const pg=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')||'index';
    const SIDE_PAGES=['index','chat','messages','ai','browser','call','clips','sports-arcade']; if(window.top!==window) return;
    if(SIDE_PAGES.includes(pg)&&!document.getElementById('rrSide')&&!window.RR_NOSIDE){
      const L=[['index','🏠','Home','./'],['games','🎮','Games','./#games'],['worlds','🌍','Worlds','./#worlds'],['messages','📨','Messages','messages'],['ai','🤖','AI','ai'],['browser','🌐','Browser','browser'],['rivalclips','📱','Clips','rivalclips'],['tv','📺','TV','tv'],['sports','🏟️','Sports','sports'],['avatar','🧑‍🎤','Avatar','avatar'],['sports-arcade','🏟️','Arcade','sports-arcade'],['shop','🪙','Shop','#shop']];
      const css=document.createElement('style'); css.textContent=`
#rrSide{position:fixed;left:0;top:0;bottom:0;width:76px;z-index:2147480500;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:12px 8px;background:linear-gradient(180deg,rgba(10,6,24,.92),rgba(5,4,14,.95));border-right:1px solid color-mix(in srgb,var(--v1,#ff2d95) 35%,transparent);box-shadow:4px 0 30px color-mix(in srgb,var(--v1,#ff2d95) 14%,transparent);backdrop-filter:blur(14px);transition:width .2s;overflow:hidden;font-family:system-ui,sans-serif}
#rrSide:hover,#rrSide.open{width:210px}
#rrSide .lg{display:flex;align-items:center;gap:10px;padding:6px 8px 12px;text-decoration:none;color:#fff;white-space:nowrap}
#rrSide .lg b{font:900 22px 'Big Shoulders Display',Impact,sans-serif;letter-spacing:.04em;background:linear-gradient(90deg,var(--v1,#ff2d95),var(--v2,#00e5ff));-webkit-background-clip:text;background-clip:text;color:transparent}
#rrSide .lg i{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-style:normal;font-size:24px;background:linear-gradient(135deg,var(--v1,#ff2d95),var(--v3,#9d4dff));box-shadow:0 0 18px color-mix(in srgb,var(--v1,#ff2d95) 60%,transparent)}
#rrSide a.it{position:relative;display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:14px;color:#cbd5e1;text-decoration:none;white-space:nowrap;font:700 15px system-ui;transition:background .15s,color .15s}
#rrSide a.it span{flex:none;width:36px;text-align:center;font-size:22px}
#rrSide a.it:hover{background:color-mix(in srgb,var(--v2,#00e5ff) 14%,transparent);color:#fff}
#rrSide a.it.on{background:linear-gradient(90deg,color-mix(in srgb,var(--v1,#ff2d95) 40%,transparent),transparent);color:#fff}
#rrSide a.it.on::before{content:'';position:absolute;left:-8px;top:8px;bottom:8px;width:4px;border-radius:0 4px 4px 0;background:var(--v1,#ff2d95);box-shadow:0 0 12px var(--v1,#ff2d95)}
#rrSide .sp{flex:1}
#rrSide b{transition:opacity .15s}#rrSide:not(:hover):not(.open) a b{opacity:0}
#rrSide .ub{position:absolute;left:34px;top:4px;min-width:18px;height:18px;border-radius:9px;background:var(--v1,#ff2d95);color:#fff;font:800 11px system-ui;display:none;place-items:center;padding:0 5px}
html.rr-side body{padding-left:76px!important}
@media(min-width:761px){html.rr-side #rrCoin,html.rr-side #rrAcctB,html.rr-side #rrCoinT,html.rr-side #rrpF,html.rr-side #rrPhotoB,html.rr-side #rrEmoB,html.rr-side #rrMtB,html.rr-side #rrStreakB,html.rr-side #rrGC{margin-left:78px!important}}
@media(max-width:760px){html.rr-side #rrCoin,html.rr-side #rrAcctB,html.rr-side #rrCoinT,html.rr-side #rrpF,html.rr-side #rrPhotoB,html.rr-side #rrEmoB,html.rr-side #rrMtB,html.rr-side #rrcF,html.rr-side #rrTourBtn{transform:translateY(-62px)}}
@media(max-width:760px){#rrSide{top:auto;left:0;right:0;bottom:0;width:auto!important;height:62px;flex-direction:row;padding:6px;overflow-x:auto;gap:2px;border-right:0;border-top:1px solid color-mix(in srgb,var(--v1,#ff2d95) 35%,transparent)}#rrSide .lg,#rrSide .sp,#rrSide a.it b{display:none}#rrSide a.it{flex-direction:column;gap:0;padding:4px 8px;font-size:11px}html.rr-side body{padding-left:0!important;padding-bottom:64px!important}}`;
      document.head.appendChild(css);
      const sd=document.createElement('nav'); sd.id='rrSide'; sd.setAttribute('aria-label','Arcade Rivals');
      sd.innerHTML=`<a class="lg" href="./"><i>🏆</i><b>ARCADE RIVALS</b></a>`+L.map(([k,ic,n,h])=>`<a class="it${k===pg||(k==='messages'&&(pg==='chat'||pg==='call'))?' on':''}" href="${h}" data-k="${k}"><span>${ic}</span><b>${n}</b>${k==='messages'?'<em class="ub" id="rrSideUb"></em>':''}</a>`).join('')+`<div class="sp"></div><a class="it" href="#" data-k="theme"><span>🎨</span><b>Theme</b></a>`;
      const put=()=>{ document.body.appendChild(sd); document.documentElement.classList.add('rr-side'); };
      if(document.body) put(); else addEventListener('DOMContentLoaded',put);
      sd.addEventListener('click',e=>{ const a=e.target.closest('a.it'); if(!a) return;
        if(a.dataset.k==='shop'){ e.preventDefault(); try{ window.RRCOIN&&RRCOIN.open('shop'); }catch(x){} }
        if(a.dataset.k==='theme'){ e.preventDefault(); let p=document.getElementById('rrSideTheme'); if(p){ p.remove(); return; } p=document.createElement('div'); p.id='rrSideTheme'; p.style.cssText='position:fixed;left:90px;bottom:18px;z-index:2147480600;width:min(340px,92vw);background:rgba(10,6,24,.97);border:1px solid color-mix(in srgb,var(--v1,#ff2d95) 45%,transparent);border-radius:18px;padding:14px;color:#fff;font:14px system-ui;box-shadow:0 20px 50px rgba(0,0,0,.6)'; p.innerHTML='<b style="font-size:16px">🎨 Colour theme</b><div id="rrSTv" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 12px"></div><b style="font-size:16px">🖼️ Background</b><div id="rrSTb" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px"></div>'; document.body.appendChild(p); try{ window.RRVIBE.picker(p.querySelector('#rrSTv')); window.RRBG.picker(p.querySelector('#rrSTb')); }catch(x){} } });
      /* unread private messages badge */
      setInterval(()=>{ try{ const b=document.getElementById('rrSideUb'); if(!b) return; let n=0; for(const t of (window.__rrDMs?window.__rrDMs():[])) n+=t.unread||0; b.textContent=n; b.style.display=n?'grid':'none'; }catch(x){} },2000);
    } }catch(e){}
})();
