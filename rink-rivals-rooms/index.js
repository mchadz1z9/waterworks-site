/* Arcade Rivals online rooms: one Durable Object per room code relays messages between up to 4 players. */
const MAX=8;

/* ---------- Rink Rivals AI: a homework / chat helper that can read photos, and a picture maker (Cloudflare Workers AI) ---------- */
const AI_SYS="You are Rink Rivals AI, the friendly helper on Arcade Rivals, a games website used by school kids. Be kind, clear and short (a few sentences unless asked for more). "+
 "If the user sends a photo, read it carefully: for maths, work it out step by step and give the final answer clearly; for other homework, explain it simply. "+
 "Help with learning, games, coding, stories and ideas. Never produce anything sexual, hateful, violent in a graphic way, or about self-harm, drugs or weapons; if asked, say kindly that you can't help with that and suggest a trusted adult if it sounds serious. "+
 "Never ask for or repeat personal details (full names, addresses, phone numbers, passwords). You are an AI and can make mistakes, so for important answers suggest double-checking.";
const AI_MODES={homework:'Mode: Homework helper. Teach step by step so the student learns; show working, then the answer.',coach:'Mode: Game coach. Give practical tips, strategies and tricks for video games and sports.',story:'Mode: Story writer. Write fun, vivid, age-appropriate stories, poems and ideas; keep going if asked.',code:'Mode: Code helper. Explain and write code clearly (HTML, JavaScript, Python, Scratch ideas); use fenced code blocks.',quiz:'Mode: Quiz master. Ask one question at a time, wait for the answer, say if it is right, keep score, then ask the next.',eli10:'Mode: Explain like I am 10. Use simple words, short sentences and a fun example.'};
const AI_BLOCK=/\b(nude|naked|nsfw|sex|sexy|porn|boob|breast|genital|penis|vagina|gore|gory|blood(y)?|behead|corpse|suicide|self[- ]?harm|kill (him|her|them|myself)|swastika|nazi|kkk|drug|cocaine|meth|weed|gun|rifle|pistol|bomb|shoot(ing)?)\b/i;
const AI_HITS=new Map();
function aiRate(ip,kind,max,win){ const now=Date.now(), k=kind+':'+ip, a=(AI_HITS.get(k)||[]).filter(t=>now-t<win); if(a.length>=max){ AI_HITS.set(k,a); return false; } a.push(now); AI_HITS.set(k,a); if(AI_HITS.size>5000) AI_HITS.clear(); return true; }
async function rrAI(req,env,RCF){
  if(!env.AI) return J({err:'AI is not switched on for this server yet'},503);
  const ip=req.headers.get('cf-connecting-ip')||'?'; let b=null; try{ b=await req.json(); }catch(e){ return J({err:'bad'},400); }
  const op=b&&b.op;
  if(op==='image'){
    const prompt=String(b.prompt||'').slice(0,400).trim(); if(prompt.length<3) return J({err:'Describe the picture you want'},400);
    if(AI_BLOCK.test(prompt)) return J({err:"I can't make that picture — try something else!"},400);
    if(!aiRate(ip,'img',8,3600000)) return J({err:'Picture limit reached — try again in a bit (8 an hour)'},429);
    const P=prompt+', family friendly, high quality, detailed', hd=b.q==='hd', W=[1024,768,1344].includes(+b.w)?+b.w:1024, Hh=[1024,768,1344].includes(+b.h)?+b.h:1024;
    const tries=hd?[['@cf/leonardo/lucid-origin',{prompt:P,width:W,height:Hh,steps:30}],['@cf/leonardo/phoenix-1.0',{prompt:P,width:W,height:Hh,num_steps:25}],['@cf/black-forest-labs/flux-1-schnell',{prompt:P,steps:8}]]:[['@cf/black-forest-labs/flux-1-schnell',{prompt:P,steps:6}]];
    let why='';
    for(const [m,inp] of tries){ try{ const r=await env.AI.run(m,inp); let img=null;
        if(r&&r.image) img='data:image/jpeg;base64,'+r.image;
        else if(r instanceof ReadableStream||(r&&typeof r.getReader==='function')){ const buf=new Uint8Array(await new Response(r).arrayBuffer()); let bin=''; for(let i=0;i<buf.length;i+=8192) bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192)); img='data:image/png;base64,'+btoa(bin); }
        if(img) return J({image:img,model:m.split('/').pop()}); }catch(e){ why=String(e&&e.message||e).slice(0,160); } }
    return J({err:'The picture maker is busy, try again',why},502);
  }
  if(op!=='chat') return J({err:'bad'},400);
  if(!aiRate(ip,'chat',40,600000)) return J({err:'Slow down a little — try again in a few minutes'},429);
  const hist=Array.isArray(b.messages)?b.messages.slice(-16):[]; const msgs=[{role:'system',content:'Today is '+new Date().toISOString().slice(0,10)+'. '+AI_SYS+(AI_MODES[b.mode]?' '+AI_MODES[b.mode]:'')+' Use Markdown: **bold**, lists, headings and fenced code blocks when helpful.'}];
  for(const m of hist){ if(!m||(m.role!=='user'&&m.role!=='assistant')) continue; msgs.push({role:m.role,content:String(m.content||'').slice(0,4000)}); }
  if(msgs.length<2||msgs[msgs.length-1].role!=='user') return J({err:'Say something first'},400);
  let sources=[];
  if(b.web&&!b.image){ try{ const lastQ=msgs[msgs.length-1].content.slice(0,120); const d=await wsData(lastQ,false); const top=(d.results||[]).slice(0,6); sources=top.map(x=>({t:x.t,u:x.u}));
      const ctx=(d.wiki?'Wikipedia — '+d.wiki.t+': '+d.wiki.d+'\n':'')+top.map((x,i)=>'['+(i+1)+'] '+x.t+' — '+x.d+' ('+x.u+')').join('\n');
      if(ctx) msgs.splice(msgs.length-1,0,{role:'system',content:'Fresh web search results for the next question (use them if helpful, cite like [1], and say if they don\'t answer it):\n'+ctx}); if(d.wiki) sources.unshift({t:'Wikipedia: '+d.wiki.t,u:d.wiki.u}); }catch(e){} }
  let img=typeof b.image==='string'&&/^data:image\/(png|jpe?g|webp);base64,/.test(b.image)?b.image:null; if(img&&img.length>2800000) return J({err:'That photo is too big'},400);
  try{
    if(img){ const last=msgs.pop(); msgs.push({role:'user',content:[{type:'text',text:last.content||'What is in this picture? If it is a question, answer it.'},{type:'image_url',image_url:{url:img}}]}); }
    const model=img?'@cf/meta/llama-4-scout-17b-16e-instruct':'@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    if(b.stream){ let st; try{ st=await env.AI.run(model,{messages:msgs,max_tokens:1400,temperature:.5,stream:true}); }catch(e){ st=await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',{messages:msgs,max_tokens:1400,temperature:.5,stream:true}); }
      return new Response(st,{headers:{...CORS,'content-type':'text/event-stream','cache-control':'no-store','x-sources':encodeURIComponent(JSON.stringify(sources.slice(0,6)))}}); }
    const r=await env.AI.run(model,{messages:msgs,max_tokens:1400,temperature:.5});
    let t=r&&(r.response!=null?r.response:r.result&&r.result.response); if(typeof t!=='string') t=JSON.stringify(t||'');
    return J({reply:t.trim()||'Hmm, I could not think of an answer. Try asking another way?',sources});
  }catch(e){ return J({err:'The AI is busy right now — try again in a moment',why:String(e&&e.message||e).slice(0,200)},502); }
}

/* ---------- Rivals Browser: can this page be shown inside another site? (status OK, no X-Frame-Options / frame-ancestors block) ---------- */
async function frameOK(u){ let x; try{ x=new URL(u); }catch(e){ return false; } if(x.protocol!=='https:'||/^(localhost|[\d.]+|\[.*\])$/i.test(x.hostname)||/\.(local|internal)$/i.test(x.hostname)) return false;
  const c=caches.default, key=new Request('https://fc.cache/'+encodeURIComponent(x.href)); const hit=await c.match(key); if(hit) return (await hit.text())==='1';
  let ok=false; try{ const ac=new AbortController(), t=setTimeout(()=>ac.abort(),5000); const r=await fetch(x.href,{redirect:'follow',signal:ac.signal,headers:{'user-agent':'Mozilla/5.0 (RivalsBrowser frame check)'}}); clearTimeout(t);
    const xf=(r.headers.get('x-frame-options')||'').toLowerCase(), csp=(r.headers.get('content-security-policy')||'').toLowerCase(), fa=(csp.match(/frame-ancestors([^;]*)/)||[])[1];
    ok=r.status<400&&!/deny|sameorigin/.test(xf)&&(fa==null||/\*(\s|$)|rink-rivals/.test(fa)); try{ r.body&&r.body.cancel(); }catch(e){} }catch(e){ ok=false; }
  await c.put(key,new Response(ok?'1':'0',{headers:{'cache-control':'max-age=86400'}})); return ok; }
async function frameCheck(url){ const us=url.searchParams.getAll('u').slice(0,40); const out={}; await Promise.all(us.map(async u=>{ out[u]=await frameOK(u); })); return J(out); }

