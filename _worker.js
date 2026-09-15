// WaterWorks Lawn & Landscaping — single-file admin + API
//
// HOW TO USE: put this file, named exactly "_worker.js", in the ROOT of your
// site (same place as your index.html / build output). Cloudflare Pages
// automatically picks up a file with this exact name and name only — no
// folders, no other setup on the code side. Your existing site keeps working
// exactly as before; this just adds /admin and /api/* on top of it.
//
// One-time setup still needed in the Cloudflare dashboard (not code):
//   1. Create a D1 database, run schema.sql against it (D1 dashboard Console tab)
//   2. Bind it to your Pages project: Settings > Functions > D1 database
//      bindings > variable name "DB" > pick the database
//   3. Settings > Environment variables > add ADMIN_PASSWORD (Encrypt it)
// Do this for both Production and Preview. Then push this file and visit
// yoursite.com/admin.

const SESSION_COOKIE = "ww_session";
const SESSION_DAYS = 7;

function jsonResponse(data, status, extraHeaders) {
  const headers = Object.assign({ "Content-Type": "application/json" }, extraHeaders || {});
  return new Response(JSON.stringify(data), { status: status || 200, headers: headers });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + "=") === 0) return p.substring(name.length + 1);
  }
  return null;
}

async function requireAuth(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE token = ?").bind(token).first();
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  return true;
}

const DEFAULT_CONTENT = {
  hero_title: "WaterWorks Lawn & Landscaping",
  hero_subtitle: "Lawn care, pressure washing, car washing & snow removal in Thornhill, ON",
  service_area: "Anywhere within 15 km of Thornhill, Ontario",
  contact_phone: "",
  contact_email: "",
  hours: "Lawn care: Thursdays, Saturdays, Sundays. Snow removal: any day.",
  services: [
    { name: "Lawn Mowing", price: "", description: "" },
    { name: "Pressure Washing", price: "", description: "" },
    { name: "Car Washing", price: "", description: "" },
    { name: "Snow Removal", price: "", description: "" }
  ]
};

async function getContent(env) {
  const row = await env.DB.prepare("SELECT value FROM content WHERE key = 'site'").first();
  if (!row) return DEFAULT_CONTENT;
  try { return JSON.parse(row.value); } catch (e) { return DEFAULT_CONTENT; }
}

async function setContent(env, value) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO content (key, value, updated_at) VALUES ('site', ?, ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(JSON.stringify(value), now).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === "/api/content" && method === "GET") {
        return jsonResponse(await getContent(env), 200);
      }

      if (path === "/api/login" && method === "POST") {
        const body = await request.json().catch(function () { return {}; });
        if (!body.password || body.password !== env.ADMIN_PASSWORD) {
          return jsonResponse({ error: "Incorrect password" }, 401);
        }
        const token = randomToken();
        const now = new Date();
        const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
        await env.DB.prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
          .bind(token, now.toISOString(), expires.toISOString()).run();
        return jsonResponse({ ok: true }, 200, {
          "Set-Cookie": SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + (SESSION_DAYS * 86400)
        });
      }

      if (path === "/api/logout" && method === "POST") {
        const token = getCookie(request, SESSION_COOKIE);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
        return jsonResponse({ ok: true }, 200, {
          "Set-Cookie": SESSION_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
        });
      }

      if (path === "/api/session" && method === "GET") {
        return jsonResponse({ authenticated: await requireAuth(request, env) }, 200);
      }

      if (path === "/api/admin/content" && method === "PUT") {
        if (!(await requireAuth(request, env))) return jsonResponse({ error: "Unauthorized" }, 401);
        const body = await request.json().catch(function () { return null; });
        if (!body) return jsonResponse({ error: "Invalid JSON" }, 400);
        await setContent(env, body);
        return jsonResponse({ ok: true }, 200);
      }

      if (path === "/api/reviews" && method === "POST") {
        const body = await request.json().catch(function () { return {}; });
        const name = (body.name || "").toString().slice(0, 100).trim();
        const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 0));
        const comment = (body.comment || "").toString().slice(0, 2000).trim();
        if (!name || !comment || !rating) return jsonResponse({ error: "Missing fields" }, 400);
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO reviews (name, rating, comment, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
        ).bind(name, rating, comment, now).run();
        return jsonResponse({ ok: true, message: "Thanks! Your review is awaiting approval." }, 200);
      }

      if (path === "/api/reviews/approved" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT id, name, rating, comment, created_at FROM reviews WHERE status = 'approved' ORDER BY created_at DESC"
        ).all();
        return jsonResponse(result.results, 200);
      }

      if (path === "/api/admin/reviews" && method === "GET") {
        if (!(await requireAuth(request, env))) return jsonResponse({ error: "Unauthorized" }, 401);
        const status = url.searchParams.get("status");
        let result;
        if (status) {
          result = await env.DB.prepare("SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC").bind(status).all();
        } else {
          result = await env.DB.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
        }
        return jsonResponse(result.results, 200);
      }

      const reviewIdMatch = path.match(/^\/api\/admin\/reviews\/(\d+)$/);
      if (reviewIdMatch && method === "PATCH") {
        if (!(await requireAuth(request, env))) return jsonResponse({ error: "Unauthorized" }, 401);
        const id = reviewIdMatch[1];
        const body = await request.json().catch(function () { return {}; });
        if (["approved", "rejected", "pending"].indexOf(body.status) === -1) {
          return jsonResponse({ error: "Invalid status" }, 400);
        }
        await env.DB.prepare("UPDATE reviews SET status = ? WHERE id = ?").bind(body.status, id).run();
        return jsonResponse({ ok: true }, 200);
      }
      if (reviewIdMatch && method === "DELETE") {
        if (!(await requireAuth(request, env))) return jsonResponse({ error: "Unauthorized" }, 401);
        const id = reviewIdMatch[1];
        await env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
        return jsonResponse({ ok: true }, 200);
      }

      if (path === "/admin" || path === "/admin/") {
        return new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
      }

      // Anything else: hand off to your normal site files, unchanged.
      return env.ASSETS.fetch(request);
    } catch (err) {
      return jsonResponse({ error: "Server error", detail: String(err) }, 500);
    }
  }
};

