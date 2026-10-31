function makeR3(glc,stage){
  let gl=null;
  try{ gl=glc.getContext('webgl',{antialias:true,alpha:false})||glc.getContext('experimental-webgl'); }catch(e){}
  if(!gl) return {ok:false};
  const hx=h=>{ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  let time=0;
  /* ---- math ---- */
  const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function mul(a,b){ const o=new Float32Array(16); for(let i=0;i<4;i++) for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; }
  const mm=(...ms)=>ms.reduce((a,b)=>mul(a,b));
  const T=(x,y,z)=>{ const m=I(); m[12]=x; m[13]=y; m[14]=z; return m; };
  const S=(x,y,z)=>{ const m=I(); m[0]=x; m[5]=y; m[10]=z; return m; };
  const RY=a=>{ const c=Math.cos(a), s=Math.sin(a), m=I(); m[0]=c; m[2]=-s; m[8]=s; m[10]=c; return m; };
  const RX=a=>{ const c=Math.cos(a), s=Math.sin(a), m=I(); m[5]=c; m[6]=s; m[9]=-s; m[10]=c; return m; };
  const RZ=a=>{ const c=Math.cos(a), s=Math.sin(a), m=I(); m[0]=c; m[1]=s; m[4]=-s; m[5]=c; return m; };
  function persp(fy,as,n,f){ const t=1/Math.tan(fy/2), m=new Float32Array(16); m[0]=t/as; m[5]=t; m[10]=(f+n)/(n-f); m[11]=-1; m[14]=2*f*n/(n-f); return m; }
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const nrm=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }, dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function lookAt(e,c,u){
    const z=nrm(sub(e,c)), x=nrm(cross(u,z)), y=cross(z,x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]);
  }
  /* unit box stretched between points a and b */
  function beam(a,b,th,tw){
    const d=sub(b,a), L=Math.hypot(d[0],d[1],d[2])||1, xa=[d[0]/L,d[1]/L,d[2]/L];
    let up=Math.abs(xa[1])>.95?[1,0,0]:[0,1,0];
    const za=nrm(cross(xa,up)), ya=cross(za,xa);
    return new Float32Array([xa[0]*L,xa[1]*L,xa[2]*L,0, ya[0]*th,ya[1]*th,ya[2]*th,0, za[0]*tw,za[1]*tw,za[2]*tw,0, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);
  }
  const tp=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  const COLC={};
  const rgb=h=>COLC[h]||(COLC[h]=hx(h).map(v=>v/255));

  /* ---- shaders ---- */
  function prog(vs,fs){
    const mk=(t,s)=>{ const sh=gl.createShader(t); gl.shaderSource(sh,s); gl.compileShader(sh); if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p=gl.createProgram(); gl.attachShader(p,mk(gl.VERTEX_SHADER,vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const o={p,a:{},u:{}};
    const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES); for(let i=0;i<na;i++){ const n=gl.getActiveAttrib(p,i).name; o.a[n]=gl.getAttribLocation(p,n); }
    const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<nu;i++){ const n=gl.getActiveUniform(p,i).name; o.u[n]=gl.getUniformLocation(p,n); }
    return o;
  }
  let PC, PT;
  try{
    PC=prog(`attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;attribute float aPh;
uniform mat4 uVP,uM;uniform vec3 uTint;uniform float uTime,uCheer;
varying vec3 vCol;varying vec3 vN;varying vec3 vW;
void main(){vec3 p=aPos;if(aPh>0.0){p.y+=abs(sin(uTime*9.0+aPh))*uCheer*6.0+sin(uTime*1.7+aPh)*0.5;}
vec4 w=uM*vec4(p,1.0);vW=w.xyz;vN=mat3(uM)*aNor;vCol=aCol*uTint;gl_Position=uVP*w;}`,
`precision mediump float;varying vec3 vCol;varying vec3 vN;varying vec3 vW;
uniform vec3 uLight,uEye,uFog;uniform float uAlpha;
void main(){vec3 n=normalize(vN);float d=max(dot(n,uLight),0.0);float h=0.5+0.5*n.y;
vec3 c=vCol*(0.34+0.26*h+0.52*d);float f=clamp((length(vW-uEye)-1500.0)/2600.0,0.0,0.55);
gl_FragColor=vec4(mix(c,uFog,f),uAlpha);}`);
    PT=prog(`attribute vec3 aPos;attribute vec2 aUV;uniform mat4 uVP,uM;varying vec2 vUV;
void main(){vUV=aUV;gl_Position=uVP*uM*vec4(aPos,1.0);}`,
`precision mediump float;varying vec2 vUV;uniform sampler2D uTex;uniform vec4 uUVR;uniform vec3 uTint;uniform float uAlpha;
void main(){vec4 t=texture2D(uTex,vUV*uUVR.zw+uUVR.xy);if(t.a<0.04)discard;gl_FragColor=vec4(t.rgb*uTint,t.a*uAlpha);}`);
  }catch(e){ console.warn('3D disabled',e); return {ok:false}; }

  /* ---- geometry ---- */
  function primBox(){
    const p=[],n=[];
    for(const f of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const u=Math.abs(f[1])>0?[1,0,0]:[0,1,0], v=cross(f,u);
      const c=(a,b)=>[f[0]*.5+u[0]*a*.5+v[0]*b*.5,f[1]*.5+u[1]*a*.5+v[1]*b*.5,f[2]*.5+u[2]*a*.5+v[2]*b*.5];
      for(const q of [c(-1,-1),c(1,-1),c(1,1),c(-1,-1),c(1,1),c(-1,1)]){ p.push(...q); n.push(...f); }
    }
    return {p,n};
  }
  function primCyl(seg,rt){
    rt=rt===undefined?1:rt;
    const p=[],n=[];
    for(let i=0;i<seg;i++){
      const a0=i/seg*Math.PI*2, a1=(i+1)/seg*Math.PI*2, c0=Math.cos(a0), s0=Math.sin(a0), c1=Math.cos(a1), s1=Math.sin(a1);
      const A=[c0,-.5,s0],B=[c1,-.5,s1],C=[c1*rt,.5,s1*rt],D=[c0*rt,.5,s0*rt];
      for(const q of [A,B,C,A,C,D]){ p.push(...q); const r=Math.hypot(q[0],q[2])||1; n.push(q[0]/r,0,q[2]/r); }
      for(const q of [[0,.5,0],D,C]){ p.push(...q); n.push(0,1,0); }
      for(const q of [[0,-.5,0],B,A]){ p.push(...q); n.push(0,-1,0); }
    }
    return {p,n};
  }
  function primSphere(la,lo){
    const p=[],n=[], P=(i,j)=>{ const t=i/la*Math.PI, f=j/lo*Math.PI*2; return [Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)]; };
    for(let i=0;i<la;i++) for(let j=0;j<lo;j++){ const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1); for(const q of [a,b,c,a,c,d]){ p.push(...q); n.push(...q); } }
    return {p,n};
  }
  class Geo{
    constructor(){ this.p=[]; this.n=[]; this.c=[]; this.ph=[]; }
    add(pr,m,col,ph=0){
      const c=typeof col==='string'?rgb(col):col;
      for(let i=0;i<pr.p.length;i+=3){
        const v=tp(m,[pr.p[i],pr.p[i+1],pr.p[i+2]]);
        const nn=nrm([m[0]*pr.n[i]+m[4]*pr.n[i+1]+m[8]*pr.n[i+2],m[1]*pr.n[i]+m[5]*pr.n[i+1]+m[9]*pr.n[i+2],m[2]*pr.n[i]+m[6]*pr.n[i+1]+m[10]*pr.n[i+2]]);
        this.p.push(v[0],v[1],v[2]); this.n.push(nn[0],nn[1],nn[2]); this.c.push(c[0],c[1],c[2]); this.ph.push(ph);
      }
    }
    quad(a,b,c,d,col,ph=0){
      const k=typeof col==='string'?rgb(col):col, nn=nrm(cross(sub(b,a),sub(c,a)));
      for(const q of [a,b,c,a,c,d]){ this.p.push(...q); this.n.push(...nn); this.c.push(...k); this.ph.push(ph); }
    }
  }
  function upload(g){
    const mk=(arr)=>{ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW); return b; };
    return {pos:mk(g.p),nor:mk(g.n),col:mk(g.c),ph:mk(g.ph),n:g.p.length/3};
  }
  function freeMesh(m){ if(!m) return; for(const k of ['pos','nor','col','ph']) gl.deleteBuffer(m[k]); }
  const unit=pr=>{ const g=new Geo(); g.add(pr,I(),[1,1,1]); return upload(g); };
  const UB=unit(primBox()), UC=unit(primCyl(14)), US=unit(primSphere(8,12)), UCT=unit(primCyl(12,.6));
  /* textured quad meshes */
  function texMesh(pos,uv){
    const b1=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b1); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
    const b2=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b2); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
    return {pos:b1,uv:b2,n:pos.length/3};
  }
  const QYZ=texMesh([0,-.5,-.5, 0,-.5,.5, 0,.5,.5, 0,-.5,-.5, 0,.5,.5, 0,.5,-.5],[1,1, 0,1, 0,0, 1,1, 0,0, 1,0]);
  const QXZ=texMesh([-.5,0,-.5, .5,0,-.5, .5,0,.5, -.5,0,-.5, .5,0,.5, -.5,0,.5],[0,0, 1,0, 1,1, 0,0, 1,1, 0,1]);
  function mkTex(canvas,mip){
    const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    if(mip){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }
  /* number atlas */
  const nc=document.createElement('canvas'); nc.width=nc.height=1024;
  { const c=nc.getContext('2d'); c.textAlign='center'; c.textBaseline='middle'; c.font='900 74px "Arial Black",Impact,sans-serif'; c.lineJoin='round';
    for(let i=0;i<100;i++){ const x=(i%10)*102.4+51.2, y=Math.floor(i/10)*102.4+54; c.lineWidth=10; c.strokeStyle='rgba(0,0,0,.55)'; c.strokeText(String(i),x,y); c.fillStyle='#fff'; c.fillText(String(i),x,y); } }
  const numTex=mkTex(nc,true);
  const ccv=document.createElement('canvas'); ccv.width=256; ccv.height=128;
  { const c=ccv.getContext('2d'); c.textAlign='center'; c.textBaseline='middle'; c.font='900 104px "Arial Black",Impact,sans-serif'; c.lineJoin='round';
    [['C',64],['A',192]].forEach(([l,x])=>{ c.lineWidth=12; c.strokeStyle='rgba(0,0,0,.55)'; c.strokeText(l,x,68); c.fillStyle='#fff'; c.fillText(l,x,68); }); }
  const capTex=mkTex(ccv,true);
  const sc=document.createElement('canvas'); sc.width=sc.height=64;
  { const c=sc.getContext('2d'), g=c.createRadialGradient(32,32,2,32,32,32); g.addColorStop(0,'rgba(10,20,40,.55)'); g.addColorStop(1,'rgba(10,20,40,0)'); c.fillStyle=g; c.fillRect(0,0,64,64); }
  const shTex=mkTex(sc,false);

  /* ---- draw helpers ---- */
  let VP=I(), eye=[0,400,800];
  function bindC(m){
    gl.bindBuffer(gl.ARRAY_BUFFER,m.pos); gl.vertexAttribPointer(PC.a.aPos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.nor); gl.vertexAttribPointer(PC.a.aNor,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.col); gl.vertexAttribPointer(PC.a.aCol,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.ph); gl.vertexAttribPointer(PC.a.aPh,1,gl.FLOAT,false,0,0);
  }
  let curMesh=null;
  function part(mesh,m,col){ if(curMesh!==mesh){ bindC(mesh); curMesh=mesh; } gl.uniformMatrix4fv(PC.u.uM,false,m); gl.uniform3fv(PC.u.uTint,typeof col==='string'?rgb(col):col); gl.drawArrays(gl.TRIANGLES,0,mesh.n); }
  let cheer=0;
  function useC(){
    gl.useProgram(PC.p); curMesh=null;
    for(const k of ['aPos','aNor','aCol','aPh']) gl.enableVertexAttribArray(PC.a[k]);
    gl.uniformMatrix4fv(PC.u.uVP,false,VP); gl.uniform3fv(PC.u.uLight,nrm([.35,.85,.4])); gl.uniform3fv(PC.u.uEye,eye);
    gl.uniform3fv(PC.u.uFog,[.04,.06,.12]); gl.uniform1f(PC.u.uAlpha,1); gl.uniform1f(PC.u.uTime,time); gl.uniform1f(PC.u.uCheer,cheer);
  }
  function useT(){
    for(const k of ['aPos','aNor','aCol','aPh']) if(PC.a[k]!==undefined) gl.disableVertexAttribArray(PC.a[k]);
    gl.useProgram(PT.p); curMesh=null;
    gl.enableVertexAttribArray(PT.a.aPos); gl.enableVertexAttribArray(PT.a.aUV);
    gl.uniformMatrix4fv(PT.u.uVP,false,VP); gl.uniform1i(PT.u.uTex,0); gl.activeTexture(gl.TEXTURE0);
  }
  function tquad(mesh,tex,m,uvr,tint,alpha){
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.pos); gl.vertexAttribPointer(PT.a.aPos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv); gl.vertexAttribPointer(PT.a.aUV,2,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(PT.u.uM,false,m); gl.uniform4fv(PT.u.uUVR,uvr); gl.uniform3fv(PT.u.uTint,tint); gl.uniform1f(PT.u.uAlpha,alpha);
    gl.drawArrays(gl.TRIANGLES,0,mesh.n);
  }
  const decals=[], shadows=[];
  const numUV=n=>{ n=Math.max(0,Math.min(99,Math.round(n))); return [(n%10)/10,Math.floor(n/10)/10,.1,.1]; };

  /* ---- ground and static scenery ---- */
  let ground=null, groundTex=null, world=null, crowdM=null;
  function setGround(canvas,x0,z0,x1,z1,mip){
    if(groundTex) gl.deleteTexture(groundTex);
    groundTex=mkTex(canvas,!!mip);
    ground=texMesh([x0,0,z0, x1,0,z0, x1,0,z1, x0,0,z0, x1,0,z1, x0,0,z1],[0,0, 1,0, 1,1, 0,0, 1,1, 0,1]);
  }
  function setStatic(build){ const g=new Geo(), c=new Geo(); build(g,c,{primBox,primCyl,primSphere,T,S,RX,RY,RZ,mm,I}); freeMesh(world); freeMesh(crowdM); world=g.p.length?upload(g):null; crowdM=c.p.length?upload(c):null; }
  /* crowd: seats in tiers with fans that bob when the crowd cheers */
  const FANS=['#e2e8f0','#f87171','#60a5fa','#fbbf24','#34d399','#f472b6','#a78bfa','#94a3b8','#1f2937','#f97316'];
  function crowdRow(g,c,a,b,y,depth,rows,seat){
    const d=sub(b,a), L=Math.hypot(d[0],d[2]), n=Math.max(1,Math.floor(L/seat)), ux=d[0]/L, uz=d[2]/L, px=uz, pz=-ux;
    for(let r=0;r<rows;r++){
      const yy=y+r*seat*.75, off=r*seat*.9;
      g.add(primBox(),mm(T((a[0]+b[0])/2+px*(off+depth/2),yy-seat*.4,(a[2]+b[2])/2+pz*(off+depth/2)),RY(-Math.atan2(uz,ux)),S(L,seat*.8,seat*.9)),r%2?'#1e293b':'#273449');
      for(let i=0;i<n;i++){ if(Math.random()<.12) continue; const t=(i+.5)/n, x=a[0]+d[0]*t+px*(off+seat*.3), z=a[2]+d[2]*t+pz*(off+seat*.3);
        c.add(primBox(),mm(T(x,yy+seat*.25,z),S(seat*.45,seat*.7,seat*.45)),FANS[Math.floor(Math.random()*FANS.length)],1+Math.random()*30); }
    }
  }

  /* ---- athlete model (built like the hockey players) ---- */
  const SKIN=['#e0b48f','#c68e63','#8d5a3b','#f1c7a1','#a9724d'];
  function athlete(o){
    const t=o.team, base=mm(T(o.x,0,o.z),RY(-o.ang)), k=Math.min(1,o.run||0);
    o.ph=(o.ph||0)+(o.dt||1/60)*(3+9*k);
    const crouch=o.crouch||0, hip=(o.fb?24:25)-crouch*8-(o.down?18:0), skin=SKIN[(o.num||0)%SKIN.length];
    const mz=Math.min(1.7,o.buff||1), bch=1+(mz-1)*0.2, bsh=1+(mz-1)*0.6, barm=1+(mz-1)*0.8, bleg=1+(mz-1)*0.35; /* muscular: big shoulders & arms, moderate chest, lean waist */
    const pants=t.pants||'#e5e7eb', socks=t.dark||t.jersey;
    if(o.down){ /* player on the ground after a dive or tackle */
      const b2=mm(base,T(0,4,0),RZ(-Math.PI/2.2));
      part(UB,mm(b2,T(0,8,0),S(7,15,12)),t.jersey); part(UB,mm(b2,T(0,-6,0),S(6,14,9)),pants);
      part(US,mm(b2,T(0,19,0),S(4,4,4)),o.fb?t.helmet:skin); return;
    }
    for(const s of [-1,1]){
      const sw=Math.sin(o.ph+(s>0?0:Math.PI))*.75*k, spread=crouch*.35;
      const leg=mm(base,T(0,hip,s*3.3),RX(-s*spread),RZ(sw));
      part(UB,mm(leg,T(0,-6,0),S(4.8*bleg,12,4.8*bleg)),pants);
      part(UB,mm(leg,T(0,-16.5,0),S(4.1*bleg,10,4.1*bleg)),socks);
      part(UB,mm(leg,T(1.6,-hip+1.6+(o.down?0:0),0),RZ(-sw*.3),S(7.5,3,4.6)),'#111827');
    }
    const lean=(o.fb?.12:.06)+.28*k+crouch*.45;
    const tor=mm(base,T(0,hip,0),RZ(-lean));
    part(UB,mm(tor,T(0,8,0),S(7*bch,15,12*bch)),t.jersey);
    part(UB,mm(tor,T(0,1.5,0),S(7.4*bch,2,12.4*bch)),t.trim);
    part(UB,mm(tor,T(0,15.5,0),S((o.fb?9:7.6)*bsh,o.fb?5:3.6,(o.fb?18:14)*bsh)),t.jersey);
    part(US,mm(tor,T(.6,20,0),S(2.2,2.2,2.2)),skin);
    part(US,mm(tor,T(.8,23,0),S(3.4,3.9,3.3)),skin);
    if(o.fb){ part(US,mm(tor,T(.4,23.6,0),S(4.4,4.5,4.3)),t.helmet); part(UB,mm(tor,T(4.3,22,0),S(.9,3.4,4.8)),'#d1d5db'); part(UB,mm(tor,T(.4,24.2,0),S(8.6,.8,1)),t.trim); }
    else if(o.helm){ part(US,mm(tor,T(.4,24,0),S(3.9,3.6,3.8)),t.dark); part(UB,mm(tor,T(3.6,23,0),S(3,.6,4.6)),t.dark); }
    else { part(US,mm(tor,T(.4,24.6,0),S(3.6,2.4,3.5)),t.dark); part(UB,mm(tor,T(3.5,24,0),S(3.2,.5,4)),t.dark); }
    decals.push({m:mm(tor,T(-3.55,9.5,0),RY(Math.PI),S(1,7.5,7.5)),n:o.num,c:t.trim});
    decals.push({m:mm(tor,T(3.55,10.5,0),S(1,4.5,4.5)),n:o.num,c:t.trim});
    /* arms */
    const sh=15, L=p=>tp(mm(tor),p);
    let ha, hb; const pose=o.pose||'run', ph=o.ph;
    if(pose==='bat'){ const s=o.swing||0, a=-2.2+s*3.6; ha=[2+s*5,12-s*2,-4+s*5]; hb=[2.5+s*5,12.5-s*2,-2+s*5]; o._bat=a; }
    else if(pose==='pitch'){ const p=o.arm||0; ha=[7,12,-6]; hb=[lerp(-9,12,p),lerp(24,9,p),7]; }
    else if(pose==='ready'){ ha=[8,5,-4]; hb=[8,5,4]; }
    else if(pose==='carry'){ ha=[4,10,-6]; hb=[5,9,5]; }
    else if(pose==='throw'){ const p=o.arm||0; ha=[8,13,-6]; hb=[lerp(-8,10,p),lerp(22,10,p),7]; }
    else if(pose==='block'){ ha=[11,13,-5]; hb=[11,13,5]; }
    else if(pose==='cheer'){ const j=Math.abs(Math.sin(ph*1.5))*3; ha=[2,30+j,-7]; hb=[2,30+j,7]; }
    else { const a=Math.sin(ph)*6*k; ha=[a+1.5,7,-8.5]; hb=[-a+1.5,7,8.5]; }
    const sl=L([0,sh,-6.5]), sr=L([0,sh,6.5]), A=L(ha), B=L(hb);
    part(UB,beam(sl,A,2.8*barm,2.8*barm),t.jersey); part(UB,beam(sr,B,2.8*barm,2.8*barm),t.jersey);
    part(US,mm(T(...A),S(1.6,1.6,1.6)),skin); part(US,mm(T(...B),S(1.6,1.6,1.6)),skin);
    if(o.glove) part(UB,mm(T(...A),S(3.2,3.6,2.4)),'#8b5a2b');
    if(pose==='bat'){ const a=o._bat, dir=[Math.cos(a)*.35,Math.sin(a)+.25,Math.sin(a)*-.9+.2], d=nrm(dir), top=[B[0]+d[0]*26,B[1]+d[1]*26,B[2]+d[2]*26];
      const m=mm(base,RZ(0)); const bb=tp(m,[0,0,0]); void bb;
      part(UB,beam(B,top,1.5,1.5),'#c8955a'); }
    if(pose==='carry'&&o.fb){ part(US,mm(T(...B),S(3.4,2.1,2.1)),'#7b3f13'); }
    shadows.push([o.x,o.z,o.fb?30:26]);
  }

  /* ---- camera and frame ---- */
  let cw=0, ch=0;
  function resize(){ const r=stage.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1); const w=Math.max(2,Math.round(r.width*d)), h=Math.max(2,Math.round(r.height*d)); if(w!==cw||h!==ch){ cw=w; ch=h; glc.width=w; glc.height=h; } }
  function frame(cam,draw,dt){
    time+=dt||1/60; resize();
    gl.viewport(0,0,cw,ch); gl.clearColor(.04,.06,.12,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
    eye=cam.eye; VP=mul(persp(cam.fov*Math.PI/180,cw/ch,cam.near||6,cam.far||14000),lookAt(cam.eye,cam.center,[0,1,0]));
    cheer=cam.cheer||0;
    useC(); if(world) part(world,I(),[1,1,1]); if(crowdM) part(crowdM,I(),[1,1,1]);
    decals.length=0; shadows.length=0;
    draw&&draw();
    useT();
    if(ground) tquad(ground,groundTex,I(),[0,0,1,1],[1,1,1],1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for(const [x,z,s] of shadows) tquad(QXZ,shTex,mm(T(x+3,.4,z+3),S(s,1,s*.85)),[0,0,1,1],[1,1,1],1);
    gl.depthMask(true);
    for(const d of decals) tquad(QYZ,numTex,d.m,numUV(d.n),rgb(d.c),1);
    gl.disable(gl.BLEND);
    for(const k of ['aPos','aUV']) gl.disableVertexAttribArray(PT.a[k]);
  }
  function proj(x,y,z){ const m=VP, X=m[0]*x+m[4]*y+m[8]*z+m[12], Y=m[1]*x+m[5]*y+m[9]*z+m[13], Wc=m[3]*x+m[7]*y+m[11]*z+m[15]; if(Wc<=1) return null; return [(X/Wc*.5+.5),(1-(Y/Wc*.5+.5)),Wc]; }
  function inv(m){ const a=m, o=new Float32Array(16);
    const b00=a[0]*a[5]-a[1]*a[4],b01=a[0]*a[6]-a[2]*a[4],b02=a[0]*a[7]-a[3]*a[4],b03=a[1]*a[6]-a[2]*a[5],b04=a[1]*a[7]-a[3]*a[5],b05=a[2]*a[7]-a[3]*a[6],b06=a[8]*a[13]-a[9]*a[12],b07=a[8]*a[14]-a[10]*a[12],b08=a[8]*a[15]-a[11]*a[12],b09=a[9]*a[14]-a[10]*a[13],b10=a[9]*a[15]-a[11]*a[13],b11=a[10]*a[15]-a[11]*a[14];
    const det=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
    o[0]=(a[5]*b11-a[6]*b10+a[7]*b09)*det;o[1]=(a[2]*b10-a[1]*b11-a[3]*b09)*det;o[2]=(a[13]*b05-a[14]*b04+a[15]*b03)*det;o[3]=(a[10]*b04-a[9]*b05-a[11]*b03)*det;
    o[4]=(a[6]*b08-a[4]*b11-a[7]*b07)*det;o[5]=(a[0]*b11-a[2]*b08+a[3]*b07)*det;o[6]=(a[14]*b02-a[12]*b05-a[15]*b01)*det;o[7]=(a[8]*b05-a[10]*b02+a[11]*b01)*det;
    o[8]=(a[4]*b10-a[5]*b08+a[7]*b06)*det;o[9]=(a[1]*b08-a[0]*b10-a[3]*b06)*det;o[10]=(a[12]*b04-a[13]*b02+a[15]*b00)*det;o[11]=(a[9]*b02-a[8]*b04-a[11]*b00)*det;
    o[12]=(a[5]*b07-a[4]*b09-a[6]*b06)*det;o[13]=(a[0]*b09-a[1]*b07+a[2]*b06)*det;o[14]=(a[13]*b01-a[12]*b03-a[14]*b00)*det;o[15]=(a[8]*b03-a[9]*b01+a[10]*b00)*det; return o; }
  /* screen point (0..1, 0..1) to a point on the ground */
  function unproject(u,v){ const M=inv(VP), x=u*2-1, y=1-v*2, P=(z)=>{ const r=[M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14],M[3]*x+M[7]*y+M[11]*z+M[15]]; return [r[0]/r[3],r[1]/r[3],r[2]/r[3]]; }; const a=P(-1), b=P(1); const t=a[1]/(a[1]-b[1]); return [a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]; }
  const ball=(x,y,z,r,col)=>part(US,mm(T(x,y,z),S(r,r,r)),col);
  const shadow=(x,z,s)=>shadows.push([x,z,s]);
  return {ok:true,setGround,setStatic,crowdRow,frame,part,athlete,ball,shadow,proj,unproject,UB,UC,US,T,S,RX,RY,RZ,mm,beam,I};
}

