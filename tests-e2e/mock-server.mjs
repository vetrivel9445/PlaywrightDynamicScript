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

// "New record" form for any object (mirrors the Lightning field types the
// RecordForm component auto-detects: text, textarea, select, checkbox).
function newRecordPage(objectApiName) {
  return html(`
  <h1>New ${objectApiName}</h1>
  <form>
    <div><label for="f-name">Name</label><input id="f-name" /></div>
    <div><label for="f-desc">Description</label><textarea id="f-desc"></textarea></div>
    <div><label for="f-stage">Stage</label>
      <select id="f-stage"><option>Draft</option><option>Open</option><option>Closed</option></select>
    </div>
    <div><label for="f-active">Active</label><input id="f-active" type="checkbox" /></div>
    <div id="f-error" class="slds-has-error" role="alert" hidden>Name is required</div>
    <button type="button" id="save">Save</button>
  </form>
  <script>
    document.getElementById('save').addEventListener('click', function () {
      var name = document.getElementById('f-name').value;
      if (!name) {
        document.getElementById('f-error').hidden = false;
        return;
      }
      var stage = document.getElementById('f-stage').value;
      var active = document.getElementById('f-active').checked;
      var qs = new URLSearchParams({ name: name, stage: stage, active: String(active) });
      window.location.href = '/lightning/r/${objectApiName}/a01000000000001AAA/view?' + qs;
    });
  </script>`);
}

// Record view page shown after save, including the standard success toast.
function recordViewPage(objectApiName, recordId, params) {
  const name = params.get('name') ?? 'record';
  return html(`
  <div class="slds-notify_toast" data-toast>${objectApiName} "${name}" was created.</div>
  <h1>${name}</h1>
  <dl>
    <dt>Object</dt><dd id="obj">${objectApiName}</dd>
    <dt>Id</dt><dd id="rid">${recordId}</dd>
    <dt>Stage</dt><dd id="stage">${params.get('stage') ?? ''}</dd>
    <dt>Active</dt><dd id="active">${params.get('active') ?? ''}</dd>
  </dl>`);
}

// Home page with an App Launcher and a briefly-visible SLDS spinner, mirroring
// the Lightning behaviors the lightning.ts helpers handle.
const homePage = html(`
  <div class="slds-spinner" id="spin" role="status">Loading…</div>
  <button aria-label="App Launcher" title="App Launcher">☰</button>
  <div id="al-panel" hidden>
    <input placeholder="Search apps and items..." id="al-search" />
    <ul id="al-items">
      <li><a href="/lightning/o/Account/list">Accounts</a></li>
      <li><a href="/lightning/o/Contact/list">Contacts</a></li>
      <li><a href="/lightning/o/Invoice__c/list">Invoices</a></li>
    </ul>
  </div>
  <h1>Home</h1><p>Authenticated mock org home page.</p>
  <script>
    setTimeout(function () { document.getElementById('spin').style.display = 'none'; }, 400);
    document.querySelector('[title="App Launcher"]').addEventListener('click', function () {
      document.getElementById('al-panel').hidden = false;
    });
    document.getElementById('al-search').addEventListener('input', function (e) {
      var q = e.target.value.toLowerCase();
      document.querySelectorAll('#al-items li').forEach(function (li) {
        li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  </script>`);

// In-memory record store backing the mock REST API (sfApi.ts helper).
const apiRecords = new Map(); // id -> { objectApiName, fields }
let apiCounter = 0;

function handleRestApi(req, res, url) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (token !== 'MOCK_SID_TOKEN_E2E') {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ errorCode: 'INVALID_SESSION_ID' }]));
    return true;
  }

  const create = url.pathname.match(/^\/services\/data\/v[\d.]+\/sobjects\/([^/]+)\/?$/);
  if (create && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const id = `a01${String(++apiCounter).padStart(12, '0')}AAA`;
      apiRecords.set(id, { objectApiName: create[1], fields: JSON.parse(body || '{}') });
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id, success: true, errors: [] }));
    });
    return true;
  }

  if (url.pathname.match(/^\/services\/data\/v[\d.]+\/query$/) && req.method === 'GET') {
    const soql = url.searchParams.get('q') ?? '';
    const from = soql.match(/FROM\s+(\w+)/i)?.[1];
    const records = [...apiRecords.entries()]
      .filter(([, r]) => r.objectApiName === from)
      .map(([id, r]) => ({ Id: id, ...r.fields }));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ totalSize: records.length, done: true, records }));
    return true;
  }

  const del = url.pathname.match(/^\/services\/data\/v[\d.]+\/sobjects\/([^/]+)\/([^/]+)$/);
  if (del && req.method === 'DELETE') {
    apiRecords.delete(del[2]);
    res.writeHead(204);
    res.end();
    return true;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify([{ errorCode: 'NOT_FOUND' }]));
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // Health check for Playwright's webServer readiness probe.
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  // REST API (Bearer-token auth, like the real Salesforce API).
  if (url.pathname.startsWith('/services/data/')) {
    return void handleRestApi(req, res, url);
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

  if (url.pathname === '/secur/login') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html('<h1>Login</h1><p>Session required.</p>'));
  }

  // Any authenticated page requires the session cookie set by frontdoor.
  const authed = (req.headers.cookie || '').includes('sid=');
  if (!authed) {
    res.writeHead(302, { location: '/secur/login' });
    return res.end();
  }

  if (url.pathname === '/lightning/page/home') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(homePage);
  }

  // Dynamic object list pages: /lightning/o/<ObjectApiName>/list
  const listMatch = url.pathname.match(/^\/lightning\/o\/([^/]+)\/list$/);
  if (listMatch) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html(`<h1>${listMatch[1]} List</h1>`));
  }

  if (url.pathname === '/lightning/upload') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(uploadPage);
  }

  // Dynamic "new record" form: /lightning/o/<ObjectApiName>/new
  const newMatch = url.pathname.match(/^\/lightning\/o\/([^/]+)\/new$/);
  if (newMatch) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(newRecordPage(newMatch[1]));
  }

  // Dynamic record view: /lightning/r/<ObjectApiName>/<id>/view
  const viewMatch = url.pathname.match(/^\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})\/view$/);
  if (viewMatch) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(recordViewPage(viewMatch[1], viewMatch[2], url.searchParams));
  }

  res.writeHead(404, { 'content-type': 'text/html' });
  res.end(html('<h1>Not found</h1>'));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-org] listening on http://127.0.0.1:${PORT}`);
});
