/* Rink Rivals physique: the people drawn in the gym and on the bodybuilding stage.
   RRPHY(R3, K) gives pose() (joint positions for each lift / walk / run), drawBody() (a lean, muscular person) and
   drawOlympia() (the owner: a full Mr. Olympia physique). Shared so every page draws the same body. */
window.RRPHY=function(R3,K){
const PI=Math.PI, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const wp=(f,p)=>{ const c=Math.cos(f.yaw), s=Math.sin(f.yaw); return [f.x+p[0]*c+p[2]*s, p[1]+(f.y||0), f.z-p[0]*s+p[2]*c]; };   /* f.y lifts the person (e.g. onto a stage) */
const wd=(f,v)=>{ const c=Math.cos(f.yaw), s=Math.sin(f.yaw); return [v[0]*c+v[2]*s, v[1], -v[0]*s+v[2]*c]; };
/* ---------- bodies ---------- */
/* a pose is a set of joints in the person's own frame (metres, facing +z). w = half shoulder width */
function pose(kind,b,t,w,sw){ sw=sw||0;
  const J={F:[0,0,1],toe:[0,0,1]};
  const leg=(hipY,amp,ph)=>{ for(const sx of [-1,1]){ const a=sx*Math.sin(ph)*.38*amp, kb=Math.max(0,-a)*.9+.06*amp; const hip=[sx*.11,hipY,0], knee=[sx*.12,hipY-.44*Math.cos(a),.44*Math.sin(a)], ank=[sx*.12,knee[1]-.42*Math.cos(a-kb),knee[2]+.42*Math.sin(a-kb)]; J['hip'+sx]=hip; J['knee'+sx]=knee; J['ank'+sx]=ank; } };
  const arms=(shY,amp,ph,bend)=>{ for(const sx of [-1,1]){ const a=-sx*Math.sin(ph)*.45*amp, sh=[sx*w,shY-.02,0]; const el=[sx*(w+.04),sh[1]-.27*Math.cos(a),.27*Math.sin(a)]; const fa=a+(bend||.25); J['sho'+sx]=sh; J['elb'+sx]=el; J['hand'+sx]=[sx*(w+.05),el[1]-.25*Math.cos(fa),el[2]+.25*Math.sin(fa)]; } };
  if(kind==='walk'||kind==='stand'||kind==='run'){ const amp=kind==='stand'?0:kind==='run'?1.5:1, bob=Math.abs(Math.sin(t))*.025*amp, hipY=.95-bob;
    J.pelvis=[0,hipY,0]; J.chest=[0,hipY+.5,.03*amp]; J.head=[0,hipY+.7,.05*amp]; leg(hipY,amp,t); arms(hipY+.5,amp,t,kind==='run'?1.3:.25); return J; }
  if(kind==='tread'){ const R=pose('run',0,t,w); for(const k in R) if(k!=='F'&&k!=='toe') R[k]=[R[k][0],R[k][1]+.24,R[k][2]]; return R; }   /* running on the belt */
  if(kind==='bike'){ const sy=.9; J.pelvis=[0,sy,0]; J.chest=[0,sy+.44,.26]; J.head=[0,sy+.62,.38];
    for(const sx of [-1,1]){ const a=t+(sx>0?0:PI), ped=[sx*.13,.36+.17*Math.sin(a),.42+.17*Math.cos(a)], hip=[sx*.11,sy,0];
      const vy=ped[1]-hip[1], vz=ped[2]-hip[2], n=Math.hypot(vy,vz)||1, d=Math.min(.86,n), h=Math.sqrt(Math.max(0,.44*.44-(d/2)*(d/2))), my=(hip[1]+ped[1])/2, mz=(hip[2]+ped[2])/2;
      J['hip'+sx]=hip; J['knee'+sx]=[sx*.13,my+(vz/n)*h,mz-(vy/n)*h]; J['ank'+sx]=ped;
      const sh=[sx*w,sy+.42,.26], hd=[sx*.24,1.0,.8]; J['sho'+sx]=sh; J['hand'+sx]=hd; J['elb'+sx]=[sx*(w+.03),(sh[1]+hd[1])/2-.06,(sh[2]+hd[2])/2]; }
    return J; }
  if(kind==='curl'){ const hipY=.95, shY=hipY+.5, th=b*2.3; J.pelvis=[0,hipY,0]; J.chest=[0,shY,-.02*b]; J.head=[0,shY+.2,-.02*b]; leg(hipY,0,0);
    for(const sx of [-1,1]){ const sh=[sx*w,shY-.02,-.02*b], el=[sx*(w+.02),shY-.3,.03]; J['sho'+sx]=sh; J['elb'+sx]=el; J['hand'+sx]=[sx*(w+.02),el[1]-.27*Math.cos(th),el[2]+.27*Math.sin(th)]; } J.db=true; return J; }
  if(kind==='pullup'){ const BAR=2.32, shY=BAR-.64+b*.42; J.chest=[0,shY,-.04]; J.pelvis=[0,shY-.5,-.03]; J.head=[0,shY+.2,.02];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.11,shY-.5,-.03]; J['knee'+sx]=[sx*.11,shY-.94,.07]; J['ank'+sx]=[sx*.1,shY-1.32,-.1]; const sh=[sx*w,shY-.02,-.04], hd=[sx*.34,BAR,0];
      const straight=[(sh[0]+hd[0])/2,(sh[1]+hd[1])/2,-.02], bent=[sx*(w+.24),shY+.04,-.02]; J['sho'+sx]=sh; J['hand'+sx]=hd; J['elb'+sx]=[lerp(straight[0],bent[0],b),lerp(straight[1],bent[1],b),-.02]; } J.toe=[0,-.4,1]; return J; }
  if(kind==='pushup'){ const shY=.2+b*.33, fz=-1.02, hz=.55, py=.11+(shY-.11)*.5; J.F=[0,-1,0]; J.chest=[0,shY,hz]; J.pelvis=[0,py,-.25]; J.head=[0,shY+.02,hz+.24];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.1,py,-.25]; J['ank'+sx]=[sx*.1,.09,fz]; J['knee'+sx]=[sx*.1,(py+.09)/2+.01,(fz-.25)/2]; const sh=[sx*w,shY,hz], hd=[sx*(w+.06),.03,hz];
      J['sho'+sx]=sh; J['hand'+sx]=hd; const straight=[(sh[0]+hd[0])/2,(sh[1]+hd[1])/2,hz], bent=[sx*(w+.22),shY*.55+.08,hz-.12]; J['elb'+sx]=[lerp(bent[0],straight[0],b),lerp(bent[1],straight[1],b),lerp(bent[2],straight[2],b)]; } J.toe=[0,-.7,-.7]; return J; }
  if(kind==='situp'){ const ph=b*1.15, dir=[0,Math.sin(ph),-Math.cos(ph)]; J.pelvis=[0,.13,0]; J.chest=[0,.13+dir[1]*.5,dir[2]*.5]; J.head=[0,J.chest[1]+dir[1]*.2,J.chest[2]+dir[2]*.2]; J.F=[0,Math.cos(ph),Math.sin(ph)];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.11,.13,0]; J['knee'+sx]=[sx*.13,.48,.33]; J['ank'+sx]=[sx*.12,.09,.66]; const sh=[sx*w,J.chest[1],J.chest[2]]; J['sho'+sx]=sh;
      const hd=[sx*.09,J.head[1]-dir[1]*.02-J.F[1]*.06,J.head[2]-dir[2]*.02-J.F[2]*.06]; J['hand'+sx]=hd; J['elb'+sx]=[sx*(w+.14),(sh[1]+hd[1])/2,(sh[2]+hd[2])/2]; } return J; }
  /* the four barbell lifts */
  if(kind==='squat'){ const depth=1-b, hipY=.95-depth*.44, shY=hipY+.5-depth*.04, lean=depth*.5; J.pelvis=[0,hipY,sw]; J.chest=[0,shY,-lean*.2]; J.head=[0,shY+.2,J.chest[2]-.02];
    const barY=shY+.07, barZ=-.17; J.bar=[0,barY,barZ];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.11,hipY,sw]; J['knee'+sx]=[sx*.16,hipY-.22,.05+depth*.24]; J['ank'+sx]=[sx*.14,.1,0]; J['sho'+sx]=[sx*w,shY-.02,J.chest[2]]; J['hand'+sx]=[sx*.3,barY,barZ]; J['elb'+sx]=[sx*.33,shY-.12,barZ+.05]; } return J; }
  if(kind==='dead'){ const hipY=.52+b*.44, lean=(1-b)*.6, shY=hipY+.4+b*.1; J.pelvis=[0,hipY,sw-(1-b)*.04]; J.chest=[0,shY,.03+lean*.34]; J.head=[0,shY+.17+lean*.05,J.chest[2]+.06];
    const barY=.24+b*.70, barZ=.2; J.bar=[0,barY,barZ];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.12,hipY,J.pelvis[2]]; J['knee'+sx]=[sx*.14,hipY-.24,.1+(1-b)*.1]; J['ank'+sx]=[sx*.13,.1,barZ-.03]; const sh=[sx*w,shY-.02,J.chest[2]], hd=[sx*.16,barY,barZ]; J['sho'+sx]=sh; J['hand'+sx]=hd; J['elb'+sx]=[(sh[0]+hd[0])/2,(sh[1]+hd[1])/2,(sh[2]+hd[2])/2]; } return J; }
  if(kind==='press'){ const hipY=.95, shY=hipY+.5; J.pelvis=[0,hipY,sw]; J.chest=[0,shY,0]; J.head=[0,shY+.2,0]; const barY=shY+.05+b*.74, barZ=.1-b*.14; J.bar=[0,barY,barZ];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.11,hipY,sw]; J['knee'+sx]=[sx*.12,hipY-.26,.03]; J['ank'+sx]=[sx*.12,.1,0]; J['sho'+sx]=[sx*w,shY-.02,0]; J['hand'+sx]=[sx*.22,barY,barZ]; J['elb'+sx]=[sx*(w+.09-b*.05),(shY+barY)/2-(1-b)*.04,barZ+(1-b)*.08]; } return J; }
  /* bench */ { const bY=.54, hipZ=.3, chZ=-.2; J.F=[0,1,0]; J.pelvis=[0,bY+.04,hipZ]; J.chest=[0,bY+.07,chZ]; J.head=[0,bY+.08,chZ-.28]; const barY=bY+.24+b*.42, barZ=chZ+.02; J.bar=[0,barY,barZ];
    for(const sx of [-1,1]){ J['hip'+sx]=[sx*.12,bY+.02,hipZ]; J['knee'+sx]=[sx*.17,bY-.04,hipZ+.34]; J['ank'+sx]=[sx*.19,.1,hipZ+.54]; J['sho'+sx]=[sx*w,bY+.12,chZ]; J['hand'+sx]=[sx*.22,barY,barZ]; J['elb'+sx]=[sx*(w+.13-b*.07),(bY+.13+barY)/2,barZ+.03]; } return J; } }

