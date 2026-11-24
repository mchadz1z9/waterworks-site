/* Arcade Rivals — 3D for the in-page Sports Arcade games (the ones that draw into <canvas id="cv">).
   SA3DCV({H:560, cam:{eye,center,fov}, sky, bright}) makes an SA3D world that sits exactly behind #cv, follows it when the page
   scrolls or resizes, and lets the 2D canvas keep drawing the scoreboard, meters and messages on top.
   Games call V3.begin() at the top of draw(): it lines the 3D view up with #cv and clears the 2D canvas (returns false when there is no WebGL,
   so the game falls back to its old 2D drawing). */
window.SA3DCV=function(opt){
  opt=opt||{}; const H=opt.H||560;
  if(!window.SA3D) return null;
  let V=null; try{ V=SA3D(Object.assign({virtual:[1000,H]},opt)); }catch(e){ V=null; }
  if(!V) return null;
  V.canvas.style.borderRadius='12px';
  V.begin=function(cv,x){
    if(!cv||!cv.isConnected) return false;
    if(!cv.__sa3d){ cv.__sa3d=1; cv.style.background='transparent'; cv.style.position='relative'; cv.style.zIndex='1'; }
    const r=cv.getBoundingClientRect(); V.place(r.left,r.top,r.width,r.height);
    if(x){ x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,cv.width,cv.height); }
    return true;
  };
  /* a 2D label that follows a 3D point (name tags, distance markers) */
  V.label=function(x,txt,p,col,font){ const s=V.toScreen(p); if(!s) return; x.save(); x.font=font||'800 13px system-ui'; x.textAlign='center'; const w=x.measureText(txt).width+12;
    x.fillStyle='rgba(8,12,26,.72)'; x.beginPath(); x.roundRect(s[0]-w/2,s[1]-17,w,20,8); x.fill(); x.fillStyle=col||'#fff'; x.fillText(txt,s[0],s[1]-3); x.restore(); };
  /* an indoor basketball arena: rim centre at (0, 3.05, 0), the court runs toward +z, crowd all round */
  V.court=function(){ V.setStatic(({sb,sc,sbR,stand})=>{
    sb(0,-.1,8,30,.1,34,'#2b2f3a'); sb(0,-.04,8,15,.08,28,'#c8873f');
    for(let z=-1.2;z<22;z+=.9) sb(0,-.003,z+.45,15,.01,.02,'#b5763a');                      /* boards */
    const L=(x,z,w,d,c)=>sb(x,.004,z,w,.01,d,c||'#f8fafc');
    L(0,-1.2,15,.06);L(-7.5,8,.06,18.4);L(7.5,8,.06,18.4);L(0,13.1,15,.06);                /* baseline, sidelines, half court */
    sb(0,.002,2.1,4.9,.01,5.8,'#8f2d2d');L(-2.45,2.1,.06,5.8);L(2.45,2.1,.06,5.8);L(0,5,4.9,.06);
    for(let a=-1.5;a<=1.5;a+=.04){ sb(Math.sin(a)*1.8,.005,5+Math.cos(a)*1.8,.1,.01,.06,'#f8fafc'); }
    for(let a=-1.37;a<=1.37;a+=.02){ sb(Math.sin(a)*6.75,.005,Math.cos(a)*6.75,.12,.01,.06,'#f8fafc'); }
    L(-6.6,.2,.06,2.8);L(6.6,.2,.06,2.8);
    sb(0,3.5,-.35,1.8,1.05,.05,'#e8eef8'); sb(0,3.35,-.32,.59,.45,.02,'#e03a3a'); sb(0,3.35,-.31,.5,.37,.02,'#e8eef8');   /* backboard */
    sb(0,3.05,-.25,.12,.05,.25,'#ff6a2b'); sb(0,2.9,-1.3,.25,.25,2,'#334155'); sc(0,1.5,-2.3,.15,3,'#334155'); sb(0,.4,-2.3,1,.8,1.4,'#1e293b');
    for(let k=0;k<20;k++){ const a=k/20*Math.PI*2; sb(Math.sin(a)*.23,3.05,Math.cos(a)*.23,.07,.03,.07,'#ff6a2b'); for(let j=1;j<4;j++){ const r=.23-j*.035; sb(Math.sin(a)*r,3.05-j*.13,Math.cos(a)*r,.015,.13,.015,'#f8fafc'); } }
    stand(-10,-4,-10,22,10,.4,Math.PI,'#3b2a5a'); stand(10,22,10,-4,10,.4,0,'#3b2a5a'); stand(-9,-6,9,-6,10,.4,-Math.PI/2,'#3b2a5a'); stand(9,24,-9,24,8,.4,Math.PI/2,'#3b2a5a');
    sb(0,14,8,40,.4,40,'#120c2a'); for(const x of [-6,0,6]) for(const z of [0,10,20]) sb(x,13.7,z,1.2,.2,1.2,'#fff7d6');   /* roof + lights */
    sb(0,9,8,2.6,1.6,2.6,'#0f172a');
  },10); };
  /* a basketball with seams */
  V.ball=function(p,r){ r=r||.12; V.sph(p[0],p[1],p[2],r,'#e2702a'); V.box(p[0],p[1],p[2],r*2.04,.012,.012,'#3a1a08'); V.box(p[0],p[1],p[2],.012,r*2.04,.012,'#3a1a08'); };
  /* a ballpark in metres: home plate at the origin, centre field toward -z, mound at z = -18.4 */
  V.WALL=a=>100+22*Math.cos(a*2);
  V.ballpark=function(){ V.setStatic(({sb,sc,sbR,stand})=>{
    sb(0,-.12,-60,320,.1,320,'#1d6b34');
    for(let i=-6;i<6;i++) sbR(0,-.06,-60,6,.02,240,i%2?'#237a3d':'#1d6b34',0,0,0);
    sbR(0,-.03,-13.7,27,.04,27,'#b98a58',Math.PI/4);                            /* infield dirt */
    sbR(0,-.015,-13.7,23,.04,23,'#2a8a46',Math.PI/4);                           /* infield grass */
    sc(0,-.02,-18.4,2.8,.2,'#c5976a'); sb(0,.1,-18.4,.6,.04,.15,'#f8fafc');       /* mound + rubber */
    sc(0,-.02,0,4,.06,'#b98a58'); sbR(0,.02,0,.43,.02,.43,'#f8fafc',Math.PI/4);
    for(const [bx,bz] of [[13.7,-13.7],[0,-27.4],[-13.7,-13.7]]){ sc(bx,-.02,bz,2,.05,'#b98a58'); sb(bx,.06,bz,.38,.08,.38,'#f8fafc'); }
    for(const sg of [-1,1]) for(let d=1;d<100;d+=1) sb(sg*d*.707,.01,-d*.707,.12,.01,.12,'#f8fafc');      /* foul lines */
    for(const sg of [-1,1]){ sb(sg*.9,.012,0,1.2,.01,1.8,'#a7784a'); }
    for(let a=-.8;a<=.8;a+=.025){ const R=V.WALL(a); sbR(Math.sin(a)*R,1.6,-Math.cos(a)*R,2.9,3.2,.5,'#14532d',a); sbR(Math.sin(a)*R,3.25,-Math.cos(a)*R,2.9,.12,.6,'#facc15',a); }
    for(let a=-.78;a<=.78;a+=.13){ const R=V.WALL(a)+3; stand(Math.sin(a)*R,-Math.cos(a)*R,Math.sin(a+.13)*R,-Math.cos(a+.13)*R,6,3.4,Math.atan2(-Math.cos(a),Math.sin(a)),'#334155'); }
    sb(0,1.8,11,40,3.6,.4,'#1f2937'); stand(-20,12,20,12,8,3.6,Math.PI/2,'#334155');   /* backstop + seats behind home */
    for(const sg of [-1,1]){ stand(sg*20,4,sg*60,-36,6,.4,sg>0?-Math.PI/4:-3*Math.PI/4,'#334155'); }
    for(const [lx,lz] of [[-60,-95],[60,-95],[-90,-40],[90,-40]]){ sc(lx,18,lz,.5,36,'#94a3b8'); sb(lx,36.5,lz,7,3,.6,'#fffbe0'); }
    sb(0,16,-132,30,14,.6,'#0b1220'); sb(0,16,-131.6,28,12,.05,'#173a6e');                       /* scoreboard */
  },20); };
  /* a person swinging a bat: s 0..1 through the swing */
  V.batter=function(x,z,s,look){ V.person(x,z,Math.PI/2,look,'stand',0,J=>{ J.hand1=[.1,1.15,.25]; J['hand-1']=[0,1.12,.25]; J.elb1=[.28,1.25,.05]; J['elb-1']=[-.22,1.2,.08]; for(const k of ['knee-1','knee1']) J[k]=[J[k][0]*1.5,J[k][1]-.05,J[k][2]]; });
    const th=s*Math.PI*1.15, d=[Math.sin(th),(1-Math.min(1,s*1.6))*.75,Math.cos(th)], h=[x+.25,1.13,z+.05], L=Math.hypot(d[0],d[1],d[2]), tip=[h[0]+d[0]/L*.9,h[1]+d[1]/L*.9,h[2]+d[2]/L*.9];
    V.beam(h,tip,.06,'#d8b078'); };
  /* a football stadium: the ball sits at the origin, play goes toward -z; yard lines every 5 yards */
  V.gridiron=function(){ V.setStatic(({sb,sbR,sc,stand})=>{
    sb(0,-.12,-50,120,.1,200,'#1b5e2c');
    for(let i=0;i<26;i++) sb(0,-.06,10-i*4.572-2.286,48.8,.04,4.572,i%2?'#1c7c36':'#17702f');
    for(let i=0;i<26;i++){ const z=10-i*4.572; sb(0,-.035,z,48.8,.01,.12,'#f1f5f9'); for(const sx of [-1,1]) for(let k=1;k<5;k++) sb(sx*6.2,-.035,z-k*.914,.6,.01,.08,'#f1f5f9'); }
    sb(-24.4,-.035,-50,.15,.01,130,'#f8fafc'); sb(24.4,-.035,-50,.15,.01,130,'#f8fafc');
    sb(0,.5,-50,52,1,.1,'#0f172a');
    for(const sx of [-1,1]){ stand(sx*29,12,sx*29,-112,12,.5,sx<0?Math.PI:0,'#334155'); sb(sx*40,8,-50,.6,16,130,'#1e293b'); }
    for(const [lx,lz] of [[-34,-10],[34,-10],[-34,-80],[34,-80]]){ sc(lx,16,lz,.45,32,'#94a3b8'); sb(lx,32.5,lz,6,2.6,.6,'#fffbe0'); }
  },25); };
  V.goalpost=function(z,x0){ x0=x0||0; const Y='#facc15'; V.box(x0,1.6,z+1,.25,3.2,.25,Y); V.box(x0,3.1,z+.5,.18,.18,1.1,Y); V.box(x0,3.05,z,5.64,.15,.15,Y); V.box(x0-2.82,6.5,z,.12,7,.12,Y); V.box(x0+2.82,6.5,z,.12,7,.12,Y);
    V.box(x0-2.82,10.2,z,.25,.5,.04,'#ef4444'); V.box(x0+2.82,10.2,z,.25,.5,.04,'#ef4444'); };
  V.football=function(p,ang){ V.boxR(p[0],p[1],p[2],.17,.17,.28,'#7a3e14',0,ang||0,0); V.boxR(p[0],p[1]+.085,p[2],.03,.01,.14,'#f8fafc',0,ang||0,0); };
  return V;
};