const ADMIN_HTML = "<!DOCTYPE html>" +
"<html lang='en'><head><meta charset='UTF-8'>" +
"<meta name='viewport' content='width=device-width, initial-scale=1'>" +
"<title>WaterWorks Admin</title>" +
"<style>" +
":root{--green:#1f7a3f;--green-dark:#155a2d;--bg:#f4f7f5;--card:#ffffff;--text:#1c2b22;--muted:#5b6b61;--border:#dfe7e1;--danger:#c0392b;}" +
"*{box-sizing:border-box;}" +
"body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);}" +
".wrap{max-width:900px;margin:0 auto;padding:24px 16px 80px;}" +
"h1{font-size:22px;margin:0 0 4px;}" +
".sub{color:var(--muted);margin:0 0 24px;font-size:14px;}" +
".card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;}" +
"label{display:block;font-size:13px;font-weight:600;margin:12px 0 4px;color:var(--muted);}" +
"input[type=text],input[type=password],input[type=number],textarea{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;}" +
"textarea{min-height:70px;resize:vertical;}" +
"button{background:var(--green);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;}" +
"button:hover{background:var(--green-dark);}" +
"button.secondary{background:#fff;color:var(--text);border:1px solid var(--border);}" +
"button.danger{background:var(--danger);}" +
".tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}" +
".tab{padding:8px 16px;border-radius:20px;border:1px solid var(--border);background:#fff;cursor:pointer;font-size:14px;font-weight:600;color:var(--muted);}" +
".tab.active{background:var(--green);color:#fff;border-color:var(--green);}" +
".service-row{display:grid;grid-template-columns:1fr 100px 1fr auto;gap:8px;align-items:center;margin-bottom:8px;}" +
".review{border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;}" +
".review .meta{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px;}" +
".pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;}" +
".pill.pending{background:#fff3cd;color:#8a6d1d;}" +
".pill.approved{background:#d7f0dd;color:var(--green-dark);}" +
".pill.rejected{background:#fadbd8;color:var(--danger);}" +
".row-buttons{display:flex;gap:8px;margin-top:8px;}" +
"#loginScreen{max-width:360px;margin:80px auto;}" +
".hidden{display:none;}" +
".status-msg{font-size:13px;margin-top:8px;}" +
".status-msg.ok{color:var(--green-dark);}" +
".status-msg.err{color:var(--danger);}" +
"</style></head><body>" +
"<div class='wrap' id='loginScreen'>" +
"<div class='card'>" +
"<h1>WaterWorks Admin</h1>" +
"<p class='sub'>Sign in to manage your site</p>" +
"<label>Password</label>" +
"<input type='password' id='loginPassword'>" +
"<div class='row-buttons'><button onclick='doLogin()'>Sign in</button></div>" +
"<div class='status-msg err' id='loginMsg'></div>" +
"</div></div>" +
"<div class='wrap hidden' id='appScreen'>" +
"<h1>WaterWorks Admin</h1>" +
"<p class='sub'>Manage everything on your site from here</p>" +
"<div class='tabs'>" +
"<div class='tab active' id='tabContentBtn' onclick=\"showTab('content')\">Site Content</div>" +
"<div class='tab' id='tabReviewsBtn' onclick=\"showTab('reviews')\">Reviews</div>" +
"<div class='tab' onclick='doLogout()'>Log out</div>" +
"</div>" +

