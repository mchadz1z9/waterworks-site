/* Rink Rivals site chat: one chat room for the whole site. On the home page it is docked in the page (#chatDock);
   in a game it is a 💬 button that opens a panel. Typing in the chat never moves your player. */
(function(){
  if(window.RRC) return;
  const URL_WS='wss://rink-rivals-rooms.mitchellchad2026.workers.dev/chat';
  /* automated tests open the pages from disk or with ?test: never connect those to the real chat */
  const OFF=/[?&]test\b/.test(location.search)||(location.protocol==='file:'&&!/[?&]chat\b/.test(location.search));
  let GAME=((location.pathname.split('/').pop()||'').replace(/\.html$/,'')||'home').toLowerCase().replace(/[^a-z0-9]/g,'')||'home'; if(GAME==='index') GAME='home';
  const GN={home:'🏠 Home',hockey:'🏒 Hockey',baseball:'⚾ Baseball',football:'🏈 Football',soccer:'⚽ Soccer',basketball:'🏀 Basketball',ufc:'🥊 UFC',f1:'🏎️ F1',skate:'🛹 Skate',golf:'⛳ Golf',bowling:'🎳 Bowling',drift:'💨 Drift',nascar:'🏁 NASCAR',moto:'🏍️ MotoGP',fencing:'🤺 Fencing',airsoft:'🎯 Airsoft',paintball:'🟡 Paintball',surf:'🏄 Surfing',discgolf:'🥏 Disc Golf',pickleball:'🏓 Pickleball',skydive:'🪂 Skydiving',kart:'🏎️ Kart',flight:'✈️ Flight',tennis:'🎾 Tennis',fishing:'🎣 Fishing',chess:'♟️ Chess',monster:'🛻 Monster Truck',waterpolo:'🤽 Water Polo',mx:'🏍️ Motocross',jetski:'🚤 Jet Ski',minigolf:'⛳ Mini Golf',archery:'🏹 Archery',ski:'⛷️ Ski',tabletennis:'🏓 Table Tennis',rocket:'🚗 Rocket Soccer',athletics:'🏃 Track & Field',br:'🌀 Storm Royale',volleyball:'🏐 Volleyball',hunting:'🦌 Hunting',ultimate:'🥏 Ultimate',badminton:'🏸 Badminton',sailing:'⛵ Sailing'};
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let pid=ls.get('rrPid'); if(!pid||pid.length<8){ pid=Array.from({length:12},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); ls.set('rrPid',pid); }
  let name=(ls.get('rrOnlineName')||'').trim();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hue=s=>{ let h=0; for(const c of String(s)) h=(h*31+c.charCodeAt(0))>>>0; return h%360; };

  const css=`
#rrcF{position:fixed;right:14px;bottom:64px;z-index:9500;border:0;border-radius:999px;padding:10px 16px;font:800 17px 'Big Shoulders Display','Arial Narrow',sans-serif;color:#fff;background:linear-gradient(135deg,#6366f1,#0ea5e9);box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;display:flex;align-items:center;gap:8px}
#rrcF:hover{filter:brightness(1.1)} #rrcF s{text-decoration:none;font-size:13px;opacity:.85;font-weight:700} #rrcF i{font-style:normal;background:#ef4444;border-radius:999px;padding:0 7px;font-size:14px;display:none} #rrcF i.on{display:inline-block}
#rrcP{position:fixed;right:14px;bottom:112px;z-index:9501;width:360px;max-width:calc(100vw - 28px);height:min(480px,65vh);display:none}
#rrcP.open{display:flex} #rrcP .rrc{display:flex;flex:1;min-height:0}
.rrc{flex-direction:column;background:#0f172a;color:#e2e8f0;border:2px solid #27345a;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden;font:600 15px system-ui,-apple-system,'Segoe UI',sans-serif}
#chatDock .rrc{display:flex;height:100%;box-shadow:none}
.rrc header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(135deg,#1e1b4b,#0c4a6e);font:800 19px 'Big Shoulders Display','Arial Narrow',sans-serif;letter-spacing:.02em}
.rrc header b{flex:1} .rrc header small{font:700 13px system-ui,sans-serif;color:#86efac;cursor:pointer;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35);border-radius:999px;padding:2px 9px;white-space:nowrap} .rrc header small:hover{background:rgba(34,197,94,.25)}
.rrc .who{flex:1;overflow-y:auto;padding:8px 10px;display:none;flex-direction:column;gap:6px} .rrc.showwho .who{display:flex} .rrc.showwho .log{display:none}
.rrc .who h4{margin:2px 0 4px;font:800 16px 'Big Shoulders Display','Arial Narrow',sans-serif;color:#cbd5e1;letter-spacing:.03em}
.rrc .wr{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.05)} .rrc .wr b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .rrc .wr span{color:#94a3b8;font-size:13px;white-space:nowrap} .rrc .wr a{background:#22c55e;color:#04210f;text-decoration:none;font:800 14px 'Big Shoulders Display','Arial Narrow',sans-serif;border-radius:8px;padding:3px 10px;white-space:nowrap} .rrc .wr a.here{background:#334155;color:#cbd5e1} .rrc header small::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;margin-right:5px}
.rrc header button{background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:8px;padding:3px 8px;cursor:pointer;font:700 13px system-ui,sans-serif}
.rrc .log{flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin}
.rrc .m{line-height:1.3;word-wrap:break-word;position:relative;padding:5px 8px;border-radius:10px;background:rgba(255,255,255,.04)}
.rrc .m.me{background:rgba(99,102,241,.18)}
.rrc .m .n{font-weight:800} .rrc .m .g{font-size:11px;color:#94a3b8;margin-left:6px;font-weight:700} .rrc .m .t{float:right;font-size:11px;color:#64748b;margin-left:6px}
.rrc .m .x{display:none;position:absolute;right:4px;top:18px;background:#1e293b;border:0;color:#fca5a5;border-radius:6px;font-size:11px;cursor:pointer;padding:1px 6px}
.rrc .m:hover .x{display:block}
.rrc .sys{color:#fbbf24;font-size:13px;font-style:italic;padding:2px 4px}
.rrc .rules{font-size:11px;color:#94a3b8;padding:4px 12px;border-top:1px solid #1e293b}
.rrc form{display:flex;gap:6px;padding:8px;border-top:1px solid #1e293b;background:#0b1222}
.rrc input{flex:1;min-width:0;background:#1e293b;border:1px solid #334155;color:#fff;border-radius:10px;padding:9px 10px;font:600 15px system-ui,sans-serif;outline:none}
.rrc input:focus{border-color:#6366f1}
.rrc form button{background:#6366f1;color:#fff;border:0;border-radius:10px;padding:0 14px;font:800 16px 'Big Shoulders Display','Arial Narrow',sans-serif;cursor:pointer}
.rrc .empty{color:#64748b;text-align:center;margin:auto;font-size:14px}
@media (max-width:600px){ #rrcP{right:8px;left:8px;width:auto;bottom:110px;height:60vh} #rrcF{bottom:58px;right:8px} }`;
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  let ws=null, open=false, unread=0, online=0, retry=0, pingT=null, root, log, inp, cnt, fab, panel, msgs=new Map();
  const dock=()=>{ const d=document.getElementById('chatDock'); return d&&getComputedStyle(d).display!=='none'?d:null; };
  if(GAME!=='home') ls.set('rrLast',GAME);
  function build(){
    root=document.createElement('div'); root.className='rrc';
    root.innerHTML=`<header><span>💬</span><b>Rink Rivals Chat</b><small class="cnt" title="See who's online and what they're playing">connecting…</small><button class="nm" title="Change your name">✎ Name</button>${dock()?'':'<button class="cl" title="Close">✕</button>'}</header>
      <div class="log"><div class="empty">Say hi to everyone on Rink Rivals 👋</div></div><div class="who"></div>
      <div class="rules">Be kind · no swearing · never share personal info · links are blocked · ⚑ reports a message</div>
      <form autocomplete="off"><input maxlength="200" placeholder="${name?'Message everyone…':'Pick a name to chat…'}" aria-label="Chat message"><button>Send</button></form>`;
    log=root.querySelector('.log'); inp=root.querySelector('input'); cnt=root.querySelector('.cnt');
    /* keys typed into the chat must never reach the game */
    for(const ev of ['keydown','keyup','keypress']) inp.addEventListener(ev,e=>{ e.stopPropagation(); if(ev==='keydown'&&e.key==='Escape'){ inp.blur(); if(!dock()) toggle(false); } });
    root.querySelector('form').addEventListener('submit',e=>{ e.preventDefault(); send(); });
    root.querySelector('.nm').addEventListener('click',()=>askName()); cnt.addEventListener('click',()=>showWho());
    const cl=root.querySelector('.cl'); if(cl) cl.addEventListener('click',()=>toggle(false));
    log.addEventListener('click',e=>{ const b=e.target.closest('.x'); if(!b) return; const id=+b.dataset.id; if(confirm('Report this message as mean or unsafe?')) tx({t:'report',id}); });
    if(dock()){ dock().appendChild(root); open=true; }
    else { panel=document.createElement('div'); panel.id='rrcP'; panel.appendChild(root); document.body.appendChild(panel);
      fab=document.createElement('button'); fab.id='rrcF'; fab.innerHTML='💬 Chat <i></i>'; fab.title='Chat with everyone on Rink Rivals'; fab.addEventListener('click',()=>toggle(!open)); fab.addEventListener('keydown',e=>e.stopPropagation());
      document.body.appendChild(fab); } }
  function toggle(on){ open=on; if(panel) panel.classList.toggle('open',on); if(on){ unread=0; badge(); setTimeout(()=>{ log.scrollTop=log.scrollHeight; if(name) inp.focus(); else askName(); },30); } }
  function badge(){ if(!fab) return; const i=fab.querySelector('i'); i.textContent=unread>9?'9+':unread; i.classList.toggle('on',unread>0); }
  function askName(){ const n=prompt('Your chat name (shown to everyone; don\'t use your real full name):',name||''); if(n==null) return; const v=n.replace(/[<>]/g,'').trim().slice(0,20); if(!v) return; name=v; ls.set('rrOnlineName',v); inp.placeholder='Message everyone…'; tx({t:'name',name:v}); inp.focus(); }
  function line(m){ const el=document.createElement('div'); el.className='m'+(m.name===name?' me':''); el.dataset.id=m.id; const d=new Date(m.ts), hh=d.getHours(), mm=String(d.getMinutes()).padStart(2,'0');
    el.innerHTML=`<span class="t">${hh}:${mm}</span><span class="n" style="color:hsl(${hue(m.name)},85%,70%)">${esc(m.name)}</span><span class="g">${esc(GN[m.game]||m.game)}</span><br>${esc(m.text)}${m.name===name?'':`<button class="x" data-id="${m.id}" title="Report">⚑</button>`}`; return el; }
  function add(m,quiet){ if(msgs.has(m.id)) return; const e=log.querySelector('.empty'); if(e) e.remove(); const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60, el=line(m); msgs.set(m.id,el); log.appendChild(el);
    while(log.children.length>150) log.removeChild(log.firstChild); if(atBottom||m.name===name) log.scrollTop=log.scrollHeight; if(!quiet&&!open&&m.name!==name){ unread++; badge(); } }
  function sys(t){ const el=document.createElement('div'); el.className='sys'; el.textContent=t; log.appendChild(el); log.scrollTop=log.scrollHeight; }
  function tx(o){ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); }
  function send(){ const t=inp.value.trim(); if(!t) return; if(!name){ askName(); return; } if(!ws||ws.readyState!==1){ sys('Not connected yet, try again in a second.'); return; } tx({t:'say',text:t}); inp.value=''; }
  function connect(){ if(OFF){ cnt.textContent='offline'; sys('Chat is off on test pages.'); return; }
    try{ ws=new WebSocket(URL_WS); }catch(e){ return later(); }
    ws.onopen=()=>{ retry=0; tx({t:'hello',name:name||'Player',pid,game:GAME}); clearInterval(pingT); pingT=setInterval(()=>tx({t:'ping'}),25000); };
    ws.onmessage=ev=>{ let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
      if(m.t==='hist'){ for(const x of m.m) add(x,true); if(!roster.length) setN(m.n); log.scrollTop=log.scrollHeight; }
      else if(m.t==='msg') add(m.m);
      else if(m.t==='n'){ if(!roster.length) setN(m.n); }
      else if(m.t==='del'){ const el=msgs.get(m.id); if(el){ el.remove(); msgs.delete(m.id); } }
      else if(m.t==='clear'){ log.innerHTML=''; msgs.clear(); }
      else if(m.t==='you'){ name=m.name; ls.set('rrOnlineName',name); }
      else if(m.t==='who'){ roster=m.list||[]; setN(roster.length); renderWho(); try{ dispatchEvent(new CustomEvent('rrc-who',{detail:roster})); }catch(e){} }
      else if(m.t==='sys') sys(m.text); };
    ws.onclose=()=>{ clearInterval(pingT); cnt.textContent='reconnecting…'; later(); }; ws.onerror=()=>{ try{ ws.close(); }catch(e){} }; }
  function later(){ retry=Math.min(retry+1,6); setTimeout(connect,1000*retry*retry); }
  function setN(n){ online=n; cnt.textContent=`👥 ${n} online ${root.classList.contains('showwho')?'▴':'▾'}`; if(fab){ fab.title=`Chat · ${n} online`; fab.innerHTML=`💬 Chat <s>· ${n} online</s> <i></i>`; badge(); } }
  /* who's online and what they're playing; a button takes you to their game */
  let roster=[];
  function showWho(on){ if(!dock()&&!open) toggle(true); const v=on==null?!root.classList.contains('showwho'):on; root.classList.toggle('showwho',v); setN(online); renderWho(); }
  function renderWho(){ const el=root&&root.querySelector('.who'); if(!el) return; const by={}; for(const p of roster){ (by[p.game]=by[p.game]||[]).push(p); }
    const games=Object.keys(by).sort((a,b)=>(a==='home')-(b==='home')||by[b].length-by[a].length);
    el.innerHTML=`<h4>👥 ${roster.length} on Rink Rivals right now</h4>`+(roster.length?games.map(g=>by[g].map(p=>`<div class="wr"><b style="color:hsl(${hue(p.name)},85%,70%)">${esc(p.name)}${p.me?' (you)':''}</b><span>${g==='home'?'🏠 browsing':esc(GN[g]||g)}</span>${g==='home'?'':g===GAME?'<a class="here">Here</a>':`<a href="${esc(g)}" title="Go play ${esc(GN[g]||g)} with them">Play →</a>`}</div>`).join('')).join(''):'<div class="empty">Nobody else yet.</div>')+'<div class="rules" style="border:0;padding:6px 2px">Tip: in a game press <b>Online → Play with anyone</b> to get matched with the people there.</div>'; }
  function start(){ build(); connect(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  window.RRC={ toggle:on=>toggle(on==null?!open:on), showWho, get online(){ return online; }, get roster(){ return roster; } };
})();
