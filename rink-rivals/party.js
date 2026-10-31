/* Rink Rivals parties: team up with friends from the lobby or any game, vote on what to play,
   and the leader hits GO to launch everyone into that game together (same online room).
   Runs on every page (site.js loads it). The party stays alive while people move between pages. */
(function(){ if(window.RRPARTY) return;
  const qs=new URLSearchParams(location.search);
  const OFF=/[?&]test\b/.test(location.search)||location.protocol==='file:';
  const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'')||'home';
  if(PAGE==='admin') return;
  const SERVER=(qs.get('server')||'wss://rink-rivals-rooms.mitchellchad2026.workers.dev').replace(/^http/,'ws');
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }, del:k=>{ try{ localStorage.removeItem(k); }catch(e){} } };
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const GAMES=[["br", "🌀", "Storm Royale"], ["badminton", "🏸", "Badminton"], ["sailing", "⛵", "Sailing"], ["pool", "🎱", "Pool & Snooker"], ["karate", "🥋", "Karate"], ["kayak", "🛶", "Kayak"], ["rodeo", "🤠", "Rodeo"], ["landlord", "🏘️", "Landlord"], ["poker", "🃏", "Poker"], ["blackjack", "🂡", "Blackjack"], ["82-0", "🏀", "82-0"], ["84-up", "⭐", "84 & Up"], ["darts", "🎯", "Darts"], ["curling", "🥌", "Curling"], ["axe", "🪓", "Axe Throwing"], ["empires", "🌍", "Empires"], ["ultimate", "🥏", "Ultimate Frisbee"], ["hunting", "🦌", "Hunting"], ["volleyball", "🏐", "Volleyball"], ["hockey", "🏒", "Hockey"], ["baseball", "⚾", "Baseball"], ["football", "🏈", "Football"], ["soccer", "⚽", "Soccer"], ["basketball", "🏀", "Basketball"], ["ufc", "🥊", "UFC"], ["f1", "🏎️", "F1"], ["skate", "🛹", "Skate"], ["golf", "⛳", "Golf"], ["bowling", "🎳", "Bowling"], ["drift", "💨", "Drift"], ["nascar", "🏁", "NASCAR"], ["moto", "🏍️", "MotoGP"], ["fencing", "🤺", "Fencing"], ["airsoft", "🎯", "Airsoft"], ["paintball", "🟡", "Paintball"], ["surf", "🏄", "Surfing"], ["discgolf", "🥏", "Disc Golf"], ["pickleball", "🏓", "Pickleball"], ["skydive", "🪂", "Skydiving"], ["kart", "🏎️", "Kart Racing"], ["flight", "✈️", "Flight"], ["tennis", "🎾", "Tennis"], ["fishing", "🎣", "Fishing"], ["chess", "♟️", "Chess & Checkers"], ["monster", "🛻", "Monster Truck"], ["waterpolo", "🤽", "Water Polo"], ["mx", "🏍️", "Motocross & BMX"], ["jetski", "🚤", "Jet Ski & Wakeboard"], ["archery", "🏹", "Archery"], ["ski", "⛷️", "Ski & Snowboard"], ["tabletennis", "🏓", "Table Tennis"], ["rocket", "🚀", "Rocket Soccer"], ["athletics", "🏃", "Track & Field"], ["weightlifting", "🏋️", "Weightlifting"], ["minigolf", "🏌️", "Mini Golf"]];
  const G=Object.fromEntries(GAMES.map(([p,i,n])=>[p,{i,n}]));
  const gname=p=>p==='home'||p==='index'?'the lobby':(G[p]?G[p].n:p);
  const gicon=p=>p==='home'||p==='index'?'🏠':(G[p]?G[p].i:'🎮');
  const pubId=w=>{ let h=2166136261; for(const c of String(w)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
  function pid(){ let p=ls.get('rrPid'); if(!p||p.length<8){ p=Array.from({length:12},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); ls.set('rrPid',p); } return p; }
  const myName=()=>ls.get('rrOnlineName')||'';
  function ensureName(){ let n=myName(); if(n) return n; n=prompt('Pick a name for your party:',''); if(n==null) return null; n=String(n).replace(/[<>]/g,'').trim().slice(0,20); if(!n) return null; ls.set('rrOnlineName',n); return n; }

  let code=(ls.get('rrParty')||'').toUpperCase(), ws=null, st=null, me=pid(), retry=0, pingT=0, open=false, lastMembers=null;
  const urlP=(qs.get('party')||'').toUpperCase(); let openOnJoin=false;
  if(/^[A-Z0-9]{4,8}$/.test(urlP)){ code=urlP; ls.set('rrParty',code); openOnJoin=true; }

  const css=document.createElement('style'); css.textContent=`
#rrpF{position:fixed;left:14px;bottom:14px;z-index:9990;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 14px;font:800 15px system-ui,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(135deg,rgba(124,58,237,.92),rgba(219,39,119,.92));box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 16px rgba(168,85,247,.45)}
#rrpF:hover{filter:brightness(1.1)} #rrpF.idle{background:rgba(15,23,42,.85);box-shadow:0 6px 18px rgba(0,0,0,.4)}
#rrpF.mini{width:40px;height:40px;padding:0;font-size:19px;opacity:.75} #rrpF.mini:hover{opacity:1}
#rrpP{position:fixed;left:14px;bottom:62px;z-index:9991;width:min(370px,calc(100vw - 28px));max-height:min(78vh,640px);overflow:auto;display:none;color:#e5e7eb;font:500 14px/1.4 system-ui,sans-serif;
  background:linear-gradient(170deg,#1a1033,#0b1022);border:1px solid rgba(168,85,247,.5);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 30px rgba(168,85,247,.25)}
#rrpP.on{display:block}
#rrpP header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:#170e2d;z-index:1}
#rrpP header b{font:900 20px 'Big Shoulders Display','Arial Narrow',sans-serif;letter-spacing:.04em;flex:1}
#rrpP header code{font:800 15px ui-monospace,monospace;color:#fde047;background:rgba(0,0,0,.35);border-radius:6px;padding:2px 7px;letter-spacing:.12em}
#rrpP .sec{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06)}
#rrpP h4{margin:0 0 7px;font:800 13px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#c4b5fd}
#rrpP button{font:700 13px system-ui,sans-serif;border:0;border-radius:9px;padding:6px 10px;cursor:pointer;color:#fff;background:rgba(255,255,255,.1)}
#rrpP button:hover{background:rgba(255,255,255,.18)} #rrpP button:disabled{opacity:.45;cursor:default}
#rrpP button.pri{background:linear-gradient(135deg,#7c3aed,#db2777)} #rrpP button.go{width:100%;padding:12px;font:900 20px 'Big Shoulders Display','Arial Narrow',sans-serif;letter-spacing:.06em;color:#111;background:linear-gradient(135deg,#fde047,#f59e0b);box-shadow:0 0 18px rgba(251,191,36,.45)}
#rrpP .x{background:none;font-size:18px;padding:2px 8px}
#rrpP .mrow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:5px}
#rrpP .mrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
#rrpP .mrow small{color:#94a3b8;font-weight:500} #rrpP .dot{width:8px;height:8px;border-radius:50%;background:#64748b;flex:none} #rrpP .dot.on{background:#4ade80;box-shadow:0 0 8px #4ade80}
#rrpP select,#rrpP input{width:100%;background:#0b1022;color:#fff;border:1px solid #3b2a63;border-radius:9px;padding:8px 9px;font:600 14px system-ui,sans-serif}
#rrpP .tally{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
#rrpP .tally span{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.4);color:#fde68a;border-radius:999px;padding:3px 9px;font-size:13px}
#rrpP .tally span.top{background:rgba(251,191,36,.3);color:#fff}
#rrpP .row{display:flex;gap:6px;align-items:center}
#rrpP .log{max-height:130px;overflow:auto;margin-bottom:6px;font-size:13px}
#rrpP .log div{padding:2px 0} #rrpP .log b{color:#f0abfc}
#rrpP .mut{color:#94a3b8;font-size:13px}
#rrpT{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:100001;background:#1a1033;color:#fff;border:1px solid rgba(168,85,247,.6);border-radius:12px;padding:10px 16px;font:700 15px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none}
#rrpGo{position:fixed;inset:0;z-index:100002;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 45%,rgba(124,58,237,.55),rgba(3,4,12,.95) 65%);color:#fff;text-align:center;font-family:'Big Shoulders Display','Arial Narrow',sans-serif}
#rrpGo .ic{font-size:96px;animation:rrpPop .5s ease} #rrpGo b{font-size:56px;font-weight:900;letter-spacing:.03em} #rrpGo span{font:600 18px system-ui,sans-serif;color:#e9d5ff}
@keyframes rrpPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}`;
  (document.head||document.documentElement).appendChild(css);

  let fab, panel, toastT;
  function ui(){ if(fab) return; fab=document.createElement('button'); fab.id='rrpF'; fab.type='button'; fab.addEventListener('click',()=>toggle()); fab.addEventListener('keydown',e=>e.stopPropagation());
    panel=document.createElement('div'); panel.id='rrpP'; panel.addEventListener('keydown',e=>e.stopPropagation());
    document.body.appendChild(panel); document.body.appendChild(fab); render(); }
  function toast(t){ let d=document.getElementById('rrpT'); if(!d){ d=document.createElement('div'); d.id='rrpT'; document.body.appendChild(d); } d.textContent=t; d.style.display='block'; clearTimeout(toastT); toastT=setTimeout(()=>d.style.display='none',3500); }
  function toggle(on){ open=on==null?!open:on; if(panel) panel.classList.toggle('on',open); if(open) render(); }

  function connect(){ if(OFF||!code) return; try{ ws&&ws.close(); }catch(e){}
    const sock=new WebSocket(SERVER+'/party/'+code); ws=sock;
    sock.onopen=()=>{ retry=0; sock.send(JSON.stringify({t:'hello',pid:me,name:myName()||'Player',page:PAGE})); clearInterval(pingT); pingT=setInterval(()=>{ if(sock.readyState===1) sock.send('{"t":"ping"}'); },25000); };
    sock.onmessage=ev=>{ let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
      if(m.t==='state'){ announce(m); st=m; render(); if(openOnJoin){ openOnJoin=false; toggle(true); } }
      else if(m.t==='go') launch(m.game,m.by);
      else if(m.t==='full'){ toast('That party is full (8 max).'); drop(); }
      else if(m.t==='kicked'){ toast('You were removed from the party.'); drop(); }
      else if(m.t==='gone'){ drop(); }
      else if(m.t==='sys') toast(m.text); };
    sock.onclose=()=>{ clearInterval(pingT); if(ws===sock&&code){ retry=Math.min(retry+1,6); setTimeout(()=>{ if(ws===sock&&code) connect(); },800*retry*retry); } }; }
  function tx(o){ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); }
  function announce(n){ if(lastMembers){ const was=new Set(lastMembers.map(x=>x.pid)); for(const x of n.members) if(!was.has(x.pid)&&x.pid!==me) toast('🎉 '+x.name+' joined the party'); } lastMembers=n.members; }
  function drop(){ code=''; ls.del('rrParty'); st=null; lastMembers=null; const s=ws; ws=null; try{ s&&s.close(); }catch(e){} render(); }

  function newCode(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return 'P'+Array.from({length:4},()=>A[Math.floor(Math.random()*A.length)]).join(''); }
  function create(){ if(!ensureName()) return; if(code) leave(true); code=newCode(); ls.set('rrParty',code); lastMembers=null; connect(); toggle(true); }
  function join(c){ c=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(!/^[A-Z0-9]{4,8}$/.test(c)){ toast('That code doesn\'t look right.'); return; } if(!ensureName()) return; if(code&&code!==c) leave(true); code=c; ls.set('rrParty',code); lastMembers=null; connect(); toggle(true); }
  function leave(quiet){ tx({t:'leave'}); drop(); if(!quiet) toast('You left the party.'); }

  const keep=()=>qs.get('server')?'&server='+encodeURIComponent(qs.get('server')):'';  /* carries a test server override along */
  function launch(game,by){ if(!G[game]) return; if(game===PAGE&&(qs.get('room')||'').toUpperCase()===code) return;
    const d=document.createElement('div'); d.id='rrpGo'; d.innerHTML=`<div class="ic">${gicon(game)}</div><b>${esc(gname(game).toUpperCase())}</b><span>${esc(by||'Your party')} hit GO. Launching the party…</span>`; document.body.appendChild(d);
    setTimeout(()=>{ location.href=`${game}?room=${encodeURIComponent(code)}${keep()}`; },1400); }

  function tally(){ const c={}; if(st) for(const [p,g] of Object.entries(st.votes||{})) (c[g]=c[g]||[]).push(p); return c; }
  function topPick(){ const c=tally(), e=Object.entries(c).sort((a,b)=>b[1].length-a[1].length); if(!e.length) return null; const best=e[0][1].length, tied=e.filter(x=>x[1].length===best).map(x=>x[0]); const lv=st&&st.votes&&st.votes[st.leader]; return tied.includes(lv)?lv:tied[0]; }

  function render(){ if(!fab) return; const n=st?st.members.length:0, on=st?st.members.filter(m=>m.on).length:0;
    const home=PAGE==='home'||PAGE==='index';  /* inside a game, stay a small round button until you're in a party */
    fab.className=code?'':(home?'idle':'idle mini'); fab.title='Party up with friends'; fab.textContent=code?(st?`🎉 ${on}/${n}`:'🎉…'):(home?'🎉 Party':'🎉');
    if(!open) return;
    if(!code){ panel.innerHTML=`<header><b>🎉 PARTY UP</b><button class="x" data-a="close" aria-label="Close">✕</button></header>
      <div class="sec"><p style="margin:0 0 10px">Team up with friends, vote on a game, then launch into it together. Works from the lobby or inside any game.</p><button class="pri" data-a="create" style="width:100%;padding:11px;font-size:15px">Create a party</button></div>
      <div class="sec"><h4>Join a friend's party</h4><div class="row"><input data-i="code" placeholder="Party code, e.g. P7K2Q" maxlength="8"><button data-a="join">Join</button></div></div>`;
      wire(); return; }
    if(!st){ panel.innerHTML=`<header><b>🎉 PARTY</b><code>${esc(code)}</code><button class="x" data-a="close">✕</button></header><div class="sec mut">Connecting to the party…</div>`; wire(); return; }
    const amLeader=st.leader===me, leaderOn=st.members.some(m=>m.pid===st.leader&&m.on), canGo=amLeader||!leaderOn, leaderName=(st.members.find(m=>m.pid===st.leader)||{}).name||'the leader';
    const t=tally(), pick=topPick(), myVote=(st.votes||{})[me]||'';
    const names=Object.fromEntries(st.members.map(m=>[m.pid,m.name]));
    const mem=st.members.map(m=>`<div class="mrow"><span class="dot ${m.on?'on':''}"></span><span class="nm">${m.pid===st.leader?'👑 ':''}${esc(m.name)}${m.pid===me?' (you)':''}<br><small>${m.on?gicon(m.page)+' in '+esc(gname(m.page)):'away'}</small></span>${amLeader&&m.pid!==me?`<button data-a="promote" data-p="${esc(m.pid)}" title="Make leader">👑</button><button data-a="kick" data-p="${esc(m.pid)}" title="Remove">✕</button>`:''}</div>`).join('');
    const opts='<option value="">— vote for a game —</option>'+GAMES.map(([p,i,nm])=>`<option value="${p}"${p===myVote?' selected':''}>${i} ${esc(nm)}</option>`).join('');
    const tl=Object.entries(t).sort((a,b)=>b[1].length-a[1].length).map(([g,ps])=>`<span class="${g===pick?'top':''}" title="${esc(ps.map(p=>names[p]||'?').join(', '))}">${gicon(g)} ${esc(gname(g))} ×${ps.length}</span>`).join('');
    const roster=(window.RRC&&RRC.roster)||[], inParty=new Set(st.members.map(m=>pubId(m.pid)));
    const inv=roster.filter(p=>!p.me&&!inParty.has(p.id)).slice(0,12);
    const lastGo=st.launch&&Date.now()-st.launch.ts<15*60000&&st.launch.game!==PAGE?`<div class="row" style="margin-top:8px"><span class="mut" style="flex:1">Party is playing ${gicon(st.launch.game)} ${esc(gname(st.launch.game))}</span><button data-a="rejoin">Join them ▸</button></div>`:'';
    const chat=(st.chat||[]).map(c=>`<div><b>${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('')||'<div class="mut">Say hi to your party 👋</div>';
    panel.innerHTML=`<header><b>🎉 PARTY</b><code title="Party code">${esc(code)}</code><button data-a="link" title="Copy invite link">🔗</button><button class="x" data-a="close" aria-label="Close">✕</button></header>
      <div class="sec"><h4>Members (${n}/8)</h4>${mem}</div>
      <div class="sec"><h4>🎮 What are we playing?</h4><select data-i="vote">${opts}</select><div class="tally">${tl||'<span class="mut" style="border:0;background:none;color:#94a3b8;padding:0">No votes yet. Everyone pick a game!</span>'}</div>
        ${canGo?`<button class="go" data-a="go" ${pick?'':'disabled'}>▶ GO${pick?': '+esc(gname(pick).toUpperCase()):''}</button>${!amLeader?'<div class="mut" style="margin-top:6px">The leader is away, so you can launch.</div>':''}`:`<div class="mut">Waiting for 👑 ${esc(leaderName)} to hit GO…</div>`}${lastGo}</div>
      <div class="sec"><h4>👋 Invite friends</h4>${inv.length?inv.map(p=>`<div class="mrow"><span class="dot on"></span><span class="nm">${esc(p.name)}<br><small>${gicon(p.game)} in ${esc(gname(p.game))}</small></span><button data-a="invite" data-id="${esc(p.id)}" data-nm="${esc(p.name)}">Invite</button></div>`).join(''):'<div class="mut">Nobody else is online right now. Share the code <b style="color:#fde047">'+esc(code)+'</b> or the 🔗 link.</div>'}</div>
      <div class="sec"><h4>💬 Party chat</h4><div class="log">${chat}</div><div class="row"><input data-i="msg" maxlength="160" placeholder="Message your party…"><button data-a="send">Send</button></div></div>
      <div class="sec" style="border:0"><button data-a="leave" style="width:100%;background:rgba(220,38,38,.25)">Leave party</button></div>`;
    wire(); const lg=panel.querySelector('.log'); if(lg) lg.scrollTop=lg.scrollHeight; }

  function wire(){ panel.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a,b));
    const v=panel.querySelector('[data-i="vote"]'); if(v) v.onchange=()=>tx({t:'vote',game:v.value});
    const msg=panel.querySelector('[data-i="msg"]'); if(msg) msg.onkeydown=e=>{ if(e.key==='Enter') act('send'); };
    const ci=panel.querySelector('[data-i="code"]'); if(ci) ci.onkeydown=e=>{ if(e.key==='Enter') act('join'); }; }
  function act(a,b){
    if(a==='close') toggle(false);
    else if(a==='create') create();
    else if(a==='join') join(panel.querySelector('[data-i="code"]').value);
    else if(a==='leave'){ if(confirm('Leave the party?')) leave(); }
    else if(a==='go'){ const g=topPick(); if(g) tx({t:'go',game:g}); }
    else if(a==='rejoin'&&st&&st.launch) location.href=`${st.launch.game}?room=${encodeURIComponent(code)}${keep()}`;
    else if(a==='kick'){ if(confirm('Remove them from the party?')) tx({t:'kick',pid:b.dataset.p}); }
    else if(a==='promote') tx({t:'promote',pid:b.dataset.p});
    else if(a==='send'){ const i=panel.querySelector('[data-i="msg"]'); const t=i.value.trim(); if(t){ tx({t:'chat',text:t}); i.value=''; } }
    else if(a==='link'){ const url=location.origin+'/?party='+code; (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('Invite link copied!'),()=>prompt('Copy this invite link:',url)); }
    else if(a==='invite'&&window.RRC){ b.disabled=true; b.textContent='Sent'; RRC.invite(b.dataset.id,'party',code,r=>{ toast(r&&r.ok?'Invite sent to '+(r.name||b.dataset.nm)+'!':(r&&r.why)||'Could not send the invite.'); }); } }

  addEventListener('rrc-who',()=>{ if(open&&code) render(); });
  window.RRPARTY={ open:()=>{ ui(); toggle(true); }, create, join, leave:()=>leave(), get code(){ return code; }, get state(){ return st; } };
  function boot(){ ui(); if(code) connect(); }
  if(document.body) boot(); else document.addEventListener('DOMContentLoaded',boot);
})();
