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
    const lb=url.pathname.match(/^\/lb\/([a-z0-9]{2,16})$/);
    if(lb){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.BOARDS.get(env.BOARDS.idFromName(lb[1])).fetch(req); }
    if(url.pathname==='/chat'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(req);
    }
    /* site owner tools: clean leaderboards and chat. Needs the ADMIN_KEY secret. */
    const ad=url.pathname.match(/^\/admin\/(lb|chat)(?:\/([a-z0-9]{2,16}))?$/);
    if(ad){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); if(!env.ADMIN_KEY||req.headers.get('x-admin-key')!==env.ADMIN_KEY) return J({err:'forbidden'},403);
      const u=new URL(req.url); u.pathname='/admin'; const r2=new Request(u,req);
      if(ad[1]==='lb'&&ad[2]) return env.BOARDS.get(env.BOARDS.idFromName(ad[2])).fetch(r2);
      if(ad[1]==='chat') return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(r2);
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
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'};
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
const PERSONAL=/(\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|crescent|cres|court|ct)\b|\bmy\s+address\b|\bwhere\s+do\s+you\s+live\b|\bhow\s+old\s+are\s+you\b)/i;
const cleanName=n=>{ let s=String(n||'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,20); if(!s) s='Player'; for(const r of CHAT_BAD){ r.lastIndex=0; if(r.test(s)) return 'Player'; } if(LINK.test(s)||PERSONAL.test(s)) return 'Player'; return s; };
export class Chat {
  constructor(ctx){ this.ctx=ctx; this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS m(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, name TEXT, text TEXT, game TEXT, who TEXT, hid INTEGER DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS r(mid INTEGER, who TEXT, PRIMARY KEY(mid,who))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mute(who TEXT PRIMARY KEY, until INTEGER)'); }
  socks(){ return this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()); }
  send(ws,o){ try{ ws.send(JSON.stringify(o)); }catch(e){} }
  all(o){ const s=JSON.stringify(o); for(const ws of this.ctx.getWebSockets()) try{ ws.send(s); }catch(e){} }
  count(){ this.all({t:'n',n:this.socks().length}); }
  hist(){ return this.sql.exec('SELECT id,ts,name,text,game FROM m WHERE hid=0 ORDER BY id DESC LIMIT 60').toArray().reverse(); }
  async fetch(req){
    if(new URL(req.url).pathname==='/admin'){ let m={}; try{ m=await req.json(); }catch(e){}
      if(m.op==='list') return J({rows:this.sql.exec('SELECT * FROM m ORDER BY id DESC LIMIT 200').toArray()});
      if(m.op==='del'&&m.id){ this.sql.exec('UPDATE m SET hid=1 WHERE id=?',+m.id); this.all({t:'del',id:+m.id}); return J({ok:true}); }
      if(m.op==='mute'&&m.who){ this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',String(m.who),Date.now()+(+m.mins||1440)*60000); return J({ok:true}); }
      if(m.op==='clear'){ this.sql.exec('UPDATE m SET hid=1'); this.all({t:'clear'}); return J({ok:true}); }
      return J({err:'op'},400); }
    if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
    const pair=new WebSocketPair(); const [client,server]=Object.values(pair); this.ctx.acceptWebSocket(server);
    this.send(server,{t:'hist',m:this.hist(),n:this.socks().length+1});
    return new Response(null,{status:101,webSocket:client}); }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>1500) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    let a=ws.deserializeAttachment();
    if(m.t==='hello'){ const who=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24)||crypto.randomUUID().slice(0,12); a={name:cleanName(m.name),game:String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home',who,ts:[],last:''}; ws.serializeAttachment(a); this.count(); return; }
    if(!a) return;
    if(m.t==='where'){ a.game=String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home'; ws.serializeAttachment(a); return; }
    if(m.t==='name'){ a.name=cleanName(m.name); ws.serializeAttachment(a); this.send(ws,{t:'you',name:a.name}); return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; }
    if(m.t==='report'){ const id=+m.id; if(!id) return; this.sql.exec('INSERT OR IGNORE INTO r(mid,who) VALUES(?,?)',id,a.who); const c=this.sql.exec('SELECT COUNT(*) AS c FROM r WHERE mid=?',id).toArray()[0].c;
      if(c>=3){ const row=this.sql.exec('SELECT who FROM m WHERE id=?',id).toArray()[0]; this.sql.exec('UPDATE m SET hid=1 WHERE id=?',id); this.all({t:'del',id}); if(row){ const n=this.sql.exec('SELECT COUNT(*) AS c FROM m WHERE who=? AND hid=1 AND ts>?',row.who,Date.now()-86400000).toArray()[0].c; if(n>=2) this.sql.exec('INSERT OR REPLACE INTO mute(who,until) VALUES(?,?)',row.who,Date.now()+3600000*(n>=4?24:1)); } }
      this.send(ws,{t:'sys',text:'Thanks, that message was reported.'}); return; }
    if(m.t==='say'){ const now=Date.now();
      const mu=this.sql.exec('SELECT until FROM mute WHERE who=?',a.who).toArray()[0]; if(mu&&mu.until>now){ this.send(ws,{t:'sys',text:`You are muted for ${Math.ceil((mu.until-now)/60000)} more minutes.`}); return; }
      let text=String(m.text||'').replace(/[\u0000-\u001f​-‏‪-‮]/g,'').replace(/\s+/g,' ').trim().slice(0,200); if(!text) return;
      a.ts=(a.ts||[]).filter(t=>now-t<20000); if(a.ts.length&&now-a.ts[a.ts.length-1]<1200||a.ts.length>=6){ this.send(ws,{t:'sys',text:'Slow down a little.'}); return; }
      if(text.toLowerCase()===a.last){ this.send(ws,{t:'sys',text:'You just said that.'}); return; }
      if(LINK.test(text)){ this.send(ws,{t:'sys',text:'Links and social media handles are not allowed in chat.'}); return; }
      if(PERSONAL.test(text)){ this.send(ws,{t:'sys',text:'For your safety, don\'t share or ask for phone numbers, emails, addresses or ages.'}); return; }
      for(const r of CHAT_BAD){ r.lastIndex=0; text=text.replace(r,w=>'*'.repeat(w.length)); }
      if(/(.)\1{9,}/.test(text)) text=text.replace(/(.)\1{9,}/g,(x,c)=>c.repeat(5));
      a.ts.push(now); a.last=text.toLowerCase(); ws.serializeAttachment(a);
      this.sql.exec('INSERT INTO m(ts,name,text,game,who) VALUES(?,?,?,?,?)',now,a.name,text,a.game,a.who);
      const id=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; this.sql.exec('DELETE FROM m WHERE id<?',id-600);
      this.all({t:'msg',m:{id,ts:now,name:a.name,text,game:a.game}}); return; } }
  async webSocketClose(ws){ try{ ws.serializeAttachment(null); ws.close(); }catch(e){} this.count(); }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}
