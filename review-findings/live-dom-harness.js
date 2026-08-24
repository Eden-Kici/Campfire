const { JSDOM, VirtualConsole } = require('jsdom');
const http = require('http');
const fs = require('fs');
const path = require('path');
const APP = '/sessions/adoring-great-fermi/mnt/Campfire-Player-Demo';

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(APP, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nope'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* Boots the real app in a real DOM. Unlike tests/harness.js this builds an
   actual page, so every addEventListener the app attaches is live and a
   .click() genuinely runs the handler. */
async function boot(opts = {}) {
  const { server, port } = await serve();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/index.html`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      // jsdom implements neither of these; both are real browser APIs the app
      // legitimately uses. Shimming them is correcting the test environment,
      // NOT papering over an app bug -- see REVIEW.md.
      win.Element.prototype.scrollIntoView = function () {};
      win.HTMLElement.prototype.scrollIntoView = function () {};
      win.URL.createObjectURL = () => 'blob:stub';
      win.URL.revokeObjectURL = () => {};
    }
  });
  const w = dom.window;
  w.addEventListener('error', e => errors.push('window error: ' + (e.message || e)));

  await new Promise(r => setTimeout(r, 800));

  /* Top-level `let`/`const` are lexical bindings, invisible on `window` --
     same problem tests/harness.js solves with a getter bridge. Do the same
     here so a driver script can read `character`, `activeTab`, `rollHistory`
     and friends. */
  const src = require('fs').readdirSync(APP).filter(f => f.endsWith('.js'))
    .map(f => require('fs').readFileSync(require('path').join(APP, f), 'utf8')).join('\n');
  const names = [...new Set([...src.matchAll(/^(?:let|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))];
  const bridge = w.document.createElement('script');
  bridge.textContent = names.map(n => `try{Object.defineProperty(window,${JSON.stringify(n)},{configurable:true,get(){return ${n};},set(v){try{${n}=v;}catch(e){}}});}catch(e){}`).join('\n');
  w.document.body.appendChild(bridge);

  const api = {
    dom, w, errors, port,
    close: () => { server.close(); dom.window.close(); },
    $: sel => w.document.querySelector(sel),
    $$: sel => Array.from(w.document.querySelectorAll(sel)),
    text: sel => { const el = w.document.querySelector(sel); return el ? el.textContent.replace(/\s+/g,' ').trim() : null; },
    click(sel) {
      const el = typeof sel === 'string' ? w.document.querySelector(sel) : sel;
      if (!el) throw new Error('click: nothing matches ' + sel);
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      return el;
    },
    modal: () => { const m = w.document.querySelector('#modal-overlay .modal-content'); return m ? m.textContent.replace(/\s+/g,' ').trim() : null; },
    modalHtml: () => { const m = w.document.querySelector('#modal-overlay .modal-content'); return m ? m.innerHTML : null; },
    screen: () => w.currentScreen,
    /* A crude "is this control dead?" probe: the whole point of running in a
       real DOM is that a rendered button with no listener behind it looks
       identical to a working one in the string-only suite. */
    fingerprint: () => JSON.stringify({
      screen: w.currentScreen, tab: w.activeTab,
      modal: !!w.document.getElementById('modal-overlay'),
      modalText: (w.document.querySelector('#modal-overlay .modal-content') || {}).textContent || '',
      content: (w.document.getElementById('content') || {}).innerHTML || ''
    }).length + ':' + ((w.document.querySelector('#modal-overlay .modal-content') || {}).textContent || '').slice(0, 80)
  };
  return api;
}
module.exports = { boot, APP };
