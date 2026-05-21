export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🛠️ SELF-INITIALIZATION: Automatically provision D1 database schema if empty
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          role TEXT,
          salary TEXT,
          doc_name TEXT
        )
      `).run();
    } catch(e) { console.log("DB Init wait..."); }

    // ----------------------------------------------------
    // SYSTEM TRACK A: BACKEND API ENDPOINTS
    // ----------------------------------------------------
    
    // 🤖 AI Chatbot Endpoint (AskHR)
    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const { question } = await request.json();
        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct-awq", {
          messages: [
            { role: "system", content: "You are the AcmeHR assistant. Keep answers incredibly brief." },
            { role: "user", content: question }
          ]
        }, { gateway: { id: "askhr" } });

        return new Response(JSON.stringify({ response: aiResponse.response }), {
          headers: { "content-type": "application/json" }
        });
      } catch (err) {
        let userFriendlyError = err.message;
        if (err.message.includes("DLP policy violations") || err.message.includes("2030")) {
          userFriendlyError = "Compliance Guardrail Triggered: Sensitive Financial / PII Data pattern detected. Inference request blocked at edge network tier.";
        }
        return new Response(JSON.stringify({ error: userFriendlyError }), { status: 429 });
      }
    }

    // 📥 Admin Console DB Write + R2 Document Stream Upload
    if (request.method === "POST" && url.pathname === "/api/admin/add") {
      try {
        const formData = await request.formData();
        const name = formData.get("name");
        const role = formData.get("role");
        const salary = formData.get("salary");
        const file = formData.get("contract");

        let docName = "No contract uploaded";
        
        // If an admin uploaded a file, stream it straight into Cloudflare R2 object storage
        if (file && file.size > 0) {
          docName = `${Date.now()}-${file.name}`;
          await env.DOCS.put(docName, file.stream(), {
            headers: { "content-type": file.type }
          });
        }

        // Insert structured payroll parameters into Cloudflare D1 Relational DB
        await env.DB.prepare("INSERT INTO employees (name, role, salary, doc_name) VALUES (?, ?, ?, ?)")
          .bind(name, role, salary, docName)
          .run();

        // Redirect seamlessly back to reload the console list
        return new Response(null, { status: 302, headers: { "Location": "/" } });
      } catch (err) {
        return new Response("Database Write Exception: " + err.message, { status: 500 });
      }
    }

    // ----------------------------------------------------
    // SYSTEM TRACK B: RENDERING FRONTEND LAYOUTS
    // ----------------------------------------------------

    // 🔒 PLATFORM INTERCEPT: If navigating to admin.hr.kobimaceda.com, render Admin UI
    if (url.hostname === "admin.hr.kobimaceda.com") {
      
      // Query Cloudflare D1 Database live to read all employees
      let employees = [];
      try {
        const { results } = await env.DB.prepare("SELECT * FROM employees ORDER BY id DESC").all();
        employees = results || [];
      } catch(e) {}

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AcmeHR Admin Console</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #06040d; color: #f8fafc; padding: 40px; }
            .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 30px; }
            header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3b0764; padding-bottom: 20px; }
            .badge { background: #7c3aed; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
            .split { display: flex; gap: 30px; }
            .box { background: #110924; border: 1px solid #3b0764; padding: 25px; border-radius: 12px; flex: 1; }
            .form-group { margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px; }
            input, select { padding: 12px; background: #090514; border: 1px solid #4c1d95; color: white; border-radius: 6px; font-size: 14px; }
            button { padding: 12px; background: #a855f7; border: none; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; }
            button:hover { background: #bf5af2; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #241445; font-size: 14px; }
            th { color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <header>
              <div>
                <h1>🔒 AcmeHR Secure Admin Console</h1>
                <p style="color: #64748b; font-size: 14px;">Scope: <code>admin.hr.kobimaceda.com</code></p>
              </div>
              <span class="badge">🛡️ ZTNA ENFORCED</span>
            </header>

            <div class="split">
              <div class="box">
                <h3 style="margin-bottom:15px; color:#c084fc;">Onboard New Employee</h3>
                <form action="/api/admin/add" method="POST" enctype="multipart/form-data">
                  <div class="form-group">
                    <label>Employee Name</label>
                    <input type="text" name="name" required placeholder="e.g. Sarah Connor">
                  </div>
                  <div class="form-group">
                    <label>Corporate Department</label>
                    <input type="text" name="role" required placeholder="e.g. Threat Intelligence">
                  </div>
                  <div class="form-group">
                    <label>Monthly Salary Contract ($)</label>
                    <input type="text" name="salary" required placeholder="e.g. 9500">
                  </div>
                  <div class="form-group">
                    <label>Upload Signed Contract (R2 Storage Asset)</label>
                    <input type="file" name="contract" required>
                  </div>
                  <button type="submit">Execute Onboarding Write</button>
                </form>
              </div>

              <div class="box" style="flex: 1.5;">
                <h3 style="margin-bottom:15px; color:#c084fc;">Structured Personnel Ledger (D1 Relational)</h3>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Salary</th>
                      <th>Document (R2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${employees.map(e => `
                      <tr>
                        <td>${e.id}</td>
                        <td><strong>${e.name}</strong></td>
                        <td>${e.role}</td>
                        <td>$${e.salary}</td>
                        <td style="color:#a855f7; font-size:11px;">📎 ${e.doc_name.substring(0,20)}...</td>
                      </tr>
                    `).join('')}
                    ${employees.length === 0 ? '<tr><td colspan="5" style="color:#64748b; text-align:center;">No records stored in D1 database yet.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </body>
        </html>
      `, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // 📱 Default Fallback Route: Renders the Core Employee Dashboard Panel
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AcmeHR Portal</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; background: #0b071a; color: #f8fafc; display: flex; height: 100vh; overflow: hidden; }
          .sidebar { width: 260px; background: #120d26; border-right: 1px solid #2e1a4d; padding: 25px; display: flex; flex-direction: column; gap: 30px; }
          .logo { font-size: 22px; font-weight: 800; color: #a855f7; }
          .nav-links { display: flex; flex-direction: column; gap: 10px; list-style: none; }
          .nav-item { padding: 12px 16px; border-radius: 8px; color: #94a3b8; text-decoration: none; font-weight: 500; display: block; }
          .nav-item.active { background: #241942; color: #f8fafc; }
          .nav-item.admin-btn { border: 1px dashed #a855f7; color: #c084fc; margin-top: 20px; text-align: center; }
          .nav-item.admin-btn:hover { background: #a855f7; color: white; }
          .main-content { flex-grow: 1; padding: 40px; display: flex; flex-direction: column; gap: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
          .card { background: #130e29; border: 1px solid #231842; border-radius: 12px; padding: 20px; }
          .card-title { color: #64748b; font-size: 13px; text-transform: uppercase; margin-bottom: 8px; }
          .card-value { font-size: 24px; font-weight: 700; }
          .ai-panel { width: 400px; background: #0f0a22; border-left: 1px solid #2e1a4d; display: flex; flex-direction: column; }
          .ai-header { padding: 25px; border-bottom: 1px solid #2e1a4d; background: #140e2e; }
          #chat-box { flex-grow: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; font-size: 14px; }
          .input-container { padding: 25px; background: #140e2e; display: flex; gap: 10px; }
          input { flex-grow: 1; padding: 14px; border-radius: 8px; border: 1px solid #4c1d95; background: #090514; color: white; }
          button { padding: 14px 20px; background: #a855f7; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; }
          .error-banner { color: #f87171; background: #450a0a; border: 1px solid #991b1b; padding: 15px; border-radius: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="sidebar">
          <div class="logo">🔮 AcmeHR</div>
          <ul class="nav-links">
            <li><a href="#" class="nav-item active">📊 Dashboard</a></li>
            <li><a href="https://admin.hr.kobimaceda.com" class="nav-item admin-btn">🔒 Admin Console</a></li>
          </ul>
        </div>
        <div class="main-content">
          <h1>Welcome Back, Kobi</h1>
          <p style="color:#64748b;">SaaS Portal: <code>hr.kobimaceda.com</code></p>
          <div class="stats-grid">
            <div class="card"><div class="card-title">Next Payroll Date</div><div class="card-value">May 30, 2026</div></div>
            <div class="card"><div class="card-title">Storage Encrypted</div><div class="card-value">R2 Vault Online</div></div>
          </div>
        </div>
        <div class="ai-panel">
          <div class="ai-header"><h3>🤖 AskHR AI Copilot</h3></div>
          <div id="chat-box"><span>🤖 Type an employee's financial file data containing a credit card pattern to test the dashboard DLP Guardrails.</span></div>
          <div class="input-container">
            <input type="text" id="question" placeholder="Ask a question..." onkeydown="if(event.key==='Enter') askAI()">
            <button onclick="askAI()">Send</button>
          </div>
        </div>
        <script>
          async function askAI() {
            const input = document.getElementById('question');
            const q = input.value.trim();
            const box = document.getElementById('chat-box');
            if(!q) return;
            box.innerHTML += '<div style="color:#c084fc; text-align:right;"><strong>You:</strong> ' + q + '</div>';
            input.value = '';
            try {
              const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) });
              const data = await res.json();
              if(res.ok && data.response) { box.innerHTML += '<div style="background:#181333; padding:12px; border-radius:8px;">' + data.response + '</div>'; }
              else if (data.error) { box.innerHTML += '<div class="error-banner">🔴 SECURITY VIOLATION<br><br>' + data.error + '</div>'; }
            } catch(e) {}
            box.scrollTop = box.scrollHeight;
          }
        </script>
      </body>
      </html>
    `, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
