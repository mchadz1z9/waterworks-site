# ============================================================
#  AI SEARCH APP  --  beginner-friendly, all in one file
#  Run:  python ai_search.py
#  Then open:  http://localhost:5000
# ============================================================

# --- IMPORTS ------------------------------------------------
# Flask lets us create a web server in Python
from flask import Flask, request, jsonify, render_template_string
# requests lets us call other websites / APIs
import requests
# os lets us read files from the computer
import os

# --- APP SETUP ----------------------------------------------
app = Flask(__name__)   # create the web app

# --- SEARCH FUNCTION ----------------------------------------
# This is the "AI" part -- it calls DuckDuckGo's free API
def search_the_web(query):
    """Send a search query to DuckDuckGo and return results."""

    url = "https://api.duckduckgo.com/"
    params = {
        "q": query,          # the search term
        "format": "json",    # we want JSON back
        "no_redirect": "1",
        "no_html": "1",
    }

    response = requests.get(url, params=params, timeout=5)
    data = response.json()   # turn the response into a Python dict

    results = []

    # Main answer (if DuckDuckGo has one)
    if data.get("Abstract"):
        results.append({
            "title": data.get("Heading", "Answer"),
            "text":  data["Abstract"],
            "url":   data.get("AbstractURL", ""),
        })

    # Related topics (up to 6)
    for topic in data.get("RelatedTopics", [])[:6]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append({
                "title": topic["Text"][:60] + "...",
                "text":  topic["Text"],
                "url":   topic.get("FirstURL", ""),
            })

    # If nothing found, say so
    if not results:
        results.append({
            "title": "No results found",
            "text":  f'DuckDuckGo had no instant answer for "{query}". Try a different term!',
            "url":   "",
        })

    return results

# --- READ THIS FILE -----------------------------------------
def get_my_own_code():
    """Read and return the contents of this Python file."""
    with open(__file__, "r", encoding="utf-8") as f:
        return f.read()

# --- SAVE THIS FILE -----------------------------------------
def save_my_own_code(new_code):
    """Overwrite this Python file with new_code."""
    with open(__file__, "w", encoding="utf-8") as f:
        f.write(new_code)

