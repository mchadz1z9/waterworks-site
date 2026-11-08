/* Emote wheel (press T, or the 😀 button) — your character does the emote in every game that draws you,
   plus seasonal weather over the whole site (snow in winter, petals in spring, sunbeams in summer, leaves in the spooky season). */
(function(){ if(window.RREMOTES) return;
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN) return;
  const EM=[{k:'wave',ic:'👋',n:'Wave'},{k:'cheer',ic:'🙌',n:'Cheer'},{k:'dance',ic:'💃',n:'Dance'},{k:'flex',ic:'💪',n:'Flex'},{k:'robot',ic:'🤖',n:'Robot',item:'em_robot'},{k:'spin',ic:'🌀',n:'Spin',item:'em_spin'},
    {k:'salute',ic:'🫡',n:'Salute',item:'em_salute'},{k:'jacks',ic:'🤸',n:'Jumping jacks',item:'em_jacks'},{k:'swing',ic:'🕺',n:'Arm swing',item:'em_swing'},{k:'laugh',ic:'😂',n:'Laugh',item:'em_laugh'}];
  const owned=e=>!e.item||(window.RRCOIN&&RRCOIN.has(e.item));
  window.RREMOTE=null;
  function play(k){ window.RREMOTE={k,t0:performance.now()}; try{ dispatchEvent(new CustomEvent('rr-emote',{detail:k})); }catch(e){} close(); }
  let wh=null;
  function close(){ if(wh){ wh.remove(); wh=null; } }
  function open(){ if(wh){ close(); return; } wh=document.createElement('div'); wh.id='rrEmo'; wh.style.cssText='position:fixed;inset:0;z-index:2147482650;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.35)';
    const R=130; let h='<div style="position:relative;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(15,23,42,.92) 55%,rgba(30,41,59,.85));border:2px solid #475569">';
    EM.forEach((e,i)=>{ const a=i/EM.length*Math.PI*2-Math.PI/2, x=170+Math.cos(a)*R-34, y=170+Math.sin(a)*R-34, ok=owned(e);
      h+=`<button data-em="${e.k}" title="${e.n}${ok?'':' — buy in the 🪙 shop'}" style="position:absolute;left:${x}px;top:${y}px;width:68px;height:68px;border-radius:50%;border:2px solid ${ok?'#facc15':'#334155'};background:#1e293b;color:#fff;font:700 28px system-ui;cursor:pointer;opacity:${ok?1:.5}">${ok?e.ic:'🔒'}<div style="font-size:9px;margin-top:-4px">${e.n}</div></button>`; });
    h+='<div style="position:absolute;left:0;right:0;top:150px;text-align:center;color:#e2e8f0;font:800 16px system-ui">EMOTES<br><span style="font-size:11px;color:#94a3b8">T to close</span></div></div>';
    wh.innerHTML=h; document.body.appendChild(wh);
    wh.addEventListener('click',ev=>{ const b=ev.target.closest('[data-em]'); if(!b){ close(); return; } const e=EM.find(x=>x.k===b.dataset.em); if(owned(e)) play(e.k); else { close(); if(window.RRCOIN) RRCOIN.open('shop'); } }); }
  addEventListener('keydown',e=>{ const t=document.activeElement; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return; if(document.getElementById('rrShop')||document.getElementById('rrAcct')) return;
    if(e.code==='KeyT'&&!e.repeat&&!e.ctrlKey&&!e.metaKey){ open(); } else if(e.code==='Escape') close(); });
  function mount(){ if(document.getElementById('rrEmoB')) return; const b=document.createElement('button'); b.id='rrEmoB'; b.textContent='😀'; b.title='Emotes (T)'; b.style.cssText='position:fixed;left:10px;bottom:232px;z-index:2147482500;width:40px;height:40px;border-radius:50%;border:1px solid #fde68a;background:#1e293b;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)'; b.onclick=open; document.body.appendChild(b); weather(); }
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
      return [J,f]; } };
})();
