/* Arcade Rivals online rooms: one Durable Object per room code relays messages between up to 4 players. */
const MAX=8;
export default {
  /* nightly chat wipe at 10 p.m. Toronto time. Cron runs at 02:00 and 03:00 UTC, and only the one that lands on 22:00 local (EST or EDT) clears */
  async scheduled(ev, env, ctx){
    const hr=+new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',hour:'numeric',hourCycle:'h23'}).format(new Date(ev.scheduledTime||Date.now()));
    if(hr!==22) return;
    const chat=env.CHAT.get(env.CHAT.idFromName('SITE'));
    ctx.waitUntil(chat.fetch(new Request('https://do/admin',{method:'POST',headers:{'content-type':'application/json','x-admin-role':'full'},body:JSON.stringify({op:'clear'})})));
  },
  async fetch(req, env){
    /* requests that came through the site's backup route (rink-rivals.pages.dev/rr): trust the player's real IP and network it passes on */
    let RCF=null; if(env.RELAY_KEY&&req.headers.get('x-rr-relay')===env.RELAY_KEY){ const h=new Headers(req.headers), ip=h.get('x-rr-r-ip'); if(ip) h.set('cf-connecting-ip',ip); RCF={asn:+(h.get('x-rr-r-asn')||0),asOrganization:h.get('x-rr-r-aso')||'',country:h.get('x-rr-r-cc')||''}; for(const k of ['x-rr-relay','x-rr-r-ip','x-rr-r-asn','x-rr-r-aso','x-rr-r-cc']) h.delete(k); req=new Request(req,{headers:h}); }
    const url=new URL(req.url);
    const m=url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if(m){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      const id=env.ROOMS.idFromName(m[1]);
      return env.ROOMS.get(id).fetch(req);
    }
    if(url.pathname==='/nhl/game'){ /* one game's live play-by-play for the rink tracker (cached 8 s) */
      const id=String(url.searchParams.get('id')||'').replace(/\D/g,'').slice(0,12); if(id.length<8) return J({err:'bad'},400);
      const c=caches.default, key=new Request('https://nhl.cache/game/'+id); let r=await c.match(key);
      if(!r){ const up=await fetch('https://api-web.nhle.com/v1/gamecenter/'+id+'/play-by-play',{headers:{'user-agent':'ArcadeRivals/1.0'}}).catch(()=>null); if(!up||!up.ok) return J({err:'nhl'},502);
        const d=await up.json(), who={}; for(const p of d.rosterSpots||[]) who[p.playerId]=((p.firstName||{}).default||'')[0]+'. '+((p.lastName||{}).default||'')+' #'+p.sweaterNumber;
        const T=t=>({id:t.id,ab:t.abbrev,name:(t.commonName||t.name||{}).default||t.abbrev,logo:t.logo,score:t.score,sog:t.sog});
        const KEEP={'goal':1,'shot-on-goal':1,'missed-shot':1,'blocked-shot':1,'hit':1,'penalty':1,'faceoff':1,'giveaway':1,'takeaway':1,'period-start':1,'period-end':1,'stoppage':0};
        const plays=(d.plays||[]).filter(p=>KEEP[p.typeDescKey]).slice(-80).map(p=>{ const x=p.details||{}, pid=x.scoringPlayerId||x.shootingPlayerId||x.hittingPlayerId||x.committedByPlayerId||x.winningPlayerId||x.playerId;
          return {k:p.typeDescKey,p:(p.periodDescriptor||{}).number,t:p.timeInPeriod,x:x.xCoord,y:x.yCoord,tm:x.eventOwnerTeamId,who:pid?who[pid]||'':'',st:x.shotType||x.descKey||'',a1:x.assist1PlayerId?who[x.assist1PlayerId]||'':'',h:x.homeScore,a:x.awayScore}; });
        r=new Response(JSON.stringify({id:d.id,state:d.gameState,venue:(d.venue||{}).default||'',period:(d.periodDescriptor||{}).number||0,ptype:(d.periodDescriptor||{}).periodType||'',clock:(d.clock||{}).timeRemaining||'',inter:!!(d.clock||{}).inIntermission,away:T(d.awayTeam),home:T(d.homeTeam),tv:(d.tvBroadcasts||[]).map(b=>b.network).slice(0,6),plays}),{headers:{'content-type':'application/json','cache-control':'max-age=8'}}); await c.put(key,r.clone()); }
      const h=new Headers(r.headers); for(const k in CORS) h.set(k,CORS[k]); return new Response(r.body,{headers:h}); }
    if(url.pathname==='/nhl'){ /* live NHL scoreboard, passed through from the NHL's public score feed (cached 30 s) */
      const c=caches.default, key=new Request('https://nhl.cache/score-now'); let r=await c.match(key);
      if(!r){ const up=await fetch('https://api-web.nhle.com/v1/score/now',{headers:{'user-agent':'ArcadeRivals/1.0'}}).catch(()=>null); if(!up||!up.ok) return J({err:'nhl'},502);
        const d=await up.json(); const T=t=>({ab:t.abbrev,name:(t.name||{}).default||t.abbrev,logo:t.logo,score:t.score,sog:t.sog});
        const games=(d.games||[]).map(g=>({id:g.id,state:g.gameState,start:g.startTimeUTC,period:(g.periodDescriptor||{}).number||g.period||0,ptype:(g.periodDescriptor||{}).periodType||'',clock:(g.clock||{}).timeRemaining||'',inter:!!(g.clock||{}).inIntermission,away:T(g.awayTeam),home:T(g.homeTeam),
          goals:(g.goals||[]).slice(-6).map(x=>({p:(x.periodDescriptor||{}).number||x.period,t:x.timeInPeriod,who:(x.name||{}).default||'',team:(x.teamAbbrev&&x.teamAbbrev.default)||x.teamAbbrev||''}))}));
        /* is the NHL's YouTube channel streaming live right now? */
        let yt=null; try{ const lh=await (await fetch('https://www.youtube.com/@NHL/live',{headers:{'user-agent':'Mozilla/5.0','accept-language':'en-US'}})).text(); const vid=(lh.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/)||[])[1];
          if(vid&&/"isLiveNow":true|"isLive":true/.test(lh)){ const tt=(lh.match(/<meta name="title" content="([^"]{0,140})"/)||[])[1]||'NHL live'; yt={id:vid,title:tt.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"')}; } }catch(e){}
        r=new Response(JSON.stringify({date:d.currentDate,games,yt}),{headers:{'content-type':'application/json','cache-control':'max-age=30'}}); await c.put(key,r.clone()); }
      const h=new Headers(r.headers); for(const k in CORS) h.set(k,CORS[k]); return new Response(r.body,{headers:h}); }
    if(url.pathname==='/acct'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.ACCT.get(env.ACCT.idFromName('ACCT')).fetch(req); }
    if(url.pathname==='/site'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.SITE.get(env.SITE.idFromName('SITE')).fetch(req); }
    if(url.pathname==='/tourney'||url.pathname==='/play'||url.pathname==='/daily'||url.pathname==='/like'||url.pathname==='/vote'||url.pathname==='/namecheck'||url.pathname.startsWith('/feed/')){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); const cf=RCF||req.cf||{}, h=new Headers(req.headers); h.set('x-rr-asn',String(cf.asn||'')); h.set('x-rr-aso',String(cf.asOrganization||'').slice(0,80)); h.set('x-rr-cc',String(cf.country||'')); return env.SITE.get(env.SITE.idFromName('SITE')).fetch(new Request(req,{headers:h})); }
    const lb=url.pathname.match(/^\/lb\/([a-z0-9]{2,16})$/);
    if(lb){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.BOARDS.get(env.BOARDS.idFromName(lb[1])).fetch(req); }
    const pm=url.pathname.match(/^\/party\/([A-Z0-9]{4,8})$/);
    if(pm){ if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426}); return env.PARTY.get(env.PARTY.idFromName(pm[1])).fetch(req); }
    if(url.pathname==='/chat'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(req);
    }
    /* site owner tools: clean leaderboards and chat. Needs the ADMIN_KEY secret. */
    const ad=url.pathname.match(/^\/admin\/(lb|chat|site|sec)(?:\/([a-z0-9]{2,16}))?$/);
    /* admin sign-in: the password is only ever checked here, on the server (it's a Cloudflare secret, never in the page).
       Wrong guesses are rate-limited per IP; a right one is swapped for a random session token that expires. */
    if(url.pathname==='/admin/login'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); if(req.method!=='POST') return J({err:'method'},405);
      const ip=req.headers.get('cf-connecting-ip')||'?', chat=env.CHAT.get(env.CHAT.idFromName('SITE')), call=o=>chat.fetch(new Request('https://do/sec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)})).then(r=>r.json());
      const gate=await call({op:'check',ip}); if(gate.blocked) return J({err:'locked',wait:gate.wait},429);
      let pw='', code=''; try{ const b=await req.json(); pw=String(b.pw||''); code=String(b.code||'').replace(/\D/g,''); }catch(e){} await new Promise(r=>setTimeout(r,350));   /* slow every guess down */
      const cfg=await call({op:'authcfg'}), ua=(req.headers.get('user-agent')||'').slice(0,300);
      const ok=cfg.pwh?(await pbkdf(pw,cfg.pwh.salt))===cfg.pwh.hash:((env.ADMIN_KEY&&await sameSecret(pw,env.ADMIN_KEY))||(env.SITE_ADMIN_KEY&&await sameSecret(pw,env.SITE_ADMIN_KEY)));
      if(!ok){ const f=await call({op:'fail',ip,why:'wrong password',ua}); return J({err:'wrong',left:f.left},403); }
      if(cfg.totp){ if(!code) return J({err:'code'},401); const v=await call({op:'totpCheck',code}); if(!v.ok){ const f=await call({op:'fail',ip,why:'wrong 2-step code',ua}); return J({err:'badcode',left:f.left},403); } }
      await call({op:'ok',ip,ua}); const t=await call({op:'newtok',role:'full',ua,ip}); return J({token:t.token,exp:t.exp}); }
    if(ad){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
      let role=null; const chat=env.CHAT.get(env.CHAT.idFromName('SITE')), call=o=>chat.fetch(new Request('https://do/sec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)})).then(r=>r.json());
      const tok=req.headers.get('x-admin-token'), pid=req.headers.get('x-admin-pid');
      const ua=(req.headers.get('user-agent')||'').slice(0,300), ip=req.headers.get('cf-connecting-ip')||'?';
      if(tok){ try{ const d=await call({op:'tok',token:tok,ua}); if(d&&d.role) role=d.role; }catch(e){} }
      else if(pid){ try{ const ar=await chat.fetch(new Request('https://do/authpid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'authpid',pid})})); const d=await ar.json(); if(d&&d.lvl) role=d.lvl; }catch(e){} }
      if(!role) return J({err:'forbidden'},403);
      if((role==='arcade'||role==='news')&&ad[1]!=='site'&&ad[1]!=='chat') return J({err:'forbidden'},403);
      const body=await req.text(); const u=new URL(req.url); u.pathname='/admin';
      /* the security centre needs a real password sign-in (not just an approved device), and a password change re-checks the old one */
      if(ad[1]==='sec'){ if(!tok||role!=='full') return J({err:'needpw'},403); let bj={}; try{ bj=JSON.parse(body||'{}'); }catch(e){}
        if(bj.op==='setPw'){ const cfg=await call({op:'authcfg'}), old=String(bj.oldPw||''); const ok=cfg.pwh?(await pbkdf(old,cfg.pwh.salt))===cfg.pwh.hash:((env.ADMIN_KEY&&await sameSecret(old,env.ADMIN_KEY))||(env.SITE_ADMIN_KEY&&await sameSecret(old,env.SITE_ADMIN_KEY))); if(!ok){ await call({op:'fail',ip,why:'wrong old password (change)',ua}); return J({err:'oldpw'},403); } } }
      const h=new Headers(); h.set('content-type','application/json'); h.set('x-admin-role',role); if(tok) h.set('x-admin-th',await sha(tok));
      /* every change is written to the activity log (reads are not) */
      try{ const bj=JSON.parse(body||'{}'), op=String(bj.op||''); if(op&&!/^(get|players|who|recent|list|daily|stats|tags|bans|muted|grants|sbans|msgs|secStatus|auditLog|loginLog|sessions|lockstatus|player|liveStats|notes|polls|pinfo|export)$/.test(op)){ const d2={...bj}; for(const k of ['pw','oldPw','newPw','code','token']) delete d2[k]; await call({op:'audit',role:tok?role+' (password)':role+' (device)',ip,what:ad[1]+'/'+op,detail:JSON.stringify(d2).slice(0,300)}); } }catch(e){}
      const r2=new Request(u,{method:'POST',headers:h,body});
      if(ad[1]==='lb'&&ad[2]) return env.BOARDS.get(env.BOARDS.idFromName(ad[2])).fetch(r2);
      if(ad[1]==='chat'||ad[1]==='sec') return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(r2);
      if(ad[1]==='site'){ const res=await env.SITE.get(env.SITE.idFromName('SITE')).fetch(r2); try{ const bj=JSON.parse(body||'{}'); if(/^(reserve|unreserve|reservePid)$/.test(bj.op)){ const d=await res.clone().json(); if(d&&d.reserved){ const h2=new Headers(); h2.set('content-type','application/json'); h2.set('x-admin-role','full'); await chat.fetch(new Request('https://do/admin',{method:'POST',headers:h2,body:JSON.stringify({op:'reservedSet',list:d.reserved})})); } } }catch(e){} return res; }
      return J({err:'bad'},400); }
    if(url.pathname==='/lobby'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.LOBBY.get(env.LOBBY.idFromName('SITE')).fetch(req);
    }
    return new Response('Arcade Rivals rooms',{headers:{'content-type':'text/plain'}});
  }
};
export class Room {
  constructor(ctx){ this.ctx=ctx; }
  peers(){ return this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment()).filter(Boolean); }
  send(ws,obj){ try{ ws.send(JSON.stringify(obj)); }catch(e){} }
  broadcast(obj,except){ for(const ws of this.ctx.getWebSockets()){ if(ws!==except&&ws.deserializeAttachment()) this.send(ws,obj); } }
  async fetch(req){
    const socks=this.ctx.getWebSockets();
    const pair=new WebSocketPair(); const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    if(socks.length>=MAX){ this.send(server,{t:'full'}); server.close(1000,'Room full'); return new Response(null,{status:101,webSocket:client}); }
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,raw){
    let msg; try{ msg=JSON.parse(raw); }catch(e){ return; }
    if(typeof raw==='string'&&raw.length>16000) return;
    const me=ws.deserializeAttachment();
    if(msg.t==='hello'&&!me){
      const used=new Set(this.peers().map(p=>p.seat)); let seat=0; while(used.has(seat)) seat++;
      const info={id:crypto.randomUUID().slice(0,8),seat,name:String(msg.name||'Player').slice(0,24),game:String(msg.game||'').slice(0,16),extra:msg.extra||null};
      ws.serializeAttachment(info);
      this.send(ws,{t:'welcome',...info,peers:this.peers().filter(p=>p.id!==info.id)});
      this.broadcast({t:'join',...info},ws);
      return;
    }
    if(!me) return;
    msg.from=me.id; msg.seat=me.seat;
    if(msg.to){ for(const s of this.ctx.getWebSockets()){ const a=s.deserializeAttachment(); if(a&&a.id===msg.to) this.send(s,msg); } }
    else this.broadcast(msg,ws);
  }
  async webSocketClose(ws){ const me=ws.deserializeAttachment(); if(me) this.broadcast({t:'leave',id:me.id,seat:me.seat},ws); try{ ws.close(); }catch(e){} }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}

/* The site lobby: every open game page says which game it is on, so anyone can see who else is around and get matched
   with them. Quick Match pairs players looking for the same game and hands them a fresh room code. */
const QCODE=()=>{ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='Q'; for(let i=0;i<5;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; };
export class Lobby {
  constructor(ctx){ this.ctx=ctx; }
  all(){ return this.ctx.getWebSockets().map(ws=>[ws,ws.deserializeAttachment()]).filter(([,a])=>a); }
  send(ws,obj){ try{ ws.send(JSON.stringify(obj)); }catch(e){} }
  counts(){ const games={}, seeking={}; for(const [,a] of this.all()){ games[a.game]=(games[a.game]||0)+1; if(a.seek){ (seeking[a.game]=seeking[a.game]||[]).push(a.name); } } return {t:'counts',games,seeking,total:this.all().length}; }
  push(){ const c=JSON.stringify(this.counts()); for(const ws of this.ctx.getWebSockets()) try{ ws.send(c); }catch(e){} }
  async fetch(req){ const pair=new WebSocketPair(); const [client,server]=Object.values(pair); this.ctx.acceptWebSocket(server); return new Response(null,{status:101,webSocket:client}); }
  match(game){ const q=this.all().filter(([,a])=>a.game===game&&a.seek).sort((x,y)=>x[1].since-y[1].since); if(q.length<2) return;
    const max=Math.max(2,Math.min(8,...q.map(([,a])=>a.want||2))); const grp=q.slice(0,max), code=QCODE();
    for(const [ws,a] of grp){ a.seek=false; ws.serializeAttachment(a); this.send(ws,{t:'match',code,n:grp.length,names:grp.map(([,b])=>b.name)}); } }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>2000) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    const a=ws.deserializeAttachment()||{game:'home',name:'Player',seek:false,since:0};
    if(m.t==='here'){ a.game=String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home'; a.name=String(m.name||'Player').slice(0,20); a.seek=false; ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='name'){ a.name=String(m.name||'Player').slice(0,20); ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='seek'){ a.seek=true; a.since=Date.now(); a.want=Math.max(2,Math.min(8,+m.want||2)); if(m.name) a.name=String(m.name).slice(0,20); ws.serializeAttachment(a); this.match(a.game); this.push(); return; }
    if(m.t==='unseek'){ a.seek=false; ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; } }
  async webSocketClose(ws){ try{ ws.serializeAttachment(null); ws.close(); }catch(e){} this.push(); }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}

/* Leaderboards: one Durable Object per game, a SQLite table of each player's record on each board */
/* where the admin page lives. Not linked anywhere public: the chat only shows it to people the server has granted access. */
/* bump this to make the server forget any password set from the admin page and go back to the ADMIN_KEY secret */
const PW_RESET='2026-11-03';
const ADMIN_URL='/hq-owa9rwwt9kplpdbu';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-admin-token,x-admin-pid,x-pid,x-name,x-cap,x-fp','Access-Control-Expose-Headers':'content-length,content-range,accept-ranges'};
/* SHA-256 as hex, and a comparison that takes the same time whether the guess is close or not */
async function sha(x){ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(x))); return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
/* reserved names: "Aiden", "A1den", "aiden_99", "AIDEN pro"… all count as Aiden. Only the devices it's reserved for may use it. */
/* networks that are data centres, VPNs or proxy services rather than homes, schools or phone carriers */
const PROXY_ORG=/(amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|linode|akamai|vultr|choopa|ovh|hetzner|contabo|oracle|alibaba|tencent|leaseweb|m247|datacamp|cdn77|packet|equinix|hostinger|hostwinds|ionos|scaleway|upcloud|kamatera|psychz|quadranet|colocrossing|buyvm|frantech|zenlayer|g-core|gcore|cogent|hurricane electric|nordvpn|surfshark|expressvpn|mullvad|proton|private internet access|cyberghost|ipvanish|windscribe|hide\.me|tunnelbear|hotspot shield|psiphon|vpn|proxy|hosting|\bservers?\b|\bcloud\b|data ?cent(er|re)|\bcolo(cation)?\b|vercel|netlify|render|fly\.io|heroku|replit|fastly)/i;
const PROXY_ASN=new Set(['13335','209242','16509','14618','15169','396982','8075','14061','63949','20473','16276','24940','51167','31898','45102','132203','60068','9009','212238','208091','174','6939','36352','53667','46844','62240','19318','30633','54825','25369','35916','40021','394380','397423','20278','64267']);
/* school web filters route whole schools through their cloud: never treat those as a proxy */
const SCHOOL_OK=/(zscaler|iboss|securly|lightspeed|goguardian|contentkeeper|netsweeper|umbrella|opendns|fortinet|palo alto|sophos|smoothwall|linewize|forcepoint|barracuda|school|district|education|k12|universit|college|academ)/i;
const isProxyNet=(asn,aso)=>!SCHOOL_OK.test(String(aso||''))&&(PROXY_ASN.has(String(asn))||PROXY_ORG.test(String(aso||'')));
const nameKey=n=>String(n||'').toLowerCase().replace(/[0@4]/g,c=>({'0':'o','@':'a','4':'a'}[c])).replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/[5$]/g,'s').replace(/7/g,'t').replace(/[^a-z]/g,'');
function reservedFor(name,pid,list){ const k=nameKey(name); for(const r of list||[]){ if(r&&r.n&&k.startsWith(r.n)&&!(r.pids||[]).includes(pid)) return r; } return null; }
const devOf=u=>{ u=String(u||''); return /CrOS/.test(u)?'Chromebook':/iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':/Windows/.test(u)?'Windows PC':/Macintosh|Mac OS/.test(u)?'Mac':/Linux/.test(u)?'Linux PC':'Unknown'; };
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(bytes){ let bits=0, v=0, out=''; for(const b of bytes){ v=(v<<8)|b; bits+=8; while(bits>=5){ out+=B32[(v>>>(bits-5))&31]; bits-=5; } } if(bits>0) out+=B32[(v<<(5-bits))&31]; return out; }
function b32dec(str){ const s=String(str).toUpperCase().replace(/[^A-Z2-7]/g,''); let bits=0, v=0; const out=[]; for(const ch of s){ v=(v<<5)|B32.indexOf(ch); bits+=5; if(bits>=8){ out.push((v>>>(bits-8))&255); bits-=8; } } return new Uint8Array(out); }
async function totpAt(secret,step){ const key=await crypto.subtle.importKey('raw',b32dec(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']); const msg=new Uint8Array(8); let x=step; for(let i=7;i>=0;i--){ msg[i]=x&255; x=Math.floor(x/256); }
  const h=new Uint8Array(await crypto.subtle.sign('HMAC',key,msg)), o=h[19]&15, n=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3]; return String(n%1000000).padStart(6,'0'); }
async function pbkdf(pw,salt){ const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pw)),'PBKDF2',false,['deriveBits']); const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},k,256); return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
async function sameSecret(a,b){ const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(a))),crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(b)))]); return crypto.subtle.timingSafeEqual(x,y); }
const J=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...CORS,'content-type':'application/json','cache-control':'no-store'}});
const BAD=/fuck|shit|cunt|nigg|fag|bitch|whore|slut|rape|hitler|nazi|dick|pussy|cock/i;
export class Board {
  constructor(ctx){ this.ctx=ctx; this.sql=ctx.storage.sql; this.sql.exec('CREATE TABLE IF NOT EXISTS s(b TEXT, pid TEXT, name TEXT, score REAL, txt TEXT, ts INTEGER, PRIMARY KEY(b,pid))'); try{ this.sql.exec('CREATE INDEX IF NOT EXISTS s_bs ON s(b,score)'); }catch(e){} this.rate=new Map(); }
  top(b,dir,n){ return this.sql.exec(`SELECT pid,name,score,txt,ts FROM s WHERE b=? ORDER BY score ${dir==='asc'?'ASC':'DESC'}, ts ASC LIMIT ?`,b,n).toArray(); }
  async fetch(req){ const url=new URL(req.url);
    if(url.pathname==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      if(m.op==='list') return J({rows:this.sql.exec('SELECT b,pid,name,score,txt,ts FROM s ORDER BY b,score DESC').toArray()});
      if(m.op==='del'&&Array.isArray(m.pids)){ let n=0; for(const p of m.pids){ n+=this.sql.exec('DELETE FROM s WHERE pid=?',String(p)).rowsWritten||0; } return J({ok:true,n}); }
      if(m.op==='clearall'){ this.sql.exec('DELETE FROM s'); return J({ok:true}); }
      if(m.op==='clearb'&&m.b){ this.sql.exec('DELETE FROM s WHERE b=?',String(m.b)); return J({ok:true}); }
      if(m.op==='delrow'&&m.b&&m.pid){ this.sql.exec('DELETE FROM s WHERE b=? AND pid=?',String(m.b),String(m.pid)); return J({ok:true}); }
      return J({err:'op'},400); }
    if(req.method==='GET'){ const b=String(url.searchParams.get('b')||'').slice(0,40), dir=url.searchParams.get('dir')==='asc'?'asc':'desc', n=Math.min(50,+url.searchParams.get('n')||20), pid=String(url.searchParams.get('pid')||'').slice(0,24);
      const rows=this.top(b,dir,n); let me=null; if(pid){ const r=this.sql.exec('SELECT name,score,txt FROM s WHERE b=? AND pid=?',b,pid).toArray()[0]; if(r){ const rank=this.sql.exec(`SELECT COUNT(*) AS c FROM s WHERE b=? AND score ${dir==='asc'?'<':'>'} ?`,b,r.score).toArray()[0].c+1; me={...r,rank}; } }
      const total=this.sql.exec('SELECT COUNT(*) AS c FROM s WHERE b=?',b).toArray()[0].c;
      return J({rows:rows.map(r=>({name:r.name,score:r.score,txt:r.txt,me:r.pid===pid})),me,total}); }
    if(req.method==='POST'){ let m; try{ m=await req.json(); }catch(e){ return J({err:'bad json'},400); }
      const b=String(m.b||'').slice(0,40), pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24), mode=['max','min','sum'].includes(m.mode)?m.mode:'max', score=+m.score;
      let name=String(m.name||'Player').replace(/[<>]/g,'').trim().slice(0,20)||'Player'; if(BAD.test(name)) name='Player';
      if(!b||pid.length<8||!isFinite(score)||Math.abs(score)>1e9) return J({err:'bad'},400);
      const now=Date.now(), rl=(this.rate.get(pid)||[]).filter(t=>now-t<60000); if(rl.length>40) return J({err:'slow down'},429); rl.push(now); this.rate.set(pid,rl);
      const old=this.sql.exec('SELECT score FROM s WHERE b=? AND pid=?',b,pid).toArray()[0];
      let nv=score, improved=true; if(old){ if(mode==='sum') nv=old.score+score; else if(mode==='max') { improved=score>old.score; nv=Math.max(old.score,score); } else { improved=score<old.score; nv=Math.min(old.score,score); } }
      const txt=String(m.txt||'').slice(0,40);
      if(improved||mode==='sum') this.sql.exec('INSERT INTO s(b,pid,name,score,txt,ts) VALUES(?,?,?,?,?,?) ON CONFLICT(b,pid) DO UPDATE SET name=excluded.name, score=excluded.score, txt=excluded.txt, ts=excluded.ts',b,pid,name,nv,mode==='sum'?String(nv):txt,now);
      else this.sql.exec('UPDATE s SET name=? WHERE b=? AND pid=?',name,b,pid);
      const dir=mode==='min'?'<':'>', rank=this.sql.exec(`SELECT COUNT(*) AS c FROM s WHERE b=? AND score ${dir} ?`,b,nv).toArray()[0].c+1;
      return J({ok:true,improved,score:nv,rank}); }
    return J({err:'method'},405); }
}

