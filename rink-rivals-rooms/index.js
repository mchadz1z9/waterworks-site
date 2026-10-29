/* Rink Rivals online rooms: one Durable Object per room code relays messages between up to 4 players. */
const MAX=8;
export default {
  async fetch(req, env){
    const url=new URL(req.url);
    const m=url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if(m){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      const id=env.ROOMS.idFromName(m[1]);
      return env.ROOMS.get(id).fetch(req);
    }
    if(url.pathname==='/site'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.SITE.get(env.SITE.idFromName('SITE')).fetch(req); }
    const lb=url.pathname.match(/^\/lb\/([a-z0-9]{2,16})$/);
    if(lb){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.BOARDS.get(env.BOARDS.idFromName(lb[1])).fetch(req); }
    if(url.pathname==='/chat'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(req);
    }
    /* site owner tools: clean leaderboards and chat. Needs the ADMIN_KEY secret. */
    const ad=url.pathname.match(/^\/admin\/(lb|chat|site)(?:\/([a-z0-9]{2,16}))?$/);
    if(ad){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
      const key=req.headers.get('x-admin-key'); let role=null;
      if(key&&((env.ADMIN_KEY&&key===env.ADMIN_KEY)||(env.SITE_ADMIN_KEY&&key===env.SITE_ADMIN_KEY))) role='full';
      else { const pid=req.headers.get('x-admin-pid'); if(pid){ try{ const ar=await env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(new Request('https://do/authpid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'authpid',pid})})); const d=await ar.json(); if(d&&d.lvl) role=d.lvl; }catch(e){} } }
      if(!role) return J({err:'forbidden'},403);
      const body=await req.text(); const u=new URL(req.url); u.pathname='/admin';
      const h=new Headers(); h.set('content-type','application/json'); h.set('x-admin-role',role);
      const r2=new Request(u,{method:'POST',headers:h,body});
      if(ad[1]==='lb'&&ad[2]) return env.BOARDS.get(env.BOARDS.idFromName(ad[2])).fetch(r2);
      if(ad[1]==='chat') return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(r2);
      if(ad[1]==='site') return env.SITE.get(env.SITE.idFromName('SITE')).fetch(r2);
      return J({err:'bad'},400); }
    if(url.pathname==='/lobby'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.LOBBY.get(env.LOBBY.idFromName('SITE')).fetch(req);
    }
    return new Response('Rink Rivals rooms',{headers:{'content-type':'text/plain'}});
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
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-admin-key,x-admin-pid'};
const J=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...CORS,'content-type':'application/json','cache-control':'no-store'}});
const BAD=/fuck|shit|cunt|nigg|fag|bitch|whore|slut|rape|hitler|nazi|dick|pussy|cock/i;
export class Board {
  constructor(ctx){ this.ctx=ctx; this.sql=ctx.storage.sql; this.sql.exec('CREATE TABLE IF NOT EXISTS s(b TEXT, pid TEXT, name TEXT, score REAL, txt TEXT, ts INTEGER, PRIMARY KEY(b,pid))'); this.rate=new Map(); }
  top(b,dir,n){ return this.sql.exec(`SELECT pid,name,score,txt,ts FROM s WHERE b=? ORDER BY score ${dir==='asc'?'ASC':'DESC'}, ts ASC LIMIT ?`,b,n).toArray(); }
  async fetch(req){ const url=new URL(req.url);
    if(url.pathname==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      if(m.op==='list') return J({rows:this.sql.exec('SELECT b,pid,name,score,txt,ts FROM s ORDER BY b,score DESC').toArray()});
      if(m.op==='del'&&Array.isArray(m.pids)){ let n=0; for(const p of m.pids){ n+=this.sql.exec('DELETE FROM s WHERE pid=?',String(p)).rowsWritten||0; } return J({ok:true,n}); }
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS grnt(pubid TEXT PRIMARY KEY, lvl TEXT, name TEXT, ts INTEGER)'); }
  socks(){ return this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()); }
  send(ws,o){ try{ ws.send(JSON.stringify(o)); }catch(e){} }
  all(o){ const s=JSON.stringify(o); for(const ws of this.ctx.getWebSockets()) try{ ws.send(s); }catch(e){} }
  count(){ this.all({t:'n',n:this.socks().length}); this.who(); }
  tagOf(name){ const r=this.sql.exec('SELECT tag FROM tag WHERE nm=?',String(name||'').toLowerCase()).toArray()[0]; return r?r.tag:''; }
  grantOf(pubid){ const r=this.sql.exec('SELECT lvl FROM grnt WHERE pubid=?',String(pubid)).toArray()[0]; return r?r.lvl:null; }
  isBanned(name,who){ const now=Date.now(); const chk=k=>{ const r=this.sql.exec('SELECT until FROM ban WHERE nm=?',k).toArray()[0]; return r&&(r.until===0||r.until>now)?r:null; }; return chk(String(name||'').toLowerCase())||(who?chk('pid:'+who):null); }
  socksByPub(pubid){ return this.ctx.getWebSockets().filter(ws=>{ const a=ws.deserializeAttachment(); return a&&pubId(a.who)===pubid; }); }
  who(){ const m=new Map(); for(const ws of this.socks()){ const a=ws.deserializeAttachment(); m.set(a.who,{name:a.name,game:a.game,me:a.who}); }
    const list=[...m.values()].map(x=>({name:x.name,game:x.game,id:pubId(x.me),tag:this.tagOf(x.name)}));
    for(const ws of this.socks()){ const a=ws.deserializeAttachment(); const mine=pubId(a.who); this.send(ws,{t:'who',list:list.map(x=>({...x,me:mine===x.id}))}); } }
  hist(){ return this.sql.exec('SELECT id,ts,name,text,game FROM m WHERE hid=0 ORDER BY id DESC LIMIT 60').toArray().reverse().map(r=>({...r,tag:this.tagOf(r.name)})); }
  async fetch(req){
    const path=new URL(req.url).pathname;
    if(path==='/authpid'){ let m={}; try{ m=await req.json(); }catch(e){} const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); return J({lvl:pid?this.grantOf(pubId(pid)):null}); }
    if(path==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      const role=req.headers.get('x-admin-role')||'full', full=role==='full';
      const FULLONLY=['grant','ungrant','clear']; if(FULLONLY.includes(m.op)&&!full) return J({err:'forbidden'},403);
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
      if(m.op==='grant'){ const pub=String(m.pubid||'').slice(0,12), lvl=m.lvl==='full'?'full':'mod', nm=String(m.name||'').slice(0,24); if(!pub) return J({err:'bad'},400); this.sql.exec('INSERT OR REPLACE INTO grnt(pubid,lvl,name,ts) VALUES(?,?,?,?)',pub,lvl,nm,Date.now()); for(const ws of this.socksByPub(pub)) this.send(ws,{t:'role',lvl}); return J({ok:true}); }
      if(m.op==='ungrant'&&m.pubid){ this.sql.exec('DELETE FROM grnt WHERE pubid=?',String(m.pubid)); for(const ws of this.socksByPub(String(m.pubid))) this.send(ws,{t:'role',lvl:null}); return J({ok:true}); }
      if(m.op==='grants') return J({grants:this.sql.exec('SELECT pubid,lvl,name,ts FROM grnt ORDER BY ts DESC').toArray()});
      if(m.op==='who'){ const seen=new Set(), out=[]; for(const ws of this.socks()){ const a=ws.deserializeAttachment(); if(seen.has(a.who)) continue; seen.add(a.who); out.push({name:a.name,game:a.game,id:pubId(a.who),tag:this.tagOf(a.name)}); } return J({who:out}); }
      if(m.op==='recent'){ const rows=this.sql.exec('SELECT name FROM m WHERE hid=0 ORDER BY id DESC LIMIT 300').toArray(); const seen=new Set(), out=[]; for(const r of rows){ const k=r.name.toLowerCase(); if(seen.has(k)) continue; seen.add(k); out.push({name:r.name,tag:this.tagOf(r.name),banned:!!this.isBanned(r.name)}); if(out.length>=40) break; } return J({recent:out}); }
      if(m.op==='clear'){ this.sql.exec('UPDATE m SET hid=1'); this.all({t:'clear'}); return J({ok:true}); }
      return J({err:'op'},400); }
    if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
    const pair=new WebSocketPair(); const [client,server]=Object.values(pair); this.ctx.acceptWebSocket(server);
    this.send(server,{t:'hist',m:this.hist(),n:this.socks().length+1});
    return new Response(null,{status:101,webSocket:client}); }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>1500) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    let a=ws.deserializeAttachment();
    if(m.t==='hello'){ const who=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24)||crypto.randomUUID().slice(0,12); const nm=cleanName(m.name);
      const b=this.isBanned(nm,who); if(b){ this.send(ws,{t:'kicked',perm:b.until===0,mins:b.until===0?0:Math.ceil((b.until-Date.now())/60000)}); try{ ws.close(4003,'banned'); }catch(e){} return; }
      a={name:nm,game:String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home',who,ts:[],last:''}; ws.serializeAttachment(a);
      const g=this.grantOf(pubId(who)); if(g) this.send(ws,{t:'role',lvl:g}); this.count(); return; }
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
      this.send(ws,{t:'dm',from:mine,to,toName:tgts[0]?tgts[0].deserializeAttachment().name:null,self:true,text,ts:now,delivered:tgts.length>0}); return; }
    if(m.t==='invite'){ const now=Date.now(), to=String(m.to||'').slice(0,12), room=String(m.room||'').toUpperCase(), game=String(m.game||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,16);
      if(!to||!/^[A-Z0-9]{4,8}$/.test(room)||!game) return;
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:'You are muted, so you cannot send invites right now.'}); return; }
      a.inv=(a.inv||[]).filter(t=>now-t<60000); if(a.inv.length>=6){ this.send(ws,{t:'invsent',ok:false,to,why:'Slow down on the invites, try again in a minute.'}); return; }
      const targets=this.socks().filter(s=>{ const b=s.deserializeAttachment(); return b&&pubId(b.who)===to&&b.who!==a.who; });
      if(!targets.length){ this.send(ws,{t:'invsent',ok:false,to,why:'They are not online any more.'}); return; }
      a.inv.push(now); ws.serializeAttachment(a); const tn=targets[0].deserializeAttachment().name;
      for(const s of targets) this.send(s,{t:'invite',from:a.name,game,room});
      this.send(ws,{t:'invsent',ok:true,to,name:tn}); return; }
    if(m.t==='name'){ const nm=cleanName(m.name); if(this.isBanned(nm,a.who)){ this.send(ws,{t:'kicked',perm:true}); try{ ws.close(4003,'banned'); }catch(e){} return; } a.name=nm; ws.serializeAttachment(a); this.send(ws,{t:'you',name:a.name}); this.who(); return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; }
    if(m.t==='report'){ const id=+m.id; if(!id) return; this.sql.exec('INSERT OR IGNORE INTO r(mid,who) VALUES(?,?)',id,a.who); const c=this.sql.exec('SELECT COUNT(*) AS c FROM r WHERE mid=?',id).toArray()[0].c;
      if(c>=3){ const row=this.sql.exec('SELECT who FROM m WHERE id=?',id).toArray()[0]; this.sql.exec('UPDATE m SET hid=1 WHERE id=?',id); this.all({t:'del',id}); if(row){ const n=this.sql.exec('SELECT COUNT(*) AS c FROM m WHERE who=? AND hid=1 AND ts>?',row.who,Date.now()-86400000).toArray()[0].c; if(n>=2) this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',row.who,Date.now()+3600000*(n>=4?24:1)); } }
      this.send(ws,{t:'sys',text:'Thanks, that message was reported.'}); return; }
    if(m.t==='say'){ const now=Date.now();
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:`You are muted for ${Math.ceil((mu.until-now)/60000)} more minutes.`}); return; }
      let text=String(m.text||'').replace(/[\u0000-\u001f​-‏‪-‮]/g,'').replace(/\s+/g,' ').trim().slice(0,200); if(!text) return;
      a.ts=(a.ts||[]).filter(t=>now-t<10000); if(a.ts.length>=8){ this.send(ws,{t:'sys',text:'That is a lot of messages at once, give it a few seconds.'}); return; }
      if(text.toLowerCase()===a.last){ this.send(ws,{t:'sys',text:'You just said that.'}); return; }
      if(gibberish(text)){ this.send(ws,{t:'sys',text:'That looks like keyboard mashing, so it was not sent.'}); return; }
      if(PERSONAL.test(text)){ this.send(ws,{t:'sys',text:'For your safety, don\'t share or ask for phone numbers, emails, addresses or ages.'}); return; }
      for(const r of CHAT_BAD){ r.lastIndex=0; text=text.replace(r,w=>'*'.repeat(w.length)); }
      if(/(.)\1{9,}/.test(text)) text=text.replace(/(.)\1{9,}/g,(x,c)=>c.repeat(5));
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
  constructor(ctx){ this.ctx=ctx; this.s=ctx.storage; }
  async state(){ return { ann: await this.s.get('ann')||null, ov: await this.s.get('ov')||[] }; }
  async fetch(req){
    const url=new URL(req.url);
    if(url.pathname==='/site'){ const st=await this.state(); return new Response(JSON.stringify(st),{headers:{...CORS,'content-type':'application/json','cache-control':'public,max-age=15'}}); }
    if(url.pathname==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      const role=req.headers.get('x-admin-role')||'full', full=role==='full';
      if(m.op==='get') return J({...await this.state(),role});
      if(!full) return J({err:'forbidden'},403);
      if(m.op==='ann'){ const title=String(m.title||'').slice(0,120), body=String(m.body||'').slice(0,2000); if(!title&&!body) return J({err:'empty'},400);
        await this.s.put('ann',{id:Date.now().toString(36),title,body,ts:Date.now()}); return J({ok:true}); }
      if(m.op==='annClear'){ await this.s.delete('ann'); return J({ok:true}); }
      if(m.op==='ov'){ const e=m.entry||{}; const lg=String(e.lg||''), name=String(e.name||'').slice(0,40); if(!lg||!name) return J({err:'bad'},400);
        const ov=(await this.s.get('ov'))||[]; const clean={lg,name,edit:true}; if(e.ovr!=null&&e.ovr!=='') clean.ovr=Math.max(1,Math.min(99,Math.round(+e.ovr))); if(e.tid) clean.tid=String(e.tid).slice(0,12); if(e.pos) clean.pos=String(e.pos).slice(0,4);
        if(e.skills&&typeof e.skills==='object'){ clean.skills={}; for(const k of Object.keys(e.skills).slice(0,16)){ const v=+e.skills[k]; if(v>=1&&v<=99) clean.skills[String(k).slice(0,6)]=Math.round(v); } }
        const i=ov.findIndex(x=>x.lg===lg&&x.name===name); if(i>=0) ov[i]=clean; else ov.push(clean); await this.s.put('ov',ov.slice(-200)); return J({ok:true}); }
      if(m.op==='ovDel'){ const ov=((await this.s.get('ov'))||[]).filter(x=>!(x.lg===m.lg&&x.name===m.name)); await this.s.put('ov',ov); return J({ok:true}); }
      if(m.op==='ovClear'){ await this.s.delete('ov'); return J({ok:true}); }
      return J({err:'op'},400); }
    return J({err:'path'},404);
  }
}
