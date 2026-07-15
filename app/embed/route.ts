const EMBED_CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors *",
].join("; ");

function embedHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reasoning Across Borders</title>
  <style>
    :root{color-scheme:light;--ink:#152238;--paper:#fbfaf4;--blue:#6f7edb;--mint:#dcefe3;--coral:#f3a38f;--line:#152238}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:transparent;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}
    body{padding:4px}
    .card{min-height:212px;border:1.5px solid var(--line);border-radius:18px;background:var(--paper);box-shadow:5px 6px 0 rgba(21,34,56,.14);padding:20px;display:flex;flex-direction:column;gap:14px;overflow:hidden;position:relative}
    .card:after{content:"";position:absolute;width:92px;height:92px;border:18px solid var(--mint);border-radius:50%;right:-38px;top:-42px;z-index:0}
    header,.stats,.cta{position:relative;z-index:1}
    .eyebrow{display:block;color:#4b5bb7;font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;margin-bottom:6px}
    h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(22px,7vw,31px);line-height:1.02;margin:0;max-width:340px}
    p{font-size:12.5px;line-height:1.45;margin:6px 0 0;max-width:360px;color:#465269}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--line);gap:1px}
    .stats div{background:white;padding:9px 10px;min-width:0}
    .stats b{font-family:Georgia,serif;font-size:20px;display:block}
    .stats span{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#667087}
    .cta{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:auto}
    .cta small{font-size:10px;color:#697389}.cta a{display:inline-flex;align-items:center;justify-content:center;background:var(--coral);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}
    @media(max-width:330px){.card{padding:16px}.stats div{padding:8px 6px}.cta small{display:none}}
  </style>
</head>
<body>
  <main class="card">
    <header>
      <span class="eyebrow">Public model evaluation</span>
      <h1>Reasoning Across Borders</h1>
      <p>Test whether the same consumer AI behaves differently across regions.</p>
    </header>
    <section class="stats" aria-label="Live project statistics">
      <div><b id="submissions">—</b><span>Runs</span></div>
      <div><b id="cities">—</b><span>Cities</span></div>
      <div><b id="models">—</b><span>Models</span></div>
    </section>
    <footer class="cta"><small>Anonymous · aggregate results only</small><a href="/" target="_blank" rel="noopener noreferrer">Contribute →</a></footer>
  </main>
  <script>
    fetch('/api/stats').then(function(response){if(!response.ok)throw new Error('stats');return response.json()}).then(function(data){['submissions','cities','models'].forEach(function(key){document.getElementById(key).textContent=Number(data[key]||0).toLocaleString()})}).catch(function(){});
  </script>
</body>
</html>`;
}

export function GET() {
  return new Response(embedHtml(), {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=300",
      "content-security-policy": EMBED_CSP,
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}
