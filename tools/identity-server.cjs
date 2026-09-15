'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const identity = require('../js/identity.js');
const root = path.resolve(__dirname, '..');
const token = crypto.randomBytes(32).toString('hex');
function load(dataRoot = root) {
  const read = file => JSON.parse(fs.readFileSync(path.join(dataRoot, 'data', file), 'utf8'));
  const students = read('students.json'), results = read('results.json'), ledger = read('identity_events.json');
  const profiles = read('player_profiles.json'), achievements = read('player_achievements.json');
  // Revision covers the entire input snapshot, including external data edits.
  const revision = crypto.createHash('sha256').update(JSON.stringify({ students, results, ledger, profiles, achievements })).digest('hex');
  const view = identity.project(students, results, ledger);
  identity.metadata(view, profiles, achievements);
  return { students, results, ledger, revision, view, profiles, achievements };
}
function createServer({ dataRoot = root } = {}) {
  return http.createServer(async (req, res) => {
    const allowedHosts = ['127.0.0.1:' + req.socket.localPort, 'localhost:' + req.socket.localPort];
    const host = String(req.headers.host || '').toLowerCase();
    const origin = 'http://' + host;
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (!allowedHosts.includes(host)) return json(403, { error: '请在运行维护服务的电脑上使用 http://127.0.0.1:' + req.socket.localPort + '/ 或 http://localhost:' + req.socket.localPort + '/ 访问' });
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/state' && req.method === 'GET') {
        const data = load(dataRoot);
        return json(200, { token, revision: data.revision, view: data.view, ledger: data.ledger, candidates: identity.candidates(data.view) });
      }
      if (url.pathname === '/api/action' && req.method === 'POST') {
        if (req.headers.origin !== origin || req.headers['x-identity-token'] !== token || req.headers['content-type'] !== 'application/json') return json(403, { error: '请求来源无效，请刷新维护页面' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 1024 * 1024) return json(413, { error: '请求过大' }); }
        const { revision, action } = JSON.parse(body);
        const data = load(dataRoot);
        if (revision !== data.revision) return json(409, { error: '数据已变化，请刷新后重新核对' });
        if (!action || !['merge', 'move', 'distinct', 'undo'].includes(action.type)) throw new Error('操作无效');
        const event = { ...action, id: crypto.randomUUID(), at: new Date().toISOString() };
        if (event.new_student) { event.new_student = { id: 's-' + crypto.randomUUID(), name: event.new_student.name }; event.to = event.new_student.id; }
        const ledger = { version: 1, events: [...data.ledger.events, event] };
        const projected = identity.project(data.students, data.results, ledger);
        identity.metadata(projected, data.profiles, data.achievements);
        // Synchronous atomic replacement prevents interleaved writes in this process.
        const ledgerFile = path.join(dataRoot, 'data', 'identity_events.json');
        const temp = ledgerFile + '.tmp';
        fs.writeFileSync(temp, JSON.stringify(ledger, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temp, ledgerFile);
        return json(200, { ok: true, event });
      }
      if (req.method !== 'GET') return json(405, { error: '方法不支持' });
      let relative;
      if (url.pathname === '/' || url.pathname === '/identity') relative = 'tools/identity-admin.html';
      else if (url.pathname === '/identity-admin.js') relative = 'tools/identity-admin.js';
      else if (url.pathname === '/identity-admin.css') relative = 'tools/identity-admin.css';
      else if (/^\/(?:index|hfoi-[a-z-]+)(?:\.html)?$/.test(url.pathname)) relative = url.pathname.slice(1).replace(/(?:\.html)?$/, '.html');
      else if (/^\/(?:site\.js|styles\.css|js\/identity\.js|vendor\/echarts\.min\.js|data\/[a-z_]+\.json|data\/announcements\/[a-z0-9]+\.json)$/.test(url.pathname)) relative = url.pathname.slice(1);
      else return json(404, { error: '页面不存在' });
      const file = path.join(root, relative);
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'text/plain';
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "frame-ancestors 'none'" });
      res.end(fs.readFileSync(file));
    } catch (error) { if (!res.headersSent) json(400, { error: error.message }); else res.end(); }
  });
}
if (require.main === module) {
  load();
  const server = createServer();
  server.listen(Number(process.env.PORT || 4178), '127.0.0.1', () => console.log('身份核对：http://127.0.0.1:' + server.address().port + '/'));
}
module.exports = { createServer };