/* draw a body from a pose, placed in the world by f = {x,z,yaw}. Muscles grow lean: wide shoulders and arms, the waist stays athletic */
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s], dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm3=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }, crs3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function OB(c,ax,ay,az,sx,sy,sz,col){ R3.part(R3.UB,new Float32Array([ax[0]*sx*K,ax[1]*sx*K,ax[2]*sx*K,0, ay[0]*sy*K,ay[1]*sy*K,ay[2]*sy*K,0, az[0]*sz*K,az[1]*sz*K,az[2]*sz*K,0, c[0]*K,c[1]*K,c[2]*K,1]),col); }
const LB=(a,b,th,tw,col)=>R3.part(R3.UB,R3.beam(mul3(a,K),mul3(b,K),th*K,tw*K),col);
const SP=(p,r,col)=>R3.part(R3.US,R3.mm(R3.T(p[0]*K,p[1]*K,p[2]*K),R3.S(r*K,r*K,r*K)),col);
function drawBody(J,f,lk){ if(lk.olympia) return drawOlympia(J,f,lk); const m=(lk.buff||1)*(1+(lk.flex||0)*.08), bsh=1+(m-1)*.6, barm=1+(m-1)*.8, bch=1+(m-1)*.2, bleg=1+(m-1)*.35, W=p=>wp(f,p), D=v=>nrm3(wd(f,v));
  for(const sx of [-1,1]){ const h=W(J['hip'+sx]), k=W(J['knee'+sx]), a=W(J['ank'+sx]); LB(h,k,.085*bleg,.1*bleg,lk.legs); LB(k,a,.06*bleg,.07*bleg,lk.skin);
    const toe=D(J.toe), up=[0,1,0], sd=nrm3(crs3(Math.abs(toe[1])>.9?[1,0,0]:up,toe)), u2=crs3(toe,sd); OB(add3(a,mul3(toe,.06)),sd,u2,toe,.11,.07,.22,lk.shoe); }
  const pel=W(J.pelvis), ch=W(J.chest), A=nrm3(sub3(ch,pel)); let Fv=D(J.F); Fv=nrm3(sub3(Fv,mul3(A,dot3(Fv,A)))); const Wd=nrm3(crs3(A,Fv)), len=Math.hypot(...sub3(ch,pel));
  OB(mix3(pel,ch,.5),Wd,A,Fv,.2*bch,len+.06,.145*bch,lk.top);
  const def=clamp((m-1)/.65,0,1), chM=add3(mix3(pel,ch,.66),mul3(Fv,.075*bch)), abM=mix3(pel,ch,.3);
  OB(add3(chM,mul3(A,.02)),Wd,A,Fv,.2*bch,.18*bch,.065*bch,lk.top);
  if(lk.shirtless!==false){ OB(add3(abM,mul3(Fv,.065)),Wd,A,Fv,.14*bch,.24*bch,.04*bch,'#9a7550');
    if(def>.08) for(const cx of [-1,1]) for(const ry of [.085,0,-.085]) OB(add3(add3(abM,mul3(Wd,cx*.045*bch)),add3(mul3(A,ry*bch),mul3(Fv,.08+.015*def))),Wd,A,Fv,.05*bch,.058*bch,(.03+.05*def)*bch,lk.skin); }
  for(const sx of [-1,1]) SP(W(J['sho'+sx]),.085*bsh,lk.top);
  const hd=W(J.head); SP(mix3(ch,hd,.5),.07*bsh,lk.skin); SP(hd,.1,lk.skin); const HU=nrm3(sub3(hd,ch)); OB(add3(hd,mul3(HU,.055)),Wd,HU,nrm3(crs3(Wd,HU)),.1,.06,.1,lk.hair);
  for(const sx of [-1,1]){ const s=W(J['sho'+sx]), e=W(J['elb'+sx]), h=W(J['hand'+sx]); LB(s,e,.07*barm,.075*barm,lk.skin); LB(e,h,.055*barm,.06*barm,lk.skin); SP(mix3(s,e,.5),.06*barm,lk.skin); SP(h,.05,lk.skin);
    if(J.db) dumbbell(h,f); }
  R3.shadow(f.x*K,f.z*K,48); }
