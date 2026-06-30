# ============================================================
#  AI CHAT APP  --  powered by Claude (real AI!)
#  Run:  python ai_search.py
#  Then open:  http://localhost:5000
# ============================================================

# --- IMPORTS ------------------------------------------------
from flask import Flask, request, jsonify, render_template_string, Response
import anthropic   # the official Claude AI library
import os

# --- APP SETUP ----------------------------------------------
app = Flask(__name__)

# --- ASK CLAUDE ---------------------------------------------
def ask_claude(question, api_key):
    """Send a question to Claude and stream the answer back word by word."""

    # Create the Claude client using the user's API key
    client = anthropic.Anthropic(api_key=api_key)

    # Stream the response so it appears word by word in the browser
    with client.messages.stream(
        model="claude-haiku-4-5-20251001",   # fast + cheap model, great for learning
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": question
            }
        ],
        system="You are a helpful, friendly AI assistant. Give clear and concise answers."
    ) as stream:
        for text in stream.text_stream:
            yield text   # send each chunk to the browser as it arrives

# --- READ THIS FILE -----------------------------------------
def get_my_own_code():
    with open(__file__, "r", encoding="utf-8") as f:
        return f.read()

# --- SAVE THIS FILE -----------------------------------------
def save_my_own_code(new_code):
    with open(__file__, "w", encoding="utf-8") as f:
        f.write(new_code)

# --- HTML PAGE ----------------------------------------------
PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Chat -- Learn Python</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: #0f172a;
      color: #e2e8f0;
    }

    /* LEFT PANEL */
    #app-panel {
      width: 50%;
      padding: 28px 24px;
      overflow-y: auto;
      border-right: 2px solid #1e293b;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    h1 { font-size: 1.6rem; color: #a78bfa; }
    .subtitle { font-size: 0.82rem; color: #64748b; }

    /* API key row */
    #key-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    #key-row label { font-size: 0.8rem; color: #64748b; white-space: nowrap; }
    #api-key {
      flex: 1;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 0.85rem;
    }
    #api-key:focus { outline: none; border-color: #a78bfa; }

    /* Chat messages */
    #chat-box {
      flex: 1;
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      overflow-y: auto;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .msg { line-height: 1.6; font-size: 0.9rem; }
    .msg.user { color: #7dd3fc; font-weight: 600; }
    .msg.user::before { content: "You:  "; }
    .msg.ai   { color: #d4d4d8; white-space: pre-wrap; }
    .msg.ai::before { content: "Claude:  "; font-weight: 600; color: #a78bfa; }

    /* Input row */
    #input-row {
      display: flex;
      gap: 10px;
    }
    #question {
      flex: 1;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 0.95rem;
    }
    #question:focus { outline: none; border-color: #a78bfa; }
    button {
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      background: #a78bfa;
      color: #0f172a;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.9rem;
    }
    button:hover { background: #c4b5fd; }
    button:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
    #status { font-size: 0.78rem; color: #64748b; min-height: 16px; }

    /* RIGHT PANEL */
    #code-panel {
      width: 50%;
      display: flex;
      flex-direction: column;
    }
    #code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    #code-header span { font-size: 0.82rem; color: #64748b; }
    #save-btn { background: #22c55e; padding: 7px 14px; font-size: 0.82rem; }
    #save-btn:hover { background: #4ade80; }
    #save-msg {
      font-size: 0.78rem; color: #22c55e;
      margin-left: 10px; opacity: 0; transition: opacity 0.3s;
    }
    #code-editor {
      flex: 1;
      padding: 16px;
      background: #0f172a;
      color: #a5f3fc;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 0.8rem;
      line-height: 1.6;
      border: none;
      resize: none;
      outline: none;
      tab-size: 4;
    }
  </style>
