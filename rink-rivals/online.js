/* Rink Rivals online play: rooms with a short code, relayed through the rink-rivals-rooms worker.
   A game calls RRO.init({game, maxPlayers, onStart, onMsg, onPeers}) and gets RRO.send / RRO.me / RRO.peers / RRO.isHost(). */
(function(){
  const qs=new URLSearchParams(location.search);
  const SERVER=qs.get('server')||'wss://rink-rivals-rooms.mitchellchad2026.workers.dev';
  const NAMEK='rrOnlineName';
  let ws=null, cfg=null, me=null, peers=[], code=null, panel=null, started=false, closing=false;
  let lob=null, lobGame='home', counts=null, seeking=false, seekT=0, quickN=0, quick=false, inviteEl=null, invDismiss=0, watchers=[], lobTry=0;
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
#rroP .qm{width:100%;font-size:22px;padding:12px} #rroP .live{color:#4ade80} #rroP hr{border:0;border-top:1px solid #27345a;margin:12px 0}
#rroI{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:9400;background:#141c33;color:#eef2fb;border:2px solid #4ade80;border-radius:14px;padding:8px 12px;font:800 16px 'Big Shoulders Display','Arial Narrow',sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.5)}
#rroI button{font:inherit;padding:5px 12px;border-radius:999px;border:2px solid #4ade80;background:#4ade80;color:#052e16;cursor:pointer} #rroI button.x{background:transparent;color:#93a0bd;border-color:#27345a}
#rroT{font:inherit} #rroT .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;margin-right:5px;vertical-align:middle}
#rroB{position:fixed;right:10px;bottom:10px;z-index:9001;font:800 14px 'Big Shoulders Display','Arial Narrow',sans-serif;padding:7px 12px;border-radius:999px;border:2px solid #fbbf24;background:#141c33;color:#fde047;cursor:pointer}`;
  function ui(){ if(panel) return; const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); panel=document.createElement('div'); panel.id='rroP'; document.body.appendChild(panel); panel.addEventListener('keydown',e=>e.stopPropagation()); panel.addEventListener('keyup',e=>e.stopPropagation()); }
  function hideUI(){ if(panel){ panel.remove(); panel=null; } }
  const here=()=>counts&&counts.games?(counts.games[cfg.game]||0):0;
  const seekOthers=()=>{ const l=counts&&counts.seeking&&counts.seeking[cfg.game]||[]; return Math.max(0,l.length-(seeking?1:0)); };
  function showStart(err){ ui(); if(seeking) return showSeek(); const nm=getName(), n=Math.max(0,here()-1), so=seekOthers();
    panel.innerHTML=`<div class="box"><h2>Play online</h2><p>${esc(cfg.blurb||'Play against people on other devices.')} Up to ${cfg.maxPlayers} players.</p>
    <input id="rroName" maxlength="20" placeholder="Your name" value="${esc(nm)}">
    <button class="gold qm" id="rroQ">Play anyone online</button>
    <p class="live" id="rroLive">${lob&&lob.readyState===1?(so?`${so} ${so>1?'people are':'person is'} looking for a match right now!`:n?`${n} other ${n>1?'people are':'person is'} on this game now.`:'Nobody else is on this game right now. Search and you will be matched as soon as someone joins.'):'Connecting to the lobby…'}</p>
    <hr><p>Or play a friend with a room code:</p><div><button id="rroNew">Create a room</button></div>
    <input id="rroCode" maxlength="6" placeholder="Room code" style="text-transform:uppercase"><div><button id="rroJoin">Join</button><button id="rroX">Cancel</button></div>${err?`<p class="err">${esc(err)}</p>`:''}</div>`;
    const name=()=>{ const v=(panel.querySelector('#rroName').value||'').trim()||'Player'; setName(v); return v; };
    panel.querySelector('#rroQ').onclick=()=>seek(name());
    panel.querySelector('#rroNew').onclick=()=>connect(newCode(),name());
    panel.querySelector('#rroJoin').onclick=()=>{ const c=(panel.querySelector('#rroCode').value||'').trim().toUpperCase(); if(c.length<4) return showStart('Type the room code your friend sent you.'); connect(c,name()); };
    panel.querySelector('#rroX').onclick=()=>hideUI(); }
  function showSeek(){ ui(); const so=seekOthers(), n=Math.max(0,here()-1), w=Math.round((performance.now()-seekT)/1000);
    panel.innerHTML=`<div class="box"><h2>Finding a match…</h2><p class="live">${so?'Someone is searching too, matching you now…':n?`${n} other ${n>1?'people are':'person is'} on this game. We will match you the moment one of them searches.`:'Waiting for someone to join this game.'}</p>
    <p>${w>20?'Tip: send a friend the link to this game, anyone who opens it sees you are looking and can join with one tap.':'Keep this tab open.'}</p><button id="rroSx">Cancel</button></div>`;
    panel.querySelector('#rroSx').onclick=()=>{ unseek(); showStart(); }; }
  function seek(name){ if(!lob||lob.readyState!==1){ lobby(cfg.game); showStart('Still connecting to the lobby, try again in a second.'); return; } seeking=true; seekT=performance.now(); hideInvite();
    lob.send(JSON.stringify({t:'seek',name,want:cfg.maxPlayers||2})); showSeek(); }
  function unseek(){ if(seeking&&lob&&lob.readyState===1) lob.send(JSON.stringify({t:'unseek'})); seeking=false; }
  /* someone else on this game page is searching: offer to play them */
  function hideInvite(){ if(inviteEl){ inviteEl.remove(); inviteEl=null; } }
  function invite(){ const l=(counts&&counts.seeking&&counts.seeking[cfg.game])||[]; if(!cfg||seeking||started||ws||!l.length||performance.now()<invDismiss){ hideInvite(); return; }
    if(!inviteEl){ inviteEl=document.createElement('div'); inviteEl.id='rroI'; document.body.appendChild(inviteEl); }
    inviteEl.innerHTML=`<span>🎮 ${esc(l[0])}${l.length>1?` and ${l.length-1} more`:''} ${l.length>1?'want':'wants'} to play online</span><button id="rroIp">Play</button><button class="x" id="rroIx">✕</button>`;
    inviteEl.querySelector('#rroIp').onclick=()=>{ hideInvite(); seek(getName()||'Player'); };
    inviteEl.querySelector('#rroIx').onclick=()=>{ invDismiss=performance.now()+60000; hideInvite(); }; }
  /* the site lobby: presence on every game page, and matchmaking */
  function lobby(game){ lobGame=game||lobGame; if(lob&&lob.readyState<2) return; try{ lob=new WebSocket(`${SERVER}/lobby`); }catch(e){ return; }
    lob.onopen=()=>{ lobTry=0; lob.send(JSON.stringify({t:'here',game:lobGame,name:getName()||'Player'})); if(seeking) lob.send(JSON.stringify({t:'seek',name:getName()||'Player',want:cfg&&cfg.maxPlayers||2})); };
    lob.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(er){ return; }
      if(m.t==='counts'){ counts=m; topBtn(); for(const f of watchers) try{ f(m); }catch(er){} if(cfg&&panel&&!ws&&!started){ if(seeking) showSeek(); else { const l=panel.querySelector('#rroLive'); if(l){ const nm=panel.querySelector('#rroName'), v=nm&&nm.value; showStart(); const n2=panel.querySelector('#rroName'); if(n2&&v!=null) n2.value=v; } } } if(cfg) invite(); return; }
      if(m.t==='match'&&cfg){ seeking=false; quick=true; quickN=m.n; connect(m.code,getName()||'Player'); return; } };
    lob.onclose=()=>{ lob=null; lobTry++; setTimeout(()=>lobby(),Math.min(30000,2000*lobTry)); }; lob.onerror=()=>{}; }
  setInterval(()=>{ if(lob&&lob.readyState===1) lob.send('{"t":"ping"}'); },45000);
  /* an Online row in every game's menu: play anyone on the site, or friends with a room code */
  function menuBar(){ if(!cfg) return; const m=document.getElementById('menuIn'); if(!m) return; let d=m.querySelector('.rroBar');
    if(!d){ d=document.createElement('div'); d.className='pills rroBar'; d.style.cssText='background:rgba(34,197,94,.12);border:2px solid #22c55e;border-radius:14px;padding:6px 8px;margin:8px auto';
      d.innerHTML=`<span class="lbl">🌐 Online</span><button class="gold" data-rro="any" tabindex="-1" style="background:#22c55e;border-color:#22c55e;color:#052e16">Play with anyone</button><button data-rro="friend" tabindex="-1">👥 Play with friends (room code)</button><button data-rro="lb" tabindex="-1" style="background:#fbbf24;border-color:#fbbf24;color:#111">🏆 Records</button><span class="lbl rroCnt" style="text-transform:none"></span>`;
      const first=m.querySelector('.pills'); m.insertBefore(d,first||null);
      d.addEventListener('mousedown',e=>{ e.preventDefault(); e.stopPropagation(); });
      d.addEventListener('click',e=>{ const b=e.target.closest('button'); e.stopPropagation(); if(!b) return; if(b.dataset.rro==='lb'){ window.RRL&&RRL.show(); return; } if(started||ws) return;
        if(b.dataset.rro==='lb'){ window.RRL&&RRL.show(); return; }
        if(b.dataset.rro==='any'){ if(getName()) seek(getName()); else showStart(); }
        else { showStart(); const c=panel&&panel.querySelector('#rroCode'); if(c) c.focus(); } }); }
    const c=d.querySelector('.rroCnt'), n=Math.max(0,here()-1), so=seekOthers(), t=so?`${so} looking for a match now!`:n?`${n} other${n>1?'s':''} on this game now`:'';
    if(c&&c.textContent!==t) c.textContent=t; }
  function watchMenu(){ const m=document.getElementById('menuIn'); if(!m||watchMenu.on) return; watchMenu.on=true; new MutationObserver(()=>{ if(!m.querySelector('.rroBar')) menuBar(); }).observe(m,{childList:true}); menuBar(); }
  /* a button in the game's top bar that shows how many people are on this game */
  function topBtn(){ if(!cfg) return; let b=document.getElementById('rroT'); if(!b){ const fs=document.getElementById('btnFs'); if(!fs||!fs.parentNode) return; b=document.createElement('button'); b.id='rroT'; b.className=fs.className; fs.parentNode.insertBefore(b,fs); b.onclick=()=>{ if(started||ws) return; showStart(); }; }
    const n=here(); const t=`<span class="dot"></span>Online${n>1?` · ${n-1} other${n>2?'s':''} here`:''}`; if(b.innerHTML!==t) b.innerHTML=t; menuBar(); }
  function showLobby(){ ui(); const link=`${location.origin}${location.pathname}?room=${code}`, host=api.isHost();
    if(quick){ const all=[me].concat(peers); panel.innerHTML=`<div class="box"><h2>Match found!</h2><ul>${all.sort((a,b)=>a.seat-b.seat).map(p=>`<li>${p.seat===0?'👑':'🎮'} ${esc(p.name)}${p.id===me.id?' (you)':''}</li>`).join('')}</ul><p>${all.length<quickN?'Connecting to your opponent…':'Starting…'}</p><button id="rroLeave">Leave</button></div>`;
      panel.querySelector('#rroLeave').onclick=()=>{ leave(); hideUI(); };
      if(host&&all.length>=quickN&&!started){ clearTimeout(showLobby.t); showLobby.t=setTimeout(()=>{ if(!started&&ws&&api.isHost()){ const msg={t:'start',seed:Math.floor(Math.random()*1e9),opts:cfg.getOpts?cfg.getOpts():null}; send(msg); begin(msg); } },900); }
      return; }
    panel.innerHTML=`<div class="box"><h2>Room</h2><div class="code">${code}</div><p>Send this code (or the link) to a friend.</p><input readonly value="${esc(link)}" onclick="this.select()">
    <ul>${[me].concat(peers).sort((a,b)=>a.seat-b.seat).map(p=>`<li>${p.seat===0?'👑':'🎮'} ${esc(p.name)}${p.id===me.id?' (you)':''}</li>`).join('')}</ul>
    ${host?`<button class="gold" id="rroGo" ${peers.length<(cfg.minPlayers||1)?'disabled style="opacity:.5"':''}>Start</button>`:'<p>Waiting for the host to start…</p>'}<button id="rroLeave">Leave</button></div>`;
    if(host) panel.querySelector('#rroGo').onclick=()=>{ const msg={t:'start',seed:Math.floor(Math.random()*1e9),opts:cfg.getOpts?cfg.getOpts():null}; send(msg); begin(msg); };
    panel.querySelector('#rroLeave').onclick=()=>{ leave(); hideUI(); }; }
  function begin(msg){ started=true; hideUI(); badge(); cfg.onStart&&cfg.onStart(msg,api); }
  function badge(){ let b=document.getElementById('rroB'); if(!b){ b=document.createElement('button'); b.id='rroB'; document.body.appendChild(b); b.onclick=()=>{ if(confirm('Leave the online game?')) leave(); }; } b.textContent=`Online · ${code} · ${peers.length+1} players`; }
  function connect(c,name){ code=c; closing=false; if(!/^Q/.test(c)) quick=false; hideInvite(); ui(); panel.innerHTML=`<div class="box"><h2>Connecting…</h2><p>Room ${esc(c)}</p></div>`;
    try{ ws=new WebSocket(`${SERVER}/room/${c}`); }catch(e){ showStart('Could not reach the game server.'); return; }
    ws.onopen=()=>ws.send(JSON.stringify({t:'hello',name,game:cfg.game}));
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(er){ return; }
      if(m.t==='full'){ closing=true; showStart('That room is full.'); return; }
      if(m.t==='welcome'){ me={id:m.id,seat:m.seat,name:m.name}; peers=m.peers.filter(p=>p.game===cfg.game||!p.game); if(m.peers.some(p=>p.game&&p.game!==cfg.game)){ closing=true; ws.close(); showStart('That room is playing a different game.'); return; } showLobby(); cfg.onPeers&&cfg.onPeers(api); return; }
      if(m.t==='join'){ peers.push({id:m.id,seat:m.seat,name:m.name}); if(!started) showLobby(); else { badge(); cfg.onPeers&&cfg.onPeers(api,'join',m); } return; }
      if(m.t==='leave'){ peers=peers.filter(p=>p.id!==m.id); if(!started) showLobby(); else { badge(); cfg.onPeers&&cfg.onPeers(api,'leave',m); } return; }
      if(m.t==='start'&&!started){ begin(m); return; }
      cfg.onMsg&&cfg.onMsg(m,api); };
    ws.onclose=()=>{ if(closing) return; const was=started; started=false; ws=null; const b=document.getElementById('rroB'); if(b) b.remove(); if(was&&cfg.onEnd) cfg.onEnd('Connection lost'); quick=false; showStart('Disconnected from the room.'); };
    ws.onerror=()=>{}; }
  function send(obj){ if(ws&&ws.readyState===1) ws.send(JSON.stringify(obj)); }
  function leave(){ closing=true; started=false; quick=false; try{ ws&&ws.close(); }catch(e){} ws=null; peers=[]; me=null; const b=document.getElementById('rroB'); if(b) b.remove(); cfg&&cfg.onEnd&&cfg.onEnd('left'); }
  const api={ send, leave, open:()=>showStart(), get me(){ return me; }, get peers(){ return peers; }, get code(){ return code; }, get on(){ return started; },
    isHost(){ return !!me&&[me].concat(peers).every(p=>p.seat>=me.seat); }, all(){ return me?[me].concat(peers).sort((a,b)=>a.seat-b.seat):[]; } };
  window.RRO={ watch(f){ watchers.push(f); lobby('home'); if(counts) f(counts); }, counts:()=>counts, init(c){ cfg=c; lobby(c.game); setTimeout(()=>{ topBtn(); watchMenu(); },0); const r=(qs.get('room')||'').toUpperCase(); if(/^[A-Z0-9]{4,8}$/.test(r)) setTimeout(()=>connect(r,getName()||'Player'),300); return api; } };
})();

