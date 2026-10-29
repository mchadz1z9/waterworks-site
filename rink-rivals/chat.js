/* Rink Rivals site chat: one chat room for the whole site. On the home page it is docked in the page (#chatDock);
   in a game it is a 💬 button that opens a panel. Typing in the chat never moves your player. */
(function(){
  if(window.RRC) return;
  const URL_WS='wss://rink-rivals-rooms.mitchellchad2026.workers.dev/chat';
  /* automated tests open the pages from disk or with ?test: never connect those to the real chat */
  const OFF=/[?&]test\b/.test(location.search)||(location.protocol==='file:'&&!/[?&]chat\b/.test(location.search));
  let GAME=((location.pathname.split('/').pop()||'').replace(/\.html$/,'')||'home').toLowerCase().replace(/[^a-z0-9]/g,'')||'home'; if(GAME==='index') GAME='home';
  const GN={home:'🏠 Home',blackjack:'🂡 Blackjack',hockey:'🏒 Hockey',baseball:'⚾ Baseball',football:'🏈 Football',soccer:'⚽ Soccer',basketball:'🏀 Basketball',ufc:'🥊 UFC',f1:'🏎️ F1',skate:'🛹 Skate',golf:'⛳ Golf',bowling:'🎳 Bowling',drift:'💨 Drift',nascar:'🏁 NASCAR',moto:'🏍️ MotoGP',fencing:'🤺 Fencing',airsoft:'🎯 Airsoft',paintball:'🟡 Paintball',surf:'🏄 Surfing',discgolf:'🥏 Disc Golf',pickleball:'🏓 Pickleball',skydive:'🪂 Skydiving',kart:'🏎️ Kart',flight:'✈️ Flight',tennis:'🎾 Tennis',fishing:'🎣 Fishing',chess:'♟️ Chess',monster:'🛻 Monster Truck',waterpolo:'🤽 Water Polo',mx:'🏍️ Motocross',jetski:'🚤 Jet Ski',minigolf:'⛳ Mini Golf',archery:'🏹 Archery',ski:'⛷️ Ski',tabletennis:'🏓 Table Tennis',rocket:'🚗 Rocket Soccer',athletics:'🏃 Track & Field',br:'🌀 Storm Royale',volleyball:'🏐 Volleyball',hunting:'🦌 Hunting',ultimate:'🥏 Ultimate',badminton:'🏸 Badminton',sailing:'⛵ Sailing',pool:'🎱 Pool & Snooker',karate:'🥋 Karate',kayak:'🛶 Kayak',rodeo:'🤠 Rodeo',landlord:'🏘️ Landlord',poker:'🃏 Poker','820':'🏀 82-0','84up':'⭐ 84 & Up',darts:'🎯 Darts',curling:'🥌 Curling',axe:'🪓 Axe Throwing',empires:'🌍 Empires'};
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let pid=ls.get('rrPid'); if(!pid||pid.length<8){ pid=Array.from({length:12},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); ls.set('rrPid',pid); }
  let name=(ls.get('rrOnlineName')||'').trim();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  /* links in messages are clickable (opened in a new tab, never followed by search engines) */
  const URLX=/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|gg|io|xyz|ly|me|tv|co|app|link|ca|uk|dev|info|edu|gov)(?:\/[^\s<>"']*)?)/gi;
  const linkify=t=>{ let out='', last=0; String(t).replace(URLX,(u,_,i)=>{ let tail=''; while(/[.,!?)\]]$/.test(u)){ tail=u.slice(-1)+tail; u=u.slice(0,-1); } const href=/^https?:\/\//i.test(u)?u:'https://'+u; out+=esc(String(t).slice(last,i))+`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow ugc">${esc(u.length>48?u.slice(0,46)+'…':u)}</a>`+esc(tail); last=i+u.length+tail.length; return u; }); return out+esc(String(t).slice(last)); };
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
#rrcPop{position:fixed;left:50%;top:18px;z-index:9550;width:min(640px,calc(100vw - 32px));box-sizing:border-box;background:#0f172a;color:#f8fafc;border:3px solid #6366f1;border-radius:18px;padding:16px 22px;font:700 22px/1.35 system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.55);cursor:pointer;opacity:0;transform:translate(-50%,-30px);pointer-events:none;transition:opacity .25s,transform .25s} #rrcPop.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
#rrcPop b{font-size:24px}
#rrcPop.inv{border-color:#22c55e;cursor:default}
#rrcPop .ib{display:flex;gap:10px;margin-top:12px}
#rrcPop .ib button{font:800 18px system-ui,sans-serif;border-radius:12px;padding:10px 20px;border:0;cursor:pointer}
#rrcPop .ib .y{background:#22c55e;color:#052e16}
#rrcPop .ib .n{background:#334155;color:#e2e8f0} #rrcPop span{font-size:15px;color:#94a3b8} #rrcPop div{margin-top:6px;word-wrap:break-word} #rrcPop small{display:block;margin-top:8px;color:#818cf8;font-size:14px} .rrc header .bell{background:none;border:0;cursor:pointer;font-size:15px;padding:0 4px} .rrc .m a{color:#7dd3fc;text-decoration:underline;word-break:break-all} .rrc .m{line-height:1.3;word-wrap:break-word;position:relative;padding:5px 8px;border-radius:10px;background:rgba(255,255,255,.04)}
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
    root.innerHTML=`<header><span>💬</span><b>Rink Rivals Chat</b><small class="cnt" title="See who's online and what they're playing">connecting…</small><button class="bell" title="Message notifications on/off">🔔</button><button class="nm" title="Change your name">✎ Name</button>${dock()?'':'<button class="cl" title="Close">✕</button>'}</header>
      <div class="log"><div class="empty">Say hi to everyone on Rink Rivals 👋</div></div><div class="who"></div>
      <div class="rules">Be kind · no swearing · never share personal info · no spam · ⚑ reports a message</div>
      <form autocomplete="off"><input maxlength="200" placeholder="${name?'Message everyone…':'Pick a name to chat…'}" aria-label="Chat message"><button>Send</button></form>`;
    log=root.querySelector('.log'); inp=root.querySelector('input'); cnt=root.querySelector('.cnt');
    /* keys typed into the chat must never reach the game */
    for(const ev of ['keydown','keyup','keypress']) inp.addEventListener(ev,e=>{ e.stopPropagation(); if(ev==='keydown'&&e.key==='Escape'){ inp.blur(); if(!dock()) toggle(false); } });
    root.querySelector('form').addEventListener('submit',e=>{ e.preventDefault(); send(); });
    const bl=root.querySelector('.bell'); const bellUI=()=>{ bl.textContent=notifOn?'🔔':'🔕'; bl.title=notifOn?'Notifications on (click to turn off)':'Notifications off (click to turn on)'; }; bellUI(); bl.addEventListener('click',()=>{ notifOn=!notifOn; ls.set('rrChatNotify',notifOn?'1':'0'); bellUI(); if(notifOn&&window.Notification&&Notification.permission==='default') try{ Notification.requestPermission(); }catch(e){} sys(notifOn?'Notifications on: you will see a pop-up when someone messages.':'Notifications off.'); });
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
    el.innerHTML=`<span class="t">${hh}:${mm}</span><span class="n" style="color:hsl(${hue(m.name)},85%,70%)">${esc(m.name)}</span><span class="g">${esc(GN[m.game]||m.game)}</span><br>${linkify(m.text)}${m.name===name?'':`<button class="x" data-id="${m.id}" title="Report">⚑</button>`}`; return el; }
  function add(m,quiet){ if(msgs.has(m.id)) return; const e=log.querySelector('.empty'); if(e) e.remove(); const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60, el=line(m); msgs.set(m.id,el); log.appendChild(el);
    while(log.children.length>150) log.removeChild(log.firstChild); if(atBottom||m.name===name) log.scrollTop=log.scrollHeight; if(!quiet&&m.name!==name){ if(!open){ unread++; badge(); } notify(m); } }
  let notifOn=ls.get('rrChatNotify')!=='0', pop=null, popT=null, titleT=null, baseTitle=document.title, missed=0, nAC=null;
  function ping(){ try{ nAC=nAC||new (window.AudioContext||window.webkitAudioContext)(); if(nAC.state!=='running') return; const t=nAC.currentTime; for(const [f,d] of [[880,0],[1320,.09]]){ const o=nAC.createOscillator(), g=nAC.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(.05,t+d); g.gain.exponentialRampToValueAtTime(.0001,t+d+.18); o.connect(g); g.connect(nAC.destination); o.start(t+d); o.stop(t+d+.2); } }catch(e){} }
  addEventListener('pointerdown',()=>{ try{ nAC=nAC||new (window.AudioContext||window.webkitAudioContext)(); if(nAC.state==='suspended') nAC.resume(); }catch(e){} },{once:true});
  function notify(m){ if(!notifOn) return; const hidden=document.hidden, docked=!!dock();
    if(hidden){ missed++; document.title=`(${missed}) 💬 ${m.name}: ${m.text}`.slice(0,60); if(!titleT){ titleT=setInterval(()=>{ if(!document.hidden){ clearInterval(titleT); titleT=null; missed=0; document.title=baseTitle; } },1000); }
      try{ if(window.Notification&&Notification.permission==='granted'){ const n=new Notification(`${m.name} on Rink Rivals`,{body:String(m.text).slice(0,120),tag:'rrchat',silent:false}); n.onclick=()=>{ window.focus(); toggle(true); n.close(); }; } }catch(e){} return; }
    if(open||docked) return; ping();
    if(popInv) return; mkPop(); pop.classList.remove('inv');
    pop.innerHTML=`<b style="color:hsl(${hue(m.name)},85%,70%)">${esc(m.name)}</b> <span>${esc(GN[m.game]||'')}</span><div>${esc(String(m.text).slice(0,140))}</div><small>Click to reply</small>`; pop.classList.add('on'); clearTimeout(popT); popT=setTimeout(()=>pop&&pop.classList.remove('on'),8000); }
  let popInv=false;
  function mkPop(){ if(pop) return; pop=document.createElement('div'); pop.id='rrcPop'; pop.setAttribute('role','status'); document.body.appendChild(pop); pop.addEventListener('click',e=>{ if(popInv) return; pop.classList.remove('on'); toggle(true); }); }
  /* someone invited you into their online room: a big card with Join */
  function inviteCard(m){ mkPop(); popInv=true; ping(); const gn=GN[m.game.replace(/[^a-z0-9]/g,'')]||m.game;
    pop.classList.add('inv'); pop.innerHTML=`<b style="color:hsl(${hue(m.from)},85%,70%)">${esc(m.from)}</b> invited you to play <b>${esc(gn)}</b>!<div class="ib"><button class="y">Join game</button><button class="n">No thanks</button></div>`;
    const close=()=>{ popInv=false; pop.classList.remove('on','inv'); clearTimeout(popT); };
    pop.querySelector('.y').onclick=ev=>{ ev.stopPropagation(); close(); location.href=`${m.game==='home'?'./':m.game}?room=${encodeURIComponent(m.room)}`; };
    pop.querySelector('.n').onclick=ev=>{ ev.stopPropagation(); close(); };
    pop.classList.add('on'); clearTimeout(popT); popT=setTimeout(close,45000);
    if(document.hidden){ try{ if(window.Notification&&Notification.permission==='granted') new Notification(`${m.from} invited you to ${gn}`,{body:'Open Rink Rivals to join',tag:'rrinv'}); }catch(e){} } }
  let invCb=null;
  function sys(t){ const el=document.createElement('div'); el.className='sys'; el.textContent=t; log.appendChild(el); log.scrollTop=log.scrollHeight; }
  function tx(o){ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); }
  function send(){ const t=inp.value.trim(); if(!t) return; if(!name){ askName(); return; } if(!ws||ws.readyState!==1){ sys('Not connected yet, try again in a second.'); return; } tx({t:'say',text:t}); inp.value=''; }
  function connect(){ if(banned) return; if(OFF){ cnt.textContent='offline'; sys('Chat is off on test pages.'); return; }
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
      else if(m.t==='invite') inviteCard(m);
      else if(m.t==='invsent'){ if(invCb) try{ invCb(m); }catch(e){} }
      else if(m.t==='kicked') kicked(m);
      else if(m.t==='sys') sys(m.text); };
    ws.onclose=()=>{ clearInterval(pingT); cnt.textContent='reconnecting…'; later(); }; ws.onerror=()=>{ try{ ws.close(); }catch(e){} }; }
  let banned=false;
  function later(){ if(banned) return; retry=Math.min(retry+1,6); setTimeout(connect,1000*retry*retry); }
  /* an admin removed this person: cover the screen and stop reconnecting for a while */
  function kicked(m){ banned=true; try{ ws&&ws.close(); }catch(e){} clearInterval(pingT);
    try{ localStorage.setItem('rrKicked',String(Date.now()+(+m.mins||30)*60000)); }catch(e){}
    if(document.getElementById('rrKick')) return; const d=document.createElement('div'); d.id='rrKick';
    d.style.cssText='position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,10,.94);color:#fff;font-family:system-ui,sans-serif;text-align:center';
    d.innerHTML=`<div style="max-width:460px"><div style="font-size:52px">🚫</div><h2 style="margin:10px 0;font-size:30px">You've been removed</h2><p style="font-size:18px;color:#cbd5e1">An admin removed you from Rink Rivals${m.mins?` for ${m.mins} minutes`:''}. Chat and online play are paused for now.</p></div>`;
    (document.body||document.documentElement).appendChild(d); }
  try{ const until=+localStorage.getItem('rrKicked')||0; if(until>Date.now()){ banned=true; kicked({mins:Math.ceil((until-Date.now())/60000)}); } }catch(e){}
  function setN(n){ online=n; cnt.textContent=`👥 ${n} online ${root.classList.contains('showwho')?'▴':'▾'}`; if(fab){ fab.title=`Chat · ${n} online`; fab.innerHTML=`💬 Chat <s>· ${n} online</s> <i></i>`; badge(); } }
  /* who's online and what they're playing; a button takes you to their game */
  let roster=[];
  function showWho(on){ if(!dock()&&!open) toggle(true); const v=on==null?!root.classList.contains('showwho'):on; root.classList.toggle('showwho',v); setN(online); renderWho(); }
  function renderWho(){ const el=root&&root.querySelector('.who'); if(!el) return; const by={}; for(const p of roster){ (by[p.game]=by[p.game]||[]).push(p); }
    const games=Object.keys(by).sort((a,b)=>(a==='home')-(b==='home')||by[b].length-by[a].length);
    el.innerHTML=`<h4>👥 ${roster.length} on Rink Rivals right now</h4>`+(roster.length?games.map(g=>by[g].map(p=>`<div class="wr"><b style="color:hsl(${hue(p.name)},85%,70%)">${esc(p.name)}${p.me?' (you)':''}</b><span>${g==='home'?'🏠 browsing':esc(GN[g]||g)}</span>${g==='home'?'':g===GAME?'<a class="here">Here</a>':`<a href="${esc(g)}" title="Go play ${esc(GN[g]||g)} with them">Play →</a>`}</div>`).join('')).join(''):'<div class="empty">Nobody else yet.</div>')+'<div class="rules" style="border:0;padding:6px 2px">Tip: in a game press <b>Online → Play with anyone</b> to get matched with the people there.</div>'; }
  function start(){ build(); connect(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  addEventListener('rr-name',e=>{ const v=String(e.detail||'').trim(); if(!v||v===name) return; name=v; if(inp) inp.placeholder='Message everyone…'; tx({t:'name',name:v}); });
  window.RRC={ invite(id,game,room,cb){ invCb=cb||null; tx({t:'invite',to:id,game,room}); }, toggle:on=>toggle(on==null?!open:on), showWho, get online(){ return online; }, get roster(){ return roster; } };
})();

/* Rink Rivals player name: everyone picks a name once, before they play (it's the name on the chat, online games and the records) */
(function(){
  if(window.RRNAME) return; window.RRNAME=1;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const OFF=/[?&]test\b/.test(location.search)||location.protocol==='file:';
  const get=()=>{ try{ return (localStorage.getItem('rrOnlineName')||'').trim(); }catch(e){ return ''; } };
  const GENERIC=/^(player|guest|you|anonymous|user|unknown|name|me)\s*\d*$/i;
  if(OFF||get()&&!GENERIC.test(get())) return;
  const BAD=/(fuck|shit|cunt|nigg|fag|bitch|whore|slut|rape|nazi|hitler|dick|cock|pussy|penis|vagina|porn|sex)/i;
  function check(v){ if(v.length<2) return 'At least 2 characters'; if(v.length>20) return 'At most 20 characters'; if(!/^[\p{L}\p{N} _.\-']+$/u.test(v)) return 'Letters, numbers, spaces and _ . - only'; if(BAD.test(v.replace(/[^a-z]/gi,''))) return 'Please pick a friendlier name'; if(GENERIC.test(v)||/^admin\s*\d*$/i.test(v)) return 'Pick a real name, not a placeholder'; return ''; }
  let ov=null, inp=null, msg=null;
  function save(){ const v=inp.value.replace(/\s+/g,' ').trim(), e=check(v); if(e){ msg.textContent=e; inp.focus(); return; } try{ localStorage.setItem('rrOnlineName',v); }catch(_){} ov.remove(); ov=null; removeEventListener('keydown',block,true); removeEventListener('keyup',block,true); try{ dispatchEvent(new CustomEvent('rr-name',{detail:v})); }catch(_){} }
  function block(e){ if(!ov) return; if(e.type==='keydown'&&(e.key==='Enter'||e.code==='Enter'||e.code==='NumpadEnter')){ e.preventDefault(); save(); } e.stopImmediatePropagation(); if(e.target!==inp) e.preventDefault(); if(e.target!==inp&&inp) inp.focus(); }
  function show(){ if(get()&&!GENERIC.test(get())) return; const st=document.createElement('style'); st.textContent=`#rrNm{position:fixed;inset:0;z-index:99999;background:rgba(3,7,18,.86);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:'Big Shoulders Display','Arial Narrow',sans-serif;padding:16px}
#rrNm .bx{background:linear-gradient(160deg,#111a33,#0b1224);border:2px solid #334155;border-radius:18px;padding:26px 28px;max-width:420px;width:100%;color:#e2e8f0;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#rrNm h2{margin:0 0 6px;font-size:34px;color:#fff;letter-spacing:.02em} #rrNm p{margin:0 0 16px;color:#94a3b8;font:500 15px/1.4 system-ui,sans-serif}
#rrNm input{width:100%;box-sizing:border-box;font:700 22px system-ui,sans-serif;padding:12px 14px;border-radius:10px;border:2px solid #475569;background:#020617;color:#fff;outline:none;text-align:center} #rrNm input:focus{border-color:#38bdf8}
#rrNm button{margin-top:14px;width:100%;font:800 22px 'Big Shoulders Display','Arial Narrow',sans-serif;padding:11px;border:0;border-radius:10px;color:#111;background:linear-gradient(135deg,#fde047,#f59e0b);cursor:pointer} #rrNm .e{min-height:18px;margin-top:8px;color:#f87171;font:600 14px system-ui,sans-serif}`;
    document.head.appendChild(st); ov=document.createElement('div'); ov.id='rrNm'; ov.innerHTML=`<div class="bx" role="dialog" aria-modal="true" aria-labelledby="rrNmT"><h2 id="rrNmT">${get()?'Pick a real name':'Welcome to Rink Rivals'}</h2><p>${get()?`"${esc(get())}" is a placeholder. Everyone needs a real player name now. `:''}Pick your player name first. It's shown in online games, on the world records and in the chat. Don't use your real full name.</p><input maxlength="20" autocomplete="off" spellcheck="false" placeholder="Your player name" aria-label="Player name"><div class="e"></div><button type="button">Let's play</button></div>`;
    document.body.appendChild(ov); inp=ov.querySelector('input'); msg=ov.querySelector('.e'); ov.querySelector('button').addEventListener('click',save); inp.addEventListener('input',()=>{ msg.textContent=''; });
    ['mousedown','pointerdown','touchstart','click','wheel'].forEach(t=>ov.addEventListener(t,e=>e.stopPropagation()));
    addEventListener('keydown',block,true); addEventListener('keyup',block,true); setTimeout(()=>inp.focus(),50); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show); else show();
})();

/* Rink Rivals key bindings: every game's controls can be moved to other keys (saved per game on this device).
   A pressed key is swapped for the game's own key before the game sees it, so the games themselves don't change. */
(function(){
  if(window.RRKEYS) return;
  const GAME=((location.pathname.split('/').pop()||'').replace(/\.html$/,'')||'home').toLowerCase().replace(/[^a-z0-9]/g,'')||'home';
  if(GAME==='home'||GAME==='index') return;
  const SK='rrKeys_'+GAME;
  let map={}; try{ map=JSON.parse(localStorage.getItem(SK)||'{}')||{}; }catch(e){ map={}; }
  const save=()=>{ try{ localStorage.setItem(SK,JSON.stringify(map)); }catch(e){} };
  const KEEP=new Set(['Escape']); /* Escape always works, so you can't lock yourself out of a menu */
  const keyOf=code=>code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code.startsWith('Digit')?code.slice(5):/^Shift/.test(code)?'Shift':/^Control/.test(code)?'Control':/^Alt/.test(code)?'Alt':code==='NumpadEnter'?'Enter':code;
  const nice=code=>{ if(!code) return '—'; if(code.startsWith('Key')) return code.slice(3); if(code.startsWith('Digit')) return code.slice(5); return {Space:'Space',ShiftLeft:'Shift',ShiftRight:'Right Shift',ControlLeft:'Ctrl',ControlRight:'Right Ctrl',AltLeft:'Alt',AltRight:'Right Alt',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'Esc',Enter:'Enter',Backspace:'Backspace',Tab:'Tab',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',BracketLeft:'[',BracketRight:']',Minus:'-',Equal:'=',Backquote:'`'}[code]||code.replace(/^Numpad/,'Num ');};
  const typing=t=>t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
  const held=new Map(); let capture=null;
  function onKey(e){ if(!e.isTrusted) return; if(capture){ e.preventDefault(); e.stopImmediatePropagation(); if(e.type==='keydown') capture(e.code); return; }
    if(typing(e.target)) return; let to;
    if(e.type==='keyup'&&held.has(e.code)){ to=held.get(e.code); held.delete(e.code); }
    else { if(!Object.prototype.hasOwnProperty.call(map,e.code)||KEEP.has(e.code)) return; to=map[e.code]; if(e.type==='keydown') held.set(e.code,to); }
    e.stopImmediatePropagation(); e.preventDefault(); if(!to) return;
    (e.target||window).dispatchEvent(new KeyboardEvent(e.type,{code:to,key:keyOf(to),repeat:e.repeat,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,bubbles:true,cancelable:true})); }
  addEventListener('keydown',onKey,true); addEventListener('keyup',onKey,true);
  addEventListener('blur',()=>{ for(const [k,to] of held){ if(to) window.dispatchEvent(new KeyboardEvent('keyup',{code:to,key:keyOf(to),bubbles:true})); } held.clear(); });
  /* the game's actions, from its touch-screen layout */
  function actions(){ const c=window.RR_TOUCH||{}, A=[], seen=new Set(); const add=(l,code)=>{ if(!code||seen.has(code)) return; seen.add(code); A.push([String(l).replace(/<br>/g,' ').replace(/<[^>]+>/g,''),code]); };
    if(c.stick==='wasd'){ add('Forward / up','KeyW'); add('Left','KeyA'); add('Back / down','KeyS'); add('Right','KeyD'); } else if(c.stick==='ad'){ add('Left','KeyA'); add('Right','KeyD'); }
    (c.buttons||[]).forEach(b=>add(b[0],b[1])); (c.sys||[['Start / confirm','Enter'],['Pause / menu','Escape']]).forEach(b=>add(b[0],b[1]));
    for(const v of Object.values(map)) if(v&&!seen.has(v)) add('Game key '+nice(v),v); return A; }
  const physFor=code=>{ const ks=Object.keys(map).filter(k=>map[k]===code&&k!==code); return ks.length?ks:(map[code]===undefined||map[code]===code?[code]:[]); };
  function bind(phys,code){ const was=physFor(code)[0], other=Object.prototype.hasOwnProperty.call(map,phys)?map[phys]:phys, acts=actions().map(a=>a[1]);
    bind1(phys,code); if(was&&was!==phys&&other&&other!==code&&acts.includes(other)&&!KEEP.has(other)) bind1(was,other); /* the action that had this key gets your old one: a swap */
    save(); }
  function bind1(phys,code){ for(const k of Object.keys(map)) if(map[k]===code&&k!==code) delete map[k]; /* one key per action */
    if(phys===code){ delete map[code]; } else { map[phys]=code; if(map[code]===undefined&&!KEEP.has(code)&&code!=='Enter') map[code]=''; } /* the old key stops doing it */ }
  let panel=null;
  function render(){ if(!panel) return; const A=actions(); const used={}; for(const [l,c] of A) for(const p of physFor(c)) (used[p]=used[p]||[]).push(l);
    panel.querySelector('.ls').innerHTML=A.map(([l,c])=>{ const ps=physFor(c), clash=ps.some(p=>used[p].length>1); return `<div class="r"><span>${l.replace(/[<>&]/g,'')}</span><button data-c="${c}" class="${clash?'cl':''}" title="Click, then press the new key">${ps.map(nice).join(' / ')||'none'}</button>${map[c]!==undefined||ps[0]!==c?`<i data-r="${c}" title="Back to ${nice(c)}">↺</i>`:''}</div>`; }).join('')+`<div class="r ad"><span>Remap any other key</span><button data-any="1">+ Add</button></div>`; }
  function open(){ if(panel){ close(); return; } panel=document.createElement('div'); panel.id='rrKy'; panel.innerHTML=`<div class="bx"><h3>⌨ Key bindings <small>${GAME}</small></h3><p>Click a key, then press the key you want for it. Saved on this device. Esc always works.</p><div class="ls"></div><div class="ft"><button class="rs">Reset all</button><button class="dn">Done</button></div><div class="hint"></div></div>`;
    document.body.appendChild(panel); ['mousedown','pointerdown','touchstart','click','wheel'].forEach(t=>panel.addEventListener(t,e=>e.stopPropagation()));
    panel.addEventListener('click',e=>{ const b=e.target.closest('button,i'); if(!b){ if(e.target===panel) close(); return; } const hint=panel.querySelector('.hint');
      if(b.classList.contains('dn')) return close(); if(b.classList.contains('rs')){ map={}; save(); render(); return; }
      if(b.dataset.r){ const c=b.dataset.r; for(const k of Object.keys(map)) if(map[k]===c) delete map[k]; if(map[c]!==undefined) delete map[c]; save(); render(); return; }
      if(b.dataset.any){ hint.textContent='Press the game key you want to move (the key the game uses)…'; capture=g=>{ if(g==='Escape'){ capture=null; hint.textContent=''; return; } hint.textContent=`Now press the new key for ${nice(g)}…`; capture=p=>{ capture=null; hint.textContent=''; if(p!=='Escape') bind(p,g); render(); }; }; return; }
      if(b.dataset.c){ const c=b.dataset.c; b.textContent='press a key…'; b.classList.add('wt'); hint.textContent='Press the new key (Esc cancels)'; capture=p=>{ capture=null; hint.textContent=''; if(p!=='Escape') bind(p,c); render(); }; } });
    render(); }
  function close(){ capture=null; if(panel){ panel.remove(); panel=null; } }
  const css=`#rrKy{position:fixed;inset:0;z-index:9800;background:rgba(3,7,18,.7);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}
#rrKy .bx{background:#0b1224;border:2px solid #334155;border-radius:16px;padding:18px 20px;max-width:440px;width:100%;max-height:86vh;overflow:auto;color:#e2e8f0}
#rrKy h3{margin:0 0 4px;font:800 26px 'Big Shoulders Display','Arial Narrow',sans-serif;color:#fff} #rrKy h3 small{font-size:15px;color:#64748b;text-transform:uppercase;margin-left:6px} #rrKy p{margin:0 0 10px;color:#94a3b8;font-size:13px}
#rrKy .r{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1e293b;font-size:14px} #rrKy .r span{flex:1}
#rrKy .r button{min-width:92px;font:700 14px system-ui;padding:6px 10px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer} #rrKy .r button.wt{background:#0369a1;border-color:#38bdf8} #rrKy .r button.cl{border-color:#f59e0b;color:#fde68a}
#rrKy .r i{font-style:normal;cursor:pointer;color:#94a3b8;font-size:17px;width:18px} #rrKy .ft{display:flex;gap:8px;margin-top:12px} #rrKy .ft button{flex:1;font:800 17px 'Big Shoulders Display','Arial Narrow',sans-serif;padding:9px;border:0;border-radius:9px;cursor:pointer} #rrKy .rs{background:#334155;color:#fff} #rrKy .dn{background:#fbbf24;color:#111}
#rrKy .hint{min-height:18px;margin-top:8px;color:#38bdf8;font-size:13px;text-align:center}`;
  function mount(){ const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); const snd=document.getElementById('btnSnd'); const b=document.createElement('button'); b.id='btnKeys'; b.tabIndex=-1; b.textContent='⌨ Keys'; b.title='Change the key bindings'; b.addEventListener('click',e=>{ e.stopPropagation(); open(); });
    if(snd&&snd.parentNode) snd.parentNode.insertBefore(b,snd.nextSibling); else { b.style.cssText='position:fixed;right:14px;bottom:112px;z-index:9400;border:0;border-radius:999px;padding:8px 14px;font:800 15px system-ui;color:#fff;background:#334155;cursor:pointer'; document.body.appendChild(b); } }
  window.RRKEYS={open,close,get map(){ return map; }};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
