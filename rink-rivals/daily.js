/* Rink Rivals "Today" panel on the home page: today's top play times, your own play time,
   and the daily challenge. The winner (picked by the admin) chooses a prize here. */
(function(){ const el=document.getElementById('rrDaily'); if(!el||!window.RRSITE) return;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=s=>{ s=Math.round(s||0); const h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h?`${h}h ${m}m`:(m?`${m}m`:(s?'<1m':'0m')); };
  const MED=['🥇','🥈','🥉'];
  const css=document.createElement('style'); css.textContent=`
#rrDaily{display:grid;grid-template-columns:1.15fr .8fr 1.25fr;gap:14px;margin-top:18px}
#rrDaily .dx{background:var(--panel,#111a33);border:1px solid var(--line,#24305a);border-radius:20px;padding:16px 18px;position:relative;overflow:hidden}
#rrDaily h3{margin:0 0 10px;font-size:24px;font-weight:900;letter-spacing:.01em}
#rrDaily ol{list-style:none;margin:0;padding:0}
#rrDaily li{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:10px;font-size:19px}
#rrDaily li:nth-child(odd){background:rgba(255,255,255,.04)}
#rrDaily li .r{width:30px;text-align:center;color:#93a0bd}
#rrDaily li b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#rrDaily li span{color:#fbbf24;font-weight:800}
#rrDaily li.me{outline:2px solid #6366f1}
#rrDaily .mut{color:#93a0bd;font:500 14px/1.45 system-ui,sans-serif}
#rrDaily .big{font-size:58px;font-weight:900;line-height:1;margin:6px 0 4px;background:linear-gradient(90deg,#fbbf24,#f97316);-webkit-background-clip:text;background-clip:text;color:transparent}
#rrDaily .rank{font-size:20px;margin-bottom:8px}
#rrDaily .chal{background:linear-gradient(135deg,rgba(124,58,237,.35),rgba(14,165,233,.25));border-color:rgba(167,139,250,.45)}
#rrDaily .goal{font-size:25px;font-weight:900;line-height:1.1;margin:2px 0 8px}
#rrDaily .gm{display:inline-block;background:rgba(0,0,0,.3);border-radius:999px;padding:2px 11px;font-size:15px;margin-bottom:6px}
#rrDaily .pz{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}
#rrDaily .pz i{font-style:normal;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.45);color:#fde68a;border-radius:999px;padding:3px 10px;font-size:15px}
#rrDaily .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#rrDaily button,#rrDaily a.b{border:0;cursor:pointer;border-radius:12px;padding:10px 16px;font:800 18px var(--font,'Arial Narrow',sans-serif);letter-spacing:.02em;text-decoration:none;color:#111;background:linear-gradient(135deg,#fde047,#f59e0b)}
#rrDaily a.b.g,#rrDaily button.g{color:#fff;background:rgba(255,255,255,.14)}
#rrDaily button.pk{background:linear-gradient(135deg,#86efac,#22c55e);color:#052e16}
#rrDaily .ok{color:#86efac;font-size:19px}
#rrDaily .win{font-size:21px;margin-top:6px}
@media(max-width:1100px){#rrDaily{grid-template-columns:1fr 1fr}#rrDaily .chal{grid-column:1/-1}}
@media(max-width:640px){#rrDaily{grid-template-columns:1fr}#rrDaily .big{font-size:46px}}`;
  document.head.appendChild(css);

  let last=null;
  async function load(){ const d=await RRSITE.daily('get'); if(!d){ if(!last) el.style.display='none'; return; } last=d; el.style.display=''; render(d); }
  function needName(){ let n=null; try{ n=localStorage.getItem('rrOnlineName'); }catch(e){} if(n) return n;
    n=prompt('Your name (shown on the leaderboard):',''); if(n==null) return null; n=String(n).replace(/[<>]/g,'').trim().slice(0,20); if(!n) return null; try{ localStorage.setItem('rrOnlineName',n); }catch(e){} return n; }

  function render(d){
    const myName=(()=>{ try{ return localStorage.getItem('rrOnlineName')||''; }catch(e){ return ''; } })();
    const board=d.board.length?`<ol>${d.board.map((x,i)=>`<li class="${x.name===myName?'me':''}"><span class="r">${MED[i]||('#'+(i+1))}</span><b>${esc(x.name)}</b><span>${fmt(x.s)}</span></li>`).join('')}</ol>`
      :'<p class="mut">Nobody has played yet today — start a game to take #1!</p>';
    const yTop=d.yTop?`<p class="mut" style="margin-top:8px">Yesterday's #1: <b style="color:#eef2fb">${esc(d.yTop.name)}</b> (${fmt(d.yTop.s)})</p>`:'';
    const mine=`<div class="big">${fmt(d.mine.s)}</div><div class="rank">${d.mine.rank?`#${d.mine.rank} of ${d.mine.players} today`:'Not on the board yet'}</div><p class="mut">Play time counts while you're playing any game here. Resets every night at midnight.</p>`;
    el.innerHTML=`<div class="dx"><h3>⏱️ Today's top players</h3>${board}${yTop}</div>
      <div class="dx"><h3>🙋 You today</h3>${mine}</div>
      <div class="dx chal"><h3>🎯 Daily challenge</h3>${chalHTML(d)}</div>`;
    wire(d); }

  function chalHTML(d){ const c=d.chal;
    if(!c){ const lc=d.lastChal; return `<p class="mut" style="font-size:16px">No challenge yet today — check back soon!</p>`+(lc?`<p class="mut" style="margin-top:10px">Last challenge: <b style="color:#eef2fb">${esc(lc.goal)}</b>${lc.game?` in ${esc(lc.game)}`:''}${lc.winner?` — won by <b style="color:#fbbf24">${esc(lc.winner)}</b>${lc.prize?` (${esc(lc.prize)})`:''}`:''}</p>`:''); }
    let html=`${c.game?`<span class="gm">${esc(c.game)}</span>`:''}<div class="goal">${esc(c.goal)}</div>
      <div class="mut">Winner picks one prize:</div><div class="pz">${c.prizes.map(p=>`<i>🎁 ${esc(p)}</i>`).join('')}</div>`;
    if(c.youWon&&!c.prize) html+=`<div class="win">🏆 <b>You won!</b> Pick your prize:</div><div class="row" style="margin-top:8px">${c.prizes.map((p,i)=>`<button class="pk" data-pk="${i}">${esc(p)}</button>`).join('')}</div>`;
    else if(c.youWon&&c.prize) html+=`<div class="win">🏆 You won and chose <b>${esc(c.prize)}</b> — <span class="ok">awarded!</span></div>`;
    else if(c.winner) html+=`<div class="win">🏆 Winner: <b style="color:#fbbf24">${esc(c.winner)}</b>${c.prize?` — chose ${esc(c.prize)}`:''}</div>`;
    else if(c.claimed) html+=`<div class="ok">✓ Submitted! The admin will check and pick today's winner.</div>${c.page?`<div class="row" style="margin-top:8px"><a class="b g" href="${esc(c.page)}">Go to game ▸</a></div>`:''}`;
    else html+=`<div class="row"><button data-claim="1">✅ I did it!</button>${c.page?`<a class="b g" href="${esc(c.page)}">Go to game ▸</a>`:''}</div>${c.claims?`<p class="mut" style="margin-top:8px">${c.claims} player${c.claims===1?'':'s'} say they've done it.</p>`:''}`;
    return html; }

  function wire(d){ const cb=el.querySelector('[data-claim]'); if(cb) cb.onclick=async()=>{ if(!needName()) return; cb.disabled=true; cb.textContent='Sending…'; await RRSITE.daily('claim'); load(); };
    el.querySelectorAll('[data-pk]').forEach(b=>b.onclick=async()=>{ if(!confirm(`Choose "${b.textContent}" as your prize?`)) return; b.disabled=true; await RRSITE.daily('pick',{i:+b.dataset.pk}); load(); }); }

  load(); setInterval(()=>{ if(document.visibilityState==='visible') load(); },60000);
})();
