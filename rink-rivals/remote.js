/* Rink Rivals "play a friend online" for the two-player games.
   The host runs the game in its 2-player mode. The friend's key presses are relayed to the host and replayed there
   as Player 2's keys, and the host's game screen is streamed back to the friend as live video (WebRTC, peer to peer;
   the rink-rivals-rooms relay only carries the connection setup, keys and the scoreboard text).
   A game calls RRS.attach({game, map, start, blurb}) where map turns the friend's keys into Player 2 key codes. */
(function(){
  const ICE=[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}];
  let cfg=null, api=null, role=null, pc=null, comp=null, cctx=null, stream=null, video=null, hdrT=0, last={}, peerId=null, pendingIce=[];
  const $=id=>document.getElementById(id);
  /* host: after every frame the game draws, copy its 3D and 2D canvases into one canvas that is streamed */
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>raf(t=>{ cb(t); if(role==='host'&&comp) compose(); });
  const vis=el=>{ if(!el) return false; const s=getComputedStyle(el); return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0; };
  function compose(){ const W=comp.width, H=comp.height; cctx.fillStyle='#0b1120'; cctx.fillRect(0,0,W,H);
    try{ for(const id of ['gl','glhud','cv']){ const el=$(id); if(vis(el)) cctx.drawImage(el,0,0,W,H); } }catch(e){}
    const now=performance.now(); if(now-hdrT>300){ hdrT=now; sendHeader(); } }
  /* the scoreboard, banners, toasts and result screens live in the page around the canvases: mirror them as text */
  const HDR=['nameL','nameR','scoreL','scoreR','tpL','tpR','cntT','innT','outsT','basesT','clockT','clockP'], BOX=['banner','toast','result','fightHud','rpTag'];
  function sendHeader(){ const h={}; let n=0; const put=(k,v)=>{ if(last[k]!==v){ last[k]=v; h[k]=v; n++; } };
    for(const id of HDR){ const e=$(id); if(e) put(id,e.textContent); }
    for(const id of ['logoL','logoR']){ const e=$(id); if(e) put(id+'@src',e.getAttribute('src')||''); }
    for(const id of ['sideL','sideR']){ const e=$(id); if(e) put(id+'@tc',e.style.getPropertyValue('--tc')); }
    for(const id of BOX){ const e=$(id); if(e) put(id+'@box',JSON.stringify([e.innerHTML,e.className,e.style.cssText])); }
    if(n&&api) api.send({t:'hdr',h}); }
  function applyHeader(h){ for(const k in h){ const v=h[k], [id,attr]=k.split('@'), e=$(id); if(!e) continue;
    if(!attr) e.textContent=v; else if(attr==='src') e.setAttribute('src',v); else if(attr==='tc'||attr==='glow') e.style.setProperty('--'+attr,v);
    else if(attr==='box'){ const [h,c,css]=JSON.parse(v); e.innerHTML=h; e.className=c; e.style.cssText=css; e.style.zIndex='7'; } } }
  /* WebRTC */
  function newPC(){ const p=new RTCPeerConnection({iceServers:ICE}); p.onicecandidate=e=>{ if(e.candidate) api.send({t:'ice',to:peerId,c:e.candidate.toJSON?e.candidate.toJSON():e.candidate}); };
    p.onconnectionstatechange=()=>{ if(p.connectionState==='failed') note('Could not connect the video directly. Your networks may block it; try another Wi-Fi or a phone hotspot.'); }; return p; }
  async function hostOffer(to){ peerId=to; if(pc) try{ pc.close(); }catch(e){} pc=newPC(); if(!comp){ comp=document.createElement('canvas'); comp.width=1120; comp.height=620; cctx=comp.getContext('2d'); stream=comp.captureStream(30); }
    for(const tr of stream.getTracks()){ try{ tr.contentHint='detail'; }catch(e){} pc.addTrack(tr,stream); }
    try{ const sd=pc.getSenders()[0]; const pr=sd.getParameters(); pr.encodings=pr.encodings&&pr.encodings.length?pr.encodings:[{}]; pr.encodings[0].maxBitrate=3000000; pr.degradationPreference='maintain-resolution'; await sd.setParameters(pr); }catch(e){}
    const off=await pc.createOffer(); await pc.setLocalDescription(off); api.send({t:'sdp',to,d:pc.localDescription}); last={}; }
  async function onSdp(m){ if(role==='guest'){ peerId=m.from; if(pc) try{ pc.close(); }catch(e){} pc=newPC(); pc.ontrack=e=>{ video.srcObject=e.streams[0]; video.play().catch(()=>{}); note(''); };
      await pc.setRemoteDescription(m.d); for(const c of pendingIce.splice(0)) try{ await pc.addIceCandidate(c); }catch(e){} const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); api.send({t:'sdp',to:m.from,d:pc.localDescription}); }
    else if(pc){ await pc.setRemoteDescription(m.d); for(const c of pendingIce.splice(0)) try{ await pc.addIceCandidate(c); }catch(e){} } }
  async function onIce(m){ if(!pc||!pc.remoteDescription){ pendingIce.push(m.c); return; } try{ await pc.addIceCandidate(m.c); }catch(e){} }
  /* guest: the screen is the host's video; keys go to the host */
  let noteEl=null; function note(t){ if(!noteEl) return; noteEl.textContent=t; noteEl.style.display=t?'block':'none'; }
  function guestUI(on){ const st=$('stage'); if(on){ if(!video){ video=document.createElement('video'); video.autoplay=true; video.muted=true; video.playsInline=true; video.setAttribute('playsinline','');
        Object.assign(video.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'contain',background:'#0b1120',zIndex:'5'}); st.appendChild(video);
        noteEl=document.createElement('div'); Object.assign(noteEl.style,{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:'6',color:'#fde047',font:"800 22px 'Big Shoulders Display','Arial Narrow',sans-serif",textAlign:'center',maxWidth:'80%'}); st.appendChild(noteEl); }
      video.style.display='block'; note('Connecting to the host’s game…'); const m=$('menu'); if(m) m.classList.add('hidden');
      for(const id of BOX){ const e=$(id); if(e) e.style.zIndex='7'; } }
    else { if(video){ video.style.display='none'; video.srcObject=null; } note(''); } }
  const PASS=new Set(['KeyZ','KeyV']);
  function keyFwd(e){ if(role!=='guest') return; if(PASS.has(e.code)&&e.type==='keydown') return; e.preventDefault(); e.stopImmediatePropagation(); if(e.repeat) return; api.send({t:'k',d:e.type==='keydown'?1:0,c:e.code}); }
  window.addEventListener('keydown',keyFwd,true); window.addEventListener('keyup',keyFwd,true);
  window.addEventListener('blur',()=>{ if(role==='guest'&&api) api.send({t:'kc'}); });
  /* host: replay the friend's keys as Player 2 */
  const down=new Set();
  function inject(code,d){ const c=cfg.map[code]; if(!c) return; if(d){ if(down.has(c)) return; down.add(c); } else down.delete(c);
    window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c,bubbles:true})); }
  function end(){ const was=role; role=null; if(pc) try{ pc.close(); }catch(e){} pc=null; for(const c of [...down]) inject(Object.keys(cfg.map).find(k=>cfg.map[k]===c),0); down.clear(); if(was==='guest'){ guestUI(false); cfg.onGuestEnd&&cfg.onGuestEnd(); } }
  window.RRS={ attach(c){ cfg=c; if(!window.RRO) return null;
    api=RRO.init({game:c.game,maxPlayers:2,minPlayers:1,blurb:c.blurb||'Play a friend on another device. The host runs the game and the friend sees it live.',getOpts:()=>({}),
      onStart(msg,net){ if(net.isHost()){ role='host'; c.start(); } else { role='guest'; guestUI(true); api.send({t:'ready'}); } },
      onMsg(m){ if(m.t==='ready'&&role==='host'){ hostOffer(m.from); return; }
        if(m.to&&api.me&&m.to!==api.me.id) return;
        if(m.t==='sdp') onSdp(m); else if(m.t==='ice') onIce(m);
        else if(m.t==='k'&&role==='host') inject(m.c,m.d); else if(m.t==='kc'&&role==='host'){ for(const k of Object.keys(cfg.map)) inject(k,0); }
        else if(m.t==='hdr'&&role==='guest') applyHeader(m.h); },
      onPeers(net,kind,m){ if(kind==='leave'){ if(role==='host'){ for(const k of Object.keys(cfg.map)) inject(k,0); c.onFriendLeft&&c.onFriendLeft(); if(pc) try{ pc.close(); }catch(e){} pc=null; } else if(role==='guest'){ end(); } } },
      onEnd(){ end(); } });
    return api; },
    /* map the friend's natural keys (single-player layout) onto the game's Player 2 keys; actions Player 2 has no key for get a private code */
    mapFrom(solo,p1,p2){ const map={}; for(const a in p1){ let t=(p2[a]||[]).find(Boolean); if(!t){ t='P2:'+((p1[a]||[]).find(Boolean)||a); p2[a]=(p2[a]||[]).filter(Boolean).concat([t]); }
        for(const k of (solo&&solo[a]||[]).concat(p1[a]||[])) if(k&&!map[k]) map[k]=t; } return map; },
    get role(){ return role; } };
})();