/* Rink Rivals leaderboards: every game keeps world records on the rooms server.
   A game calls RRL.boards(game,[{id,name,mode:'max'|'min'|'sum'}]) and RRL.post(id,score,text) when a result is final. */
(function(){
  const qs=new URLSearchParams(location.search), API=(qs.get('server')||'wss://rink-rivals-rooms.mitchellchad2026.workers.dev').replace(/^ws/,'http')+'/lb/';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let game=null, defs=[], panel=null, tab=0, toastEl=null;
  const pid=(()=>{ try{ let p=localStorage.getItem('rrPid'); if(!p){ p=(Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,20); localStorage.setItem('rrPid',p); } return p; }catch(e){ return 'anon'+Math.floor(Math.random()*1e9); } })();
  const name=()=>{ try{ return localStorage.getItem('rrOnlineName')||''; }catch(e){ return ''; } };
  const css=`#rrlP{position:fixed;inset:0;z-index:9550;display:flex;align-items:center;justify-content:center;background:rgba(5,8,18,.72);font-family:'Big Shoulders Display','Arial Narrow',sans-serif}
#rrlP .box{background:#141c33;color:#eef2fb;border:2px solid #fbbf24;border-radius:16px;padding:16px 20px;width:min(560px,94vw);max-height:88vh;overflow:auto}
#rrlP h2{margin:0 0 8px;font-size:30px} #rrlP .tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px} #rrlP button{font:inherit;font-size:15px;font-weight:800;padding:6px 12px;border-radius:999px;border:2px solid #27345a;background:#1e293b;color:#fff;cursor:pointer}
#rrlP button.on{background:#fbbf24;color:#111;border-color:#fbbf24} #rrlP table{width:100%;border-collapse:collapse;font-size:18px} #rrlP td{padding:4px 6px;border-bottom:1px solid #27345a} #rrlP tr.me td{background:rgba(251,191,36,.18)} #rrlP .mute{color:#93a0bd;font-size:15px}
#rrlP input{font:inherit;font-size:18px;padding:5px 9px;border-radius:9px;border:2px solid #27345a;background:#0b1120;color:#fff;width:180px}
#rrlT{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:9450;background:#141c33;color:#fde047;border:2px solid #fbbf24;border-radius:14px;padding:8px 16px;font:800 20px 'Big Shoulders Display','Arial Narrow',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);transition:opacity .4s}`;
  function addCss(){ if(document.getElementById('rrlCss')) return; const st=document.createElement('style'); st.id='rrlCss'; st.textContent=css; document.head.appendChild(st); }
  function note(t){ addCss(); if(!toastEl){ toastEl=document.createElement('div'); toastEl.id='rrlT'; document.body.appendChild(toastEl); } toastEl.textContent=t; toastEl.style.opacity=1; clearTimeout(note.t); note.t=setTimeout(()=>{ toastEl.style.opacity=0; },4200); }
  async function load(d){ const r=await fetch(`${API}${game}?b=${encodeURIComponent(d.id)}&dir=${d.mode==='min'?'asc':'desc'}&n=20&pid=${pid}`); return r.json(); }
  async function render(){ if(!panel) return; const d=defs[tab]; if(!d){ panel.innerHTML='<div class="box"><h2>🏆 Records</h2><p>No records for this game yet.</p><button id="rrlX">Close</button></div>'; panel.querySelector('#rrlX').onclick=hide; return; }
    panel.innerHTML=`<div class="box"><h2>🏆 World records</h2><div class="tabs">${defs.map((x,i)=>`<button data-t="${i}" class="${i===tab?'on':''}">${esc(x.name)}</button>`).join('')}</div><div id="rrlB" class="mute">Loading…</div>
      <p class="mute">Your name on the boards: <input id="rrlN" maxlength="20" value="${esc(name())}" placeholder="Your name"> <button id="rrlS">Save</button></p><button id="rrlX">Close</button></div>`;
    panel.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=+b.dataset.t; render(); });
    panel.querySelector('#rrlX').onclick=hide; panel.querySelector('#rrlS').onclick=()=>{ const v=panel.querySelector('#rrlN').value.trim().slice(0,20); try{ localStorage.setItem('rrOnlineName',v); }catch(e){} note('Name saved'); };
    try{ const j=await load(d), B=panel&&panel.querySelector('#rrlB'); if(!B) return;
      B.innerHTML=j.rows.length?`<table>${j.rows.map((r,i)=>`<tr class="${r.me?'me':''}"><td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td><td>${esc(r.name)}${r.me?' (you)':''}</td><td style="text-align:right">${esc(r.txt||String(r.score))}</td></tr>`).join('')}</table>
        <p class="mute">${j.total} player${j.total===1?'':'s'} on this board.${j.me&&!j.rows.some(r=>r.me)?` You: #${j.me.rank} · ${esc(j.me.txt||j.me.score)}`:j.me?'':' Play to get on the board!'}</p>`:'<p>No records yet. Be the first!</p>'; }
    catch(e){ const B=panel&&panel.querySelector('#rrlB'); if(B) B.textContent='Could not reach the leaderboard server.'; } }
  function show(){ addCss(); if(panel) return; panel=document.createElement('div'); panel.id='rrlP'; document.body.appendChild(panel); panel.addEventListener('keydown',e=>e.stopPropagation()); panel.addEventListener('click',e=>{ if(e.target===panel) hide(); }); render(); }
  function hide(){ if(panel){ panel.remove(); panel=null; } }
  async function post(id,score,txt){ const d=defs.find(x=>x.id===id); if(!d||!game||!isFinite(score)) return;
    try{ const r=await fetch(API+game,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({b:id,pid,name:name()||'Player',score,txt:txt||String(score),mode:d.mode})}); const j=await r.json(); if(!j.ok) return;
      if(d.mode==='sum') note(`🏆 ${d.name}: ${j.score} · #${j.rank} in the world`); else if(j.improved) note(`🏆 New personal record! ${txt||score} · #${j.rank} on ${d.name}`); else if(j.rank<=10) note(`🏆 You're #${j.rank} on ${d.name}`); }catch(e){} }
  window.RRL={ boards(g,list){ game=g; for(const x of list) if(!defs.some(d=>d.id===x.id)) defs.push(x); }, post, show, get game(){ return game; } };
})();