/* ---------- Rivals Browser: free web games from itch.io (lists, and the playable file inside a game's page) ---------- */
const ITCH_BAD=/\b(18\+|nsfw|adult|hentai|porn|sex|lewd|erotic|nude|yandere|gore|gory|horror|creepy|blood|kill|murder|suicide|drug|gambl|casino|dating sim|mature)\b/i;
const ITCH_IP=/\b(mario|luigi|pok[eé]mon|pikachu|sonic|zelda|kirby|minecraft|eaglercraft|fnaf|five nights|roblox|fortnite|among us|spider-?man|batman|disney|pac-?man|tetris|undertale fan)\b/i;
const unx=t=>String(t||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#0*(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi,(m,n)=>String.fromCharCode(parseInt(n,16))).replace(/&nbsp;/g,' ').replace(/&(?:mdash|ndash);/g,'–').replace(/&(?:rsquo|lsquo);/g,"'").replace(/&(?:rdquo|ldquo);/g,'"').replace(/&hellip;/g,'…');
async function itchFetch(u,ttl){ const c=caches.default, key=new Request('https://itch.cache/'+encodeURIComponent(u)); let r=await c.match(key); if(r) return await r.text();
  const up=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (RivalsBrowser)','accept-language':'en-US'}}); if(!up.ok) return ''; const t=await up.text(); await c.put(key,new Response(t,{headers:{'cache-control':'max-age='+(ttl||3600)}})); return t; }
async function itchList(url){ const q=String(url.searchParams.get('q')||'').trim().slice(0,60), tag=String(url.searchParams.get('tag')||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30); let out=[];
  const rss=x=>{ const o=[]; for(const it of x.split('<item>').slice(1)){ const g=k=>unx((it.match(new RegExp('<'+k+'>([\\s\\S]*?)</'+k+'>'))||[])[1]); const d=g('description').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); o.push({t:g('plainTitle')||g('title'),u:g('link'),img:g('imageurl'),by:'',d:d.slice(0,140),full:g('title')+' '+d}); } return o; };
  try{ if(q){ const asTag=q.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); if(asTag) out=rss(await itchFetch('https://itch.io/games/html5/tag-'+asTag+'.xml',3600)); }
    if(q&&out.length<6){ const h=await itchFetch('https://itch.io/search?type=games&platform=web&q='+encodeURIComponent(q),1800);
      for(const cell of h.split('<div class="game_cell ').slice(1)){ const u=(cell.match(/href="(https:\/\/[a-z0-9-]+\.itch\.io\/[a-z0-9-]+)"/)||[])[1], t=(cell.match(/class="title game_link">([^<]+)</)||[])[1], img=(cell.match(/data-lazy_src="([^"]+)"/)||[])[1], by=(cell.match(/class="game_author"><a[^>]*>([^<]+)</)||[])[1]; if(u&&t&&!out.some(x=>x.u===u)) out.push({t:unx(t),u,img:img||'',by:unx(by||''),d:''}); } }
    if(!q){ const feed=tag?'https://itch.io/games/html5/tag-'+tag+'.xml':'https://itch.io/games/top-rated/html5.xml'; out=rss(await itchFetch(feed,3600)); } }catch(e){}
  out=out.filter(x=>/^https:\/\/[a-z0-9-]+\.itch\.io\/[a-z0-9-]+$/.test(x.u)&&!ITCH_BAD.test(x.t+' '+(x.full||x.d))&&!ITCH_IP.test(x.t+' '+(x.full||x.d))&&!/\b(music|sound|sfx|asset|assets|font|sprite|sprites|tileset|pack|template|plugin|tool)\b/i.test(x.t)).map(({full,...r})=>r).slice(0,40);
  return J({games:out}); }
async function itchPlay(url){ const u=String(url.searchParams.get('u')||''); if(!/^https:\/\/[a-z0-9-]+\.itch\.io\/[a-z0-9-]+$/.test(u)) return J({err:'bad'},400);
  try{ const h=await itchFetch(u,21600); if(/class="[^"]*content_warning|adult_content|This game contains mature content|is_adult/i.test(h)) return J({err:'This game is marked for adults only.'});
    const title=unx((h.match(/<title>([^<]*)<\/title>/)||[])[1]||'').replace(/ by .*$/,'').trim();
    if(ITCH_BAD.test(title)||ITCH_IP.test(title)) return J({err:'This game is not available here.'});
    let m=h.match(/https?:\/\/[a-z-]*\.?itch\.zone\/html\/[\d-]+\/[^"'&\s<>]*/)||h.match(/\/\/[a-z-]*\.?itch\.zone\/html\/[\d-]+\/[^"'&\s<>]*/);
    if(!m){ const e=(h.match(/itch\.io\/embed-upload\/(\d+)/)||[])[1]; if(e) return J({play:'https://itch.io/embed-upload/'+e+'?color=0b1020',title}); return J({err:'This game only runs on its own page (or as a download).',page:u}); }
    /* itch.io blocks its game files from being linked directly, so use itch's own embed player for that upload */
    const up=(m[0].match(/\/html\/(\d+)/)||[])[1]; if(!up) return J({err:'Could not open that game.'});
    return J({play:'https://itch.io/embed-upload/'+up+'?color=0b1020',title}); }catch(e){ return J({err:'Could not open that game.'},502); } }

/* ---------- Rivals Browser: web search (DuckDuckGo with strict safe search; Wikipedia as a backup) ---------- */
const WS_BAD=/\b(porn|xxx|nsfw|hentai|onlyfans|nude|naked|sex|escort|casino|betting|gambl|xvideos|pornhub|rule ?34|gore|torrent|piratebay|crack(ed)? download|warez)\b/i;
async function webSearch(url){ return J(await wsData(String(url.searchParams.get('q')||''),true)); }
async function wsData(q0,frames){ const q=String(q0||'').trim().slice(0,120); if(!q) return {results:[]}; if(WS_BAD.test(q)) return {results:[],blocked:true};
  const c=caches.default, key=new Request('https://ws.cache/'+encodeURIComponent(q.toLowerCase())); const hit=await c.match(key); if(hit) return await hit.json();
  let out=[], src='';
  const clean=x=>unx(String(x||'').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
  /* Bing, with strict safe search */
  try{ const r=await fetch('https://www.bing.com/search?adlt=strict&setlang=en-US&cc=US&q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36','accept-language':'en-US,en;q=0.9','cookie':'SRCHHPGUSR=ADLT=STRICT'}});
    const h=await r.text(); for(const blk of h.split('class="b_algo"').slice(1)){ const m=blk.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/); if(!m) continue; let u=m[1].replace(/&amp;/g,'&');
      if(/bing\.com\/ck\/a/.test(u)){ const e=(u.match(/[?&]u=a1([^&]+)/)||[])[1]; if(e){ try{ u=atob(e.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((e.length+3)%4)); }catch(x){ continue; } } else continue; }
      if(!/^https?:\/\//.test(u)) continue; const sn=(blk.match(/<p[^>]*>([\s\S]*?)<\/p>/)||[])[1]; out.push({t:clean(m[2]),u,d:clean(sn).slice(0,220)}); if(out.length>=20) break; }
    if(out.length) src='web'; }catch(e){}
  if(!out.length) try{ const r=await fetch('https://html.duckduckgo.com/html/?kp=1&kl=us-en&q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36','accept-language':'en-US,en;q=0.9'}});
    const h=await r.text(); for(const blk of h.split('class="result ').slice(1)){ if(/result--ad/.test(blk.slice(0,80))) continue;
      let u=(blk.match(/class="result__a"[^>]*href="([^"]+)"/)||[])[1]; const t=(blk.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)||[])[1], sn=(blk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)||[])[1];
      if(!u||!t) continue; u=u.replace(/&amp;/g,'&'); const ud=(u.match(/[?&]uddg=([^&]+)/)||[])[1]; if(ud) u=decodeURIComponent(ud); if(u.startsWith('//')) u='https:'+u; if(!/^https?:\/\//.test(u)||/duckduckgo\.com\/y\.js/.test(u)) continue;
      out.push({t:clean(t),u,d:clean(sn).slice(0,220)}); if(out.length>=20) break; }
    if(out.length) src='web'; }catch(e){}
  if(!out.length){ try{ const r=await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=12&srsearch='+encodeURIComponent(q),{headers:{'user-agent':'ArcadeRivals/1.0 (games site)'}}); const j=await r.json();
      out=(j.query&&j.query.search||[]).map(x=>({t:x.title,u:'https://en.wikipedia.org/wiki/'+encodeURIComponent(x.title.replace(/ /g,'_')),d:unx(x.snippet.replace(/<[^>]+>/g,''))})); src='wikipedia'; }catch(e){} }
  out=out.filter(x=>!WS_BAD.test(x.t+' '+x.u+' '+x.d));
  /* which results can open inside the Rivals Browser */
  if(frames) await Promise.all(out.map(async x=>{ x.frame=await frameOK(x.u).catch(()=>false); }));
  /* a quick answer from Wikipedia for the top of the results */
  let wiki=null; try{ const r=await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch='+encodeURIComponent(q),{headers:{'user-agent':'ArcadeRivals/1.0 (games site)'}}); const j=await r.json(); const t=j.query&&j.query.search&&j.query.search[0]&&j.query.search[0].title; if(t){ const sr=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t.replace(/ /g,'_')),{headers:{'user-agent':'ArcadeRivals/1.0 (games site)'}}); const sj=await sr.json(); if(sj&&sj.extract&&sj.type!=='disambiguation'&&!WS_BAD.test(sj.extract)) wiki={t:sj.title,d:sj.extract.slice(0,600),u:(sj.content_urls&&sj.content_urls.desktop&&sj.content_urls.desktop.page)||('https://en.wikipedia.org/wiki/'+encodeURIComponent(t)),img:sj.thumbnail&&sj.thumbnail.source||''}; } }catch(e){}
  const res={results:out,src,wiki}; if(frames) await c.put(key,new Response(JSON.stringify(res),{headers:{'cache-control':'max-age=1800'}})); return res; }
/* Rival Clips live search: YouTube's official search (strict safe search, embeddable videos only), then our own kid filter.
   Each search is cached for a day so the daily allowance stretches across everyone on the site. Needs the YT_KEY secret. */
const YT_BAD=/(offensive|flirt|abuse|stand ?up comedy|\bcomedian|hangover|\bbra\b|lingerie|swimsuit|bikini|\bthong|booty|\bbutt\b|\bass\b|\bpee\b|\bpoop|toilet|vomit|puke|rizz|gyat|skibidi|horny|\bnude|naked|\bstrip|pole dance|\bdies?\b|\bdied\b|suicid|self harm|depress|\bgun|\bshoot(ing|er)\b|knife|weapon|attack|\bwar\b|military|missile|bomb|politic|trump|biden|president|election|terror|accident|crash|\bdead\b|\bkill|murder|blood|gore|horror|scary|creepy|prank|\bsexy|\bsex\b|kiss|dating|drunk|beer|alcohol|vape|\bdrug|casino|gambl)/i;
async function ytSearch(url,env){
  const H={...CORS,'content-type':'application/json'};
  const q=String(url.searchParams.get('q')||'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,80), pt=String(url.searchParams.get('p')||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
  if(!q) return new Response(JSON.stringify({items:[]}),{headers:H});
  if(YT_BAD.test(q)) return new Response(JSON.stringify({items:[],blocked:true}),{headers:H});
  if(!env.YT_KEY) return new Response(JSON.stringify({items:[],err:'nokey'}),{headers:H});
  const ck=new Request('https://yts.cache/'+encodeURIComponent(q.toLowerCase())+'?p='+pt), cache=caches.default;
  const hit=await cache.match(ck); if(hit) return new Response(hit.body,{headers:{...H,'x-cache':'hit'}});
  const api='https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&safeSearch=strict&videoEmbeddable=true&relevanceLanguage=en&regionCode=US&q='+encodeURIComponent(q)+(pt?'&pageToken='+pt:'');
  let d; try{ const r=await fetch(api,{headers:{'X-Goog-Api-Key':env.YT_KEY}}); d=await r.json(); if(!r.ok){ const why=(((d.error||{}).errors||[])[0]||{}).reason||'err'; return new Response(JSON.stringify({items:[],err:why==='quotaExceeded'?'quota':'api'}),{headers:H}); } }catch(e){ return new Response(JSON.stringify({items:[],err:'net'}),{headers:H}); }
  const dec=t=>String(t||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const items=(d.items||[]).filter(i=>i.id&&i.id.videoId&&i.snippet).map(i=>({yt:i.id.videoId,title:dec(i.snippet.title),by:dec(i.snippet.channelTitle),ts:Date.parse(i.snippet.publishedAt)||0,live:i.snippet.liveBroadcastContent==='live'})).filter(i=>!YT_BAD.test(i.title+' '+i.by));
  const body=JSON.stringify({items,next:d.nextPageToken||''});
  await cache.put(ck,new Response(body,{headers:{'content-type':'application/json','cache-control':'public,max-age=86400'}}));
  return new Response(body,{headers:H});
}

/* Games page "New this week": GameMonetize's newest games, read once every 6 hours and run through the same kid filter as the main list */
const NET_BAD=new RegExp(String.raw`(blood|gore|gory|kiss|dating|\bdate\b|romance|romantic|girlfriend|boyfriend|crush|valentine|pregnan|sexy|\bsex|bikini|lingerie|nude|naked|drunk|beer|alcohol|vodka|casino|gambl|\bslots?\b|\bbet(ting)?\b|horror|scary|creepy|terrif|nightmare|granny|skibidi|toilet|poop|\bfart|prank|murder|\bkill(er|ing)?\b.*(people|human|civilian)|torture|serial|cigar|smok|weed|\bdrug|suicide|hell\b|devil|demon|satan|jail ?break|prison|gang|mafia|thug|hitman|assassin|sniper.*(city|people)|baby hazel|surgery|doctor game|dentist|hospital|wedding|marry|bride|tiktok|instagram|monkey mart|celebrity|princess.*(date|kiss)|squid game|backrooms|huggy|poppy|siren head|five nights|fnaf|freddy|rainbow friends|minecraft|roblox|among us|fortnite|mario|sonic|pokemon|pikachu|spongebob|disney|barbie|lego|subway surf|temple run|angry birds|cut the rope|stumble guys|fall guys|geometry dash|slither|agar|krunker|shell shock|1v1\.lol|bloxd|stickman hook)`,'i');
const NET_SEC={"Racing":"Racing","Shooting":"Shooters","Sports":"Sports","Soccer":"Sports","Action":"Action","Stickman":"Action","Boys":"Action","Multiplayer":"Multiplayer",".IO":"Multiplayer","2 Player":"Multiplayer","Puzzle":"Puzzle","Adventure":"Adventure","3D":"Adventure","Arcade":"Arcade","Hypercasual":"Casual","Clicker":"Casual","Girls":"Casual","Cooking":"Casual"};
async function netNew(){ const H={...CORS,'content-type':'application/json','cache-control':'public, max-age=1800'}; const ck=new Request('https://net.cache/new'), cache=caches.default; const hit=await cache.match(ck); if(hit) return new Response(hit.body,{headers:H});
  const out=[]; const S=['Racing','Shooters','Sports','Action','Adventure','Multiplayer','Puzzle','Arcade','Casual'];
  for(const pg of [1,2]){ try{ const r=await fetch('https://gamemonetize.com/feed.php?format=0&num=100&page='+pg,{cf:{cacheTtl:21600}}); const L=await r.json();
    for(const g of L||[]){ const h=(String(g.url||'').match(/^https:\/\/html5\.gamemonetize\.co\/([a-z0-9]+)\/$/)||[])[1]; const t=String(g.title||'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
      if(!h||!/^[\x20-\x7e]{3,80}$/.test(t)||NET_BAD.test(t+' '+(g.description||'')+' '+(g.tags||''))) continue;
      out.push([String(g.id).replace(/\D/g,''),h,t,S.indexOf(NET_SEC[g.category]||'Casual'),String(g.tags||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().slice(0,70)]); } }catch(e){} }
  const body=JSON.stringify({games:out,secs:S}); if(out.length) await cache.put(ck,new Response(body,{headers:{'content-type':'application/json','cache-control':'public, max-age=21600'}})); return new Response(body,{headers:H}); }

/* Rival Sports Center: ESPN's public scoreboards and standings, trimmed and cached */
const SC_LG={nfl:'football/nfl',nba:'basketball/nba',nhl:'hockey/nhl',mlb:'baseball/mlb'};
async function scBoard(lg,date){ const path=SC_LG[lg]; if(!path) return null; const d=/^\d{8}$/.test(date||'')?date:'';
  const key=new Request('https://sc.cache/board/'+lg+'/'+(d||'today')), c=caches.default; const hit=await c.match(key); if(hit) return hit.json();
  let j; try{ const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard'+(d?'?dates='+d:''),{headers:{'user-agent':'ArcadeRivals/1.0'}}); if(!r.ok) return null; j=await r.json(); }catch(e){ return null; }
  const team=t=>({ab:t.team.abbreviation,name:t.team.shortDisplayName||t.team.displayName,full:t.team.displayName,logo:t.team.logo||'',score:t.score!=null?String(t.score):'',rec:((t.records||[])[0]||{}).summary||'',win:!!t.winner,color:t.team.color||''});
  const games=(j.events||[]).map(e=>{ const c=(e.competitions||[])[0]||{}, cs=c.competitors||[], h=cs.find(x=>x.homeAway==='home'), a=cs.find(x=>x.homeAway==='away'); const st=(e.status&&e.status.type)||{};
    return {id:String(e.id),date:e.date,st:st.state||'pre',det:st.shortDetail||'',home:h?team(h):null,away:a?team(a):null,tv:(((c.broadcasts||[])[0]||{}).names||[]).join(', '),venue:(c.venue||{}).fullName||''}; }).filter(g=>g.home&&g.away);
  const out={lg,date:d||((j.day||{}).date||'').replace(/-/g,''),games}; const live=games.some(g=>g.st==='in');
  await c.put(key,new Response(JSON.stringify(out),{headers:{'content-type':'application/json','cache-control':'public, max-age='+(live?20:d?600:90)}})); return out; }
async function scStand(lg){ const path=SC_LG[lg]; if(!path) return null; const key=new Request('https://sc.cache/stand/'+lg), c=caches.default; const hit=await c.match(key); if(hit) return hit.json();
  let j; try{ const r=await fetch('https://site.api.espn.com/apis/v2/sports/'+path+'/standings',{headers:{'user-agent':'ArcadeRivals/1.0'}}); if(!r.ok) return null; j=await r.json(); }catch(e){ return null; }
  const groups=[]; const walk=(n)=>{ if(n.standings&&n.standings.entries) groups.push({name:n.name,teams:n.standings.entries.map(e=>{ const S={}; for(const x of e.stats||[]) S[x.name]=x.displayValue; return {ab:e.team.abbreviation,name:e.team.shortDisplayName||e.team.displayName,logo:((e.team.logos||[])[0]||{}).href||'',w:S.wins||'0',l:S.losses||'0',t:S.ties||S.otLosses||'',pct:S.winPercent||'',gb:S.gamesBehind||'',pts:S.points||'',seed:+(S.playoffSeed||99),strk:S.streak||''}; }).sort((a,b)=>a.seed-b.seed)}); for(const ch of n.children||[]) walk(ch); }; walk(j);
  const out={lg,groups}; await c.put(key,new Response(JSON.stringify(out),{headers:{'content-type':'application/json','cache-control':'public, max-age=1800'}})); return out; }

/* Rival Game Day: one game's live details (score, recent plays, scoring plays, leaders, win chance), trimmed and cached */
async function gdSum(lg,id){ const path=SC_LG[lg]; if(!path||!/^\d{5,14}$/.test(id||'')) return null; const key=new Request('https://sc.cache/gd/'+lg+'/'+id), c=caches.default; const hit=await c.match(key); if(hit) return hit.json();
  let d; try{ const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+id,{headers:{'user-agent':'ArcadeRivals/1.0'}}); if(!r.ok) return null; d=await r.json(); }catch(e){ return null; }
  const comp=((d.header||{}).competitions||[])[0]||{}, cs=comp.competitors||[], st=((comp.status||{}).type)||{}, byId={};
  const team=t=>{ byId[t.id]=t.team.abbreviation; return {ab:t.team.abbreviation,name:t.team.shortDisplayName||t.team.displayName||t.team.name,logo:((t.team.logos||[])[0]||{}).href||t.team.logo||'',score:t.score!=null?String(t.score):'',rec:((t.record||[])[0]||{}).displayValue||((t.record||[])[0]||{}).summary||'',color:t.team.color||'',win:!!t.winner}; };
  const h=cs.find(x=>x.homeAway==='home'), a=cs.find(x=>x.homeAway==='away'); if(!h||!a) return null; const home=team(h), away=team(a);
  let plays=[]; if(d.drives){ for(const dr of (d.drives.previous||[]).concat(d.drives.current?[d.drives.current]:[])){ const tm=((dr.team||{}).abbreviation)||''; for(const p of dr.plays||[]) plays.push([p,tm]); } } else plays=(d.plays||[]).map(p=>[p,byId[(p.team||{}).id]||'']);
  const seen=new Set(); plays=plays.filter(([p])=>!seen.has(p.id)&&seen.add(p.id));
  const P=([p,tm])=>({t:String(p.text||'').trim().slice(0,220),c:((p.clock||{}).displayValue)||'',p:((p.period||{}).number)||'',s:!!p.scoringPlay,tm,hs:p.homeScore,as:p.awayScore});
  const scoring=(d.scoringPlays||plays.filter(([p])=>p.scoringPlay).map(x=>x[0])).map(p=>P([p,((p.team||{}).abbreviation)||byId[(p.team||{}).id]||''])).slice(-30);
  const leaders=(d.leaders||[]).map(l=>({ab:((l.team||{}).abbreviation)||'',cats:(l.leaders||[]).slice(0,3).map(x=>{ const y=(x.leaders||[])[0]||{}; return {n:x.displayName||x.name,who:((y.athlete||{}).shortName)||((y.athlete||{}).displayName)||'',v:y.displayValue||''}; })}));
  const wp=(d.winprobability||[]).slice(-1)[0], hw=wp&&wp.homeWinPercentage!=null?Math.round(wp.homeWinPercentage*100):null;
  const out={lg,id,st:st.state||'pre',det:st.shortDetail||st.detail||'',date:comp.date||'',home,away,plays:plays.slice(-30).reverse().map(P),scoring:scoring.reverse(),leaders,hw,venue:(((d.gameInfo||{}).venue)||{}).fullName||''};
  await c.put(key,new Response(JSON.stringify(out),{headers:{'content-type':'application/json','cache-control':'public, max-age='+(out.st==='in'?10:out.st==='post'?3600:120)}})); return out; }

/* Rival League: draft a football team from the classmates + real NFL pool, set a lineup, trade, and play a short season.
   One JSON blob per league; games are simulated (seeded, so results never change) when their time comes. */
const LG_POOL=[["Connor",100,100,100,100,"k"],["Aiden Chad",92,94,93,97,"k"],["Max Bernstein",85,89,86,84,"k"],["Justin Morrell",86,92,88,97,"k"],["Noah B",97,96,86,89,"k"],["Micah Sukerman",84,88,86,93,"k"],["Noah Carter",78,89,80,85,"k"],["Olivia",93,90,84,86,"k"],["Weston",96,97,90,97,"k"],["Jonah",96,97,87,94,"k"],["David",98,99,99,89,"k"],["Sam Z",99,100,93,97,"k"],["Noah C",91,93,92,87,"k"],["Bentley",85,92,94,80,"k"],["Jacob",86,98,96,92,"k"],["Erald",90,95.5,86,98,"k"],["Ely K",95,96,91,92,"k"],["Ely H",90,94,89,98,"k"],["Joseph",99,92,90,91,"k"],["Yonaton",87,92,92,90,"k"],["Aaron K",88,90,87,95,"k"],["Izzy",89,91,88,95,"k"],["Charlie",95,93,90,91,"k"],["Adam",90,95,89,92.5,"k"],["Brayden",89,90,83,95,"k"],["Lenny",85,91,91,88,"k"],["Marcos",83,90,90,87,"k"],["Leo S",85,89,91,87,"k"],["Leo R",90,92,91,91,"k"],["Josh",89,90,87,87,"k"],["Sam A",87,90,93,84,"k"],["Isaac R",87,91,88,97,"k"],["Isaac C",81,87,80,90,"k"],["Justin",89,91,87,94,"k"],["Owen",90,93.5,94.5,88,"k"],["Trey McBride (ARI)",61,61,99,61,"n"],["Marvin Harrison Jr. (ARI)",60,96,60,60,"n"],["James Conner (ARI)",58,58,58,94,"n"],["Michael Wilson (ARI)",55,81,55,55,"n"],["Shawn Bowman (ARI)",55,55,79,55,"n"],["Jerome Ford (ARI)",55,55,55,79,"n"],["Tyler Allgeier (ARI)",55,55,55,77,"n"],["Shedrick Jackson (ARI)",55,76,55,55,"n"],["Reggie Virgil (ARI)",55,76,55,55,"n"],["Carson Beck (ARI)",70,55,55,55,"n"],["Jacoby Brissett (ARI)",64,55,55,55,"n"],["Bijan Robinson (ATL)",61,61,61,99,"n"],["Drake London (ATL)",61,99,61,61,"n"],["Tua Tagovailoa (ATL)",94,58,58,58,"n"],["Kyle Pitts (ATL)",55,55,89,55,"n"],["Michael Penix Jr. (ATL)",86,55,55,55,"n"],["Jahan Dotson (ATL)",55,79,55,55,"n"],["Olamide Zaccheaus (ATL)",55,77,55,55,"n"],["Jam Miller (ATL)",55,55,55,76,"n"],["Zachariah Branch (ATL)",55,73,55,55,"n"],["Jack Velling (ATL)",55,55,73,55,"n"],["Tyler Goodson (ATL)",55,55,55,71,"n"],["Lamar Jackson (BAL)",99,61,61,61,"n"],["Derrick Henry (BAL)",61,61,61,99,"n"],["Mark Andrews (BAL)",61,61,98,61,"n"],["Zay Flowers (BAL)",60,97,60,60,"n"],["Rashod Bateman (BAL)",55,84,55,55,"n"],["Jonathan Ward (BAL)",55,55,55,79,"n"],["Rasheen Ali (BAL)",55,55,55,76,"n"],["Xavier Guillory (BAL)",55,76,55,55,"n"],["Tyler Huntley (BAL)",74,55,55,55,"n"],["Gage Larvadain (BAL)",55,72,55,55,"n"],["Matthew Hibner (BAL)",55,55,70,55,"n"],["Josh Allen (BUF)",99,61,61,61,"n"],["James Cook (BUF)",61,61,61,99,"n"],["DJ Moore (BUF)",58,94,58,58,"n"],["Dalton Kincaid (BUF)",57,57,92,57,"n"],["Khalil Shakir (BUF)",57,92,57,57,"n"],["Keon Coleman (BUF)",55,86,55,55,"n"],["Shane Buechele (BUF)",77,55,55,55,"n"],["Greg Dortch (BUF)",55,77,55,55,"n"],["Jackson Hawes (BUF)",55,55,76,55,"n"],["Ty Johnson (BUF)",55,55,55,69,"n"],["Ray Davis (BUF)",55,55,55,66,"n"],["Tetairoa McMillan (CAR)",60,97,60,60,"n"],["Chuba Hubbard (CAR)",60,60,60,97,"n"],["Bryce Young (CAR)",84,55,55,55,"n"],["Xavier Legette (CAR)",55,81,55,55,"n"],["Tommy Tremble (CAR)",55,55,76,55,"n"],["Mitchell Evans (CAR)",55,55,74,55,"n"],["Haynes King (CAR)",74,55,55,55,"n"],["Chris Brazzell II (CAR)",55,72,55,55,"n"],["Ahmani Marshall (CAR)",55,55,55,72,"n"],["Anthony Tyus III (CAR)",55,55,55,72,"n"],["David Moore (CAR)",55,71,55,55,"n"],["Caleb Williams (CHI)",99,61,61,61,"n"],["Colston Loveland (CHI)",60,60,97,60,"n"],["Rome Odunze (CHI)",57,92,57,57,"n"],["D'Andre Swift (CHI)",55,55,55,89,"n"],["Cole Kmet (CHI)",55,55,86,55,"n"],["Jahdae Walker (CHI)",55,79,55,55,"n"],["Case Keenum (CHI)",77,55,55,55,"n"],["Salvon Ahmed (CHI)",55,55,55,76,"n"],["Scott Miller (CHI)",55,73,55,55,"n"],["Brittain Brown (CHI)",55,55,55,71,"n"],["Kaden Davis (CHI)",55,70,55,55,"n"],["Ja'Marr Chase (CIN)",61,99,61,61,"n"],["Joe Burrow (CIN)",99,61,61,61,"n"],["Tee Higgins (CIN)",61,98,61,61,"n"],["Chase Brown (CIN)",58,58,58,94,"n"],["Joe Flacco (CIN)",81,55,55,55,"n"],["Mike Gesicki (CIN)",55,55,81,55,"n"],["Ke'Shawn Williams (CIN)",55,79,55,55,"n"],["Erick All (CIN)",55,55,77,55,"n"],["Andrei Iosivas (CIN)",55,75,55,55,"n"],["Samaje Perine (CIN)",55,55,55,74,"n"],["Kentrel Bullock (CIN)",55,55,55,69,"n"],["Quinshon Judkins (CLE)",60,60,60,97,"n"],["Jerry Jeudy (CLE)",55,89,55,55,"n"],["Audric Estime (CLE)",55,55,55,79,"n"],["Dylan Sampson (CLE)",55,55,55,79,"n"],["Blake Whiteheart (CLE)",55,55,79,55,"n"],["Kole Wilson (CLE)",55,77,55,55,"n"],["Deshaun Watson (CLE)",74,55,55,55,"n"],["Shedeur Sanders (CLE)",72,55,55,55,"n"],["Harold Fannin Jr. (CLE)",55,55,71,55,"n"],["Bub Means (CLE)",55,68,55,55,"n"],["Tylan Wallace (CLE)",55,65,55,55,"n"],["CeeDee Lamb (DAL)",61,99,61,61,"n"],["Dak Prescott (DAL)",99,61,61,61,"n"],["George Pickens (DAL)",61,98,61,61,"n"],["Jake Ferguson (DAL)",55,55,89,55,"n"],["Javonte Williams (DAL)",55,55,55,84,"n"],["Princeton Fant (DAL)",55,55,77,55,"n"],["Ryan Flournoy (DAL)",55,77,55,55,"n"],["KaVontae Turpin (DAL)",55,77,55,55,"n"],["Sam Howell (DAL)",73,55,55,55,"n"],["Malik Davis (DAL)",55,55,55,70,"n"],["Hunter Luepke (DAL)",55,55,55,67,"n"],["Bo Nix (DEN)",99,61,61,61,"n"],["Jaylen Waddle (DEN)",60,97,60,60,"n"],["J.K. Dobbins (DEN)",57,57,57,92,"n"],["Courtland Sutton (DEN)",57,92,57,57,"n"],["Evan Engram (DEN)",55,55,89,55,"n"],["Marvin Mims Jr. (DEN)",55,81,55,55,"n"],["Caleb Lohner (DEN)",55,55,79,55,"n"],["Sam Ehlinger (DEN)",76,55,55,55,"n"],["Michael Bandy (DEN)",55,74,55,55,"n"],["RJ Harvey (DEN)",55,55,55,73,"n"],["Jonah Coleman (DEN)",55,55,55,69,"n"],["Amon-Ra St. Brown (DET)",61,99,61,61,"n"],["Jahmyr Gibbs (DET)",61,61,61,99,"n"],["Jared Goff (DET)",99,61,61,61,"n"],["Sam LaPorta (DET)",60,60,97,60,"n"],["Jameson Williams (DET)",60,96,60,60,"n"],["Isiah Pacheco (DET)",55,55,55,89,"n"],["Jacob Saylors (DET)",55,55,55,77,"n"],["Lawrence Keys (DET)",55,76,55,55,"n"],["Lucky Jackson (DET)",55,75,55,55,"n"],["Tyler Conklin (DET)",55,55,73,55,"n"],["Luke Altmyer (DET)",69,55,55,55,"n"],["Jordan Love (GB)",99,61,61,61,"n"],["Josh Jacobs (GB)",61,61,61,99,"n"],["Tucker Kraft (GB)",58,58,94,58,"n"],["Jayden Reed (GB)",57,92,57,57,"n"],["Jonnu Smith (GB)",55,55,86,55,"n"],["Matthew Golden (GB)",55,79,55,55,"n"],["Kaleb Johnson (GB)",55,55,55,75,"n"],["Bo Melton (GB)",55,75,55,55,"n"],["Christian Watson (GB)",55,74,55,55,"n"],["Kedon Slovis (GB)",73,55,55,55,"n"],["Chris Brooks (GB)",55,55,55,72,"n"],["Nico Collins (HOU)",61,99,61,61,"n"],["C.J. Stroud (HOU)",99,61,61,61,"n"],["David Montgomery (HOU)",58,58,58,94,"n"],["Dalton Schultz (HOU)",55,55,86,55,"n"],["Kayshon Boutte (HOU)",55,79,55,55,"n"],["Brevin Jordan (HOU)",55,55,77,55,"n"],["Davis Mills (HOU)",77,55,55,55,"n"],["Josh Kelly (HOU)",55,75,55,55,"n"],["Dare Ogunbowale (HOU)",55,55,55,75,"n"],["Bryce Oliver (HOU)",55,74,55,55,"n"],["Jawhar Jordan (HOU)",55,55,55,68,"n"],["Jonathan Taylor (IND)",61,61,61,99,"n"],["Tyler Warren (IND)",61,61,99,61,"n"],["Josh Downs (IND)",55,89,55,55,"n"],["Daniel Jones (IND)",84,55,55,55,"n"],["Anthony Richardson (IND)",79,55,55,55,"n"],["Mecole Hardman (IND)",55,77,55,55,"n"],["Seth McGowan (IND)",55,55,55,77,"n"],["Alec Pierce (IND)",55,77,55,55,"n"],["Darius Slayton (IND)",55,77,55,55,"n"],["Carson Towt (IND)",55,55,76,55,"n"],["Anderson Castle (IND)",55,55,55,67,"n"],["Brian Thomas Jr. (JAX)",61,99,61,61,"n"],["Trevor Lawrence (JAX)",98,61,61,61,"n"],["Jakobi Meyers (JAX)",55,89,55,55,"n"],["Brenton Strange (JAX)",55,55,81,55,"n"],["Josh Cameron (JAX)",55,79,55,55,"n"],["Bhayshul Tuten (JAX)",55,55,55,79,"n"],["Tim Jones (JAX)",55,77,55,55,"n"],["Hayden Rucci (JAX)",55,55,77,55,"n"],["J'Mari Taylor (JAX)",55,55,55,77,"n"],["Joey Aguilar (JAX)",76,55,55,55,"n"],["Ameer Abdullah (JAX)",55,55,55,75,"n"],["Patrick Mahomes (KC)",99,61,61,61,"n"],["Rashee Rice (KC)",61,99,61,61,"n"],["Kenneth Walker III (KC)",61,61,61,99,"n"],["Travis Kelce (KC)",60,60,96,60,"n"],["Xavier Worthy (KC)",58,94,58,58,"n"],["Justin Fields (KC)",86,55,55,55,"n"],["Cyrus Allen (KC)",55,79,55,55,"n"],["Jimmy Holiday (KC)",55,79,55,55,"n"],["Jared Wiley (KC)",55,55,79,55,"n"],["Nate Carter (KC)",55,55,55,75,"n"],["Ben VanSumeren (KC)",55,55,55,74,"n"],["Brock Bowers (LV)",61,61,99,61,"n"],["Ashton Jeanty (LV)",61,61,61,99,"n"],["Tre Tucker (LV)",55,79,55,55,"n"],["Mike Washington Jr. (LV)",55,55,55,79,"n"],["Dareke Young (LV)",55,77,55,55,"n"],["Justin Shorter (LV)",55,55,76,55,"n"],["Jalen Nailor (LV)",55,75,55,55,"n"],["Ronnie Bell (LV)",55,73,55,55,"n"],["Kirk Cousins (LV)",73,55,55,55,"n"],["Owen Wright (LV)",55,55,55,72,"n"],["Fernando Mendoza (LV)",65,55,55,55,"n"],["Justin Herbert (LAC)",99,61,61,61,"n"],["Ladd McConkey (LAC)",61,99,61,61,"n"],["Omarion Hampton (LAC)",61,61,61,98,"n"],["David Njoku (LAC)",57,57,92,57,"n"],["Quentin Johnston (LAC)",55,84,55,55,"n"],["Oronde Gadsden II (LAC)",55,55,81,55,"n"],["Jake Browning (LAC)",79,55,55,55,"n"],["Amar Johnson (LAC)",55,55,55,79,"n"],["Keaton Mitchell (LAC)",55,55,55,79,"n"],["Tejhaun Palmer (LAC)",55,76,55,55,"n"],["Luke Grimm (LAC)",55,75,55,55,"n"],["Puka Nacua (LAR)",61,99,61,61,"n"],["Matthew Stafford (LAR)",99,61,61,61,"n"],["Davante Adams (LAR)",61,99,61,61,"n"],["Kyren Williams (LAR)",61,61,61,99,"n"],["Tyler Higbee (LAR)",55,55,81,55,"n"],["Stetson Bennett (LAR)",79,55,55,55,"n"],["Max Klare (LAR)",55,55,79,55,"n"],["Tutu Atwell (LAR)",55,76,55,55,"n"],["Ronnie Rivers (LAR)",55,55,55,76,"n"],["Blake Corum (LAR)",55,55,55,75,"n"],["Jordan Whittington (LAR)",55,73,55,55,"n"],["De'Von Achane (MIA)",61,61,61,99,"n"],["Ollie Gordon II (MIA)",55,55,55,77,"n"],["Kaytron Allen (MIA)",55,55,55,75,"n"],["Greg Dulcich (MIA)",55,55,75,55,"n"],["Cole Turner (MIA)",55,55,74,55,"n"],["Chris Bell (MIA)",55,72,55,55,"n"],["Ryan Miller (MIA)",55,72,55,55,"n"],["Jalen Reagor (MIA)",55,70,55,55,"n"],["Malik Washington (MIA)",55,69,55,55,"n"],["Malik Willis (MIA)",69,55,55,55,"n"],["Kyle McCord (MIA)",68,55,55,55,"n"],["Justin Jefferson (MIN)",61,99,61,61,"n"],["T.J. Hockenson (MIN)",60,60,97,60,"n"],["Kyler Murray (MIN)",96,60,60,60,"n"],["Aaron Jones (MIN)",58,58,58,94,"n"],["Jordan Addison (MIN)",56,90,56,56,"n"],["Jauan Jennings (MIN)",55,89,55,55,"n"],["Jordan Mason (MIN)",55,55,55,89,"n"],["J.J. McCarthy (MIN)",84,55,55,55,"n"],["Dillon Bell (MIN)",55,79,55,55,"n"],["Gavin Bartholomew (MIN)",55,55,77,55,"n"],["Max Bredeson (MIN)",55,55,55,69,"n"],["A.J. Brown (NE)",61,99,61,61,"n"],["Drake Maye (NE)",99,61,61,61,"n"],["TreVeyon Henderson (NE)",60,60,60,97,"n"],["Hunter Henry (NE)",55,55,89,55,"n"],["Rhamondre Stevenson (NE)",55,55,55,86,"n"],["Romeo Doubs (NE)",55,84,55,55,"n"],["Behren Morton (NE)",79,55,55,55,"n"],["Hassan Haskins (NE)",55,55,55,77,"n"],["Cameron Latu (NE)",55,55,77,55,"n"],["Kyle Williams (NE)",55,76,55,55,"n"],["Chandler Brayboy (NE)",55,75,55,55,"n"],["Chris Olave (NO)",60,96,60,60,"n"],["Alvin Kamara (NO)",58,58,58,94,"n"],["Travis Etienne (NO)",58,58,58,94,"n"],["Juwan Johnson (NO)",55,55,84,55,"n"],["Cedric Tillman (NO)",55,81,55,55,"n"],["Spencer Rattler (NO)",79,55,55,55,"n"],["Mason Tipton (NO)",55,79,55,55,"n"],["Kevin Austin Jr. (NO)",55,77,55,55,"n"],["Kendre Miller (NO)",55,55,55,74,"n"],["Treyton Welch (NO)",55,55,74,55,"n"],["Tyler Shough (NO)",74,55,55,55,"n"],["Malik Nabers (NYG)",61,99,61,61,"n"],["Tyrone Tracy Jr. (NYG)",55,55,55,86,"n"],["Darnell Mooney (NYG)",55,84,55,55,"n"],["Calvin Austin III (NYG)",55,81,55,55,"n"],["Jaxson Dart (NYG)",81,55,55,55,"n"],["Theo Johnson (NYG)",55,55,79,55,"n"],["Jake Haener (NYG)",77,55,55,55,"n"],["Najee Harris (NYG)",55,55,55,77,"n"],["Patrick Ricard (NYG)",55,55,55,76,"n"],["Dontae Fleming (NYG)",55,75,55,55,"n"],["Chris Manhertz (NYG)",55,55,72,55,"n"],["Garrett Wilson (NYJ)",61,99,61,61,"n"],["Breece Hall (NYJ)",61,61,61,99,"n"],["Geno Smith (NYJ)",89,55,55,55,"n"],["Mason Taylor (NYJ)",55,55,81,55,"n"],["Chip Trayanum (NYJ)",55,55,55,77,"n"],["Kene Nwangwu (NYJ)",55,55,55,76,"n"],["Cody Hardy (NYJ)",55,55,75,55,"n"],["Bailey Zappe (NYJ)",75,55,55,55,"n"],["Tim Patrick (NYJ)",55,73,55,55,"n"],["Tyler Johnson (NYJ)",55,72,55,55,"n"],["Omar Cooper Jr. (NYJ)",55,71,55,55,"n"],["Saquon Barkley (PHI)",61,61,61,99,"n"],["Jalen Hurts (PHI)",99,61,61,61,"n"],["DeVonta Smith (PHI)",61,98,61,61,"n"],["Dallas Goedert (PHI)",57,57,92,57,"n"],["Zach Ertz (PHI)",55,55,81,55,"n"],["Darius Cooper (PHI)",55,79,55,55,"n"],["Makai Lemon (PHI)",55,79,55,55,"n"],["Tanner McKee (PHI)",79,55,55,55,"n"],["Elijah Mitchell (PHI)",55,55,55,79,"n"],["Erik Ezukanma (PHI)",55,77,55,55,"n"],["Tank Bigsby (PHI)",55,55,55,69,"n"],["DK Metcalf (PIT)",60,96,60,60,"n"],["Aaron Rodgers (PIT)",92,57,57,57,"n"],["Jaylen Warren (PIT)",57,57,57,92,"n"],["Pat Freiermuth (PIT)",55,55,86,55,"n"],["Drew Allar (PIT)",79,55,55,55,"n"],["Michael Pittman (PIT)",55,79,55,55,"n"],["Kaden Wetjen (PIT)",55,79,55,55,"n"],["Cole Burgess (PIT)",55,77,55,55,"n"],["Robert Tonyan (PIT)",55,55,77,55,"n"],["Max Hurleman (PIT)",55,55,55,74,"n"],["Rico Dowdle (PIT)",55,55,55,72,"n"],["Christian McCaffrey (SF)",61,61,61,99,"n"],["George Kittle (SF)",61,61,99,61,"n"],["Brock Purdy (SF)",99,61,61,61,"n"],["Mike Evans (SF)",61,99,61,61,"n"],["Christian Kirk (SF)",55,86,55,55,"n"],["Ricky Pearsall (SF)",55,86,55,55,"n"],["Brandin Cooks (SF)",55,77,55,55,"n"],["Khalil Dinkins (SF)",55,55,77,55,"n"],["Mac Jones (SF)",71,55,55,55,"n"],["Sincere McCormick (SF)",55,55,55,69,"n"],["Kaelon Black (SF)",55,55,55,64,"n"],["Jaxon Smith-Njigba (SEA)",61,99,61,61,"n"],["Sam Darnold (SEA)",97,60,60,60,"n"],["Cooper Kupp (SEA)",58,94,58,58,"n"],["Rashid Shaheed (SEA)",55,89,55,55,"n"],["AJ Barner (SEA)",55,55,79,55,"n"],["Montorie Foster Jr. (SEA)",55,79,55,55,"n"],["Brady Russell (SEA)",55,55,55,77,"n"],["Ben Sims (SEA)",55,55,77,55,"n"],["Velus Jones Jr. (SEA)",55,55,55,73,"n"],["Robbie Ouzts (SEA)",55,55,55,73,"n"],["Drew Lock (SEA)",70,55,55,55,"n"],["Baker Mayfield (TB)",99,61,61,61,"n"],["Emeka Egbuka (TB)",60,97,60,60,"n"],["Bucky Irving (TB)",58,58,58,94,"n"],["Cade Otton (TB)",55,55,81,55,"n"],["David Sills (TB)",55,77,55,55,"n"],["Payne Durham (TB)",55,55,76,55,"n"],["Chris Godwin Jr. (TB)",55,73,55,55,"n"],["Eric Rivers Jr. (TB)",55,73,55,55,"n"],["Josh Williams (TB)",55,55,55,73,"n"],["Sean Tucker (TB)",55,55,55,71,"n"],["Easton Stick (TB)",70,55,55,55,"n"],["Calvin Ridley (TEN)",57,92,57,57,"n"],["Tony Pollard (TEN)",55,55,55,89,"n"],["Wan'Dale Robinson (TEN)",55,84,55,55,"n"],["Cam Ward (TEN)",84,55,55,55,"n"],["Chimere Dike (TEN)",55,77,55,55,"n"],["Elic Ayomanor (TEN)",55,76,55,55,"n"],["Joel Wilson (TEN)",55,55,76,55,"n"],["Hendon Hooker (TEN)",75,55,55,55,"n"],["Daniel Bellinger (TEN)",55,55,74,55,"n"],["Michael Carter (TEN)",55,55,55,70,"n"],["Julius Chestnut (TEN)",55,55,55,69,"n"],["Jayden Daniels (WAS)",99,61,61,61,"n"],["Terry McLaurin (WAS)",61,98,61,61,"n"],["Stefon Diggs (WAS)",55,89,55,55,"n"],["Austin Ekeler (WAS)",55,55,55,81,"n"],["Chig Okonkwo (WAS)",55,55,81,55,"n"],["Antonio Williams (WAS)",55,77,55,55,"n"],["Sam Hartman (WAS)",75,55,55,55,"n"],["Jaylin Lane (WAS)",55,74,55,55,"n"],["Colson Yankoff (WAS)",55,55,72,55,"n"],["Jeremy McNichols (WAS)",55,55,55,71,"n"],["Rachaad White (WAS)",55,55,55,67,"n"]]; /* [name, QB, WR, TE, RB, 'k' kid | 'n' NFL] */
const LG_POS=['QB','WR','TE','RB'], LG_SLOTS=['QB','RB','WR','WR','TE'], LG_W=[.30,.18,.18,.18,.16], LG_ROUNDS=7, LG_GAP=4*3600000, LG_PICK=6*3600000;
const lgOvr=i=>{ const p=LG_POOL[i]; return Math.max(p[1],p[2],p[3],p[4]); }, lgPos=i=>{ const p=LG_POOL[i]; let b=0; for(let k=1;k<4;k++) if(p[k+1]>p[b+1]) b=k; return LG_POS[b]; };
const lgRate=(i,pos)=>LG_POOL[i][1+LG_POS.indexOf(pos)];
const lgRng=seed=>{ let x=seed>>>0||1; return ()=>{ x^=x<<13; x>>>=0; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; };
const lgHash=str=>{ let h=2166136261; for(const c of String(str)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; };
function lgAutoLine(roster){ /* best total of weighted ratings over every way to fill QB, RB, WR, WR, TE */ let best=null, bv=-1; const R=roster.slice(0,12), n=R.length, cur=[], used=new Array(n).fill(false);
  const rec=(k,v)=>{ if(k===5){ if(v>bv){ bv=v; best=cur.slice(); } return; } for(let j=0;j<n;j++){ if(used[j]) continue; if(k===3&&cur[2]>R[j]) continue; used[j]=true; cur.push(R[j]); rec(k+1,v+lgRate(R[j],LG_SLOTS[k])*LG_W[k]); cur.pop(); used[j]=false; } };
  if(n>=5) rec(0,0); return best||R.slice(0,5); }
function lgStrength(t){ const line=(t.line&&t.line.length===5&&t.line.every(i=>t.roster.includes(i)))?t.line:lgAutoLine(t.roster); return line.reduce((s,i,k)=>s+lgRate(i,LG_SLOTS[k])*LG_W[k],0); }
function lgSim(L,g){ const A=L.teams[g.a], B=L.teams[g.b], r=lgRng(lgHash(L.code+':'+g.r+':'+g.a+':'+g.b)); const sa=lgStrength(A), sb=lgStrength(B);
  const pts=(s,o)=>{ let tds=0, fgs=0; const drives=11; for(let d=0;d<drives;d++){ const x=r()*100+(s-o)*.9; if(x>78) tds++; else if(x>64) fgs++; } return tds*7+fgs*3; };
  let pa=pts(sa,sb), pb=pts(sb,sa); if(pa===pb){ if(r()<sa/(sa+sb)) pa+=3; else pb+=3; }
  const star=(t,p)=>{ const line=(t.line&&t.line.length===5)?t.line:lgAutoLine(t.roster); const i=line[Math.floor(r()*line.length)]; return {i,n:LG_POOL[i][0],pos:LG_SLOTS[line.indexOf(i)],td:Math.max(0,Math.round(p/7*.6))}; };
  g.sa=pa; g.sb=pb; g.done=1; g.star=[star(A,pa),star(B,pb)]; }
function lgSchedule(L,start){ const n=L.teams.length, ids=L.teams.map((_,i)=>i); const rounds=[]; const arr=ids.slice(); if(n%2) arr.push(-1);
  for(let r=0;r<arr.length-1;r++){ const R=[]; for(let i=0;i<arr.length/2;i++){ const a=arr[i], b=arr[arr.length-1-i]; if(a>=0&&b>=0) R.push(r%2?[b,a]:[a,b]); } rounds.push(R); arr.splice(1,0,arr.pop()); }
  const all=n<=6?rounds.concat(rounds.map(R=>R.map(([a,b])=>[b,a]))):rounds; L.games=[]; all.forEach((R,k)=>R.forEach(([a,b])=>L.games.push({r:k,a,b,at:start+k*LG_GAP}))); L.reg=all.length; }
function lgTable(L){ const T=L.teams.map((t,i)=>({i,w:0,l:0,pf:0,pa:0})); for(const g of L.games) if(g.done&&g.r<L.reg){ const A=T[g.a],B=T[g.b]; A.pf+=g.sa; A.pa+=g.sb; B.pf+=g.sb; B.pa+=g.sa; if(g.sa>g.sb){ A.w++; B.l++; } else { B.w++; A.l++; } }
  return T.sort((x,y)=>y.w-x.w||(y.pf-y.pa)-(x.pf-x.pa)||y.pf-x.pf); }
function lgAdvance(L,now){ let ch=false;
  if(L.state==='draft'){ for(let guard=0;guard<500&&L.state==='draft';guard++){ const n=L.teams.length, k=L.picks.length, round=Math.floor(k/n), idx=round%2?n-1-(k%n):k%n, t=L.teams[idx];
      if(!(t.cpu||now-(L.turnAt||now)>=LG_PICK)) break; const taken=new Set(L.picks.map(p=>p.i)); const need=LG_SLOTS.filter(pos=>!t.roster.some(i=>lgPos(i)===pos)||(pos==='WR'&&t.roster.filter(i=>lgPos(i)==='WR').length<2));
      let best=-1, bv=-1; for(let i=0;i<LG_POOL.length;i++){ if(taken.has(i)) continue; const v=lgOvr(i)+(need.includes(lgPos(i))?12:0)+(t.cpu?(lgHash(L.code+i)%7):0); if(v>bv){ bv=v; best=i; } }
      L.picks.push({t:idx,i:best,auto:1}); t.roster.push(best); L.turnAt=now; ch=true; if(L.picks.length>=n*LG_ROUNDS){ for(const tt of L.teams) tt.line=lgAutoLine(tt.roster); L.state='season'; lgSchedule(L,now+600000); } } }
  if(L.state==='season'||L.state==='playoffs'){ for(const g of L.games) if(!g.done&&g.at<=now){ lgSim(L,g); ch=true; }
    if(L.state==='season'&&L.games.every(g=>g.done)){ const T=lgTable(L), top=T.slice(0,Math.min(4,T.length)).map(x=>x.i), last=Math.max(...L.games.map(g=>g.at));
      if(top.length>=4){ L.games.push({r:L.reg,a:top[0],b:top[3],at:last+LG_GAP,po:'Semifinal'},{r:L.reg,a:top[1],b:top[2],at:last+LG_GAP,po:'Semifinal'}); L.state='playoffs'; }
      else { L.games.push({r:L.reg,a:top[0],b:top[1],at:last+LG_GAP,po:'Championship'}); L.state='playoffs'; } ch=true; }
    if(L.state==='playoffs'){ const po=L.games.filter(g=>g.po); if(po.every(g=>g.done)){ const fin=po.find(g=>g.po==='Championship');
        if(fin){ L.champ=fin.sa>fin.sb?fin.a:fin.b; L.state='done'; ch=true; } else { const w=po.map(g=>g.sa>g.sb?g.a:g.b); L.games.push({r:L.reg+1,a:w[0],b:w[1],at:Math.max(...po.map(g=>g.at))+LG_GAP,po:'Championship'}); ch=true; } } } }
  return ch; }

function lgSwap(L,T){ const A=L.teams[T.from], B=L.teams[T.to]; A.roster=A.roster.filter(i=>!T.give.includes(i)).concat(T.get); B.roster=B.roster.filter(i=>!T.get.includes(i)).concat(T.give); for(const t of [A,B]) if(!t.line.every(i=>t.roster.includes(i))) t.line=lgAutoLine(t.roster); }
/* Rival Esports: daily cups in the 2-player online games. Brackets fill in by themselves; players report results. */
const ES_GAMES=[['cards','🃏','Rival Cards'],['chess','♟️','Chess'],['pool','🎱','Pool'],['darts','🎯','Darts'],['curling','🥌','Curling'],['football','🏈','Football'],['armwrestling','💪','Arm Wrestling'],['axe','🪓','Axe Throwing'],['protag','🏃','Pro Tag']];
const ES_TIMES=[[16,0],[19,30]], ES_MAX=16, ES_REPORT=15*60000, ES_NOSHOW=40*60000;
function esET(now,h,m,dayOff){ /* a clock time in New York on a given day, as a timestamp */ const d=new Date(now+dayOff*864e5); const ymd=d.toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  const guess=Date.parse(ymd+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00Z'); const off=new Date(guess).toLocaleString('en-US',{timeZone:'America/New_York',hour:'numeric',hour12:false}); const diff=(+off%24)-h; return guess-(diff>12?diff-24:diff<-12?diff+24:diff)*3600000; }
const esRoom=()=>'E'+Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
function esRank(p){ return p>=1000?['Legend','👑']:p>=700?['Diamond','💎']:p>=450?['Platinum','🔷']:p>=250?['Gold','🥇']:p>=100?['Silver','🥈']:['Bronze','🥉']; }

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
    if(url.pathname==='/nfl/bucs'){ /* Buc Den: the Bucs' live schedule and scores plus every team's record, from ESPN's public feed (cached 10 min) */
      const c=caches.default, key=new Request('https://nfl.cache/bucs-v1'); let r=url.searchParams.get('fresh')?null:await c.match(key);
      if(!r){ const H={headers:{'user-agent':'ArcadeRivals/1.0'}};
        const [su,st]=await Promise.all([fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/tb/schedule',H).catch(()=>null),fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings',H).catch(()=>null)]);
        if(!su||!su.ok||!st||!st.ok) return J({err:'nfl'},502);
        const sd=await su.json(), sn=await st.json(), ET='America/New_York';
        const short=t=>{ const loc=t.location||'', nm=t.name||t.shortDisplayName||t.nickname||String(t.displayName||'').split(' ').pop(); if(loc==='Los Angeles') return 'L.A. '+nm; if(loc==='New York') return 'N.Y. '+nm; return loc||t.displayName; };
        const byWeek={};
        for(const e of sd.events||[]){ const comp=(e.competitions||[])[0]; if(!comp) continue; const me=comp.competitors.find(x=>x.team&&x.team.abbreviation==='TB'), op=comp.competitors.find(x=>x!==me); if(!me||!op) continue;
          const st2=(comp.status||{}).type||{}, done=st2.completed===true||st2.name==='STATUS_FINAL', sc=x=>{ const v=x.score; const n=v==null?null:+((typeof v==='object')?(v.value!=null?v.value:v.displayValue):v); return isFinite(n)?n:null; };
          const d=new Date(e.date), tbd=!!e.timeValid===false&&e.timeValid!==undefined;
          const day=d.toLocaleDateString('en-US',{timeZone:ET,month:'short',day:'numeric'}), time=tbd?'TBD':d.toLocaleTimeString('en-US',{timeZone:ET,hour:'numeric',minute:'2-digit'});
          const tv=((comp.broadcasts||[])[0]||{}).media; const net=tv&&tv.shortName?tv.shortName.replace('Prime Video','Amazon').replace('Fox','FOX'):'TBD';
          const ot=/OT/.test(st2.detail||st2.shortDetail||'')?' (OT)':'';
          const live=!done&&st2.state==='in';
          byWeek[(e.week||{}).number]=[(e.week||{}).number,day,me.homeAway==='home'?'vs':'at',short(op.team)+ot,done||live?sc(me):null,done||live?sc(op):null,time,net,e.date,live?(st2.shortDetail||'Live'):''];
        }
        const weeks=Object.keys(byWeek).map(Number).filter(Boolean), last=Math.max(18,...weeks), sch=[];
        for(let w=1;w<=last;w++) sch.push(byWeek[w]||[w,'','','Bye']);
        const lg={}; for(const conf of sn.children||[]) for(const en of (conf.standings||{}).entries||[]){ const S={}; for(const x of en.stats||[]) S[x.name]=x; const v=k=>+((S[k]||{}).value||0);
          lg[en.team.displayName]=[v('wins'),v('losses'),v('ties'),v('pointsFor'),v('pointsAgainst'),(S.divisionRecord||{}).displayValue||'-']; }
        const rec=((sd.team||{}).recordSummary)||'';
        r=new Response(JSON.stringify({updated:Date.now(),season:(sd.season||{}).year,record:rec,sch,lg}),{headers:{'content-type':'application/json','cache-control':'max-age=300'}});
        await c.put(key,r.clone()); }
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
    if(url.pathname==='/gd/sum'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); const d=await gdSum(url.searchParams.get('l')||'',url.searchParams.get('id')||''); if(!d) return J({err:'espn'},502); return new Response(JSON.stringify(d),{headers:{...CORS,'content-type':'application/json','cache-control':'public, max-age=8'}}); }
    if(url.pathname==='/sc/board'||url.pathname==='/sc/stand'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); const lg=url.searchParams.get('l')||'nba';
      const d=url.pathname==='/sc/board'?await scBoard(lg,url.searchParams.get('d')||''):await scStand(lg); if(!d) return J({err:'espn'},502);
      return new Response(JSON.stringify(d),{headers:{...CORS,'content-type':'application/json','cache-control':'public, max-age=15'}}); }
    if(url.pathname==='/netnew'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return netNew(); }
    if(url.pathname==='/yts'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return ytSearch(url,env); }
    if(url.pathname==='/ws'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return webSearch(url); }
    if(url.pathname==='/itch'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return itchList(url); }
    if(url.pathname==='/itchplay'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return itchPlay(url); }
    if(url.pathname==='/fc'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return frameCheck(url); }
    if(url.pathname==='/ai'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); if(req.method!=='POST') return J({err:'method'},405); return rrAI(req,env,RCF); }
    if(url.pathname==='/acct'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.ACCT.get(env.ACCT.idFromName('ACCT')).fetch(req); }
    if(url.pathname==='/site'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.SITE.get(env.SITE.idFromName('SITE')).fetch(req); }
    if(url.pathname==='/tourney'||url.pathname==='/play'||url.pathname==='/popular'||url.pathname==='/daily'||url.pathname==='/like'||url.pathname==='/review'||url.pathname==='/vote'||url.pathname==='/namecheck'||url.pathname.startsWith('/feed/')||url.pathname.startsWith('/net/')||url.pathname==='/glitch'||url.pathname==='/sc/pick'||url.pathname==='/sc/my'||url.pathname==='/sc/lb'||url.pathname==='/gd/vote'||url.pathname.startsWith('/mkt/')||url.pathname.startsWith('/lg/')||url.pathname.startsWith('/es/')||url.pathname.startsWith('/st/')||url.pathname.startsWith('/md/')||url.pathname.startsWith('/rw/')){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); const cf=RCF||req.cf||{}, h=new Headers(req.headers); h.set('x-rr-asn',String(cf.asn||'')); h.set('x-rr-aso',String(cf.asOrganization||'').slice(0,80)); h.set('x-rr-cc',String(cf.country||'')); return env.SITE.get(env.SITE.idFromName('SITE')).fetch(new Request(req,{headers:h})); }
    const lb=url.pathname.match(/^\/lb\/([a-z0-9]{2,16})$/);
    if(lb){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); return env.BOARDS.get(env.BOARDS.idFromName(lb[1])).fetch(req); }
    const pm=url.pathname.match(/^\/party\/([A-Z0-9]{4,8})$/);
    if(pm){ if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426}); return env.PARTY.get(env.PARTY.idFromName(pm[1])).fetch(req); }
    if(url.pathname==='/chat'){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected a WebSocket',{status:426});
      return env.CHAT.get(env.CHAT.idFromName('SITE')).fetch(req);
    }
    /* site owner tools: clean leaderboards and chat. Needs the ADMIN_KEY secret. */
    const ad=url.pathname.match(/^\/admin\/(lb|chat|site|sec|who)(?:\/([a-z0-9]{2,16}))?$/);
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
      if(ad[1]==='who') return J({role,how:tok?'password':'device'});   /* lets the /hq gate check that this device or sign-in is the owner's */
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
const PW_RESET='2026-11-20b';
/* the admin page's address changes every hour; /hq is the stable entry that forwards owner devices to the current one */
const ADMIN_URL='/hq';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-admin-token,x-admin-pid,x-pid,x-name,x-cap,x-fp','Access-Control-Expose-Headers':'content-length,content-range,accept-ranges,x-sources'};
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS mute(who TEXT PRIMARY KEY, until INTEGER)'); this.sql.exec('CREATE TABLE IF NOT EXISTS tvm(id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, ts INTEGER, name TEXT, text TEXT)');
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
      /* owner update tools: a countdown banner on every open page, then every page reloads; and instant notices */
      if(m.op==='restart'||m.op==='notice'||m.op==='restartcancel'){ if(req.headers.get('x-admin-role')!=='full') return J({err:'forbidden'},403);
        if(m.op==='notice'){ const text=String(m.text||'').replace(/[<>]/g,'').trim().slice(0,200); if(!text) return J({err:'empty'},400); this.all({t:'notice',text}); return J({ok:true,sent:this.ctx.getWebSockets().length}); }
        if(m.op==='restartcancel'){ this.cfgSet('restart','{}'); this.all({t:'restart',cancel:true}); return J({ok:true}); }
        const secs=Math.max(10,Math.min(900,+m.secs||60)), at=Date.now()+secs*1000, text=String(m.text||'').replace(/[<>]/g,'').trim().slice(0,160);
        this.cfgSet('restart',JSON.stringify({at,text})); this.all({t:'restart',at,text,now:Date.now()}); return J({ok:true,at,sent:this.ctx.getWebSockets().length}); }
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
      /* private messages, for the site owner: every conversation, a full thread, delete a message */
      if(m.op==='dms'){ if(!full) return J({err:'forbidden'},403); const q='%'+String(m.q||'').toLowerCase().replace(/[%_]/g,'').slice(0,30)+'%';
        const rows=this.sql.exec("SELECT CASE WHEN fpub<tpub THEN fpub||'|'||tpub ELSE tpub||'|'||fpub END AS k, MAX(id) AS mid, COUNT(*) AS n FROM dmsg WHERE lower(fname) LIKE ? OR lower(tname) LIKE ? OR lower(text) LIKE ? GROUP BY k ORDER BY mid DESC LIMIT 150",q,q,q).toArray();
        const out=rows.map(r=>{ const x=this.sql.exec('SELECT ts,fpub,fname,tpub,tname,text FROM dmsg WHERE id=?',r.mid).toArray()[0]||{}; return {k:r.k,n:r.n,ts:x.ts,a:x.fpub,an:x.fname,b:x.tpub,bn:x.tname,last:x.text}; });
        return J({convos:out,total:this.sql.exec('SELECT COUNT(*) AS c FROM dmsg').toArray()[0].c}); }
      if(m.op==='dmThread'){ if(!full) return J({err:'forbidden'},403); const [x,y]=String(m.k||'').split('|').map(v=>String(v||'').slice(0,12)); if(!x||!y) return J({err:'bad'},400);
        return J({msgs:this.sql.exec('SELECT id,ts,fpub,fname,tpub,tname,text,seen FROM dmsg WHERE (fpub=? AND tpub=?) OR (fpub=? AND tpub=?) ORDER BY id DESC LIMIT 400',x,y,y,x).toArray().reverse()}); }
      if(m.op==='dmDel'){ if(!full) return J({err:'forbidden'},403); this.sql.exec('DELETE FROM dmsg WHERE id=?',+m.id||0); return J({ok:true}); }
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
      a={name:nm,game:String(m.game||'home').replace(/[^a-z0-9]/g,'').slice(0,16)||'home',who,ts:[],last:'',av:/^a1\.[0-9.]{1,40}~[a-z0-9_,]{0,120}$/i.test(m.av||'')?m.av:''}; ws.serializeAttachment(a);
      { const me2=pubId(who), rows=this.sql.exec('SELECT ts,fpub,fname,tpub,tname,text,seen FROM dmsg WHERE fpub=? OR tpub=? ORDER BY id DESC LIMIT 150',me2,me2).toArray().reverse(); if(rows.length){ this.send(ws,{t:'dmhist',list:rows.map(r=>({self:r.fpub===me2,from:r.fpub,fromName:r.fname,to:r.tpub,toName:r.tname,text:r.text,ts:r.ts,unseen:r.tpub===me2&&!r.seen}))}); this.sql.exec('UPDATE dmsg SET seen=1 WHERE tpub=?',me2); } }
      if(swapped){ this.send(ws,{t:'you',name:nm}); this.send(ws,{t:'sys',text:'That name is reserved, so you were given a different one. Pick a new name with ✎ Name.'}); }
      const g=await this.grantOfWho(who); this.send(ws,g?{t:'role',lvl:g,url:ADMIN_URL}:{t:'role',lvl:null}); try{ const rs=JSON.parse(this.cfgGet('restart')||'{}'); if(rs.at&&rs.at>Date.now()) this.send(ws,{t:'restart',at:rs.at,text:rs.text,now:Date.now()}); }catch(e){} this.count(); return; }
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
    if(m.t==='av'){ a.av=/^a1\.[0-9.]{1,40}~[a-z0-9_,]{0,120}$/i.test(m.av||'')?m.av:''; ws.serializeAttachment(a); return; }
     /* Rival TV: each channel has its own chat room (same filters, mutes and bans as the main chat) */
     if(m.t==='tvjoin'){ const room=/^tv[a-z0-9]{1,12}$/.test(m.room||'')?m.room:''; a.tv=room; ws.serializeAttachment(a); if(room){ const L=this.sql.exec('SELECT id,ts,name,text FROM tvm WHERE room=? ORDER BY id DESC LIMIT 40',room).toArray().reverse(); let n=0; for(const s of this.ctx.getWebSockets()){ const b=s.deserializeAttachment(); if(b&&b.tv===room) n++; } this.send(ws,{t:'tvhist',room,list:L,n}); } return; }
     if(m.t==='say'){ const now=Date.now(), tvroom=/^tv[a-z0-9]{1,12}$/.test(m.room||'')&&a.tv===m.room?m.room:'';
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
      if(tvroom){ this.sql.exec('INSERT INTO tvm(room,ts,name,text) VALUES(?,?,?,?)',tvroom,now,a.name,text); const tid=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; if(tid%50===0) this.sql.exec('DELETE FROM tvm WHERE id<?',tid-3000);
         for(const s of this.ctx.getWebSockets()){ const b=s.deserializeAttachment(); if(b&&b.tv===tvroom) this.send(s,{t:'tvmsg',room:tvroom,m:{id:tid,ts:now,name:a.name,text,tag:this.tagOf(a.name),av:a.av||''}}); } return; }
       this.sql.exec('INSERT INTO m(ts,name,text,game,who) VALUES(?,?,?,?,?)',now,a.name,text,a.game,a.who);
      const id=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; this.sql.exec('DELETE FROM m WHERE id<?',id-600);
      this.all({t:'msg',m:{id,ts:now,name:a.name,text,game:a.game,tag:this.tagOf(a.name),av:a.av||''}}); return; } }
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
    /* how popular each game is: visits in the last 14 days that played it (cached 10 minutes) */
    /* network games (Games page): play counts, thumbs up/down and "not working" reports; 3 reports from different players hide a game for 30 days */
    if(url.pathname.startsWith('/net/')){ const H={...CORS,'content-type':'application/json'}, now=Date.now(), day=Math.floor(now/864e5);
      if(!this.netOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS netplay(id TEXT, day INTEGER, n INTEGER, PRIMARY KEY(id,day))'); this.sql.exec('CREATE TABLE IF NOT EXISTS netvote(id TEXT, pid TEXT, v INTEGER, PRIMARY KEY(id,pid))'); this.sql.exec('CREATE TABLE IF NOT EXISTS netrep(id TEXT, pid TEXT, ts INTEGER, PRIMARY KEY(id,pid))'); this.netOk=1; this.netSeen=new Map(); }
      if(url.pathname==='/net/stats'){ if(!this.netC||now-this.netC.t>300000){ const top=this.sql.exec('SELECT id,SUM(n) s FROM netplay WHERE day>=? GROUP BY id ORDER BY s DESC LIMIT 400',day-14).toArray().map(r=>[r.id,r.s]);
          const hide=this.sql.exec('SELECT id FROM netrep WHERE ts>? GROUP BY id HAVING COUNT(*)>=3',now-30*864e5).toArray().map(r=>r.id);
          const rate={}; for(const r of this.sql.exec('SELECT id,SUM(CASE WHEN v>0 THEN 1 ELSE 0 END) u,SUM(CASE WHEN v<0 THEN 1 ELSE 0 END) d FROM netvote GROUP BY id')) rate[r.id]=[r.u,r.d];
          this.netC={t:now,body:JSON.stringify({top,hide,rate})}; if(Math.random()<.05){ this.sql.exec('DELETE FROM netplay WHERE day<?',day-60); this.sql.exec('DELETE FROM netrep WHERE ts<?',now-30*864e5); } }
        return new Response(this.netC.body,{headers:{...H,'cache-control':'public, max-age=120'}}); }
      if(req.method!=='POST') return J({err:'method'},405);
      let m={}; try{ m=await req.json(); }catch(e){} const id0=String(m.id||'').toLowerCase(), id=/^\d{1,8}$/.test(id0)||/^(g[dp]|hg|pg|fm|dx):[a-z0-9_-]{1,90}$/.test(id0)?id0:'', pid=cleanPid(m.pid);
      if(!id||pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/net/play'){ const k=pid+':'+id+':'+day; if(!this.netSeen.has(k)){ if(this.netSeen.size>50000) this.netSeen.clear(); this.netSeen.set(k,1); this.sql.exec('INSERT INTO netplay(id,day,n) VALUES(?,?,1) ON CONFLICT(id,day) DO UPDATE SET n=n+1',id,day); } return J({ok:true}); }
      if(url.pathname==='/net/vote'){ const v=Math.sign(+m.v||0); if(v) this.sql.exec('INSERT INTO netvote(id,pid,v) VALUES(?,?,?) ON CONFLICT(id,pid) DO UPDATE SET v=excluded.v',id,pid,v); else this.sql.exec('DELETE FROM netvote WHERE id=? AND pid=?',id,pid);
        const r=this.sql.exec('SELECT SUM(CASE WHEN v>0 THEN 1 ELSE 0 END) u,SUM(CASE WHEN v<0 THEN 1 ELSE 0 END) d FROM netvote WHERE id=?',id).one(); this.netC=null; return J({ok:true,u:r.u||0,d:r.d||0}); }
      if(url.pathname==='/net/report'){ this.sql.exec('INSERT OR IGNORE INTO netrep(id,pid,ts) VALUES(?,?,?)',id,pid,now); this.netC=null; return J({ok:true}); }
      return J({err:'nf'},404); }
    /* Rival Runway: a daily theme; players enter an avatar look and rate each other's; yesterday's top 3 win coins */
    if(url.pathname.startsWith('/rw/')){ const now=Date.now(), ymd=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/New_York'}), day=ymd(now), yday=ymd(now-864e5);
      const THEMES=['Superhero','Beach Day','Sports Star','Winter Vibes','Cute but Spooky','Royal','Neon Party','Gamer','Space Explorer','Rockstar','Picture Day','Camping Trip','Rainbow','Detective','Top Chef','Pirate','Robot','Jungle Explorer','Movie Star','Pajama Party','Hip Hop','Cowboy','Under the Sea','Future Tech','Fancy Dinner','Gym Day','Art Class','Snow Day','Summer Camp','Champion'];
      const theme=d=>THEMES[Math.floor(Date.parse(d+'T12:00:00Z')/864e5)%THEMES.length];
      if(!this.rwOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS rw(day TEXT, pid TEXT, name TEXT, code TEXT, sum INTEGER DEFAULT 0, n INTEGER DEFAULT 0, ts INTEGER, PRIMARY KEY(day,pid))'); this.sql.exec('CREATE TABLE IF NOT EXISTS rwv(day TEXT, voter TEXT, pid TEXT, PRIMARY KEY(day,voter,pid))'); this.sql.exec('CREATE TABLE IF NOT EXISTS rwpaid(day TEXT PRIMARY KEY)');
        this.sql.exec('CREATE TABLE IF NOT EXISTS mdc(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, kind TEXT, k TEXT, n INTEGER, why TEXT, ts INTEGER)'); this.rwOk=1; }
      const top=d=>this.sql.exec('SELECT pid,name,code,sum,n,CAST(sum AS REAL)/n avg FROM rw WHERE day=? AND n>=3 ORDER BY avg DESC, n DESC LIMIT 10',d).toArray();
      if(!this.sql.exec('SELECT 1 FROM rwpaid WHERE day=?',yday).toArray().length){ this.sql.exec('INSERT OR IGNORE INTO rwpaid(day) VALUES(?)',yday); top(yday).slice(0,3).forEach((r,i)=>this.sql.exec('INSERT INTO mdc(pid,kind,k,n,why,ts) VALUES(?,?,?,?,?,?)',r.pid,'coins','',[300,200,100][i],'Rival Runway #'+(i+1)+' ('+theme(yday)+')',now)); }
      const pub=r=>({name:r.name,code:r.code,avg:Math.round(r.avg*10)/10,n:r.n});
      let m={}; if(req.method==='POST'){ try{ m=await req.json(); }catch(e){} } const pid=cleanPid(m.pid||url.searchParams.get('pid'));
      if(url.pathname==='/rw/state'){ const mine=pid?this.sql.exec('SELECT code,sum,n FROM rw WHERE day=? AND pid=?',day,pid).toArray()[0]:null;
        return J({day,theme:theme(day),next:theme(ymd(now+864e5)),entries:this.sql.exec('SELECT COUNT(*) n FROM rw WHERE day=?',day).one().n,mine:mine?{code:mine.code,avg:mine.n?Math.round(mine.sum/mine.n*10)/10:0,n:mine.n}:null,top:top(day).map(pub),yesterday:{theme:theme(yday),top:top(yday).slice(0,3).map(pub)}}); }
      if(pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/rw/submit'){ const code=String(m.code||''); if(!/^a1\.[0-9.]{1,40}~[a-z0-9_,]{0,120}$/i.test(code)) return J({err:'bad'},400);
        this.sql.exec('INSERT INTO rw(day,pid,name,code,ts) VALUES(?,?,?,?,?) ON CONFLICT(day,pid) DO UPDATE SET code=excluded.code,name=excluded.name',day,pid,cleanName(m.name),code,now); return J({ok:true}); }
      if(url.pathname==='/rw/next'){ const L=this.sql.exec('SELECT pid,name,code FROM rw WHERE day=? AND pid!=? AND pid NOT IN (SELECT pid FROM rwv WHERE day=? AND voter=?) ORDER BY RANDOM() LIMIT 6',day,pid,day,pid).toArray();
        return J({list:L.map(r=>({id:pubId(r.pid),name:r.name,code:r.code}))}); }
      if(url.pathname==='/rw/vote'){ const st=Math.round(+m.stars||0); if(st<1||st>5) return J({err:'bad'},400); const row=this.sql.exec('SELECT pid FROM rw WHERE day=?',day).toArray().find(r=>pubId(r.pid)===String(m.id)); if(!row||row.pid===pid) return J({err:'nf'},400);
        if(this.sql.exec('SELECT 1 FROM rwv WHERE day=? AND voter=? AND pid=?',day,pid,row.pid).toArray().length) return J({err:'voted'},400);
        this.sql.exec('INSERT INTO rwv(day,voter,pid) VALUES(?,?,?)',day,pid,row.pid); this.sql.exec('UPDATE rw SET sum=sum+?,n=n+1 WHERE day=? AND pid=?',st,day,row.pid); return J({ok:true}); }
      return J({err:'nf'},404); }
    /* Rival Market Day: weekend marketplace for shop items and cards. Coins and things move through "claims" the player's device picks up. */
    if(url.pathname.startsWith('/md/')){ const now=Date.now();
      if(!this.mdOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS mdl(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, name TEXT, kind TEXT, k TEXT, label TEXT, price INTEGER, auc INTEGER, bid INTEGER, bpid TEXT, bname TEXT, ends INTEGER, st TEXT, ts INTEGER)'); this.sql.exec('CREATE TABLE IF NOT EXISTS mdc(id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, kind TEXT, k TEXT, n INTEGER, why TEXT, ts INTEGER)'); this.sql.exec('CREATE TABLE IF NOT EXISTS mdp(k TEXT, price INTEGER, ts INTEGER)'); this.mdOk=1; }
      const et=new Date(new Date(now).toLocaleString('en-US',{timeZone:'America/New_York'})), dow=et.getDay(), open=dow===6||dow===0;
      const closeAt=(()=>{ const d=new Date(et); d.setHours(24,0,0,0); if(dow===6) d.setDate(d.getDate()+1); return now+(d-et); })(), openAt=(()=>{ const d=new Date(et); d.setHours(0,0,0,0); d.setDate(d.getDate()+((6-dow+7)%7||7)); return now+(d-et); })();
      const claim=(pid,kind,k,n,why)=>this.sql.exec('INSERT INTO mdc(pid,kind,k,n,why,ts) VALUES(?,?,?,?,?,?)',pid,kind,k,n,why,now);
      /* settle: when the market is closed, auctions go to the top bidder and unsold things go back */
      if(!open&&(!this.mdSet||now-this.mdSet>60000)){ this.mdSet=now; for(const l of this.sql.exec("SELECT * FROM mdl WHERE st='open'").toArray()){
          if(l.auc&&l.bpid){ claim(l.bpid,l.kind,l.k,1,'Won the auction: '+l.label); claim(l.pid,'coins','',l.bid,'Sold at auction: '+l.label); this.sql.exec("UPDATE mdl SET st='sold',price=? WHERE id=?",l.bid,l.id); this.sql.exec('INSERT INTO mdp(k,price,ts) VALUES(?,?,?)',l.k,l.bid,now); }
          else { claim(l.pid,l.kind,l.k,1,'Not sold, back to you: '+l.label); this.sql.exec("UPDATE mdl SET st='back' WHERE id=?",l.id); } } }
      if(url.pathname==='/md/list'){ const L=this.sql.exec("SELECT id,name,kind,k,label,price,auc,bid,bname,ts FROM mdl WHERE st='open' ORDER BY id DESC LIMIT 400").toArray();
        const H={}; for(const r of this.sql.exec('SELECT k,price FROM mdp WHERE ts>? ORDER BY ts DESC LIMIT 3000',now-60*864e5)){ (H[r.k]=H[r.k]||[]).length<10&&H[r.k].push(r.price); }
        return J({open,openAt,closeAt,list:L,hist:H,now}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid); if(pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/md/claims'){ const C=this.sql.exec('SELECT id,kind,k,n,why FROM mdc WHERE pid=? ORDER BY id LIMIT 50',pid).toArray(); if(C.length) this.sql.exec('DELETE FROM mdc WHERE pid=? AND id<=?',pid,C[C.length-1].id);
        return J({claims:C,mine:this.sql.exec("SELECT id,kind,label,price,auc,bid,bname,st FROM mdl WHERE pid=? ORDER BY id DESC LIMIT 30",pid).toArray()}); }
      if(!open) return J({err:'closed',openAt},400);
      if(url.pathname==='/md/sell'){ const kind=m.kind==='card'?'card':m.kind==='item'?'item':''; const k=String(m.k||'').slice(0,80), label=String(m.label||'').replace(/[<>]/g,'').slice(0,60), price=Math.floor(+m.price||0);
        if(!kind||!k||price<1||price>100000) return J({err:'bad'},400); if(this.sql.exec("SELECT COUNT(*) n FROM mdl WHERE pid=? AND st='open'",pid).one().n>=10) return J({err:'many'},400);
        this.sql.exec("INSERT INTO mdl(pid,name,kind,k,label,price,auc,bid,bpid,bname,ends,st,ts) VALUES(?,?,?,?,?,?,?,0,'','',?, 'open',?)",pid,cleanName(m.name),kind,k,label,price,m.auc?1:0,closeAt,now); return J({ok:true}); }
      const l=this.sql.exec("SELECT * FROM mdl WHERE id=? AND st='open'",+m.id||0).toArray()[0]; if(!l) return J({err:'gone'},400);
      if(url.pathname==='/md/cancel'){ if(l.pid!==pid) return J({err:'no'},403); if(l.auc&&l.bpid) return J({err:'bids'},400); this.sql.exec("UPDATE mdl SET st='back' WHERE id=?",l.id); return J({ok:true,kind:l.kind,k:l.k}); }
      if(l.pid===pid) return J({err:'own'},400);
      if(url.pathname==='/md/buy'){ if(l.auc) return J({err:'auction'},400); if(+m.pay!==l.price) return J({err:'price',price:l.price},400);
        this.sql.exec("UPDATE mdl SET st='sold',bpid=?,bname=? WHERE id=?",pid,cleanName(m.name),l.id); claim(l.pid,'coins','',l.price,'Sold: '+l.label); this.sql.exec('INSERT INTO mdp(k,price,ts) VALUES(?,?,?)',l.k,l.price,now); return J({ok:true,kind:l.kind,k:l.k}); }
      if(url.pathname==='/md/bid'){ if(!l.auc) return J({err:'notauc'},400); const b=Math.floor(+m.pay||0), min=Math.max(l.price,l.bid?l.bid+Math.max(1,Math.ceil(l.bid*.05)):l.price); if(b<min) return J({err:'low',min},400);
        if(l.bpid) claim(l.bpid,'coins','',l.bid,'Outbid on '+l.label+', coins back'); this.sql.exec('UPDATE mdl SET bid=?,bpid=?,bname=? WHERE id=?',b,pid,cleanName(m.name),l.id); return J({ok:true}); }
      return J({err:'nf'},404); }
    /* Rival Studio: player-made games. Nothing is public until the owner approves it in HQ. */
    if(url.pathname.startsWith('/st/')){ const now=Date.now();
      if(!this.stOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS stg(id TEXT PRIMARY KEY, pid TEXT, name TEXT, title TEXT, kind TEXT, st TEXT, data TEXT, ts INTEGER, plays INTEGER DEFAULT 0, likes INTEGER DEFAULT 0)'); this.sql.exec('CREATE TABLE IF NOT EXISTS stl(id TEXT, pid TEXT, PRIMARY KEY(id,pid))'); this.stOk=1; }
      const KINDS=['platformer','obby','maze','shooter','racer'];
      if(url.pathname==='/st/list') return J({games:this.sql.exec("SELECT id,name,title,kind,plays,likes,ts FROM stg WHERE st='ok' ORDER BY ts DESC LIMIT 200").toArray()});
      if(url.pathname==='/st/get'){ const r=this.sql.exec('SELECT id,name,title,kind,st,data,plays,likes FROM stg WHERE id=?',String(url.searchParams.get('id')||'').slice(0,16)).toArray()[0]; if(!r||r.st==='no') return J({err:'nf'},404); return J({...r,data:JSON.parse(r.data)}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid);
      if(url.pathname==='/st/play'){ this.sql.exec("UPDATE stg SET plays=plays+1 WHERE id=? AND st='ok'",String(m.id||'').slice(0,16)); return J({ok:true}); }
      if(pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/st/mine') return J({games:this.sql.exec('SELECT id,title,kind,st,plays,likes,ts FROM stg WHERE pid=? ORDER BY ts DESC LIMIT 50',pid).toArray()});
      if(url.pathname==='/st/like'){ const id=String(m.id||'').slice(0,16); const had=this.sql.exec('SELECT 1 FROM stl WHERE id=? AND pid=?',id,pid).toArray().length; if(had) this.sql.exec('DELETE FROM stl WHERE id=? AND pid=?',id,pid); else this.sql.exec('INSERT INTO stl(id,pid) VALUES(?,?)',id,pid);
        this.sql.exec('UPDATE stg SET likes=(SELECT COUNT(*) FROM stl WHERE id=?) WHERE id=?',id,id); return J({ok:true,liked:!had}); }
      if(url.pathname==='/st/submit'){ const g=m.game||{}; const raw=JSON.stringify(g); if(raw.length>12000) return J({err:'big'},400);
        const title=String(g.title||'').replace(/[<>]/g,'').trim().slice(0,40), kind=String(g.kind||''); if(!title||!KINDS.includes(kind)||!Array.isArray(g.map)||g.map.length!==14||!g.map.every(r=>typeof r==='string'&&r.length===24)) return J({err:'bad'},400);
        if(CHAT_BAD.some(r=>{ r.lastIndex=0; return r.test(title); })) return J({err:'title'},400);
        const recent=this.sql.exec("SELECT COUNT(*) n FROM stg WHERE pid=? AND ts>?",pid,now-864e5).one().n; if(recent>=5) return J({err:'many'},429);
        const id=Array.from({length:10},()=>'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*31)]).join('');
        this.sql.exec("INSERT INTO stg(id,pid,name,title,kind,st,data,ts) VALUES(?,?,?,?,?,'wait',?,?)",id,pid,cleanName(m.name),title,kind,raw,now); return J({ok:true,id}); }
      return J({err:'nf'},404); }
    /* Rival Esports */
    if(url.pathname.startsWith('/es/')){ const now=Date.now(), season=new Date(now).toISOString().slice(0,7);
      if(!this.esOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS es(id TEXT PRIMARY KEY, at INTEGER, data TEXT)'); this.sql.exec('CREATE TABLE IF NOT EXISTS esr(pid TEXT PRIMARY KEY, name TEXT, season TEXT, pts INTEGER, w INTEGER, l INTEGER, cups INTEGER)'); this.esOk=1; }
      const getC=id=>{ const r=this.sql.exec('SELECT data FROM es WHERE id=?',String(id||'').slice(0,20)).toArray()[0]; return r?JSON.parse(r.data):null; }, putC=C=>this.sql.exec('INSERT OR REPLACE INTO es(id,at,data) VALUES(?,?,?)',C.id,C.at,JSON.stringify(C));
      const rate=(pid,name,dw,dl,cup)=>{ const r=this.sql.exec('SELECT * FROM esr WHERE pid=?',pid).toArray()[0]; let pts=r&&r.season===season?r.pts:0, w=r&&r.season===season?r.w:0, l=r&&r.season===season?r.l:0; const cups=(r?r.cups:0)+(cup?1:0);
        pts=Math.max(0,pts+dw*25-dl*10+(cup?100:0)); this.sql.exec('INSERT OR REPLACE INTO esr(pid,name,season,pts,w,l,cups) VALUES(?,?,?,?,?,?,?)',pid,name,season,pts,w+dw,l+dl,cups); };
      const ptsOf=pid=>{ const r=this.sql.exec('SELECT pts,season FROM esr WHERE pid=?',pid).toArray()[0]; return r&&r.season===season?r.pts:0; };
      /* make sure the next few cups exist */
      if(!this.esSched||now-this.esSched>60000){ this.esSched=now; for(let d=0;d<2;d++) for(const [h,m] of ES_TIMES){ const at=esET(now,h,m,d); if(at<now-6*3600000) continue; const id='c'+at;
          if(!getC(id)){ const k=Math.floor(at/(12*3600000))%ES_GAMES.length, g=ES_GAMES[k]; putC({id,at,game:g[0],icon:g[1],gname:g[2],name:g[2]+' Cup',st:'open',players:[],rounds:[]}); } } }
      const step=C=>{ let ch=false;
        if(C.st==='open'&&now>=C.at){ ch=true; if(C.players.length<2){ C.st='cancelled'; } else { const P=C.players.slice().sort((a,b)=>b.pts-a.pts); let n=1; while(n<P.length) n*=2; const seeds=[];
            const order=(n)=>{ let o=[0]; while(o.length<n){ const m=o.length*2; o=o.flatMap(x=>[x,m-1-x]); } return o; }; for(const i of order(n)) seeds.push(P[i]||null);
            const R0=[]; for(let i=0;i<n;i+=2) R0.push({a:seeds[i],b:seeds[i+1],room:esRoom(),open:now,rep:{}}); C.rounds=[R0]; C.st='live'; } }
        if(C.st==='live'){ const R=C.rounds[C.rounds.length-1];
          for(const m of R){ if(m.win) continue; if(!m.a||!m.b){ m.win=(m.a||m.b)?(m.a||m.b).pid:null; m.bye=1; ch=true; continue; }
            const ra=m.rep[m.a.pid], rb=m.rep[m.b.pid];
            const decide=w=>{ m.win=w; const W=w===m.a.pid?m.a:m.b, L=w===m.a.pid?m.b:m.a; rate(W.pid,W.name,1,0,false); rate(L.pid,L.name,0,1,false); ch=true; };
            if(ra&&rb){ if(ra!==rb){ decide(ra==='w'?m.a.pid:m.b.pid); } else { m.rep={}; m.room=esRoom(); m.open=now; m.replays=(m.replays||0)+1; ch=true; if(m.replays>=3) decide(Math.random()<.5?m.a.pid:m.b.pid); } }
            else if((ra||rb)&&now-(m.repAt||now)>ES_REPORT){ const who=ra?m.a:m.b, said=ra||rb; decide(said==='w'?who.pid:(who===m.a?m.b.pid:m.a.pid)); }
            else if(!ra&&!rb&&now-m.open>ES_NOSHOW){ const ca=m.chk&&m.chk[m.a.pid], cb=m.chk&&m.chk[m.b.pid]; decide(ca&&!cb?m.a.pid:cb&&!ca?m.b.pid:(Math.random()<.5?m.a.pid:m.b.pid)); } }
          if(R.every(m=>m.win!==undefined)){ const W=R.map(m=>m.win?(m.a&&m.a.pid===m.win?m.a:m.b):null);
            if(R.length===1){ C.st='done'; C.champ=W[0]; if(W[0]){ rate(W[0].pid,W[0].name,0,0,true); const hof=JSON.parse((this.sql.exec("SELECT data FROM es WHERE id='hof'").toArray()[0]||{}).data||'[]'); hof.unshift({name:W[0].name,cup:C.name,icon:C.icon,at:C.at}); this.sql.exec("INSERT OR REPLACE INTO es(id,at,data) VALUES('hof',0,?)",JSON.stringify(hof.slice(0,60))); } }
            else { const N=[]; for(let i=0;i<W.length;i+=2) N.push({a:W[i],b:W[i+1],room:esRoom(),open:now,rep:{}}); C.rounds.push(N); } ch=true; } }
        return ch; };
      const pub=C=>({id:C.id,at:C.at,game:C.game,icon:C.icon,gname:C.gname,name:C.name,st:C.st,n:C.players.length,max:ES_MAX,champ:C.champ?C.champ.name:''});
      if(url.pathname==='/es/list'){ const pid=cleanPid(url.searchParams.get('pid')); const L=this.sql.exec("SELECT data FROM es WHERE id!='hof' AND at>? ORDER BY at LIMIT 12",now-3*864e5).toArray().map(r=>JSON.parse(r.data));
        for(const C of L) if(step(C)) putC(C);
        const me=pid?this.sql.exec('SELECT * FROM esr WHERE pid=?',pid).toArray()[0]:null; const mp=me&&me.season===season?me.pts:0;
        return J({cups:L.map(C=>({...pub(C),in:!!(pid&&C.players.some(p=>p.pid===pid))})),me:me?{pts:mp,w:me.season===season?me.w:0,l:me.season===season?me.l:0,cups:me.cups,rank:esRank(mp)}:{pts:0,w:0,l:0,cups:0,rank:esRank(0)},season,now}); }
      if(url.pathname==='/es/lb'){ const L=this.sql.exec('SELECT name,pts,w,l,cups FROM esr WHERE season=? ORDER BY pts DESC LIMIT 30',season).toArray().map(r=>({...r,rank:esRank(r.pts)})); const hof=JSON.parse((this.sql.exec("SELECT data FROM es WHERE id='hof'").toArray()[0]||{}).data||'[]'); return J({lb:L,hof,season}); }
      if(url.pathname==='/es/cup'){ const C=getC(url.searchParams.get('id')); if(!C) return J({err:'nf'},404); if(step(C)) putC(C); const pid=cleanPid(url.searchParams.get('pid'));
        const strip=p=>p?{name:p.name,pts:p.pts,me:p.pid===pid,id:p.pid===pid?p.pid:pubId(p.pid)}:null;
        return J({...pub(C),players:C.players.map(strip),rounds:C.rounds.map(R=>R.map(m=>({a:strip(m.a),b:strip(m.b),win:m.win===undefined?undefined:m.win===null?null:(m.a&&m.win===m.a.pid?'a':'b'),bye:m.bye||0,room:(pid&&((m.a&&m.a.pid===pid)||(m.b&&m.b.pid===pid)))?m.room:'',mine:!!(pid&&((m.a&&m.a.pid===pid)||(m.b&&m.b.pid===pid))),myRep:pid?m.rep[pid]||'':'',theyRep:pid&&m.a&&m.b?(m.a.pid===pid?m.rep[m.b.pid]:m.rep[m.a.pid])||'':'',replays:m.replays||0}))),now}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid); if(pid.length<8) return J({err:'bad'},400); const C=getC(m.id); if(!C) return J({err:'nf'},404); step(C);
      if(url.pathname==='/es/join'){ if(C.st!=='open') return J({err:'closed'},400); if(C.players.some(p=>p.pid===pid)){ putC(C); return J({ok:true}); } if(C.players.length>=ES_MAX) return J({err:'full'},400);
        C.players.push({pid,name:cleanName(m.name),pts:ptsOf(pid)}); putC(C); return J({ok:true}); }
      if(url.pathname==='/es/leave'){ if(C.st==='open') C.players=C.players.filter(p=>p.pid!==pid); putC(C); return J({ok:true}); }
      const R=C.rounds[C.rounds.length-1]||[], mt=R.find(x=>x.win===undefined&&((x.a&&x.a.pid===pid)||(x.b&&x.b.pid===pid)));
      if(!mt||C.st!=='live') return J({err:'nomatch'},400);
      if(url.pathname==='/es/check'){ mt.chk=mt.chk||{}; mt.chk[pid]=1; putC(C); return J({ok:true,room:mt.room}); }
      if(url.pathname==='/es/report'){ if(m.res!=='w'&&m.res!=='l') return J({err:'bad'},400); mt.rep[pid]=m.res; mt.repAt=mt.repAt||now; step(C); putC(C); return J({ok:true}); }
      return J({err:'nf'},404); }
    /* Rival League */
    if(url.pathname.startsWith('/lg/')){ const now=Date.now(); if(!this.lgOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS lgs(code TEXT PRIMARY KEY, data TEXT, upd INTEGER)'); this.sql.exec('CREATE TABLE IF NOT EXISTS lgm(pid TEXT, code TEXT, PRIMARY KEY(pid,code))'); this.lgOk=1; }
      if(url.pathname==='/lg/pool') return new Response(JSON.stringify({pool:LG_POOL}),{headers:{...CORS,'content-type':'application/json','cache-control':'public, max-age=86400'}});
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid); if(pid.length<8) return J({err:'bad'},400);
      const tname=String(m.team||'').replace(/[<>]/g,'').trim().slice(0,22)||cleanName(m.name)+"'s Team";
      const get=code=>{ const r=this.sql.exec('SELECT data FROM lgs WHERE code=?',String(code||'').toUpperCase().slice(0,8)).toArray()[0]; return r?JSON.parse(r.data):null; };
      const put=L=>this.sql.exec('INSERT OR REPLACE INTO lgs(code,data,upd) VALUES(?,?,?)',L.code,JSON.stringify(L),now);
      const view=L=>{ const me=L.teams.findIndex(t=>t.pid===pid); const pub=JSON.parse(JSON.stringify(L)); pub.teams.forEach(t=>{ delete t.pid; }); pub.me=me; pub.table=L.games&&L.games.length?lgTable(L):null; pub.now=now; return pub; };
      if(url.pathname==='/lg/my'){ const codes=this.sql.exec('SELECT code FROM lgm WHERE pid=?',pid).toArray().map(r=>r.code); return J({leagues:codes.map(get).filter(Boolean).map(L=>({code:L.code,name:L.name,state:L.state,teams:L.teams.length,me:L.teams.findIndex(t=>t.pid===pid)}))}); }
      if(url.pathname==='/lg/create'){ const n=this.sql.exec('SELECT COUNT(*) n FROM lgm WHERE pid=?',pid).one().n; if(n>=10) return J({err:'many'},400);
        let code; do{ code=Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join(''); }while(get(code));
        const L={code,name:String(m.lname||'').replace(/[<>]/g,'').trim().slice(0,30)||'Rival League',owner:pid,state:'lobby',made:now,teams:[{pid,mgr:cleanName(m.name),name:tname,roster:[],line:[]}],picks:[],games:[],trades:[]};
        put(L); this.sql.exec('INSERT OR IGNORE INTO lgm(pid,code) VALUES(?,?)',pid,code); return J({ok:true,code}); }
      const L=get(m.code); if(!L) return J({err:'nolg'},404); if(lgAdvance(L,now)) put(L); const me=L.teams.findIndex(t=>t.pid===pid);
      if(url.pathname==='/lg/get') return J(view(L));
      if(url.pathname==='/lg/join'){ if(me>=0) return J({ok:true,code:L.code}); if(L.state!=='lobby') return J({err:'started'},400); if(L.teams.length>=10) return J({err:'full'},400);
        L.teams.push({pid,mgr:cleanName(m.name),name:tname,roster:[],line:[]}); put(L); this.sql.exec('INSERT OR IGNORE INTO lgm(pid,code) VALUES(?,?)',pid,L.code); return J({ok:true,code:L.code}); }
      if(me<0) return J({err:'notin'},403);
      if(url.pathname==='/lg/start'){ if(L.owner!==pid||L.state!=='lobby') return J({err:'no'},400); const CPU=['Robo Rams','Byte Bears','Pixel Panthers','Turbo Titans','Glitch Gators','Circuit Colts','Laser Lions','Neon Knights'];
        let k=0; while(L.teams.length<4||L.teams.length%2) L.teams.push({cpu:1,mgr:'CPU',name:CPU[k++%CPU.length],roster:[],line:[]});
        for(let i=L.teams.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [L.teams[i],L.teams[j]]=[L.teams[j],L.teams[i]]; }
        L.state='draft'; L.turnAt=now; lgAdvance(L,now); put(L); return J(view(L)); }
      if(url.pathname==='/lg/pick'){ if(L.state!=='draft') return J({err:'nodraft'},400); const n=L.teams.length, k=L.picks.length, round=Math.floor(k/n), idx=round%2?n-1-(k%n):k%n; if(idx!==me) return J({err:'turn'},400);
        const i=+m.player; if(!(i>=0&&i<LG_POOL.length)||L.picks.some(p=>p.i===i)) return J({err:'taken'},400); L.picks.push({t:me,i}); L.teams[me].roster.push(i); L.turnAt=now;
        if(L.picks.length>=n*LG_ROUNDS){ for(const tt of L.teams) tt.line=lgAutoLine(tt.roster); L.state='season'; lgSchedule(L,now+600000); } lgAdvance(L,now); put(L); return J(view(L)); }
      if(url.pathname==='/lg/lineup'){ const line=(m.line||[]).map(Number); const t=L.teams[me]; if(line.length!==5||new Set(line).size!==5||!line.every(i=>t.roster.includes(i))) return J({err:'bad'},400); t.line=line; put(L); return J(view(L)); }
      if(url.pathname==='/lg/trade'){ if(L.state==='done'||L.state==='lobby'||L.state==='draft') return J({err:'no'},400); const to=+m.to, give=(m.give||[]).map(Number), getp=(m.get||[]).map(Number);
        if(!(to>=0&&to<L.teams.length)||to===me||!give.length||!getp.length||give.length>3||getp.length>3||!give.every(i=>L.teams[me].roster.includes(i))||!getp.every(i=>L.teams[to].roster.includes(i))) return J({err:'bad'},400);
        const id=(L.trades.length?L.trades[L.trades.length-1].id:0)+1; const T={id,from:me,to,give,get:getp,st:'open',at:now};
        if(L.teams[to].cpu){ const val=a=>a.reduce((s,i)=>s+lgOvr(i),0); T.st=val(give)>=val(getp)+2?'yes':'no'; if(T.st==='yes') lgSwap(L,T); }
        L.trades.push(T); if(L.trades.length>60) L.trades.splice(0,L.trades.length-60); put(L); return J(view(L)); }
      if(url.pathname==='/lg/answer'){ const T=L.trades.find(x=>x.id===+m.id&&x.st==='open'); if(!T) return J({err:'none'},400);
        if(m.cancel&&T.from===me){ T.st='cancel'; put(L); return J(view(L)); } if(T.to!==me) return J({err:'no'},403);
        if(m.ok){ if(!T.give.every(i=>L.teams[T.from].roster.includes(i))||!T.get.every(i=>L.teams[T.to].roster.includes(i))){ T.st='no'; } else { T.st='yes'; lgSwap(L,T); } } else T.st='no'; put(L); return J(view(L)); }
      return J({err:'nf'},404); }
    /* Rival Market: team "stocks" priced from real records and streaks; holdings kept here, coins move on the player's device */
    if(url.pathname.startsWith('/mkt/')){ const now=Date.now(), day=new Date(now).toISOString().slice(0,10);
      if(!this.mkOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS mkh(pid TEXT, name TEXT, sym TEXT, qty INTEGER, cost INTEGER, PRIMARY KEY(pid,sym))'); this.sql.exec('CREATE TABLE IF NOT EXISTS mkp(sym TEXT, day TEXT, price INTEGER, PRIMARY KEY(sym,day))'); this.mkOk=1; } if(!this.mkClean){ this.mkClean=1; try{ this.sql.exec("DELETE FROM mkh WHERE name IN ('MkTest','MkTest2') OR name GLOB 'Mk[0-9][0-9]*'"); this.sql.exec("DELETE FROM pick WHERE name='ScTest'"); }catch(e){} } /* remove test players left by setup checks */
      const quotes=async()=>{ if(this.mkQ&&now-this.mkQ.t<600000) return this.mkQ.q; const q={};
        for(const lg of ['nfl','nba','nhl','mlb']){ const st=await scStand(lg); if(!st) continue; for(const g of st.groups) for(const t of g.teams){ const w=+t.w||0, l=+t.l||0, x=+t.t||0, gp=w+l+x; if(!gp&&lg!=='mlb') continue;
          const pct=lg==='nhl'?((+t.pts||0)/Math.max(1,2*gp)):gp?(w+.5*x)/gp:.5; const sm=String(t.strk||'').match(/^([WL])(\d+)/), sk=sm?(sm[1]==='W'?1:-1)*Math.min(+sm[2],8):0;
          q[lg+':'+t.ab]={sym:lg+':'+t.ab,lg,ab:t.ab,name:t.name,logo:t.logo,rec:w+'-'+l+(x?'-'+x:''),price:Math.max(5,Math.min(250,Math.round(10+190*pct+sk*3)))}; } }
        if(Object.keys(q).length){ for(const k in q){ this.sql.exec('INSERT OR REPLACE INTO mkp(sym,day,price) VALUES(?,?,?)',k,day,q[k].price); const y=this.sql.exec('SELECT price FROM mkp WHERE sym=? AND day<? ORDER BY day DESC LIMIT 1',k,day).toArray()[0]; q[k].chg=y?q[k].price-y.price:0; }
          if(Math.random()<.05) this.sql.exec('DELETE FROM mkp WHERE day<?',new Date(now-60*864e5).toISOString().slice(0,10)); this.mkQ={t:now,q}; }
        return q; };
      if(url.pathname==='/mkt/quotes'){ const q=await quotes(); return new Response(JSON.stringify({q:Object.values(q)}),{headers:{...CORS,'content-type':'application/json','cache-control':'public, max-age=120'}}); }
      if(url.pathname==='/mkt/hist'){ const sym=String(url.searchParams.get('s')||'').slice(0,12); return J({h:this.sql.exec('SELECT day,price FROM mkp WHERE sym=? ORDER BY day DESC LIMIT 30',sym).toArray().reverse()}); }
      if(url.pathname==='/mkt/lb'){ const q=await quotes(); const by={}; for(const r of this.sql.exec('SELECT pid,name,sym,qty,cost FROM mkh WHERE qty>0')){ const v=(q[r.sym]?q[r.sym].price:0)*r.qty; const b=by[r.pid]||(by[r.pid]={name:r.name,value:0,cost:0}); b.value+=v; b.cost+=r.cost; b.name=r.name; }
        const L=Object.values(by).map(b=>({name:b.name,value:b.value,profit:b.value-b.cost})); return J({rich:L.slice().sort((a,b)=>b.value-a.value).slice(0,25),best:L.filter(x=>x.profit>0).sort((a,b)=>b.profit-a.profit).slice(0,25)}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid); if(pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/mkt/me'){ const q=await quotes(); return J({h:this.sql.exec('SELECT sym,qty,cost FROM mkh WHERE pid=? AND qty>0',pid).toArray().map(r=>({...r,price:q[r.sym]?q[r.sym].price:0}))}); }
      const q=await quotes(), sym=String(m.sym||''), qt=q[sym], qty=Math.floor(+m.qty||0); if(!qt||qty<1||qty>500) return J({err:'bad'},400);
      const cur=this.sql.exec('SELECT qty,cost FROM mkh WHERE pid=? AND sym=?',pid,sym).toArray()[0]||{qty:0,cost:0};
      if(url.pathname==='/mkt/buy'){ if(qt.price>(+m.max||0)) return J({err:'price',price:qt.price}); if(cur.qty+qty>1000) return J({err:'max'},400);
        this.sql.exec('INSERT INTO mkh(pid,name,sym,qty,cost) VALUES(?,?,?,?,?) ON CONFLICT(pid,sym) DO UPDATE SET qty=qty+excluded.qty,cost=cost+excluded.cost,name=excluded.name',pid,cleanName(m.name),sym,qty,qty*qt.price); return J({ok:true,price:qt.price,paid:qty*qt.price}); }
      if(url.pathname==='/mkt/sell'){ if(cur.qty<qty) return J({err:'qty'},400); const avg=cur.qty?cur.cost/cur.qty:0;
        this.sql.exec('UPDATE mkh SET qty=qty-?,cost=? WHERE pid=? AND sym=?',qty,Math.round(cur.cost-avg*qty),pid,sym); return J({ok:true,price:qt.price,got:qty*qt.price}); }
      return J({err:'nf'},404); }
    /* Game Day "who scores next?": votes for the current score; returns how everyone voted */
    if(url.pathname==='/gd/vote'){ let m={}; try{ m=await req.json(); }catch(e){} if(!this.gdOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS gdvote(gid TEXT, state TEXT, pid TEXT, side TEXT, ts INTEGER, PRIMARY KEY(gid,state,pid))'); this.gdOk=1; }
      const gid=String(m.gid||'').replace(/\D/g,'').slice(0,14), state=String(m.state||'').replace(/[^0-9-]/g,'').slice(0,9), pid=cleanPid(m.pid), side=m.side==='h'||m.side==='a'?m.side:'';
      if(!gid||!state) return J({err:'bad'},400); if(side&&pid.length>=8) this.sql.exec('INSERT INTO gdvote(gid,state,pid,side,ts) VALUES(?,?,?,?,?) ON CONFLICT(gid,state,pid) DO UPDATE SET side=excluded.side',gid,state,pid,side,Date.now());
      if(Math.random()<.01) this.sql.exec('DELETE FROM gdvote WHERE ts<?',Date.now()-3*864e5);
      const r=this.sql.exec("SELECT SUM(CASE WHEN side='h' THEN 1 ELSE 0 END) h,SUM(CASE WHEN side='a' THEN 1 ELSE 0 END) a FROM gdvote WHERE gid=? AND state=?",gid,state).one(); return J({h:r.h||0,a:r.a||0}); }
    /* Sports Center pick'em: pick a winner before the game starts; settled from the final scores */
    if(url.pathname==='/sc/pick'||url.pathname==='/sc/my'||url.pathname==='/sc/lb'){ const now=Date.now();
      if(!this.scOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS pick(pid TEXT, name TEXT, lg TEXT, gid TEXT, team TEXT, day TEXT, gts INTEGER, ts INTEGER, res INTEGER DEFAULT 0, PRIMARY KEY(pid,gid))'); this.sql.exec('CREATE INDEX IF NOT EXISTS pick_res ON pick(res,gts)'); this.scOk=1; }
      const settle=async()=>{ if(this.scSet&&now-this.scSet<90000) return; this.scSet=now; const pend=this.sql.exec('SELECT DISTINCT lg,day FROM pick WHERE res=0 AND gts<? LIMIT 12',now-2*3600000).toArray();
        for(const p of pend){ const b=await scBoard(p.lg,p.day); if(!b) continue; for(const g of b.games){ if(g.st!=='post') continue; const hs=+g.home.score, as=+g.away.score; const win=hs>as?g.home.ab:as>hs?g.away.ab:'';
          this.sql.exec('UPDATE pick SET res=CASE WHEN ?=\'\' THEN 2 WHEN team=? THEN 1 ELSE -1 END WHERE gid=? AND res=0',win,win,g.id); } } };
      if(url.pathname==='/sc/lb'){ await settle(); const wk=now-((new Date(now).getUTCDay()+6)%7)*864e5-(now%864e5);
        const q=since=>this.sql.exec('SELECT name,SUM(CASE WHEN res=1 THEN 1 ELSE 0 END) w,SUM(CASE WHEN res=-1 THEN 1 ELSE 0 END) l FROM pick WHERE gts>=? GROUP BY pid HAVING w>0 ORDER BY w DESC,l ASC LIMIT 25',since).toArray();
        return J({week:q(wk),all:q(0)}); }
      let m={}; try{ m=await req.json(); }catch(e){} const pid=cleanPid(m.pid); if(pid.length<8) return J({err:'bad'},400);
      if(url.pathname==='/sc/my'){ await settle(); return J({picks:this.sql.exec('SELECT lg,gid,team,day,gts,res FROM pick WHERE pid=? ORDER BY gts DESC LIMIT 200',pid).toArray()}); }
      const lg=String(m.lg||''), gid=String(m.gid||'').replace(/\D/g,'').slice(0,14), day=String(m.day||'').replace(/\D/g,'').slice(0,8); if(!SC_LG[lg]||!gid) return J({err:'bad'},400);
      const b=await scBoard(lg,day); const g=b&&b.games.find(x=>x.id===gid); if(!g) return J({err:'nogame'},404);
      if(g.st!=='pre'||Date.parse(g.date)<=now) return J({err:'locked'},400); const team=String(m.team||''); if(team!==g.home.ab&&team!==g.away.ab) return J({err:'team'},400);
      const cnt=this.sql.exec('SELECT COUNT(*) n FROM pick WHERE pid=? AND ts>?',pid,now-864e5).one().n; if(cnt>=60) return J({err:'limit'},429);
      this.sql.exec('INSERT INTO pick(pid,name,lg,gid,team,day,gts,ts,res) VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(pid,gid) DO UPDATE SET team=excluded.team,ts=excluded.ts,name=excluded.name',pid,cleanName(m.name),lg,gid,team,new Date(g.date).toLocaleDateString('en-CA',{timeZone:'America/New_York'}).replace(/-/g,''),Date.parse(g.date),now);
      return J({ok:true}); }
    /* glitch reports: errors caught on players' pages plus "report a glitch" notes, for the owner's HQ page */
    if(url.pathname==='/glitch'){ if(req.method!=='POST') return J({err:'method'},405); let m={}; try{ m=await req.json(); }catch(e){}
      if(!this.glOk){ this.sql.exec('CREATE TABLE IF NOT EXISTS glitch(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, kind TEXT, page TEXT, msg TEXT, src TEXT, ua TEXT, pid TEXT, name TEXT)'); this.glOk=1; this.glRate=new Map(); }
      const pid=cleanPid(m.pid), now=Date.now(), k=pid||'anon'; const r=(this.glRate.get(k)||[]).filter(t=>now-t<600000); if(r.length>=20) return J({ok:false}); r.push(now); this.glRate.set(k,r); if(this.glRate.size>5000) this.glRate.clear();
      const cl=(v,n)=>String(v||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n);
      this.sql.exec('INSERT INTO glitch(ts,kind,page,msg,src,ua,pid,name) VALUES(?,?,?,?,?,?,?,?)',now,m.kind==='user'?'user':'error',cl(m.page,40),cl(m.msg,400),cl(m.src,160),cl(m.ua,120),pid,cleanName(m.name));
      if(Math.random()<.05) this.sql.exec('DELETE FROM glitch WHERE id<(SELECT MAX(id)-5000 FROM glitch)'); return J({ok:true}); }
    if(url.pathname==='/popular'){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
      const now=Date.now(); if(!this.popIx){ try{ this.sql.exec('CREATE INDEX IF NOT EXISTS visit_last ON visit(last)'); }catch(e){} this.popIx=1; } if(!this.popC||now-this.popC.t>600000){ const cnt={}; for(const r of this.sql.exec('SELECT games FROM visit WHERE last>?',now-14*86400000)) for(const g of String(r.games||'').split(',')){ if(g&&g!=='home'&&/^[a-z0-9-]{1,24}$/.test(g)) cnt[g]=(cnt[g]||0)+1; } this.popC={t:now,g:cnt}; }
      return new Response(JSON.stringify({ok:true,days:14,g:this.popC.g}),{headers:{...CORS,'content-type':'application/json','cache-control':'public, max-age=300'}}); }
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
      const pid=cleanPid(m.pid);
      if(m.op==='many'){ const res={}; for(const g0 of (Array.isArray(m.games)?m.games:[]).slice(0,60)){ const g=String(g0||'').replace(/[^a-z0-9]/g,'').slice(0,16); if(!g) continue; const mp=(await this.s.get('lk:'+g))||{}; res[g]={n:Object.keys(mp).length,me:!!(pid&&mp[pid])}; } return J({ok:true,res}); }
      const game=String(m.game||'').replace(/[^a-z0-9]/g,'').slice(0,16); if(!game) return J({err:'bad'},400);
      const k='lk:'+game, map=(await this.s.get(k))||{};
      if((m.op==='like'||m.op==='unlike')&&pid.length>=8){ if(m.op==='like') map[pid]=1; else delete map[pid]; await this.s.put(k,map); }
      return J({ok:true,n:Object.keys(map).length,me:!!(pid&&map[pid])}); }
    /* star reviews: one per player per game (posting again replaces yours) */
    if(url.pathname==='/review'){ let m={}; try{ m=await req.json(); }catch(e){}
      const pid=cleanPid(m.pid), gid=g=>String(g||'').replace(/[^a-z0-9]/g,'').slice(0,16);
      if(m.op==='sum'){ const res={}; for(const g0 of (Array.isArray(m.games)?m.games:[]).slice(0,60)){ const g=gid(g0); if(!g) continue; const L=(await this.s.get('rv:'+g))||[]; res[g]={n:L.length,avg:L.length?L.reduce((a,r)=>a+r.stars,0)/L.length:0}; } return J({ok:true,res}); }
      const game=gid(m.game); if(!game) return J({err:'bad'},400); const k='rv:'+game; let L=(await this.s.get(k))||[];
      if(m.op==='add'&&pid.length>=8){ const stars=Math.max(1,Math.min(5,Math.round(+m.stars||0))); if(!(+m.stars>=1)) return J({err:'stars'},400);
        L=L.filter(r=>r.pid!==pid); L.unshift({pid,name:cleanName(m.name)||'Player',stars,text:String(m.text||'').replace(/[<>]/g,'').slice(0,300),at:Date.now()}); L=L.slice(0,200); await this.s.put(k,L); }
      if(m.op==='del'&&pid.length>=8){ L=L.filter(r=>r.pid!==pid); await this.s.put(k,L); }
      return J({ok:true,list:L.slice(0,60).map(r=>({name:r.name,stars:r.stars,text:r.text,at:r.at,me:r.pid===pid}))}); }
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
        return J({today:{req:live('req'),beat:live('beat'),wr:live('wr')},yesterday:(await this.s.get('use:'+y))||null,online:on,limits:{req:333000,wr:1000000,paid:true},resetIn:Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)-d)/60000)}); }
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
      if(m.op==='pcmd'){ const kind=String(m.kind||''); if(!['msg','gift','kick','reload','rename','goto','setcash','givecar','givegun','resetcity','setstr','freeze','flip','confetti','shake','invert','mirror','rainbow','spin','blur','comic','tiny','disco','upside','airhorn','say','emoji','heal','wanted','ask','award','jumpcash','sagift','sfx','sticker','fireworks','weather','toast','banner','quiz','vibe','bg','spotlight','go321','typewriter','magic8','dice','coinflip','wheel','cheer','party','calm','marquee','burst','rainbowtext','drunk','zoom','jelly','oldtv','tilt','neon','bigcursor','crack','bugs','duck','fart','runaway','gravity','fakeupdate','lottery','balloons','clown','scramble','flashlight','ghost','bounce','sneeze'].includes(kind)) return J({err:'bad'},400); const data={};
        if(kind==='goto'){ data.page=String(m.page||'').replace(/[^a-z0-9-]/g,'').slice(0,24); const q=String(m.q||'').replace(/[^a-zA-Z0-9=&_-]/g,'').slice(0,60); if(q) data.q=q; } if(kind==='setcash') data.n=Math.max(0,Math.min(1e9,Math.round(+m.n||0))); if(kind==='givecar') data.model=String(m.model||'').replace(/[^a-z0-9]/g,'').slice(0,16); if(kind==='givegun') data.gun=String(m.gun||'').replace(/[^a-z]/g,'').slice(0,12); if(kind==='setstr') data.n=Math.max(0,Math.min(100,Math.round(+m.n||0))); if(['freeze','flip','shake','invert','mirror','rainbow','spin','blur','comic','tiny','disco','upside','emoji','drunk','zoom','jelly','oldtv','tilt','neon','bigcursor','crack','bugs','duck','fart','runaway','gravity','fakeupdate','lottery','balloons','clown','scramble','flashlight','ghost','bounce','sneeze'].includes(kind)) data.secs=Math.max(3,Math.min(120,Math.round(+m.secs||10))); if(kind==='freeze') data.text=String(m.text||'').slice(0,120);
        if(kind==='say'||kind==='ask'||kind==='award'){ data.text=String(m.text||'').slice(0,240); if(!data.text) return J({err:'bad'},400); } if(kind==='emoji') data.e=[...String(m.e||'🎉')].slice(0,3).join(''); if(kind==='wanted') data.n=Math.max(0,Math.min(5,Math.round(+m.n||0))); if(kind==='sagift'){ data.what='puck'; data.n=Math.max(1,Math.min(1e7,Math.round(+m.n||0))); }
        if(['sfx','sticker','fireworks','weather','toast','banner','quiz','vibe','bg','spotlight','go321','typewriter','magic8','dice','coinflip','wheel','cheer','party','calm','marquee','burst','rainbowtext'].includes(kind)){ data.secs=Math.max(2,Math.min(120,Math.round(+m.secs||10))); if(m.text) data.text=String(m.text).slice(0,240); if(m.e) data.e=[...String(m.e)].slice(0,3).join(''); if(m.s) data.s=String(m.s).replace(/[^a-z0-9-]/g,'').slice(0,16); if(Array.isArray(m.opts)) data.opts=m.opts.slice(0,8).map(x=>String(x).slice(0,60)); if(m.n!=null) data.n=Math.max(0,Math.min(1e6,Math.round(+m.n||0))); }
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
      if(m.op==='stPending'){ try{ this.sql.exec('CREATE TABLE IF NOT EXISTS stg(id TEXT PRIMARY KEY, pid TEXT, name TEXT, title TEXT, kind TEXT, st TEXT, data TEXT, ts INTEGER, plays INTEGER DEFAULT 0, likes INTEGER DEFAULT 0)'); }catch(e){} return J({wait:this.sql.exec("SELECT id,name,title,kind,ts FROM stg WHERE st='wait' ORDER BY ts LIMIT 100").toArray(),live:this.sql.exec("SELECT id,name,title,kind,plays,likes FROM stg WHERE st='ok' ORDER BY ts DESC LIMIT 100").toArray()}); }
      if(m.op==='stSet'){ const st=m.st==='ok'?'ok':m.st==='no'?'no':''; if(!st) return J({err:'bad'},400); this.sql.exec('UPDATE stg SET st=? WHERE id=?',st,String(m.id||'').slice(0,16)); return J({ok:true}); }
      if(m.op==='glitches'){ try{ this.sql.exec('CREATE TABLE IF NOT EXISTS glitch(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, kind TEXT, page TEXT, msg TEXT, src TEXT, ua TEXT, pid TEXT, name TEXT)'); }catch(e){} const since=Date.now()-(+m.days||3)*864e5;
        const groups=this.sql.exec("SELECT page,msg,kind,COUNT(*) n,COUNT(DISTINCT pid) people,MAX(ts) last,MAX(src) src,MAX(ua) ua FROM glitch WHERE ts>? AND kind='error' GROUP BY page,msg ORDER BY n DESC LIMIT 100",since).toArray();
        const notes=this.sql.exec("SELECT ts,page,msg,name,ua FROM glitch WHERE ts>? AND kind='user' ORDER BY id DESC LIMIT 100",since).toArray(); return J({groups,notes,now:Date.now()}); }
      if(m.op==='glitchclear'){ try{ this.sql.exec('DELETE FROM glitch'); }catch(e){} return J({ok:true}); }
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
const BOT_ACCTS=new Set(['testing online']);   /* test bots: always shown online (the site shows a pebble when you video call it) */
const OWNER_ACCTS=new Set(['aiden']);   /* accounts that are the site owner on every device they log in on */
export class Acct {
  constructor(state,env){ this.state=state; this.env=env; this.s=state.storage; this.sql=state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS acct(nm TEXT PRIMARY KEY, disp TEXT, salt TEXT, ph TEXT, data TEXT, ver INTEGER, ts INTEGER, crew TEXT, life INTEGER, str INTEGER, fails INTEGER, lockt INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tok(th TEXT PRIMARY KEY, nm TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS crew(tag TEXT PRIMARY KEY, name TEXT, owner TEXT, code TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS trade(id INTEGER PRIMARY KEY AUTOINCREMENT, frm TEXT, too TEXT, give TEXT, want TEXT, msg TEXT, st TEXT, claimed INTEGER, ts INTEGER)');
    for(const col of ['pub TEXT','seen INTEGER','pg TEXT']){ try{ this.sql.exec('ALTER TABLE acct ADD COLUMN '+col); }catch(e){} }
    this.sql.exec('CREATE TABLE IF NOT EXISTS fr(a TEXT, b TEXT, st TEXT, ts INTEGER, PRIMARY KEY(a,b))'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_fr_b ON fr(b)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS gift(id INTEGER PRIMARY KEY AUTOINCREMENT, frm TEXT, too TEXT, what TEXT, msg TEXT, st TEXT, ts INTEGER)'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_gift_too ON gift(too,st)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mt(id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT, b TEXT, bn TEXT, mode TEXT, host TEXT, fee INTEGER, ends INTEGER, claimed INTEGER DEFAULT 0, ts INTEGER)'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_mt ON mt(game,ends)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mtp(id INTEGER, nm TEXT, score REAL, txt TEXT, rf INTEGER DEFAULT 0, PRIMARY KEY(id,nm))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS vg(pid TEXT PRIMARY KEY, nm TEXT, disp TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS cwpts(wk INTEGER, nm TEXT, crew TEXT, pts INTEGER, PRIMARY KEY(wk,nm))'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_cw ON cwpts(wk,crew)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ix_trade_too ON trade(too,st)'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_trade_frm ON trade(frm,claimed)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS ix_acct_crew ON acct(crew)'); this.sql.exec('CREATE INDEX IF NOT EXISTS ix_tok_nm ON tok(nm)'); }
  async who(token){ if(!token) return null; const th=await sha('rr-acct:'+String(token).slice(0,80)); const r=this.sql.exec('SELECT nm FROM tok WHERE th=?',th).toArray()[0]; return r?r.nm:null; }
  async newTok(nm){ const raw=crypto.getRandomValues(new Uint8Array(32)), token=[...raw].map(v=>v.toString(16).padStart(2,'0')).join(''); this.sql.exec('INSERT INTO tok(th,nm,ts) VALUES(?,?,?)',await sha('rr-acct:'+token),nm,Date.now()); return token; }
  crewOf(tag){ if(!tag) return null; const c=this.sql.exec('SELECT tag,name,owner,code FROM crew WHERE tag=?',tag).toArray()[0]; if(!c) return null;
    const mem=this.sql.exec('SELECT disp,life,str FROM acct WHERE crew=? ORDER BY life DESC LIMIT 50',tag).toArray(); return {...c,members:mem,total:mem.reduce((a,m)=>a+(m.life||0),0)}; }
  async fetch(req){
    if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
    let m={}; try{ m=JSON.parse(await req.text()); }catch(e){ return J({err:'bad'},400); }
    const now=Date.now(), clean=s=>String(s||'').trim().replace(/[^\w .\-]/g,'').slice(0,20), key=s=>clean(s).toLowerCase(), pinOk=p=>/^\d{4,8}$/.test(String(p||''));
    /* owner devices (marked full admin on the server when you sign into the admin page) sign straight into the owner account — no PIN */
    if(m.op==='ownerAuto'){ const pid=String(m.pid||'').replace(/[^a-z0-9]/gi,'').slice(0,24); if(pid.length<8) return J({err:'no'},403);
      let lvl=null; try{ const r=await this.env.CHAT.get(this.env.CHAT.idFromName('SITE')).fetch('https://do/authpid',{method:'POST',body:JSON.stringify({pid})}); lvl=(await r.json()).lvl; }catch(e){}
      if(lvl!=='full') return J({err:'no'},403); const onm=[...OWNER_ACCTS][0], r=this.sql.exec('SELECT disp,data,ver,crew FROM acct WHERE nm=?',onm).toArray()[0]; if(!r) return J({err:'nouser'},404);
      return J({ok:true,name:r.disp,token:await this.newTok(onm),data:r.data,ver:r.ver,crew:r.crew,owner:true}); }
    if(m.op==='check'){ const nm=key(m.name); return J({taken:!!this.sql.exec('SELECT 1 FROM acct WHERE nm=?',nm).toArray()[0]}); }
    if(m.op==='create'){ const disp=clean(m.name), nm=disp.toLowerCase(); if(nm.length<2) return J({err:'name'},400); if(!pinOk(m.pin)) return J({err:'pin'},400);
      if(this.sql.exec('SELECT 1 FROM acct WHERE nm=?',nm).toArray()[0]) return J({err:'taken'},409);
      const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join(''), ph=await pbkdf(String(m.pin),salt), data=String(m.data||'{}').slice(0,600000);
      this.sql.exec('INSERT INTO acct(nm,disp,salt,ph,data,ver,ts,crew,life,str,fails,lockt) VALUES(?,?,?,?,?,1,?,NULL,?,?,0,0)',nm,disp,salt,ph,data,now,+m.life||0,+m.str||0);
      return J({ok:true,name:disp,token:await this.newTok(nm),ver:1}); }
    if(m.op==='login'){ const nm=key(m.name), r=this.sql.exec('SELECT * FROM acct WHERE nm=?',nm).toArray()[0]; if(!r) return J({err:'nouser'},404);
      if(r.lockt>now) return J({err:'locked',mins:Math.ceil((r.lockt-now)/60000)},429);
      if(!pinOk(m.pin)||(await pbkdf(String(m.pin),r.salt))!==r.ph){ const f=(r.fails||0)+1; this.sql.exec('UPDATE acct SET fails=?, lockt=? WHERE nm=?',f>=5?0:f,f>=5?now+10*60000:0,nm); return J({err:'pin',left:Math.max(0,5-f)},403); }
      this.sql.exec('UPDATE acct SET fails=0 WHERE nm=?',nm); return J({ok:true,name:r.disp,token:await this.newTok(nm),data:r.data,ver:r.ver,crew:r.crew,owner:OWNER_ACCTS.has(nm)}); }
    /* crew wars: points this week per crew (public, so the Hub can show the champions) */
    if(m.op==='crewWar'){ const wk=Math.floor((now/864e5+3)/7), q=w=>this.sql.exec('SELECT p.crew AS tag, c.name AS name, SUM(p.pts) AS pts, COUNT(*) AS n FROM cwpts p LEFT JOIN crew c ON c.tag=p.crew WHERE p.wk=? GROUP BY p.crew ORDER BY pts DESC LIMIT 20',w).toArray();
      let mine=0; if(m.token){ const me=await this.who(m.token); if(me){ const r=this.sql.exec('SELECT pts FROM cwpts WHERE wk=? AND nm=?',wk,me).toArray()[0]; mine=r?r.pts:0; } }
      const last=q(wk-1)[0]||null; return J({ok:true,wk,rows:q(wk),last,mine,ends:((wk+1)*7-3)*864e5,now}); }
    const nm=await this.who(m.token); if(!nm) return J({err:'auth'},401);
    if(m.op==='pull'){ const r=this.sql.exec('SELECT disp,data,ver,crew FROM acct WHERE nm=?',nm).toArray()[0]; if(!r) return J({err:'auth'},401); const ow=OWNER_ACCTS.has(nm); return J(m.since!=null&&+m.since>=r.ver?{ok:true,ver:r.ver,same:true,crew:r.crew,name:r.disp,owner:ow}:{ok:true,ver:r.ver,data:r.data,crew:r.crew,name:r.disp,owner:ow}); }
    if(m.op==='push'){ const data=String(m.data||''); if(data.length>600000) return J({err:'big'},413); const r=this.sql.exec('SELECT ver FROM acct WHERE nm=?',nm).toArray()[0]; const ver=(r?r.ver:0)+1;
      this.sql.exec('UPDATE acct SET data=?, ver=?, ts=?, life=?, str=?, pub=?, seen=?, pg=? WHERE nm=?',data,ver,now,Math.max(0,+m.life||0),Math.max(0,+m.str||0),String(m.pub||'').slice(0,6000),now,String(m.pg||'').replace(/[^a-z0-9-]/g,'').slice(0,24),nm);
      { const wk=Math.floor((now/864e5+3)/7); if(+m.cwk===wk&&+m.cw>0){ const c=this.sql.exec('SELECT crew FROM acct WHERE nm=?',nm).toArray()[0]; if(c&&c.crew) this.sql.exec('INSERT OR REPLACE INTO cwpts(wk,nm,crew,pts) VALUES(?,?,?,?)',wk,nm,c.crew,Math.max(0,Math.min(500000,Math.floor(+m.cw)))); } }
      return J({ok:true,ver}); }
    if(m.op==='ping'){ this.sql.exec('UPDATE acct SET seen=?, pg=? WHERE nm=?',now,String(m.pg||'').replace(/[^a-z0-9-]/g,'').slice(0,24),nm); return J({ok:true}); }
    if(m.op==='logout'){ this.sql.exec('DELETE FROM tok WHERE th=?',await sha('rr-acct:'+String(m.token||'').slice(0,80))); return J({ok:true}); }
    if(m.op==='setpin'){ if(!pinOk(m.pin)) return J({err:'pin'},400); const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join(''); this.sql.exec('UPDATE acct SET salt=?, ph=? WHERE nm=?',salt,await pbkdf(String(m.pin),salt),nm); return J({ok:true}); }
    /* crews */
    const me=this.sql.exec('SELECT disp,crew FROM acct WHERE nm=?',nm).toArray()[0];
    if(m.op==='crewCreate'){ if(me.crew) return J({err:'increw'},409); const tag=String(m.tag||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6), name=clean(m.name); if(tag.length<2||name.length<2) return J({err:'bad'},400);
      if(this.sql.exec('SELECT 1 FROM crew WHERE tag=?',tag).toArray()[0]) return J({err:'taken'},409); const code=[...crypto.getRandomValues(new Uint8Array(6))].map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
      this.sql.exec('INSERT INTO crew(tag,name,owner,code,ts) VALUES(?,?,?,?,?)',tag,name,nm,code,now); this.sql.exec('UPDATE acct SET crew=? WHERE nm=?',tag,nm); return J({ok:true,crew:this.crewOf(tag)}); }
    if(m.op==='crewJoin'){ if(me.crew) return J({err:'increw'},409); const c=this.sql.exec('SELECT tag FROM crew WHERE code=?',String(m.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'')).toArray()[0]; if(!c) return J({err:'nocrew'},404);
      const n=this.sql.exec('SELECT COUNT(*) AS c FROM acct WHERE crew=?',c.tag).toArray()[0].c; if(n>=30) return J({err:'full'},409); this.sql.exec('UPDATE acct SET crew=? WHERE nm=?',c.tag,nm); return J({ok:true,crew:this.crewOf(c.tag)}); }
    if(m.op==='crewLeave'){ const tag=me.crew; if(!tag) return J({ok:true}); this.sql.exec('UPDATE acct SET crew=NULL WHERE nm=?',nm); const c=this.sql.exec('SELECT owner FROM crew WHERE tag=?',tag).toArray()[0];
      const left=this.sql.exec('SELECT nm FROM acct WHERE crew=? ORDER BY life DESC LIMIT 1',tag).toArray()[0]; if(!left) this.sql.exec('DELETE FROM crew WHERE tag=?',tag); else if(c&&c.owner===nm) this.sql.exec('UPDATE crew SET owner=? WHERE tag=?',left.nm,tag); return J({ok:true}); }
    if(m.op==='crewInfo'){ const c=this.crewOf(me.crew); if(!c) return J({ok:true,crew:null}); if(c.owner!==nm) delete c.code; c.mine=true; return J({ok:true,crew:c}); }
    /* trading: the sender's items are held by their device until the trade is answered */
    const pack=o=>{ const it=(Array.isArray(o&&o.items)?o.items:[]).map(x=>String(x).replace(/[^\w]/g,'').slice(0,24)).filter(Boolean).slice(0,10); return JSON.stringify({items:[...new Set(it)],coins:Math.max(0,Math.min(1e7,Math.floor(+(o&&o.coins)||0)))}); };
    if(m.op==='tradeSend'){ const to=key(m.to); if(!to||to===nm) return J({err:'who'},400); const t=this.sql.exec('SELECT disp FROM acct WHERE nm=?',to).toArray()[0]; if(!t) return J({err:'nouser'},404);
      const open=this.sql.exec("SELECT COUNT(*) AS c FROM trade WHERE frm=? AND st='open'",nm).toArray()[0].c; if(open>=10) return J({err:'many'},429);
      this.sql.exec("INSERT INTO trade(frm,too,give,want,msg,st,claimed,ts) VALUES(?,?,?,?,?,'open',0,?)",nm,to,pack(m.give),pack(m.want),String(m.msg||'').replace(/[<>]/g,'').slice(0,80),now); return J({ok:true,to:t.disp}); }
    if(m.op==='tradeList'){ this.sql.exec('UPDATE acct SET seen=? WHERE nm=?',now,nm); const name=n=>{ const r=this.sql.exec('SELECT disp FROM acct WHERE nm=?',n).toArray()[0]; return r?r.disp:n; };
      const inc=this.sql.exec("SELECT id,frm,give,want,msg,ts FROM trade WHERE too=? AND st='open' ORDER BY id DESC LIMIT 20",nm).toArray().map(r=>({...r,frm:name(r.frm)}));
      const out=this.sql.exec('SELECT id,too,give,want,msg,st,ts FROM trade WHERE frm=? AND claimed=0 ORDER BY id DESC LIMIT 20',nm).toArray().map(r=>({...r,too:name(r.too)})); return J({ok:true,inc,out}); }
    if(m.op==='tradeRespond'){ const r=this.sql.exec("SELECT id FROM trade WHERE id=? AND too=? AND st='open'",+m.id,nm).toArray()[0]; if(!r) return J({err:'gone'},404); this.sql.exec('UPDATE trade SET st=? WHERE id=?',m.accept?'accepted':'declined',+m.id); return J({ok:true}); }
    if(m.op==='tradeCancel'){ this.sql.exec("UPDATE trade SET st='cancelled' WHERE id=? AND frm=? AND st='open'",+m.id,nm); return J({ok:true}); }
    if(m.op==='tradeClaim'){ this.sql.exec("UPDATE trade SET claimed=1 WHERE id=? AND frm=? AND st<>'open'",+m.id,nm); return J({ok:true}); }
    /* friends: a request becomes a friendship when the other person accepts (or asks back) */
    const disp=n=>{ const r=this.sql.exec('SELECT disp,crew,seen,pg FROM acct WHERE nm=?',n).toArray()[0]; return r?{name:r.disp,crew:r.crew,seen:r.seen||0,pg:r.pg||''}:null; };
    if(m.op==='friendAdd'){ const to=key(m.to); if(!to||to===nm) return J({err:'who'},400); if(!this.sql.exec('SELECT 1 FROM acct WHERE nm=?',to).toArray()[0]) return J({err:'nouser'},404);
      const back=this.sql.exec('SELECT st FROM fr WHERE a=? AND b=?',to,nm).toArray()[0]; if(back){ this.sql.exec("UPDATE fr SET st='ok' WHERE a=? AND b=?",to,nm); return J({ok:true,now:'friends'}); }
      this.sql.exec("INSERT OR IGNORE INTO fr(a,b,st,ts) VALUES(?,?,'pending',?)",nm,to,now); return J({ok:true,now:'sent'}); }
    if(m.op==='friendAccept'){ this.sql.exec("UPDATE fr SET st='ok' WHERE a=? AND b=?",key(m.name),nm); return J({ok:true}); }
    if(m.op==='friendRemove'){ const o=key(m.name); this.sql.exec('DELETE FROM fr WHERE (a=? AND b=?) OR (a=? AND b=?)',nm,o,o,nm); return J({ok:true}); }
    /* who's online right now (seen in the last 5 minutes); asking also marks you as online */
    /* live view (spectate): the owner grants, the watched player checks — the video itself is peer-to-peer (no Cloudflare bandwidth) */
    /* owner resets a player's PIN to a temporary one (the old PIN can never be read — it's a one-way hash) */
    if(m.op==='adminSetPin'){ if(!OWNER_ACCTS.has(nm)) return J({err:'no'},403); const t=key(m.name); if(!t) return J({err:'who'},400); if(!pinOk(m.pin)) return J({err:'pin'},400);
      const r=this.sql.exec('SELECT nm FROM acct WHERE nm=?',t).toArray()[0]; if(!r) return J({err:'nouser'},404);
      const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join(''), ph=await pbkdf(String(m.pin),salt);
      this.sql.exec('UPDATE acct SET salt=?, ph=?, fails=0, lockt=0 WHERE nm=?',salt,ph,t); return J({ok:true}); }
    if(m.op==='watchGrant'){ if(!OWNER_ACCTS.has(nm)) return J({err:'no'},403); const t=key(m.name); if(!t) return J({err:'who'},400);
      await this.s.put('wg:'+t,{by:nm,exp:now+2*3600000}); return J({ok:true}); }
    if(m.op==='watchStop'){ if(!OWNER_ACCTS.has(nm)) return J({err:'no'},403); await this.s.delete('wg:'+key(m.name)); return J({ok:true}); }
    if(m.op==='watchChk'){ const g=await this.s.get('wg:'+nm); const ok=!!(g&&g.exp>now); return J({ok,by:ok?g.by:''}); }
    if(m.op==='online'){ this.sql.exec('UPDATE acct SET seen=?, pg=? WHERE nm=?',now,String(m.pg||'').replace(/[^a-z0-9-]/g,'').slice(0,24),nm);
      const rows=this.sql.exec('SELECT nm,disp,crew,pg,seen FROM acct WHERE seen>? AND nm<>? ORDER BY seen DESC LIMIT 60',now-3*60000,nm).toArray().map(r=>({name:r.disp,crew:r.crew,pg:r.pg||'',seen:r.seen,bot:BOT_ACCTS.has(r.nm)}));
      for(const b of BOT_ACCTS){ if(b===nm||rows.some(r=>r.name.toLowerCase()===b)) continue; const r=this.sql.exec('SELECT disp,crew FROM acct WHERE nm=?',b).toArray()[0]; if(r) rows.unshift({name:r.disp,crew:r.crew,pg:'hub',seen:now,bot:true}); }
      return J({ok:true,list:rows,now}); }
    /* the group video chat: who's in it (each browser checks in every 10 s; gone after 30 s) */
    if(m.op==='vgJoin'||m.op==='vgLeave'){ const pid=String(m.pid||'').replace(/[^\w-]/g,'').slice(0,40); this.sql.exec('DELETE FROM vg WHERE ts<?',now-30000);
      if(m.op==='vgLeave'){ this.sql.exec('DELETE FROM vg WHERE pid=? OR nm=?',pid,nm); return J({ok:true}); }
      const n=this.sql.exec('SELECT COUNT(*) AS c FROM vg WHERE pid<>?',pid).toArray()[0].c; const inIt=this.sql.exec('SELECT 1 FROM vg WHERE pid=?',pid).toArray()[0];
      if(!inIt&&n>=15) return J({err:'full',list:[]},409);
      if(pid){ this.sql.exec('DELETE FROM vg WHERE nm=? AND pid<>?',nm,pid); const d=this.sql.exec('SELECT disp FROM acct WHERE nm=?',nm).toArray()[0]; this.sql.exec('INSERT OR REPLACE INTO vg(pid,nm,disp,ts) VALUES(?,?,?,?)',pid,nm,d?d.disp:nm,now); this.sql.exec('UPDATE acct SET seen=? WHERE nm=?',now,nm); }
      return J({ok:true,list:this.sql.exec('SELECT pid,disp AS name FROM vg WHERE pid<>? ORDER BY ts',pid).toArray()}); }
    if(m.op==='vgList'){ this.sql.exec('DELETE FROM vg WHERE ts<?',now-30000); return J({ok:true,list:this.sql.exec('SELECT disp AS name FROM vg ORDER BY ts').toArray()}); }
    if(m.op==='friendList'){ this.sql.exec('UPDATE acct SET seen=? WHERE nm=?',now,nm); const ok=this.sql.exec("SELECT a,b FROM fr WHERE (a=? OR b=?) AND st='ok' LIMIT 200",nm,nm).toArray().map(r=>disp(r.a===nm?r.b:r.a)).filter(Boolean);
      const inc=this.sql.exec("SELECT a FROM fr WHERE b=? AND st='pending' LIMIT 50",nm).toArray().map(r=>disp(r.a)).filter(Boolean), out=this.sql.exec("SELECT b FROM fr WHERE a=? AND st='pending' LIMIT 50",nm).toArray().map(r=>disp(r.b)).filter(Boolean);
      const gifts=this.sql.exec("SELECT id,frm,what,msg,ts FROM gift WHERE too=? AND st='open' ORDER BY id DESC LIMIT 30",nm).toArray().map(g=>({...g,frm:(disp(g.frm)||{name:g.frm}).name}));
      return J({ok:true,friends:ok,inc,out,gifts,now}); }
    /* gifts: coins, items or a crate — the sender's device takes them away first */
    if(m.op==='giftSend'){ const to=key(m.to); if(!to||to===nm) return J({err:'who'},400); if(!this.sql.exec('SELECT 1 FROM acct WHERE nm=?',to).toArray()[0]) return J({err:'nouser'},404);
      const w=m.what||{}, what=JSON.stringify({items:(Array.isArray(w.items)?w.items:[]).map(x=>String(x).replace(/[^\w]/g,'').slice(0,24)).slice(0,10),coins:Math.max(0,Math.min(1e7,Math.floor(+w.coins||0))),crate:String(w.crate||'').replace(/[^a-z]/g,'').slice(0,12)});
      const n=this.sql.exec("SELECT COUNT(*) AS c FROM gift WHERE frm=? AND ts>?",nm,now-864e5).toArray()[0].c; if(n>=20) return J({err:'many'},429);
      this.sql.exec("INSERT INTO gift(frm,too,what,msg,st,ts) VALUES(?,?,?,?,'open',?)",nm,to,what,String(m.msg||'').replace(/[<>]/g,'').slice(0,80),now); return J({ok:true}); }
    if(m.op==='giftOpen'){ const g=this.sql.exec("SELECT what FROM gift WHERE id=? AND too=? AND st='open'",+m.id,nm).toArray()[0]; if(!g) return J({err:'gone'},404); this.sql.exec("UPDATE gift SET st='opened' WHERE id=?",+m.id); return J({ok:true,what:g.what}); }
    /* public profile: card, gear, records */
    if(m.op==='profile'){ const o=key(m.name), r=this.sql.exec('SELECT disp,crew,pub,seen,pg FROM acct WHERE nm=?',o).toArray()[0]; if(!r) return J({err:'nouser'},404);
      const fr=this.sql.exec("SELECT st FROM fr WHERE (a=? AND b=?) OR (a=? AND b=?)",nm,o,o,nm).toArray()[0]; return J({ok:true,bot:BOT_ACCTS.has(o),name:r.disp,crew:r.crew,pub:r.pub||'{}',seen:BOT_ACCTS.has(o)?now:(r.seen||0),pg:r.pg||'',friend:fr?fr.st:'',now}); }
    /* mini-tournaments: up to 8 players, best score on one leaderboard before the clock runs out takes the whole pot */
    const mtRow=id=>this.sql.exec('SELECT * FROM mt WHERE id=?',+id).toArray()[0];
    const mtPl=t=>this.sql.exec('SELECT p.nm AS nm, a.disp AS name, p.score AS score, p.txt AS txt, p.rf AS rf FROM mtp p LEFT JOIN acct a ON a.nm=p.nm WHERE p.id=?',t.id).toArray().sort((x,y)=>(y.score==null?-Infinity:y.score)-(x.score==null?-Infinity:x.score));
    const mtOut=t=>{ const pl=mtPl(t); return {id:t.id,game:t.game,b:t.b,bn:t.bn,mode:t.mode,host:t.host,fee:t.fee,ends:t.ends,claimed:t.claimed,pot:t.fee*pl.length,pl:pl.map(p=>({name:p.name||p.nm,me:p.nm===nm,score:p.score,txt:p.txt,rf:p.rf})),open:t.ends>now}; };
    if(m.op==='mtCreate'){ const game=String(m.game||'').replace(/[^a-z0-9-]/g,'').slice(0,24), b=String(m.b||'').replace(/[^\w-]/g,'').slice(0,24); if(!game||!b) return J({err:'bad'},400);
      if(this.sql.exec('SELECT 1 FROM mt WHERE host=? AND ends>?',nm,now).toArray()[0]) return J({err:'busy'},409);
      const fee=[0,10,50,100,250,500,1000,5000].includes(+m.fee)?+m.fee:100, mins=Math.max(5,Math.min(60,Math.round(+m.mins||15)));
      this.sql.exec('INSERT INTO mt(game,b,bn,mode,host,fee,ends,ts) VALUES(?,?,?,?,?,?,?,?)',game,b,String(m.bn||b).replace(/[<>]/g,'').slice(0,40),m.mode==='sum'?'sum':'max',nm,fee,now+mins*60000,now);
      const id=this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id; this.sql.exec('INSERT INTO mtp(id,nm) VALUES(?,?)',id,nm); return J({ok:true,t:mtOut(mtRow(id))}); }
    if(m.op==='mtList'){ const game=String(m.game||'').replace(/[^a-z0-9-]/g,'').slice(0,24);
      const open=this.sql.exec('SELECT * FROM mt WHERE game=? AND ends>? ORDER BY ends LIMIT 10',game,now).toArray(), mine=this.sql.exec('SELECT t.* FROM mt t JOIN mtp p ON p.id=t.id WHERE p.nm=? AND t.ends>? ORDER BY t.ends DESC LIMIT 6',nm,now-6*36e5).toArray();
      const seen=new Set(), all=[]; for(const t of mine.concat(open)){ if(seen.has(t.id)) continue; seen.add(t.id); all.push(mtOut(t)); } return J({ok:true,list:all,now}); }
    if(m.op==='mtJoin'){ const t=mtRow(m.id); if(!t||t.ends<=now) return J({err:'closed'},409); const n=this.sql.exec('SELECT COUNT(*) AS c FROM mtp WHERE id=?',t.id).toArray()[0].c; if(n>=8) return J({err:'full'},409);
      if(this.sql.exec('SELECT 1 FROM mtp WHERE id=? AND nm=?',t.id,nm).toArray()[0]) return J({err:'in'},409); this.sql.exec('INSERT INTO mtp(id,nm) VALUES(?,?)',t.id,nm); return J({ok:true,t:mtOut(t)}); }
    if(m.op==='mtScore'){ const t=mtRow(m.id); if(!t||t.ends+30000<=now) return J({err:'closed'},409); const p=this.sql.exec('SELECT score FROM mtp WHERE id=? AND nm=?',t.id,nm).toArray()[0]; if(!p) return J({err:'notin'},403);
      const sc=+m.score; if(!isFinite(sc)) return J({err:'bad'},400); const nv=t.mode==='sum'?(p.score||0)+sc:(p.score==null||sc>p.score?sc:p.score);
      if(nv!==p.score) this.sql.exec('UPDATE mtp SET score=?, txt=? WHERE id=? AND nm=?',nv,t.mode==='sum'?String(Math.round(nv*100)/100):String(m.txt||sc).slice(0,30),t.id,nm); return J({ok:true,score:nv}); }
    if(m.op==='mtClaim'){ const t=mtRow(m.id); if(!t) return J({err:'gone'},404); if(t.ends>now) return J({err:'open'},409); const pl=mtPl(t), me=pl.find(p=>p.nm===nm); if(!me) return J({err:'notin'},403);
      if(pl[0].score==null){ if(me.rf) return J({err:'done'},409); this.sql.exec('UPDATE mtp SET rf=1 WHERE id=? AND nm=?',t.id,nm); return J({ok:true,refund:t.fee}); }
      if(pl[0].nm!==nm) return J({err:'notwinner'},403); if(t.claimed) return J({err:'done'},409); this.sql.exec('UPDATE mt SET claimed=1 WHERE id=?',t.id); return J({ok:true,pot:t.fee*pl.length}); }
    if(m.op==='crewTop'){ const rows=this.sql.exec('SELECT c.tag AS tag, c.name AS name, COUNT(a.nm) AS n, SUM(a.life) AS total FROM crew c JOIN acct a ON a.crew=c.tag GROUP BY c.tag ORDER BY total DESC LIMIT 25').toArray(); return J({ok:true,rows}); }
    return J({err:'op'},400); } }