function dumbbell(h,f){ const ax=nrm3(wd(f,[1,0,0])); R3.part(R3.UC,R3.mm(R3.T(h[0]*K,h[1]*K,h[2]*K),R3.RY(f.yaw),R3.RZ(PI/2),R3.S(.03*K,.22*K,.03*K)),'#94a3b8');
  for(const o of [-.1,.1]){ const q=add3(h,mul3(ax,o)); R3.part(R3.UC,R3.mm(R3.T(q[0]*K,q[1]*K,q[2]*K),R3.RY(f.yaw),R3.RZ(PI/2),R3.S(.075*K,.04*K,.075*K)),'#111827'); } }
/* the owner: a Mr. Olympia physique in a tight gym shirt — capped delts, wide lats tapering into a tight
   waist, a full chest and an 8-pack showing through the shirt, peaked biceps and sweeping quads */
function drawOlympia(J,f,lk){ const W=p=>wp(f,p), D=v=>nrm3(wd(f,v)), sk=lk.skin, hi=lk.hi, dk=lk.shade, Fv0=()=>D(J.F), fx=1+(lk.flex||0)*.12;   /* fx: muscles swell when flexing on stage */
  for(const sx of [-1,1]){ const h=W(J['hip'+sx]), k=W(J['knee'+sx]), a=W(J['ank'+sx]), lj=J['knee'+sx];
    const inward=nrm3(sub3(W([0,lj[1],lj[2]]),k));
    LB(h,mix3(h,k,.5),.21,.23,lk.shorts); LB(mix3(h,k,.45),k,.18,.2,sk); SP(mix3(h,k,.33),.15,lk.shorts); SP(add3(mix3(h,k,.66),mul3(Fv0(),.04)),.12,sk);   /* huge thighs */
    SP(add3(mix3(h,k,.8),mul3(inward,.06)),.11,hi); SP(add3(mix3(h,k,.68),mul3(inward,-.07)),.11,sk); SP(add3(mix3(h,k,.55),mul3(inward,.08)),.09,sk);   /* teardrop, outer sweep, inner thigh */
    { const fr=Fv0(); LB(add3(mix3(h,k,.52),mul3(fr,.105)),add3(mix3(h,k,.9),add3(mul3(fr,.07),mul3(inward,.05))),.012,.012,dk);   /* quad separation: rectus vs teardrop */
      LB(add3(mix3(h,k,.5),add3(mul3(fr,.07),mul3(inward,-.08))),add3(mix3(h,k,.88),add3(mul3(fr,.05),mul3(inward,-.06))),.012,.012,dk);   /* and vs the outer sweep */
      SP(add3(k,mul3(fr,.04)),.06,dk); SP(add3(mix3(h,k,.75),add3(mul3(fr,-.08),mul3(inward,-.02))),.1,sk); }   /* kneecap, hamstring */
    LB(k,a,.1,.11,sk); SP(mix3(k,a,.3),.11,hi); SP(add3(mix3(k,a,.34),mul3(inward,-.04)),.09,sk); SP(add3(mix3(k,a,.3),mul3(inward,.035)),.085,sk); SP(add3(mix3(k,a,.26),mul3(Fv0(),-.05)),.095,hi); SP(mix3(k,a,.85),.055,sk);   /* diamond calves: two heads at the back, tapering to the ankle */
    const toe=D(J.toe), sd=nrm3(crs3(Math.abs(toe[1])>.9?[1,0,0]:[0,1,0],toe)), u2=crs3(toe,sd); OB(add3(a,mul3(toe,.06)),sd,u2,toe,.11,.07,.22,lk.shoe); }
  const pel=W(J.pelvis), ch=W(J.chest), A=nrm3(sub3(ch,pel)); let Fv=D(J.F); Fv=nrm3(sub3(Fv,mul3(A,dot3(Fv,A)))); const Wd=nrm3(crs3(A,Fv)), len=Math.hypot(...sub3(ch,pel));
  OB(add3(pel,mul3(A,.02)),Wd,A,Fv,.28,.2,.21,lk.shorts);                                             /* gym shorts */
  for(const sx of [-1,1]) SP(add3(add3(pel,mul3(Fv,-.1)),add3(mul3(Wd,sx*.075),mul3(A,-.03))),.115,lk.shorts);   /* glutes */
  OB(add3(add3(pel,mul3(Fv,-.2)),mul3(A,-.03)),Wd,A,Fv,.01,.13,.04,'#05070c');                              /* the line between them */
  OB(mix3(pel,ch,.32),Wd,A,Fv,.2,len*.52,.16,lk.top);                                                 /* tight waist, under the shirt */
  OB(mix3(pel,ch,.73),Wd,A,Fv,.41,len*.48,.23,lk.top);                                               /* tank top over the wide back + chest */
  for(const sx of [-1,1]) LB(add3(mix3(pel,ch,.5),mul3(Wd,sx*.13)),add3(mix3(pel,ch,.9),mul3(Wd,sx*.23*fx)),.115*fx,.135,lk.topDk);   /* lats flaring out (the V) */
  const pc=add3(mix3(pel,ch,.8),mul3(Fv,.11)); for(const sx of [-1,1]){ OB(add3(pc,mul3(Wd,sx*.09)),Wd,A,Fv,.175*fx,.15*fx,.09*fx,lk.topHi); OB(add3(add3(pc,mul3(Wd,sx*.09)),mul3(A,.06)),Wd,A,Fv,.15,.05,.06,lk.top); }   /* huge pecs, upper chest shelf */
  OB(add3(pc,mul3(Fv,.03)),Wd,A,Fv,.012,.15,.07,lk.topDk);   /* deep line between the pecs */
  for(const sx of [-1,1]) OB(add3(add3(pc,mul3(Wd,sx*.09)),mul3(A,-.078)),Wd,A,Fv,.17,.014,.09,lk.topDk);                     /* pec line underneath */
  const ab=add3(mix3(pel,ch,.4),mul3(Fv,.08)); OB(ab,Wd,A,Fv,.14,.36,.03,lk.topDk);                   /* the grooves between the abs, through the shirt */
  for(const cx of [-1,1]) for(const ry of [.144,.072,0,-.072,-.144]) OB(add3(add3(ab,mul3(Wd,cx*.036)),add3(mul3(A,ry),mul3(Fv,.026))),Wd,A,Fv,.052,.058,.05,lk.topHi);   /* 10-pack showing through the tight shirt */
  for(const sx of [-1,1]) for(const ry of [.1,.04,-.02]) OB(add3(add3(ab,mul3(Wd,sx*.115)),add3(mul3(A,ry+.06),mul3(Fv,-.01))),Wd,A,Fv,.03,.03,.04,lk.topHi);   /* serratus 'fingers' on the ribs */
  for(const sx of [-1,1]) OB(add3(mix3(pel,ch,.34),add3(mul3(Wd,sx*.105),mul3(Fv,.045))),Wd,A,Fv,.04,len*.36,.08,lk.top);
  /* bodybuilder sides: rounded oblique ridges that run diagonally down toward the hips, serratus 'fingers' angling
     up under the lats, and the V-lines cutting into the waistband, all showing through the tight shirt */
  for(const sx of [-1,1]){
    const side=(w,y,f)=>add3(add3(ab,mul3(Wd,sx*w)),add3(mul3(A,y),mul3(Fv,f)));
    /* one connected oblique band down the side, with three ridges running diagonally off it (no gaps between them) */
    LB(side(.158,.17,-.005),side(.13,-.17,.01),.06,.075,lk.topHi);
    for(let i=0;i<3;i++){ const y0=.13-i*.11; LB(side(.162,y0,-.005),side(.1,y0-.075,.022),.055,.06,lk.topHi);
      LB(side(.16,y0-.052,0),side(.1,y0-.12,.03),.012,.064,lk.topDk); }                 /* groove between ridges, so they read as packs but stay joined */
    LB(side(.18,.25,-.03),side(.2,.17,-.04),.05,.07,lk.topHi);                          /* serratus tucked under the lat */
    LB(side(.11,-.2,.03),side(.045,-.3,.035),.014,.03,lk.topDk); }   /* V-line into the shorts */
  /* the back: thick spinal erectors with the lower-back 'Christmas tree', and a deep groove up the middle */
  { const bk=(w,y,d)=>add3(add3(mix3(pel,ch,y),mul3(Wd,w)),mul3(Fv,-d));
    for(const sx of [-1,1]){ LB(bk(sx*.045,.12,.085),bk(sx*.045,.62,.12),.045,.05,lk.topHi);                       /* erectors */
      for(let i=0;i<3;i++){ const y=.22+i*.13; LB(bk(sx*.02,y+.08,.1+i*.008),bk(sx*.13,y-.02,.095+i*.01),.012,.03,lk.topDk); } }   /* the 'tree' */
    OB(bk(0,.45,.115),Wd,A,Fv,.012,len*.62,.05,lk.topDk);                                                    /* spine groove */
    for(const sx of [-1,1]){ OB(bk(sx*.09,.84,.13),Wd,A,Fv,.13,.12,.05,lk.topHi); OB(bk(sx*.15,.66,.115),Wd,A,Fv,.07,.14,.05,lk.topHi); } }   /* upper back + teres/rhomboid bulk */
  const hd=W(J.head), nk=mix3(ch,hd,.42); SP(nk,.125,sk);
  for(const sx of [-1,1]) LB(add3(nk,mul3(Wd,sx*.02)),W(J['sho'+sx]),.11,.12,sk);                     /* traps sloping into the delts */
  for(const sx of [-1,1]) LB(add3(add3(hd,mul3(Wd,sx*.06)),mul3(A,-.06)),add3(add3(nk,mul3(Wd,sx*.025)),add3(mul3(Fv,.07),mul3(A,-.05))),.03,.035,hi);   /* neck muscles to the collarbone */
  SP(hd,.1,sk); OB(add3(add3(hd,mul3(A,-.06)),mul3(Fv,.05)),Wd,A,Fv,.13,.06,.08,sk); SP(add3(add3(hd,mul3(A,-.085)),mul3(Fv,.085)),.035,hi);   /* square jaw + chin */
  const HU=nrm3(sub3(hd,ch)); OB(add3(hd,mul3(HU,.055)),Wd,HU,nrm3(crs3(Wd,HU)),.1,.06,.1,lk.hair);
  for(const sx of [-1,1]){ const s=W(J['sho'+sx]), e=W(J['elb'+sx]), h=W(J['hand'+sx]);
    SP(s,.155,sk); SP(add3(s,mul3(Fv,.065)),.1,hi); SP(add3(s,mul3(Fv,-.06)),.09,sk);   /* front + rear delt (capped) */
    LB(s,e,.125,.135,sk); SP(add3(mix3(s,e,.58),mul3(Fv,.05)),.118*fx,hi); SP(add3(mix3(s,e,.45),mul3(Fv,-.055)),.1,sk);
    LB(add3(mix3(s,e,.3),mul3(Fv,.122)),add3(mix3(s,e,.85),mul3(Fv,.1)),.014,.014,dk);   /* a vein down the biceps */
    LB(e,h,.095,.1,sk); SP(mix3(e,h,.25),.088,sk); SP(add3(mix3(e,h,.3),mul3(Wd,sx*.03)),.07,hi); SP(h,.055,sk);
    { const fr=nrm3(crs3(sub3(h,e),Wd)); LB(add3(mix3(e,h,.12),mul3(Fv,.06)),add3(mix3(e,h,.7),mul3(Wd,sx*.035)),.011,.011,dk); LB(add3(mix3(e,h,.35),mul3(Fv,.055)),add3(mix3(e,h,.8),mul3(Fv,.03)),.009,.009,dk); }   /* forearm veins */ if(J.db) dumbbell(h,f); }
  R3.shadow(f.x*K,f.z*K,56); }