/* The site chat: one room for the whole site. Short history, gentle rate limits, filters for swearing, links and
   personal details, and community reports: three different people reporting a message hides it for everyone. */
const CHAT_BAD=[/f+[\W_]*[u\*v]+[\W_]*c+[\W_]*k+/gi,/\bsh+[i1!\*]+[\W_]*t+(?!\w*(ake|e))/gi,/\bc+[\W_]*u+[\W_]*n+[\W_]*t+/gi,/\bn+[\W_]*[i1!]+[\W_]*g+[\W_]*g+/gi,/\bf+[a@4]+g+/gi,/b+[i1!]+t+c+h+/gi,/wh+o+r+e+/gi,/\bsluts?\b/gi,/\br+[a@4]+p+e+/gi,/h+[i1]+t+l+e+r+/gi,/n+[a@4]+z+[i1]+/gi,/\bd+[i1!]+c+k+\b/gi,/p+u+s+s+y+/gi,/\bc+o+c+k+s?\b/gi,/\ba+s+s+h+o+l+e+/gi,/\bkys\b/gi,/kill\s*your\s*self/gi,/\bretard/gi,/\bporn/gi,/\bsexy?\b/gi,/\bbastard/gi];
const LINK=/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ly|me|tv|co|app|link|ru|info)\b|discord|snapchat|insta(gram)?|tiktok|@[a-z0-9_]{3,})/i;
/* keyboard mashing: random letters ("asdfjkl", "fjdkslajf") read as spam. Words, numbers and links are fine */
const URLRE=/(https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|gg|io|xyz|ly|me|tv|co|app|link|ca|uk|dev|info|edu|gov)(\/\S*)?)/gi;
const ROWS=['qwertyuiop','asdfghjkl','zxcvbnm','1234567890'], ROWR=ROWS.map(r=>r.split('').reverse().join(''));
function gibberish(text){ const t=text.toLowerCase().replace(URLRE,' '); const words=t.split(/[^a-z]+/).filter(Boolean); let bad=0, letters=0;
  for(const w of words){ letters+=w.length; if(w.length<5) continue; let junk=false;
    for(const run of w.match(/[bcdfghjklmnpqrstvwxz]{6,}/g)||[]) if(new Set(run).size>=4) junk=true; /* no real word has six different consonants in a row ("hmmmmm" is fine) */
    const v=(w.match(/[aeiouy]/g)||[]).length; if(w.length>=10&&v/w.length<.15) junk=true;
    for(const r of ROWS.concat(ROWR)) for(let i=0;i+5<=r.length;i++) if(w.includes(r.slice(i,i+5))&&r!=='1234567890'&&r!=='0987654321') junk=true; /* a run along the keyboard: asdfg, hjkl;, qwert */
    if(w.length>=14&&!/(.{2,})\1/.test(w)&&new Set(w).size>=w.length*.6&&v/w.length<.3) junk=true;
    if(junk) bad+=w.length; }
  return letters>=5&&bad/letters>.34; }
