/* Rink Rivals arcade covers: each game gets a stadium-lit crest with big chrome / gold lettering,
   drawn as an SVG so there are no image files to load. RRARC.cover({...}) returns the SVG markup. */
(function(){ if(window.RRARC) return;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hx=c=>{ c=String(c||'#334155').replace('#',''); if(c.length===3) c=c.split('').map(x=>x+x).join(''); const n=parseInt(c,16)||0; return [n>>16&255,n>>8&255,n&255]; };
  const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  const mix=(a,b,t)=>{ const x=hx(a), y=hx(b); return toHex(x.map((v,i)=>v+(y[i]-v)*t)); };
  const lum=c=>{ const [r,g,b]=hx(c); return (r*.299+g*.587+b*.114)/255; };
  function hash(s){ let h=2166136261; for(const ch of String(s)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
  function rng(seed){ let s=seed||1; return ()=>{ s=Math.imul(s^s>>>15,1|s); s^=s+Math.imul(s^s>>>7,61|s); return ((s^s>>>14)>>>0)/4294967296; }; }
  /* lettering finishes: [top highlight, upper, horizon dark, lower, bottom] */
  const FIN={ gold:['#fffbe8','#fde68a','#b45309','#fbbf24','#fff3c4'], chrome:['#ffffff','#e2e8f0','#475569','#cbd5e1','#f8fafc'],
    ice:['#ffffff','#bae6fd','#0369a1','#7dd3fc','#e0f2fe'], fire:['#fff7ed','#fdba74','#c2410c','#fb923c','#ffedd5'] };
  const FONT="'Big Shoulders Display','Arial Narrow',Impact,sans-serif";

  function lines(title,max){ const t=String(title).toUpperCase().replace(/\s+/g,' ').trim(); if(t.length<=max||!t.includes(' ')) return [t];
    let best=null; for(let i=0;i<t.length;i++) if(t[i]===' '){ const d=Math.abs(i-t.length/2); if(!best||d<best.d) best={i,d}; } return [t.slice(0,best.i),t.slice(best.i+1)]; }

  function title(id,ls,x,y0,maxW,fsMax,anchor,rim,lh){ const longest=Math.max(...ls.map(l=>l.length)); const fs=Math.min(fsMax,maxW/(longest*.55)); const gap=lh||fs*.98;
    return ls.map((l,i)=>{ const y=y0-(ls.length-1-i)*gap, T=`x="0" y="0" text-anchor="${anchor}" font-family="${FONT}" font-weight="900" font-size="${fs.toFixed(1)}" letter-spacing="1"`;
      return `<g transform="translate(${x} ${y.toFixed(1)}) skewX(-9)">
        <text ${T} transform="translate(3 6)" fill="#02040a" stroke="#02040a" stroke-width="13" stroke-linejoin="round" paint-order="stroke">${esc(l)}</text>
        <text ${T} fill="none" stroke="${rim}" stroke-width="10" stroke-linejoin="round" opacity=".95">${esc(l)}</text>
        <text ${T} fill="url(#${id}t)" stroke="#0b1020" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(l)}</text>
      </g>`; }).join(''); }

  function cover(o){ o=o||{}; const wide=!!o.wide, W=wide?800:400, H=wide?340:300;
    const seed=hash((o.title||'')+(o.icon||'')), r=rng(seed), id='rc'+seed.toString(36)+(wide?'w':'');
    let c1=o.c1||'#1d4ed8', c2=o.c2||'#0f172a'; if(lum(c1)>.72) c1=mix(c1,'#1e293b',.45); if(lum(c2)>.72) c2=mix(c2,'#1e293b',.55);
    const fin=FIN[o.finish]||FIN[['gold','chrome','ice','fire'][seed%4]], rim=mix(c1,'#ffffff',.25);
    /* floodlight beams from both top corners */
    const lights=[[W*.1,16,W*.46],[W*.9,16,W*.54]];
    const beams=lights.map(([x,y,tx])=>`<polygon class="rc-beam" points="${x-8},${y} ${x+8},${y} ${tx+W*.2},${H} ${tx-W*.2},${H}" fill="url(#${id}b)"/>`).join('');
    const banks=lights.map(([x,y])=>{ let s=`<rect x="${x-26}" y="${y-9}" width="52" height="22" rx="4" fill="#0b1222" stroke="#334155"/>`; for(let i=0;i<4;i++) for(let j=0;j<2;j++) s+=`<circle cx="${x-18+i*12}" cy="${y-2+j*9}" r="3.6" fill="#fff" filter="url(#${id}g)"/>`; return s; }).join('');
    /* crowd silhouette along the bottom */
    let crowd=''; const cy0=H-30; for(let x=-6;x<W+12;x+=13+r()*5){ const h=r()*9; crowd+=`<circle cx="${x.toFixed(1)}" cy="${(cy0-h).toFixed(1)}" r="${(6+r()*2.4).toFixed(1)}"/><rect x="${(x-9).toFixed(1)}" y="${(cy0-h+5).toFixed(1)}" width="18" height="40" rx="7"/>`; }
    let sparks=''; for(let i=0;i<14;i++) sparks+=`<circle cx="${(r()*W).toFixed(0)}" cy="${(r()*H*.55).toFixed(0)}" r="${(r()*1.6+.5).toFixed(1)}" fill="#fff" opacity="${(r()*.6+.25).toFixed(2)}"/>`;
    /* crest */
    const sx=wide?W*.76:W/2, sy=wide?34:24, sw=wide?98:80, sh=wide?226:170;
    const crestPath=`M${sx},${sy} L${sx+sw},${sy+sh*.13} L${sx+sw-6},${sy+sh*.6} Q${sx+sw-16},${sy+sh*.86} ${sx},${sy+sh} Q${sx-sw+16},${sy+sh*.86} ${sx-sw+6},${sy+sh*.6} L${sx-sw},${sy+sh*.13} Z`;
    const iconSize=wide?120:84;
    const crest=`<path d="${crestPath}" fill="#02040a" transform="translate(4 7)" opacity=".7"/>
      <path d="${crestPath}" fill="url(#${id}s)" stroke="#05080f" stroke-width="12" stroke-linejoin="round" paint-order="stroke"/>
      <path d="${crestPath}" fill="none" stroke="url(#${id}m)" stroke-width="6" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)"><ellipse cx="${sx-sw*.35}" cy="${sy+sh*.12}" rx="${sw*1.1}" ry="${sh*.28}" fill="#fff" opacity=".16"/><path d="M${sx-sw},${sy+sh*.52} L${sx+sw},${sy+sh*.38} L${sx+sw},${sy+sh} L${sx-sw},${sy+sh} Z" fill="#000" opacity=".18"/></g>
      <text x="${sx}" y="${sy+sh*.5}" text-anchor="middle" dominant-baseline="central" font-size="${iconSize}" filter="url(#${id}d)">${esc(o.icon||'🏆')}</text>`;
    /* lettering */
    let text;
    if(wide){ const ls=lines(o.title,10); text=`<text x="46" y="62" font-family="${FONT}" font-weight="800" font-size="20" letter-spacing="4" fill="${mix(c1,'#ffffff',.65)}">${esc((o.kicker||'RINK RIVALS ARCADE').toUpperCase())}</text>`
        +title(id,ls,46,ls.length>1?222:200,470,ls.length>1?82:104,'start',rim)
        +(o.tag?`<text x="48" y="${ls.length>1?268:250}" font-family="${FONT}" font-weight="800" font-size="24" letter-spacing="3" fill="#fde68a">${esc(o.tag.toUpperCase())}</text>`:''); }
    else { const ls=lines(o.title,11); text=title(id,ls,W/2,ls.length>1?284:276,360,ls.length>1?46:70,'middle',rim); }
    const [a,b,c,d,e]=fin;
    return `<svg class="rc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title)}">
<defs>
 <radialGradient id="${id}r" cx="${wide?'76%':'50%'}" cy="40%" r="${wide?'45%':'58%'}"><stop offset="0" stop-color="${mix(c1,'#000000',.2)}" stop-opacity=".9"/><stop offset=".45" stop-color="${mix(c1,'#000000',.6)}" stop-opacity=".6"/><stop offset="1" stop-color="#020308" stop-opacity="0"/></radialGradient>
 <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c1,'#ffffff',.22)}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${mix(c2,'#000000',.35)}"/></linearGradient>
 <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7cc"/><stop offset=".35" stop-color="#fbbf24"/><stop offset=".6" stop-color="#92400e"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
 <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".42" stop-color="${b}"/><stop offset=".5" stop-color="${c}"/><stop offset=".52" stop-color="${c}"/><stop offset=".78" stop-color="${d}"/><stop offset="1" stop-color="${e}"/></linearGradient>
 <clipPath id="${id}c"><path d="${crestPath}"/></clipPath>
 <filter id="${id}g" x="-3" y="-3" width="7" height="7"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="${id}d" x="-.3" y="-.3" width="1.6" height="1.6"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".6"/></filter>
 <filter id="${id}f"><feGaussianBlur stdDeviation="30"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="#04060b"/><rect width="${W}" height="${H}" fill="url(#${id}r)"/>
<g opacity=".3">${beams}</g>
<ellipse cx="${wide?W*.76:W/2}" cy="${H-40}" rx="${W*.3}" ry="${H*.12}" fill="${c1}" opacity=".35" filter="url(#${id}f)"/>
${sparks}${banks}
<g fill="#010205" opacity=".95">${crowd}</g>
<rect y="${H-34}" width="${W}" height="34" fill="#010205"/>
${crest}${text}
</svg>`; }
  window.RRARC={ cover, mix };
})();
