/* Rink Rivals online score battles for the solo games.
   Everyone in the room plays the same course, conditions and random draws (one shared seed) at the same time,
   sees everyone's live score, and gets a results table at the end. Games can also draw the others as ghosts.
   A game calls RRV.attach({game, blurb, better:'high'|'low', opts:()=>settings, start(opts), state:()=>({v,txt,done,pos})}). */
(function(){
  let cfg=null, api=null, on=false, them={}, lastSend=0, panel=null, res=null, myDone=false, origRandom=Math.random, iv=null, meState=null;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const COLS=['#38bdf8','#f97316','#a3e635','#f472b6'];
  function seeded(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const css=`#rrvP{position:fixed;left:10px;top:50%;transform:translateY(-50%);z-index:9000;background:rgba(10,15,30,.88);color:#eef2fb;border:2px solid #27345a;border-radius:12px;padding:8px 10px;font:800 15px 'Big Shoulders Display','Arial Narrow',sans-serif;min-width:150px;pointer-events:none}
#rrvP h4{margin:0 0 4px;font-size:13px;color:#93a0bd;text-transform:uppercase;letter-spacing:.06em} #rrvP div{display:flex;justify-content:space-between;gap:10px;padding:2px 0} #rrvP i{font-style:normal;color:#93a0bd;font-size:12px}
#rrvR{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;background:rgba(5,8,18,.72);font-family:'Big Shoulders Display','Arial Narrow',sans-serif}
#rrvR .box{background:#141c33;color:#eef2fb;border:2px solid #fbbf24;border-radius:16px;padding:18px 22px;width:min(440px,92vw)} #rrvR h2{margin:0 0 8px;font-size:32px} #rrvR ol{font-size:22px;padding-left:26px} #rrvR li{margin:4px 0}
#rrvR button{font:inherit;font-size:18px;font-weight:800;padding:8px 14px;border-radius:999px;border:2px solid #27345a;background:#1e293b;color:#fff;cursor:pointer;margin:6px 6px 0 0} #rrvR button.gold{background:#fbbf24;color:#111;border-color:#fbbf24}`;
  function addCss(){ if(document.getElementById('rrvCss')) return; const st=document.createElement('style'); st.id='rrvCss'; st.textContent=css; document.head.appendChild(st); }
  const colOf=id=>{ const all=api.all(); const i=all.findIndex(p=>p.id===id); return COLS[(i<0?0:i)%COLS.length]; };
  function rows(){ const out=[]; if(!api||!api.me) return out; out.push({id:api.me.id,name:api.me.name,me:true,...(meState||{})}); for(const p of api.peers){ out.push({id:p.id,name:p.name,...(them[p.id]||{})}); } return out; }
  function rank(rs){ const hi=cfg.better!=='low'; return rs.slice().sort((a,b)=>{ const av=a.v==null?(hi?-1e9:1e9):a.v, bv=b.v==null?(hi?-1e9:1e9):b.v; return hi?bv-av:av-bv; }); }
  function drawPanel(){ if(!on) return; if(!panel){ addCss(); panel=document.createElement('div'); panel.id='rrvP'; document.body.appendChild(panel); }
    const h=`<h4>Online · ${esc(cfg.title||'score battle')}</h4>`+rank(rows()).map(r=>`<div style="color:${colOf(r.id)}"><span>${r.done?'🏁 ':''}${esc(r.name)}${r.me?' (you)':''}</span><span>${esc(r.txt==null?'…':r.txt)}</span></div>`).join('')+(myDone&&rows().some(r=>!r.done)?'<i>waiting for the others to finish</i>':'');
    if(panel.innerHTML!==h) panel.innerHTML=h; }
  function tick(){ if(!on||!cfg) return; let st=null; try{ st=cfg.state(); }catch(e){} if(!st) return; meState=st;
    const now=performance.now(); if(now-lastSend>(st.pos?120:300)||(st.done&&!myDone)){ lastSend=now; api.send({t:'vs',v:st.v,txt:st.txt,done:!!st.done,pos:st.pos||null}); }
    if(st.done&&!myDone){ myDone=true; } drawPanel(); checkEnd(); }
  function checkEnd(){ if(res||!on) return; const rs=rows(); if(rs.length<2&&!api.peers.length&&myDone){ showRes(rs); return; } if(rs.every(r=>r.done)) showRes(rs); }
  function showRes(rs){ addCss(); res=document.createElement('div'); res.id='rrvR'; const rk=rank(rs), host=api.isHost();
    res.innerHTML=`<div class="box"><h2>${rk[0]&&rk[0].me?'🏆 You win!':`🏆 ${esc(rk[0]?rk[0].name:'')} wins`}</h2><ol>${rk.map(r=>`<li style="color:${colOf(r.id)}">${esc(r.name)}${r.me?' (you)':''} · ${esc(r.txt||'-')}</li>`).join('')}</ol>
    ${host?'<button class="gold" id="rrvAgain">Play again</button>':'<p>The host can start a rematch.</p>'}<button id="rrvClose">Close</button><button id="rrvLeave">Leave online</button></div>`;
    res.addEventListener('keydown',e=>e.stopPropagation()); document.body.appendChild(res);
    if(host) res.querySelector('#rrvAgain').onclick=()=>{ const msg={t:'vsAgain',seed:Math.floor(Math.random()*1e9),opts:cfg.opts?cfg.opts():null}; api.send(msg); go(msg); };
    res.querySelector('#rrvClose').onclick=()=>{ res.remove(); };
    res.querySelector('#rrvLeave').onclick=()=>{ api.leave(); }; }
  function go(msg){ if(res){ res.remove(); } res=null; them={}; myDone=false; meState=null; on=true; Math.random=seeded(msg.seed>>>0);
    try{ cfg.start(msg.opts||{},msg); }catch(e){ console.error(e); } if(!iv) iv=setInterval(tick,100); drawPanel(); }
  function stop(){ on=false; Math.random=origRandom; if(panel){ panel.remove(); panel=null; } if(res){ res.remove(); res=null; } them={}; }
  window.RRV={ attach(c){ cfg=c; if(!window.RRO) return null;
      api=RRO.init({game:c.game,maxPlayers:c.maxPlayers||4,minPlayers:1,blurb:c.blurb||'Score battle: everyone plays the same course at the same time, best score wins.',getOpts:()=>c.opts?c.opts():null,
        onStart(msg){ go(msg); },
        onMsg(m){ if(m.t==='vs'){ them[m.from]=Object.assign(them[m.from]||{},{v:m.v,txt:m.txt,done:m.done,pos:m.pos,t:performance.now()}); drawPanel(); checkEnd(); }
          else if(m.t==='vsAgain') go(m); },
        onPeers(net,kind,m){ if(kind==='leave'){ delete them[m.id]; drawPanel(); checkEnd(); } else drawPanel(); },
        onEnd(){ stop(); c.onEnd&&c.onEnd(); } });
      return api; },
    get on(){ return on; },
    /* the other players, for games that draw them as ghosts: [{name,col,pos,age}] */
    ghosts(){ if(!on||!api) return []; return api.peers.filter(p=>them[p.id]&&them[p.id].pos).map(p=>({id:p.id,name:p.name,col:colOf(p.id),pos:them[p.id].pos,age:(performance.now()-them[p.id].t)/1000})); },
    mySeat(){ return api&&api.me?api.me.seat:0; }, players(){ return api?api.all():[]; },
    open(){ api&&api.open(); } };
})();
