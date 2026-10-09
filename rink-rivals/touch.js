/* Rink Rivals touch-screen mode: on-screen stick and buttons that press the game's keys.
   Each page sets window.RR_TOUCH = {stick:'wasd'|'ad'|'none', buttons:[[label,code],...], pedals:bool} before loading this. */
(function(){
  const cfg=window.RR_TOUCH||{stick:'wasd',buttons:[]};
  const KEY='rrTouchMode';
  const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
  let on; try{ const v=localStorage.getItem(KEY); on=v===null?coarse:v==='1'; }catch(e){ on=coarse; }
  const held=new Map();
  function send(type,code){ const key=code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code.startsWith('Digit')?code.slice(5):code==='ShiftLeft'?'Shift':code; window.dispatchEvent(new KeyboardEvent(type,{code,key,bubbles:true,cancelable:true})); }
  function down(code){ const n=held.get(code)||0; held.set(code,n+1); if(n===0) send('keydown',code); }
  function up(code){ const n=held.get(code)||0; if(n<=1){ held.delete(code); if(n===1) send('keyup',code); } else held.set(code,n-1); }
  const css=`
#rrT{position:fixed;inset:0;pointer-events:none;z-index:9000;font-family:'Big Shoulders Display','Arial Narrow',sans-serif;user-select:none;-webkit-user-select:none}
#rrT .b{pointer-events:auto;touch-action:none;position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:50%;background:rgba(15,23,42,.55);border:2px solid rgba(255,255,255,.55);color:#fff;font-weight:800;font-size:15px;line-height:1.05;box-shadow:0 2px 8px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent}
#rrT .b.on{background:rgba(245,158,11,.8);border-color:#fff}
#rrT .sm{border-radius:10px;font-size:13px;width:54px;height:34px}
#rrT .stick{pointer-events:auto;touch-action:none;position:absolute;left:18px;bottom:18px;width:150px;height:150px;border-radius:50%;background:rgba(15,23,42,.35);border:2px solid rgba(255,255,255,.45)}
#rrT .nub{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;background:rgba(255,255,255,.75);transition:transform .05s}
#rrTog{position:fixed;left:10px;bottom:10px;z-index:9001;font:800 13px 'Big Shoulders Display','Arial Narrow',sans-serif;padding:6px 10px;border-radius:999px;border:2px solid rgba(255,255,255,.6);background:rgba(15,23,42,.7);color:#fff;touch-action:manipulation}
body.rrTouchOn #rrTog{left:50%;transform:translateX(-50%);bottom:6px}
body.rrTouchOn{overscroll-behavior:none}`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const root=document.createElement('div'); root.id='rrT';
  function bindBtn(el,code){ const press=e=>{ e.preventDefault(); e.stopPropagation(); if(el.dataset.p) return; el.dataset.p='1'; el.classList.add('on'); down(code); try{ el.setPointerCapture(e.pointerId); }catch(er){} };
    const rel=e=>{ if(!el.dataset.p) return; e.preventDefault(); delete el.dataset.p; el.classList.remove('on'); up(code); };
    el.addEventListener('pointerdown',press); el.addEventListener('pointerup',rel); el.addEventListener('pointercancel',rel); el.addEventListener('lostpointercapture',rel); el.addEventListener('contextmenu',e=>e.preventDefault()); }
  function mk(label,code,x,y,size,cls){ const el=document.createElement('div'); el.className='b'+(cls?' '+cls:''); el.innerHTML=label; Object.assign(el.style,{width:size+'px',height:(cls==='sm'?34:size)+'px'}); if(x<0) el.style.right=(-x)+'px'; else el.style.left=x+'px'; if(y<0) el.style.bottom=(-y)+'px'; else el.style.top=y+'px'; bindBtn(el,code); root.appendChild(el); return el; }
  /* movement */
  if(cfg.pedals){ mk('◀','KeyA',18,-24,84); mk('▶','KeyD',116,-24,84); }
  else if(cfg.stick&&cfg.stick!=='none'){ const s=document.createElement('div'); s.className='stick'; const nub=document.createElement('div'); nub.className='nub'; s.appendChild(nub); root.appendChild(s);
    const dirs=cfg.stick==='ad'?{l:'KeyA',r:'KeyD',u:'KeyW',d:'KeyS'}:{l:'KeyA',r:'KeyD',u:'KeyW',d:'KeyS'}; const cur={l:0,r:0,u:0,d:0}; let pid=null;
    const set=(k,v)=>{ if(cur[k]===v) return; cur[k]=v; v?down(dirs[k]):up(dirs[k]); };
    const move=e=>{ const r=s.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; let dx=e.clientX-cx, dy=e.clientY-cy; const L=Math.hypot(dx,dy), mx=r.width/2; if(L>mx){ dx*=mx/L; dy*=mx/L; } nub.style.transform=`translate(${dx}px,${dy}px)`; const t=mx*.32; set('l',dx<-t?1:0); set('r',dx>t?1:0); set('u',dy<-t?1:0); set('d',dy>t?1:0); };
    const end=()=>{ pid=null; nub.style.transform=''; for(const k in cur) set(k,0); };
    s.addEventListener('pointerdown',e=>{ e.preventDefault(); pid=e.pointerId; try{ s.setPointerCapture(pid); }catch(er){} move(e); });
    s.addEventListener('pointermove',e=>{ if(e.pointerId===pid) move(e); });
    s.addEventListener('pointerup',end); s.addEventListener('pointercancel',end); }
  /* action buttons: arc in the bottom-right corner */
  const B=cfg.buttons||[], big=B.length<=4?78:B.length<=6?70:62;
  const spots=[[0,0],[1,0],[0,1],[1,1],[2,0],[2,1],[0,2],[1,2],[3,0],[3,1]];
  B.forEach(([label,code],k)=>{ const [c,r]=spots[k]||[k%4,Math.floor(k/4)]; mk(label,code,-(16+c*(big+10)),-(18+r*(big+10)),big); });
  /* small system buttons */
  const sys=(cfg.sys||[['Enter','Enter'],['Pause','Escape'],['View','KeyV']]).concat([['Full','KeyZ']]);
  sys.forEach(([l,c],k)=>mk(l,c,10+k*62,64,54,'sm'));
  document.body.appendChild(root);
  const tog=document.createElement('button'); tog.id='rrTog'; document.body.appendChild(tog);
  function apply(){ root.style.display=on?'block':'none'; tog.textContent=on?'Touch mode: on':'Touch mode'; document.body.classList.toggle('rrTouchOn',on); if(!on){ for(const c of [...held.keys()]){ held.set(c,1); up(c); } } }
  tog.addEventListener('click',e=>{ e.stopPropagation(); on=!on; try{ localStorage.setItem(KEY,on?'1':'0'); }catch(er){} apply(); });
  window.addEventListener('blur',()=>{ for(const c of [...held.keys()]){ held.set(c,1); up(c); } });
  apply();
})();
