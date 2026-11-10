/* Video calls with PeerJS (free signalling; the video goes straight between the two browsers).
   - Call a player: Account → 🟢 Online → tap their name → 📹 Video call. They get a ring and can accept or decline.
   - Or a room code: one player starts a room and reads out the 5-letter code, the other types it in.
   - The test account "testing online" is a bot: calling it shows a pebble (it never sees your camera). */
(function(){ if(window.RRVIDEO) return;
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  if(PAGE==='hq-owa9rwwt9kplpdbu'||window.RR_ADMIN) return;
  const ROOM='arcriv-vc-', USER='arcrivu-', ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let mePeer=null, roomPeer=null, call=null, local=null, remote=null, box=null, ring=null, code='', who='', state='idle', micOn=true, camOn=true, msg='', bot=null, tmo=null;
  const $=(s,r)=>(r||document).querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const acct=()=>{ try{ const a=JSON.parse(localStorage.getItem('rrAcct')||'null'); return a&&a.name&&a.token?a:null; }catch(e){ return null; } };
  const uid=n=>USER+Array.from(new TextEncoder().encode(String(n).trim().toLowerCase())).map(b=>b.toString(16).padStart(2,'0')).join('');
  function loadPeer(){ return new Promise((ok,bad)=>{ if(window.Peer) return ok(); const s=document.createElement('script'); s.src='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload=()=>ok(); s.onerror=()=>bad(new Error('peerjs')); document.head.appendChild(s); }); }
  async function cam(){ if(local) return local; local=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:480},height:{ideal:360},facingMode:'user'},audio:{echoCancellation:true,noiseSuppression:true}}); return local; }
  function css(){ if($('#rrVcCss')) return; const st=document.createElement('style'); st.id='rrVcCss'; st.textContent=`
#rrVc,#rrRing{position:fixed;z-index:2147482950;background:#0f172a;border:1px solid #334155;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.55);color:#e2e8f0;font:600 14px system-ui,sans-serif;overflow:hidden}
#rrVc{right:14px;top:70px;width:min(340px,92vw);touch-action:none}
#rrRing{left:50%;top:18px;transform:translateX(-50%);width:min(340px,92vw);padding:14px;text-align:center;border-color:#22c55e;animation:rrRingP 1s ease-in-out infinite alternate}
@keyframes rrRingP{from{box-shadow:0 0 0 0 rgba(34,197,94,.5)}to{box-shadow:0 0 0 10px rgba(34,197,94,0)}}
#rrVc .hd{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#111c33;cursor:move;user-select:none}#rrVc .hd b{flex:1}
#rrVc .x{background:#334155;color:#fff;border:0;border-radius:8px;padding:4px 9px;cursor:pointer}
#rrVc .bd{padding:12px}#rrVc .row,#rrRing .row{display:flex;gap:8px;margin-top:8px}
#rrVc button.b,#rrRing button.b{flex:1;border:0;border-radius:10px;padding:10px;font:800 14px system-ui;cursor:pointer;background:#1e293b;color:#fff}
#rrVc button.go,#rrRing button.go{background:linear-gradient(90deg,#22c55e,#16a34a);color:#052e16}#rrVc button.red,#rrRing button.red{background:#dc2626}
#rrVc input{flex:1;min-width:0;background:#0b1222;border:1px solid #334155;color:#fff;border-radius:10px;padding:10px;font:800 18px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}
#rrVc .vids{position:relative;background:#000;aspect-ratio:4/3}#rrVc .vids video{display:block;width:100%;height:100%;object-fit:cover;background:#000}
#rrVc .vids video.me{position:absolute;right:8px;bottom:8px;width:32%;height:auto;aspect-ratio:4/3;border:2px solid #fff;border-radius:8px;transform:scaleX(-1)}
#rrVc .code{font:900 30px ui-monospace,monospace;letter-spacing:.25em;color:#fde68a;text-align:center;margin:6px 0}
#rrVc .m{color:#94a3b8;font-size:13px}#rrVc .err{color:#fca5a5;font-size:13px;margin-top:6px}`; document.head.appendChild(st); }
  function open(){ css(); if(!box){ box=document.createElement('div'); box.id='rrVc'; document.body.appendChild(box); drag(box); box.addEventListener('click',onClick); box.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'&&e.target.id==='vcIn') joinRoom(e.target.value); }); } render(); }
  function render(){ if(!box) return; const live=state==='live'; let bd='';
    if(state==='idle') bd=`<div class="m">To call a player: Account → 🟢 Online → tap their name → 📹 Video call. Or use a room code:</div>
      <div class="row"><button class="b go" data-v="start">Start a room</button></div><div class="row"><input id="vcIn" maxlength="5" placeholder="CODE" autocomplete="off"><button class="b" data-v="join">Join</button></div>`;
    else if(state==='wait') bd=`<div class="m">Your room code — tell your friend:</div><div class="code">${code}</div><div class="m">Waiting for them to join…</div><div class="row"><button class="b red" data-v="end">Cancel</button></div>`;
    else if(state==='calling') bd=`<div class="m" style="text-align:center;font-size:16px;margin:8px 0">📞 Calling <b>${esc(who)}</b>…</div><div class="vids"><video class="me" id="vcMe" autoplay playsinline muted style="position:static;width:100%;transform:scaleX(-1)"></video></div><div class="row"><button class="b red" data-v="end">Hang up</button></div>`;
    else if(state==='connecting') bd=`<div class="m">Connecting to room <b>${code}</b>…</div><div class="row"><button class="b red" data-v="end">Cancel</button></div>`;
    else if(live) bd=`<div class="vids"><video id="vcThem" autoplay playsinline></video><video class="me" id="vcMe" autoplay playsinline muted></video></div><div class="row"><button class="b" data-v="mic">${micOn?'🎙️ Mute':'🔇 Unmute'}</button><button class="b" data-v="cam">${camOn?'📷 Camera off':'📷 Camera on'}</button><button class="b red" data-v="end">Hang up</button></div><div class="m" style="margin-top:6px">${who?'With '+esc(who):'Room '+code} · the call ends if you leave this page</div>`;
    box.innerHTML=`<div class="hd"><b>📹 ${live&&who?esc(who):'Video call'}</b><button class="x" data-v="close" title="Close">✕</button></div><div class="bd">${bd}${msg?`<div class="err">${esc(msg)}</div>`:''}</div>`;
    const me=$('#vcMe',box); if(me&&local) me.srcObject=local; const th=$('#vcThem',box); if(th&&remote){ th.srcObject=remote; th.play&&th.play().catch(()=>{}); } }
  function fail(t){ msg=t; open(); }
  function onClick(e){ const b=e.target.closest('[data-v]'); if(!b) return; const v=b.dataset.v; msg='';
    if(v==='close'){ if(state!=='idle') end(); box.remove(); box=null; return; } if(v==='start') startRoom(); if(v==='join') joinRoom($('#vcIn',box).value); if(v==='end') end();
    if(v==='mic'&&local){ micOn=!micOn; local.getAudioTracks().forEach(t=>t.enabled=micOn); render(); } if(v==='cam'&&local){ camOn=!camOn; local.getVideoTracks().forEach(t=>t.enabled=camOn); render(); } }
  const why=e=>{ const n=e&&(e.name||e.type||''); return n==='NotAllowedError'||n==='SecurityError'?'Camera blocked — allow camera and microphone for this site, then try again.':n==='NotFoundError'?'No camera found on this device.':n==='peer-unavailable'?(who?`${who} isn't online right now.`:'No room with that code — check it with your friend.'):n==='unavailable-id'?'That code is busy — try again.':n==='network'||n==='server-error'||n==='socket-error'?'Could not reach the call server — check your internet.':e&&e.message==='peerjs'?'Could not load the video-call library.':'Something went wrong — try again.'; };
  /* your own line: while you're signed in, people can ring you */
  async function listen(){ const a=acct(); if(!a||mePeer) return; try{ await loadPeer(); }catch(e){ return; }
    mePeer=new Peer(uid(a.name)); mePeer.on('error',e=>{ if(e.type==='unavailable-id'||e.type==='invalid-id'){ try{ mePeer.destroy(); }catch(x){} mePeer=null; } else if(call&&state!=='live'){ const m=why(e); end(); fail(m); } });
    mePeer.on('call',c=>{ if(call||state!=='idle'){ try{ c.close(); }catch(e){} return; } incoming(c); });
    mePeer.on('connection',cn=>{ cn.on('data',d=>{ if(d&&d.t==='ginvite') groupInvite(String(d.from||'Someone').slice(0,20)); setTimeout(()=>{ try{ cn.close(); }catch(e){} },500); }); });
    mePeer.on('disconnected',()=>{ try{ mePeer.reconnect(); }catch(e){} }); }
  /* invites to the group video chat arrive straight through the call connection */
  function groupInvite(from){ css(); const el=document.createElement('div'); el.id='rrRing'; el.style.top='90px';
    el.innerHTML=`<div style="font-size:30px">👥</div><b style="font-size:17px">${esc(from)}</b> invited you to the group video call<div class="row"><button class="b go" data-g="yes">Join</button><button class="b" data-g="no">No thanks</button></div>`;
    document.body.appendChild(el); const t=setTimeout(()=>el.remove(),45000); try{ (window.RRCOIN&&RRCOIN.toast)&&RRCOIN.toast(`👥 ${from} invited you to the group video call`,'#4ade80'); }catch(e){}
    el.addEventListener('click',e=>{ const b=e.target.closest('[data-g]'); if(!b) return; clearTimeout(t); el.remove(); if(b.dataset.g==='yes'){ if(PAGE==='call'&&window.RRGROUP) RRGROUP.join(); else location.href='call#join'; } }); }
  async function invite(name){ const a=acct(); if(!a) return 'Sign in first.'; try{ await loadPeer(); }catch(e){ return 'Could not load the video-call library.'; } const p=await anyPeer();
    return new Promise(res=>{ let done=false; const fin=v=>{ if(!done){ done=true; res(v); } }; const c=p.connect(uid(name),{reliable:true});
      if(!c) return fin(`Couldn't reach ${name}.`); c.on('open',()=>{ c.send({t:'ginvite',from:a.name}); setTimeout(()=>{ try{ c.close(); }catch(e){} },1500); fin(''); });
      c.on('error',()=>fin(`Couldn't reach ${name}.`)); setTimeout(()=>fin(`${name} isn't reachable right now (they may have just left).`),7000); }); }
  async function anyPeer(){ if(mePeer&&mePeer.open) return mePeer; if(mePeer&&!mePeer.destroyed) return new Promise(r=>{ mePeer.once('open',()=>r(mePeer)); setTimeout(()=>r(mePeer),4000); });
    await loadPeer(); mePeer=new Peer(); mePeer.on('error',e=>{ if(call&&state!=='live'){ const m=why(e); end(); fail(m); } }); mePeer.on('call',c=>{ if(call||state!=='idle'){ c.close(); return; } incoming(c); }); return new Promise(r=>mePeer.once('open',()=>r(mePeer))); }
  function incoming(c){ css(); const from=String((c.metadata&&c.metadata.from)||'Someone').slice(0,20); if(ring) ring.remove(); ring=document.createElement('div'); ring.id='rrRing';
    ring.innerHTML=`<div style="font-size:30px">📹</div><b style="font-size:17px">${esc(from)}</b> wants to video call you<div class="row"><button class="b go" data-r="yes">Accept</button><button class="b red" data-r="no">Decline</button></div>`;
    document.body.appendChild(ring); let done=false; const close=()=>{ if(ring){ ring.remove(); ring=null; } };
    const t=setTimeout(()=>{ if(!done){ done=true; close(); try{ c.close(); }catch(e){} } },30000); c.on('close',()=>{ if(!done){ done=true; clearTimeout(t); close(); } });
    try{ (window.RRCOIN&&RRCOIN.toast)&&RRCOIN.toast(`📹 ${from} is calling you`,'#4ade80'); }catch(e){}
    ring.addEventListener('click',async e=>{ const b=e.target.closest('[data-r]'); if(!b||done) return; done=true; clearTimeout(t); close();
      if(b.dataset.r==='no'){ try{ c.close(); }catch(x){} return; }
      try{ await cam(); }catch(x){ try{ c.close(); }catch(y){} return fail(why(x)); } call=c; who=from; c.answer(local); wire(c); state='live'; open(); }); }
  async function callUser(name,opts){ if(state!=='idle'){ open(); return; } const a=acct(); if(!a){ fail('Sign in to your account to video call people.'); return; }
    if(String(name).toLowerCase()===a.name.toLowerCase()) return; who=String(name).slice(0,20); msg='';
    if(opts&&opts.bot) return pebbleCall(who);
    try{ await loadPeer(); await cam(); }catch(e){ const m=why(e); end(); return fail(m); }
    state='calling'; open(); const p=await anyPeer(); if(state!=='calling') return;
    const c=p.call(uid(name),local,{metadata:{from:a.name}}); if(!c){ end(); return fail('Could not start the call.'); } call=c; wire(c);
    tmo=setTimeout(()=>{ if(state==='calling'){ end(); fail(`${who} didn't answer.`); } },32000); }
  async function startRoom(tries){ try{ await loadPeer(); await cam(); }catch(e){ return fail(why(e)); }
    code=''; for(let i=0;i<5;i++) code+=ABC[Math.floor(Math.random()*ABC.length)]; state='wait'; who=''; render(); roomPeer=new Peer(ROOM+code);
    roomPeer.on('error',e=>{ if(e.type==='unavailable-id'&&(tries||0)<3){ roomPeer.destroy(); roomPeer=null; startRoom((tries||0)+1); return; } if(state!=='live'){ const m=why(e); end(); fail(m); } });
    roomPeer.on('call',c=>{ if(call){ c.close(); return; } call=c; c.answer(local); wire(c); }); }
  async function joinRoom(raw){ const c2=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5); if(c2.length!==5) return fail('Type the 5-letter code your friend sees.');
    try{ await loadPeer(); await cam(); }catch(e){ return fail(why(e)); } code=c2; who=''; state='connecting'; render(); const p=await anyPeer(); if(state!=='connecting') return;
    const c=p.call(ROOM+code,local,{metadata:{from:(acct()||{}).name||'Player'}}); if(!c){ end(); return fail('Could not start the call.'); } call=c; wire(c);
    tmo=setTimeout(()=>{ if(state==='connecting'){ end(); fail('No answer — check the code with your friend.'); } },20000); }
  function wire(c){ c.on('stream',s=>{ remote=s; state='live'; clearTimeout(tmo); render(); }); c.on('close',()=>{ if(state!=='idle'){ end(); fail('The call ended.'); } }); c.on('error',()=>{ if(state!=='idle'){ end(); fail('The call dropped.'); } }); }
  /* the test bot: a pebble on the sand, sent as a video stream */
  async function pebbleCall(name){ const cv=document.createElement('canvas'); cv.width=480; cv.height=360; const x=cv.getContext('2d'); const t0=performance.now();
    const spots=Array.from({length:40},(_,i)=>({a:Math.random()*6.28,r:Math.random(),s:1+Math.random()*2.5,c:Math.random()<.5?'rgba(40,40,45,.35)':'rgba(255,255,255,.25)'}));
    const draw=()=>{ if(!bot) return; const t=(performance.now()-t0)/1000; const g=x.createLinearGradient(0,0,0,360); g.addColorStop(0,'#e9d7a8'); g.addColorStop(1,'#c9ad73'); x.fillStyle=g; x.fillRect(0,0,480,360);
      for(let i=0;i<220;i++){ x.fillStyle=`rgba(${120+(i*37)%60},${100+(i*53)%50},${60+(i*29)%40},.35)`; x.fillRect((i*97)%480,(i*61)%360,2,2); }
      const cx=240+Math.sin(t*.7)*4, cy=200+Math.sin(t*1.3)*2, rx=120, ry=78;
      x.fillStyle='rgba(60,45,20,.35)'; x.beginPath(); x.ellipse(cx+14,cy+ry*.72,rx*.95,ry*.32,0,0,7); x.fill();
      const pg=x.createRadialGradient(cx-40,cy-35,10,cx,cy,rx*1.1); pg.addColorStop(0,'#c4c7cc'); pg.addColorStop(.55,'#8a8f98'); pg.addColorStop(1,'#4b5059'); x.fillStyle=pg; x.beginPath(); x.ellipse(cx,cy,rx,ry,-.08,0,7); x.fill();
      for(const s of spots){ x.fillStyle=s.c; x.beginPath(); x.arc(cx+Math.cos(s.a)*s.r*rx*.85,cy+Math.sin(s.a)*s.r*ry*.8,s.s,0,7); x.fill(); }
      x.fillStyle='rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(cx-42,cy-36,30,12,-.4,0,7); x.fill();
      /* two little eyes that blink, so it's clearly a friendly pebble */ const bl=(t%4)<.15?.15:1; x.fillStyle='#111'; for(const ex of [-24,24]){ x.beginPath(); x.ellipse(cx+ex,cy-6,6,9*bl,0,0,7); x.fill(); } x.strokeStyle='#111'; x.lineWidth=3; x.beginPath(); x.arc(cx,cy+12,14,.2,Math.PI-.2); x.stroke();
      x.fillStyle='rgba(15,23,42,.75)'; x.fillRect(0,320,480,40); x.fillStyle='#fff'; x.font='700 18px system-ui'; x.textAlign='left'; x.fillText(`🪨 ${name} — test bot`,12,346); x.textAlign='right'; x.fillText('LIVE ●',468,346);
      requestAnimationFrame(draw); };
    bot={cv}; state='calling'; open(); try{ await cam(); }catch(e){ local=null; } if(!bot) return;
    tmo=setTimeout(()=>{ if(!bot) return; remote=cv.captureStream(24); state='live'; draw(); render(); },1600); }
  function end(){ clearTimeout(tmo); try{ call&&call.close(); }catch(e){} try{ roomPeer&&roomPeer.destroy(); }catch(e){} call=null; roomPeer=null; bot=null; remote=null;
    if(local){ local.getTracks().forEach(t=>t.stop()); local=null; } state='idle'; code=''; micOn=camOn=true; render(); }
  function drag(el){ let sx=0, sy=0, ox=0, oy=0, on=false; el.addEventListener('pointerdown',e=>{ if(!e.target.closest('.hd')||e.target.closest('button')) return; on=true; const r=el.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove',e=>{ if(!on) return; el.style.left=Math.max(0,Math.min(innerWidth-60,ox+e.clientX-sx))+'px'; el.style.top=Math.max(0,Math.min(innerHeight-40,oy+e.clientY-sy))+'px'; el.style.right='auto'; });
    el.addEventListener('pointerup',()=>{ on=false; }); }
  addEventListener('pagehide',()=>{ if(state!=='idle') end(); try{ mePeer&&mePeer.destroy(); }catch(e){} });
  /* start listening a few seconds after the page loads, so games load first */
  setTimeout(()=>{ if(!document.hidden) listen(); else addEventListener('visibilitychange',function v(){ if(!document.hidden){ removeEventListener('visibilitychange',v); listen(); } }); },5000);
  window.RRVIDEO={ open, callUser, end, listen, invite, get state(){ return state; } };
})();