const PERSONAL=/(\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|crescent|cres|court|ct)\b|\bmy\s+address\b|\bwhere\s+do\s+you\s+live\b|\bhow\s+old\s+are\s+you\b)/i;
const cleanName=n=>{ let s=String(n||'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,20); if(!s) s='Player'; for(const r of CHAT_BAD){ r.lastIndex=0; if(r.test(s)) return 'Player'; } if(LINK.test(s)||PERSONAL.test(s)) return 'Player'; return s; };
/* a short public id for a person (the private player id never leaves the server) */
const pubId=w=>{ let h=2166136261; for(const c of String(w)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
export class Chat {
  constructor(ctx){ this.ctx=ctx; this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS m(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, name TEXT, text TEXT, game TEXT, who TEXT, hid INTEGER DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS r(mid INTEGER, who TEXT, PRIMARY KEY(mid,who))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mute(who TEXT PRIMARY KEY, until INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ban(nm TEXT PRIMARY KEY, until INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tag(nm TEXT PRIMARY KEY, tag TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS grnt(pubid TEXT PRIMARY KEY, lvl TEXT, name TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS cfg(k TEXT PRIMARY KEY, v TEXT)');
    /* grants are keyed by a SHA-256 of the person's private device id (the short public id can be forged) */
    this.sql.exec('CREATE TABLE IF NOT EXISTS grnt2(sh TEXT PRIMARY KEY, pubid TEXT, lvl TEXT, name TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rl(ip TEXT PRIMARY KEY, n INTEGER, first INTEGER, until INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sess(th TEXT PRIMARY KEY, role TEXT, exp INTEGER)');
    /* private messages are kept so people who were offline (or changed game) still get them */
    this.sql.exec('CREATE TABLE IF NOT EXISTS dmsg(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, fpub TEXT, fname TEXT, tpub TEXT, tname TEXT, text TEXT, seen INTEGER DEFAULT 0)');
    for(const c of ['uah TEXT','ip TEXT','created INTEGER','last INTEGER','ua TEXT']) try{ this.sql.exec('ALTER TABLE sess ADD COLUMN '+c); }catch(e){}
    this.sql.exec('CREATE TABLE IF NOT EXISTS alog(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, who TEXT, ip TEXT, what TEXT, detail TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS llog(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, ok INTEGER, ip TEXT, why TEXT, ua TEXT)');
    this._ixq=['CREATE INDEX IF NOT EXISTS m_hid ON m(hid,id)','CREATE INDEX IF NOT EXISTS dmsg_t ON dmsg(tpub,id)','CREATE INDEX IF NOT EXISTS dmsg_f ON dmsg(fpub,id)','CREATE INDEX IF NOT EXISTS grnt2_pub ON grnt2(pubid)']; this.ensureIx(); }
  ensureIx(){ if(this._ixOk) return; try{ for(const q of this._ixq) this.sql.exec(q); this._ixOk=true; }catch(e){} }
  cfgGet(k){ const r=this.sql.exec('SELECT v FROM cfg WHERE k=?',k).toArray()[0]; return r?r.v:null; }
  cfgSet(k,v){ this.sql.exec('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)',k,String(v)); }
  socks(){ return this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()); }
  send(ws,o){ try{ ws.send(JSON.stringify(o)); }catch(e){} }
  all(o){ const s=JSON.stringify(o); for(const ws of this.ctx.getWebSockets()) try{ ws.send(s); }catch(e){} }
  /* people, not connections: one player with several tabs open counts once */
  people(){ return new Set(this.socks().map(ws=>ws.deserializeAttachment().who)).size; }
  count(){ this.all({t:'n',n:this.people()}); this.who(); }
  tagOf(name){ const r=this.sql.exec('SELECT tag FROM tag WHERE nm=?',String(name||'').toLowerCase()).toArray()[0]; return r?r.tag:''; }
  async grantOfWho(who){ if(!who) return null; const h=await sha('rr-grant:'+who); const r=this.sql.exec('SELECT lvl FROM grnt2 WHERE sh=?',h).toArray()[0]; return r?r.lvl:null; }
  isBanned(name,who){ const now=Date.now(); const chk=k=>{ const r=this.sql.exec('SELECT until FROM ban WHERE nm=?',k).toArray()[0]; return r&&(r.until===0||r.until>now)?r:null; }; return chk(String(name||'').toLowerCase())||(who?chk('pid:'+who):null); }
  socksByPub(pubid){ return this.ctx.getWebSockets().filter(ws=>{ const a=ws.deserializeAttachment(); return a&&pubId(a.who)===pubid; }); }
  who(){ const m=new Map(); for(const ws of this.socks()){ const a=ws.deserializeAttachment(); m.set(a.who,{name:a.name,game:a.game,me:a.who}); }
    const list=[...m.values()].map(x=>({name:x.name,game:x.game,id:pubId(x.me),tag:this.tagOf(x.name)}));
    for(const ws of this.socks()){ const a=ws.deserializeAttachment(); const mine=pubId(a.who); this.send(ws,{t:'who',list:list.map(x=>({...x,me:mine===x.id}))}); } }
  hist(){ return this.sql.exec('SELECT id,ts,name,text,game FROM m WHERE hid=0 ORDER BY id DESC LIMIT 60').toArray().reverse().map(r=>({...r,tag:this.tagOf(r.name)})); }
  async fetch(req){ this.ensureIx();
    const path=new URL(req.url).pathname;
    if(path==='/authpid'){ let m={}; try{ m=await req.json(); }catch(e){} const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); return J({lvl:pid.length>=8?await this.grantOfWho(pid):null}); }
    if(path==='/sec'){ let m={}; try{ m=await req.json(); }catch(e){} const now=Date.now(), ip=String(m.ip||'?').slice(0,64);
      if(m.op==='check'){ const r=this.sql.exec('SELECT until FROM rl WHERE ip=?',ip).toArray()[0]; const g=this.sql.exec("SELECT COUNT(*) AS c FROM rl WHERE until>?",now).toArray()[0].c; return J({blocked:!!(r&&r.until>now),wait:r&&r.until>now?Math.ceil((r.until-now)/60000):0,locked:g}); }
      if(m.op==='authcfg'){ if(this.cfgGet('pwResetV')!==PW_RESET){ this.sql.exec("DELETE FROM cfg WHERE k='pwh'"); this.sql.exec('DELETE FROM sess'); this.cfgSet('pwResetV',PW_RESET); } const pw=this.cfgGet('pwh'); return J({pwh:pw?JSON.parse(pw):null,totp:!!this.cfgGet('totp')}); }
      if(m.op==='totpCheck'){ const sec2=this.cfgGet('totp'); if(!sec2) return J({ok:true}); const st=Math.floor(now/30000), code=String(m.code||''), last=+(this.cfgGet('totpLast')||0); for(const d of [0,-1,1]){ if(st+d<=last) continue; if(await totpAt(sec2,st+d)===code){ this.cfgSet('totpLast',st+d); return J({ok:true}); } } return J({ok:false}); }
      if(m.op==='audit'){ this.sql.exec('INSERT INTO alog(ts,who,ip,what,detail) VALUES(?,?,?,?,?)',now,String(m.role||''),(await sha('rr-ip:'+ip)).slice(0,10),String(m.what||'').slice(0,60),String(m.detail||'').slice(0,300)); this.sql.exec('DELETE FROM alog WHERE id<(SELECT MAX(id)-2000 FROM alog)'); return J({ok:true}); }
      if(m.op==='fail'){ this.sql.exec('INSERT INTO llog(ts,ok,ip,why,ua) VALUES(?,0,?,?,?)',now,(await sha('rr-ip:'+ip)).slice(0,10),String(m.why||'').slice(0,60),String(m.ua||'').slice(0,120)); this.sql.exec('DELETE FROM llog WHERE id<(SELECT MAX(id)-500 FROM llog)'); let r=this.sql.exec('SELECT n,first FROM rl WHERE ip=?',ip).toArray()[0]; let n=1, first=now; if(r&&now-r.first<15*60000){ n=r.n+1; first=r.first; } const until=n>=5?now+60*60000:0; this.sql.exec('INSERT OR REPLACE INTO rl(ip,n,first,until) VALUES(?,?,?,?)',ip,n,first,until); return J({left:Math.max(0,5-n)}); }
      if(m.op==='ok'){ this.sql.exec('DELETE FROM rl WHERE ip=?',ip); this.sql.exec('INSERT INTO llog(ts,ok,ip,why,ua) VALUES(?,1,?,?,?)',now,(await sha('rr-ip:'+ip)).slice(0,10),'signed in',String(m.ua||'').slice(0,120)); return J({ok:true}); }
      if(m.op==='newtok'){ const raw=crypto.getRandomValues(new Uint8Array(32)), token=[...raw].map(v=>v.toString(16).padStart(2,'0')).join(''), exp=now+12*3600000; this.sql.exec('DELETE FROM sess WHERE exp<?',now); this.sql.exec('INSERT INTO sess(th,role,exp,uah,ip,created,last,ua) VALUES(?,?,?,?,?,?,?,?)',await sha(token),m.role==='full'?'full':'mod',exp,await sha('ua:'+(m.ua||'')),(await sha('rr-ip:'+(m.ip||'?'))).slice(0,10),now,now,String(m.ua||'').slice(0,160)); return J({token,exp}); }
      if(m.op==='tok'){ const th=await sha(String(m.token||'').slice(0,80)), r=this.sql.exec('SELECT role,exp,uah FROM sess WHERE th=?',th).toArray()[0]; if(!r||r.exp<=now) return J({role:null}); if(r.uah&&r.uah!==await sha('ua:'+(m.ua||''))) return J({role:null}); this.sql.exec('UPDATE sess SET last=? WHERE th=?',now,th); return J({role:r.role}); }   /* a token only works in the browser it was made in */
      if(m.op==='logout'){ this.sql.exec('DELETE FROM sess WHERE th=?',await sha(String(m.token||'').slice(0,80))); return J({ok:true}); }
      return J({err:'op'},400); }
    if(path==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      const role=req.headers.get('x-admin-role')||'full', full=role==='full';
      if((role==='arcade'||role==='news')&&m.op!=='who') return J({err:'forbidden'},403);
      const FULLONLY=['grant','ungrant','clear','broadcast','lock','grantPid','kick','ban','unban']; if(FULLONLY.includes(m.op)&&!full) return J({err:'forbidden'},403);
      if(m.op==='grantPid'){ const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24), lvl=['full','mod','arcade','news'].includes(m.lvl)?m.lvl:'arcade', nm=String(m.name||'').slice(0,24); if(pid.length<8) return J({err:'bad'},400);
        const pub=pubId(pid); this.sql.exec('INSERT OR REPLACE INTO grnt2(sh,pubid,lvl,name,ts) VALUES(?,?,?,?,?)',await sha('rr-grant:'+pid),pub,lvl,nm,Date.now()); for(const ws of this.socksByPub(pub)) this.send(ws,{t:'role',lvl,url:ADMIN_URL}); return J({ok:true,pubid:pub}); }
      if(m.op==='list') return J({rows:this.sql.exec('SELECT * FROM m ORDER BY id DESC LIMIT 200').toArray()});
      if(m.op==='del'&&m.id){ this.sql.exec('UPDATE m SET hid=1 WHERE id=?',+m.id); this.all({t:'del',id:+m.id}); return J({ok:true}); }
      if(m.op==='mute'&&m.who){ this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',String(m.who),Date.now()+(+m.mins||1440)*60000); return J({ok:true}); }
      if(m.op==='kick'&&m.name){ const nm=String(m.name).toLowerCase(), mins=+m.mins||30; let n=0;
        for(const ws of this.ctx.getWebSockets()){ const b=ws.deserializeAttachment(); if(b&&String(b.name||'').toLowerCase()===nm){ n++; this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',b.who,Date.now()+mins*60000); try{ ws.send(JSON.stringify({t:'kicked',mins})); }catch(e){} try{ ws.close(4001,'kicked'); }catch(e){} } }
        return J({ok:true,kicked:n}); }
      if(m.op==='ban'){ const nm=String(m.name||'').toLowerCase(), perm=!!m.perm, until=perm?0:Date.now()+(+m.mins||1440)*60000; let n=0;
        if(nm) this.sql.exec('INSERT OR REPLACE INTO ban(nm,until) VALUES(?,?)',nm,until);
        for(const ws of this.ctx.getWebSockets()){ const b=ws.deserializeAttachment(); if(b&&((nm&&String(b.name||'').toLowerCase()===nm)||(m.pubid&&pubId(b.who)===m.pubid))){ n++; if(m.pubid&&pubId(b.who)===m.pubid) this.sql.exec('INSERT OR REPLACE INTO ban(nm,until) VALUES(?,?)','pid:'+b.who,until); try{ ws.send(JSON.stringify({t:'kicked',perm,mins:perm?0:Math.ceil((until-Date.now())/60000)})); }catch(e){} try{ ws.close(4003,'banned'); }catch(e){} } }
        return J({ok:true,banned:n}); }
      if(m.op==='unban'&&m.name){ this.sql.exec('DELETE FROM ban WHERE nm=?',String(m.name).toLowerCase()); return J({ok:true}); }
      if(m.op==='bans') return J({bans:this.sql.exec('SELECT nm,until FROM ban').toArray()});
      if(m.op==='tag'){ const nm=String(m.name||'').toLowerCase(), tg=String(m.tag||'').replace(/[^\w \-!★+]/g,'').slice(0,18); if(!nm) return J({err:'bad'},400); if(tg) this.sql.exec('INSERT OR REPLACE INTO tag(nm,tag) VALUES(?,?)',nm,tg); else this.sql.exec('DELETE FROM tag WHERE nm=?',nm); this.who(); return J({ok:true}); }
      if(m.op==='tags') return J({tags:this.sql.exec('SELECT nm,tag FROM tag').toArray()});
      if(m.op==='grant'){ if(!full) return J({err:'forbidden'},403); const pub=String(m.pubid||'').slice(0,12), lvl=m.lvl==='full'?'full':m.lvl==='arcade'?'arcade':'mod', nm=String(m.name||'').slice(0,24); if(!pub) return J({err:'bad'},400); const live=this.socksByPub(pub); if(!live.length) return J({err:'offline'},409);
        const who=live[0].deserializeAttachment().who; this.sql.exec('INSERT OR REPLACE INTO grnt2(sh,pubid,lvl,name,ts) VALUES(?,?,?,?,?)',await sha('rr-grant:'+who),pub,lvl,nm,Date.now()); for(const ws of live) this.send(ws,{t:'role',lvl,url:ADMIN_URL}); return J({ok:true}); }
      if(m.op==='ungrant'&&m.pubid){ if(!full) return J({err:'forbidden'},403); this.sql.exec('DELETE FROM grnt WHERE pubid=?',String(m.pubid)); this.sql.exec('DELETE FROM grnt2 WHERE pubid=?',String(m.pubid)); for(const ws of this.socksByPub(String(m.pubid))) this.send(ws,{t:'role',lvl:null}); return J({ok:true}); }
      if(/^(secStatus|totpBegin|totpEnable|totpDisable|setPw|sessions|revoke|revokeOthers|panic|auditLog|loginLog)$/.test(m.op||'')){ if(!full) return J({err:'forbidden'},403); const now=Date.now(), th=req.headers.get('x-admin-th')||'';
        if(m.op==='secStatus') return J({totp:!!this.cfgGet('totp'),customPw:!!this.cfgGet('pwh'),sessions:this.sql.exec('SELECT COUNT(*) AS c FROM sess WHERE exp>?',now).toArray()[0].c,grants:this.sql.exec('SELECT COUNT(*) AS c FROM grnt2').toArray()[0].c,fails24:this.sql.exec('SELECT COUNT(*) AS c FROM llog WHERE ok=0 AND ts>?',now-86400000).toArray()[0].c,locked:this.sql.exec('SELECT COUNT(*) AS c FROM rl WHERE until>?',now).toArray()[0].c});
        if(m.op==='totpBegin'){ const sec2=b32enc(crypto.getRandomValues(new Uint8Array(20))); this.cfgSet('totpPending',sec2); return J({secret:sec2,uri:`otpauth://totp/Rink%20Rivals:admin?secret=${sec2}&issuer=Rink%20Rivals&digits=6&period=30`}); }
        if(m.op==='totpEnable'){ const sec2=this.cfgGet('totpPending'); if(!sec2) return J({err:'none'},400); const st=Math.floor(now/30000); let ok=false; for(const d of [0,-1,1]) if(await totpAt(sec2,st+d)===String(m.code||'')) ok=true; if(!ok) return J({err:'badcode'},400); this.cfgSet('totp',sec2); this.cfgSet('totpLast',st); this.sql.exec("DELETE FROM cfg WHERE k='totpPending'"); return J({ok:true}); }
        if(m.op==='totpDisable'){ const sec2=this.cfgGet('totp'); if(!sec2) return J({ok:true}); const st=Math.floor(now/30000); let ok=false; for(const d of [0,-1,1]) if(await totpAt(sec2,st+d)===String(m.code||'')) ok=true; if(!ok) return J({err:'badcode'},400); this.sql.exec("DELETE FROM cfg WHERE k='totp'"); return J({ok:true}); }
        if(m.op==='setPw'){ const np=String(m.newPw||''); if(np.length<12) return J({err:'short'},400); if(!th) return J({err:'needpw'},403);
          const salt=b32enc(crypto.getRandomValues(new Uint8Array(16))); this.cfgSet('pwh',JSON.stringify({salt,hash:await pbkdf(np,salt)})); this.sql.exec('DELETE FROM sess WHERE th<>?',th); return J({ok:true}); }
        if(m.op==='sessions') return J({sessions:this.sql.exec('SELECT th,role,exp,ip,created,last,ua FROM sess WHERE exp>? ORDER BY last DESC',now).toArray().map(r=>({id:r.th.slice(0,12),me:r.th===th,role:r.role,ip:r.ip,created:r.created,last:r.last,ua:r.ua,exp:r.exp}))});
        if(m.op==='revoke'){ this.sql.exec('DELETE FROM sess WHERE substr(th,1,12)=? AND th<>?',String(m.id||''),th); return J({ok:true}); }
        if(m.op==='revokeOthers'){ this.sql.exec('DELETE FROM sess WHERE th<>?',th); return J({ok:true}); }
        if(m.op==='panic'){ this.sql.exec('DELETE FROM sess'); this.sql.exec('DELETE FROM grnt2'); this.sql.exec('DELETE FROM grnt'); for(const ws of this.socks()) this.send(ws,{t:'role',lvl:null}); return J({ok:true}); }
        if(m.op==='auditLog') return J({rows:this.sql.exec('SELECT ts,who,ip,what,detail FROM alog ORDER BY id DESC LIMIT 200').toArray()});
        if(m.op==='loginLog') return J({rows:this.sql.exec('SELECT ts,ok,ip,why,ua FROM llog ORDER BY id DESC LIMIT 150').toArray()}); }
      if(m.op==='grantself'){ if(!full) return J({err:'forbidden'},403); const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); if(pid.length<8) return J({err:'bad'},400); const pub=pubId(pid);
        this.sql.exec('INSERT OR REPLACE INTO grnt2(sh,pubid,lvl,name,ts) VALUES(?,?,?,?,?)',await sha('rr-grant:'+pid),pub,'full',String(m.name||'Owner').slice(0,24),Date.now()); for(const ws of this.socksByPub(pub)) this.send(ws,{t:'role',lvl:'full',url:ADMIN_URL}); return J({ok:true}); }
      if(m.op==='grants') return J({grants:this.sql.exec('SELECT pubid,lvl,name,ts FROM grnt2 ORDER BY ts DESC').toArray()});
      if(m.op==='who'){ const seen=new Set(), out=[]; for(const ws of this.socks()){ const a=ws.deserializeAttachment(); if(seen.has(a.who)) continue; seen.add(a.who); out.push({name:a.name,game:a.game,id:pubId(a.who),tag:this.tagOf(a.name)}); } return J({who:out}); }
      if(m.op==='recent'){ const rows=this.sql.exec('SELECT name FROM m WHERE hid=0 ORDER BY id DESC LIMIT 300').toArray(); const seen=new Set(), out=[]; for(const r of rows){ const k=r.name.toLowerCase(); if(seen.has(k)) continue; seen.add(k); out.push({name:r.name,tag:this.tagOf(r.name),banned:!!this.isBanned(r.name)}); if(out.length>=40) break; } return J({recent:out}); }
      if(m.op==='reservedSet'){ if(!full) return J({err:'forbidden'},403); this.cfgSet('reserved',JSON.stringify(Array.isArray(m.list)?m.list:[])); return J({ok:true}); }
      if(m.op==='msgs') return J({msgs:this.sql.exec('SELECT id,ts,name,text,game,hid FROM m ORDER BY id DESC LIMIT 200').toArray(),slow:+(this.cfgGet('slow')||0),words:JSON.parse(this.cfgGet('words')||'[]')});
      if(m.op==='slow'){ this.cfgSet('slow',Math.max(0,Math.min(600,Math.round(+m.secs||0)))); return J({ok:true}); }
      if(m.op==='words'){ const w=(Array.isArray(m.words)?m.words:[]).map(x=>String(x).toLowerCase().trim().slice(0,30)).filter(Boolean).slice(0,200); this.cfgSet('words',JSON.stringify(w)); return J({ok:true}); }
      if(m.op==='clear'){ this.sql.exec('UPDATE m SET hid=1'); this.all({t:'clear'}); return J({ok:true}); }
      if(m.op==='broadcast'){ const text=String(m.text||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,300); if(!text) return J({err:'empty'},400);
        const now=Date.now(); this.sql.exec('INSERT INTO m(ts,name,text,game,who) VALUES(?,?,?,?,?)',now,'📣 Arcade Rivals',text,'',' admin');
        const id=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; this.sql.exec('DELETE FROM m WHERE id<?',id-600);
        this.all({t:'msg',m:{id,ts:now,name:'📣 Arcade Rivals',text,game:'',tag:'NEWS'}}); return J({ok:true}); }
      if(m.op==='smute'&&m.name){ const nm=String(m.name).toLowerCase(), mins=Math.max(1,+m.mins||15); let n=0;
        for(const ws of this.socks()){ const b=ws.deserializeAttachment(); if(b&&String(b.name||'').toLowerCase()===nm){ n++; this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',b.who,Date.now()+mins*60000); this.send(ws,{t:'sys',text:`You have been muted for ${mins} minute${mins===1?'':'s'} by an admin.`}); } }
        return J({ok:true,muted:n}); }
      if(m.op==='unmute'&&m.name){ const nm=String(m.name).toLowerCase(); let n=0;
        for(const ws of this.socks()){ const b=ws.deserializeAttachment(); if(b&&String(b.name||'').toLowerCase()===nm){ this.sql.exec('DELETE FROM mute WHERE who=?',b.who); this.send(ws,{t:'sys',text:'An admin has unmuted you — you can chat again.'}); n++; } }
        return J({ok:true,unmuted:n}); }
      if(m.op==='muted'){ const now=Date.now(), seen=new Set(), out=[]; for(const ws of this.socks()){ const a=ws.deserializeAttachment(); const k=a.name.toLowerCase(); if(seen.has(k)) continue; const r=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(r&&r.until>now){ seen.add(k); out.push({name:a.name,mins:Math.ceil((r.until-now)/60000)}); } } return J({muted:out}); }
      if(m.op==='lock'){ const on=!!m.on; this.cfgSet('locked',on?'1':'0'); this.all({t:'sys',text:on?'🔒 Chat has been locked by an admin.':'🔓 Chat is open again.'}); return J({ok:true,locked:on}); }
      if(m.op==='lockstatus') return J({locked:this.cfgGet('locked')==='1'});
      if(m.op==='stats'){ return J({online:this.people(),connections:this.socks().length,
        bans:this.sql.exec('SELECT COUNT(*) AS c FROM ban').toArray()[0].c,
        tags:this.sql.exec('SELECT COUNT(*) AS c FROM tag').toArray()[0].c,
        admins:this.sql.exec('SELECT COUNT(*) AS c FROM grnt2').toArray()[0].c,
        locked:this.cfgGet('locked')==='1'}); }
      return J({err:'op'},400); }
    if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
    const pair=new WebSocketPair(); const [client,server]=Object.values(pair); this.ctx.acceptWebSocket(server);
    this.send(server,{t:'hist',m:this.hist(),n:this.socks().length+1});
    return new Response(null,{status:101,webSocket:client}); }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>1500) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    let a=ws.deserializeAttachment();
    if(m.t==='hello'){ const who=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24)||crypto.randomUUID().slice(0,12); let nm=cleanName(m.name); let swapped=false;
      if(reservedFor(nm,who,JSON.parse(this.cfgGet('reserved')||'[]'))){ nm='Player'+Math.floor(1000+Math.random()*9000); swapped=true; }
      const b=this.isBanned(nm,who); if(b){ this.send(ws,{t:'kicked',perm:b.until===0,mins:b.until===0?0:Math.ceil((b.until-Date.now())/60000)}); try{ ws.close(4003,'banned'); }catch(e){} return; }
      a={name:nm,game:String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home',who,ts:[],last:''}; ws.serializeAttachment(a);
      { const me2=pubId(who), rows=this.sql.exec('SELECT ts,fpub,fname,tpub,tname,text,seen FROM dmsg WHERE fpub=? OR tpub=? ORDER BY id DESC LIMIT 150',me2,me2).toArray().reverse(); if(rows.length){ this.send(ws,{t:'dmhist',list:rows.map(r=>({self:r.fpub===me2,from:r.fpub,fromName:r.fname,to:r.tpub,toName:r.tname,text:r.text,ts:r.ts,unseen:r.tpub===me2&&!r.seen}))}); this.sql.exec('UPDATE dmsg SET seen=1 WHERE tpub=?',me2); } }
      if(swapped){ this.send(ws,{t:'you',name:nm}); this.send(ws,{t:'sys',text:'That name is reserved, so you were given a different one. Pick a new name with ✎ Name.'}); }
      const g=await this.grantOfWho(who); this.send(ws,g?{t:'role',lvl:g,url:ADMIN_URL}:{t:'role',lvl:null}); this.count(); return; }
    if(!a) return;
    if(m.t==='where'){ a.game=String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home'; ws.serializeAttachment(a); this.who(); return; }
    if(m.t==='dm'){ const now=Date.now(), to=String(m.to||'').slice(0,12); if(!to) return;
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:`You are muted for ${Math.ceil((mu.until-now)/60000)} more minutes.`}); return; }
      let text=String(m.text||'').replace(/[\u0000-\u001f​-‏‪-‮]/g,'').replace(/\s+/g,' ').trim().slice(0,300); if(!text) return;
      a.ts=(a.ts||[]).filter(t=>now-t<10000); if(a.ts.length>=12){ this.send(ws,{t:'sys',text:'Slow down a moment.'}); return; }
      if(PERSONAL.test(text)){ this.send(ws,{t:'sys',text:"For your safety, don't share phone numbers, emails, addresses or ages."}); return; }
      for(const r of CHAT_BAD){ r.lastIndex=0; text=text.replace(r,w=>'*'.repeat(w.length)); }
      a.ts.push(now); ws.serializeAttachment(a); const mine=pubId(a.who), tg=this.tagOf(a.name);
      const tgts=this.socksByPub(to); for(const s of tgts) this.send(s,{t:'dm',from:mine,fromName:a.name,tag:tg,text,ts:now});
      const toName=tgts[0]?tgts[0].deserializeAttachment().name:String(m.toName||'Player').slice(0,20);
      this.sql.exec('INSERT INTO dmsg(ts,fpub,fname,tpub,tname,text,seen) VALUES(?,?,?,?,?,?,?)',now,mine,a.name,to,toName,text,tgts.length?1:0); this.sql.exec('DELETE FROM dmsg WHERE id<(SELECT MAX(id)-8000 FROM dmsg)');
      this.send(ws,{t:'dm',from:mine,to,toName,self:true,text,ts:now,delivered:tgts.length>0}); return; }
    if(m.t==='invite'){ const now=Date.now(), to=String(m.to||'').slice(0,12), room=String(m.room||'').toUpperCase(), game=String(m.game||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,16);
      if(!to||!/^[A-Z0-9]{4,8}$/.test(room)||!game) return;
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:'You are muted, so you cannot send invites right now.'}); return; }
      a.inv=(a.inv||[]).filter(t=>now-t<60000); if(a.inv.length>=6){ this.send(ws,{t:'invsent',ok:false,to,why:'Slow down on the invites, try again in a minute.'}); return; }
      const targets=this.socks().filter(s=>{ const b=s.deserializeAttachment(); return b&&pubId(b.who)===to&&b.who!==a.who; });
      if(!targets.length){ this.send(ws,{t:'invsent',ok:false,to,why:'They are not online any more.'}); return; }
      a.inv.push(now); ws.serializeAttachment(a); const tn=targets[0].deserializeAttachment().name;
      for(const s of targets) this.send(s,{t:'invite',from:a.name,game,room});
      this.send(ws,{t:'invsent',ok:true,to,name:tn}); return; }
    if(m.t==='name'){ const nm=cleanName(m.name); if(reservedFor(nm,a.who,JSON.parse(this.cfgGet('reserved')||'[]'))){ this.send(ws,{t:'sys',text:'That name is reserved — please choose another one.'}); this.send(ws,{t:'you',name:a.name}); return; } if(this.isBanned(nm,a.who)){ this.send(ws,{t:'kicked',perm:true}); try{ ws.close(4003,'banned'); }catch(e){} return; } a.name=nm; ws.serializeAttachment(a); this.send(ws,{t:'you',name:a.name}); this.who(); return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; }
    if(m.t==='report'){ const id=+m.id; if(!id) return; this.sql.exec('INSERT OR IGNORE INTO r(mid,who) VALUES(?,?)',id,a.who); const c=this.sql.exec('SELECT COUNT(*) AS c FROM r WHERE mid=?',id).toArray()[0].c;
      if(c>=3){ const row=this.sql.exec('SELECT who FROM m WHERE id=?',id).toArray()[0]; this.sql.exec('UPDATE m SET hid=1 WHERE id=?',id); this.all({t:'del',id}); if(row){ const n=this.sql.exec('SELECT COUNT(*) AS c FROM m WHERE who=? AND hid=1 AND ts>?',row.who,Date.now()-86400000).toArray()[0].c; if(n>=2) this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',row.who,Date.now()+3600000*(n>=4?24:1)); } }
      this.send(ws,{t:'sys',text:'Thanks, that message was reported.'}); return; }
    if(m.t==='say'){ const now=Date.now();
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:`You are muted for ${Math.ceil((mu.until-now)/60000)} more minutes.`}); return; }
      if(this.cfgGet('locked')==='1'&&!(await this.grantOfWho(a.who))){ this.send(ws,{t:'sys',text:'Chat is locked by an admin right now.'}); return; }
      let text=String(m.text||'').replace(/[\u0000-\u001f​-‏‪-‮]/g,'').replace(/\s+/g,' ').trim().slice(0,200); if(!text) return;
      a.ts=(a.ts||[]).filter(t=>now-t<10000); if(a.ts.length>=8){ this.send(ws,{t:'sys',text:'That is a lot of messages at once, give it a few seconds.'}); return; }
      if(text.toLowerCase()===a.last){ this.send(ws,{t:'sys',text:'You just said that.'}); return; }
      if(gibberish(text)){ this.send(ws,{t:'sys',text:'That looks like keyboard mashing, so it was not sent.'}); return; }
      if(PERSONAL.test(text)){ this.send(ws,{t:'sys',text:'For your safety, don\'t share or ask for phone numbers, emails, addresses or ages.'}); return; }
      for(const r of CHAT_BAD){ r.lastIndex=0; text=text.replace(r,w=>'*'.repeat(w.length)); }
      if(/(.)\1{9,}/.test(text)) text=text.replace(/(.)\1{9,}/g,(x,c)=>c.repeat(5));
      { const extra=JSON.parse(this.cfgGet('words')||'[]'); for(const w of extra){ if(!w) continue; const re=new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'); text=text.replace(re,x=>'*'.repeat(x.length)); } }
      { const slow=+(this.cfgGet('slow')||0); if(slow>0&&!(await this.grantOfWho(a.who))&&a.lastSay&&now-a.lastSay<slow*1000){ this.send(ws,{t:'sys',text:`Slow mode is on — wait ${Math.ceil((slow*1000-(now-a.lastSay))/1000)}s between messages.`}); return; } a.lastSay=now; }
      a.ts.push(now); a.last=text.toLowerCase(); ws.serializeAttachment(a);
      this.sql.exec('INSERT INTO m(ts,name,text,game,who) VALUES(?,?,?,?,?)',now,a.name,text,a.game,a.who);
      const id=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; this.sql.exec('DELETE FROM m WHERE id<?',id-600);
      this.all({t:'msg',m:{id,ts:now,name:a.name,text,game:a.game,tag:this.tagOf(a.name)}}); return; } }
  async webSocketClose(ws){ try{ ws.serializeAttachment(null); ws.close(); }catch(e){} this.count(); }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}


/* Site config: a full-screen update announcement and admin player edits, read by every page from /site.
   Only the admin tools (with a key) can change it. */
export class Site {
  useTick(kind,n){ const d=new Date().toISOString().slice(0,10); if(!this.use||this.use.d!==d) this.use={d,req:0,beat:0,wr:0,saved:0}; this.use[kind]=(this.use[kind]||0)+(n||1); }
  constructor(ctx){ this.ctx=ctx; this.s=ctx.storage; const raw=ctx.storage.sql; this.sql={exec:(q,...a)=>{ if(/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(q)) this.useTick('wr'); return raw.exec(q,...a); }};   /* counts database writes for the admin usage card */
    /* every player who opens the site, things queued for them (messages, gifts, kicks), and site-wide bans */
    this.sql.exec('CREATE TABLE IF NOT EXISTS pl(pid TEXT PRIMARY KEY, name TEXT, first INTEGER, last INTEGER, beats INTEGER, game TEXT, iph TEXT, secs REAL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS cmd(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, kind TEXT, data TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sban(k TEXT PRIMARY KEY, kind TEXT, name TEXT, reason TEXT, until INTEGER, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pnames(pid TEXT, name TEXT, first INTEGER, last INTEGER, PRIMARY KEY(pid,name))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pnote(pid TEXT PRIMARY KEY, text TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS allow(pid TEXT PRIMARY KEY, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS vote(poll TEXT, pid TEXT, opt INTEGER, PRIMARY KEY(poll,pid))');
    try{ this.sql.exec('ALTER TABLE pl ADD COLUMN dev TEXT'); }catch(e){} try{ this.sql.exec('ALTER TABLE pl ADD COLUMN aso TEXT'); }catch(e){} try{ this.sql.exec('ALTER TABLE pl ADD COLUMN cc TEXT'); }catch(e){} try{ this.sql.exec('ALTER TABLE pl ADD COLUMN fp TEXT'); }catch(e){}
    this.sql.exec('CREATE TABLE IF NOT EXISTS namereq(pid TEXT PRIMARY KEY, old TEXT, want TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS act(h INTEGER, pid TEXT, PRIMARY KEY(h,pid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ans(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, name TEXT, q TEXT, a TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS slog(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, op TEXT, detail TEXT)');
    /* Arcade Clips: posts, the media itself in 1 MB chunks, likes, comments, reports and posting bans */
    this.sql.exec('CREATE TABLE IF NOT EXISTS fpost(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, name TEXT, kind TEXT, mime TEXT, size INTEGER, cap TEXT, ts INTEGER, st TEXT, nchunk INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS fblob(post INTEGER, i INTEGER, d BLOB, PRIMARY KEY(post,i))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS flike(id TEXT, pid TEXT, PRIMARY KEY(id,pid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS fcom(cid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT, pid TEXT, name TEXT, text TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS frep(id TEXT, pid TEXT, ts INTEGER, PRIMARY KEY(id,pid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS fban(pid TEXT PRIMARY KEY, ts INTEGER)');
    /* every visit: who, when they came on, when they were last seen, and where they were */
    this.sql.exec('CREATE TABLE IF NOT EXISTS visit(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, name TEXT, start INTEGER, last INTEGER, game TEXT, games TEXT, dev TEXT, aso TEXT, proxy INTEGER DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pxok(pid TEXT PRIMARY KEY, ts INTEGER)');
    /* indexes so every check-in reads a handful of rows, not whole tables (the free plan allows 5 million row reads a day) */
    this._ixq=['CREATE INDEX IF NOT EXISTS pl_lname ON pl(lower(name))','DROP INDEX IF EXISTS pl_last','CREATE INDEX IF NOT EXISTS visit_pid ON visit(pid,id)','CREATE INDEX IF NOT EXISTS cmd_pid ON cmd(pid,ts)','CREATE INDEX IF NOT EXISTS cmd_ts ON cmd(ts)','CREATE INDEX IF NOT EXISTS pnames_name ON pnames(name)','CREATE INDEX IF NOT EXISTS fcom_id ON fcom(id)','CREATE INDEX IF NOT EXISTS flike_id ON flike(id)']; this.ensureIx(); }
  ensureIx(){ if(this._ixOk) return; try{ for(const q of this._ixq) this.sql.exec(q); this._ixOk=true; }catch(e){} }
  /* is this name already someone else's? (reserved names are allowed for the devices they're reserved for) */
  nameTaken(name,pid,set){ const k=String(name||'').toLowerCase().trim(); if(!k||/^player\d*$/.test(k)) return false;  const r=(set.reserved||[]).find(x=>nameKey(name).startsWith(x.n)); if(r&&(r.pids||[]).includes(pid)) return false;
    /* the earliest accounts to use a name keep it — 1 per name, except "Aiden" which up to 10 people can share */ const cap=k==='aiden'?10:1, n=this.sql.exec('SELECT COUNT(*) n FROM pl WHERE lower(name)=? AND pid<>? AND first<COALESCE((SELECT first FROM pl WHERE pid=? AND lower(name)=?),9e15)',k,pid,pid,k).one().n; return n>=cap; }
  pollRes(p){ const r=p.opts.map(()=>0); for(const v of this.sql.exec('SELECT opt FROM vote WHERE poll=?',p.id).toArray()) if(r[v.opt]!=null) r[v.opt]++; return r; }
  queue(pid,kind,data,ts){ this.sql.exec('INSERT INTO cmd(pid,kind,data,ts) VALUES(?,?,?,?)',pid,kind,JSON.stringify(data||{}),ts||Date.now()); }
  banFor(pid,iph,name,fp){ const now=Date.now(); for(const k of ['p:'+pid,'n:'+String(name||'').toLowerCase(),...(fp?['f:'+fp]:[])]){ const r=this.sql.exec('SELECT reason,until FROM sban WHERE k=?',k).toArray()[0]; if(r&&(r.until===0||r.until>now)) return {reason:r.reason||'',until:r.until}; } return null; }
  async state(){ const poll=await this.s.get('poll'); return { poll: poll&&poll.open?{id:poll.id,q:poll.q,opts:poll.opts}:null, ann: await this.s.get('ann')||null, ov: await this.s.get('ov')||[], settings: await this.s.get('settings')||{}, tourneys: await this.s.get('tourneys')||[] }; }
  /* ---- daily play time + daily challenge ---- */
  day(){ try{ return new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'}); }catch(e){ return new Date().toISOString().slice(0,10); } }
  async board(d){ const m=(await this.s.get('pt:'+d))||{}; return Object.entries(m).map(([pid,v])=>({pid,name:v.n,s:Math.round(v.s)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s); }
  async prevDay(d){ const days=(await this.s.get('ptDays'))||[]; const i=days.indexOf(d); return i>0?days[i-1]:(i<0&&days.length?days[days.length-1]:null); }
  async trackDay(d){ const days=(await this.s.get('ptDays'))||[]; if(days.includes(d)) return; days.push(d); while(days.length>10){ const old=days.shift(); await this.s.delete('pt:'+old); } await this.s.put('ptDays',days); }
  async addAch(pid,e){ const k='ach:'+pid, a=(await this.s.get(k))||[]; a.push({ts:Date.now(),...e}); await this.s.put(k,a.slice(-100)); }
  async archiveChal(){ const c=await this.s.get('chal'); if(!c) return; const h=(await this.s.get('chalHist'))||[]; h.push({day:c.day,game:c.game,goal:c.goal,winner:c.winner?c.winner.name:null,prize:c.pick?c.pick.prize:null}); await this.s.put('chalHist',h.slice(-30)); }
  async fetch(req){ this.ensureIx(); this.useTick('req'); if(new URL(req.url).pathname==='/play') this.useTick('beat');
    const url=new URL(req.url);
    const cleanPid=v=>String(v||'').replace(/[^a-z0-9]/gi,'').slice(0,24), cleanName=v=>String(v||'').replace(/[<>]/g,'').trim().slice(0,20)||'Player';

    /* ---------- Arcade Clips (the video feed) ---------- */
    if(url.pathname.startsWith('/feed/')){ const set=(await this.s.get('settings'))||{}, now=Date.now(), bad=t=>CHAT_BAD.some(r=>{ r.lastIndex=0; return r.test(t); });
      if(url.pathname.startsWith('/feed/media/')){ const id=+url.pathname.split('/').pop(), p=this.sql.exec('SELECT mime,size,nchunk,st FROM fpost WHERE id=?',id).toArray()[0]; if(!p||p.st==='gone') return new Response('Not found',{status:404,headers:CORS});
        const CH=1048576, rg=/bytes=(\d*)-(\d*)/.exec(req.headers.get('range')||''); let a=0, b=p.size-1; if(rg){ if(rg[1]!=='') a=+rg[1]; if(rg[2]!=='') b=Math.min(p.size-1,+rg[2]); else b=Math.min(p.size-1,a+4*CH-1); if(rg[1]===''&&rg[2]!==''){ a=Math.max(0,p.size-+rg[2]); b=p.size-1; } }
        if(a>b||a>=p.size) return new Response(null,{status:416,headers:{...CORS,'content-range':`bytes */${p.size}`}});
        const out=new Uint8Array(b-a+1); let o=0; for(let i=Math.floor(a/CH);i<=Math.floor(b/CH);i++){ const r=this.sql.exec('SELECT d FROM fblob WHERE post=? AND i=?',id,i).toArray()[0]; if(!r) break; const d=new Uint8Array(r.d), s0=i*CH, from=Math.max(a,s0)-s0, to=Math.min(b,s0+d.length-1)-s0; out.set(d.subarray(from,to+1),o); o+=to-from+1; }
        return new Response(out,{status:rg?206:200,headers:{...CORS,'content-type':p.mime,'accept-ranges':'bytes','content-length':String(out.length),...(rg?{'content-range':`bytes ${a}-${b}/${p.size}`}:{}),'cache-control':'public,max-age=86400'}}); }
      if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
      const iph=(await sha('rr-ip:'+(req.headers.get('cf-connecting-ip')||'?'))).slice(0,24);
      if(url.pathname==='/feed/upload'){ const pid=cleanPid(req.headers.get('x-pid')), name=cleanName(decodeURIComponent(req.headers.get('x-name')||'')), cap=decodeURIComponent(req.headers.get('x-cap')||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,200), mime=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
        if(pid.length<8) return J({err:'bad'},400); if(set.feedOff) return J({err:'off'}); if(this.banFor(pid,iph,name,'')||this.sql.exec('SELECT 1 FROM fban WHERE pid=?',pid).toArray().length) return J({err:'banned'});
        const kind=/^video\/(mp4|webm|quicktime)$/.test(mime)?'video':/^image\/(jpeg|png|gif|webp)$/.test(mime)?'image':''; if(!kind) return J({err:'type'}); if(cap&&bad(cap)) return J({err:'words'});
        if(this.sql.exec('SELECT COUNT(*) n FROM fpost WHERE pid=? AND ts>?',pid,now-3600000).one().n>=5) return J({err:'slow'});
        const buf=new Uint8Array(await req.arrayBuffer()), max=kind==='video'?20e6:6e6; if(!buf.length) return J({err:'empty'}); if(buf.length>max) return J({err:'big',max});
        const st=set.feedApprove===false?'ok':'pending'; this.sql.exec('INSERT INTO fpost(pid,name,kind,mime,size,cap,ts,st,nchunk) VALUES(?,?,?,?,?,?,?,?,?)',pid,name,kind,mime,buf.length,cap,now,st,Math.ceil(buf.length/1048576));
        const id=this.sql.exec('SELECT last_insert_rowid() id').one().id; for(let i=0;i*1048576<buf.length;i++) this.sql.exec('INSERT INTO fblob(post,i,d) VALUES(?,?,?)',id,i,buf.subarray(i*1048576,Math.min(buf.length,(i+1)*1048576)));
        return J({ok:true,id,st}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid);
      if(url.pathname==='/feed/list'){ const posts=this.sql.exec("SELECT id,name,kind,cap,ts FROM fpost WHERE st='ok' ORDER BY id DESC LIMIT 300").toArray().map(p=>({...p,id:'p:'+p.id}));
        const likes={}, coms={}; for(const r of this.sql.exec('SELECT id,COUNT(*) n FROM flike GROUP BY id').toArray()) likes[r.id]=r.n; for(const r of this.sql.exec('SELECT id,COUNT(*) n FROM fcom GROUP BY id').toArray()) coms[r.id]=r.n;
        const mine=pid?this.sql.exec('SELECT id FROM flike WHERE pid=?',pid).toArray().map(r=>r.id):[], pend=pid?this.sql.exec("SELECT COUNT(*) n FROM fpost WHERE pid=? AND st='pending'",pid).one().n:0;
        return J({posts,likes,coms,mine,hide:set.feedHide||[],approve:set.feedApprove!==false,off:!!set.feedOff,pend}); }
      if(pid.length<8) return J({err:'bad'},400); const id=String(m.id||'').replace(/[^a-z0-9:]/gi,'').slice(0,40); if(!id) return J({err:'bad'},400);
      if(url.pathname==='/feed/like'){ if(m.on) this.sql.exec('INSERT OR IGNORE INTO flike(id,pid) VALUES(?,?)',id,pid); else this.sql.exec('DELETE FROM flike WHERE id=? AND pid=?',id,pid); return J({ok:true,n:this.sql.exec('SELECT COUNT(*) n FROM flike WHERE id=?',id).one().n}); }
      if(url.pathname==='/feed/comments') return J({list:this.sql.exec('SELECT cid,name,text,ts FROM fcom WHERE id=? ORDER BY cid DESC LIMIT 100',id).toArray()});
      if(url.pathname==='/feed/comment'){ const name=cleanName(m.name), text=String(m.text||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,200); if(!text) return J({err:'empty'});
        if(this.banFor(pid,iph,name,'')||this.sql.exec('SELECT 1 FROM fban WHERE pid=?',pid).toArray().length) return J({err:'banned'}); if(bad(text)) return J({err:'words'});
        if(this.sql.exec('SELECT COUNT(*) n FROM fcom WHERE pid=? AND ts>?',pid,now-600000).one().n>=15) return J({err:'slow'});
        this.sql.exec('INSERT INTO fcom(id,pid,name,text,ts) VALUES(?,?,?,?,?)',id,pid,name,text,now); if(Math.random()<.02) this.sql.exec('DELETE FROM fcom WHERE cid<(SELECT MAX(cid)-20000 FROM fcom)'); return J({ok:true}); }
      if(url.pathname==='/feed/report'){ this.sql.exec('INSERT OR IGNORE INTO frep(id,pid,ts) VALUES(?,?,?)',id,pid,now); const n=this.sql.exec('SELECT COUNT(*) n FROM frep WHERE id=?',id).one().n;
        /* two reports and a player's post is hidden until an admin looks at it */ if(id.startsWith('p:')&&n>=2) this.sql.exec("UPDATE fpost SET st='hidden' WHERE id=? AND st='ok'",+id.slice(2)); return J({ok:true}); }
      return J({err:'unknown'},404); }
    if(url.pathname==='/play'){ let m={}; try{ m=await req.json(); }catch(e){}
      const pid=cleanPid(m.pid), name=cleanName(m.name); if(pid.length<8) return J({err:'bad'},400);
      const now0=Date.now(), iph=(await sha('rr-ip:'+(req.headers.get('cf-connecting-ip')||'?'))).slice(0,24), game=String(m.game||'').replace(/[^a-z0-9-]/g,'').slice(0,24);
      const fp=String(m.fp||'').replace(/[^a-z0-9]/gi,'').slice(0,24), set0=(await this.s.get('settings'))||{};
      const ex=this.sql.exec('SELECT last,name,beats FROM pl WHERE pid=?',pid).toArray()[0], gap=ex?now0-ex.last:0; let name2=name, forced=null;
      /* name lock: once you have a name you keep it, unless an admin approves a change */
      if(ex&&set0.nameLock&&ex.name&&ex.name.toLowerCase()!==name.toLowerCase()&&!/^player\d*$/i.test(ex.name)&&!/^player\d*$/i.test(name)){ this.sql.exec('INSERT OR REPLACE INTO namereq(pid,old,want,ts) VALUES(?,?,?,?)',pid,ex.name,name,now0); name2=ex.name; forced={name:ex.name,why:'locked',was:name}; }
      /* unique names: if someone else already has it, you get a different one */
      else if(this.nameTaken(name,pid,set0)){ name2='Player'+Math.floor(1000+Math.random()*9000); forced={name:name2,why:'taken',was:name}; }
      if(forced) this.queue(pid,'rename',forced);
      /* still called "Player" after a minute of playing: send them back to the name screen */
      else if(ex&&ex.beats>=2&&/^(player|guest|you|anonymous|user|unknown|name|me)\s*\d*$/i.test(name2)){ this.genT=this.genT||{}; if(now0-(this.genT[pid]||0)>90000){ this.genT[pid]=now0; this.queue(pid,'rename',{name:name2,why:'generic'}); } }
      const asn=req.headers.get('x-rr-asn')||'', aso=req.headers.get('x-rr-aso')||'', onPx=isProxyNet(asn,aso), dev0=devOf(req.headers.get('user-agent')), aso2=(onPx?'⚠️ ':'')+aso, cc0=req.headers.get('x-rr-cc')||'';
      if(ex) this.sql.exec('UPDATE pl SET name=?,last=?,beats=beats+1,game=?,iph=?,fp=?,secs=secs+?,dev=?,aso=?,cc=? WHERE pid=?',name2,now0,game,iph,fp,gap>0&&gap<=90000?gap/1000:0,dev0,aso2,cc0,pid);
      else this.sql.exec('INSERT INTO pl(pid,name,first,last,beats,game,iph,secs,fp,dev,aso,cc) VALUES(?,?,?,?,1,?,?,0,?,?,?,?)',pid,name2,now0,now0,game,iph,fp,dev0,aso2,cc0);
      this.live=this.live||new Map(); this.live.set(pid,now0);
      const set=set0;
      /* a reserved name used by anyone else is swapped for a random one on the spot */ if(reservedFor(name,pid,set.reserved)){ const nn='Player'+Math.floor(1000+Math.random()*9000); this.queue(pid,'rename',{name:nn,why:'reserved',was:name}); this.sql.exec('UPDATE pl SET name=? WHERE pid=?',nn,pid); }
      else if(!ex||ex.name!==name2||ex.beats%60===0) this.sql.exec('INSERT INTO pnames(pid,name,first,last) VALUES(?,?,?,?) ON CONFLICT(pid,name) DO UPDATE SET last=excluded.last',pid,name2,now0,now0);
      /* blocked words in names: renamed on the spot */ const nb=(set.nameBlock||[]).find(w=>w&&name.toLowerCase().includes(w)); if(nb){ const nn='Player'+Math.floor(1000+Math.random()*9000); this.queue(pid,'rename',{name:nn}); this.sql.exec('UPDATE pl SET name=? WHERE pid=?',nn,pid); }
      if(Array.isArray(m.ans)) for(const x of m.ans.slice(0,5)){ const q=String(x&&x.q||'').slice(0,240), a1=String(x&&x.a||'').slice(0,500); if(q) this.sql.exec('INSERT INTO ans(pid,name,q,a,ts) VALUES(?,?,?,?,?)',pid,name2,q,a1,now0); }
      { const h=Math.floor(now0/3600000); this.actSeen=this.actSeen||new Map(); if(this.actSeen.get(pid)!==h){ this.actSeen.set(pid,h); this.sql.exec('INSERT OR IGNORE INTO act(h,pid) VALUES(?,?)',h,pid); if(Math.random()<.01) this.sql.exec('DELETE FROM act WHERE h<?',h-24*14); }
        let on=0; for(const [k,t] of this.live){ if(now0-t<100000) on++; else if(now0-t>300000) this.live.delete(k); } this.peakN=this.peakN??(((await this.s.get('peak'))||{n:0}).n); if(on>this.peakN){ this.peakN=on; await this.s.put('peak',{n:on,ts:now0}); } }
      if(!ex&&set.welcome) this.queue(pid,'msg',{title:'👋 Welcome to Arcade Rivals!',text:set.welcome});
      { const sc=(await this.s.get('sched'))||[]; if(sc.length&&sc.some(x=>x.at<=now0)){ for(const x of sc.filter(x=>x.at<=now0)) this.queue('*','msg',{title:x.title||'📣 Announcement',text:x.text},now0-1); await this.s.put('sched',sc.filter(x=>x.at>now0)); } }
      { this.vis=this.vis||new Map(); let v=this.vis.get(pid); if(!v){ v=this.sql.exec('SELECT id,last,games FROM visit WHERE pid=? ORDER BY id DESC LIMIT 1',pid).toArray()[0]; if(v) this.vis.set(pid,v); } const dv=dev0;
        if(v&&now0-v.last<180000&&now0-v.last<85000&&String(v.games||'').split(',').includes(game)&&!onPx){ /* nothing new: skip the write */ }
        else if(v&&now0-v.last<180000){ const gs=new Set(String(v.games||'').split(',').filter(Boolean)); if(game) gs.add(game); v.games=[...gs].slice(-12).join(',');v.last=now0;this.sql.exec('UPDATE visit SET last=?,name=?,game=?,games=?,proxy=MAX(proxy,?) WHERE id=?',now0,name2,game,v.games,onPx?1:0,v.id); }
        else { this.sql.exec('INSERT INTO visit(pid,name,start,last,game,games,dev,aso,proxy) VALUES(?,?,?,?,?,?,?,?,?)',pid,name2,now0,now0,game,game,dv,aso,onPx?1:0); this.vis.set(pid,{id:this.sql.exec('SELECT last_insert_rowid() id').one().id,last:now0,games:game}); if(Math.random()<.02) this.sql.exec('DELETE FROM visit WHERE id<(SELECT MAX(id)-20000 FROM visit)'); } }
      let ban=this.banFor(pid,iph,name,fp);
      if(!ban&&onPx&&set.proxyBlock!==false&&!this.sql.exec('SELECT 1 FROM pxok WHERE pid=?',pid).toArray().length) ban={reason:'Proxies, VPNs and unblocker sites are not allowed on Arcade Rivals. Turn it off, then reload the page.',until:now0+60000,proxy:true};
      /* invite-only: accounts first seen after the lock was switched on wait for approval */
      if(!ban&&set.newLock&&set.newLockAt){ const f=this.sql.exec('SELECT first FROM pl WHERE pid=?',pid).toArray()[0]; if(f&&f.first>set.newLockAt&&!this.sql.exec('SELECT 1 FROM allow WHERE pid=?',pid).toArray().length) ban={reason:'Arcade Rivals is invite-only right now. Ask an admin to let you in.',until:0,invite:true}; }
      const cmds=this.sql.exec("SELECT id,kind,data FROM cmd WHERE pid=? OR (pid='*' AND ts>?) ORDER BY id",pid,ex?ex.last:now0).toArray().map(c=>({id:c.id,kind:c.kind,data:JSON.parse(c.data||'{}')}));
      if(cmds.some(c=>true)) this.sql.exec('DELETE FROM cmd WHERE pid=?',pid); if(Math.random()<.02) this.sql.exec("DELETE FROM cmd WHERE pid='*' AND ts<?",now0-3600000);
      const extra={ban,cmds};
      const d=this.day(), k='pt:'+d, map=(this.ptDirty&&this.ptDirty[k])||(this.ptCache&&this.ptCache.k===k?this.ptCache.m:null)||(await this.s.get(k))||{}, now=Date.now(), r=map[pid]||{n:name,s:0,l:0};
      if(r.l&&now-r.l<30000) return J({ok:true,s:Math.round(r.s),...extra});        /* too soon: ignore */
      const inc=r.l&&now-r.l<=90000?Math.min(75,(now-r.l)/1000):0;          /* only count time between live beats */
      r.s+=inc; r.l=now; r.n=name; map[pid]=r; this.ptDirty=this.ptDirty||{}; this.ptDirty[k]=map; this.ptCache={k,m:map};
      if(inc){ this.ptaMap=this.ptaMap||((await this.s.get('pta'))||{}); const a=this.ptaMap[pid]||{n:name,s:0}; a.s+=inc; a.n=name; this.ptaMap[pid]=a; this.ptaDirty=true; }
      if(!this.ptFlush||now-this.ptFlush>60000){ this.ptFlush=now; for(const kk in this.ptDirty) await this.s.put(kk,this.ptDirty[kk]); this.ptDirty={}; if(this.use){ const prev=(await this.s.get('use:'+this.use.d))||{req:0,beat:0,wr:0}; const add=k2=>(prev[k2]||0)+(this.use[k2]||0)-(this.use['_'+k2]||0); const nx={req:add('req'),beat:add('beat'),wr:add('wr')}; for(const k2 of ['req','beat','wr']) this.use['_'+k2]=this.use[k2]; await this.s.put('use:'+this.use.d,nx); } if(this.ptaDirty){ await this.s.put('pta',this.ptaMap); this.ptaDirty=false; } await this.trackDay(d); }
      return J({ok:true,s:Math.round(r.s),...extra}); }
    if(url.pathname==='/namecheck'){ let m={}; try{ m=await req.json(); }catch(e){} const set=(await this.s.get('settings'))||{}; const pid=cleanPid(m.pid), name=cleanName(m.name); if(reservedFor(name,pid,set.reserved)) return J({taken:true,why:'reserved'}); return J({taken:this.nameTaken(name,pid,set)}); }
    if(url.pathname==='/vote'){ let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid), poll=await this.s.get('poll'); if(!poll||!poll.open||poll.id!==m.id||pid.length<8) return J({err:'closed'},400); const o=Math.round(+m.opt); if(!(o>=0&&o<poll.opts.length)) return J({err:'bad'},400);
      this.sql.exec('INSERT OR REPLACE INTO vote(poll,pid,opt) VALUES(?,?,?)',poll.id,pid,o); return J({ok:true}); }
    /* likes: one per player per game; the count is public */
    if(url.pathname==='/like'){ let m={}; try{ m=await req.json(); }catch(e){}
      const pid=cleanPid(m.pid), game=String(m.game||'').replace(/[^a-z0-9]/g,'').slice(0,16); if(!game) return J({err:'bad'},400);
      const k='lk:'+game, map=(await this.s.get(k))||{};
      if((m.op==='like'||m.op==='unlike')&&pid.length>=8){ if(m.op==='like') map[pid]=1; else delete map[pid]; await this.s.put(k,map); }
      return J({ok:true,n:Object.keys(map).length,me:!!(pid&&map[pid])}); }
    if(url.pathname==='/daily'){ let m={}; try{ m=await req.json(); }catch(e){}
      const pid=cleanPid(m.pid), name=cleanName(m.name), d=this.day(); const c=await this.s.get('chal'); const live=c&&c.day===d?c:null;
      if(m.op==='get'){ const b=await this.board(d), i=b.findIndex(x=>x.pid===pid), pd=await this.prevDay(d), yb=pd?await this.board(pd):[];
        const hist=(await this.s.get('chalHist'))||[], last=hist.length?hist[hist.length-1]:null;
        return J({day:d, board:b.slice(0,10).map(x=>({name:x.name,s:x.s})), mine:{s:i>=0?b[i].s:0,rank:i>=0?i+1:null,players:b.length},
          yTop:yb[0]?{name:yb[0].name,s:yb[0].s}:null,
          chal:live?{game:live.game,page:live.page,goal:live.goal,prizes:live.prizes,winner:live.winner?live.winner.name:null,prize:live.pick?live.pick.prize:null,
            claimed:!!(live.claims||[]).find(x=>x.pid===pid),youWon:!!(live.winner&&live.winner.pid===pid),claims:(live.claims||[]).length}:null,
          champs:[...(live&&live.winner?[{name:live.winner.name,game:live.game,day:live.day}]:[]),...hist.filter(h=>h.winner).slice(-8).reverse().map(h=>({name:h.winner,game:h.game,day:h.day}))].slice(0,8),
          lastChal:c&&c.day!==d?{game:c.game,goal:c.goal,winner:c.winner?c.winner.name:null,prize:c.pick?c.pick.prize:null}:(last?{game:last.game,goal:last.goal,winner:last.winner,prize:last.prize}:null)}); }
      if(m.op==='claim'){ if(!live) return J({err:'none'},400); if(live.winner) return J({err:'done'},400); if(pid.length<8) return J({err:'bad'},400);
        live.claims=(live.claims||[]).filter(x=>x.pid!==pid); live.claims.push({pid,name,ts:Date.now()}); live.claims=live.claims.slice(-300); await this.s.put('chal',live); return J({ok:true}); }
      if(m.op==='pick'){ if(!live||!live.winner||live.winner.pid!==pid) return J({err:'forbidden'},403); if(live.pick) return J({ok:true,prize:live.pick.prize});
        const prize=(live.prizes||[])[+m.i]; if(!prize) return J({err:'bad'},400);
        live.pick={prize,ts:Date.now()}; await this.s.put('chal',live);
        await this.addAch(pid,{title:'Daily challenge prize',detail:prize+' (awarded)',game:live.game}); return J({ok:true,prize}); }
      return J({err:'op'},400); }
    if(url.pathname==='/site'){ const st=await this.state(); return new Response(JSON.stringify(st),{headers:{...CORS,'content-type':'application/json','cache-control':'public,max-age=10'}}); }
    if(url.pathname==='/tourney'){ let m={}; try{ m=await req.json(); }catch(e){}
      if(m.op==='join'&&m.id){ const arr=(await this.s.get('tourneys'))||[]; const t=arr.find(x=>x.id===m.id); if(!t) return J({err:'gone'},404);
        const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24), name=String(m.name||'Player').replace(/[<>]/g,'').trim().slice(0,20)||'Player';
        const occ=String(m.occ||'').replace(/[^0-9]/g,'').slice(0,8); t.joins=(t.joins||[]).filter(j=>!(j.pid===pid&&(j.occ||'')===occ)); t.joins.push({name,pid,ts:Date.now(),occ}); t.joins=t.joins.slice(-500);
        await this.s.put('tourneys',arr); return J({ok:true,joined:t.joins.filter(j=>(j.occ||'')===occ).length}); }
      if(m.op==='leave'&&m.id){ const arr=(await this.s.get('tourneys'))||[]; const t=arr.find(x=>x.id===m.id); if(t){ const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); const occ=String(m.occ||'').replace(/[^0-9]/g,'').slice(0,8); t.joins=(t.joins||[]).filter(j=>!(j.pid===pid&&(j.occ||'')===occ)); await this.s.put('tourneys',arr); } return J({ok:true}); }
      return J({err:'op'},400); }
    if(url.pathname==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      const role=req.headers.get('x-admin-role')||'full', full=role==='full';
      if(m.op==='get') return J({...await this.state(),role});
      if(m.op==='usage'&&role==='full'){ const d=new Date(), t=d.toISOString().slice(0,10), y=new Date(d-864e5).toISOString().slice(0,10), mem=this.use&&this.use.d===t?this.use:null, sv=(await this.s.get('use:'+t))||{req:0,beat:0,wr:0}, live=k=>(sv[k]||0)+(mem?(mem[k]||0)-(mem['_'+k]||0):0);
        let on=0; for(const [,tt] of (this.live||new Map())) if(Date.now()-tt<100000) on++;
        return J({today:{req:live('req'),beat:live('beat'),wr:live('wr')},yesterday:(await this.s.get('use:'+y))||null,online:on,limits:{req:100000,wr:100000},resetIn:Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-d)/60000)}); }
      if(role==='arcade'){ const now=Date.now();
        if(m.op==='arcadePlayers') return J({players:this.sql.exec("SELECT pid,name,game,last,dev FROM pl WHERE game LIKE 'sa-%' AND last>? ORDER BY last DESC LIMIT 200",now-90000).toArray()});
        if(m.op==='pcmd'){ const kind=String(m.kind||''); if(!['msg','confetti','emoji','award','sagift'].includes(kind)) return J({err:'forbidden'},403);
          const pids=(Array.isArray(m.pids)?m.pids:[m.pid]).map(cleanPid).filter(x=>x.length>=8).slice(0,100); const ok=pids.filter(pid=>{ const r=this.sql.exec('SELECT game,last FROM pl WHERE pid=?',pid).toArray()[0]; return r&&/^sa-/.test(r.game||'')&&now-r.last<90000; });
          if(!ok.length) return J({err:'none',msg:'Only players who are in the Sports Arcade right now'});
          const data={}; if(kind==='msg'){ data.text=String(m.text||'').slice(0,300); data.title='🏟️ Message from the Sports Arcade'; if(!data.text) return J({err:'bad'},400); }
          if(kind==='award'){ data.text=String(m.text||'').slice(0,160); if(!data.text) return J({err:'bad'},400); } if(kind==='emoji'){ data.e=[...String(m.e||'🏆')].slice(0,3).join(''); data.secs=12; }
          if(kind==='sagift'){ data.what='puck'; data.n=Math.max(1,Math.min(1e7,Math.round(+m.n||0))); }
          for(const pid of ok) this.queue(pid,kind,data); this.sql.exec('INSERT INTO slog(ts,op,detail) VALUES(?,?,?)',now,'arcade:'+kind,JSON.stringify({n:ok.length,...data}).slice(0,300)); return J({ok:true,n:ok.length}); }
        return J({err:'forbidden'},403); }
      if(!full&&!(role==='news'&&(m.op==='ann'||m.op==='annClear'))) return J({err:'forbidden'},403);
      if(!['players','pinfo','sbans','reserved','namereqs','activity','answers','slog','feedAll','visits','pxList','stats','liveStats','daily','export','polls','list'].includes(m.op)&&!(m.op==='notes'&&typeof m.text!=='string')&&!(m.op==='sched'&&!m.add&&!m.del)){ const d={...m}; delete d.op; if(d.patch&&d.patch.reserved) delete d.patch.reserved; this.sql.exec('INSERT INTO slog(ts,op,detail) VALUES(?,?,?)',Date.now(),String(m.op).slice(0,24),JSON.stringify(d).slice(0,300)); if(Math.random()<.02) this.sql.exec('DELETE FROM slog WHERE id<(SELECT MAX(id)-3000 FROM slog)'); }
      if(m.op==='ann'){ const title=String(m.title||'').slice(0,120), body=String(m.body||'').slice(0,2000); if(!title&&!body) return J({err:'empty'},400);
        const icon=String(m.icon||'').slice(0,6), theme=String(m.theme||'').replace(/[^a-z]/g,'').slice(0,12);
        const btn=String(m.btn||'').slice(0,40), link=String(m.link||'').trim().slice(0,300);
        await this.s.put('ann',{id:Date.now().toString(36),title,body,icon,theme,btn,link:/^https?:\/\//.test(link)?link:'',ts:Date.now()}); return J({ok:true}); }
      if(m.op==='annClear'){ await this.s.delete('ann'); return J({ok:true}); }
      if(m.op==='ov'){ const e=m.entry||{}; const lg=String(e.lg||''), name=String(e.name||'').slice(0,40); if(!lg||!name) return J({err:'bad'},400);
        const ov=(await this.s.get('ov'))||[]; const clean={lg,name,edit:true}; if(e.ovr!=null&&e.ovr!=='') clean.ovr=Math.max(1,Math.min(99,Math.round(+e.ovr))); if(e.tid) clean.tid=String(e.tid).slice(0,12); if(e.pos) clean.pos=String(e.pos).slice(0,4);
        if(e.skills&&typeof e.skills==='object'){ clean.skills={}; for(const k of Object.keys(e.skills).slice(0,16)){ const v=+e.skills[k]; if(v>=1&&v<=99) clean.skills[String(k).slice(0,6)]=Math.round(v); } }
        const i=ov.findIndex(x=>x.lg===lg&&x.name===name); if(i>=0) ov[i]=clean; else ov.push(clean); await this.s.put('ov',ov.slice(-200)); return J({ok:true}); }
      if(m.op==='ovDel'){ const ov=((await this.s.get('ov'))||[]).filter(x=>!(x.lg===m.lg&&x.name===m.name)); await this.s.put('ov',ov); return J({ok:true}); }
      if(m.op==='ovClear'){ await this.s.delete('ov'); return J({ok:true}); }
      if(m.op==='settings'){ const cur=(await this.s.get('settings'))||{}, p=m.patch||{}, next={...cur};
        if('bannerOn' in p) next.bannerOn=!!p.bannerOn;
        if('maint' in p) next.maint=!!p.maint; if('maintMsg' in p) next.maintMsg=String(p.maintMsg||'').slice(0,300);
        if('off' in p) next.off=(Array.isArray(p.off)?p.off:[]).map(x=>String(x).replace(/[^a-z0-9-]/g,'').slice(0,24)).filter(Boolean).slice(0,100);
        if('hidden' in p) next.hidden=(Array.isArray(p.hidden)?p.hidden:[]).map(x=>String(x).replace(/[^a-z0-9-]/g,'').slice(0,24)).filter(Boolean).slice(0,100);
        if('events' in p){ const e=p.events||{}; next.events={cash2x:!!e.cash2x,str2x:!!e.str2x}; }
        if('chatOff' in p) next.chatOff=!!p.chatOff;
        if('countdown' in p){ const c=p.countdown; next.countdown=c&&c.title&&+c.at?{title:String(c.title).slice(0,100),at:+c.at,page:String(c.page||'').replace(/[^a-z0-9-]/g,'').slice(0,24)}:null; }
        if('effect' in p) next.effect=['snow','confetti','hearts','leaves','stars',''].includes(p.effect)?p.effect:'';
        if('featured' in p) next.featured=String(p.featured||'').replace(/[^a-z0-9-]/g,'').slice(0,24);
        if('motd' in p) next.motd=String(p.motd||'').slice(0,300);
        if('newLock' in p){ next.newLock=!!p.newLock; if(p.newLock&&!cur.newLock) next.newLockAt=Date.now(); }
        if('nameLock' in p) next.nameLock=!!p.nameLock;
        if('shared' in p) next.shared=(Array.isArray(p.shared)?p.shared:[]).map(x=>String(x).toLowerCase().trim().slice(0,20)).filter(Boolean).slice(0,100);
        if('welcome' in p) next.welcome=String(p.welcome||'').slice(0,400);
        if('pin' in p) next.pin=String(p.pin||'').slice(0,200);
        if('proxyBlock' in p) next.proxyBlock=!!p.proxyBlock;
        if('feedApprove' in p) next.feedApprove=!!p.feedApprove; if('feedOff' in p) next.feedOff=!!p.feedOff;
        if('nameBlock' in p) next.nameBlock=(Array.isArray(p.nameBlock)?p.nameBlock:[]).map(x=>String(x).toLowerCase().trim().slice(0,30)).filter(Boolean).slice(0,200);
        if('banner' in p){ const b=p.banner||{}; next.banner={text:String(b.text||'').slice(0,160),theme:String(b.theme||'').replace(/[^a-z]/g,'').slice(0,12)}; next.bannerId=Date.now().toString(36); }
        await this.s.put('settings',next); return J({ok:true,settings:next}); }
      if(m.op==='tourneyAdd'){ const t=m.t||{}, name=String(t.name||'').slice(0,80); if(!name) return J({err:'bad'},400);
        const row={id:Date.now().toString(36),name,game:String(t.game||'').slice(0,40),page:String(t.page||'').replace(/[^a-z0-9-]/g,'').slice(0,16),time:String(t.time||'').slice(0,40),rep:['daily','weekdays','weekends','weekly'].includes(t.rep)?t.rep:'',desc:String(t.desc||'').slice(0,600),joins:[],ts:Date.now()};
        const arr=(await this.s.get('tourneys'))||[]; arr.push(row); await this.s.put('tourneys',arr.slice(-20)); return J({ok:true,id:row.id}); }
      if(m.op==='tourneyDel'&&m.id){ const arr=((await this.s.get('tourneys'))||[]).filter(x=>x.id!==m.id); await this.s.put('tourneys',arr); return J({ok:true}); }
      if(m.op==='daily'){ const d=this.day(), b=await this.board(d), c=await this.s.get('chal');
        return J({day:d, board:b.slice(0,30), chal:c||null, live:!!(c&&c.day===d), hist:((await this.s.get('chalHist'))||[]).slice(-10).reverse()}); }
      if(m.op==='chalSet'){ const x=m.c||{}, goal=String(x.goal||'').slice(0,200); if(!goal) return J({err:'bad'},400);
        const prizes=(Array.isArray(x.prizes)?x.prizes:[]).map(p=>String(p||'').trim().slice(0,80)).filter(Boolean).slice(0,8); if(!prizes.length) return J({err:'noprize'},400);
        await this.archiveChal();
        await this.s.put('chal',{day:this.day(),game:String(x.game||'').slice(0,40),page:String(x.page||'').replace(/[^a-z0-9-]/g,'').slice(0,16),goal,prizes,claims:[],winner:null,pick:null,ts:Date.now()}); return J({ok:true}); }
      if(m.op==='chalWinner'){ const c=await this.s.get('chal'); if(!c) return J({err:'none'},400); const pid=cleanPid(m.pid); if(!pid) return J({err:'bad'},400);
        const cl=(c.claims||[]).find(x=>x.pid===pid); c.winner={pid,name:cleanName(m.name||(cl&&cl.name))}; c.pick=null; await this.s.put('chal',c);
        await this.addAch(pid,{title:'Won the daily challenge',detail:c.goal,game:c.game}); return J({ok:true}); }
      if(m.op==='chalClear'){ await this.archiveChal(); await this.s.delete('chal'); return J({ok:true}); }
      if(m.op==='players'&&!(await this.s.get('plSeeded'))){ const all=(await this.s.get('pta'))||{}, days=(await this.s.get('ptDays'))||[]; for(const d of days){ const mp=(await this.s.get('pt:'+d))||{}; for(const [p2,v] of Object.entries(mp)) if(!all[p2]) all[p2]={n:v.n,s:v.s,l:v.l}; }
        for(const [p2,v] of Object.entries(all)){ if(String(p2).length<8) continue; this.sql.exec('INSERT OR IGNORE INTO pl(pid,name,first,last,beats,game,iph,secs) VALUES(?,?,?,?,0,?,?,?)',p2,String(v.n||'Player').slice(0,20),v.l||0,v.l||0,'','',+v.s||0); } await this.s.put('plSeeded',1); }
      if(m.op==='players'){ const q=String(m.q||'').trim().toLowerCase(), now=Date.now(), sort={last:'last DESC',first:'first DESC',time:'secs DESC',name:'name COLLATE NOCASE'}[m.sort]||'last DESC', lim=Math.min(500,Math.max(10,+m.limit||200));
        const rows=q?this.sql.exec(`SELECT pid,name,first,last,beats,game,secs,iph,dev,aso FROM pl WHERE lower(name) LIKE ? OR pid=? ORDER BY ${sort} LIMIT ?`,'%'+q+'%',q,lim).toArray():this.sql.exec(`SELECT pid,name,first,last,beats,game,secs,iph,dev,aso FROM pl ORDER BY ${sort} LIMIT ?`,lim).toArray();
        const bans=new Set(this.sql.exec('SELECT k FROM sban WHERE until=0 OR until>?',now).toArray().map(r=>r.k));
        const tot=this.sql.exec('SELECT COUNT(*) AS c FROM pl').toArray()[0].c, online=this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE last>?',now-150000).toArray()[0].c, today=this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE last>?',now-86400000).toArray()[0].c, newToday=this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE first>?',now-86400000).toArray()[0].c;
        return J({total:tot,online,today,newToday,players:rows.map(r=>({pid:r.pid,dev:r.dev||'',name:r.name,first:r.first,last:r.last,beats:r.beats,game:r.game,mins:Math.round(r.secs/60),on:now-r.last<150000,banned:bans.has('p:'+r.pid)||bans.has('i:'+r.iph)||bans.has('n:'+String(r.name).toLowerCase()),same:r.iph?this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE iph=?',r.iph).toArray()[0].c:1}))}); }
      if(m.op==='pcmd'){ const kind=String(m.kind||''); if(!['msg','gift','kick','reload','rename','goto','setcash','givecar','givegun','resetcity','setstr','freeze','flip','confetti','shake','invert','mirror','rainbow','spin','blur','comic','tiny','disco','upside','airhorn','say','emoji','heal','wanted','ask','award','jumpcash','sagift'].includes(kind)) return J({err:'bad'},400); const data={};
        if(kind==='goto') data.page=String(m.page||'').replace(/[^a-z0-9-]/g,'').slice(0,24); if(kind==='setcash') data.n=Math.max(0,Math.min(1e9,Math.round(+m.n||0))); if(kind==='givecar') data.model=String(m.model||'').replace(/[^a-z0-9]/g,'').slice(0,16); if(kind==='givegun') data.gun=String(m.gun||'').replace(/[^a-z]/g,'').slice(0,12); if(kind==='setstr') data.n=Math.max(0,Math.min(100,Math.round(+m.n||0))); if(['freeze','flip','shake','invert','mirror','rainbow','spin','blur','comic','tiny','disco','upside','emoji'].includes(kind)) data.secs=Math.max(3,Math.min(120,Math.round(+m.secs||10))); if(kind==='freeze') data.text=String(m.text||'').slice(0,120);
        if(kind==='say'||kind==='ask'||kind==='award'){ data.text=String(m.text||'').slice(0,240); if(!data.text) return J({err:'bad'},400); } if(kind==='emoji') data.e=[...String(m.e||'🎉')].slice(0,3).join(''); if(kind==='wanted') data.n=Math.max(0,Math.min(5,Math.round(+m.n||0))); if(kind==='sagift'){ data.what='puck'; data.n=Math.max(1,Math.min(1e7,Math.round(+m.n||0))); }
        if(kind==='msg'){ data.text=String(m.text||'').slice(0,500); data.title=String(m.title||'Message from the admin').slice(0,80); if(!data.text) return J({err:'bad'},400); }
        if(kind==='gift'){ data.what=['cash','str'].includes(m.what)?m.what:'cash'; data.n=Math.max(1,Math.min(10000000,Math.round(+m.n||0))); data.note=String(m.note||'').slice(0,120); }
        if(kind==='kick'){ data.text=String(m.text||'You were kicked by an admin.').slice(0,200); }
        if(kind==='rename'){ data.name=cleanName(m.name); }
        const targets=m.pid==='*'?['*']:(Array.isArray(m.pids)?m.pids:[m.pid]).map(cleanPid).filter(x=>x.length>=8).slice(0,500); if(!targets.length) return J({err:'bad'},400);
        for(const t of targets){ this.queue(t,kind,data); if(kind==='rename'&&t!=='*') this.sql.exec('UPDATE pl SET name=? WHERE pid=?',data.name,t); } return J({ok:true,n:targets.length}); }
      if(m.op==='sban'){ const pid=cleanPid(m.pid), r=this.sql.exec('SELECT name,iph,fp FROM pl WHERE pid=?',pid).toArray()[0]; if(!r) return J({err:'none'},404); const until=+m.mins>0?Date.now()+(+m.mins)*60000:0, reason=String(m.reason||'').slice(0,160), now=Date.now();
        const add=(k,kind)=>this.sql.exec('INSERT OR REPLACE INTO sban(k,kind,name,reason,until,ts) VALUES(?,?,?,?,?,?)',k,kind,r.name,reason,until,now); add('p:'+pid,'device'); /* connection (IP) bans are switched off: they caught everyone on the same wifi */ if(m.byName) add('n:'+String(r.name).toLowerCase(),'name'); if(m.fp===true&&r.fp) add('f:'+r.fp,'device fingerprint');
        this.queue(pid,'reload',{}); return J({ok:true}); }
      if(m.op==='sunban'){ if(m.k) this.sql.exec('DELETE FROM sban WHERE k=?',String(m.k)); if(m.pid){ const pid=cleanPid(m.pid), r=this.sql.exec('SELECT name,iph,fp FROM pl WHERE pid=?',pid).toArray()[0]; this.sql.exec('DELETE FROM sban WHERE k=?','p:'+pid); if(r){ this.sql.exec('DELETE FROM sban WHERE k=?','i:'+r.iph); if(r.fp) this.sql.exec('DELETE FROM sban WHERE k=?','f:'+r.fp); this.sql.exec('DELETE FROM sban WHERE k=?','n:'+String(r.name).toLowerCase()); } } return J({ok:true}); }
      if(m.op==='sbans'){ const now=Date.now(); return J({bans:this.sql.exec('SELECT k,kind,name,reason,until,ts FROM sban WHERE until=0 OR until>? ORDER BY ts DESC',now).toArray()}); }
      if(m.op==='reserve'||m.op==='unreserve'||m.op==='reservePid'){ const set=(await this.s.get('settings'))||{}; let list=set.reserved||[];
        if(m.op==='reserve'){ const n=nameKey(m.name); if(n.length<3) return J({err:'short'},400); const holders=new Set(); for(const r of this.sql.exec('SELECT pid,name FROM pl').toArray()) if(nameKey(r.name).startsWith(n)) holders.add(r.pid); for(const r of this.sql.exec('SELECT pid,name FROM pnames').toArray()) if(nameKey(r.name).startsWith(n)) holders.add(r.pid);
          list=list.filter(r=>r.n!==n); list.push({n,label:String(m.name).slice(0,20),pids:[...holders].slice(0,20),ts:Date.now()}); }
        if(m.op==='unreserve') list=list.filter(r=>r.n!==String(m.n));
        if(m.op==='reservePid'){ const r=list.find(x=>x.n===String(m.n)), pid=cleanPid(m.pid); if(r&&pid){ r.pids=(r.pids||[]).filter(x=>x!==pid); if(m.on!==false) r.pids.push(pid); } }
        set.reserved=list; await this.s.put('settings',set); return J({ok:true,reserved:list}); }
      if(m.op==='reserved'){ const set=(await this.s.get('settings'))||{}; const list=(set.reserved||[]).map(r=>({...r,holders:(r.pids||[]).map(p2=>{ const x=this.sql.exec('SELECT pid,name,last,dev,iph FROM pl WHERE pid=?',p2).toArray()[0]; return x?{pid:x.pid,name:x.name,last:x.last,dev:x.dev||'',conn:(x.iph||'').slice(0,6)}:{pid:p2,name:'?',last:0,dev:'',conn:''}; })})); return J({reserved:list}); }
      if(m.op==='activity'){ const h=Math.floor(Date.now()/3600000), rows=this.sql.exec('SELECT h,COUNT(*) n FROM act WHERE h>? GROUP BY h',h-48).toArray(), mp={}; for(const r of rows) mp[r.h]=r.n; const days=this.sql.exec('SELECT h/24 d,COUNT(DISTINCT pid) n FROM act WHERE h>? GROUP BY h/24 ORDER BY d',h-24*14).toArray();
        return J({hours:Array.from({length:48},(_,i)=>({h:(h-47+i)*3600000,n:mp[h-47+i]||0})),days:days.map(d=>({d:d.d*86400000,n:d.n})),peak:(await this.s.get('peak'))||{n:0},online:this.sql.exec('SELECT COUNT(*) n FROM pl WHERE last>?',Date.now()-70000).one().n}); }
      if(m.op==='answers') return J({rows:this.sql.exec('SELECT id,pid,name,q,a,ts FROM ans ORDER BY id DESC LIMIT 200').toArray()});
      if(m.op==='ansClear'){ this.sql.exec('DELETE FROM ans'); return J({ok:true}); }
      if(m.op==='notes'){ if(typeof m.text==='string') await this.s.put('notes',{text:m.text.slice(0,20000),ts:Date.now()}); return J({ok:true,...((await this.s.get('notes'))||{text:''})}); }
      if(m.op==='sched'){ let sc=(await this.s.get('sched'))||[]; if(m.add){ const text=String(m.add.text||'').slice(0,500), at=+m.add.at; if(!text||!(at>Date.now())) return J({err:'bad'},400); sc.push({id:Date.now().toString(36),at,title:String(m.add.title||'').slice(0,80),text}); } if(m.del) sc=sc.filter(x=>x.id!==m.del); sc=sc.sort((a,b)=>a.at-b.at).slice(0,50); await this.s.put('sched',sc); return J({ok:true,list:sc}); }
      if(m.op==='slog') return J({rows:this.sql.exec('SELECT ts,op,detail FROM slog ORDER BY id DESC LIMIT 300').toArray()});
      if(m.op==='peakReset'){ await this.s.delete('peak'); return J({ok:true}); }
      if(m.op==='feedAll'){ const posts=this.sql.exec('SELECT p.id,p.pid,p.name,p.kind,p.mime,p.size,p.cap,p.ts,p.st,(SELECT COUNT(*) FROM frep r WHERE r.id=\'p:\'||p.id) reps,(SELECT COUNT(*) FROM flike l WHERE l.id=\'p:\'||p.id) likes FROM fpost p WHERE p.st<>\'gone\' ORDER BY p.id DESC LIMIT 300').toArray();
        const coms=this.sql.exec('SELECT cid,id,pid,name,text,ts FROM fcom ORDER BY cid DESC LIMIT 200').toArray(), reps=this.sql.exec("SELECT id,COUNT(*) n FROM frep WHERE id NOT LIKE 'p:%' GROUP BY id ORDER BY n DESC LIMIT 100").toArray(), bans=this.sql.exec('SELECT f.pid,(SELECT name FROM pl WHERE pl.pid=f.pid) name FROM fban f').toArray();
        const set=(await this.s.get('settings'))||{}; return J({posts,coms,reps,bans,hide:set.feedHide||[],approve:set.feedApprove!==false,off:!!set.feedOff}); }
      if(m.op==='feedSet'){ const st=['ok','hidden','pending'].includes(m.st)?m.st:'hidden'; this.sql.exec('UPDATE fpost SET st=? WHERE id=?',st,+m.id); if(st==='ok') this.sql.exec('DELETE FROM frep WHERE id=?','p:'+(+m.id)); return J({ok:true}); }
      if(m.op==='feedDel'){ const id=+m.id; this.sql.exec('DELETE FROM fblob WHERE post=?',id); this.sql.exec("UPDATE fpost SET st='gone',size=0 WHERE id=?",id); this.sql.exec('DELETE FROM fcom WHERE id=?','p:'+id); this.sql.exec('DELETE FROM flike WHERE id=?','p:'+id); this.sql.exec('DELETE FROM frep WHERE id=?','p:'+id); return J({ok:true}); }
      if(m.op==='feedComDel'){ this.sql.exec('DELETE FROM fcom WHERE cid=?',+m.cid); return J({ok:true}); }
      if(m.op==='feedBan'){ const pid=cleanPid(m.pid); if(m.on){ this.sql.exec('INSERT OR REPLACE INTO fban(pid,ts) VALUES(?,?)',pid,Date.now()); if(m.wipe){ for(const r of this.sql.exec("SELECT id FROM fpost WHERE pid=? AND st<>'gone'",pid).toArray()){ this.sql.exec('DELETE FROM fblob WHERE post=?',r.id); this.sql.exec("UPDATE fpost SET st='gone',size=0 WHERE id=?",r.id); } this.sql.exec('DELETE FROM fcom WHERE pid=?',pid); } } else this.sql.exec('DELETE FROM fban WHERE pid=?',pid); return J({ok:true}); }
      if(m.op==='feedHide'){ const set=(await this.s.get('settings'))||{}, id=String(m.cid||'').slice(0,40); let h=set.feedHide||[]; h=m.on?[...new Set([...h,id])]:h.filter(x=>x!==id); set.feedHide=h.slice(-1000); if(!m.on) this.sql.exec('DELETE FROM frep WHERE id=?',id); await this.s.put('settings',set); return J({ok:true,hide:set.feedHide}); }
      if(m.op==='visits'){ const since=+m.since||0, rows=this.sql.exec('SELECT id,pid,name,start,last,game,games,dev,aso,proxy FROM visit WHERE id>? ORDER BY id DESC LIMIT ?',since,Math.min(300,+m.limit||150)).toArray(); return J({rows,now:Date.now()}); }
      if(m.op==='pxList') return J({rows:this.sql.exec("SELECT pid,name,last,aso,cc,dev FROM pl WHERE aso LIKE '⚠️%' ORDER BY last DESC LIMIT 200").toArray(),ok:this.sql.exec('SELECT p.pid,(SELECT name FROM pl WHERE pl.pid=p.pid) name FROM pxok p').toArray()});
      if(m.op==='pxAllow'){ const pid=cleanPid(m.pid); if(m.on) this.sql.exec('INSERT OR REPLACE INTO pxok(pid,ts) VALUES(?,?)',pid,Date.now()); else this.sql.exec('DELETE FROM pxok WHERE pid=?',pid); return J({ok:true}); }
      if(m.op==='namereqs') return J({rows:this.sql.exec('SELECT pid,old,want,ts FROM namereq ORDER BY ts DESC LIMIT 100').toArray()});
      if(m.op==='nameOk'||m.op==='nameNo'){ const pid=cleanPid(m.pid), r=this.sql.exec('SELECT want FROM namereq WHERE pid=?',pid).toArray()[0]; this.sql.exec('DELETE FROM namereq WHERE pid=?',pid);
        if(m.op==='nameOk'&&r){ const set=(await this.s.get('settings'))||{}; if(this.nameTaken(r.want,pid,set)) return J({err:'taken'}); this.sql.exec('UPDATE pl SET name=? WHERE pid=?',r.want,pid); this.queue(pid,'rename',{name:r.want,why:'approved'}); } return J({ok:true}); }
      if(m.op==='pinfo'){ const pid=cleanPid(m.pid), r=this.sql.exec('SELECT iph FROM pl WHERE pid=?',pid).toArray()[0];
        return J({names:this.sql.exec('SELECT name,first,last FROM pnames WHERE pid=? ORDER BY last DESC LIMIT 30',pid).toArray(),note:(this.sql.exec('SELECT text FROM pnote WHERE pid=?',pid).toArray()[0]||{}).text||'',
          same:r&&r.iph?this.sql.exec('SELECT pid,name,last FROM pl WHERE iph=? AND pid<>? ORDER BY last DESC LIMIT 20',r.iph,pid).toArray():[],allowed:!!this.sql.exec('SELECT 1 FROM allow WHERE pid=?',pid).toArray().length}); }
      if(m.op==='pnote'){ const pid=cleanPid(m.pid); this.sql.exec('INSERT OR REPLACE INTO pnote(pid,text,ts) VALUES(?,?,?)',pid,String(m.text||'').slice(0,1000),Date.now()); return J({ok:true}); }
      if(m.op==='allow'){ const pid=cleanPid(m.pid); if(m.on===false) this.sql.exec('DELETE FROM allow WHERE pid=?',pid); else this.sql.exec('INSERT OR REPLACE INTO allow(pid,ts) VALUES(?,?)',pid,Date.now()); return J({ok:true}); }
      if(m.op==='pending'){ const set=(await this.s.get('settings'))||{}; if(!set.newLock) return J({rows:[]}); return J({rows:this.sql.exec('SELECT pid,name,first,last FROM pl WHERE first>? AND pid NOT IN (SELECT pid FROM allow) ORDER BY first DESC LIMIT 100',set.newLockAt||0).toArray()}); }
      if(m.op==='liveStats'){ const now=Date.now(); const byGame=this.sql.exec('SELECT game,COUNT(*) AS n FROM pl WHERE last>? GROUP BY game ORDER BY n DESC',now-150000).toArray(), day=this.sql.exec('SELECT game,COUNT(*) AS n FROM pl WHERE last>? GROUP BY game ORDER BY n DESC LIMIT 15',now-86400000).toArray();
        const days=[]; for(let i=6;i>=0;i--){ const a=now-(i+1)*86400000, b=now-i*86400000; days.push({n:this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE first>? AND first<=?',a,b).toArray()[0].c,act:this.sql.exec('SELECT COUNT(*) AS c FROM pl WHERE last>? AND last<=?',a,b).toArray()[0].c,day:new Date(b).toLocaleDateString('en-CA',{timeZone:'America/Toronto'})}); }
        const top=this.sql.exec('SELECT name,secs FROM pl ORDER BY secs DESC LIMIT 10').toArray().map(r=>({name:r.name,mins:Math.round(r.secs/60)})); return J({byGame,day,days,top}); }
      if(m.op==='export') return J({rows:this.sql.exec('SELECT pid,name,first,last,beats,game,secs FROM pl ORDER BY last DESC').toArray()});
      if(m.op==='pollNew'){ const q=String(m.q||'').slice(0,160), opts=(Array.isArray(m.opts)?m.opts:[]).map(x=>String(x).trim().slice(0,60)).filter(Boolean).slice(0,6); if(!q||opts.length<2) return J({err:'bad'},400); const old=await this.s.get('poll'); if(old){ const h=(await this.s.get('pollHist'))||[]; h.push({...old,open:false,res:this.pollRes(old)}); await this.s.put('pollHist',h.slice(-10)); }
        await this.s.put('poll',{id:Date.now().toString(36),q,opts,open:true,ts:Date.now()}); return J({ok:true}); }
      if(m.op==='pollClose'){ const p2=await this.s.get('poll'); if(p2){ p2.open=false; await this.s.put('poll',p2); } return J({ok:true}); }
      if(m.op==='polls'){ const p2=await this.s.get('poll'); return J({poll:p2?{...p2,res:this.pollRes(p2)}:null,hist:((await this.s.get('pollHist'))||[]).slice().reverse()}); }
      if(m.op==='pdel'){ const pid=cleanPid(m.pid); this.sql.exec('DELETE FROM pl WHERE pid=?',pid); return J({ok:true}); }
      if(m.op==='player'){ const q=String(m.q||'').trim().toLowerCase(); if(!q) return J({err:'bad'},400);
        const all=(await this.s.get('pta'))||{}, today=(await this.s.get('pt:'+this.day()))||{};
        const pids=Object.keys({...all,...today}).filter(p=>p===q||String((all[p]||today[p]).n||'').toLowerCase()===q||String((all[p]||today[p]).n||'').toLowerCase().includes(q)).slice(0,10);
        const out=[]; for(const p of pids){ const ach=(await this.s.get('ach:'+p))||[]; out.push({pid:p,name:(all[p]||today[p]).n,today:Math.round((today[p]||{}).s||0),total:Math.round((all[p]||{}).s||0),wins:ach.filter(a=>a.title==='Won the daily challenge').length,ach:ach.slice().reverse()}); }
        return J({players:out}); }
      if(m.op==='achAdd'){ const pid=cleanPid(m.pid), title=String(m.title||'').slice(0,60); if(!pid||!title) return J({err:'bad'},400); await this.addAch(pid,{title,detail:String(m.detail||'').slice(0,120),game:String(m.game||'').slice(0,40),byAdmin:true}); return J({ok:true}); }
      if(m.op==='achDel'){ const pid=cleanPid(m.pid), k='ach:'+pid, a=((await this.s.get(k))||[]).filter(x=>x.ts!==+m.ts); await this.s.put(k,a); return J({ok:true}); }
      return J({err:'op'},400); }
    return J({err:'path'},404);
  }
}

/* Parties: a group of up to 8 that hangs out in the lobby or any game, votes on what to play,
   and launches together. One object per party code. Members stay in the party for a few minutes
   while their page changes (e.g. after GO everyone reloads into the new game). */
const partyPage=g=>String(g||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,16);
const topVote=v=>{ const c={}; for(const g of Object.values(v||{})) c[g]=(c[g]||0)+1; const e=Object.entries(c).sort((a,b)=>b[1]-a[1]); return e.length?e[0][0]:null; };
export class Party {
  constructor(ctx){ this.ctx=ctx; this.s=ctx.storage; }
  socks(){ return this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()); }
  send(ws,o){ try{ ws.send(JSON.stringify(o)); }catch(e){} }
  all(o){ const s=JSON.stringify(o); for(const ws of this.socks()) try{ ws.send(s); }catch(e){} }
  async st(){ return (await this.s.get('p'))||{leader:null,members:{},votes:{},pick:null,launch:null,chat:[]}; }
  online(){ const on=new Set(); for(const ws of this.socks()) on.add(ws.deserializeAttachment().pid); return on; }
  prune(p){ const on=this.online(), now=Date.now();
    for(const [pid,m] of Object.entries(p.members)) if(!on.has(pid)&&now-(m.seen||0)>180000){ delete p.members[pid]; delete p.votes[pid]; }
    if(!p.leader||!p.members[p.leader]){ const ids=Object.entries(p.members).sort((a,b)=>a[1].joined-b[1].joined).map(x=>x[0]); p.leader=ids.find(id=>on.has(id))||ids[0]||null; } }
  view(p){ const on=this.online(); return {t:'state',leader:p.leader,pick:p.pick,launch:p.launch,votes:p.votes,chat:p.chat.slice(-30),
    members:Object.entries(p.members).map(([pid,m])=>({pid,name:m.name,page:m.page,on:on.has(pid),joined:m.joined})).sort((a,b)=>a.joined-b.joined)}; }
  async push(p){ this.prune(p); if(Object.keys(p.members).length) await this.s.put('p',p); else await this.s.delete('p'); this.all(this.view(p)); }
  async fetch(req){ if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
    const pair=new WebSocketPair(); const [client,server]=Object.values(pair); this.ctx.acceptWebSocket(server); return new Response(null,{status:101,webSocket:client}); }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>1500) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; }
    const p=await this.st(), now=Date.now(); let a=ws.deserializeAttachment();
    if(m.t==='hello'){ const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); if(pid.length<8) return;
      this.prune(p); if(!p.members[pid]&&Object.keys(p.members).length>=8){ this.send(ws,{t:'full'}); try{ ws.close(4000,'full'); }catch(e){} return; }
      a={pid,name:cleanName(m.name),ts:[]}; ws.serializeAttachment(a);
      const mem=p.members[pid]||{joined:now}; mem.name=a.name; mem.page=partyPage(m.page)||'home'; mem.seen=now; p.members[pid]=mem; if(!p.leader) p.leader=pid;
      this.send(ws,{t:'you',pid}); await this.push(p); return; }
    if(!a) return; const me=a.pid;
    if(!p.members[me]){ this.send(ws,{t:'gone'}); ws.serializeAttachment(null); try{ ws.close(1000,'gone'); }catch(e){} return; }
    p.members[me].seen=now; const lead=p.leader===me||!this.online().has(p.leader);   /* if the leader is away, anyone can launch */
    if(m.t==='where'){ p.members[me].page=partyPage(m.page)||'home'; await this.push(p); return; }
    if(m.t==='vote'){ const g=partyPage(m.game); if(g) p.votes[me]=g; else delete p.votes[me]; await this.push(p); return; }
    if(m.t==='go'&&lead){ const g=partyPage(m.game)||p.pick||topVote(p.votes); if(!g) return; p.pick=g; p.launch={game:g,ts:now,by:a.name}; p.votes={}; await this.push(p); this.all({t:'go',game:g,by:a.name}); return; }
    if(m.t==='chat'){ let text=String(m.text||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160); if(!text) return;
      if(PERSONAL.test(text)){ this.send(ws,{t:'sys',text:"For your safety, don't share personal info."}); return; }
      for(const r of CHAT_BAD){ r.lastIndex=0; text=text.replace(r,w=>'*'.repeat(w.length)); }
      a.ts=(a.ts||[]).filter(x=>now-x<10000); if(a.ts.length>=6){ this.send(ws,{t:'sys',text:'Slow down a moment.'}); return; } a.ts.push(now); ws.serializeAttachment(a);
      p.chat.push({name:a.name,text,ts:now}); p.chat=p.chat.slice(-30); await this.push(p); return; }
    if(m.t==='leave'){ delete p.members[me]; delete p.votes[me]; if(p.leader===me) p.leader=null; ws.serializeAttachment(null); await this.push(p); try{ ws.close(1000,'left'); }catch(e){} return; }
    if((m.t==='kick'||m.t==='promote')&&p.leader===me){ const k=String(m.pid||''); if(!k||k===me||!p.members[k]) return;
      if(m.t==='promote') p.leader=k;
      else { delete p.members[k]; delete p.votes[k]; for(const s of this.socks()) if(s.deserializeAttachment().pid===k){ this.send(s,{t:'kicked'}); s.serializeAttachment(null); try{ s.close(1000,'kicked'); }catch(e){} } }
      await this.push(p); return; } }
  async webSocketClose(ws){ const a=ws.deserializeAttachment(); try{ ws.serializeAttachment(null); ws.close(); }catch(e){}
    if(a){ const p=await this.st(); if(p.members[a.pid]) p.members[a.pid].seen=Date.now(); await this.push(p); } }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}

/* ---------- player accounts: your progress on every device, plus crews ----------
   One object for the whole site. A device logs in once with name + PIN and keeps a token, so it never asks again. */
export class Acct {
  constructor(state){ this.state=state; this.sql=state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS acct(nm TEXT PRIMARY KEY, disp TEXT, salt TEXT, ph TEXT, data TEXT, ver INTEGER, ts INTEGER, crew TEXT, life INTEGER, str INTEGER, fails INTEGER, lockt INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tok(th TEXT PRIMARY KEY, nm TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS crew(tag TEXT PRIMARY KEY, name TEXT, owner TEXT, code TEXT, ts INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ix_acct_crew ON acct(crew)'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_tok_nm ON tok(nm)'); }
  async who(token){ if(!token) return null; const th=await sha('rr-acct:'+String(token).slice(0,80)); const r=this.sql.exec('SELECT nm FROM tok WHERE th=?',th).toArray()[0]; return r?r.nm:null; }
  async newTok(nm){ const raw=crypto.getRandomValues(new Uint8Array(32)), token=[...raw].map(v=>v.toString(16).padStart(2,'0')).join(''); this.sql.exec('INSERT INTO tok(th,nm,ts) VALUES(?,?,?)',await sha('rr-acct:'+token),nm,Date.now()); return token; }
  crewOf(tag){ if(!tag) return null; const c=this.sql.exec('SELECT tag,name,owner,code FROM crew WHERE tag=?',tag).toArray()[0]; if(!c) return null;
    const mem=this.sql.exec('SELECT disp,life,str FROM acct WHERE crew=? ORDER BY life DESC LIMIT 50',tag).toArray(); return {...c,members:mem,total:mem.reduce((a,m)=>a+(m.life||0),0)}; }
  async fetch(req){
    if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
    let m={}; try{ m=JSON.parse(await req.text()); }catch(e){ return J({err:'bad'},400); }
    const now=Date.now(), clean=s=>String(s||'').trim().replace(/[^\w .\-]/g,'').slice(0,20), key=s=>clean(s).toLowerCase(), pinOk=p=>/^\d{4,8}$/.test(String(p||''));
    if(m.op==='check'){ const nm=key(m.name); return J({taken:!!this.sql.exec('SELECT 1 FROM acct WHERE nm=?',nm).toArray()[0]}); }
    if(m.op==='create'){ const disp=clean(m.name), nm=disp.toLowerCase(); if(nm.length<2) return J({err:'name'},400); if(!pinOk(m.pin)) return J({err:'pin'},400);
      if(this.sql.exec('SELECT 1 FROM acct WHERE nm=?',nm).toArray()[0]) return J({err:'taken'},409);
      const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join(''), ph=await pbkdf(String(m.pin),salt), data=String(m.data||'{}').slice(0,600000);
      this.sql.exec('INSERT INTO acct(nm,disp,salt,ph,data,ver,ts,crew,life,str,fails,lockt) VALUES(?,?,?,?,?,1,?,NULL,?,?,0,0)',nm,disp,salt,ph,data,now,+m.life||0,+m.str||0);
      return J({ok:true,name:disp,token:await this.newTok(nm),ver:1}); }
    if(m.op==='login'){ const nm=key(m.name), r=this.sql.exec('SELECT * FROM acct WHERE nm=?',nm).toArray()[0]; if(!r) return J({err:'nouser'},404);
      if(r.lockt>now) return J({err:'locked',mins:Math.ceil((r.lockt-now)/60000)},429);
      if(!pinOk(m.pin)||(await pbkdf(String(m.pin),r.salt))!==r.ph){ const f=(r.fails||0)+1; this.sql.exec('UPDATE acct SET fails=?, lockt=? WHERE nm=?',f>=5?0:f,f>=5?now+10*60000:0,nm); return J({err:'pin',left:Math.max(0,5-f)},403); }
      this.sql.exec('UPDATE acct SET fails=0 WHERE nm=?',nm); return J({ok:true,name:r.disp,token:await this.newTok(nm),data:r.data,ver:r.ver,crew:r.crew}); }
    const nm=await this.who(m.token); if(!nm) return J({err:'auth'},401);
    if(m.op==='pull'){ const r=this.sql.exec('SELECT disp,data,ver,crew FROM acct WHERE nm=?',nm).toArray()[0]; if(!r) return J({err:'auth'},401); return J(m.since!=null&&+m.since>=r.ver?{ok:true,ver:r.ver,same:true,crew:r.crew,name:r.disp}:{ok:true,ver:r.ver,data:r.data,crew:r.crew,name:r.disp}); }
    if(m.op==='push'){ const data=String(m.data||''); if(data.length>600000) return J({err:'big'},413); const r=this.sql.exec('SELECT ver FROM acct WHERE nm=?',nm).toArray()[0]; const ver=(r?r.ver:0)+1;
      this.sql.exec('UPDATE acct SET data=?, ver=?, ts=?, life=?, str=? WHERE nm=?',data,ver,now,Math.max(0,+m.life||0),Math.max(0,+m.str||0),nm); return J({ok:true,ver}); }
    if(m.op==='logout'){ this.sql.exec('DELETE FROM tok WHERE th=?',await sha('rr-acct:'+String(m.token||'').slice(0,80))); return J({ok:true}); }
    if(m.op==='setpin'){ if(!pinOk(m.pin)) return J({err:'pin'},400); const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join(''); this.sql.exec('UPDATE acct SET salt=?, ph=? WHERE nm=?',salt,await pbkdf(String(m.pin),salt),nm); return J({ok:true}); }
    /* crews */
    const me=this.sql.exec('SELECT disp,crew FROM acct WHERE nm=?',nm).toArray()[0];
    if(m.op==='crewCreate'){ if(me.crew) return J({err:'increw'},409); const tag=String(m.tag||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5), name=clean(m.name); if(tag.length<2||name.length<2) return J({err:'bad'},400);
      if(this.sql.exec('SELECT 1 FROM crew WHERE tag=?',tag).toArray()[0]) return J({err:'taken'},409); const code=[...crypto.getRandomValues(new Uint8Array(6))].map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
      this.sql.exec('INSERT INTO crew(tag,name,owner,code,ts) VALUES(?,?,?,?,?)',tag,name,nm,code,now); this.sql.exec('UPDATE acct SET crew=? WHERE nm=?',tag,nm); return J({ok:true,crew:this.crewOf(tag)}); }
    if(m.op==='crewJoin'){ if(me.crew) return J({err:'increw'},409); const c=this.sql.exec('SELECT tag FROM crew WHERE code=?',String(m.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'')).toArray()[0]; if(!c) return J({err:'nocrew'},404);
      const n=this.sql.exec('SELECT COUNT(*) AS c FROM acct WHERE crew=?',c.tag).toArray()[0].c; if(n>=30) return J({err:'full'},409); this.sql.exec('UPDATE acct SET crew=? WHERE nm=?',c.tag,nm); return J({ok:true,crew:this.crewOf(c.tag)}); }
    if(m.op==='crewLeave'){ const tag=me.crew; if(!tag) return J({ok:true}); this.sql.exec('UPDATE acct SET crew=NULL WHERE nm=?',nm); const c=this.sql.exec('SELECT owner FROM crew WHERE tag=?',tag).toArray()[0];
      const left=this.sql.exec('SELECT nm FROM acct WHERE crew=? ORDER BY life DESC LIMIT 1',tag).toArray()[0]; if(!left) this.sql.exec('DELETE FROM crew WHERE tag=?',tag); else if(c&&c.owner===nm) this.sql.exec('UPDATE crew SET owner=? WHERE tag=?',left.nm,tag); return J({ok:true}); }
    if(m.op==='crewInfo'){ const c=this.crewOf(me.crew); if(!c) return J({ok:true,crew:null}); if(c.owner!==nm) delete c.code; c.mine=true; return J({ok:true,crew:c}); }
    if(m.op==='crewTop'){ const rows=this.sql.exec('SELECT c.tag AS tag, c.name AS name, COUNT(a.nm) AS n, SUM(a.life) AS total FROM crew c JOIN acct a ON a.crew=c.tag GROUP BY c.tag ORDER BY total DESC LIMIT 25').toArray(); return J({ok:true,rows}); }
    return J({err:'op'},400); } }
