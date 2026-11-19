/* Arcade Rivals 3D city background: a bright, busy square at dusk, rendered in real perspective.
   Tall buildings on both sides of a wide avenue, giant billboard screens (our own games and made-up brands),
   yellow taxis, people on the sidewalks, cross streets, and a camera that drifts slowly down the avenue.
   Draws on its own fixed canvas behind the page. Pauses when the tab is hidden; holds still for reduced motion. */
(function(){ if(window.RRSQ) { window.RRSQ.start(); return; }
  const cv=document.createElement('canvas'); cv.id='rrSq'; cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block';
  const ctx=cv.getContext('2d');
  const still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT="'Big Shoulders Display','Arial Narrow',Impact,sans-serif";
  let W=0,H=0,DPR=1,raf=0,run=false,last=0,mx=0,tmx=0;
  /* ---------- seeded randomness so the city is the same every visit ---------- */
  const hash=n=>{ n=Math.imul(n^61,2654435761)>>>0; n^=n>>>15; n=Math.imul(n,2246822519)>>>0; n^=n>>>13; return (n>>>0)/4294967296; };
  const rnd=(i,k)=>hash(i*977+k*131+7);
  /* ---------- colours and fog ---------- */
  const hex=h=>{ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  const FOG=[176,150,190];
  const fogc=(rgb,d,a)=>{ const f=Math.min(.85,Math.max(0,(d-25)/260)); const c=rgb.map((v,i)=>Math.round(v+(FOG[i]-v)*f)); return a==null?`rgb(${c})`:`rgba(${c},${a})`; };
  /* ---------- camera ---------- */
  let camZ=0, CX=0, CY=1.75, F=800, HZ=0;
  const P=(x,y,z)=>{ const d=camZ-z; if(d<.15) return null; return {x:W/2+(x-CX)*F/d, y:HZ-(y-CY)*F/d, d}; };
  function poly(pts,fill){ const q=[]; for(const p of pts){ const r=P(p[0],p[1],p[2]); if(!r) return; q.push(r); } ctx.beginPath(); q.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); }
  /* ---------- billboard art (all original) ---------- */
  function art(kind){ const c=document.createElement('canvas'); c.width=512; c.height=320; const g=c.getContext('2d'); const T=(t,y,s,col,sh)=>{ g.font=`900 ${s}px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; if(sh){ g.shadowColor=sh; g.shadowBlur=18; } g.fillStyle=col; g.fillText(t,256,y); g.shadowBlur=0; };
    const bg=(a,b)=>{ const gr=g.createLinearGradient(0,0,512,320); gr.addColorStop(0,a); gr.addColorStop(1,b); g.fillStyle=gr; g.fillRect(0,0,512,320); };
    if(kind===0){ bg('#ef4444','#f59e0b'); for(let i=0;i<8;i++){ g.fillStyle='rgba(255,255,255,.12)'; g.fillRect(i*70-20,0,30,320); } T('ZAP COLA',130,96,'#fff','#7f1d1d'); T('ICE COLD · ALWAYS',220,40,'#fff7ed'); g.fillStyle='#fff'; g.beginPath(); g.arc(440,250,40,0,7); g.fill(); }
    else if(kind===1){ bg('#0ea5e9','#1e3a8a'); g.fillStyle='#22c55e'; for(let i=0;i<10;i++) for(let j=0;j<3;j++) if((i+j)%3) g.fillRect(i*52,220+j*34,48,30); T('BLOCKVERSE',110,92,'#fff','#0c4a6e'); T('BUILD · SURVIVE · TOGETHER',180,30,'#e0f2fe'); }
    else if(kind===2){ bg('#111827','#7c3aed'); for(let i=0;i<14;i++){ g.fillStyle=`hsl(${i*25},80%,${40+i%3*10}%)`; const h=60+((i*53)%140); g.fillRect(i*38,320-h,32,h); } T('RIVAL CITY',90,90,'#fde047','#000'); T('DRIVE ANYTHING',160,34,'#fff'); }
    else if(kind===3){ bg('#fde047','#fb923c'); T('PLAY',100,110,'#111827'); T('ANYTHING.',210,90,'#be123c'); }
    else if(kind===4){ bg('#4c1d95','#db2777'); g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=6; for(let r=30;r<300;r+=40){ g.beginPath(); g.arc(256,360,r,Math.PI,0); g.stroke(); } T('STORM ROYALE',120,80,'#fff','#000'); T('LAST ONE STANDING',190,32,'#fbcfe8'); }
    else if(kind===5){ bg('#fff7ed','#fed7aa'); g.fillStyle='#b91c1c'; g.beginPath(); g.ellipse(256,210,120,60,0,0,Math.PI); g.fill(); g.fillStyle='#fde68a'; for(let i=0;i<5;i++) g.fillRect(170+i*36,120+i%2*8,6,90); T('NOODLE HOUSE',70,64,'#7c2d12'); }
    else if(kind===6){ bg('#16a34a','#065f46'); T('SALE',110,120,'#fff','#052e16'); T('50% OFF EVERYTHING',220,40,'#dcfce7'); }
    else if(kind===7){ bg('#2563eb','#06b6d4'); g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(150,170,70,0,7); g.fill(); g.fillStyle='#2563eb'; g.beginPath(); g.arc(150,170,40,0,7); g.fill(); T('RINK RIVALS AI',120,44,'#fff'); g.textAlign='left'; g.font=`900 50px ${FONT}`; g.fillStyle='#fff'; g.fillText('ASK',270,170); g.fillText('ANYTHING',270,225); }
    else if(kind===8){ bg('#f43f5e','#7e22ce'); T('LIVE',80,70,'#fff'); T('HOCKEY 3–1',180,80,'#fde047','#000'); T('FINAL PERIOD',250,32,'#ffe4e6'); }
    else { bg('#0f172a','#0f766e'); T('METRO',110,100,'#5eead4'); T('NEXT TRAIN 2 MIN',200,36,'#fff'); }
    g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=10; g.strokeRect(0,0,512,320); return c; }
  const ARTS=Array.from({length:10},(_,i)=>art(i));
  /* draw an image onto a vertical rectangle that lies along the avenue (plane x=const), in strips for perspective */
  function wallImg(img,x,y0,y1,za,zb,alpha,d){ const pa=P(x,y1,za), pb=P(x,y1,zb); if(!pa||!pb) return; const N=Math.max(8,Math.min(60,Math.ceil(Math.abs(pb.x-pa.x)/6))), flip=x>0; ctx.globalAlpha=alpha;
    for(let k=0;k<N;k++){ const z0=za+(zb-za)*k/N, z1=za+(zb-za)*(k+1)/N, zm=(z0+z1)/2; const a=P(x,y1,z0), c=P(x,y1,z1), t=P(x,y1,zm), bt=P(x,y0,zm); if(!a||!c||!t||!bt) continue; const w=c.x-a.x; if(Math.abs(w)<.2) continue; const u=flip?1-(k+1)/N:k/N, sw=img.width/N; ctx.drawImage(img,img.width*u,0,sw,img.height,Math.min(a.x,c.x),t.y,Math.abs(w)+.7,bt.y-t.y); } ctx.globalAlpha=1;
    const f=Math.min(.7,Math.max(0,(d-40)/240)); if(f>.02){ ctx.fillStyle=`rgba(${FOG},${f})`; const a=P(x,y1,za), b=P(x,y0,za), c=P(x,y0,zb), e=P(x,y1,zb); if(a&&b&&c&&e){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(e.x,e.y); ctx.lineTo(c.x,c.y); ctx.lineTo(b.x,b.y); ctx.closePath(); ctx.fill(); } } }
  /* ---------- the city: blocks of buildings repeating down the avenue ---------- */
  const SEG=14, ROAD=7, WALK=10.5, DEPTH=16;
  const BCOL=['#8a6f63','#6b7280','#9a8473','#4b5563','#7c6a8a','#a07b5f','#5b6b7f','#8b8f99'];
  function seg(i,s){ const k=s<0?1:2; const cross=(i%6===0); const h=cross?0:18+rnd(i,k)*55; return {cross,h,col:hex(BCOL[Math.floor(rnd(i,k+5)*BCOL.length)]),bill:Math.floor(rnd(i,k+9)*10),bill2:Math.floor(rnd(i,k+11)*10),bh:6+rnd(i,k+13)*8,screen:rnd(i,k+17)<.45,lit:.35+rnd(i,k+19)*.5}; }
  /* ---------- traffic and people ---------- */
  const cars=[]; for(let i=0;i<26;i++) cars.push({lane:[-5,-2,2,5][i%4],z:-i*18-rnd(i,40)*10,v:(i%4<2?-1:1)*(5+rnd(i,41)*5),col:rnd(i,42)<.72?[250,204,21]:hex(['#ef4444','#e5e7eb','#1e293b','#2563eb'][i%4])});
  const ppl=[]; for(let i=0;i<140;i++) ppl.push({x:(i%2?1:-1)*(ROAD+.6+rnd(i,50)*(WALK-ROAD-1.2)),z:-rnd(i,51)*400,v:(rnd(i,52)-.5)*2.4,col:hex(['#ef4444','#3b82f6','#f59e0b','#10b981','#e5e7eb','#a855f7','#111827','#f472b6'][i%8])});
  /* ---------- frame ---------- */
  function resize(){ DPR=Math.min(1.5,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); F=Math.max(W,H)*.62; HZ=H*.52; }
  function frame(t,dt){ ctx.setTransform(DPR,0,0,DPR,0,0);
    camZ=-(t*2.2)%(SEG*6*40); mx+=(tmx-mx)*Math.min(1,dt*2); CX=Math.sin(t*.05)*1.2+mx*1.5; CY=1.75+Math.sin(t*.13)*.05;
    /* sky: bright evening */
    const sk=ctx.createLinearGradient(0,0,0,HZ); sk.addColorStop(0,'#3b5fa8'); sk.addColorStop(.55,'#9a7bc0'); sk.addColorStop(.85,'#f0a37a'); sk.addColorStop(1,'#f7c08a'); ctx.fillStyle=sk; ctx.fillRect(0,0,W,HZ+2);
    ctx.fillStyle='rgba(255,236,200,.5)'; ctx.beginPath(); ctx.arc(W/2+CX*-20,HZ-H*.06,H*.09,0,7); ctx.fill();
    /* ground */
    const gr=ctx.createLinearGradient(0,HZ,0,H); gr.addColorStop(0,'#8c7f8f'); gr.addColorStop(1,'#2a2a33'); ctx.fillStyle=gr; ctx.fillRect(0,HZ,W,H-HZ);
    const zN=camZ-.2, zF=camZ-300;
    poly([[-ROAD,0,zN],[ROAD,0,zN],[ROAD,0,zF],[-ROAD,0,zF]],'#3a3a44');
    for(const s of [-1,1]) poly([[s*ROAD,0.02,zN],[s*WALK,0.02,zN],[s*WALK,0.02,zF],[s*ROAD,0.02,zF]],'#9b9195');
    /* lane markings + crosswalks */
    const z0=Math.floor(camZ/6)*6; for(let z=z0;z>zF;z-=6){ const d=camZ-z; for(const x of [-3.5,3.5]) poly([[x-.08,.01,z],[x+.08,.01,z],[x+.08,.01,z-2.5],[x-.08,.01,z-2.5]],fogc([240,240,240],d)); poly([[-.2,.01,z],[-.05,.01,z],[-.05,.01,z-6],[-.2,.01,z-6]],fogc([250,204,21],d)); poly([[.05,.01,z],[.2,.01,z],[.2,.01,z-6],[.05,.01,z-6]],fogc([250,204,21],d)); }
    /* collect everything with depth and paint far to near */
    const items=[]; const i0=Math.floor(-camZ/SEG)-1;
    for(let i=i0;i<i0+24;i++){ const za=-i*SEG, zb=-(i+1)*SEG; if(za<zF) continue; for(const s of [-1,1]) items.push({d:camZ-za,f:()=>building(i,s,za,zb,t)}); if(i%6===0) items.push({d:camZ-za+.1,f:()=>crosswalk(za)}); }
    for(const c of cars){ c.z+=c.v*dt*(still?0:1); if(c.z>camZ+10) c.z-=320; if(c.z<camZ-310) c.z+=320; items.push({d:camZ-c.z,f:()=>car(c)}); }
    for(const p of ppl){ p.z+=p.v*dt*(still?0:1); if(p.z>camZ+2) p.z-=400; if(p.z<camZ-400) p.z+=400; if(camZ-p.z<90) items.push({d:camZ-p.z,f:()=>person(p,t)}); }
    items.sort((a,b)=>b.d-a.d); for(const it of items) it.f();
    /* warm haze at the horizon */
    const hz=ctx.createLinearGradient(0,HZ-H*.25,0,HZ+H*.08); hz.addColorStop(0,'rgba(240,170,140,0)'); hz.addColorStop(.7,'rgba(240,170,140,.25)'); hz.addColorStop(1,'rgba(240,170,140,0)'); ctx.fillStyle=hz; ctx.fillRect(0,HZ-H*.25,W,H*.33);
    /* a soft tint so the page on top stays easy to read */ const tn=ctx.createLinearGradient(0,0,0,H); tn.addColorStop(0,'rgba(10,12,30,.28)'); tn.addColorStop(1,'rgba(10,12,30,.42)'); ctx.fillStyle=tn; ctx.fillRect(0,0,W,H); }
  function crosswalk(z){ const d=camZ-z; for(let x=-ROAD+.4;x<ROAD;x+=1.1) poly([[x,.015,z+.2],[x+.6,.015,z+.2],[x+.6,.015,z-2.8],[x,.015,z-2.8]],fogc([235,235,235],d)); }
  function building(i,s,za,zb,t){ const b=seg(i,s); if(b.cross) return; const d=camZ-za, x=s*WALK, xo=s*(WALK+DEPTH), h=b.h, col=b.col;
    /* front (facing the camera) and street-side faces */
    const shade=(c,k)=>c.map(v=>Math.round(v*k));
    if(za<camZ-.3) poly([[x,0,za],[xo,0,za],[xo,h,za],[x,h,za]],fogc(shade(col,.78),d));
    poly([[x,0,za],[x,0,zb],[x,h,zb],[x,h,za]],fogc(col,d));
    /* windows: rows of warm lights (near buildings only) */
    if(d<130){ const rows=Math.floor(h/3.2); for(let r=1;r<rows;r++){ const y=r*3.2; for(let c=0;c<5;c++){ if(rnd(i*31+r,c+s*7)>b.lit) continue; const zz=za-1-c*2.6; poly([[x-s*.01,y,zz],[x-s*.01,y,zz-1.4],[x-s*.01,y+1.6,zz-1.4],[x-s*.01,y+1.6,zz]],fogc([255,223,160],d+6)); } } }
    /* ground-floor shop glow */
    poly([[x-s*.02,0,za-.5],[x-s*.02,0,zb+.5],[x-s*.02,3,zb+.5],[x-s*.02,3,za-.5]],fogc([70,52,48],d)); for(let q=0;q<3;q++){ const zz=za-1-q*4.2; poly([[x-s*.03,.4,zz],[x-s*.03,.4,zz-3.2],[x-s*.03,2.6,zz-3.2],[x-s*.03,2.6,zz]],fogc([255,200,130],d,.9)); } poly([[x-s*.04,3,za-.3],[x-s*.04,3,zb+.3],[x-s*.04,3.6,zb+.3],[x-s*.04,3.6,za-.3]],fogc(['#ef4444','#2563eb','#16a34a','#f59e0b'].map(hex)[(i&3)],d));
    /* billboards on the street face */
    const by=Math.min(h-7,b.bh); if(by>4){ wallImg(ARTS[b.bill],x-s*.05,by,by+6,za-1.5,zb+1.5,1,d); }
    if(h>40&&d<220) wallImg(ARTS[b.bill2],x-s*.05,by+9,by+16,za-2,zb+2,1,d);
    /* a big screen on the corner of tall buildings, facing the camera */
    if(b.screen&&h>30&&za<camZ-1){ const a=P(x+s*.2,h-2,za+.05), e=P(x+s*7.5,h-12,za+.05); if(a&&e){ const img=ARTS[(b.bill+Math.floor(t/4))%10]; ctx.drawImage(img,Math.min(a.x,e.x),a.y,Math.abs(e.x-a.x),e.y-a.y); const f=Math.min(.7,Math.max(0,(d-40)/240)); if(f>.02){ ctx.fillStyle=`rgba(${FOG},${f})`; ctx.fillRect(Math.min(a.x,e.x),a.y,Math.abs(e.x-a.x),e.y-a.y); } } }
    /* roof edge */
    poly([[x,h,za],[xo,h,za],[xo,h+.4,za],[x,h+.4,za]],fogc(shade(col,.55),d)); }
  function car(c){ const d=camZ-c.z; if(d<.5||d>300) return; const x=c.lane, z=c.z, L=4.4, Wd=1.8, col=c.col, dk=col.map(v=>Math.round(v*.6));
    const back=c.v<0?z:z-L; poly([[x-Wd/2,.3,back],[x+Wd/2,.3,back],[x+Wd/2,1.2,back],[x-Wd/2,1.2,back]],fogc(dk,d));
    poly([[x-Wd/2,1.2,z],[x+Wd/2,1.2,z],[x+Wd/2,1.2,z-L],[x-Wd/2,1.2,z-L]],fogc(col,d));
    poly([[x-Wd/2+.2,1.2,z-1],[x+Wd/2-.2,1.2,z-1],[x+Wd/2-.25,1.75,z-1.6],[x-Wd/2+.25,1.75,z-1.6]],fogc([40,60,90],d));
    const side=x<CX?1:-1; poly([[x+side*Wd/2,.3,z],[x+side*Wd/2,.3,z-L],[x+side*Wd/2,1.2,z-L],[x+side*Wd/2,1.2,z]],fogc(col.map(v=>Math.round(v*.85)),d));
    const lc=c.v<0?[255,60,60]:[255,250,220]; for(const sx of [-.65,.65]){ const p=P(x+sx,.8,back+.01); if(p){ ctx.fillStyle=fogc(lc,d); const r=Math.max(1,F*.12/d); ctx.fillRect(p.x-r,p.y-r*.5,r*2,r); } } }
  function person(p,t){ const d=camZ-p.z; const ft=P(p.x,0,p.z), hd=P(p.x,1.7,p.z); if(!ft||!hd) return; const w=Math.max(1,F*.45/d); ctx.fillStyle=fogc(p.col,d); ctx.fillRect(ft.x-w/2,hd.y+w*.9,w,ft.y-hd.y-w*.9); ctx.fillStyle=fogc([214,170,140],d); ctx.beginPath(); ctx.arc(hd.x,hd.y+w*.45,w*.45,0,7); ctx.fill(); }
  function step(ts){ raf=0; if(!run) return; const t=ts/1000; const dt=Math.min(.1,last?t-last:.016); if(still||t-last>=1/32||!last){ frame(t,dt); last=t; } if(!still) raf=requestAnimationFrame(step); }
  addEventListener('resize',()=>{ resize(); if(still) frame(0,0); });
  addEventListener('pointermove',e=>{ tmx=(e.clientX/Math.max(1,innerWidth)-.5); },{passive:true});
  document.addEventListener('visibilitychange',()=>{ if(document.hidden){ cancelAnimationFrame(raf); raf=0; } else if(run&&!raf){ last=0; raf=requestAnimationFrame(step); } });
  window.RRSQ={ start(){ if(!cv.isConnected) (document.body||document.documentElement).prepend(cv); cv.style.display='block'; if(!run){ run=true; resize(); last=0; raf=requestAnimationFrame(step); if(still) frame(30,0); } },
    stop(){ run=false; cancelAnimationFrame(raf); raf=0; cv.style.display='none'; } };
  const go=()=>window.RRSQ.start(); if(document.body) go(); else addEventListener('DOMContentLoaded',go);
})();