/* bodybuilding stage poses, in the person's frame facing +z. yaw = how the body turns to the judges
   (0 front, PI back, -PI/2 a quarter turn showing the right side) */
const STAGE={relax:0,fdb:0,fls:0,sch:-PI/2,bdb:PI,bls:PI,str:-PI/2,abt:0,mm:0};
function stagePose(k,w){ const J={F:[0,0,1],toe:[0,0,1],pelvis:[0,.97,0],chest:[0,1.47,.03],head:[0,1.67,.04]};
  for(const sx of [-1,1]){ J['hip'+sx]=[sx*.11,.97,0]; J['knee'+sx]=[sx*.15,.53,.05]; J['ank'+sx]=[sx*.19,.1,0]; J['sho'+sx]=[sx*w,1.45,.02]; }
  const arm=(sx,e,h)=>{ J['elb'+sx]=e; J['hand'+sx]=h; };
  for(const sx of [-1,1]){
    if(k==='fdb'||k==='bdb') arm(sx,[sx*(w+.32),1.5,0],[sx*(w+.3),1.8,.05]);                              /* double biceps: arms up, fists by the head */
    else if(k==='fls'||k==='bls') arm(sx,[sx*(w+.25),1.2,.08],[sx*.16,1.03,.05]);                          /* lat spread: fists on the waist, elbows wide */
    else if(k==='abt') arm(sx,[sx*(w+.2),1.72,-.02],[sx*.06,1.72,-.1]);                                     /* hands behind the head */
    else if(k==='mm') arm(sx,[sx*(w+.13),1.25,.2],[sx*.05,1.12,.28]);                                       /* crab: fists together in front */
    else if(k==='relax') arm(sx,[sx*(w+.1),1.17,0],[sx*(w+.12),.9,.04]); }                                /* standing relaxed, lats flared */
  if(k==='sch'){ arm(-1,[-(w+.02),1.15,.22],[.04,1.05,.3]); arm(1,[w+.08,1.18,.18],[.08,1.06,.3]); J['knee1']=[.15,.55,.15]; J['ank1']=[.12,.14,.12]; }
  if(k==='str'){ arm(1,[w+.03,1.15,-.06],[w+.02,.88,-.1]); arm(-1,[-(w+.05),1.15,-.2],[w*.4,.92,-.16]); J['knee1']=[.15,.55,.12]; }
  if(k==='abt'){ J['knee1']=[.13,.55,.2]; J['ank1']=[.13,.1,.28]; J.chest=[0,1.44,.07]; }
  if(k==='mm'){ J.head=[0,1.62,.1]; J.chest=[0,1.45,.07]; }
  return J; }