# --- HTML PAGE ----------------------------------------------
# Everything between the triple-quotes is the webpage
PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Search -- Learn Python</title>
  <style>
    /* ---- layout ---- */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: #0f172a;
      color: #e2e8f0;
    }

    /* LEFT PANEL - the app */
    #app-panel {
      width: 50%;
      padding: 32px 28px;
      overflow-y: auto;
      border-right: 2px solid #1e293b;
    }

    h1 { font-size: 1.6rem; color: #38bdf8; margin-bottom: 4px; }
    .subtitle { font-size: 0.85rem; color: #64748b; margin-bottom: 24px; }

    /* search bar */
    #search-row {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
    }
    #query {
      flex: 1;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 1rem;
    }
    #query:focus { outline: none; border-color: #38bdf8; }
    button {
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      background: #38bdf8;
      color: #0f172a;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.95rem;
    }
    button:hover { background: #7dd3fc; }
    button:disabled { background: #334155; color: #64748b; cursor: not-allowed; }

    /* results */
    .result-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 14px;
      border-left: 3px solid #38bdf8;
    }
    .result-card h3 { font-size: 0.95rem; color: #38bdf8; margin-bottom: 6px; }
    .result-card p  { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
    .result-card a  { display: inline-block; margin-top: 8px; font-size: 0.78rem; color: #7dd3fc; }

    #status { font-size: 0.82rem; color: #64748b; margin-bottom: 12px; }
    #results-box { }

    /* RIGHT PANEL - the code editor */
    #code-panel {
      width: 50%;
      display: flex;
      flex-direction: column;
      background: #0f172a;
    }
    #code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    #code-header span { font-size: 0.85rem; color: #64748b; }
    #save-btn {
      background: #22c55e;
      padding: 7px 14px;
      font-size: 0.82rem;
    }
    #save-btn:hover { background: #4ade80; }
    #save-msg {
      font-size: 0.8rem;
      color: #22c55e;
      margin-left: 10px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    #code-editor {
      flex: 1;
      width: 100%;
      padding: 16px;
      background: #0f172a;
      color: #a5f3fc;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 0.82rem;
      line-height: 1.6;
      border: none;
      resize: none;
      outline: none;
      tab-size: 4;
    }
  </style>
</head>
<body>

  <!-- ===== LEFT: SEARCH APP ===== -->
  <div id="app-panel">
    <h1>AI Search</h1>
    <p class="subtitle">Powered by DuckDuckGo &bull; code is on the right &rarr;</p>

    <div id="search-row">
      <input id="query" type="text" placeholder="Type anything and press Search..." />
      <button id="go-btn" onclick="doSearch()">Search</button>
    </div>

    <div id="status"></div>
    <div id="results-box"></div>
  </div>

  <!-- ===== RIGHT: CODE EDITOR ===== -->
  <div id="code-panel">
    <div id="code-header">
      <span>&#128196; ai_search.py &mdash; edit me!</span>
      <div style="display:flex;align-items:center">
        <span id="save-msg">Saved! Reload to apply.</span>
        <button id="save-btn" onclick="saveCode()">Save Code</button>
      </div>
    </div>
    <textarea id="code-editor" spellcheck="false">{{ code }}</textarea>
  </div>

  <script>
    // --- SEARCH -------------------------------------------
    async function doSearch() {
      const query = document.getElementById('query').value.trim();
      if (!query) return;

      const btn = document.getElementById('go-btn');
      btn.disabled = true;
      btn.textContent = 'Searching...';
      document.getElementById('status').textContent = 'Asking DuckDuckGo...';
      document.getElementById('results-box').innerHTML = '';

      try {
        const resp = await fetch('/search?q=' + encodeURIComponent(query));
        const results = await resp.json();

        document.getElementById('status').textContent =
          results.length + ' result(s) for "' + query + '"';

        let html = '';
        for (const r of results) {
          html += `<div class="result-card">
            <h3>${escHtml(r.title)}</h3>
            <p>${escHtml(r.text)}</p>
            ${r.url ? '<a href="' + escHtml(r.url) + '" target="_blank">' + escHtml(r.url) + '</a>' : ''}
          </div>`;
        }
        document.getElementById('results-box').innerHTML = html;
      } catch(e) {
        document.getElementById('status').textContent = 'Error: ' + e.message;
      }

      btn.disabled = false;
      btn.textContent = 'Search';
    }

    // allow pressing Enter to search
    document.getElementById('query').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doSearch();
    });

    // --- SAVE CODE ----------------------------------------
    async function saveCode() {
      const code = document.getElementById('code-editor').value;
      await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code }),
      });
      const msg = document.getElementById('save-msg');
      msg.style.opacity = '1';
      setTimeout(() => msg.style.opacity = '0', 3000);
    }

    // --- HELPER -------------------------------------------
    function escHtml(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  </script>
</body>
</html>
"""

# --- ROUTES -------------------------------------------------
# A "route" maps a URL path to a Python function

@app.route("/")
def home():
    """Show the main page with the search app and the code editor."""
    code = get_my_own_code()
    return render_template_string(PAGE, code=code)


@app.route("/search")
def search():
    """Called by the browser when the user clicks Search."""
    query = request.args.get("q", "")   # get the search term from the URL
    if not query:
        return jsonify([])
    results = search_the_web(query)
    return jsonify(results)             # send JSON back to the browser


@app.route("/save", methods=["POST"])
def save():
    """Called when the user clicks 'Save Code' in the editor panel."""
    new_code = request.get_json().get("code", "")
    save_my_own_code(new_code)
    return jsonify({"status": "saved"})


# --- START THE SERVER ---------------------------------------
if __name__ == "__main__":
    print()
    print("  ╔══════════════════════════════════╗")
    print("  ║   AI Search App is running!      ║")
    print("  ║   Open: http://localhost:5000     ║")
    print("  ╚══════════════════════════════════╝")
    print()
    app.run(debug=True, port=5000)
