/* Rink Rivals online play: rooms with a short code, relayed through the rink-rivals-rooms worker.
   A game calls RRO.init({game, maxPlayers, onStart, onMsg, onPeers}) and gets RRO.send / RRO.me / RRO.peers / RRO.isHost(). */
(function(){
  const qs=new URLSearchParams(location.search);
  const SERVER=qs.get('server')||'wss://rink-rivals-rooms.mitchellchad2026.workers.dev';
  const NAMEK='rrOnlineName';
  let ws=null, cfg=null, me=null, peers=[], code=null, panel=null, started=false, closing=false;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getName=()=>{ try{ return localStorage.getItem(NAMEK)||''; }catch(e){ return ''; } };
  const setName=n=>{ try{ localStorage.setItem(NAMEK,n); }catch(e){} };
  const newCode=()=>{ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; };
  const css=`#rroP{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(5,8,18,.7);font-family:'Big Shoulders Display','Arial Narrow',sans-serif}
#rroP .box{background:#141c33;color:#eef2fb;border:2px solid #27345a;border-radius:16px;padding:20px 22px;width:min(420px,92vw);box-shadow:0 12px 40px rgba(0,0,0,.5)}
#rroP h2{margin:0 0 6px;font-size:30px} #rroP p{margin:6px 0;color:#93a0bd;font-size:16px}
#rroP input{font:inherit;font-size:20px;width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:2px solid #27345a;background:#0b1120;color:#fff;margin:6px 0}
#rroP button{font:inherit;font-size:18px;font-weight:800;padding:8px 14px;border-radius:999px;border:2px solid #27345a;background:#1e293b;color:#fff;cursor:pointer;margin:6px 6px 0 0}
#rroP button.gold{background:#fbbf24;color:#111;border-color:#fbbf24} #rroP .code{font-size:40px;letter-spacing:.2em;color:#fde047;font-weight:900}
#rroP ul{list-style:none;padding:0;margin:8px 0} #rroP li{padding:4px 0;font-size:18px} #rroP .err{color:#f87171}
#rroB{position:fixed;right:10px;bottom:10px;z-index:9001;font:800 14px 'Big Shoulders Display','Arial Narrow',sans-serif;padding:7px 12px;border-radius:999px;border:2px solid #fbbf24;background:#141c33;color:#fde047;cursor:pointer}`;
  function ui(){ if(panel) return; const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); panel=document.createElement('div'); panel.id='rroP'; document.body.appendChild(panel); panel.addEventListener('keydown',e=>e.stopPropagation()); panel.addEventListener('keyup',e=>e.stopPropagation()); }
  function hideUI(){ if(panel){ panel.remove(); panel=null; } }
  function showStart(err){ ui(); const nm=getName();
    panel.innerHTML=`<div class="box"><h2>Play online</h2><p>${esc(cfg.blurb||'Play against friends on other devices.')} Up to ${cfg.maxPlayers} players.</p>
    <input id="rroName" maxlength="20" placeholder="Your name" value="${esc(nm)}">
    <div><button class="gold" id="rroNew">Create a room</button></div>
    <p>or join a friend's room:</p><input id="rroCode" maxlength="6" placeholder="Room code" style="text-transform:uppercase"><div><button id="rroJoin">Join</button><button id="rroX">Cancel</button></div>${err?`<p class="err">${esc(err)}</p>`:''}</div>`;
    const name=()=>{ const v=(panel.querySelector('#rroName').value||'').trim()||'Player'; setName(v); return v; };
    panel.querySelector('#rroNew').onclick=()=>connect(newCode(),name());
    panel.querySelector('#rroJoin').onclick=()=>{ const c=(panel.querySelector('#rroCode').value||'').trim().toUpperCase(); if(c.length<4) return showStart('Type the room code your friend sent you.'); connect(c,name()); };
    panel.querySelector('#rroX').onclick=()=>hideUI(); }
  function showLobby(){ ui(); const link=`${location.origin}${location.pathname}?room=${code}`, host=api.isHost();
    panel.innerHTML=`<div class="box"><h2>Room</h2><div class="code">${code}</div><p>Send this code (or the link) to a friend.</p><input readonly value="${esc(link)}" onclick="this.select()">
    <ul>${[me].concat(peers).sort((a,b)=>a.seat-b.seat).map(p=>`<li>${p.seat===0?'👑':'🎮'} ${esc(p.name)}${p.id===me.id?' (you)':''}</li>`).join('')}</ul>
    ${host?`<button class="gold" id="rroGo" ${peers.length<(cfg.minPlayers||1)?'disabled style="opacity:.5"':''}>Start</button>`:'<p>Waiting for the host to start…</p>'}<button id="rroLeave">Leave</button></div>`;
    if(host) panel.querySelector('#rroGo').onclick=()=>{ const msg={t:'start',seed:Math.floor(Math.random()*1e9),opts:cfg.getOpts?cfg.getOpts():null}; send(msg); begin(msg); };
    panel.querySelector('#rroLeave').onclick=()=>{ leave(); hideUI(); }; }
  function begin(msg){ started=true; hideUI(); badge(); cfg.onStart&&cfg.onStart(msg,api); }
  function badge(){ let b=document.getElementById('rroB'); if(!b){ b=document.createElement('button'); b.id='rroB'; document.body.appendChild(b); b.onclick=()=>{ if(confirm('Leave the online game?')) leave(); }; } b.textContent=`Online · ${code} · ${peers.length+1} players`; }
  function connect(c,name){ code=c; closing=false; ui(); panel.innerHTML=`<div class="box"><h2>Connecting…</h2><p>Room ${esc(c)}</p></div>`;
    try{ ws=new WebSocket(`${SERVER}/room/${c}`); }catch(e){ showStart('Could not reach the game server.'); return; }
    ws.onopen=()=>ws.send(JSON.stringify({t:'hello',name,game:cfg.game}));
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(er){ return; }
      if(m.t==='full'){ closing=true; showStart('That room is full.'); return; }
      if(m.t==='welcome'){ me={id:m.id,seat:m.seat,name:m.name}; peers=m.peers.filter(p=>p.game===cfg.game||!p.game); if(m.peers.some(p=>p.game&&p.game!==cfg.game)){ closing=true; ws.close(); showStart('That room is playing a different game.'); return; } showLobby(); cfg.onPeers&&cfg.onPeers(api); return; }
      if(m.t==='join'){ peers.push({id:m.id,seat:m.seat,name:m.name}); if(!started) showLobby(); else { badge(); cfg.onPeers&&cfg.onPeers(api,'join',m); } return; }
      if(m.t==='leave'){ peers=peers.filter(p=>p.id!==m.id); if(!started) showLobby(); else { badge(); cfg.onPeers&&cfg.onPeers(api,'leave',m); } return; }
      if(m.t==='start'&&!started){ begin(m); return; }
      cfg.onMsg&&cfg.onMsg(m,api); };
    ws.onclose=()=>{ if(closing) return; const was=started; started=false; ws=null; const b=document.getElementById('rroB'); if(b) b.remove(); if(was&&cfg.onEnd) cfg.onEnd('Connection lost'); showStart('Disconnected from the room.'); };
    ws.onerror=()=>{}; }
  function send(obj){ if(ws&&ws.readyState===1) ws.send(JSON.stringify(obj)); }
  function leave(){ closing=true; started=false; try{ ws&&ws.close(); }catch(e){} ws=null; peers=[]; me=null; const b=document.getElementById('rroB'); if(b) b.remove(); cfg&&cfg.onEnd&&cfg.onEnd('left'); }
  const api={ send, leave, open:()=>showStart(), get me(){ return me; }, get peers(){ return peers; }, get code(){ return code; }, get on(){ return started; },
    isHost(){ return !!me&&[me].concat(peers).every(p=>p.seat>=me.seat); }, all(){ return me?[me].concat(peers).sort((a,b)=>a.seat-b.seat):[]; } };
  window.RRO={ init(c){ cfg=c; const r=(qs.get('room')||'').toUpperCase(); if(/^[A-Z0-9]{4,8}$/.test(r)) setTimeout(()=>connect(r,getName()||'Player'),300); return api; } };
})();