/* ease one pose toward another (k = 0..1 per call) */
function blendPose(cur,tgt,k){ if(!cur) return JSON.parse(JSON.stringify(tgt)); for(const n in tgt){ const b=tgt[n]; if(!Array.isArray(b)){ cur[n]=b; continue; } const a=Array.isArray(cur[n])?cur[n]:b; cur[n]=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]; } return cur; }
/* the barbell (moved here so the powerlifting meet draws the same bar) */
/* a barbell across the person's x axis at local point c; plates depend on the weight */
function barbell(f,c,weight,tilt){ const p=wp(f,c); R3.part(R3.UC,R3.mm(R3.T(p[0]*K,p[1]*K,p[2]*K),R3.RY(f.yaw),R3.RZ(PI/2+(tilt||0)),R3.S(.028*K,1.0*K,.028*K)),'#cbd5e1');
  const per=Math.max(0,(weight-45)/2), n=clamp(Math.ceil(per/45),1,9), big=weight>1500, huge=weight>15000;
  for(const sx of [-1,1]) for(let i=0;i<n;i++){ const q=wp(f,[c[0]+sx*(.6+i*.052),c[1],c[2]]); R3.part(R3.UC,R3.mm(R3.T(q[0]*K,q[1]*K,q[2]*K),R3.RY(f.yaw),R3.RZ(PI/2+(tilt||0)),R3.S((huge?.29:big?.23:.19)*K,(huge?.03:.024)*K,(huge?.29:big?.23:.19)*K)),huge?(i%2?'#7f1d1d':'#dc2626'):big?(i%2?'#b45309':'#f59e0b'):(i%2?'#20304f':'#1a2338')); } }
return {barbell,STAGE,stagePose,blendPose,pose,drawBody,drawOlympia,dumbbell,OB,LB,SP,wp,wd,sub3,add3,mul3,dot3,nrm3,crs3,mix3};
};
