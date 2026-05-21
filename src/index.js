export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const { question } = await request.json();

        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct-awq", 
          {
            messages: [
              { role: "system", content: "You are Kobi's corporate assistant. Keep answers brief." },
              { role: "user", content: question }
            ]
          },
          { gateway: { id: "askhr" } }
        );

        return new Response(JSON.stringify({ response: aiResponse.response }), {
          headers: { "content-type": "application/json; charset=utf-8" }
        });

      } catch (err) {
        let userFriendlyError = err.message;
        if (err.message.includes("DLP policy violations") || err.message.includes("2030")) {
          userFriendlyError = "Compliance Guardrail Triggered: Sensitive Financial / PII Data pattern detected. Request blocked at edge network layer.";
        }
        return new Response(JSON.stringify({ error: userFriendlyError }), { status: 429 });
      }
    }

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AcmeHR Portal</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #090514; color: #f8fafc; padding: 40px; text-align: center; }
          #chat-box { width: 100%; max-width: 600px; background: #130e24; border: 1px solid #4c1d95; border-radius: 12px; margin: 30px auto; padding: 25px; text-align: left; min-height: 150px; line-height: 1.6; }
          .input-container { display: flex; max-width: 600px; margin: 0 auto; gap: 10px; }
          input { flex-grow: 1; padding: 14px; border-radius: 8px; border: 1px solid #4c1d95; background: #0f172a; color: white; font-size: 16px; }
          button { padding: 14px 28px; background: #a855f7; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold; font-size: 16px; }
          .error-banner { color: #f87171; background: #450a0a; border: 1px solid #991b1b; padding: 15px; border-radius: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🔮 AcmeHR SaaS Employee Portal 🔮</h1>
        <p>Domain Scope: <code>hr.kobimaceda.com</code></p>
        <div id="chat-box">🤖 Ask the "AskHR" Assistant a benefits question...</div>
        <div class="input-container">
          <input type="text" id="question" placeholder="Ask something..." onkeydown="if(event.key==='Enter') askAI()">
          <button onclick="askAI()">Ask AI</button>
        </div>
        <script>
          async function askAI() {
            const input = document.getElementById('question');
            const q = input.value.trim();
            const box = document.getElementById('chat-box');
            if(!q) return;
            box.innerHTML = '<span>Evaluating security filters...</span>';
            input.value = '';
            try {
              const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q })
              });
              const data = await res.json();
              if(res.ok && data.response) {
                box.innerHTML = '<strong>AskHR Response:</strong><br><br>' + data.response;
              } else if (data.error) {
                box.innerHTML = '<div class="error-banner">🔴 SECURITY POLICY INFRINGEMENT<br><br>' + data.error + '</div>';
              } else {
                box.innerHTML = '❌ Request dropped by edge filter.';
              }
            } catch(e) { box.innerHTML = '❌ Edge connection error.'; }
          }
        </script>
      </body>
      </html>
    `, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
