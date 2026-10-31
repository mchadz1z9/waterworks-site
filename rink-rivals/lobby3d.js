/* Rink Rivals 3D arcade lobby: the home page backdrop is a real perspective-rendered arcade hall.
   Neon RINK RIVALS sign, jumbotrons with today's top players and the daily challenge, themed
   hockey / basketball / football / soccer machines, a trophy cabinet of real champions, bleachers,
   tables and hanging TVs, sweeping spotlights, floating particles and neon floor reflections.
   The camera drifts slowly and follows the mouse a little. Draws on <canvas id="arena">.
   Holds still for reduced motion; pauses while the tab is hidden. */
(function(){ const cv=document.getElementById('arena'); if(!cv||!cv.getContext) return; const ctx=cv.getContext('2d');
  const still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT="'Big Shoulders Display','Arial Narrow',Impact,sans-serif";
  let W=0,H=0,DPR=1,raf=0,last=0,mx=0,my=0,tmx=0,tmy=0;
  const R=Math.random;
  /* ---------- 3D math ---------- */
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}), dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>{ const l=Math.hypot(a.x,a.y,a.z)||1; return {x:a.x/l,y:a.y/l,z:a.z/l}; };
  const V=(x,y,z)=>({x,y,z});
  let cam=V(0,2,10.5), RT=V(1,0,0), UP=V(0,1,0), FW=V(0,0,-1), FOC=800, CX=0, CY=0;
  function setCam(t){ cam=V(Math.sin(t*.07)*.9+mx*.7, 2.05+Math.sin(t*.11)*.08-my*.18, 10.4+Math.sin(t*.05)*.3);
    const tg=V(cam.x*.3,2.75,-8); FW=norm(sub(tg,cam)); RT=norm(cross(FW,V(0,1,0))); UP=cross(RT,FW);
    FOC=Math.min(W*.62,H*1.05); CX=W/2; CY=H*.46; }
  function P(p){ const d=sub(p,cam), z=dot(d,FW); if(z<.08) return null; return {x:CX+dot(d,RT)*FOC/z, y:CY-dot(d,UP)*FOC/z, z}; }
  function poly(pts,fill,stroke,lw){ const q=pts.map(P); if(q.some(v=>!v)) return false; ctx.beginPath(); q.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)); ctx.closePath();
    if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.stroke(); } return true; }
  function line(a,b,col,lw){ const p=P(a), q=P(b); if(!p||!q) return; ctx.strokeStyle=col; ctx.lineWidth=lw||1; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); }
  /* draw an image onto a 3D quad (tl,tr,br,bl), in vertical strips so perspective looks right */
  function quadImg(img,tl,tr,br,bl,strips,alpha){ if(!img) return; const n=strips||6, iw=img.width, ih=img.height;
    ctx.save(); if(alpha!=null) ctx.globalAlpha=alpha;
    for(let i=0;i<n;i++){ const u0=i/n, u1=(i+1)/n, L=(a,b,u)=>V(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,a.z+(b.z-a.z)*u);
      const p0=P(L(tl,tr,u0)), p1=P(L(tl,tr,u1)), p2=P(L(bl,br,u1)), p3=P(L(bl,br,u0)); if(!p0||!p1||!p2||!p3) continue;
      ctx.save(); ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x+.6,p1.y); ctx.lineTo(p2.x+.6,p2.y); ctx.lineTo(p3.x,p3.y); ctx.closePath(); ctx.clip();
      const sx=u0*iw, sw=(u1-u0)*iw; ctx.setTransform(DPR*(p1.x-p0.x)/sw, DPR*(p1.y-p0.y)/sw, DPR*(p3.x-p0.x)/ih, DPR*(p3.y-p0.y)/ih, DPR*p0.x, DPR*p0.y);
      ctx.drawImage(img,sx,0,sw,ih,0,0,sw,ih); ctx.restore(); }
    ctx.restore(); }
  /* cuboid: base center (x,y,z), size w/h/d, yaw a; faces {front,back,left,right,top} colors; returns local->world */
  function rot(o,a){ const c=Math.cos(a), s=Math.sin(a); return (lx,ly,lz)=>V(o.x+lx*c+lz*s, o.y+ly, o.z-lx*s+lz*c); }
  function box(o,w,h,d,a,col,edge){ const L=rot(o,a), hw=w/2, hd=d/2;
    const c=[L(-hw,0,hd),L(hw,0,hd),L(hw,h,hd),L(-hw,h,hd),L(-hw,0,-hd),L(hw,0,-hd),L(hw,h,-hd),L(-hw,h,-hd)];
    const F=[[3,2,1,0,'front'],[6,7,4,5,'back'],[7,3,0,4,'left'],[2,6,5,1,'right'],[7,6,2,3,'top']];
    const vis=[]; for(const f of F){ const a3=c[f[0]],b3=c[f[1]],c3=c[f[2]]; const n=cross(sub(b3,a3),sub(c3,a3)); const mid=V((a3.x+c3.x)/2,(a3.y+c3.y)/2,(a3.z+c3.z)/2);
      if(dot(n,sub(cam,mid))>0) vis.push([f,dot(sub(mid,cam),sub(mid,cam))]); }
    vis.sort((x,y)=>y[1]-x[1]); for(const [f] of vis){ const fc=col[f[4]]||col.side||'#0a0e1c'; poly([c[f[0]],c[f[1]],c[f[2]],c[f[3]]],fc,edge||null,edge?1.4:0); }
    return L; }
  function glow(p3,r3,col,a){ const p=P(p3); if(!p) return; const r=r3*FOC/p.z; if(r<.5) return; const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.globalAlpha=a==null?1:a; ctx.fillStyle=g; ctx.fillRect(p.x-r,p.y-r,r*2,r*2); ctx.globalAlpha=1; }
  /* glowing ellipse lying on the floor (reflections / light pools) */
  function floorGlow(x,z,rx,rz,col,a){ const c=P(V(x,0,z)), e=P(V(x+rx,0,z)), f=P(V(x,0,z-rz)); if(!c||!e||!f) return; const sx=Math.abs(e.x-c.x)||1, sy=Math.max(1,Math.abs(f.y-c.y));
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(1,sy/sx); const g=ctx.createRadialGradient(0,0,0,0,0,sx); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.globalAlpha=a; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,sx,0,7); ctx.fill(); ctx.restore(); }
  function ellipse3(x,y,z,r,fill,stroke,lw){ const c=P(V(x,y,z)), e=P(V(x+r,y,z)), f=P(V(x,y,z-r)); if(!c||!e||!f) return; const rx=Math.abs(e.x-c.x), ry=Math.max(.5,Math.abs(f.y-c.y));
    ctx.beginPath(); ctx.ellipse(c.x,c.y,Math.max(.5,rx),ry,0,0,7); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.stroke(); } }

  /* ---------- offscreen art: sign, jumbotrons, machine fronts, screens ---------- */
  const mk=(w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  const sign=mk(1400,400);
  function drawSign(){ const g=sign.getContext('2d'); g.clearRect(0,0,1400,400);
    const rr=(x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
    g.lineJoin='round'; g.shadowColor='#22d3ee'; g.shadowBlur=30; g.strokeStyle='#67e8f9'; g.lineWidth=7; rr(28,24,1344,352,40); g.stroke(); g.shadowBlur=0; g.strokeStyle='#ecfeff'; g.lineWidth=2.5; rr(28,24,1344,352,40); g.stroke();
    g.textAlign='center'; g.textBaseline='middle';
    g.font=`900 196px ${FONT}`; for(const [b,c,w] of [[50,'#ff2fb3',16],[24,'#ff5fc8',9]]){ g.shadowColor='#ff2fb3'; g.shadowBlur=b; g.strokeStyle=c; g.lineWidth=w; g.strokeText('RINK RIVALS',700,168); }
    g.shadowBlur=18; g.shadowColor='#ffd1f0'; g.fillStyle='#fff0fa'; g.fillText('RINK RIVALS',700,168);
    g.font=`800 70px ${FONT}`; g.shadowColor='#22d3ee'; g.shadowBlur=26; g.strokeStyle='#22d3ee'; g.lineWidth=6; g.strokeText('★  A R C A D E  ★',700,300); g.shadowBlur=10; g.fillStyle='#e0faff'; g.fillText('★  A R C A D E  ★',700,300); }
  const jL=mk(720,420), jR=mk(720,420);
  let data=null;
  const fmt=s=>{ s=Math.round(s||0); const h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h?`${h}h ${m}m`:`${m}m`; };
  function drawJumbo(c,title,col,rows,t){ const g=c.getContext('2d'), w=c.width, h=c.height;
    const bg=g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#061226'); bg.addColorStop(1,'#020611'); g.fillStyle=bg; g.fillRect(0,0,w,h);
    g.fillStyle=col; g.fillRect(0,0,w,74); g.fillStyle='#020611'; g.font=`900 50px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(title,w/2,39);
    g.textAlign='left'; rows.forEach((r,i)=>{ const y=118+i*58; g.fillStyle=i%2?'rgba(255,255,255,.04)':'rgba(255,255,255,.08)'; g.fillRect(16,y-26,w-32,52);
      g.font=`900 40px ${FONT}`; g.fillStyle=r.c||'#e2e8f0'; g.fillText(r.a,32,y+2); g.textAlign='right'; g.fillStyle=r.c2||'#fbbf24'; g.fillText(r.b||'',w-32,y+2); g.textAlign='left'; });
    g.fillStyle='rgba(0,0,0,.25)'; for(let y=(t*40)%4;y<h;y+=4) g.fillRect(0,y,w,1.4);
    const sh=g.createLinearGradient(0,0,w,h); sh.addColorStop(0,'rgba(255,255,255,.07)'); sh.addColorStop(.4,'rgba(255,255,255,0)'); g.fillStyle=sh; g.fillRect(0,0,w,h); }
  function drawJumbos(t){ const M=['🥇','🥈','🥉'];
    const b=(data&&data.board)||[]; const rowsL=b.length?b.slice(0,5).map((x,i)=>({a:`${M[i]||'#'+(i+1)}  ${x.name}`,b:fmt(x.s)})):[{a:'Be the first to play',b:'',c:'#94a3b8'},{a:'today and take #1!',b:'',c:'#94a3b8'}];
    drawJumbo(jL,'TOP PLAYERS TODAY','#fbbf24',rowsL,t);
    const ch=data&&data.chal; let rowsR;
    if(ch){ const words=String(ch.goal).toUpperCase().split(' '), lines=['']; for(const w of words){ if((lines[lines.length-1]+' '+w).trim().length>22) lines.push(w); else lines[lines.length-1]=(lines[lines.length-1]+' '+w).trim(); }
      rowsR=[{a:ch.game||'Any game',b:'',c:'#67e8f9'},...lines.slice(0,3).map(l=>({a:l,b:'',c:'#fff'})),{a:ch.winner?'WINNER':'PRIZE',b:ch.winner?ch.winner:(ch.prizes&&ch.prizes[0]||''),c:'#94a3b8',c2:'#4ade80'}]; }
    else rowsR=[{a:'New challenge',b:'',c:'#e2e8f0'},{a:'coming soon!',b:'',c:'#e2e8f0'},{a:'Check back later',b:'',c:'#94a3b8'}];
    drawJumbo(jR,'DAILY CHALLENGE','#22d3ee',rowsR,t); }
  /* upright cabinet front art */
  function cabFront(title,col){ const c=mk(220,480), g=c.getContext('2d');
    const bg=g.createLinearGradient(0,0,0,480); bg.addColorStop(0,'#0d1430'); bg.addColorStop(1,'#05070f'); g.fillStyle=bg; g.fillRect(0,0,220,480);
    const mq=g.createLinearGradient(0,0,220,0); mq.addColorStop(0,col); mq.addColorStop(.5,'#ffffff'); mq.addColorStop(1,col); g.fillStyle=mq; g.fillRect(8,6,204,62);
    g.fillStyle='#05070f'; g.font=`900 ${title.length>8?32:42}px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(title,110,38);
    g.fillStyle='#000'; g.fillRect(18,86,184,150); g.strokeStyle=col; g.lineWidth=4; g.strokeRect(16,84,188,154);
    g.fillStyle='#111a33'; g.fillRect(0,262,220,58); g.fillStyle='#e5e7eb'; g.fillRect(52,262,6,22); g.fillStyle='#ef4444'; g.beginPath(); g.arc(55,262,13,0,7); g.fill();
    ['#22d3ee','#facc15','#22c55e'].forEach((b,i)=>{ g.fillStyle=b; g.beginPath(); g.arc(112+i*34,294,11,0,7); g.fill(); });
    g.fillStyle='#0b1124'; g.fillRect(64,350,92,92); g.fillStyle='#f97316'; g.fillRect(80,368,20,12); g.fillRect(120,368,20,12);
    g.strokeStyle=col; g.lineWidth=3; g.strokeRect(2,2,216,476); return c; }
  /* little animated game screens */
  const scr={hock:mk(200,240),foot:mk(184,150),gen1:mk(184,150),gen2:mk(184,150),tv1:mk(256,150),tv2:mk(256,150),foos:mk(200,320),hoop:mk(220,90)};
  function drawScreens(t){
    { const g=scr.foot.getContext('2d'); g.fillStyle='#14532d'; g.fillRect(0,0,184,150); g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=2; for(let x=12;x<184;x+=20){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,150); g.stroke(); }
      const bx=92+Math.sin(t*1.3)*60, by=75+Math.sin(t*2.1)*40; g.fillStyle='#7c4a1e'; g.beginPath(); g.ellipse(bx,by,10,6,t,0,7); g.fill(); g.fillStyle='#fff'; g.font=`900 22px ${FONT}`; g.fillText('TD!',8,22); }
    { const g=scr.gen1.getContext('2d'); g.fillStyle='#030712'; g.fillRect(0,0,184,150); const off=Math.sin(t*1.2)*24; g.fillStyle='#f43f5e'; for(let r=0;r<3;r++) for(let c=0;c<6;c++) g.fillRect(24+c*24+off,20+r*20,14,9); g.fillStyle='#4ade80'; g.fillRect(84+Math.sin(t)*60,132,18,8); }
    { const g=scr.gen2.getContext('2d'); g.fillStyle='#111827'; g.fillRect(0,0,184,150); g.fillStyle='#1f2937'; g.beginPath(); g.moveTo(80,0); g.lineTo(104,0); g.lineTo(184,150); g.lineTo(0,150); g.fill();
      g.fillStyle='#fde047'; for(let k=0;k<6;k++){ const p=((k/6)+t*.7)%1; g.fillRect(90-p*4,p*p*150,4+p*8,4+p*12); } g.fillStyle='#22d3ee'; g.fillRect(80+Math.sin(t*1.4)*50,118,24,14); }
    { const g=scr.hock.getContext('2d'); g.fillStyle='#dbeafe'; g.fillRect(0,0,200,240); g.strokeStyle='#ef4444'; g.lineWidth=4; g.beginPath(); g.moveTo(0,120); g.lineTo(200,120); g.stroke(); g.strokeStyle='#2563eb'; g.beginPath(); g.moveTo(0,70); g.lineTo(200,70); g.moveTo(0,170); g.lineTo(200,170); g.stroke();
      g.beginPath(); g.arc(100,120,30,0,7); g.stroke(); g.fillStyle='#0f172a'; g.fillRect(70,0,60,8); g.fillRect(70,232,60,8);
      const px=100+Math.sin(t*2.3)*80, py=120+Math.sin(t*1.7)*100; g.fillStyle='#111'; g.beginPath(); g.arc(px,py,9,0,7); g.fill();
      g.fillStyle='#ef4444'; g.beginPath(); g.arc(100+Math.sin(t*2.3-.3)*60,28,14,0,7); g.fill(); g.fillStyle='#2563eb'; g.beginPath(); g.arc(100+Math.sin(t*2.3+.3)*60,212,14,0,7); g.fill(); }
    { const g=scr.foos.getContext('2d'); g.fillStyle='#15803d'; g.fillRect(0,0,200,320); g.fillStyle='rgba(255,255,255,.08)'; for(let y=0;y<320;y+=40) g.fillRect(0,y,200,20);
      g.strokeStyle='#fff'; g.lineWidth=3; g.strokeRect(6,6,188,308); g.beginPath(); g.moveTo(6,160); g.lineTo(194,160); g.stroke(); g.beginPath(); g.arc(100,160,30,0,7); g.stroke(); g.strokeRect(60,6,80,30); g.strokeRect(60,284,80,30);
      g.fillStyle='#fff'; g.beginPath(); g.arc(100+Math.sin(t*2)*70,160+Math.sin(t*1.3)*120,7,0,7); g.fill(); }
    { const g=scr.hoop.getContext('2d'); g.fillStyle='#020611'; g.fillRect(0,0,220,90); g.fillStyle='#f97316'; g.font=`900 40px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('HOOPS  '+String(Math.floor(t*1.5)%100).padStart(2,'0'),110,46); }
    for(const [k,a,b] of [['tv1','#0c4a6e','#1d4ed8'],['tv2','#7f1d1d','#ea580c']]){ const g=scr[k].getContext('2d'); const bg=g.createLinearGradient(0,0,256,150); bg.addColorStop(0,a); bg.addColorStop(1,b); g.fillStyle=bg; g.fillRect(0,0,256,150);
      g.fillStyle='rgba(255,255,255,.85)'; g.font=`900 26px ${FONT}`; g.fillText(k==='tv1'?'LIVE · HOCKEY':'LIVE · HOOPS',12,30); g.font=`900 54px ${FONT}`; g.fillText(`${2+Math.floor(t/9)%4} - ${1+Math.floor(t/13)%3}`,60,100);
      g.fillStyle='rgba(0,0,0,.25)'; for(let y=(t*30)%3;y<150;y+=3) g.fillRect(0,y,256,1); } }
  const fronts={foot:cabFront('GRIDIRON','#f59e0b'),gen1:cabFront('INVADERS','#f43f5e'),gen2:cabFront('TURBO','#22d3ee'),pong:cabFront('SLAPSHOT','#a855f7')};
  /* trophy cabinet art */
  const cup=mk(90,120); (function(){ const g=cup.getContext('2d'); const gd=g.createLinearGradient(0,0,90,0); gd.addColorStop(0,'#92400e'); gd.addColorStop(.35,'#fde68a'); gd.addColorStop(.6,'#f59e0b'); gd.addColorStop(1,'#78350f');
    g.fillStyle=gd; g.beginPath(); g.moveTo(15,8); g.lineTo(75,8); g.quadraticCurveTo(74,58,45,66); g.quadraticCurveTo(16,58,15,8); g.fill(); g.lineWidth=7; g.strokeStyle=gd; g.beginPath(); g.arc(14,26,12,1.4,4.9); g.stroke(); g.beginPath(); g.arc(76,26,12,-1.75,1.75); g.stroke();
    g.fillRect(40,64,10,22); g.fillRect(26,86,38,10); g.fillStyle='#3f2a14'; g.fillRect(20,96,50,20); })();
  const plaque=mk(640,90); function drawPlaque(){ const g=plaque.getContext('2d'); g.clearRect(0,0,640,90); const gd=g.createLinearGradient(0,0,0,90); gd.addColorStop(0,'#fde68a'); gd.addColorStop(1,'#b45309'); g.fillStyle=gd; g.fillRect(0,0,640,90); g.fillStyle='#3f2a14'; g.font=`900 54px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('🏆 HALL OF CHAMPIONS',320,48); }
  const tags=[mk(220,52),mk(220,52),mk(220,52),mk(220,52),mk(220,52),mk(220,52)];
  function drawTags(){ const ch=(data&&data.champs)||[]; tags.forEach((c,i)=>{ const g=c.getContext('2d'); g.fillStyle='#1c1206'; g.fillRect(0,0,220,52); g.strokeStyle='#f59e0b'; g.lineWidth=3; g.strokeRect(2,2,216,48);
    g.fillStyle=ch[i]?'#fde68a':'#6b5a3a'; g.font=`900 ${ch[i]?30:26}px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(ch[i]?String(ch[i].name).slice(0,14):'— your name? —',110,28); }); }

  /* ---------- scene ---------- */
  const parts=Array.from({length:110},()=>({x:(R()-.5)*19,y:R()*6.2,z:-7.6+R()*14,v:.04+R()*.12,ph:R()*6.3,s:.012+R()*.02}));
  const spots=[{x:-5,z:-3,c:'34,211,238',sp:.23,ph:0},{x:5,z:-3,c:'244,63,94',sp:.19,ph:2},{x:-1.5,z:0,c:'168,85,247',sp:.27,ph:4},{x:2,z:-6,c:'251,191,36',sp:.15,ph:1}];
  function scene(t){
    ctx.globalCompositeOperation='source-over';
    /* room shell */
    poly([V(-10,6.5,-8),V(10,6.5,-8),V(10,6.5,8),V(-10,6.5,8)],'#05060f');
    for(let z=-8;z<=8;z+=2.4) line(V(-10,6.45,z),V(10,6.45,z),'rgba(80,90,140,.25)',2);
    const wt=P(V(0,6.5,-8)), wb=P(V(0,0,-8)); let g=ctx.createLinearGradient(0,wt?wt.y:0,0,wb?wb.y:H); g.addColorStop(0,'#0a0820'); g.addColorStop(1,'#140b2c');
    poly([V(-10,0,-8),V(10,0,-8),V(10,6.5,-8),V(-10,6.5,-8)],g);
    for(let x=-9;x<=9;x+=1.5) line(V(x,0,-7.99),V(x,6.5,-7.99),'rgba(120,110,200,.08)',1);
    poly([V(-10,0,-8),V(-10,0,8),V(-10,6.5,8),V(-10,6.5,-8)],'#07081a'); poly([V(10,0,-8),V(10,6.5,-8),V(10,6.5,8),V(10,0,8)],'#07081a');
    /* floor */
    poly([V(-10,0,-8),V(10,0,-8),V(10,0,8),V(-10,0,8)],'#05040c');
    ctx.lineWidth=1; for(let x=-10;x<=10;x+=1) line(V(x,0,-8),V(x,0,8),'rgba(34,211,238,.10)'); for(let z=-8;z<=8;z+=1) line(V(-10,0,z),V(10,0,z),'rgba(168,85,247,.10)');
    /* neon strips where walls meet floor/ceiling */
    ctx.save(); ctx.shadowBlur=14;
    for(const [a,b,c] of [[V(-10,.04,-8),V(10,.04,-8),'#ff2fb3'],[V(-9.98,.04,-8),V(-9.98,.04,8),'#22d3ee'],[V(9.98,.04,-8),V(9.98,.04,8),'#22d3ee'],[V(-10,6.3,-7.98),V(10,6.3,-7.98),'#a855f7']]){ ctx.shadowColor=c; line(a,b,c,3); }
    ctx.restore();
    /* reflections on the floor */
    floorGlow(0,-6.4,6.5,2.2,'rgba(255,47,179,.55)',.6+.1*Math.sin(t*3)); floorGlow(-8,-6.6,2.5,1.4,'rgba(251,191,36,.5)',.5); floorGlow(8,-6.6,2.5,1.4,'rgba(34,211,238,.5)',.5);
    floorGlow(0,-1.5,4.2,4.2,'rgba(99,102,241,.35)',.55);
    for(const s of spots){ const sw=Math.sin(t*s.sp+s.ph)*3; floorGlow(s.x+sw,s.z+Math.cos(t*s.sp+s.ph)*1.5,1.6,1.6,`rgba(${s.c},.55)`,.7); }
    /* center floor logo ring */
    ctx.save(); ctx.shadowColor='#22d3ee'; ctx.shadowBlur=16; ellipse3(0,.02,-1.5,3,null,'rgba(34,211,238,.7)',2.5); ellipse3(0,.02,-1.5,2.4,null,'rgba(255,47,179,.5)',1.5); ctx.restore();
    /* back wall: sign + jumbotrons */
    const flick=(Math.sin(t*37)>.985||Math.sin(t*23+1)>.992)?.55:1;
    glow(V(0,4.6,-7.9),7,'rgba(255,47,179,.35)',.9);
    quadImg(sign,V(-5.6,6.15,-7.95),V(5.6,6.15,-7.95),V(5.6,2.95,-7.95),V(-5.6,2.95,-7.95),10,flick);
    for(const [img,x0,x1,col] of [[jL,-9.8,-6.15,'#fbbf24'],[jR,6.15,9.8,'#22d3ee']]){ poly([V(x0-.15,5.75,-7.95),V(x1+.15,5.75,-7.95),V(x1+.15,3.3,-7.95),V(x0-.15,3.3,-7.95)],'#0b1022',col,2);
      quadImg(img,V(x0,5.62,-7.93),V(x1,5.62,-7.93),V(x1,3.42,-7.93),V(x0,3.42,-7.93),6); glow(V((x0+x1)/2,4.5,-7.8),2.6,hexA(col,.25),.6); }
    /* objects, far to near */
    const objs=[];
    objs.push({z:-7.5,f:()=>trophyCab(V(8,0,-7.45))});
    objs.push({z:-7.4,f:()=>{ upright(V(-9.1,0,-7.35),0,fronts.gen1,scr.gen1,'#f43f5e'); upright(V(-8.05,0,-7.35),0,fronts.pong,scr.gen2,'#a855f7'); }});
    objs.push({z:-4.6,f:()=>hoops(V(-6.6,0,-4.6),t)});
    objs.push({z:-4.2,f:()=>{ upright(V(9.45,0,-5.0),-Math.PI/2,fronts.foot,scr.foot,'#f59e0b'); upright(V(9.45,0,-3.9),-Math.PI/2,fronts.gen2,scr.gen2,'#22d3ee'); }});
    objs.push({z:-1.4,f:()=>{ upright(V(-9.45,0,-2.2),Math.PI/2,fronts.gen2,scr.gen2,'#22d3ee'); upright(V(-9.45,0,-1.0),Math.PI/2,fronts.gen1,scr.gen1,'#f43f5e'); upright(V(9.45,0,-1.6),-Math.PI/2,fronts.pong,scr.gen1,'#a855f7'); }});
    objs.push({z:2,f:()=>{ tv(V(-3.4,5.3,2),scr.tv1); tv(V(3.4,5.3,2),scr.tv2); }});
    objs.push({z:-.6,f:()=>airHockey(V(-6.1,0,-.6))});
    objs.push({z:-.6,f:()=>foosball(V(6.1,0,-.6))});
    objs.push({z:1.5,f:()=>{ bleachers(-1); bleachers(1); }});
    objs.push({z:3,f:()=>{ table(-3.4,3.2); table(3.4,3.2); }});
    objs.sort((a,b)=>a.z-b.z); for(const o of objs) o.f();
    /* spotlight cones from the ceiling */
    ctx.globalCompositeOperation='lighter';
    for(const s of spots){ const sw=Math.sin(t*s.sp+s.ph)*3, top=P(V(s.x,6.4,s.z)), bx=s.x+sw, bz=s.z+Math.cos(t*s.sp+s.ph)*1.5, l=P(V(bx-1.5,0,bz)), r=P(V(bx+1.5,0,bz)); if(!top||!l||!r) continue;
      const gg=ctx.createLinearGradient(top.x,top.y,(l.x+r.x)/2,l.y); gg.addColorStop(0,`rgba(${s.c},.32)`); gg.addColorStop(1,`rgba(${s.c},0)`); ctx.fillStyle=gg;
      ctx.beginPath(); ctx.moveTo(top.x-3,top.y); ctx.lineTo(top.x+3,top.y); ctx.lineTo(r.x,r.y); ctx.lineTo(l.x,l.y); ctx.closePath(); ctx.fill(); glow(V(s.x,6.35,s.z),.35,`rgba(${s.c},.9)`,1); }
    /* floating particles */
    for(const p of parts){ const q=P(V(p.x+Math.sin(t*.3+p.ph)*.3,p.y,p.z)); if(!q) continue; const r=Math.max(.6,p.s*FOC/q.z); ctx.fillStyle=`rgba(200,220,255,${.25+.25*Math.sin(t*2+p.ph)})`; ctx.fillRect(q.x-r/2,q.y-r/2,r,r); }
    ctx.globalCompositeOperation='source-over';
    /* vignette */
    const vg=ctx.createRadialGradient(W/2,H*.45,Math.min(W,H)*.3,W/2,H*.45,Math.max(W,H)*.78); vg.addColorStop(0,'rgba(2,3,10,0)'); vg.addColorStop(1,'rgba(2,3,10,.78)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); }

  /* ---------- props ---------- */
  function upright(o,a,front,screen,col){ const L=box(o,.86,2.05,.82,a,{front:'#0b1022',side:'#0a0f20',left:'#0d1328',right:'#0d1328',top:'#111a33'},col);
    const f=(x,y)=>L(x,y,.411);
    const toCam=dot(sub(cam,L(0,1,.41)),sub(L(0,1,.41),L(0,1,0)))>0; if(!toCam) return;
    quadImg(front,f(-.43,2.05),f(.43,2.05),f(.43,0),f(-.43,0),4);
    quadImg(screen,f(-.34,1.68),f(.34,1.68),f(.34,1.07),f(-.34,1.07),3);
    glow(L(0,1.4,.6),.9,hexA(col,.35),.8); }
  function label(p3,text,col){ const c=P(p3); if(!c) return; ctx.save(); ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=10; ctx.font=`900 ${Math.max(6,.26*FOC/c.z)}px ${FONT}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,c.x,c.y); ctx.restore(); }
  function hexA(h,a){ const n=parseInt(h.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
  function airHockey(o){ const L=box(o,1.3,.82,2.4,0,{front:'#0c1230',left:'#0c1230',right:'#0c1230',top:'#0c1230'},'#38bdf8');
    quadImg(scr.hock,L(-.6,.83,-1.15),L(.6,.83,-1.15),L(.6,.83,1.15),L(-.6,.83,1.15),6);
    label(L(0,.45,1.21),'AIR HOCKEY','#7dd3fc');
    glow(L(0,.9,0),1.6,'rgba(56,189,248,.28)',.8); }
  function foosball(o){ const L=box(o,1.35,.86,2.2,0,{front:'#3f2a14',left:'#4a3218',right:'#4a3218',top:'#3f2a14'},'#facc15');
    quadImg(scr.foos,L(-.6,.87,-1.02),L(.6,.87,-1.02),L(.6,.87,1.02),L(-.6,.87,1.02),6);
    for(let i=0;i<8;i++){ const z=-.9+i*.257, y=1.0; line(L(-.95,y,z),L(.95,y,z),'#cbd5e1',2.2); const team=i%2?'#ef4444':'#3b82f6';
      for(let k=-1;k<=1;k++){ const p=P(L(k*.32+Math.sin(Date.now()/600+i)*.05,y-.06,z)); if(p){ const s=Math.max(1.5,.07*FOC/p.z); ctx.fillStyle=team; ctx.fillRect(p.x-s/2,p.y-s,s,s*1.6); } }
      const hd=P(L(i%2?.98:-.98,y,z)); if(hd){ ctx.fillStyle='#111827'; const s=Math.max(2,.08*FOC/hd.z); ctx.fillRect(hd.x-s,hd.y-s/2,s*2,s); } }
    label(L(0,.45,1.11),'FOOSBALL','#fde047');
    glow(L(0,.9,0),1.6,'rgba(250,204,21,.22)',.8); }
  function hoops(o,t){ const L=box(o,1.35,1.0,2.5,0,{front:'#7c2d12',left:'#9a3412',right:'#9a3412',top:'#c2410c'},'#fb923c');
    for(const x of [-.66,.66]){ line(L(x,1,-1.2),L(x,3.4,-1.2),'#94a3b8',3); line(L(x,1,1.2),L(x,1.9,-1.2),'rgba(203,213,225,.35)',1); }
    poly([L(-.6,3.25,-1.18),L(.6,3.25,-1.18),L(.6,2.45,-1.18),L(-.6,2.45,-1.18)],'rgba(226,232,240,.85)','#fff',2);
    poly([L(-.22,2.95,-1.17),L(.22,2.95,-1.17),L(.22,2.6,-1.17),L(-.22,2.6,-1.17)],null,'#ef4444',2);
    quadImg(scr.hoop,L(-.62,3.75,-1.2),L(.62,3.75,-1.2),L(.62,3.36,-1.2),L(-.62,3.36,-1.2),3);
    const rim=L(0,2.55,-.92); ctx.save(); ctx.shadowColor='#f97316'; ctx.shadowBlur=8; ellipse3(rim.x,rim.y,rim.z,.24,null,'#f97316',3); ctx.restore();
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; line(V(rim.x+Math.cos(a)*.24,rim.y,rim.z+Math.sin(a)*.24),V(rim.x+Math.cos(a)*.13,rim.y-.42,rim.z+Math.sin(a)*.13),'rgba(255,255,255,.6)',1); }
    const ph=(t*.55)%1, bx=Math.sin(t*.9)*.3*(1-ph), by=1.15+Math.sin(ph*Math.PI)*1.9+ph*.4, bz=.9-ph*1.82, b=P(L(bx,by,bz)); if(b){ const r=Math.max(2,.12*FOC/b.z); ctx.fillStyle='#ea580c'; ctx.beginPath(); ctx.arc(b.x,b.y,r,0,7); ctx.fill(); ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke(); }
    glow(L(0,1,0),1.8,'rgba(249,115,22,.25)',.8); }
  function trophyCab(o){ const L=box(o,3.4,2.75,.6,0,{front:'rgba(20,30,60,.35)',left:'#2a1a08',right:'#2a1a08',top:'#3f2a14'},'#f59e0b');
    for(const y of [.05,.95,1.75,2.5]) line(L(-1.68,y,.3),L(1.68,y,.3),'#b45309',3);
    const ch=(data&&data.champs)||[];
    let i=0; for(const [y,n] of [[1.0,3],[1.8,3]]) for(let k=0;k<n;k++,i++){ const x=-1.1+k*1.1, base=P(L(x,y,.05)), top=P(L(x,y+.62,.05)); if(base&&top){ const h=base.y-top.y, w=h*.75; ctx.globalAlpha=ch[i]?1:.35; ctx.drawImage(cup,base.x-w/2,top.y,w,h); ctx.globalAlpha=1; }
      quadImg(tags[i],L(x-.45,y-.02,.31),L(x+.45,y-.02,.31),L(x+.45,y-.22,.31),L(x-.45,y-.22,.31),2); }
    quadImg(plaque,L(-1.5,2.72,.31),L(1.5,2.72,.31),L(1.5,2.52,.31),L(-1.5,2.52,.31),4);
    poly([L(-1.7,2.5,.31),L(1.7,2.5,.31),L(1.7,.05,.31),L(-1.7,.05,.31)],'rgba(180,220,255,.05)','rgba(253,230,138,.5)',1.5);
    glow(L(0,1.6,.4),2.4,'rgba(251,191,36,.22)',.9); }
  function tv(c,img){ line(V(c.x-.5,6.5,c.z),V(c.x-.5,c.y+.5,c.z),'#1f2937',2); line(V(c.x+.5,6.5,c.z),V(c.x+.5,c.y+.5,c.z),'#1f2937',2);
    poly([V(c.x-1.02,c.y+.6,c.z),V(c.x+1.02,c.y+.6,c.z),V(c.x+1.02,c.y-.6,c.z),V(c.x-1.02,c.y-.6,c.z)],'#05070f','#334155',2);
    quadImg(img,V(c.x-.95,c.y+.53,c.z+.01),V(c.x+.95,c.y+.53,c.z+.01),V(c.x+.95,c.y-.53,c.z+.01),V(c.x-.95,c.y-.53,c.z+.01),4); }
  function table(x,z){ for(const [sx,sz] of [[-.75,.1],[.75,.1],[0,.75]]){ line(V(x+sx,0,z+sz),V(x+sx,.72,z+sz),'#475569',2.5); ellipse3(x+sx,.74,z+sz,.2,'#1e1b4b','#a855f7',1.5); }
    line(V(x,0,z),V(x,1.05,z),'#64748b',4); ctx.save(); ctx.shadowColor='#22d3ee'; ctx.shadowBlur=10; ellipse3(x,1.06,z,.55,'#0f172a','#22d3ee',2.5); ctx.restore();
    const cup2=P(V(x+.15,1.12,z)); if(cup2){ const s=Math.max(1.5,.08*FOC/cup2.z); ctx.fillStyle='#f43f5e'; ctx.fillRect(cup2.x-s/2,cup2.y-s*1.4,s,s*1.4); } }
  function bleachers(side){ const zc=2.2, len=2.8, seat=side<0?['#b91c1c','#ef4444']:['#1d4ed8','#3b82f6'];
    for(let r=2;r>=0;r--){ const x=side*(5.6+r*.78), h=.38+r*.4;   /* tiers step up toward the wall, seats face the arcade floor */
      box(V(x,0,zc),.78,h,len,0,{front:'#1b2244',top:'#262f5c',left:'#1b2244',right:'#1b2244'},'rgba(129,140,248,.55)');
      for(let k=0;k<5;k++){ const z=zc-len/2+.32+k*((len-.64)/4); box(V(x+side*.14,h,z),.36,.3,.38,0,{front:seat[0],top:seat[1],left:seat[0],right:seat[0]},'rgba(0,0,0,.4)');
        box(V(x+side*.33,h,z),.08,.5,.38,0,{front:seat[0],top:seat[1],left:seat[0],right:seat[0]}); } } }

  /* ---------- loop ---------- */
  function size(){ DPR=Math.min(W<700?1:2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); if(still) frame(10); }
  let artT=0;
  function frame(t){ ctx.setTransform(DPR,0,0,DPR,0,0); setCam(t); if(t-artT>.08||still){ artT=t; drawScreens(t); } scene(t); }
  let jT=-9;
  function step(ts){ raf=requestAnimationFrame(step); if(ts-last<(W<700?42:33)) return; last=ts; const t=ts/1000; mx+=(tmx-mx)*.04; my+=(tmy-my)*.04;
    for(const p of parts){ p.y+=p.v*.03; if(p.y>6.3){ p.y=0; } } if(t-jT>1.2){ jT=t; drawJumbos(t); } frame(t); }
  addEventListener('pointermove',e=>{ tmx=(e.clientX/innerWidth-.5)*2; tmy=(e.clientY/innerHeight-.5)*2; },{passive:true});
  function loadData(){ if(window.RRSITE&&RRSITE.daily) RRSITE.daily('get').then(d=>{ if(d){ data=d; drawTags(); drawJumbos(performance.now()/1000); if(still) frame(10); } }); }
  function boot(){ drawSign(); drawPlaque(); drawTags(); drawJumbos(0); size(); addEventListener('resize',size);
    if(still) frame(10); else { raf=requestAnimationFrame(step); document.addEventListener('visibilitychange',()=>{ if(document.hidden){ cancelAnimationFrame(raf); raf=0; } else if(!raf){ last=0; raf=requestAnimationFrame(step); } }); }
    setTimeout(loadData,1500); setInterval(loadData,90000);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ drawSign(); drawPlaque(); drawTags(); drawJumbos(0); if(still) frame(10); }); }
  boot();
})();
