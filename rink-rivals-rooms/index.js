/* Rink Rivals online rooms: one Durable Object per room code relays messages between up to 4 players. */
const MAX=4;
export default {
  async fetch(req, env){
    const url=new URL(req.url);
    const m=url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if(m){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      const id=env.ROOMS.idFromName(m[1]);
      return env.ROOMS.get(id).fetch(req);
    }
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
    const max=Math.max(2,Math.min(4,...q.map(([,a])=>a.want||2))); const grp=q.slice(0,max), code=QCODE();
    for(const [ws,a] of grp){ a.seek=false; ws.serializeAttachment(a); this.send(ws,{t:'match',code,n:grp.length,names:grp.map(([,b])=>b.name)}); } }
  async webSocketMessage(ws,raw){ if(typeof raw!=='string'||raw.length>2000) return; let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    const a=ws.deserializeAttachment()||{game:'home',name:'Player',seek:false,since:0};
    if(m.t==='here'){ a.game=String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home'; a.name=String(m.name||'Player').slice(0,20); a.seek=false; ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='name'){ a.name=String(m.name||'Player').slice(0,20); ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='seek'){ a.seek=true; a.since=Date.now(); a.want=Math.max(2,Math.min(4,+m.want||2)); if(m.name) a.name=String(m.name).slice(0,20); ws.serializeAttachment(a); this.match(a.game); this.push(); return; }
    if(m.t==='unseek'){ a.seek=false; ws.serializeAttachment(a); this.push(); return; }
    if(m.t==='ping'){ this.send(ws,{t:'pong'}); return; } }
  async webSocketClose(ws){ try{ ws.serializeAttachment(null); ws.close(); }catch(e){} this.push(); }
  async webSocketError(ws){ return this.webSocketClose(ws); }
}