"<div id='tabContent'>" +
"<div class='card'>" +
"<label>Hero title</label><input type='text' id='f_hero_title'>" +
"<label>Hero subtitle</label><input type='text' id='f_hero_subtitle'>" +
"<label>Service area</label><input type='text' id='f_service_area'>" +
"<label>Business hours</label><input type='text' id='f_hours'>" +
"<label>Contact phone</label><input type='text' id='f_contact_phone'>" +
"<label>Contact email</label><input type='text' id='f_contact_email'>" +
"</div>" +
"<div class='card'>" +
"<label>Services &amp; pricing</label>" +
"<div id='servicesList'></div>" +
"<button class='secondary' onclick='addServiceRow()'>+ Add service</button>" +
"</div>" +
"<div class='card'>" +
"<label>Raw content (advanced — full JSON, edit with care)</label>" +
"<textarea id='rawJson' style='min-height:160px;font-family:monospace;font-size:12px;'></textarea>" +
"<div class='row-buttons'>" +
"<button onclick='saveContent()'>Save changes</button>" +
"<button class='secondary' onclick='loadContent()'>Reload from server</button>" +
"</div>" +
"<div class='status-msg' id='contentMsg'></div>" +
"</div>" +
"</div>" +

"<div id='tabReviews' class='hidden'>" +
"<div class='card'>" +
"<label>Filter</label>" +
"<div class='tabs'>" +
"<div class='tab active' onclick=\"loadReviews('')\">All</div>" +
"<div class='tab' onclick=\"loadReviews('pending')\">Pending</div>" +
"<div class='tab' onclick=\"loadReviews('approved')\">Approved</div>" +
"<div class='tab' onclick=\"loadReviews('rejected')\">Rejected</div>" +
"</div>" +
"<div id='reviewsList'></div>" +
"</div>" +
"</div>" +

"</div>" +