</head>
<body>

  <!-- ===== LEFT: AI CHAT ===== -->
  <div id="app-panel">
    <div>
      <h1>AI Chat</h1>
      <p class="subtitle">Ask Claude anything &bull; code is on the right</p>
    </div>

    <!-- API Key input -->
    <div id="key-row">
      <label>API Key:</label>
      <input id="api-key" type="password" placeholder="Paste your Anthropic API key here..." />
    </div>

    <!-- Chat history -->
    <div id="chat-box">
      <div class="msg ai" style="color:#64748b;font-style:italic">
        Paste your Claude API key above, then type a question below!
      </div>
    </div>

    <div id="status"></div>

    <!-- Question input -->
    <div id="input-row">
      <input id="question" type="text" placeholder="Ask me anything..." />
      <button id="ask-btn" onclick="askClaude()">Ask AI</button>
    </div>
  </div>

  <!-- ===== RIGHT: CODE EDITOR ===== -->
  <div id="code-panel">
    <div id="code-header">
      <span>ai_search.py -- edit me!</span>
      <div style="display:flex;align-items:center">
        <span id="save-msg">Saved! Reload to apply.</span>
        <button id="save-btn" onclick="saveCode()">Save Code</button>
      </div>
    </div>
    <textarea id="code-editor" spellcheck="false">{{ code }}</textarea>
  </div>

  <script>
    // --- ASK CLAUDE (streaming) ---------------------------
    async function askClaude() {
      const question = document.getElementById('question').value.trim();
      const apiKey   = document.getElementById('api-key').value.trim();

      if (!question) return;
      if (!apiKey)   { alert('Paste your Anthropic API key first!'); return; }

      const btn = document.getElementById('ask-btn');
      btn.disabled = true;
      btn.textContent = 'Thinking...';
      document.getElementById('status').textContent = 'Claude is answering...';

      // Show the user's question in the chat
      const chat = document.getElementById('chat-box');
      const userMsg = document.createElement('div');
      userMsg.className = 'msg user';
      userMsg.textContent = question;
      chat.appendChild(userMsg);

      // Create an empty AI message div that we'll fill word by word
      const aiMsg = document.createElement('div');
      aiMsg.className = 'msg ai';
      aiMsg.textContent = '';
      chat.appendChild(aiMsg);

      document.getElementById('question').value = '';

      // Fetch from /ask with streaming
      const resp = await fetch('/ask?q=' + encodeURIComponent(question)
                                  + '&key=' + encodeURIComponent(apiKey));
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiMsg.textContent += decoder.decode(value);
        chat.scrollTop = chat.scrollHeight;   // auto-scroll
      }

      document.getElementById('status').textContent = '';
      btn.disabled = false;
      btn.textContent = 'Ask AI';
    }

    // Press Enter to ask
    document.getElementById('question').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') askClaude();
    });

    // --- SAVE CODE ----------------------------------------
    async function saveCode() {
      const code = document.getElementById('code-editor').value;
      await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const msg = document.getElementById('save-msg');
      msg.style.opacity = '1';
      setTimeout(() => msg.style.opacity = '0', 3000);
    }
  </script>
</body>
</html>
"""

# --- ROUTES -------------------------------------------------

@app.route("/")
def home():
    return render_template_string(PAGE, code=get_my_own_code())


@app.route("/ask")
def ask():
    """Stream Claude's answer back to the browser."""
    question = request.args.get("q", "")
    api_key  = request.args.get("key", "")

    if not question or not api_key:
        return "Missing question or API key", 400

    # Response(stream_with_context) streams text chunk by chunk
    return Response(ask_claude(question, api_key), mimetype="text/plain")


@app.route("/save", methods=["POST"])
def save():
    new_code = request.get_json().get("code", "")
    save_my_own_code(new_code)
    return jsonify({"status": "saved"})


# --- START --------------------------------------------------
if __name__ == "__main__":
    print()
    print("  AI Chat App is running!")
    print("  Open: http://localhost:5000")
    print()
    app.run(debug=True, port=5000)
