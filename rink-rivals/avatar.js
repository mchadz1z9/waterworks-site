/* Rival Avatars: one character for the whole site. Drawn as a small SVG from a short code, so it can travel with chat messages.
   Your avatar is saved on this device (rrAvatar) and gear comes from what you've equipped in the Arcade Shop. */
(function(){
  if(window.RRAV) return;
  const SKIN=['#fde2c8','#f8d0a8','#eab58a','#d69a6c','#b97c50','#8d5a36','#6b4226','#4a2c18'];
  const HAIRC=['#1c1917','#3f2a1d','#6b4423','#a16207','#facc15','#fde68a','#dc2626','#f472b6','#38bdf8','#a78bfa','#e5e7eb','#16a34a'];
  const COL=['#ef4444','#f97316','#facc15','#22c55e','#14b8a6','#0ea5e9','#3b82f6','#6366f1','#a855f7','#ec4899','#f8fafc','#111827','#64748b','#7c2d12'];
  const BG=['#1e293b','#0c4a6e','#14532d','#4c1d95','#831843','#78350f','#0f766e','#1e1b4b','#3f3f46','#7f1d1d'];
  const N={hs:10,ey:6,mo:6,tp:5};
  const DEF={sk:2,hs:1,hc:0,ey:0,mo:0,tp:0,tc:5,pc:11,sh:10,bg:0,num:7,g:{}};
  const SLOTS=['head','face','neck','back','badge'];
  const clampI=(v,n,d)=>{ v=parseInt(v,10); return v>=0&&v<n?v:d; };
  /* shop colours can be plain hex or bright "glow" numbers (0-2.4); turn both into hex */
  const hex=c=>{ if(typeof c==='string') return /^#[0-9a-f]{3,8}$/i.test(c)?c:'#facc15'; if(Array.isArray(c)) return '#'+c.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v/2.4*255))).toString(16).padStart(2,'0')).join(''); return '#facc15'; };
  function norm(a){ a=Object.assign({},DEF,a||{}); return {sk:clampI(a.sk,SKIN.length,2),hs:clampI(a.hs,N.hs,1),hc:clampI(a.hc,HAIRC.length,0),ey:clampI(a.ey,N.ey,0),mo:clampI(a.mo,N.mo,0),tp:clampI(a.tp,N.tp,0),tc:clampI(a.tc,COL.length,5),pc:clampI(a.pc,COL.length,11),sh:clampI(a.sh,COL.length,10),bg:clampI(a.bg,BG.length,0),num:clampI(a.num,100,7),g:Object.assign({},a.g||{})}; }
  function load(){ try{ return norm(JSON.parse(localStorage.getItem('rrAvatar')||'null')); }catch(e){ return norm(null); } }
  function save(a){ try{ localStorage.setItem('rrAvatar',JSON.stringify(norm(a))); localStorage.setItem('rrAvatarSet','1'); }catch(e){} try{ dispatchEvent(new CustomEvent('rr-avatar')); }catch(e){} }
  /* the current gear from the shop (only items you own and have equipped) */
  function gearNow(){ const g={}; try{ if(window.RRCOIN&&RRCOIN.eqKey) for(const s of SLOTS){ const k=RRCOIN.eqKey(s); if(k) g[s]=k; } }catch(e){} return g; }
  /* short code: a1.sk.hs.hc.ey.mo.tp.tc.pc.sh.bg.num~headKey,faceKey,neckKey,backKey,badgeKey */
  function code(a){ a=norm(a||load()); const g=Object.keys(a.g||{}).length?a.g:gearNow(); return 'a1.'+[a.sk,a.hs,a.hc,a.ey,a.mo,a.tp,a.tc,a.pc,a.sh,a.bg,a.num].join('.')+'~'+SLOTS.map(s=>(g[s]||'').replace(/[^a-z0-9_]/gi,'').slice(0,20)).join(','); }
  function decode(c){ const m=String(c||'').match(/^a1\.([0-9.]+)~([a-z0-9_,]*)$/i); if(!m) return null; const v=m[1].split('.'); const ks=m[2].split(',');
    const a=norm({sk:v[0],hs:v[1],hc:v[2],ey:v[3],mo:v[4],tp:v[5],tc:v[6],pc:v[7],sh:v[8],bg:v[9],num:v[10]}); a.g={}; SLOTS.forEach((s,i)=>{ if(ks[i]) a.g[s]=ks[i]; }); return a; }
  const itemVal=k=>{ try{ const it=window.RRCOIN&&RRCOIN.itemOf?RRCOIN.itemOf(k):null; return it?(it.val||it.ic):null; }catch(e){ return null; } };
  let uid=0;
  /* full=true: whole body (100x130); full=false: head and shoulders for chat (100x100) */
  function svg(a,full){ a=typeof a==='string'?(decode(a)||norm(null)):norm(a); const id='av'+(++uid), sk=SKIN[a.sk], hc=HAIRC[a.hc], tc=COL[a.tc], pc=COL[a.pc], shc=COL[a.sh];
    const dark=c=>{ const n=parseInt(c.slice(1),16); const f=x=>Math.max(0,Math.round(x*.72)); return '#'+[f(n>>16&255),f(n>>8&255),f(n&255)].map(x=>x.toString(16).padStart(2,'0')).join(''); };
    const light=c=>{ const n=parseInt(c.slice(1),16); return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))>170; };
    const G=a.g||{}, back=G.back?itemVal(G.back):null, neck=G.neck?itemVal(G.neck):null, face=G.face?itemVal(G.face):null, head=G.head?itemVal(G.head):null, badge=G.badge?itemVal(G.badge):null;
    const o=[]; const vb=full?'0 0 100 130':'10 6 80 80';
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" class="rrav" aria-hidden="true">`);
    o.push(`<rect x="-10" y="-10" width="130" height="160" fill="${BG[a.bg]}"/>`);
    if(back&&typeof back==='object') o.push(`<path d="M30 56 Q50 50 70 56 L80 ${full?122:96} Q50 ${full?128:100} 20 ${full?122:96} Z" fill="${hex(back.c)}"/><path d="M30 56 Q50 52 70 56 L72 62 Q50 58 28 62 Z" fill="${hex(back.c2||back.c)}"/>`);
    /* back hair */
    if([2,4,6,8].includes(a.hs)) o.push(`<path d="M27 34 Q26 ${a.hs===8?70:a.hs===4?62:56} 34 ${a.hs===8?74:a.hs===4?66:58} L66 ${a.hs===8?74:a.hs===4?66:58} Q74 ${a.hs===8?70:a.hs===4?62:56} 73 34 Z" fill="${hc}"/>`);
    if(full){ o.push(`<rect x="38" y="96" width="10" height="24" rx="3" fill="${pc}"/><rect x="52" y="96" width="10" height="24" rx="3" fill="${pc}"/><rect x="35" y="118" width="14" height="7" rx="3" fill="${shc}"/><rect x="51" y="118" width="14" height="7" rx="3" fill="${shc}"/>`); }
    /* body + arms */
    const sleeve=a.tp===3?sk:tc;
    o.push(`<rect x="22" y="${full?60:62}" width="12" height="${full?34:30}" rx="6" fill="${sleeve}"/><rect x="66" y="${full?60:62}" width="12" height="${full?34:30}" rx="6" fill="${sleeve}"/>`);
    if(full) o.push(`<circle cx="28" cy="96" r="5" fill="${sk}"/><circle cx="72" cy="96" r="5" fill="${sk}"/>`);
    o.push(`<path d="M30 60 Q50 54 70 60 L70 ${full?100:96} L30 ${full?100:96} Z" fill="${tc}"/>`);
    if(a.tp===1) o.push(`<path d="M34 58 Q50 70 66 58 Q62 54 50 54 Q38 54 34 58 Z" fill="${dark(tc)}"/><rect x="40" y="80" width="20" height="10" rx="3" fill="${dark(tc)}"/>`);
    if(a.tp===2){ o.push(`<path d="M30 60 L34 60 L34 ${full?100:96} L30 ${full?100:96} Z M66 60 L70 60 L70 ${full?100:96} L66 ${full?100:96} Z" fill="#fff" opacity=".85"/><text x="50" y="86" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="17" text-anchor="middle" fill="${light(tc)?'#111827':'#fff'}" stroke="${light(tc)?'#fff':dark(tc)}" stroke-width="1">${a.num}</text>`); }
    if(a.tp===4) o.push(`<rect x="49" y="60" width="2" height="${full?40:36}" fill="${dark(tc)}"/><path d="M38 58 L50 68 L62 58" fill="none" stroke="${dark(tc)}" stroke-width="3"/>`);
    if(a.tp===0||a.tp===3) o.push(`<path d="M42 58 Q50 64 58 58" fill="none" stroke="${dark(tc)}" stroke-width="2"/>`);
    /* neck item */
    if(neck&&typeof neck==='object') o.push(`<path d="M40 60 Q50 70 60 60" fill="none" stroke="${hex(neck.c)}" stroke-width="3"/><circle cx="50" cy="68" r="3" fill="${hex(neck.c2||neck.c)}"/>`);
    /* head */
    o.push(`<rect x="45" y="50" width="10" height="10" fill="${dark(sk)}"/><ellipse cx="29" cy="38" rx="4" ry="6" fill="${sk}"/><ellipse cx="71" cy="38" rx="4" ry="6" fill="${sk}"/><circle cx="50" cy="36" r="21" fill="${sk}"/>`);
    /* eyes */
    const E=[`<circle cx="42" cy="37" r="3" fill="#111"/><circle cx="58" cy="37" r="3" fill="#111"/><circle cx="43" cy="36" r="1" fill="#fff"/><circle cx="59" cy="36" r="1" fill="#fff"/>`,
      `<ellipse cx="42" cy="37" rx="3.5" ry="4.5" fill="#111"/><ellipse cx="58" cy="37" rx="3.5" ry="4.5" fill="#111"/><circle cx="43.2" cy="35.5" r="1.4" fill="#fff"/><circle cx="59.2" cy="35.5" r="1.4" fill="#fff"/>`,
      `<path d="M38 38 Q42 34 46 38" stroke="#111" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M54 38 Q58 34 62 38" stroke="#111" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      `<circle cx="42" cy="37" r="3" fill="#111"/><path d="M54 37 L62 37" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`,
      `<circle cx="42" cy="37" r="4" fill="#fff" stroke="#111" stroke-width="1.2"/><circle cx="58" cy="37" r="4" fill="#fff" stroke="#111" stroke-width="1.2"/><circle cx="42" cy="38" r="2" fill="#111"/><circle cx="58" cy="38" r="2" fill="#111"/>`,
      `<path d="M38 35 L46 39 M46 35 L38 39 M54 35 L62 39 M62 35 L54 39" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>`][a.ey];
    o.push(E); o.push(`<path d="M38 31 L45 30 M55 30 L62 31" stroke="${dark(hc)}" stroke-width="2" stroke-linecap="round"/>`);
    const M=[`<path d="M43 46 Q50 51 57 46" stroke="#7c2d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      `<path d="M42 45 Q50 54 58 45 Z" fill="#7f1d1d"/><path d="M44 46 L56 46 L55 48 L45 48 Z" fill="#fff"/>`,
      `<path d="M44 47 L56 47" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round"/>`,
      `<ellipse cx="50" cy="47" rx="3.5" ry="4" fill="#7f1d1d"/>`,
      `<path d="M43 46 Q50 51 57 46" stroke="#7c2d12" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M50 49 Q53 54 56 49" fill="#f87171"/>`,
      `<path d="M43 48 Q50 44 57 48" stroke="#7c2d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>`][a.mo];
    o.push(M); o.push(`<circle cx="37" cy="44" r="3" fill="#f87171" opacity=".25"/><circle cx="63" cy="44" r="3" fill="#f87171" opacity=".25"/>`);
    /* front hair */
    const H=[``,`<path d="M29 32 Q30 13 50 13 Q70 13 71 32 Q62 22 50 24 Q38 22 29 32 Z" fill="${hc}"/>`,
      `<path d="M28 34 Q28 12 50 12 Q72 12 72 34 Q66 22 56 22 Q48 30 36 26 Q31 29 28 34 Z" fill="${hc}"/>`,
      `<path d="M30 30 L34 14 L40 24 L46 10 L52 22 L58 10 L62 24 L68 14 L70 30 Q50 20 30 30 Z" fill="${hc}"/>`,
      `<path d="M28 36 Q27 12 50 12 Q73 12 72 36 Q68 20 50 22 Q34 20 28 36 Z" fill="${hc}"/>`,
      `<circle cx="50" cy="14" r="8" fill="${hc}"/><path d="M29 32 Q30 15 50 15 Q70 15 71 32 Q60 24 50 25 Q40 24 29 32 Z" fill="${hc}"/>`,
      `<path d="M29 31 Q30 14 50 14 Q70 14 71 31 Q50 26 29 31 Z" fill="${hc}"/><path d="M44 14 Q50 4 56 14" fill="${hc}"/>`,
      `<path d="M30 30 Q34 20 50 18 Q66 20 70 30 Q50 24 30 30 Z" fill="${hc}" opacity=".9"/>`,
      `<path d="M27 38 Q26 12 50 12 Q74 12 73 38 Q70 22 58 20 Q52 28 40 24 Q30 28 27 38 Z" fill="${hc}"/>`,
      `<path d="M28 33 Q29 11 50 11 Q71 11 72 33 L68 26 L64 31 L60 24 L55 30 L50 23 L45 30 L40 24 L36 31 L32 26 Z" fill="${hc}"/>`][a.hs];
    o.push(H);
    /* face item */
    if(face) o.push(`<rect x="35" y="33" width="13" height="8" rx="3" fill="${hex(face.c||'#0a0a0a')}"/><rect x="52" y="33" width="13" height="8" rx="3" fill="${hex(face.c||'#0a0a0a')}"/><rect x="47" y="35" width="6" height="2" fill="${hex(face.c||'#0a0a0a')}"/><rect x="37" y="34" width="4" height="2" fill="#fff" opacity=".4"/>`);
    /* head item */
    if(head&&typeof head==='object'){ const c=hex(head.c), c2=hex(head.c2||head.c);
      if(head.t==='cap') o.push(`<path d="M28 30 Q30 12 50 12 Q70 12 72 30 Z" fill="${c}"/><path d="M50 27 Q66 25 80 30 Q68 33 50 31 Z" fill="${c2}"/><circle cx="50" cy="13" r="2" fill="${c2}"/>`);
      else if(head.t==='crown') o.push(`<path d="M32 22 L34 8 L42 16 L50 5 L58 16 L66 8 L68 22 Z" fill="${c}" stroke="#a16207" stroke-width="1"/><circle cx="50" cy="15" r="2" fill="#ef4444"/><circle cx="40" cy="18" r="1.6" fill="#3b82f6"/><circle cx="60" cy="18" r="1.6" fill="#22c55e"/>`);
      else o.push(`<rect x="28" y="24" width="44" height="6" rx="3" fill="${c}"/>`); }
    if(badge&&typeof badge==='string') o.push(`<text x="${full?64:63}" y="${full?78:80}" font-size="11" text-anchor="middle">${badge.replace(/[<>&]/g,'')}</text>`);
    o.push('</svg>'); return o.join(''); }
  const mini=(c)=>svg(typeof c==='string'?c:(c||load()),false);
  window.RRAV={ load, save, code, decode, svg, mini, gearNow, SKIN, HAIRC, COL, BG, N, SLOTS, isSet:()=>{ try{ return localStorage.getItem('rrAvatarSet')==='1'; }catch(e){ return false; } } };
  /* chat may connect before this file loads: send the avatar as soon as both are ready */
  { let n=0; const push=()=>{ if(!window.RRAV.isSet()) return; if(window.RRC&&RRC.ready&&RRC.setAv){ RRC.setAv(code()); return; } if(++n<30) setTimeout(push,1000); }; setTimeout(push,800); }
})();