"<script>" +
"function el(id){return document.getElementById(id);}" +
"function showTab(name){" +
"  if(name==='content'){el('tabContent').classList.remove('hidden');el('tabReviews').classList.add('hidden');el('tabContentBtn').classList.add('active');el('tabReviewsBtn').classList.remove('active');}" +
"  else{el('tabReviews').classList.remove('hidden');el('tabContent').classList.add('hidden');el('tabReviewsBtn').classList.add('active');el('tabContentBtn').classList.remove('active');loadReviews('');}" +
"}" +
"function doLogin(){" +
"  var pw = el('loginPassword').value;" +
"  fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})" +
"    .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});})" +
"    .then(function(res){" +
"      if(res.ok){el('loginScreen').classList.add('hidden');el('appScreen').classList.remove('hidden');loadContent();}" +
"      else{el('loginMsg').innerText = res.d.error || 'Login failed';}" +
"    });" +
"}" +
"function doLogout(){fetch('/api/logout',{method:'POST'}).then(function(){location.reload();});}" +
"function checkSession(){" +
"  fetch('/api/session').then(function(r){return r.json();}).then(function(d){" +
"    if(d.authenticated){el('loginScreen').classList.add('hidden');el('appScreen').classList.remove('hidden');loadContent();}" +
"  });" +
"}" +
"var currentContent = null;" +
"function loadContent(){" +
"  fetch('/api/content').then(function(r){return r.json();}).then(function(d){" +
"    currentContent = d;" +
"    el('f_hero_title').value = d.hero_title || '';" +
"    el('f_hero_subtitle').value = d.hero_subtitle || '';" +
"    el('f_service_area').value = d.service_area || '';" +
"    el('f_hours').value = d.hours || '';" +
"    el('f_contact_phone').value = d.contact_phone || '';" +
"    el('f_contact_email').value = d.contact_email || '';" +
"    renderServices(d.services || []);" +
"    el('rawJson').value = JSON.stringify(d, null, 2);" +
"  });" +
"}" +
"function renderServices(services){" +
"  var list = el('servicesList');" +
"  list.innerHTML = '';" +
"  services.forEach(function(s, i){" +
"    var row = document.createElement('div');" +
"    row.className = 'service-row';" +
"    row.innerHTML =" +
"      \"<input type='text' placeholder='Name' value='\"+ (s.name||'').replace(/'/g,'&#39;') +\"' data-i='\"+i+\"' data-f='name'>\" +" +
"      \"<input type='text' placeholder='Price' value='\"+ (s.price||'').replace(/'/g,'&#39;') +\"' data-i='\"+i+\"' data-f='price'>\" +" +
"      \"<input type='text' placeholder='Description' value='\"+ (s.description||'').replace(/'/g,'&#39;') +\"' data-i='\"+i+\"' data-f='description'>\" +" +
"      \"<button class='danger' onclick='removeServiceRow(\"+i+\")'>&times;</button>\";" +
"    list.appendChild(row);" +
"  });" +
"}" +
"function collectServices(){" +
"  var rows = document.querySelectorAll('.service-row');" +
"  var map = {};" +
"  rows.forEach(function(row){" +
"    row.querySelectorAll('input').forEach(function(inp){" +
"      var i = inp.getAttribute('data-i');" +
"      var f = inp.getAttribute('data-f');" +
"      if(!map[i]) map[i] = {};" +
"      map[i][f] = inp.value;" +
"    });" +
"  });" +
"  var services = [];" +
"  Object.keys(map).forEach(function(k){services.push(map[k]);});" +
"  return services;" +
"}" +
"function addServiceRow(){" +
"  var services = collectServices();" +
"  services.push({name:'',price:'',description:''});" +
"  renderServices(services);" +
"}" +
"function removeServiceRow(i){" +
"  var services = collectServices();" +
"  services.splice(i,1);" +
"  renderServices(services);" +
"}" +
"function saveContent(){" +
"  var raw = el('rawJson').value;" +
"  var body;" +
"  try{" +
"    body = JSON.parse(raw);" +
"  }catch(e){" +
"    el('contentMsg').className='status-msg err';" +
"    el('contentMsg').innerText='Raw JSON is invalid — fix it or reload.';" +
"    return;" +
"  }" +
"  body.hero_title = el('f_hero_title').value;" +
"  body.hero_subtitle = el('f_hero_subtitle').value;" +
"  body.service_area = el('f_service_area').value;" +
"  body.hours = el('f_hours').value;" +
"  body.contact_phone = el('f_contact_phone').value;" +
"  body.contact_email = el('f_contact_email').value;" +
"  body.services = collectServices();" +
"  fetch('/api/admin/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})" +
"    .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});})" +
"    .then(function(res){" +
"      el('contentMsg').className = res.ok ? 'status-msg ok' : 'status-msg err';" +
"      el('contentMsg').innerText = res.ok ? 'Saved — live on the site now.' : (res.d.error || 'Save failed');" +
"      if(res.ok) loadContent();" +
"    });" +
"}" +
"function loadReviews(status){" +
"  document.querySelectorAll('#tabReviews .tab').forEach(function(t){t.classList.remove('active');});" +
"  var q = status ? ('?status='+status) : '';" +
"  fetch('/api/admin/reviews'+q).then(function(r){return r.json();}).then(function(reviews){" +
"    var list = el('reviewsList');" +
"    list.innerHTML = '';" +
"    if(reviews.length===0){list.innerHTML='<p style=\"color:#5b6b61;\">No reviews here.</p>';return;}" +
"    reviews.forEach(function(rv){" +
"      var div = document.createElement('div');" +
"      div.className='review';" +
"      div.innerHTML =" +
"        \"<div class='meta'><span><strong>\"+escapeHtml(rv.name)+\"</strong> — \"+rv.rating+\"/5</span><span class='pill \"+rv.status+\"'>\"+rv.status+\"</span></div>\" +" +
"        \"<div>\"+escapeHtml(rv.comment)+\"</div>\" +" +
"        \"<div class='row-buttons'>\" +" +
"        \"<button onclick=\\\"setReviewStatus(\"+rv.id+\",'approved')\\\">Approve</button>\" +" +
"        \"<button class='secondary' onclick=\\\"setReviewStatus(\"+rv.id+\",'rejected')\\\">Reject</button>\" +" +
"        \"<button class='danger' onclick=\\\"deleteReview(\"+rv.id+\")\\\">Delete</button>\" +" +
"        \"</div>\";" +
"      list.appendChild(div);" +
"    });" +
"  });" +
"}" +
"function escapeHtml(s){var d=document.createElement('div');d.innerText=s||'';return d.innerHTML;}" +
"function setReviewStatus(id,status){" +
"  fetch('/api/admin/reviews/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})" +
"    .then(function(){loadReviews('');});" +
"}" +
"function deleteReview(id){" +
"  if(!confirm('Delete this review permanently?')) return;" +
"  fetch('/api/admin/reviews/'+id,{method:'DELETE'}).then(function(){loadReviews('');});" +
"}" +
"checkSession();" +
"</" + "script>" +
"</body></html>";
