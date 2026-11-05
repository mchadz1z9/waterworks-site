/* Backup route for chat, online play and admin: rink-rivals.pages.dev/rr/... is passed on to the game server.
   Used automatically when a network (e.g. a school filter) blocks the server's own workers.dev address.
   It forwards the player's real IP and network so bans and the proxy check still work. */
const SERVER='https://rink-rivals-rooms.mitchellchad2026.workers.dev', KEY='__RELAY_KEY__';
export async function onRequest({request}){
  const u=new URL(request.url), target=SERVER+(u.pathname.replace(/^\/rr/,'')||'/')+u.search, cf=request.cf||{}, h=new Headers(request.headers);
  for(const k of ['host','x-rr-relay','x-rr-r-ip','x-rr-r-asn','x-rr-r-aso','x-rr-r-cc']) h.delete(k);
  h.set('x-rr-relay',KEY); h.set('x-rr-r-ip',request.headers.get('cf-connecting-ip')||''); h.set('x-rr-r-asn',String(cf.asn||'')); h.set('x-rr-r-aso',String(cf.asOrganization||'').slice(0,80)); h.set('x-rr-r-cc',String(cf.country||''));
  const init={method:request.method,headers:h,redirect:'manual'}; if(!['GET','HEAD'].includes(request.method)) init.body=await request.arrayBuffer();
  try{ return await fetch(target,init); }catch(e){ return new Response(JSON.stringify({err:'relay'}),{status:502,headers:{'content-type':'application/json'}}); }
}
