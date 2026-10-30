/* Home page backdrop: a night arena. Floodlight towers sweep their beams, camera flashes pop in the
   stands, a neon arcade grid rolls toward you and sports gear drifts through the air.
   Draws on <canvas id="arena">; holds still for reduced-motion and pauses when the tab is hidden. */
(function(){ const cv=document.getElementById('arena'); if(!cv||!cv.getContext) return; const ctx=cv.getContext('2d');
  const still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W=0,H=0,raf=0,last=0;
  function size(){ const d=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=Math.round(W*d); cv.height=Math.round(H*d); ctx.setTransform(d,0,0,d,0,0); if(still) draw(0); }
  const ICONS=['🏒','⚽','🏀','🏈','⚾','🎾','🏐','🥊','⛳','🎳','🏓','🛹','🏎️','🎣','🏄','🥏'];
  const R=Math.random;
  const gear=ICONS.map((ic,i)=>({ic,x:R(),y:R(),s:20+R()*30,v:.012+R()*.02,r:R()*6.3,vr:(R()-.5)*.5,a:.07+R()*.09,dx:(R()-.5)*.01}));
  const flashes=Array.from({length:70},()=>({x:R(),y:R(),t:R()*8,p:3+R()*6}));
  const TEAM=['#22d3ee','#a855f7','#f43f5e','#facc15','#22c55e','#3b82f6'];

  function draw(t){
    const hz=H*.64;
    /* night sky */
    let g=ctx.createLinearGradient(0,0,0,hz); g.addColorStop(0,'#02030a'); g.addColorStop(.6,'#060b1e'); g.addColorStop(1,'#120a2a');
    ctx.globalCompositeOperation='source-over'; ctx.fillStyle=g; ctx.fillRect(0,0,W,hz+1);
    /* stadium bowl on the horizon */
    const bw=W*.92, bh=Math.min(H*.2,170), bx=W/2, by=hz;
    ctx.fillStyle='#070c1d'; ctx.beginPath(); ctx.moveTo(bx-bw/2,by); ctx.quadraticCurveTo(bx-bw/2+30,by-bh,bx-bw*.3,by-bh*1.02); ctx.lineTo(bx+bw*.3,by-bh*1.02); ctx.quadraticCurveTo(bx+bw/2-30,by-bh,bx+bw/2,by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(120,140,220,.12)'; ctx.lineWidth=1; for(let k=1;k<6;k++){ const yy=by-bh*k/6.2; ctx.beginPath(); ctx.moveTo(bx-bw*(.48-k*.025),yy); ctx.lineTo(bx+bw*(.48-k*.025),yy); ctx.stroke(); }
    /* camera flashes in the stands */
    for(const f of flashes){ const ph=((t+f.t)%f.p)/f.p; if(ph<.035){ const a=1-ph/.035, x=bx-bw*.42+f.x*bw*.84, y=by-bh*.12-f.y*bh*.8; ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(x,y,1.6+a*1.6,0,7); ctx.fill(); } }
    /* floodlight towers + sweeping beams */
    ctx.globalCompositeOperation='lighter';
    const towers=[[W*.07,-1],[W*.93,1],[W*.3,-1],[W*.7,1]];
    towers.forEach(([x,side],i)=>{ const top=H*(i<2?.1:.2), sway=Math.sin(t*(.22+i*.05)+i*1.7)*.22, ang=Math.PI/2+side*(-.38)+sway, len=H*1.25, spread=i<2?.13:.08;
      const ex=x+Math.cos(ang)*len, ey=top+Math.sin(ang)*len, px=Math.cos(ang+Math.PI/2), py=Math.sin(ang+Math.PI/2), w=len*spread;
      const bg=ctx.createLinearGradient(x,top,ex,ey); const col=i<2?'255,255,255':(i===2?'34,211,238':'168,85,247'); bg.addColorStop(0,`rgba(${col},${i<2?.2:.12})`); bg.addColorStop(.55,`rgba(${col},.035)`); bg.addColorStop(1,`rgba(${col},0)`);
      ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(x-px*5,top-py*5); ctx.lineTo(x+px*5,top+py*5); ctx.lineTo(ex+px*w,ey+py*w); ctx.lineTo(ex-px*w,ey-py*w); ctx.closePath(); ctx.fill(); });
    ctx.globalCompositeOperation='source-over';
    towers.slice(0,2).forEach(([x])=>{ const top=H*.1; ctx.strokeStyle='#121a33'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(x,top+10); ctx.lineTo(x,hz); ctx.stroke();
      ctx.fillStyle='#0d1428'; ctx.fillRect(x-30,top-10,60,24); for(let r=0;r<2;r++) for(let c=0;c<5;c++){ const lx=x-24+c*12, ly=top-4+r*11; const gl=ctx.createRadialGradient(lx,ly,0,lx,ly,12); gl.addColorStop(0,'rgba(255,255,255,.95)'); gl.addColorStop(.25,'rgba(255,255,240,.5)'); gl.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=gl; ctx.fillRect(lx-12,ly-12,24,24); } });
    /* glowing horizon */
    const hg=ctx.createLinearGradient(0,0,W,0); hg.addColorStop(0,'rgba(168,85,247,0)'); hg.addColorStop(.25,'rgba(168,85,247,.9)'); hg.addColorStop(.5,'rgba(34,211,238,1)'); hg.addColorStop(.75,'rgba(244,63,94,.9)'); hg.addColorStop(1,'rgba(244,63,94,0)');
    ctx.save(); ctx.shadowColor='#22d3ee'; ctx.shadowBlur=24; ctx.fillStyle=hg; ctx.fillRect(0,hz-1.5,W,3); ctx.restore();
    /* arena floor: neon grid rolling toward you */
    g=ctx.createLinearGradient(0,hz,0,H); g.addColorStop(0,'#0f0726'); g.addColorStop(1,'#04020b'); ctx.fillStyle=g; ctx.fillRect(0,hz,W,H-hz);
    ctx.lineWidth=1.2; const vx=W/2, n=22;
    for(let i=-n;i<=n;i++){ const a=Math.max(0,.34-Math.abs(i)/n*.25); ctx.strokeStyle=`rgba(34,211,238,${a})`; ctx.beginPath(); ctx.moveTo(vx+i*W*.012,hz); ctx.lineTo(vx+i*W*.11,H); ctx.stroke(); }
    const sp=still?0:(t*.35)%1;
    for(let k=0;k<14;k++){ const p=(k+sp)/14, y=hz+(H-hz)*p*p; ctx.strokeStyle=`rgba(168,85,247,${.06+p*.45})`; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    /* center court logo glow */
    const cg=ctx.createRadialGradient(vx,hz+(H-hz)*.45,0,vx,hz+(H-hz)*.45,W*.28); cg.addColorStop(0,`${TEAM[Math.floor(t/6)%TEAM.length]}33`); cg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=cg; ctx.fillRect(0,hz,W,H-hz);
    /* sports gear drifting through the air */
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const o of gear){ ctx.save(); ctx.globalAlpha=o.a; ctx.translate(o.x*W,o.y*H); ctx.rotate(o.r); ctx.font=`${o.s}px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif`; ctx.fillText(o.ic,0,0); ctx.restore(); }
    /* vignette so the page content always reads clearly */
    const vg=ctx.createRadialGradient(W/2,H*.45,Math.min(W,H)*.25,W/2,H*.45,Math.max(W,H)*.75); vg.addColorStop(0,'rgba(2,3,10,0)'); vg.addColorStop(1,'rgba(2,3,10,.82)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    /* a few empty arcade machines standing on the floor at the sides */
    const big=Math.min(H*.42,W*.2);
    [[W*.165,H*.84,big*.66,'#f43f5e',1],[W*.835,H*.84,big*.66,'#facc15',3],[W*.045,H*.99,big,'#22d3ee',0],[W*.955,H*.99,big,'#a855f7',2]]
      .filter(c=>W>560||c[4]%2===0).forEach(([x,base,h,col,i])=>cabinet(x,base,h,col,t,i));
  }
  /* one upright cabinet: marquee, glowing screen running a little attract-mode game, controls, coin door */
  const MARQ=['HOCKEY','RACER','GOAL!','HOOPS'];
  function cabinet(x,base,h,col,t,i){ const w=h*.44, l=x-w/2, top=base-h;
    ctx.save();
    /* glow on the floor under it */
    const fg=ctx.createRadialGradient(x,base,0,x,base,w*1.3); fg.addColorStop(0,col+'55'); fg.addColorStop(1,col+'00'); ctx.fillStyle=fg; ctx.fillRect(x-w*1.4,base-w*.4,w*2.8,w*.8);
    /* body */
    ctx.fillStyle='#070b18'; ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.5,h*.008); ctx.shadowColor=col; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(l,top+h*.04); ctx.lineTo(l+w,top+h*.04); ctx.lineTo(l+w,top+h*.5); ctx.lineTo(l+w*1.06,top+h*.6); ctx.lineTo(l+w*1.02,base); ctx.lineTo(l-w*.02,base); ctx.lineTo(l-w*.06,top+h*.6); ctx.lineTo(l,top+h*.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    /* marquee */
    const mq=ctx.createLinearGradient(l,0,l+w,0); mq.addColorStop(0,col); mq.addColorStop(.5,'#ffffff'); mq.addColorStop(1,col);
    ctx.globalAlpha=.85; ctx.fillStyle=mq; ctx.fillRect(l+w*.04,top,w*.92,h*.1); ctx.globalAlpha=1;
    ctx.fillStyle='#05070f'; ctx.font=`900 ${Math.round(h*.06)}px 'Big Shoulders Display',Impact,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(MARQ[i%MARQ.length],x,top+h*.052);
    /* screen */
    const sx=l+w*.12, sy=top+h*.15, sw=w*.76, sh=h*.3;
    ctx.fillStyle='#02040a'; ctx.fillRect(sx-3,sy-3,sw+6,sh+6);
    const sg=ctx.createRadialGradient(x,sy+sh/2,0,x,sy+sh/2,sw*.8); sg.addColorStop(0,'#0b2a4a'); sg.addColorStop(1,'#020611'); ctx.fillStyle=sg; ctx.fillRect(sx,sy,sw,sh);
    ctx.save(); ctx.beginPath(); ctx.rect(sx,sy,sw,sh); ctx.clip(); const px=Math.max(2,sw/26);
    if(i%3===0){ /* pong rally */ const bx=sx+sw*(.5+.42*Math.sin(t*1.6)), by=sy+sh*(.5+.38*Math.sin(t*2.3)); ctx.fillStyle='#e0f2fe'; ctx.fillRect(sx+px,by-px*2.5,px,px*5); ctx.fillRect(sx+sw-px*2,sy+sh*(.5+.38*Math.sin(t*2.3-.4))-px*2.5,px,px*5); ctx.fillRect(bx-px/2,by-px/2,px,px); for(let k=0;k<sh;k+=px*2) ctx.fillRect(sx+sw/2-px/4,sy+k,px/2,px); }
    else if(i%3===1){ /* invaders marching */ const off=Math.sin(t*1.2)*sw*.12; ctx.fillStyle=col; for(let r=0;r<3;r++) for(let c=0;c<6;c++){ const ax=sx+sw*.16+c*sw*.12+off, ay=sy+sh*.18+r*sh*.17; ctx.fillRect(ax,ay,px*1.6,px); ctx.fillRect(ax-px*.4,ay+px,px*2.4,px*.8); } ctx.fillStyle='#4ade80'; ctx.fillRect(x+Math.sin(t*.9)*sw*.3-px,sy+sh*.86,px*2,px); }
    else { /* night racer */ ctx.fillStyle='#111827'; ctx.beginPath(); ctx.moveTo(x-sw*.08,sy); ctx.lineTo(x+sw*.08,sy); ctx.lineTo(x+sw*.48,sy+sh); ctx.lineTo(x-sw*.48,sy+sh); ctx.fill(); ctx.fillStyle='#fde047'; for(let k=0;k<5;k++){ const p=((k/5)+t*.8)%1, yy=sy+sh*p*p; ctx.fillRect(x-px*(.2+p*.6),yy,px*(.4+p*1.2),px*(.6+p*1.6)); } ctx.fillStyle=col; ctx.fillRect(x-px*2+Math.sin(t*1.3)*sw*.18,sy+sh*.78,px*4,px*2); }
    ctx.fillStyle='rgba(0,0,0,.28)'; for(let k=0;k<sh;k+=3) ctx.fillRect(sx,sy+k,sw,1);
    ctx.restore();
    ctx.fillStyle=col+'30'; ctx.fillRect(sx,sy,sw,sh); /* screen glow tint */
    /* control panel: stick + three buttons */
    ctx.fillStyle='#0d1428'; ctx.fillRect(l-w*.04,top+h*.53,w*1.08,h*.07);
    ctx.fillStyle='#e5e7eb'; ctx.fillRect(l+w*.24-1,top+h*.49,2,h*.05); ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(l+w*.24,top+h*.49,h*.018,0,7); ctx.fill();
    ['#22d3ee','#facc15','#22c55e'].forEach((bc,k)=>{ ctx.fillStyle=bc; ctx.shadowColor=bc; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(l+w*(.54+k*.15),top+h*.565,h*.014,0,7); ctx.fill(); }); ctx.shadowBlur=0;
    /* coin door */
    ctx.fillStyle='#0b1124'; ctx.fillRect(x-w*.18,top+h*.7,w*.36,h*.17); ctx.fillStyle='#f97316'; ctx.shadowColor='#f97316'; ctx.shadowBlur=10; ctx.fillRect(x-w*.1,top+h*.74,w*.06,h*.035); ctx.fillRect(x+w*.04,top+h*.74,w*.06,h*.035); ctx.shadowBlur=0;
    ctx.restore(); }
  function step(ts){ raf=requestAnimationFrame(step); if(ts-last<33) return; const dt=Math.min(.1,(ts-last)/1000||0); last=ts;
    for(const o of gear){ o.y-=o.v*dt; o.x+=o.dx*dt; o.r+=o.vr*dt; if(o.y<-.08){ o.y=1.08; o.x=R(); } if(o.x<-.05) o.x=1.05; if(o.x>1.05) o.x=-.05; }
    draw(ts/1000); }
  size(); addEventListener('resize',size);
  if(still) draw(0);
  else { raf=requestAnimationFrame(step); document.addEventListener('visibilitychange',()=>{ if(document.hidden){ cancelAnimationFrame(raf); raf=0; } else if(!raf){ last=0; raf=requestAnimationFrame(step); } }); }
})();
