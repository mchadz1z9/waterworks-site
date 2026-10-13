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
