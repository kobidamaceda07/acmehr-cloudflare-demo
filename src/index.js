export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✨ DYNAMIC RESOLVER: Automatically calculates the base corporate domain rule context
    // If visiting admin.kobitan.work or hr.kobimaceda.com, it cleanly isolates 'kobitan.work' or 'kobimaceda.com'
    const baseDomain = url.hostname.replace("admin.", "").replace("hr.", "");

    // 1. AUTO-INITIALIZE D1 LEDGER SCHEMA
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT, email TEXT, gov_id TEXT, status TEXT, doc_name TEXT
        )
      `).run();
    } catch(e) {}

    // 2. AI CHATBOT ROUTE CHANNEL
    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const { question } = await request.json();
        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct-awq", {
          messages: [
            { role: "system", content: "You are AskHR, a warm and concise assistant. Limit to 2 sentences." },
            { role: "user", content: question }
          ]
        }, { gateway: { id: "askhr" } });

        return new Response(JSON.stringify({ response: aiResponse.response }), { headers: { "content-type": "application/json" } });
      } catch (err) {
        let uErr = err.message;
        if (err.message.includes("DLP policy violations") || err.message.includes("2030")) {
          uErr = "Compliance Guardrail Triggered: Sensitive Data Pattern Detected. Request dropped at edge network tier.";
        }
        return new Response(JSON.stringify({ error: uErr, isDlp: true }), { status: 429 });
      }
    }

    // 3. DATABASE + STORAGE WRITE ONBOARDING ROUTE
    if (request.method === "POST" && url.pathname === "/api/admin/onboard") {
      try {
        const formData = await request.formData();
        const name = formData.get("name");
        const role = formData.get("role");
        const email = formData.get("email");
        const gov_id = formData.get("gov_id");
        const file = formData.get("contract");
        let docName = "No contract verified";

        if (file && file.size > 0) {
          docName = `${Date.now()}-${file.name}`;
          await env.DOCS.put(docName, file.stream(), { headers: { "content-type": file.type } });
        }

        await env.DB.prepare("INSERT INTO employees (name, role, email, gov_id, status, doc_name) VALUES (?, ?, ?, ?, 'Active', ?)")
          .bind(name, role, email, gov_id, docName).run();

        return new Response(null, { status: 302, headers: { "Location": "/?view=admin" } });
      } catch (err) { return new Response("DB Error: " + err.message, { status: 500 }); }
    }
    
    // 4. READ ALL RECORDS FROM D1
    let liveDbEmployees = [];
    try {
      const { results } = await env.DB.prepare("SELECT * FROM employees ORDER BY id DESC").all();
      liveDbEmployees = results || [];
    } catch(e) {}

    // 5. INTERACTIVE CONDITIONAL UI INJECTION RENDERER
    // Automatically flips views depending on if 'admin.' is present in the browser string prefix
    const isAdminRoutingPath = url.hostname.startsWith("admin.");

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AcmeHR Portal</title>
        <meta charset="UTF-8">
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0b0d12; color: #e8ecf4; font-family: 'IBM Plex Sans', sans-serif; }
          .acme { --bg:#0b0d12; --bg2:#11141c; --panel:#161a24; --panel2:#1c2230; --line:#262d3d; --line2:#323b50; --ink:#e8ecf4; --muted:#8a93a8; --faint:#5d6478; --cf:#f6821f; --cf2:#fbad41; --cyan:#38bdf8; --green:#34d399; --red:#f97066; --violet:#a78bfa; min-height:100vh; background: radial-gradient(900px 500px at 85% -10%, rgba(246,130,31,.10), transparent 60%), radial-gradient(700px 500px at 5% 110%, rgba(56,189,248,.07), transparent 55%), #0b0d12; }
          .disp { font-family:'Bricolage Grotesque',sans-serif; letter-spacing:-.5px; }
          .mono { font-family:'JetBrains Mono',monospace; }
          .top { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid var(--line); background:rgba(11,13,18,.7); backdrop-filter:blur(10px); }
          .shell { display:grid; grid-template-columns:248px 1fr; }
          .side { border-right:1px solid var(--line); padding:18px 14px; min-height:calc(100vh - 63px); }
          .main { padding:26px 30px 60px; max-width:1180px; }
          .logo { display:flex; align-items:center; gap:11px; }
          .logomark { width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:linear-gradient(135deg,var(--cf),var(--cf2)); color:#1a1205; font-weight:bold; }
          .badge { display:inline-flex; align-items:center; gap:7px; font-size:12px; padding:6px 11px; border-radius:999px; border:1px solid var(--line2); color:var(--muted); background:var(--panel); }
          .dot { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 0 3px rgba(52,211,153,.18); }
          .navhead { font-size:10.5px; text-transform:uppercase; letter-spacing:2px; color:var(--faint); margin:16px 8px 7px; }
          .nav { display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:9px 11px; border-radius:10px; border:1px solid transparent; color:var(--muted); background:none; cursor:pointer; font-size:13.5px; transition:.16s; }
          .nav:hover { color:var(--ink); background:var(--panel); }
          .nav.on { color:var(--ink); background:var(--panel2); border-color:var(--line2); }
          .card { background:linear-gradient(180deg,var(--panel),var(--bg2)); border:1px solid var(--line); border-radius:16px; margin-bottom:20px; }
          .pad { padding:18px 20px; }
          .kpi { display:flex; flex-direction:column; gap:6px; }
          .kpi .v { font-size:30px; line-height:1; }
          .kpi .l { font-size:12px; color:var(--muted); }
          .grid { display:grid; gap:16px; }
          .g3 { grid-template-columns:repeat(3,1fr); } .g4 { grid-template-columns:repeat(4,1fr); }
          .sub { color:var(--muted); font-size:13.5px; margin-bottom:22px; margin-top:4px; }
          .chip { display:inline-flex; align-items:center; gap:6px; font-size:11px; padding:4px 9px; border-radius:7px; border:1px solid var(--line2); color:var(--cf2); background:rgba(246,130,31,.08); }
          .chip.cy { color:var(--cyan); border-color:rgba(56,189,248,.3); background:rgba(56,189,248,.07); }
          .callout { display:flex; gap:9px; align-items:flex-start; font-size:12px; color:var(--cf2); border:1px dashed rgba(246,130,31,.45); background:rgba(246,130,31,.06); padding:9px 12px; border-radius:11px; margin-top:14px; }
          table { width:100%; border-collapse:collapse; font-size:13px; }
          th { text-align:left; color:var(--faint); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:1px; padding:11px 14px; border-bottom:1px solid var(--line); }
          td { padding:12px 14px; border-bottom:1px solid var(--line); color:var(--ink); }
          .btn { display:inline-flex; align-items:center; gap:8px; padding:10px 16px; border-radius:11px; border:1px solid var(--line2); background:var(--panel2); color:var(--ink); cursor:pointer; font-size:13.5px; }
          .btn.primary { background:linear-gradient(135deg,var(--cf),var(--cf2)); border:0; color:#1a1205; font-weight:600; }
          .tog { display:flex; align-items:center; gap:10px; font-size:13px; }
          .sw { width:38px; height:22px; border-radius:999px; background:var(--line2); position:relative; cursor:pointer; }
          .sw.on { background:linear-gradient(135deg,var(--cf),var(--cf2)); }
          .sw b { position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; transition:.18s; }
          .sw.on b { left:19px; }
          .chatwrap { display:grid; grid-template-columns:1fr 360px; gap:16px; }
          .stream { height:400px; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:14px; border-bottom:1px solid var(--line); }
          .msg { max-width:82%; padding:11px 14px; border-radius:14px; font-size:13.5px; line-height:1.5; }
          .me { align-self:flex-end; background:var(--panel2); border:1px solid var(--line2); border-bottom-right-radius:4px; }
          .ai { align-self:flex-start; background:rgba(56,189,248,.07); border:1px solid rgba(56,189,248,.22); border-bottom-left-radius:4px; }
          .block { align-self:flex-start; max-width:90%; border:1px solid rgba(249,112,102,.4); background:rgba(249,112,102,.08); border-radius:14px; padding:13px 15px; }
          .composer { display:flex; gap:9px; padding:14px; }
          .composer input { flex:1; background:var(--bg); border:1px solid var(--line2); color:var(--ink); border-radius:11px; padding:11px 14px; outline:none; }
          .log { height:460px; overflow-y:auto; font-size:11.5px; }
          .logrow { padding:10px 13px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:3px; }
          .logrow .top2 { display:flex; align-items:center; justify-content:space-between; }
          .tag { font-size:9.5px; padding:2px 7px; border-radius:6px; font-weight:bold; }
          .t-ok { color:var(--green); background:rgba(52,211,153,.12); }
          .t-dlp { color:var(--cf2); background:rgba(246,130,31,.14); }
          .gate { min-height:60vh; display:grid; place-items:center; }
          .gatecard { width:100%; max-width:430px; text-align:center; padding:30px; }
          .gatemark { width:54px; height:54px; border-radius:14px; margin:0 auto 16px; display:grid; place-items:center; background:linear-gradient(135deg,var(--cf),var(--cf2)); color:#1a1205; }
          .gateinput { width:100%; background:var(--bg); border:1px solid var(--line2); color:var(--ink); border-radius:11px; padding:12px 14px; outline:none; margin-top:15px; }
          .deny { border:1px solid rgba(249,112,102,.4); background:rgba(249,112,102,.08); color:var(--red); border-radius:11px; padding:11px 14px; font-size:13px; margin-top:14px; }
          .form-group { margin-bottom:15px; display:flex; flex-direction:column; gap:6px; text-align:left; font-size:13px; }
          .form-group input { padding:11px; background:#090514; border:1px solid #4c1d95; color:white; border-radius:6px; }
          .pops { display:flex; flex-wrap:wrap; gap:7px; }
          .pop { width:9px; height:9px; border-radius:50%; background:var(--cyan); opacity:.4; }
          .bar { height:8px; border-radius:6px; background:var(--line2); overflow:hidden; margin-top:6px; }
          .bar i { display:block; height:100%; background:linear-gradient(90deg,var(--cf),var(--cf2)); }
        </style>
      </head>
      <body>
        <div id="root"></div>

        <script type="text/babel">
          const { useState, useEffect } = React;

          const BASE_DOMAIN_NAME = "${baseDomain}";
          const IS_ADMIN_URL = ${isAdminRoutingPath};
          const INITIAL_TAB = IS_ADMIN_URL ? "admin" : "dashboard";

          const MOCK_EMPLOYEES = [
            { name: "Maria Santos", role: "People Ops", email: "maria.santos@" + BASE_DOMAIN_NAME, gov_id: "•••-••-4821", status: "Active" },
            { name: "James Tan", role: "Engineering", email: "james.tan@" + BASE_DOMAIN_NAME, gov_id: "•••-••-1190", status: "Active" }
          ];

          const REAL_DB_RECORDS = ${JSON.stringify(liveDbEmployees)};

          function MainApplication() {
            const [view, setView] = useState(INITIAL_TAB);
            const [callouts, setCallouts] = useState(true);
            const [authed, setAuthed] = useState(!IS_ADMIN_URL);
            const [email, setEmail] = useState("");
            const [denied, setDenied] = useState(false);

            const [msgs, setMsgs] = useState([{ who: "ai", text: "Hi! I'm AskHR. Ask me about leave policy, benefits, or the payroll schedule." }]);
            const [input, setInput] = useState("");
            const [busy, setBusy] = useState(false);
            const [logs, setLogs] = useState([]);

            const [secEvents, setSecEvents] = useState([]);
            const [simulating, setSimulating] = useState(false);

            const addLog = (label, detail, model, tokens, cost, lat, tag) => {
              setLogs(l => [{ id: Math.random(), time: new Date().toLocaleTimeString([], { hour12: false }), label, detail, model, tokens, cost, lat, tag }, ...l]);
            };

            const triggerAttackSimulation = () => {
              if(simulating) return; setSimulating(true); setSecEvents([]);
              const attacks = [
                ["WAF", "SQLi Injection attempt detected on /api/login", "Block", "t-dlp"],
                ["Bot Engine", "Headless Scraper Client identified • score 4", "Block", "t-cache"],
                ["Rate Limiter", "IP Threshold exceeded: 41 requests/min", "Block 10m", "t-dlp"],
                ["DDoS Filter", "Layer 7 Request Flood absorbed at edge tier", "Mitigated", "t-ok"]
              ];
              attacks.forEach((atk, idx) => {
                setTimeout(() => {
                  setSecEvents(prev => [{ id: idx, type: atk[0], desc: atk[1], act: atk[2], tag: atk[3], t: new Date().toLocaleTimeString([], { hour12: false }) }, ...prev]);
                  if(idx === attacks.length - 1) setSimulating(false);
                }, 400 * (idx + 1));
              });
            };

            const handleAIGatewayCall = async () => {
              const q = input.trim(); if(!q || busy) return; setInput("");
              setMsgs(prev => [...prev, { who: "me", text: q }]); setBusy(true);
              const startTime = performance.now();

              try {
                const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
                const data = await res.json();
                const latency = Math.round(performance.now() - startTime) + " ms";

                if (res.ok && data.response) {
                  setMsgs(prev => [...prev, { who: "ai", text: data.response }]);
                  addLog("OK • 200", "workers-ai → response success", "llama-3.1-8b", Math.round(data.response.length/4), "$0.0001", latency, "t-ok");
                } else {
                  setMsgs(prev => [...prev, { who: "block", text: data.error }]);
                  addLog("DLP • BLOCK", "Financial Identity Pattern Intercepted", "—", 0, "$0.0000", latency, "t-dlp");
                }
              } catch (e) {} finally { setBusy(false); }
            };

            const handleAccessVerify = () => {
              // ✨ DYNAMIC VALIDATION: Evaluates against whatever domain is currently active!
              if (email.trim().toLowerCase().endsWith("@" + BASE_DOMAIN_NAME)) {
                setAuthed(true); setDenied(false);
              } else { setDenied(true); }
            };

            return (
              <div className="acme">
                <div className="top">
                  <div className="logo">
                    <div className="logomark"><i data-lucide="cloud"></i></div>
                    <div>
                      <div className="disp" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1 }}>AcmeHR</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>People & Payroll Cloud</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="badge"><span className="dot" /> Controlled via Cloudflare Edge</span>
                    <button onClick={() => setCallouts(!callouts)} style={{ background: "none", border: 0, color: "var(--muted)", cursor: "pointer", display:"flex", alignItems:"center", gap:5 }}>
                      <i data-lucide={callouts ? "eye" : "eye-off"} style={{width:14}}></i> <span style={{ fontSize: 12 }}>Demo Guides</span>
                    </button>
                  </div>
                </div>

                <div className="shell">
                  <nav className="side">
                    <div className="navhead">Build Tier</div>
                    <button className={"nav " + (view === "dashboard" ? "on" : "")} onClick={() => setView("dashboard")}><i data-lucide="layout-dashboard"></i> Dashboard</button>
                    <button className={"nav " + (view === "employees" ? "on" : "")} onClick={() => setView("employees")}><i data-lucide="users"></i> Employees</button>
                    <button className={"nav " + (view === "payroll" ? "on" : "")} onClick={() => setView("payroll")}><i data-lucide="wallet"></i> Payroll Runs</button>
                    <div className="navhead">Protect Tier</div>
                    <button className={"nav " + (view === "askhr" ? "on" : "")} onClick={() => setView("askhr")}><i data-lucide="bot"></i> AskHR Assistant</button>
                    <button className={"nav " + (view === "admin" ? "on" : "")} onClick={() => setView("admin")}><i data-lucide="lock"></i> Admin Console</button>
                    <button className={"nav " + (view === "security" ? "on" : "")} onClick={() => setView("security")}><i data-lucide="shield-check"></i> Security / WAF</button>
                    <div className="navhead">Scale Tier</div>
                    <button className={"nav " + (view === "perf" ? "on" : "")} onClick={() => setView("perf")}><i data-lucide="gauge"></i> Performance</button>
                  </nav>

                  <main className="main">
                    {view === "dashboard" && (
                      <div>
                        <h1 className="page disp">Welcome back, Kobi</h1>
                        <div className="sub">Serverless environment active over <code>hr.+BASE_DOMAIN_NAME</code></div>
                        <div className="grid g4">
                          <div className="card pad kpi"><i data-lucide="users" style={{color:"var(--cf2)"}}></i><span className="v disp">{REAL_DB_RECORDS.length + 2}</span><span className="l">Total Tracked Staff</span></div>
                          <div className="card pad kpi"><i data-lucide="wallet" style={{color:"var(--cf2)"}}></i><span className="v disp">₱4.82M</span><span className="l">Active Monthly Payroll</span></div>
                          <div className="card pad kpi"><i data-lucide="activity" style={{color:"var(--cf2)"}}></i><span className="v disp">99.99%</span><span className="l">Perimeter Uptime</span></div>
                          <div className="card pad kpi"><i data-lucide="zap" style={{color:"var(--cf2)"}}></i><span className="v disp">41 ms</span><span className="l">Edge Network Latency</span></div>
                        </div>
                      </div>
                    )}

                    {view === "employees" && (
                      <div>
                        <h1 className="page disp">Personnel Records</h1>
                        <div className="card">
                          <table>
                            <thead><tr><th>Name</th><th>Department</th><th>Email Address</th><th>Government Posture</th></tr></thead>
                            <tbody>
                              {REAL_DB_RECORDS.map((emp, idx) => (
                                <tr key={idx}><td><strong>{emp.name}</strong></td><td>{emp.role}</td><td class="mono">{emp.email}</td><td class="mono">{emp.gov_id}</td></tr>
                              ))}
                              {MOCK_EMPLOYEES.map((emp, idx) => (
                                <tr key={idx}><td>{emp.name}</td><td>{emp.role}</td><td class="mono">{emp.email}</td><td class="mono">{emp.gov_id}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {view === "payroll" && (
                      <div>
                        <h1 className="page disp">Financial Payroll Logs</h1>
                        <div className="card">
                          <table>
                            <thead><tr><th>Billing Period</th><th>Total Disbursed</th><th>Headcount Verified</th><th>Distribution</th></tr></thead>
                            <tbody>
                              <tr><td>May 2026</td><td class="mono">₱ 4,820,000</td><td>182</td><td>Bank Transfer Channel</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {view === "askhr" && (
                      <div>
                        <h1 className="page disp">AskHR Assistant Firewall Workspace</h1>
                        <div className="chatwrap">
                          <div className="card" style={{display:"flex", flexDirection:"column"}}>
                            <div className="stream">
                              {msgs.map((m, idx) => (
                                m.who === "block" ? (
                                  <div className="block" key={idx}>
                                    <div style={{display:"flex", alignItems:"center", gap:8, color:"var(--cf)", fontWeight:"bold"}}><i data-lucide="shield-alert" style={{width:16}}></i> Cloudflare AI Gateway Intercept</div>
                                    <div style={{fontSize:12.5, marginTop:6, color:"var(--muted)"}}>{m.text}</div>
                                  </div>
                                ) : (
                                  <div className={"msg " + (m.who === "me" ? "me" : "ai")} key={idx}>{m.text}</div>
                                )
                              ))}
                            </div>
                            <div className="composer">
                              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAIGatewayCall()} placeholder="Ask a question..." />
                              <button className="btn primary" onClick={handleAIGatewayCall}><i data-lucide="send" style={{width:14}}></i> Execute</button>
                            </div>
                          </div>
                          <div className="card" style={{display:"flex", flexDirection:"column"}}>
                            <div className="pad" style={{borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                              <div><div className="disp" style={{fontSize:14}}>Gateway Stream Log</div></div>
                            </div>
                            <div className="log">
                              {logs.map((lg, i) => (
                                <div className="logrow" key={i}>
                                  <div className="top2"><span className={"tag " + lg.tag}>{lg.label}</span></div>
                                  <div style={{color:"var(--muted)", margin:"2px 0"}}>{lg.detail}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {view === "admin" && (
                      !authed ? (
                        <div className="gate">
                          <div className="card pad gatecard">
                            <div className="gatemark"><i data-lucide="fingerprint"></i></div>
                            <div className="disp" style={{ fontSize: 20 }}>admin.{BASE_DOMAIN_NAME}</div>
                            <input className="gateinput" placeholder={"account@" + BASE_DOMAIN_NAME} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAccessVerify()} />
                            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={handleAccessVerify}>Verify Identity</button>
                            {denied && <div className="deny">Verification Drop. Rule binding mismatch.</div>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h1 className="page disp">Secure Enterprise Administrator Workspace</h1>
                          <div className="grid" style={{gridTemplateColumns: "1fr 1.5fr"}}>
                            <div className="card pad">
                              <form action="/api/admin/onboard" method="POST" enctype="multipart/form-data">
                                <div className="form-group"><label>Full Employee Name</label><input type="text" name="name" required /></div>
                                <div className="form-group"><label>Corporate Assignment Role</label><input type="text" name="role" required /></div>
                                <div className="form-group"><label>Corporate Registry Email</label><input type="email" name="email" required placeholder={"name@" + BASE_DOMAIN_NAME} /></div>
                                <div className="form-group"><label>Government Tracking Identifier</label><input type="text" name="gov_id" required /></div>
                                <div className="form-group"><label>Contract Upload Payload</label><input type="file" name="contract" required style={{border:"none", background:"none", padding:0}} /></div>
                                <button type="submit" className="btn primary" style={{width:"100%", justifyContent:"center"}}>Commit Secure Cloud Write</button>
                              </form>
                            </div>
                            <div className="card pad">
                              <table>
                                <thead><tr><th>ID</th><th>Personnel Name</th><th>Corporate Assignment</th></tr></thead>
                                <tbody>
                                  {REAL_DB_RECORDS.map((emp, index) => (
                                    <tr key={index}><td>{emp.id}</td><td><strong>{emp.name}</strong></td><td>{emp.role}</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {view === "security" && (
                      <div>
                        <h1 className="page disp">Security Event Analytics Dashboard</h1>
                        <div className="grid" style={{gridTemplateColumns:"1fr 1.3fr"}}>
                          <div className="card pad">
                            <button className="btn primary" style={{width:"100%", justifyContent:"center"}} onClick={triggerAttackSimulation} disabled={simulating}>Simulate Perimeter Attack</button>
                          </div>
                          <div className="card" style={{display:"flex", flexDirection:"column"}}>
                            <div style={{height:300, overflowY:"auto"}}>
                              {secEvents.map((evt, i) => (
                                <div className="logrow" key={i}>
                                  <div className="top2"><span className={"tag " + evt.tag}>{evt.type}</span></div>
                                  <div style={{fontSize:12, color:"var(--muted)"}}>{evt.desc}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {view === "perf" && (
                      <div><h1 className="page disp">Performance & Telemetry</h1></div>
                    )}

                  </main>
                </div>
              </div>
            );
          }

          ReactDOM.createRoot(document.getElementById('root')).render(<MainApplication />);
          setTimeout(() => { if(window.lucide) window.lucide.createIcons(); }, 200);
        </script>
      </body>
      </html>
    `, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
