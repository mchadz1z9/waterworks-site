/* Emote wheel (press T, or the 😀 button) — your character does the emote in every game that draws you,
   plus seasonal weather over the whole site (snow in winter, petals in spring, sunbeams in summer, leaves in the spooky season). */
(function(){ if(window.RREMOTES) return;
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN) return;
  const EM=[{k:'wave',ic:'👋',n:'Wave'},{k:'cheer',ic:'🙌',n:'Cheer'},{k:'dance',ic:'💃',n:'Dance'},{k:'flex',ic:'💪',n:'Flex'},{k:'robot',ic:'🤖',n:'Robot',item:'em_robot'},{k:'spin',ic:'🌀',n:'Spin',item:'em_spin'},
    {k:'salute',ic:'🫡',n:'Salute',item:'em_salute'},{k:'jacks',ic:'🤸',n:'Jumping jacks',item:'em_jacks'},{k:'swing',ic:'🕺',n:'Arm swing',item:'em_swing'},{k:'laugh',ic:'😂',n:'Laugh',item:'em_laugh'},
    {k:'bow',ic:'🙇',n:'Bow'},{k:'heart',ic:'🫶',n:'Heart'},{k:'crew',ic:'✊',n:'Crew salute',crew:1},{k:'facepalm',ic:'🤦',n:'Facepalm',item:'em_facepalm'},{k:'shrug',ic:'🤷',n:'Shrug',item:'em_shrug'},{k:'champ',ic:'🏆',n:'Champion',item:'em_champ'},{k:'clap',ic:'👏',n:'Clap',item:'em_clap'}];
  const owned=e=>e.crew?!!(window.RRACCT&&RRACCT.crew):(!e.item||(window.RRCOIN&&RRCOIN.has(e.item)));
  window.RREMOTE=null;
  function play(k){ window.RREMOTE={k,t0:performance.now()}; try{ dispatchEvent(new CustomEvent('rr-emote',{detail:k})); }catch(e){} close(); }
  let wh=null;
  function close(){ if(wh){ wh.remove(); wh=null; } }
  function open(){ if(wh){ close(); return; } wh=document.createElement('div'); wh.id='rrEmo'; wh.style.cssText='position:fixed;inset:0;z-index:2147482650;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.35)';
    const R=158; let h='<div style="position:relative;width:390px;height:390px;max-width:96vw;border-radius:50%;background:radial-gradient(circle,rgba(15,23,42,.92) 55%,rgba(30,41,59,.85));border:2px solid #475569">';
    EM.forEach((e,i)=>{ const a=i/EM.length*Math.PI*2-Math.PI/2, x=195+Math.cos(a)*R-29, y=195+Math.sin(a)*R-29, ok=owned(e);
      h+=`<button data-em="${e.k}" title="${e.n}${ok?'':e.crew?' — join a crew to use it':' — buy in the 🪙 shop'}" style="position:absolute;left:${x}px;top:${y}px;width:58px;height:58px;border-radius:50%;border:2px solid ${ok?'#facc15':'#334155'};background:#1e293b;color:#fff;font:700 24px system-ui;padding:0;cursor:pointer;opacity:${ok?1:.5}">${ok?e.ic:'🔒'}<div style="font-size:9px;margin-top:-4px">${e.n}</div></button>`; });
    h+='<div style="position:absolute;left:0;right:0;top:172px;text-align:center;color:#e2e8f0;font:800 16px system-ui">EMOTES<br><span style="font-size:11px;color:#94a3b8">T to close</span></div></div>';
    wh.innerHTML=h; document.body.appendChild(wh);
    wh.addEventListener('click',ev=>{ const b=ev.target.closest('[data-em]'); if(!b){ close(); return; } const e=EM.find(x=>x.k===b.dataset.em); if(owned(e)) play(e.k); else { close(); if(e.crew){ if(window.RRACCT) RRACCT.open(); } else if(window.RRCOIN) RRCOIN.open('shop'); } }); }
  addEventListener('keydown',e=>{ const t=document.activeElement; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return; if(document.getElementById('rrShop')||document.getElementById('rrAcct')) return;
    if(e.code==='KeyT'&&!e.repeat&&!e.ctrlKey&&!e.metaKey){ open(); } else if(e.code==='Escape') close(); });
  function mount(){ if(document.getElementById('rrEmoB')) return; const b=document.createElement('button'); b.id='rrEmoB'; b.textContent='😀'; b.title='Emotes (T)'; b.style.cssText='position:fixed;left:10px;bottom:232px;z-index:2147482500;width:40px;height:40px;border-radius:50%;border:1px solid #fde68a;background:#1e293b;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)'; b.onclick=open; document.body.appendChild(b); weather();
    const c=document.createElement('button'); c.id='rrPhotoB'; c.textContent='📸'; c.title='Photo mode (Shift+P)'; c.style.cssText=b.style.cssText; c.style.bottom='280px'; c.onclick=photoToggle; document.body.appendChild(c); }
  /* ---- photo mode: hide the buttons, strike a pose, save a picture ---- */
  let photo=false, pbar=null, hud=true;
  function photoToggle(){ photo=!photo; document.body.classList.toggle('rrPhoto',photo);
    if(!document.getElementById('rrPhotoCss')){ const st=document.createElement('style'); st.id='rrPhotoCss'; st.textContent='body.rrPhoto [id^="rr"]:not(#rrWx):not(#rrPhotoBar):not(#rrEmo):not(#rrPhotoFlash):not(#rrPhotoB):not(#rrStreak){visibility:hidden!important} body.rrPhoto.rrNoHud #stage canvas:not(:first-child){visibility:hidden!important}'; document.head.appendChild(st); }
    if(!photo){ document.body.classList.remove('rrNoHud'); hud=true; if(pbar){ pbar.remove(); pbar=null; } return; }
    pbar=document.createElement('div'); pbar.id='rrPhotoBar'; pbar.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147482900;background:rgba(5,10,24,.9);border:1px solid #fde68a;border-radius:999px;padding:6px 8px;display:flex;gap:6px;align-items:center;color:#fde68a;font:700 13px system-ui;flex-wrap:wrap;justify-content:center;max-width:94vw';
    const bs='border:0;border-radius:999px;padding:7px 14px;font:800 13px system-ui;cursor:pointer';
    pbar.innerHTML=`<span style="padding:0 6px">📸 Photo mode</span><button data-p="emo" style="${bs};background:#334155;color:#fff">😀 Pose (T)</button><button data-p="hud" style="${bs};background:#334155;color:#fff">🏷️ Hide names</button><button data-p="snap" style="${bs};background:#facc15;color:#111">📷 Take photo</button><button data-p="x" style="${bs};background:#475569;color:#fff">✕ Done</button>`;
    pbar.onclick=e=>{ const b=e.target.closest('[data-p]'); if(!b) return; const a=b.dataset.p; if(a==='x') photoToggle(); else if(a==='emo') open(); else if(a==='snap') snap(); else if(a==='hud'){ hud=!hud; document.body.classList.toggle('rrNoHud',!hud); b.textContent=hud?'🏷️ Hide names':'🏷️ Show names'; } };
    document.body.appendChild(pbar); }
  function snap(){ const stage=document.getElementById('stage')||document.body, cvs=[...stage.querySelectorAll('canvas')].filter(c=>c.offsetWidth>0&&c.id!=='rrWx'&&getComputedStyle(c).visibility!=='hidden');
    if(!cvs.length){ alert('No game picture on this page'); return; } const main=cvs.reduce((a,c)=>c.offsetWidth*c.offsetHeight>a.offsetWidth*a.offsetHeight?c:a), R=main.getBoundingClientRect(), sc=Math.min(3840/R.width,Math.max(1,devicePixelRatio||1)*1.5);
    let done=false; const go=()=>{ if(done) return; done=true; const out=document.createElement('canvas'); out.width=Math.round(R.width*sc); out.height=Math.round(R.height*sc); const x=out.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,out.width,out.height);
      for(const c of cvs){ const r=c.getBoundingClientRect(); try{ x.drawImage(c,(r.left-R.left)*sc,(r.top-R.top)*sc,r.width*sc,r.height*sc); }catch(e){} }
      const nm=(window.RRACCT&&RRACCT.name)||localStorage.getItem('rrName')||''; x.font=`900 ${Math.round(22*sc)}px system-ui`; x.textAlign='right'; x.fillStyle='rgba(0,0,0,.45)'; x.fillText(`Arcade Rivals${nm?' · '+nm:''}`,out.width-14*sc+2,out.height-14*sc+2); x.fillStyle='#fde68a'; x.fillText(`Arcade Rivals${nm?' · '+nm:''}`,out.width-14*sc,out.height-14*sc);
      const a=document.createElement('a'); a.download=`arcade-rivals-${PAGE||'photo'}-${Date.now()}.png`; try{ a.href=out.toDataURL('image/png'); a.click(); }catch(e){ alert('Could not save the photo on this game'); return; }
      const f=document.createElement('div'); f.id='rrPhotoFlash'; f.style.cssText='position:fixed;inset:0;background:#fff;z-index:2147483000;pointer-events:none;transition:opacity .5s'; document.body.appendChild(f); requestAnimationFrame(()=>{ f.style.opacity='0'; }); setTimeout(()=>f.remove(),600);
      try{ if(window.RRCOIN&&RRCOIN.stat) RRCOIN.stat('photos'); }catch(e){} };
    const gl=cvs.find(c=>{ try{ return !!(c.getContext&&(c.__isGL||(c.__isGL=!!c.getContext('webgl2')||!!c.getContext('webgl')))); }catch(e){ return false; } });
    if(gl&&window.makeR3){ window.RRSNAPREQ=()=>go(); setTimeout(go,400); } else go(); }
  addEventListener('keydown',e=>{ if(e.code==='KeyP'&&e.shiftKey&&!e.repeat){ const t=document.activeElement; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return; photoToggle(); } else if(e.code==='Escape'&&photo) photoToggle(); });
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',mount); else mount();
  /* ---- seasonal weather over the site ---- */
  function weather(){ try{ if(localStorage.getItem('rrGfx')==='low'||localStorage.getItem('rrNoWeather')==='1') return; if(matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return; }catch(e){}
    const m=new Date().getMonth(), kind=[10,11,0].includes(m)?'snow':[1,2,3].includes(m)?'petal':[8,9].includes(m)?'leaf':'sun';
    const cv=document.createElement('canvas'); cv.id='rrWx'; cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147481900'; document.body.appendChild(cv); const x=cv.getContext('2d');
    const N=kind==='sun'?14:kind==='snow'?55:30, P=[]; const rs=()=>{ cv.width=innerWidth; cv.height=innerHeight; }; rs(); addEventListener('resize',rs);
    for(let i=0;i<N;i++) P.push({x:Math.random(),y:Math.random(),s:.5+Math.random(),v:.3+Math.random()*.7,ph:Math.random()*7});
    let last=performance.now(); (function tick(now){ const dt=Math.min(.05,(now-last)/1000); last=now; if(!document.hidden){ const W=cv.width, H=cv.height; x.clearRect(0,0,W,H);
      for(const p of P){ p.y+=dt*p.v*(kind==='sun'?.02:.06); p.x+=dt*(kind==='snow'?Math.sin(now/1600+p.ph)*.01:kind==='sun'?0:.02*Math.sin(now/900+p.ph)); if(p.y>1.05){ p.y=-.05; p.x=Math.random(); } const X=p.x*W, Y=p.y*H;
        if(kind==='snow'){ x.fillStyle='rgba(255,255,255,.75)'; x.beginPath(); x.arc(X,Y,1.5+p.s*2,0,7); x.fill(); }
        else if(kind==='petal'){ x.fillStyle='rgba(249,168,212,.8)'; x.save(); x.translate(X,Y); x.rotate(now/700+p.ph); x.beginPath(); x.ellipse(0,0,5*p.s,2.5*p.s,0,0,7); x.fill(); x.restore(); }
        else if(kind==='leaf'){ x.fillStyle=['rgba(234,88,12,.8)','rgba(202,138,4,.8)','rgba(185,28,28,.75)'][Math.floor(p.ph)%3]; x.save(); x.translate(X,Y); x.rotate(now/500+p.ph); x.fillRect(-4*p.s,-2*p.s,8*p.s,4*p.s); x.restore(); }
        else { const a=.12+.1*Math.sin(now/800+p.ph); x.fillStyle=`rgba(253,224,71,${a})`; x.beginPath(); x.arc(X,Y,3+p.s*3,0,7); x.fill(); } } }
      requestAnimationFrame(tick); })(last); }
  /* how an emote moves the body (used by physique.js for YOUR character, and for other people in the Hub) */
  window.RREMOTES={ list:EM, open, play,
    apply(J,f,k,t){ const s=Math.sin, P=(a,b)=>J[a]=b; const sh=(dx,dy)=>{ for(const key in J){ const v=J[key]; if(!Array.isArray(v)||v.length!==3||key==='F'||key==='toe') continue; J[key]=[v[0]+dx,v[1]+dy,v[2]]; } };
      f={...f};
      if(k==='wave'){ P('elb1',[.32,1.5,.05]); P('hand1',[.36+s(t*14)*.08,1.86,.05]); }
      else if(k==='cheer'){ for(const sx of [-1,1]){ P('elb'+sx,[sx*.3,1.62,.05]); P('hand'+sx,[sx*.32,1.98,.05]); } f.y=(f.y||0)+Math.abs(s(t*8))*.15; }
      else if(k==='dance'){ sh(s(t*6)*.07,0); for(const sx of [-1,1]){ P('elb'+sx,[sx*.33,1.3+s(t*6+sx)*.15,.12]); P('hand'+sx,[sx*.3,1.45+s(t*6+sx)*.35,.25]); } f.y=(f.y||0)+Math.abs(s(t*6))*.06; }
      else if(k==='flex'){ for(const sx of [-1,1]){ P('elb'+sx,[sx*.45,1.48,0]); P('hand'+sx,[sx*.32,1.8,.04]); } }
      else if(k==='robot'){ const st=Math.floor(t*3)%2; for(const sx of [-1,1]){ P('elb'+sx,[sx*.22,1.2+(st===(sx>0?1:0)?.15:0),.22]); P('hand'+sx,[sx*.2,1.22+(st===(sx>0?1:0)?.15:0),.46]); } }
      else if(k==='spin'){ f.yaw=(f.yaw||0)+t*10; for(const sx of [-1,1]){ P('elb'+sx,[sx*.5,1.42,0]); P('hand'+sx,[sx*.75,1.42,0]); } }
      else if(k==='salute'){ P('elb1',[.36,1.45,.12]); P('hand1',[.12,1.64,.14]); }
      else if(k==='jacks'){ const q=(s(t*9)+1)/2; for(const sx of [-1,1]){ P('elb'+sx,[sx*(.3+.15*q),1.25+.4*q,0]); P('hand'+sx,[sx*(.3+.2*q),.95+1.05*q,0]); } f.y=(f.y||0)+q*.12; }
      else if(k==='swing'){ const q=s(t*7); for(const sx of [-1,1]){ P('elb'+sx,[q*.25+sx*.12,1.15,sx*.1]); P('hand'+sx,[q*.4+sx*.1,.98,sx*.15]); } sh(-q*.05,0); }
      else if(k==='laugh'){ f.y=(f.y||0)+Math.abs(s(t*16))*.04; if(J.head) J.head=[J.head[0],J.head[1],J.head[2]-.04]; for(const sx of [-1,1]){ P('hand'+sx,[sx*.12,1.15,.2]); P('elb'+sx,[sx*.28,1.2,.1]); } }
      else if(k==='bow'){ const q=Math.min(1,t*2.5)*(t<1.6?1:Math.max(0,1-(t-1.6)*3)); if(J.chest) J.chest=[J.chest[0],J.chest[1]-.12*q,J.chest[2]+.32*q]; if(J.head) J.head=[J.head[0],J.head[1]-.22*q,J.head[2]+.48*q]; for(const sx of [-1,1]){ P('elb'+sx,[sx*.2,1.15,.05]); P('hand'+sx,[sx*.12,.95,.1]); } }
      else if(k==='heart'){ for(const sx of [-1,1]){ P('elb'+sx,[sx*.38,1.75,.08]); P('hand'+sx,[sx*.06,1.98+s(t*4)*.03,.12]); } }
      else if(k==='crew'){ const q=Math.abs(s(t*5)); P('elb1',[.3,1.62,.05]); P('hand1',[.22,2.02+q*.06,.02]); P('elb-1',[-.2,1.2,.18]); P('hand-1',[-.05,1.35,.24]); f.y=(f.y||0)+q*.05; }
      else if(k==='facepalm'){ P('elb1',[.28,1.35,.22]); P('hand1',[.06,1.62,.16]); if(J.head) J.head=[J.head[0],J.head[1]-.03,J.head[2]+.05]; }
      else if(k==='shrug'){ const q=(s(t*5)+1)/2; for(const sx of [-1,1]){ P('elb'+sx,[sx*.32,1.18,.1]); P('hand'+sx,[sx*.45,1.3+q*.06,.2]); } }
      else if(k==='champ'){ const q=Math.abs(s(t*6)); for(const sx of [-1,1]){ P('elb'+sx,[sx*.32,1.7,0]); P('hand'+sx,[sx*.16,2.05,.02]); } f.y=(f.y||0)+q*.22; f.yaw=(f.yaw||0)+(t>.8?Math.sin(t*2)*.4:0); }
      else if(k==='clap'){ const q=Math.abs(s(t*12)); for(const sx of [-1,1]){ P('elb'+sx,[sx*.28,1.25,.2]); P('hand'+sx,[sx*(.03+q*.12),1.42,.38]); } }
      return [J,f]; } };
})();
