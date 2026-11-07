/* Arcade Rivals — 3D layer for the Sports Arcade games.
   SA3D({virtual:[1000,600], cam:{eye,center,fov}}) puts a WebGL canvas behind the game's 2D canvas, sized to the
   game's virtual screen, so the 2D canvas can keep drawing the HUD, menus and aim lines on top while the world is 3D.
   World units are metres. ray()/toPlane() turn a virtual-screen point back into the 3D world so the old 2D gameplay
   coordinates can be placed in 3D exactly where they used to be drawn. */
window.SA3D=function(opt){
  const K=100, PI=Math.PI, VW=opt.virtual[0], VH=opt.virtual[1];
  const glc=document.createElement('canvas'); glc.id='sa3d'; glc.style.cssText='position:fixed;left:0;top:0;width:10px;height:10px;z-index:0;display:block;pointer-events:none';
  document.body.insertBefore(glc,document.body.firstChild);
  const R3=makeR3(glc,glc); if(!R3||!R3.ok){ glc.remove(); return null; }
  const PHY=window.RRPHY?RRPHY(R3,K):null;
  const {T,S,RX,RY,RZ,mm,UB,US}=R3, UC=R3.UC;
  const cam={eye:(opt.cam&&opt.cam.eye)||[0,5,20],center:(opt.cam&&opt.cam.center)||[0,0,0],fov:(opt.cam&&opt.cam.fov)||40,sky:opt.sky||[.05,.08,.15],bright:opt.bright==null?1:opt.bright,fog:opt.fog||null};
  /* place the GL canvas over the game's virtual screen: rect in CSS pixels */
  function place(x,y,w,h){ glc.style.left=x+'px'; glc.style.top=y+'px'; glc.style.width=w+'px'; glc.style.height=h+'px'; }
  /* ---- drawing helpers (dynamic, every frame) ---- */
  const box=(x,y,z,w,h,d,col,m2)=>R3.part(UB,m2?mm(T(x*K,y*K,z*K),m2,S(w*K,h*K,d*K)):mm(T(x*K,y*K,z*K),S(w*K,h*K,d*K)),col);
  const boxR=(x,y,z,w,h,d,col,ry,rx,rz)=>R3.part(UB,mm(T(x*K,y*K,z*K),RY(ry||0),RX(rx||0),RZ(rz||0),S(w*K,h*K,d*K)),col);
  const sph=(x,y,z,r,col)=>R3.part(US,mm(T(x*K,y*K,z*K),S(r*K,r*K,r*K)),col);
  const cyl=(x,y,z,r,h,col,rx,rz)=>R3.part(UC||UB,mm(T(x*K,y*K,z*K),RX(rx||0),RZ(rz||0),S(r*K,h*K,r*K)),col);
  const beam=(a,b,t,col)=>R3.part(UB,R3.beam(a.map(v=>v*K),b.map(v=>v*K),t*K,t*K),col);
  const shadow=(x,z,r)=>R3.shadow(x*K,z*K,r*K);
  /* a person: kind = stand / walk / run, ph = stride phase, mod(J) may move joints (metres, facing +z) */
  /* your weightlifting strength shows on YOUR player in the Sports Arcade: a little more muscle as you get stronger, capped so nobody gets huge */
  const STR=(()=>{ try{ if(localStorage.getItem('rrOwner')==='1') return 1; const v=+localStorage.getItem('rrStrength')||0; return Math.max(0,Math.min(1,v/100)); }catch(e){ return 0; } })();
  function person(x,z,yaw,look,kind,ph,mod,y){ if(!PHY) return; look=Object.assign({},look||{}); if(look.me&&window.RRCOIN){ const kc=RRCOIN.equipped('kit'); if(kc) look.top=kc; } look.buff=Math.min(2.2,(look.buff||1.05)*1.35*(look.me?1+.2*STR:1)); look.bulk=1.7;   /* everyone is chunkier (same height); your own player gets your gym strength on top */ const J=PHY.pose(kind||'stand',0,ph||0,.19); if(mod) mod(J); PHY.drawBody(J,{x,z,yaw:yaw||0,y:y||0},Object.assign({top:'#2563eb',legs:'#111827',skin:'#e0b48f',shoe:'#111',hair:'#2a1a10',buff:1.05},look||{})); }
  /* rotate every joint of a pose around an axis through a pivot (for dives, falls, lunges) */
  function tilt(J,pivot,ax,ang){ const c=Math.cos(ang), s=Math.sin(ang); for(const k in J){ const p=J[k]; if(!Array.isArray(p)||p.length!==3||k==='F'||k==='toe') continue; let x=p[0]-pivot[0], y=p[1]-pivot[1], z=p[2]-pivot[2];
      if(ax==='z'){ const nx=x*c-y*s, ny=x*s+y*c; x=nx; y=ny; } else if(ax==='x'){ const ny=y*c-z*s, nz=y*s+z*c; y=ny; z=nz; } else { const nx=x*c+z*s, nz=-x*s+z*c; x=nx; z=nz; }
      J[k]=[x+pivot[0],y+pivot[1],z+pivot[2]]; } }
  /* ---- static scenery (built once) ---- */
  function setStatic(fn,chunk){ R3.setStatic((g,c,Pp)=>{ const {primBox,primCyl,T:Tm,S:Sm,mm:M,RY:Ry,RX:Rx,RZ:Rz}=Pp, B=primBox(), CY=primCyl(12);
    const sb=(x,y,z,w,h,d,col,ry)=>g.add(B,ry?M(Tm(x*K,y*K,z*K),Ry(ry),Sm(w*K,h*K,d*K)):M(Tm(x*K,y*K,z*K),Sm(w*K,h*K,d*K)),col);
    const sc=(x,y,z,r,h,col)=>g.add(CY,M(Tm(x*K,y*K,z*K),Sm(r*K,h*K,r*K)),col);
    const sbR=(x,y,z,w,h,d,col,ry,rx,rz)=>g.add(B,M(Tm(x*K,y*K,z*K),Ry(ry||0),Rx(rx||0),Rz(rz||0),Sm(w*K,h*K,d*K)),col);
    /* a crowd: stepped stand along a line, fans as little coloured blocks */
    const FAN=['#ef4444','#f8fafc','#2563eb','#facc15','#22c55e','#111827','#f97316','#a855f7','#e5e7eb','#0ea5e9'];
    const stand=(x0,z0,x1,z1,rows,y0,face,col)=>{ const L=Math.hypot(x1-x0,z1-z0), n=Math.max(2,Math.floor(L/.75)), ry=Math.atan2(x1-x0,z1-z0)+PI/2;
      for(let r=0;r<rows;r++){ const off=r*.85, y=y0+r*.5, ox=Math.cos(face)*off, oz=Math.sin(face)*off;
        sbR((x0+x1)/2+ox,y-.25,(z0+z1)/2+oz,L,.5+r*0,.85,col||'#334155',ry);
        for(let i=0;i<n;i++){ if(Math.random()<.12) continue; const t=(i+.5)/n, fx=x0+(x1-x0)*t+ox, fz=z0+(z1-z0)*t+oz; sb(fx,y+.35,fz,.38,.6,.32,FAN[(i*7+r*3+Math.floor(Math.random()*3))%FAN.length]); sb(fx,y+.78,fz,.22,.24,.22,['#e0b48f','#c68e63','#8d5a3b','#f1c7a1'][(i+r)%4]); } } };
    fn({sb,sc,sbR,stand,g,B,CY,M,Tm,Sm,Ry,Rx,Rz,K}); },chunk?{chunk:chunk*K}:undefined); }
  /* ---- camera maths (same as r3lib's lookAt + perspective) so we can map the old 2D screen onto the 3D world ---- */
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], nrm=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }, crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function basis(){ const f=nrm(sub(cam.center,cam.eye)), r=nrm(crs(f,[0,1,0])), u=crs(r,f); return {f,r,u}; }
  /* virtual screen point → world ray */
  function ray(vx,vy){ const {f,r,u}=basis(), t=Math.tan(cam.fov*PI/360), A=VW/VH, nx=(vx/VW*2-1)*t*A, ny=(1-vy/VH*2)*t; return {o:cam.eye.slice(),d:nrm([f[0]+r[0]*nx+u[0]*ny,f[1]+r[1]*nx+u[1]*ny,f[2]+r[2]*nx+u[2]*ny])}; }
  /* where that ray meets the plane axis=value ('y' for the ground, 'z' for a goal mouth, …) */
  function toPlane(vx,vy,axis,val){ const R=ray(vx,vy), i=axis==='x'?0:axis==='y'?1:2; const k=(val-R.o[i])/(R.d[i]||1e-6); return [R.o[0]+R.d[0]*k,R.o[1]+R.d[1]*k,R.o[2]+R.d[2]*k]; }
  /* world point → virtual screen (for 2D labels that should follow 3D things) */
  function toScreen(p){ const {f,r,u}=basis(), q=sub(p,cam.eye), z=q[0]*f[0]+q[1]*f[1]+q[2]*f[2]; if(z<=.01) return null; const t=Math.tan(cam.fov*PI/360), A=VW/VH;
    return [((q[0]*r[0]+q[1]*r[1]+q[2]*r[2])/(z*t*A)*.5+.5)*VW,(.5-(q[0]*u[0]+q[1]*u[1]+q[2]*u[2])/(z*t)*.5)*VH,z]; }
  /* hide the 3D canvas whenever the game stops drawing it (menus, results pages) */
  let lastF=0; setInterval(()=>{ if(performance.now()-lastF>350&&glc.style.display!=='none') glc.style.display='none'; },200);
  function frame(draw,dt,shake){ lastF=performance.now(); if(glc.style.display==='none') glc.style.display=''; const e=cam.eye.slice(); if(shake){ e[0]+=(Math.random()-.5)*shake; e[1]+=(Math.random()-.5)*shake; }
    R3.frame({eye:e.map(v=>v*K),center:cam.center.map(v=>v*K),fov:cam.fov,near:5,far:90000,sky:cam.sky,bright:cam.bright,fog:cam.fog,fogMax:cam.fogMax},draw,dt); }
  try{ const lv=localStorage.getItem('rrOwner')==='1'?'∞':Math.round(+localStorage.getItem('rrStrength')||0).toLocaleString(); const bd=document.createElement('a'); bd.href='weightlifting'; bd.title='Your gym strength makes your player more muscular — train at the gym';
    bd.textContent=`💪 Strength ${lv} · +${Math.round(STR*20)}% muscle`; bd.style.cssText='position:fixed;left:150px;top:10px;z-index:2147482000;background:rgba(15,23,42,.88);color:#fde68a;border:1px solid rgba(253,230,138,.4);border-radius:999px;padding:7px 13px;font:700 13px system-ui,sans-serif;text-decoration:none'; document.body.appendChild(bd); }catch(e){}
  return {STR,R3,PHY,K,cam,place,box,boxR,sph,cyl,beam,shadow,person,tilt,setStatic,ray,toPlane,toScreen,frame,canvas:glc};
};
