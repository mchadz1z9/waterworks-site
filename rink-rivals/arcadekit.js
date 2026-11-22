/* Arcade Kit: the shared frame for Arcade Rivals' canvas games.
   A game calls AK.init({...}) once, then draws into AK.ctx in a fixed logical size (AK.W x AK.H).
   The kit handles: fitting the canvas to any screen (crisp on retina, letterboxed), the title menu
   with modes and how-to-play, pause (P / Esc) and mute (M), synthesized sound effects, best scores,
   the game-over card, posting results to the site leaderboards (which also pays coins), and pointer
   input in logical coordinates. Everything is drawn by the game; the kit only owns the overlays. */
(function(){
  if(window.AK) return;
  const ls={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CSS=`
  :root{--akbg:#0b1022;--akpanel:rgba(13,19,40,.92);--akline:rgba(148,163,184,.25);--akink:#f1f5f9;--akmute:#94a3b8;--akacc:#38bdf8}
  html,body{margin:0;height:100%;-webkit-user-select:none;user-select:none;background:var(--akbg);color:var(--akink);font-family:'Fredoka','Nunito',system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
  #akTop{position:fixed;left:0;right:0;top:0;height:52px;display:flex;align-items:center;gap:10px;padding:0 12px;z-index:5;background:linear-gradient(180deg,rgba(6,10,24,.85),rgba(6,10,24,0))}
  #akTop a,#akTop button{font:600 15px inherit;font-family:inherit;color:var(--akink);background:rgba(15,23,42,.75);border:1px solid var(--akline);border-radius:999px;padding:7px 14px;cursor:pointer;text-decoration:none;white-space:nowrap}
  #akTop a:hover,#akTop button:hover{border-color:var(--akacc)}
  #akTitle{font-weight:700;font-size:20px;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #akSp{flex:1}
  #akWrap{position:fixed;left:0;right:0;top:52px;bottom:62px;display:flex;align-items:center;justify-content:center}   /* the bottom strip is left for the site's chat / coins buttons */
  @media (max-width:700px){ #akWrap{bottom:70px} }
  #akCv{display:block;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.45);touch-action:none;background:#000}
  .akOv{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;background:rgba(3,6,16,.55);backdrop-filter:blur(3px)}
  .akCard{width:min(560px,92vw);max-height:calc(100vh - 90px);overflow:auto;background:var(--akpanel);border:1px solid var(--akline);border-radius:22px;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,.5);text-align:center}
  .akCard h1{margin:0 0 4px;font-size:38px;line-height:1.05;background:var(--akgrad,linear-gradient(90deg,#38bdf8,#a78bfa));-webkit-background-clip:text;background-clip:text;color:transparent}
  .akCard h2{margin:0 0 6px;font-size:28px}
  .akCard p{color:var(--akmute);margin:6px 0 14px;font-size:16px;line-height:1.4}
  .akBtns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:12px 0}
  .akBtn{font:700 18px inherit;font-family:inherit;color:#06101f;background:var(--akacc);border:0;border-radius:14px;padding:12px 20px;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.25);transition:transform .08s}
  .akBtn:hover{transform:translateY(-2px)} .akBtn:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
  .akBtn.alt{background:rgba(148,163,184,.18);color:var(--akink);box-shadow:none;border:1px solid var(--akline)}
  .akBtn small{display:block;font-size:12px;font-weight:600;opacity:.75}
  .akHow{text-align:left;margin:10px auto 0;padding:10px 14px;border-radius:14px;background:rgba(148,163,184,.08);font-size:15px;line-height:1.5;color:#cbd5e1;max-width:440px}
  .akHow b{color:#fff}
  .akBig{font-size:56px;font-weight:800;line-height:1;margin:6px 0}
  .akStat{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:6px 0 4px}
  .akStat div{background:rgba(148,163,184,.1);border-radius:12px;padding:8px 14px;min-width:90px}
  .akStat b{display:block;font-size:22px} .akStat span{font-size:12px;color:var(--akmute);text-transform:uppercase;letter-spacing:.06em}
  .akNew{display:inline-block;background:#fbbf24;color:#1f1300;border-radius:999px;padding:3px 12px;font-weight:800;font-size:14px;margin-bottom:6px;animation:akPop .5s ease}
  @keyframes akPop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
  #akToast{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:6;background:rgba(10,14,30,.9);border:1px solid var(--akline);border-radius:999px;padding:8px 18px;font-weight:700;opacity:0;transition:opacity .25s;pointer-events:none;max-width:88vw;text-align:center;font-size:15px;line-height:1.3}
  /* the site's floating buttons: lined up in the strip under the game instead of over it */
  #rrCoin{left:10px!important;right:auto!important;top:auto!important;bottom:12px!important}
  #rrAcctB{left:122px!important;right:auto!important;top:auto!important;bottom:14px!important}
  #rrGC{left:268px!important;right:auto!important;top:auto!important;bottom:10px!important;max-width:min(300px,30vw)!important}
  #rrpF{left:auto!important;right:220px!important;top:auto!important;bottom:12px!important}
  #btnKeys{left:auto!important;right:112px!important;top:auto!important;bottom:15px!important}
  #rrcF{left:auto!important;right:10px!important;top:auto!important;bottom:12px!important}
  #rrPhotoB{left:auto!important;right:186px!important;top:6px!important;bottom:auto!important;width:38px!important;height:38px!important}
  #rrEmoB{left:auto!important;right:230px!important;top:6px!important;bottom:auto!important;width:38px!important;height:38px!important}
  #rrTsC{left:50%!important;right:auto!important;transform:translateX(-50%)!important;bottom:1px!important;top:auto!important;opacity:.7}
  #akTop{padding-right:282px}
  @media (max-width:700px){ #rrGC,#rrAcctB{display:none!important} #akTop{padding-right:12px} #rrPhotoB,#rrEmoB{display:none!important} }
  @media (max-width:600px){ #akTitle{font-size:16px} #akTop a,#akTop button{padding:6px 10px;font-size:13px} .akCard h1{font-size:30px} }`;

  /* ---------- sound: tiny synth, no files ---------- */
  let AC=null, master=null, muted=ls.get('akMute','0')==='1';
  function audio(){ if(AC) return AC; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:.55; master.connect(AC.destination); }catch(e){ AC=null; } return AC; }
  function tone(f,d,type,v,slide,delay){ const a=audio(); if(!a||muted) return; const t=a.currentTime+(delay||0), o=a.createOscillator(), g=a.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t+d); g.gain.setValueAtTime(v||.15,t); g.gain.exponentialRampToValueAtTime(.0008,t+d); o.connect(g); g.connect(master); o.start(t); o.stop(t+d+.02); }
  function noise(d,v,freq,delay){ const a=audio(); if(!a||muted) return; const t=a.currentTime+(delay||0), n=Math.floor(a.sampleRate*d), b=a.createBuffer(1,n,a.sampleRate), ch=b.getChannelData(0); for(let i=0;i<n;i++) ch[i]=(Math.random()*2-1)*(1-i/n); const s=a.createBufferSource(); s.buffer=b; const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq||1800; const g=a.createGain(); g.gain.value=v||.2; s.connect(f); f.connect(g); g.connect(master); s.start(t); }
  const SFX={
    click:()=>tone(660,.05,'square',.05),
    pop:()=>{ tone(520,.08,'triangle',.14,900); },
    coin:()=>{ tone(988,.07,'square',.06); tone(1319,.12,'square',.06,0,.06); },
    hit:()=>{ noise(.06,.12,2400); tone(180,.06,'square',.05,90); },
    boom:()=>{ noise(.45,.35,700); tone(90,.4,'sine',.25,35); },
    laser:()=>tone(1200,.09,'sawtooth',.04,420),
    power:()=>{ for(let i=0;i<4;i++) tone(440*Math.pow(1.26,i),.09,'triangle',.08,0,i*.06); },
    jump:()=>tone(360,.14,'triangle',.11,760),
    swish:()=>noise(.12,.08,3200),
    lose:()=>{ tone(392,.18,'triangle',.12); tone(330,.18,'triangle',.12,0,.16); tone(262,.4,'triangle',.12,0,.32); },
    win:()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,.16,'triangle',.11,0,i*.11)); },
    combo:n=>tone(440+Math.min(12,n)*70,.1,'triangle',.1),
    zap:()=>{ tone(900,.12,'sawtooth',.05,140); noise(.05,.06,5000); },
    freeze:()=>tone(1500,.18,'sine',.05,700),
    step:()=>tone(240,.04,'square',.035)
  };
  function setMute(m){ muted=m; ls.set('akMute',m?'1':'0'); if(master) master.gain.value=m?0:.55; const b=document.getElementById('akMute'); if(b) b.textContent=m?'🔇':'🔊'; }

  /* ---------- the kit ---------- */
  const AK={ W:960, H:540, ctx:null, canvas:null, paused:false, running:false, keys:new Set(), t:0, mode:null, scale:1, sfx:(k,a)=>{ try{ SFX[k]&&SFX[k](a); }catch(e){} }, tone, noise, ls, esc };
  let cfg=null, ovEl=null, wrap=null, dpr=1, loopFns=null, last=0, toastT=null, inMenu=true;

  function fit(){ const cv=AK.canvas; if(!cv) return; const r=wrap.getBoundingClientRect(), pad=12, aw=Math.max(200,r.width-pad*2), ah=Math.max(150,r.height-pad*2), s=Math.min(aw/AK.W,ah/AK.H);
    const cw=Math.floor(AK.W*s), ch=Math.floor(AK.H*s); cv.style.width=cw+'px'; cv.style.height=ch+'px'; dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=Math.round(cw*dpr); cv.height=Math.round(ch*dpr); AK.scale=cw/AK.W; AK.ctx.setTransform(cv.width/AK.W,0,0,cv.height/AK.H,0,0); AK.ctx.imageSmoothingEnabled=true; if(loopFns&&loopFns.draw&&!AK.running) safeDraw(); }
  function toLogical(e){ const r=AK.canvas.getBoundingClientRect(); return { x:(e.clientX-r.left)/r.width*AK.W, y:(e.clientY-r.top)/r.height*AK.H }; }
  function safeDraw(){ try{ AK.ctx.save(); loopFns.draw(AK.ctx); AK.ctx.restore(); }catch(e){ console.error(e); } }

  function overlay(html){ closeOverlay(); ovEl=document.createElement('div'); ovEl.className='akOv'; ovEl.innerHTML=`<div class="akCard">${html}</div>`; wrap.appendChild(ovEl); ovEl.addEventListener('pointerdown',e=>e.stopPropagation()); return ovEl; }
  function closeOverlay(){ if(ovEl){ ovEl.remove(); ovEl=null; } }

  AK.best=(k)=>+ls.get('ak_'+cfg.id+'_'+(k||'best'),'0')||0;
  AK.toast=(t,ms)=>{ const el=document.getElementById('akToast'); if(!el) return; el.textContent=t; el.style.opacity='1'; clearTimeout(toastT); toastT=setTimeout(()=>{ el.style.opacity='0'; },ms||1600); };

  AK.menu=function(){ AK.running=false; AK.paused=false; inMenu=true; const best=AK.best();
    const modes=(cfg.modes&&cfg.modes.length?cfg.modes:[{k:'play',n:'Play'}]);
    const ov=overlay(`<h1>${esc(cfg.title)}</h1><p>${esc(cfg.sub||'')}</p>
      <div class="akBtns">${modes.map((m,i)=>`<button class="akBtn${i?' alt':''}" data-m="${esc(m.k)}">${esc(m.n)}${m.d?`<small>${esc(m.d)}</small>`:''}${m.best?`<small>Best: ${esc(m.best())}</small>`:''}</button>`).join('')}</div>
      ${best?`<div style="color:var(--akmute)">Your best: <b style="color:#fff">${esc(cfg.fmt?cfg.fmt(best):best)}</b></div>`:''}
      ${cfg.how?`<div class="akHow">${cfg.how}</div>`:''}
      <div class="akBtns"><button class="akBtn alt" data-lb="1">🏆 Leaderboard</button></div>`);
    ov.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ audio(); AK.sfx('click'); AK.start(b.dataset.m); });
    ov.querySelector('[data-lb]').onclick=()=>{ if(window.RRL) RRL.show(); else AK.toast('Leaderboards are loading…'); };
    if(loopFns) safeDraw(); };

  AK.start=function(mode){ closeOverlay(); inMenu=false; AK.mode=mode; AK.paused=false; AK.running=true; last=performance.now(); try{ cfg.onStart&&cfg.onStart(mode); }catch(e){ console.error(e); } AK.canvas.focus(); };

  AK.pause=function(p){ if(!AK.running||inMenu) return; AK.paused=p==null?!AK.paused:p; if(AK.paused){ const ov=overlay(`<h2>Paused</h2><div class="akBtns"><button class="akBtn" data-r>Resume</button><button class="akBtn alt" data-q>Quit to menu</button></div><p>P or Esc to resume · M to mute</p>`); ov.querySelector('[data-r]').onclick=()=>AK.pause(false); ov.querySelector('[data-q]').onclick=()=>{ try{ cfg.onQuit&&cfg.onQuit(); }catch(e){} AK.menu(); }; } else { closeOverlay(); last=performance.now(); } };

  /* end of a run: o = {score, txt, stats:[[label,value],...], title, win, board:'best'} */
  AK.over=function(o){ AK.running=false; inMenu=true; const k=o.board||'best', prev=AK.best(k), isNew=o.score>prev&&o.score>0; if(isNew) ls.set('ak_'+cfg.id+'_'+k,String(o.score));
    try{ if(window.RRL&&o.score>0) RRL.post(k,o.score,o.txt||String(o.score)); else if(o.score>0) dispatchEvent(new CustomEvent('rr-result',{detail:{id:k,score:o.score}})); }catch(e){}
    AK.sfx(o.win?'win':'lose');
    const ov=overlay(`${isNew?'<div class="akNew">NEW BEST!</div>':''}<h2>${esc(o.title||(o.win?'You win!':'Game over'))}</h2>
      <div class="akBig">${esc(cfg.fmt?cfg.fmt(o.score):o.score)}</div>
      ${o.stats&&o.stats.length?`<div class="akStat">${o.stats.map(([l,v])=>`<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`:''}
      <div style="color:var(--akmute);margin-top:6px">Best: ${esc(cfg.fmt?cfg.fmt(Math.max(prev,o.score)):Math.max(prev,o.score))}</div>
      <div class="akBtns"><button class="akBtn" data-a>${esc(o.again||'Play again')}</button><button class="akBtn alt" data-m>Menu</button><button class="akBtn alt" data-lb>🏆</button></div>`);
    ov.querySelector('[data-a]').onclick=()=>{ AK.sfx('click'); AK.start(AK.mode); }; ov.querySelector('[data-m]').onclick=()=>AK.menu(); ov.querySelector('[data-lb]').onclick=()=>{ if(window.RRL) RRL.show(); }; };

  AK.loop=function(update,draw){ loopFns={update,draw}; requestAnimationFrame(function f(now){ let dt=Math.min(.05,(now-last)/1000); last=now; if(document.hidden) dt=0;
      if(AK.running&&!AK.paused&&dt>0){ AK.t+=dt; try{ update(dt); }catch(e){ console.error(e); } }
      safeDraw(); requestAnimationFrame(f); }); };

  AK.init=function(c){ cfg=c; AK.W=c.W||960; AK.H=c.H||540; document.title='Arcade Rivals - '+c.title;
    const st=document.createElement('style'); st.textContent=CSS+(c.css||''); document.head.appendChild(st);
    if(c.accent) document.documentElement.style.setProperty('--akacc',c.accent); if(c.grad) document.documentElement.style.setProperty('--akgrad',c.grad);
    const top=document.createElement('div'); top.id='akTop'; top.innerHTML=`<a href="./" title="All games">← Games</a><div id="akTitle">${esc(c.icon||'')} ${esc(c.title)}</div><div id="akSp"></div><button id="akPause" title="Pause (P)">⏸</button><button id="akMute" title="Sound (M)">${muted?'🔇':'🔊'}</button><button id="akFs" title="Full screen">⛶</button>`;
    document.body.appendChild(top);
    wrap=document.createElement('div'); wrap.id='akWrap'; wrap.innerHTML='<canvas id="akCv" tabindex="0" aria-label="'+esc(c.title)+'"></canvas><div id="akToast"></div>'; document.body.appendChild(wrap);
    AK.canvas=document.getElementById('akCv'); AK.ctx=AK.canvas.getContext('2d');
    document.getElementById('akPause').onclick=()=>AK.pause(); document.getElementById('akMute').onclick=()=>{ audio(); setMute(!muted); };
    document.getElementById('akFs').onclick=()=>{ try{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }catch(e){} };
    addEventListener('resize',fit); fit(); setTimeout(fit,300);
    addEventListener('keydown',e=>{ const tg=e.target&&e.target.tagName; if(tg==='INPUT'||tg==='TEXTAREA') return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&!inMenu) e.preventDefault();
      if(e.code==='KeyM'){ audio(); setMute(!muted); return; }
      if((e.code==='KeyP'||e.code==='Escape')&&AK.running){ AK.pause(); return; }
      if(e.code==='Enter'&&inMenu&&ovEl){ const b=ovEl.querySelector('.akBtn'); if(b) b.click(); return; }
      if(e.repeat&&c.noRepeat) return; AK.keys.add(e.code); audio(); if(AK.running&&!AK.paused&&c.onKey) c.onKey(e.code,true,e); });
    addEventListener('keyup',e=>{ AK.keys.delete(e.code); if(AK.running&&!AK.paused&&c.onKey) c.onKey(e.code,false,e); });
    addEventListener('blur',()=>{ AK.keys.clear(); if(AK.running&&!AK.paused) AK.pause(true); });
    document.addEventListener('visibilitychange',()=>{ if(document.hidden&&AK.running&&!AK.paused) AK.pause(true); });
    const cv=AK.canvas; cv.addEventListener('pointerdown',e=>{ audio(); cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); if(AK.running&&!AK.paused&&c.onPointer) c.onPointer('down',toLogical(e),e); });
    cv.addEventListener('pointermove',e=>{ if(c.onPointer) c.onPointer('move',toLogical(e),e); });
    cv.addEventListener('pointerup',e=>{ if(AK.running&&!AK.paused&&c.onPointer) c.onPointer('up',toLogical(e),e); });
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    /* the leaderboard script loads after the game, so register the boards once it is there */
    let tries=0; const reg=()=>{ if(window.RRL&&c.boards){ RRL.boards(c.id,c.boards); return; } if(++tries<40) setTimeout(reg,250); }; reg();
    AK.menu(); };

  /* small drawing helpers shared by the games */
  AK.rr=(x,y,w,h,r)=>{ const g=AK.ctx; g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  AK.text=(t,x,y,size,col,align,weight,shadow)=>{ const g=AK.ctx; g.font=`${weight||700} ${size}px Fredoka,Nunito,system-ui,sans-serif`; g.textAlign=align||'left'; g.textBaseline='middle'; if(shadow!==false){ g.fillStyle='rgba(0,0,0,.45)'; g.fillText(t,x+2,y+2); } g.fillStyle=col||'#fff'; g.fillText(t,x,y); };
  AK.rand=(a,b)=>a+Math.random()*(b-a); AK.clamp=(v,a,b)=>v<a?a:v>b?b:v; AK.lerp=(a,b,t)=>a+(b-a)*t;
  window.AK=AK;
})();
