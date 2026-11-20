/* The admin page lives at a secret address that changes every day (UTC midnight).
   - /hq-<today's code>   serves the admin page (yesterday's code still works for the first hour after midnight)
   - /hq                  a sign-in gate: after a correct password (checked by the game server) it sends you to today's address
   - anything else under /hq... (the old fixed address, the page's source file) is a plain 404
   The daily code is an HMAC of the date with ADMIN_SLUG_KEY, a Cloudflare secret that is never in the repo.
   Only /hq* and /rr/* reach this function (see _routes.json); every other page is served straight from the cache. */
const SERVER='https://rink-rivals-rooms.mitchellchad2026.workers.dev', RELAY='__RELAY_KEY__', SRC='/hq-src';

async function slugFor(key,day){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const b=new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('rr-admin:'+day)));
  let s=''; for(let i=0;i<14;i++) s+='abcdefghijkmnpqrstuvwxyz23456789'[b[i]%32]; return 'hq-'+s;
}
const dayStr=t=>new Date(t).toISOString().slice(0,10);
async function validSlugs(key){ const now=Date.now(), out=[await slugFor(key,dayStr(now))]; if(new Date(now).getUTCHours()<1) out.push(await slugFor(key,dayStr(now-864e5))); return out; }
const notFound=()=>new Response('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font-family:system-ui;background:#070b16;color:#cbd5e1;display:grid;place-items:center;height:100vh;margin:0">Page not found</body>',{status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
const SEC={'cache-control':'no-store','x-frame-options':'DENY','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow','content-security-policy':"frame-ancestors 'none'; base-uri 'none'; object-src 'none'"};

const GATE=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b16;color:#e2e8f0;font-family:system-ui,sans-serif}form{background:#111a2e;border:1px solid #23314f;border-radius:16px;padding:24px;width:min(340px,90vw);display:grid;gap:12px}
input,button{font:inherit;font-size:16px;padding:10px 12px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#e2e8f0}button{background:#2563eb;border:0;font-weight:700;cursor:pointer}#m{min-height:1.2em;color:#fca5a5;font-size:14px}#c{display:none}</style></head>
<body><form id="f"><b style="font-size:20px">Owner sign-in</b><input id="p" type="password" placeholder="Password" autocomplete="current-password" required><input id="c" inputmode="numeric" placeholder="6-digit code" autocomplete="one-time-code"><button>Open admin</button><div id="m"></div></form>
<script>
const f=document.getElementById('f'), m=document.getElementById('m'), c=document.getElementById('c');
f.onsubmit=async e=>{ e.preventDefault(); m.textContent='Checking…';
  try{ const r=await fetch('/rr/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pw:document.getElementById('p').value,code:c.value})}), d=await r.json();
    if(d.err==='code'||d.err==='badcode'){ c.style.display='block'; c.focus(); m.textContent=d.err==='code'?'Enter your 2-step code':'Wrong code'; return; }
    if(!d.token){ m.textContent=d.err==='locked'?'Too many tries, wait a bit':'Wrong password'+(d.left!=null?' ('+d.left+' tries left)':''); return; }
    sessionStorage.setItem('rrAdminTok',JSON.stringify({token:d.token,exp:d.exp}));
    const l=await fetch('/hq/link',{method:'POST',headers:{'x-admin-token':d.token}}), j=await l.json();
    if(j.url) location.replace(j.url); else m.textContent='Could not get today\\'s link';
  }catch(err){ m.textContent='Network error, try again'; } };
</script></body></html>`;

export async function onRequest(ctx){
  const {request,env,next}=ctx, u=new URL(request.url), p=u.pathname.replace(/\.html$/,'').replace(/\/+$/,'');
  if(!/^\/hq/.test(p)) return next();
  const key=env.ADMIN_SLUG_KEY; if(!key) return notFound();
  if(p==='/hq'&&request.method==='GET') return new Response(GATE,{headers:{'content-type':'text/html; charset=utf-8',...SEC}});
  if(p==='/hq/link'&&request.method==='POST'){
    const tok=request.headers.get('x-admin-token')||'', h=new Headers({'content-type':'application/json','x-admin-token':tok,'user-agent':request.headers.get('user-agent')||'','x-rr-relay':RELAY,'x-rr-r-ip':request.headers.get('cf-connecting-ip')||'','x-rr-r-asn':String((request.cf||{}).asn||''),'x-rr-r-aso':String((request.cf||{}).asOrganization||'').slice(0,80),'x-rr-r-cc':String((request.cf||{}).country||'')});
    let ok=false; try{ const r=await fetch(SERVER+'/admin/sec',{method:'POST',headers:h,body:JSON.stringify({op:'secStatus'})}); ok=r.status===200; }catch(e){}
    if(!ok) return new Response(JSON.stringify({err:'forbidden'}),{status:403,headers:{'content-type':'application/json','cache-control':'no-store'}});
    return new Response(JSON.stringify({url:'/'+(await validSlugs(key))[0]}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
  }
  if((await validSlugs(key)).includes(p.slice(1))){
    const a=await env.ASSETS.fetch(new Request(new URL(SRC,u.origin),{headers:{accept:'text/html'}}));
    if(!a.ok) return notFound();
    return new Response(a.body,{status:200,headers:{'content-type':'text/html; charset=utf-8',...SEC,'permissions-policy':'camera=(), microphone=(), geolocation=()'}});
  }
  return notFound();
}
