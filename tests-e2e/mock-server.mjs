// A tiny stand-in for a Salesforce org, used only for self-contained E2E tests.
// It implements just enough of the login + page + upload surface to exercise
// the real framework helpers without needing a live org or the Salesforce CLI.
import http from 'node:http';

const PORT = Number(process.env.MOCK_ORG_PORT ?? 8787);

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Mock Org</title></head><body>${body}</body></html>`;
}

const uploadPage = html(`
  <h1>Upload</h1>
  <lightning-file-upload>
    <input type="file" id="lfu" accept="application/pdf" style="display:none" />
  </lightning-file-upload>
  <button id="btn" type="button">Upload Files</button>
  <div id="status">no file</div>
  <script>
    document.getElementById('btn').addEventListener('click', function () {
      document.getElementById('lfu').click();
    });
    document.getElementById('lfu').addEventListener('change', function (e) {
      var f = e.target.files[0];
      document.getElementById('status').textContent = f ? ('uploaded: ' + f.name) : 'no file';
    });
  </script>
`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // Health check for Playwright's webServer readiness probe.
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  // Salesforce "frontdoor" login: exchange a session id for an authenticated
  // browser session, then redirect to the requested return URL.
  if (url.pathname === '/secur/frontdoor.jsp') {
    const sid = url.searchParams.get('sid');
    if (!sid) {
      res.writeHead(401, { 'content-type': 'text/plain' });
      return res.end('missing sid');
    }
    const retURL = url.searchParams.get('retURL') || '/lightning/page/home';
    res.writeHead(302, {
      'set-cookie': `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly`,
      location: retURL,
    });
    return res.end();
  }

  // Any authenticated page requires the session cookie set by frontdoor.
  const authed = (req.headers.cookie || '').includes('sid=');
  if (!authed) {
    res.writeHead(302, { location: '/secur/login' });
    return res.end();
  }

  if (url.pathname === '/lightning/page/home') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html('<h1>Home</h1><p>Authenticated mock org home page.</p>'));
  }

  if (url.pathname === '/lightning/upload') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(uploadPage);
  }

  res.writeHead(404, { 'content-type': 'text/html' });
  res.end(html('<h1>Not found</h1>'));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-org] listening on http://127.0.0.1:${PORT}`);
});
