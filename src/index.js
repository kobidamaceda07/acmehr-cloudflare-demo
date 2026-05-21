export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. BACKEND API: Processes prompts through Cloudflare AI Gateway
    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const { question } = await request.json();

        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct-awq", 
          {
            messages: [
              { role: "system", content: "You are the AcmeHR assistant. Keep answers incredibly brief and professional." },
              { role: "user", content: question }
            ]
          },
          { gateway: { id: "askhr" } } // Feeds your live Cloudflare UI analytics
        );

        return new Response(JSON.stringify({ response: aiResponse.response }), {
          headers: { "content-type": "application/json; charset=utf-8" }
        });

      } catch (err) {
        let userFriendlyError = err.message;
        if (err.message.includes("DLP policy violations") || err.message.includes("2030")) {
          userFriendlyError = "Compliance Guardrail Triggered: Sensitive Financial / PII Data pattern detected. Inference request blocked at edge network tier.";
        }
        return new Response(JSON.stringify({ error: userFriendlyError }), { status: 429 });
      }
    }

    // 2. FRONTEND UI: Comprehensive SaaS Payroll Dashboard Layout
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AcmeHR Portal</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #0b071a; color: #f8fafc; display: flex; height: 100vh; overflow: hidden; }
          
          /* Sidebar Layout */
          .sidebar { width: 260px; background: #120d26; border-right: 1px solid #2e1a4d; padding: 25px; display: flex; flex-direction: column; gap: 30px; }
          .logo { font-size: 22px; font-weight: 800; color: #a855f7; display: flex; align-items: center; gap: 8px; }
          .nav-links { display: flex; flex-direction: column; gap: 10px; list-style: none; }
          .nav-item { padding: 12px 16px; border-radius: 8px; color: #94a3b8; text-decoration: none; font-weight: 500; transition: all 0.2s; display: block; }
          .nav-item:hover, .nav-item.active { background: #241942; color: #f8fafc; }
          .nav-item.admin-btn { border: 1px dashed #a855f7; color: #c084fc; margin-top: 20px; text-align: center; }
          .nav-item.admin-btn:hover { background: #a855f7; color: white; }

          /* Main Workspace Dashboard */
          .main-content { flex-grow: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; gap: 30px; width: calc(100% - 660px); }
          .header-title h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
          .header-title p { color: #64748b; font-size: 14px; }
          
          /* Stats Cards grid */
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
          .card { background: #130e29; border: 1px solid #231842; border-radius: 12px; padding: 20px; }
          .card-title { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
          .card-value { font-size: 24px; font-weight: 700; color: #f1f5f9; }
          .card-sub { font-size: 12px; color: #10b981; margin-top: 6px; }

          /* Data Table */
          .table-section { background: #130e29; border: 1px solid #231842; border-radius: 12px; padding: 25px; }
          .table-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { padding: 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #231842; }
          td { padding: 14px 12px; font-size: 14px; border-bottom: 1px solid #1c1433; color: #cbd5e1; }
          
          /* Interactive Embedded AI Assistant Right Panel */
          .ai-panel { width: 400px; background: #0f0a22; border-left: 1px solid #2e1a4d; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.3); }
          .ai-header { padding: 25px; border-bottom: 1px solid #2e1a4d; background: #140e2e; }
          .ai-header h3 { font-size: 18px; display: flex; align-items: center; gap: 8px; color: #c084fc; }
          .ai-header p { font-size: 12px; color: #64748b; margin-top: 4px; }
          #chat-box { flex-grow: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; font-size: 14px; line-height: 1.5; }
          .input-container { padding: 25px; background: #140e2e; border-top: 1px solid #2e1a4d; display: flex; gap: 10px; }
          input { flex-grow: 1; padding: 14px; border-radius: 8px; border: 1px solid #4c1d95; background: #090514; color: white; font-size: 14px; }
          button { padding: 14px 20px; background: #a855f7; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold; transition: background 0.2s; }
          button:hover { background: #bf5af2; }
          .error-banner { color: #f87171; background: #450a0a; border: 1px solid #991b1b; padding: 15px; border-radius: 8px; font-weight: bold; font-size: 13px; }
        </style>
      </head>
      <body>

        <div class="sidebar">
          <div class="logo">🔮 AcmeHR</div>
          <ul class="nav-links">
            <li><a href="#" class="nav-item active">📊 Dashboard</a></li>
            <li><a href="#" class="nav-item">💰 Payroll Control</a></li>
            <li><a href="#" class="nav-item">📅 Time & Attendance</a></li>
            <li><a href="#" class="nav-item">📄 Documents (R2)</a></li>
            <li><a href="https://admin.hr.kobimaceda.com" target="_blank" class="nav-item admin-btn">🔒 Admin Console</a></li>
          </ul>
        </div>

        <div class="main-content">
          <div class="header-title">
            <h1>Welcome Back, Kobi</h1>
            <p>SaaS Scope: <code>hr.kobimaceda.com</code> • Cloudflare Global Connectivity Cloud Instance</p>
          </div>

          <div class="stats-grid">
            <div class="card">
              <div class="card-title">Next Payroll Date</div>
              <div class="card-value">May 30, 2026</div>
              <div class="card-sub">Status: Processing</div>
            </div>
            <div class="card">
              <div class="card-title">Active Global Staff</div>
              <div class="card-value">1,248</div>
              <div class="card-sub">Across 14 Node Cities</div>
            </div>
            <div class="card">
              <div class="card-title">R2 Document Vault</div>
              <div class="card-value">4.2 TB</div>
              <div class="card-sub">AES-256 Cloud Encrypted</div>
            </div>
          </div>

          <div class="table-section">
            <div class="table-title">Recent Payroll Distributions</div>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Pay Cycle</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Jane Doe</td>
                  <td>Engineering</td>
                  <td>Monthly Core</td>
                  <td>$8,450.00</td>
                  <td style="color:#10b981;">● Cleared</td>
                </tr>
                <tr>
                  <td>John Smith</td>
                  <td>Global Operations</td>
                  <td>Monthly Core</td>
                  <td>$6,200.00</td>
                  <td style="color:#10b981;">● Cleared</td>
                </tr>
                <tr>
                  <td>Alex Rivera</td>
                  <td>Product Design</td>
                  <td>Monthly Core</td>
                  <td>$7,100.00</td>
                  <td style="color:#f59e0b;">⚡ In Transit</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="ai-panel">
          <div class="ai-header">
            <h3>🤖 AskHR AI Copilot</h3>
            <p>Enterprise AI Gateway (askhr) Active with Layer 7 DLP Guardrails</p>
          </div>
          
          <div id="chat-box">
            <span style="color: #94a3b8;">🤖 Hello Kobi! I am your corporate HR routing assistant. You can ask me general company policy questions.<br><br>
            <strong>💡 Demo Security Tip:</strong> Try asking a normal question first, then try typing an employee's financial file data containing a credit card pattern to demonstrate the Cloudflare platform intercept drop.</span>
          </div>
          
          <div class="input-container">
            <input type="text" id="question" placeholder="Ask a policy question..." onkeydown="if(event.key==='Enter') askAI()">
            <button onclick="askAI()">Send</button>
          </div>
        </div>

        <script>
          async function askAI() {
            const input = document.getElementById('question');
            const q = input.value.trim();
            const box = document.getElementById('chat-box');
            if(!q) return;
            
            box.innerHTML += '<div style="margin-top:10px; color:#c084fc; text-align:right;"><strong>You:</strong> ' + q + '</div>';
            box.innerHTML += '<div id="loading-cursor" style="color:#64748b; margin-top:5px;">Evaluating security proxy path...</div>';
            input.value = '';
            box.scrollTop = box.scrollHeight;
            
            try {
              const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q })
              });
              
              // Remove the loading indicator text string
              document.getElementById('loading-cursor').remove();
              const data = await res.json();
              
              if(res.ok && data.response) {
                box.innerHTML += '<div style="margin-top:10px; background:#181333; padding:12px; border-radius:8px;"><strong>AskHR Assistant:</strong><br>' + data.response + '</div>';
              } else if (data.error) {
                box.innerHTML += '<div class="error-banner" style="margin-top:15px;">🔴 SECURITY POLICY INFRINGEMENT<br><br>' + data.error + '</div>';
              } else {
                box.innerHTML += '<div style="color:#f87171; margin-top:10px;">❌ Request dropped by edge filter.</div>';
              }
            } catch(e) {
              if(document.getElementById('loading-cursor')) document.getElementById('loading-cursor').remove();
              box.innerHTML += '<div style="color:#f87171; margin-top:10px;">❌ Edge communication exception.</div>';
            }
            box.scrollTop = box.scrollHeight;
          }
        </script>
      </body>
      </html>
    `, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
