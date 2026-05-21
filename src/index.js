export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✨ DYNAMIC MULTI-TENANT IDENTITY RESOLVER
    const baseDomain = url.hostname.replace("admin.", "").replace("hr.", "");

    // 1. AUTO-INITIALIZE D1 SCHEMA
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT, email TEXT, gov_id TEXT, status TEXT, doc_name TEXT
        )
      `).run();
    } catch(e) {}

    // 2. AI CHATBOT ROUTE CHANNEL (AI Gateway Proxy)
    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const { question } = await request.json();
        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct-awq", {
          messages: [
            { role: "system", content: "You are AskHR, a warm and concise assistant. Limit answers to 2 sentences max." },
            { role: "user", content: question }
          ]
        }, { gateway: { id: "askhr" } });

        return new Response(JSON.stringify({ response: aiResponse.response }), { headers: { "content-type": "application/json" } });
      } catch (err) {
        let uErr = err.message;
        if (err.message.includes("DLP policy violations") || err.message.includes("2030")) {
          uErr = "Compliance Guardrail Triggered: Sensitive Financial / PII Data pattern detected. Inference request blocked at edge network tier.";
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
    
    // 4. READ RECORDS OUT OF D1
    let liveDbEmployees = [];
    try {
      const { results } = await env.DB.prepare("SELECT * FROM employees ORDER BY id DESC").all();
      liveDbEmployees = results || [];
    } catch(e) {}

    const isAdminRoutingPath = url.hostname.startsWith("admin.");

    // 5. MASTER INTEGRATED FRONTEND INJECTION
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AcmeHR - People & Payroll Cloud</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0b0d12; color: #e8ecf4; font-family: 'IBM Plex Sans', sans-serif; }
          
          .acme {
            --bg:#0b0d12; --bg2:#11141c; --panel:#161a24; --panel2:#1c2230; --line:#262d3d; --line2:#323b50;
            --ink:#e8ecf4; --muted:#8a93a8; --faint:#5d6478; --cf:#f6821f; --cf2:#fbad41; --cyan:#38bdf8; --green:#34d399; --red:#f97066; --violet:#a78bfa;
            min-height:100vh;
            background: radial-gradient(900px 500px at 85% -10%, rgba(246,130,31,.10), transparent 60%), radial-gradient(700px 500px at 5% 110%, rgba(56,189,248,.07), transparent 55%), #0b0d12;
          }
          .disp { font-family:'Bricolage Grotesque',sans-serif; letter-spacing:-.5px; }
          .mono { font-family:'JetBrains Mono',monospace; }
          .top { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid var(--line); background:rgba(11,13,18,.7); backdrop-filter:blur(10px); position:sticky; top:0; z-index:10; }
          .shell { display:grid; grid-template-columns:248px 1fr; }
          .side { border-right:1px solid var(--line); padding:18px 14px; min-height:calc(100vh - 63px); }
          .main { padding:26px 30px 60px; max-width:1180px; width:100%; }
          .logo { display:flex; align-items:center; gap:11px; }
          .logomark { width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:linear-gradient(135deg,var(--cf),var(--cf2)); color:#1a1205; font-weight:bold; }
          .badge { display:inline-flex; align-items:center; gap:7px; font-size:12px; padding:6px 11px; border-radius:999px; border:1px solid var(--line2); color:var(--muted); background:var(--panel); }
          .dot { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 0 3px rgba(52,211,153,.18); }
          .navhead { font-size:10.5px; text-transform:uppercase; letter-spacing:2px; color:var(--faint); margin:16px 8px 7px; }
          .nav { display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:9px 11px; border-radius:10px; border:1px solid transparent; color:var(--muted); background:none; cursor:pointer; font-size:13.5px; transition:.16s; }
          .nav:hover { color:var(--ink); background:var(--panel); }
          .nav.on { color:var(--ink); background:var(--panel2); border-color:var(--line2); }
          .card { background:linear-gradient(180deg,var(--panel),var(--bg2)); border:1px solid var(--line); border-radius:16px; margin-bottom:20px; overflow:hidden; }
          .pad { padding:18px 20px; }
          .kpi { display:flex; flex-direction:column; gap:6px; }
          .kpi .v { font-size:30px; line-height:1; color: var(--ink); }
          .kpi .l { font-size:12px; color:var(--muted); }
          .grid { display:grid; gap:16px; }
          .g3 { grid-template-columns:repeat(3,1fr); } 
          .g4 { grid-template-columns:repeat(4,1fr); }
          .sub { color:var(--muted); font-size:13.5px; margin-bottom:22px; margin-top:4px; }
          .chip { display:inline-flex; align-items:center; gap:6px; font-size:11px; padding:4px 9px; border-radius:7px; border:1px solid var(--line2); color:var(--cf2); background:rgba(246,130,31,.08); }
          .chip.cy { color:var(--cyan); border-color:rgba(56,189,248,.3); background:rgba(56,189,248,.07); }
          .callout { display:flex; gap:9px; align-items:flex-start; font-size:12px; color:var(--cf2); border:1px dashed rgba(246,130,31,.45); background:rgba(246,130,31,.06); padding:9px 12px; border-radius:11px; margin-top:14px; }
          table { width:100%; border-collapse:collapse; font-size:13px; }
          th { text-align:left; color:var(--faint); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:1px; padding:11px 14px; border-bottom:1px solid var(--line); }
          td { padding:12px 14px; border-bottom:1px solid var(--line); color:var(--ink); }
          .btn { display:inline-flex; align-items:center; gap:8px; padding:10px 16px; border-radius:11px; border:1px solid var(--line2); background:var(--panel2); color:var(--ink); cursor:pointer; font-size:13.5px; font-weight:500; }
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
          .logrow { padding:10px 13px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:3px; text-align:left; }
          .logrow .top2 { display:flex; align-items:center; justify-content:space-between; margin-bottom:3px; }
          .tag { font-size:9.5px; padding:2px 7px; border-radius:6px; font-weight:bold; }
          .t-ok { color:var(--green); background:rgba(52,211,153,.12); }
          .t-dlp { color:var(--cf2); background:rgba(246,130,31,.14); }
          .t-cache { color:var(--cyan); background:rgba(56,189,248,.12); }
          .gate { min-height:60vh; display:grid; place-items:center; }
          .gatecard { width:100%; max-width:430px; text-align:center; padding:30px; }
          .gatemark { width:54px; height:54px; border-radius:14px; margin:0 auto 16px; display:grid; place-items:center; background:linear-gradient(135deg,var(--cf),var(--cf2)); color:#1a1205; }
          .gateinput { width:100%; background:var(--bg); border:1px solid var(--line2); color:var(--ink); border-radius:11px; padding:12px 14px; outline:none; margin-top:15px; }
          .deny { border:1px solid rgba(249,112,102,.4); background:rgba(249,112,102,.08); color:var(--red); border-radius:11px; padding:11px 14px; font-size:13px; margin-top:14px; }
          .form-group { margin-bottom:15px; display:flex; flex-direction:column; gap:6px; text-align:left; font-size:13px; }
          .form-group input { padding:11px; background:#090514; border:1px solid #4c1d95; color:white; border-radius:6px; }
          .pops { display:flex; flex-wrap:wrap; gap:8px; justify-content: center; padding: 10px 0; }
          .pop { width:10px; height:10px; border-radius:50%; background:var(--cyan); opacity:.4; box-shadow: 0 0 6px var(--cyan); }
          .bar { height:8px; border-radius:6px; background:var(--line2); overflow:hidden; margin-top:6px; width: 100%; }
          .bar i { display:block; height:100%; background:linear-gradient(90deg,var(--cf),var(--cf2)); border-radius:6px; }
        </style>
      </head>
      <body>
        <div id="root"></div>

        <script type="text/babel">
          const { useState, useEffect } = React;

          const BASE_DOMAIN_NAME = "${baseDomain}";
          const IS_ADMIN_URL = ${isAdminRoutingPath};
          const INITIAL_TAB = IS_ADMIN_URL ? "admin" : "dashboard";

          const REAL_DB_RECORDS = ${JSON.stringify(liveDbEmployees)};

          function MainApplication() {
            const [view, setView] = useState(INITIAL_TAB);
            const [callouts, setCallouts] = useState(true);
            
            const [authed, setAuthed] = useState(() => {
              if (!IS_ADMIN_URL) return true;
              return sessionStorage.getItem("acme_admin_authenticated") === "true";
            });
            
            const [email, setEmail] = useState("");
            const [denied, setDenied] = useState(false);

            const [msgs, setMsgs] = useState([{ who: "ai", text: "Hi! I'm AskHR. Ask me about leave policy, benefits, or the payroll schedule." }]);
            const [input, setInput] = useState("");
            const [busy, setBusy] = useState(false);
            const [logs, setLogs] = useState([]);

            const [secEvents, setSecEvents] = useState([]);
            const [simulating, setSimulating] = useState(false);

            const maskGovId = (id) => {
              if (!id) return "—";
              const str = id.toString().trim();
              if (str.length <= 1) return str;
              return "•".repeat(str.length - 1) + str.slice(-1);
            };

            const addLog = (label, detail, model, tokens, cost, lat, tag) => {
              setLogs(l => [{ id: Math.random(), time: new Date().toLocaleTimeString([], { hour12: false }), label, detail, model, tokens, cost, lat, tag }, ...l]);
            };

            const triggerAttackSimulation = () => {
              if(simulating) return; setSimulating(true); setSecEvents([]);
              const attacks = [
                ["WAF Engine", "SQLi Injection threat code pattern caught on /api/login", "Block Vector", "t-dlp"],
                ["Bot Controller", "Automated Headless Browser Scraper intercepted • score 4", "Drop Connect", "t-cache"],
                ["Rate Limiter", "IP Threshold request rate exceeded: 41 requests/min", "Block 10m", "t-dlp"],
                ["DDoS Layer 7", "Volumetric layer-7 flood stream absorbed at edge tier", "Mitigated", "t-ok"]
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
              if (email.trim().toLowerCase().endsWith("@" + BASE_DOMAIN_NAME)) {
                sessionStorage.setItem("acme_admin_authenticated", "true");
                setAuthed(true); 
                setDenied(false);
              } else { setDenied(true); }
            };

            return (
              <div className="acme">
                {/* HEAD BAR */}
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
                  {/* SIDE NAVIGATION */}
                  <nav className="side">
                    <div className="navhead">Build Tier</div>
                    <button className={"nav " + (view === "dashboard" ? "on" : "")} onClick={() => setView("dashboard")}><i data-lucide="layout-dashboard"></i> Dashboard</button>
                    <button className={"nav " + (view === "employees" ? "on" : "")} onClick={() => setView("employees")}><i data-lucide="users"></i> Employees</button>
                    <button className={"nav " + (view === "payroll" ? "on" : "")} onClick={() => setView("payroll")}><i data-lucide="wallet"></i> Payroll Runs</button>
                    <div className="navhead">Protect Tier</div>
                    <button className={"nav " + (view === "askhr" ? "on" : "")} onClick={() => setView("askhr")}><i data-lucide="bot"></i> AskHR Assistant</button>
                    
                    <button 
                      className={"nav " + (view === "admin" ? "on" : "")} 
                      onClick={() => {
                        if (!IS_ADMIN_URL) {
                          window.location.href = "https://admin." + BASE_DOMAIN_NAME;
                        } else {
                          setView("admin");
                        }
                      }}
                    >
                      <i data-lucide="lock"></i> Admin Console
                    </button>

                    <button className={"nav " + (view === "security" ? "on" : "")} onClick={() => setView("security")}><i data-lucide="shield-check"></i> Security / WAF</button>
                    <div className="navhead">Scale Tier</div>
                    <button className={"nav " + (view === "perf" ? "on" : "")} onClick={() => setView("perf")}><i data-lucide="gauge"></i> Performance</button>
                  </nav>

                  <main className="main">
                    
                    {/* VIEW: DASHBOARD */}
                    {view === "dashboard" && (
                      <div>
                        <h1 className="page disp">Welcome back, Kobi</h1>
                        <div className="sub">Serverless application environment processing live request streams across global edge networks.</div>
                        <div className="grid g4">
                          <div className="card pad kpi"><i data-lucide="users" style={{color:"var(--cf2)"}}></i><span className="v disp">{REAL_DB_RECORDS.length}</span><span className="l">Total Tracked Staff</span></div>
                          <div className="card pad kpi"><i data-lucide="wallet" style={{color:"var(--cf2)"}}></i><span className="v disp">₱4.82M</span><span className="l">Active Monthly Payroll</span></div>
                          <div className="card pad kpi"><i data-lucide="activity" style={{color:"var(--cf2)"}}></i><span className="v disp">99.99%</span><span className="l">Perimeter Uptime</span></div>
                          <div className="card pad kpi"><i data-lucide="zap" style={{color:"var(--cf2)"}}></i><span className="v disp">41 ms</span><span className="l">Edge Network Latency</span></div>
                        </div>
                        <div className="grid g3" style={{ marginTop: 16 }}>
                          <div className="card pad">
                            <i data-lucide="server" style={{color:"var(--cyan)"}}></i>
                            <div className="disp" style={{ fontSize: 16, marginTop: 9 }}>Cloudflare Workers</div>
                            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>Serverless UI & Ingestion routing engine.</div>
                            <span className="chip cy" style={{ marginTop: 11 }}>Active Route</span>
                          </div>
                          <div className="card pad">
                            <i data-lucide="database" style={{color:"var(--cyan)"}}></i>
                            <div className="disp" style={{ fontSize: 16, marginTop: 9 }}>D1 DB + R2 Vault</div>
                            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>Live Relational Ledger & Document Storage active.</div>
                            <span className="chip cy" style={{ marginTop: 11 }}>Connected</span>
                          </div>
                          <div className="card pad">
                            <i data-lucide="cpu" style={{color:"var(--cyan)"}}></i>
                            <div className="disp" style={{ fontSize: 16, marginTop: 9 }}>Workers AI Network</div>
                            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>Powers AskHR chatbot assistant natively.</div>
                            <span className="chip cy" style={{ marginTop: 11 }}>Hardware Provisioned</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW: EMPLOYEES */}
                    {view === "employees" && (
                      <div>
                        <h1 className="page disp">Personnel Records</h1>
                        <div className="sub">Static profile mappings augmented with live datasets queried from your Cloudflare D1 Relational SQL Database instance.</div>
                        <div className="card">
                          <table>
                            <thead><tr><th>Name</th><th>Department</th><th>Email Address</th><th>Government ID</th></tr></thead>
                            <tbody>
                              {REAL_DB_RECORDS.map((emp, idx) => (
                                <tr key={idx}>
                                  <td><strong>{emp.name}</strong></td>
                                  <td>{emp.role}</td>
                                  <td className="mono">{emp.email}</td>
                                  <td className="mono">{maskGovId(emp.gov_id)}</td>
                                </tr>
                              ))}
                              {REAL_DB_RECORDS.length === 0 && (
                                <tr><td colSpan="4" style={{textAlign:"center", color:"var(--faint)", padding:20}}>No items written to the database yet.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* VIEW: PAYROLL */}
                    {view === "payroll" && (
                      <div>
                        <h1 className="page disp">Financial Payroll Logs</h1>
                        <div className="sub">Confidential accounting data logs. Financial profile configurations safeguard these strings at the protocol tier.</div>
                        <div className="card">
                          <table>
                            <thead><tr><th>Billing Period</th><th>Total Disbursed</th><th>Headcount Verified</th><th>Distribution</th></tr></thead>
                            <tbody>
                              <tr><td>May 2026</td><td className="mono">₱ 4,820,000</td><td>182</td><td>Bank Transfer Channel</td></tr>
                              <tr><td>April 2026</td><td className="mono">₱ 4,710,500</td><td>180</td><td>Bank Transfer Channel</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* VIEW: ASKHR */}
                    {view === "askhr" && (
                      <div>
                        <h1 className="page disp">AskHR Assistant Firewall Workspace</h1>
                        <div className="sub">Live model telemetry channel proxying strings through your dashboard gateway configuration interface.</div>
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
                              {busy && <div className="msg ai mono" style={{fontSize:12, color:"var(--muted)"}}>Processing gateway telemetry rules...</div>}
                            </div>
                            <div className="composer">
                              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAIGatewayCall()} placeholder="Ask a question..." />
                              <button className="btn primary" onClick={handleAIGatewayCall}><i data-lucide="send" style={{width:14}}></i> Execute</button>
                            </div>
                          </div>
                          <div className="card" style={{display:"flex", flexDirection:"column"}}>
                            <div className="pad" style={{borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                              <div style={{textAlign:"left"}}><div className="disp" style={{fontSize:14}}>Gateway Stream Log</div><div className="mono" style={{fontSize:10, color:"var(--faint)"}}>askhr/live-telemetry</div></div>
                            </div>
                            <div className="log">
                              {logs.length === 0 && <div style={{padding:16, color:"var(--faint)", fontSize:12}}>Awaiting prompts... Live network inspection records will map inside this view panel real-time.</div>}
                              {logs.map((lg, i) => (
                                <div className="logrow" key={i}>
                                  <div className="top2"><span className={"tag " + lg.tag}>{lg.label}</span><span className="mono" style={{color:"var(--faint)"}}>{lg.time}</span></div>
                                  <div style={{color:"var(--muted)", margin:"2px 0"}}>{lg.detail}</div>
                                  <div className="mono" style={{color:"var(--faint)", fontSize:10}}>{lg.model} • {lg.tokens} Tok • {lg.lat}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW: ADMIN */}
                    {view === "admin" && (
                      !authed ? (
                        <div className="gate">
                          <div className="card pad gatecard">
                            <div className="gatemark"><i data-lucide="fingerprint"></i></div>
                            <div className="disp" style={{ fontSize: 20 }}>admin.{BASE_DOMAIN_NAME}</div>
                            <div style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 18px" }}>Protected by cryptographic execution boundaries. Verify account permission keys.</div>
                            <input className="gateinput" placeholder={"account@" + BASE_DOMAIN_NAME} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAccessVerify()} />
                            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={handleAccessVerify}>Verify Identity Key</button>
                            {denied && <div className="deny">Verification Drop. Rule binding mismatch.</div>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h1 className="page disp">Secure Enterprise Administrator Workspace</h1>
                          <div className="sub">Direct pipeline execution interfaces connected to your physical data storage systems.</div>
                          <div className="grid" style={{gridTemplateColumns: "1fr 1.5fr"}}>
                            <div className="card pad">
                              <h3 className="disp" style={{color:"var(--cf2)", marginBottom:15}}>Onboard Personnel</h3>
                              <form action="/api/admin/onboard" method="POST" enctype="multipart/form-data">
                                <div className="form-group"><label>Full Employee Name</label><input type="text" name="name" required placeholder="e.g. Sarah Connor" /></div>
                                <div className="form-group"><label>Corporate Assignment Role</label><input type="text" name="role" required placeholder="e.g. Threat Analyst" /></div>
                                <div className="form-group"><label>Corporate Registry Email</label><input type="email" name="email" required placeholder={"name@" + BASE_DOMAIN_NAME} /></div>
                                <div className="form-group"><label>Government ID</label><input type="text" name="gov_id" required placeholder="S1234567A" /></div>
                                <div className="form-group"><label>Contract Upload Payload (R2 Bucket)</label><input type="file" name="contract" required style={{border:"none", background:"none", padding:0}} /></div>
                                <button type="submit" className="btn primary" style={{width:"100%", justifyContent:"center"}}>Commit Secure Cloud Write</button>
                              </form>
                            </div>
                            <div className="card pad">
                              <h3 className="disp" style={{color:"var(--cf2)", marginBottom:15}}>Live Relational SQL DB Ledger (D1 Sync)</h3>
                              <table>
                                <thead><tr><th>ID</th><th>Personnel Name</th><th>Corporate Assignment</th><th>Object Storage Reference</th></tr></thead>
                                <tbody>
                                  {REAL_DB_RECORDS.map((emp, index) => (
                                    <tr key={index}>
                                      <td><span className="mono" style={{color:"var(--cyan)"}}>{emp.id}</span></td>
                                      {/* 🛠️ TYPO FIXED: Added missing '<' bracket to strong tag */}
                                      <td><strong>{emp.name}</strong></td>
                                      <td>{emp.role}</td>
                                      {/* 🛡️ SECURITY ADDED: Handled edge case where doc_name could be empty or null to prevent substring failure */}
                                      <td><span className="mono" style={{fontSize:11, color:"var(--cf2)"}}>📎 R2://{emp.doc_name ? emp.doc_name.substring(0,14) : "No-contract"}...</span></td>
                                    </tr>
                                  ))}
                                  {REAL_DB_RECORDS.length === 0 && (
                                    <tr><td colSpan="4" style={{textAlign:"center", color:"var(--faint)", padding:20}}>No items written to the D1 database yet. Submit the form to run a live write execution.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* VIEW: SECURITY */}
                    {view === "security" && (
                      <div>
                        <h1 className="page disp">Security Event Analytics Dashboard</h1>
                        <div className="sub">Front-door threat filtering metrics executed live across Layer 7 protocol filters.</div>
                        <div className="grid" style={{gridTemplateColumns:"1fr 1.3fr"}}>
                          
                          <div className="card pad" style={{textAlign:"left"}}>
                            <h3 className="disp" style={{marginBottom:15, color:"var(--cf2)"}}>Hardened Edge Base Policies</h3>
                            <div style={{display:"flex", flexDirection:"column", gap:10, fontSize:13, borderBottom:"1px solid var(--line)", paddingBottom:15, margin:"15px 0"}}>
                              <div>🟩 SSL/TLS Cryptographic Status: Full (Strict) Enforced</div>
                              <div>🟩 OWASP Core Vulnerability Signature Shielding Rulesets: ON</div>
                              <div>🟩 Brute Force Account Login Abuse Rate-Limiter: ACTIVE</div>
                              <div>🟩 Automated Perimeter Threat DDoS Mitigation Shield: ALWAYS-ON</div>
                            </div>
                            <button className="btn primary" style={{marginTop:15, width:"100%", justifyContent:"center"}} onClick={triggerAttackSimulation} disabled={simulating}>
                              <i data-lucide="alert-triangle" style={{width:14}}></i> {simulating ? "Analyzing attack vector data..." : "Simulate Perimeter Attack"}
                            </button>
                          </div>

                          <div className="card" style={{display:"flex", flexDirection:"column"}}>
                            <div className="pad" style={{borderBottom:"1px solid var(--line)", textAlign:"left"}}><div className="disp" style={{fontSize:14}}>Live WAF Intercept Telemetry Alerts</div></div>
                            <div style={{height:300, overflowY:"auto"}}>
                              {secEvents.length === 0 && <div style={{padding:20, color:"var(--faint)", fontSize:12.5, textAlign:"left"}}>Click the left button on stage to simulate and challenge the perimeter live threat filters.</div>}
                              {secEvents.map((evt, i) => (
                                <div className="logrow" key={i}>
                                  <div className="top2"><span className={"tag " + evt.tag}>{evt.type} • {evt.act}</span><span className="mono" style={{color:"var(--faint)"}}>{evt.t}</span></div>
                                  <div style={{fontSize:12, color:"var(--muted)"}}>{evt.desc}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* VIEW: PERFORMANCE */}
                    {view === "perf" && (
                      <div>
                        <h1 className="page disp">Performance, Telemetry & Spend Metrics</h1>
                        <div className="sub">Caching analytics proving massive acceleration data alongside database operations cost savings.</div>
                        <div className="grid g4">
                          <div className="card pad kpi"><i data-lucide="globe" style={{color:"var(--cyan)"}}></i><span className="v disp">317</span><span className="l">Global Anycast Cities</span></div>
                          <div className="card pad kpi"><i data-lucide="zap" style={{color:"var(--cyan)"}}></i><span className="v disp">94%</span><span className="l">Static Assets Cache Ratio</span></div>
                          <div className="card pad kpi"><i data-lucide="activity" style={{color:"var(--cyan)"}}></i><span className="v disp">6 ms</span><span className="l">Edge Caching Speed</span></div>
                          <div className="card pad kpi"><i data-lucide="cpu" style={{color:"var(--cyan)"}}></i><span className="v disp">38%</span><span className="l">Inference Spend Avoided</span></div>
                        </div>
                        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", marginTop:16}}>
                          
                          <div className="card pad">
                            <div className="disp" style={{fontSize:15, marginBottom:12, textAlign:"left"}}>Distributed Runtime Edge Mesh Nodes</div>
                            <div className="pops">
                              {Array.from({ length: 48 }).map((_, i) => <span className="pop" key={i} />)}
                            </div>
                            <p style={{fontSize:12, color: "var(--muted)", marginTop:15, textAlign:"left"}}>Workers execute logic directly inside border router memories worldwide. Intelligent path optimization steers dynamic infrastructure connections between nodes instantly.</p>
                          </div>

                          <div className="card pad" style={{textAlign:"left"}}>
                            <div className="disp" style={{fontSize:15, marginBottom:10}}>Edge Delivery Source Proportions</div>
                            <div style={{marginTop:12}}>
                              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4}}><span>Static File Delivery Cache Rules</span><span className="mono" style={{color:"var(--muted)"}}>94%</span></div>
                              <div className="bar"><i style={{width:"94%"}} /></div>
                            </div>
                            <div style={{marginTop:12}}>
                              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4}}><span>AI Gateway Semantic Query Caching</span><span className="mono" style={{color:"var(--muted)"}}>38%</span></div>
                              <div className="bar"><i style={{width:"38%"}} /></div>
                            </div>
                          </div>

                        </div>
                      </div>
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
