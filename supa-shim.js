/* Agenda OnCourt — ponte para o Supabase.
   Oferece a mesma interface que a agenda usava dentro do Claude
   (window.claude.use('db' | 'assets' | 'downloads')), guardando tudo
   no seu projeto Supabase. Login por e-mail e senha antes de abrir. */
(function () {
  'use strict';
  var BUCKET = 'arquivos';
  var MAX_FILE = 50 * 1048576;          // limite por arquivo no plano grátis
  var MAX_TOTAL = 1024 * 1048576;       // 1 GB de armazenamento no plano grátis
  var DEFAULT_FOLDERS = [
    ['produto', 'App', 2], ['parcerias', 'Parcerias', 1], ['marketing', 'Marketing', 4],
    ['financeiro', 'Financeiro', 3], ['operacao', 'Operação', 5]
  ];

  var LOGO = '<svg width="64" height="64" viewBox="0 0 120 120" aria-hidden="true"><defs><clipPath id="shimLg"><circle cx="60" cy="76" r="22"/></clipPath></defs><rect x="12" y="20" width="96" height="88" rx="18" fill="#FFF8F3"/><path d="M12 46V38a18 18 0 0 1 18-18h60a18 18 0 0 1 18 18v8z" fill="#B45F43"/><rect x="12" y="20" width="96" height="88" rx="18" fill="none" stroke="#264653" stroke-width="6"/><rect x="36" y="9" width="9" height="22" rx="4.5" fill="#264653"/><rect x="75" y="9" width="9" height="22" rx="4.5" fill="#264653"/><circle cx="60" cy="76" r="22" fill="#5E6D56"/><g clip-path="url(#shimLg)" fill="none" stroke="#FFF8F3" stroke-width="5" stroke-linecap="round"><path d="M40 58c10 8 10 28 0 36"/><path d="M80 58c-10 8-10 28 0 36"/></g></svg>';

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var cfg = window.ONCOURT_CONFIG || {};
  var URL_ = (cfg.supabaseUrl && cfg.supabaseUrl.indexOf('COLE_') !== 0) ? cfg.supabaseUrl : lsGet('oncourt.sbUrl');
  var KEY_ = (cfg.supabaseAnonKey && cfg.supabaseAnonKey.indexOf('COLE_') !== 0) ? cfg.supabaseAnonKey : lsGet('oncourt.sbKey');

  /* ---------- Tela de entrada ---------- */
  var css = '' +
    '#sb-gate{position:fixed;inset:0;z-index:2147483000;background:var(--paper,#FFF8F3);display:grid;place-items:center;padding:16px;font-family:Poppins,system-ui,sans-serif;color:var(--ink,#211E1C)}' +
    '#sb-gate .c{width:100%;max-width:360px;background:var(--surface,#FFFDFB);border:1px solid var(--line,#E3D3C5);border-radius:22px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 10px 30px rgba(33,30,28,.06)}' +
    '#sb-gate .b{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:6px}' +
    '#sb-gate .w{font-family:"Playfair Display",Georgia,serif;font-weight:800;letter-spacing:.06em;color:#B45F43;font-size:22px;line-height:1}' +
    '#sb-gate .s{font-size:10.5px;letter-spacing:.38em;color:#264653;font-weight:600}' +
    '#sb-gate label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted,#6F625A)}' +
    '#sb-gate input{font:inherit;font-size:16px;padding:11px 12px;border-radius:12px;border:1px solid var(--line,#E3D3C5);background:var(--paper,#FFF8F3);color:var(--ink,#211E1C)}' +
    '#sb-gate input:focus{outline:2px solid #B45F43;outline-offset:1px}' +
    '#sb-gate button{font:inherit;font-weight:600;padding:12px;border-radius:12px;border:0;background:#B45F43;color:#fff;cursor:pointer}' +
    '#sb-gate button:disabled{opacity:.6}' +
    '#sb-gate .e{color:#A3312A;font-size:13px;min-height:1em}' +
    '#sb-gate .h{font-size:12px;color:var(--muted,#6F625A);text-align:center;line-height:1.45}' +
    '#sb-gate .lnk{background:none;color:var(--muted,#6F625A);font-weight:400;font-size:12px;padding:0;text-decoration:underline}';

  function gate(html, onSubmit) {
    var el = document.getElementById('sb-gate');
    if (!el) {
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'sb-gate';
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = '<form class="c" novalidate><div class="b">' + LOGO + '<span class="w">ONCOURT</span><span class="s">AGENDA</span></div>' + html + '</form>';
    var form = el.querySelector('form');
    form.addEventListener('submit', function (ev) { ev.preventDefault(); onSubmit(form); });
    var first = form.querySelector('input'); if (first) setTimeout(function () { first.focus(); }, 50);
    return form;
  }
  function closeGate() { var el = document.getElementById('sb-gate'); if (el) el.remove(); }
  function whenBody(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function askConfig() {
    return new Promise(function (resolve) {
      whenBody(function () {
        gate('<p class="h">Primeira vez neste aparelho: cole os dados do seu projeto Supabase (Project Settings → API).</p>' +
          '<label>Project URL<input name="u" type="url" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>' +
          '<label>Chave anon public<input name="k" type="text" placeholder="eyJ..." autocomplete="off"></label>' +
          '<div class="e"></div><button type="submit">Continuar</button>', function (f) {
          var u = f.u.value.trim().replace(/\/+$/, ''), k = f.k.value.trim();
          if (!/^https:\/\/.+/.test(u) || k.length < 20) { f.querySelector('.e').textContent = 'Confira a URL e a chave.'; return; }
          lsSet('oncourt.sbUrl', u); lsSet('oncourt.sbKey', k); URL_ = u; KEY_ = k; resolve();
        });
      });
    });
  }

  function msgFor(err) {
    var m = (err && (err.message || err.error_description)) || '';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme o e-mail no Supabase (Authentication → Users).';
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o Supabase. Verifique a internet.';
    return m || 'Não foi possível entrar. Tente de novo.';
  }

  function askLogin(sb) {
    return new Promise(function (resolve) {
      whenBody(function () {
        gate('<label>E-mail<input name="e" type="email" autocomplete="username" inputmode="email"></label>' +
          '<label>Senha<input name="p" type="password" autocomplete="current-password"></label>' +
          '<div class="e"></div><button type="submit">Entrar</button>' +
          '<p class="h">Você entra uma vez por aparelho. Depois, só o PIN.</p>' +
          '<button type="button" class="lnk" data-reset>Trocar projeto Supabase</button>', function (f) {
          var btn = f.querySelector('button[type=submit]'), out = f.querySelector('.e');
          btn.disabled = true; out.textContent = '';
          sb.auth.signInWithPassword({ email: f.e.value.trim(), password: f.p.value }).then(function (r) {
            btn.disabled = false;
            if (r.error) { out.textContent = msgFor(r.error); return; }
            resolve(r.data.session);
          }).catch(function (e) { btn.disabled = false; out.textContent = msgFor(e); });
        });
        document.querySelector('#sb-gate [data-reset]').addEventListener('click', function () {
          lsDel('oncourt.sbUrl'); lsDel('oncourt.sbKey'); location.reload();
        });
      });
    });
  }

  /* ---------- Conexão ---------- */
  var sb = null, uid = null;
  var ready = (async function () {
    if (!window.supabase || !window.supabase.createClient) throw new Error('supabase-js não carregou');
    if (!URL_ || !KEY_) await askConfig();
    sb = window.supabase.createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'oncourt.auth' } });
    var s = (await sb.auth.getSession()).data.session;
    if (!s) s = await askLogin(sb);
    uid = s.user.id;
    closeGate();
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') location.reload(); });
    await loadAll();
    await seedFolders();
    subscribe();
    return true;
  })();

  /* ---------- Notificações push ---------- */
  function b64u(s) {
    var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }
  window.oncourtPushSupported = function () {
    return !!(cfg.vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:');
  };
  window.__pushOn = false;
  // pede permissão (se preciso), inscreve este aparelho e guarda no Supabase
  window.oncourtEnablePush = async function (silent) {
    if (!window.oncourtPushSupported()) return 'unsupported';
    await ready;
    if (Notification.permission === 'default' && !silent) { try { await Notification.requestPermission(); } catch (e) {} }
    if (Notification.permission !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'default';
    try {
      var reg = await navigator.serviceWorker.register('sw.js');
      reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(cfg.vapidPublicKey) });
      var j = sub.toJSON();
      var r = await sb.from('push_subs').upsert({ endpoint: j.endpoint, user_id: uid, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
      if (r.error) { console.warn(r.error); return 'error'; }
      window.__pushOn = true; return 'ok';
    } catch (e) { console.warn(e); return 'error'; }
  };
  window.oncourtTestPush = async function () {
    await ready;
    var r = await sb.functions.invoke('lembretes', { body: { test: true } });
    if (r.error) return -1;
    return (r.data && r.data.sent) || 0;
  };
  ready.then(function () {
    if (window.oncourtPushSupported() && Notification.permission === 'granted') {
      window.oncourtEnablePush(true).then(function () { if (window.oncourtPushChanged) window.oncourtPushChanged(); });
    }
  }).catch(function () {});

  window.oncourtSignOut = function () {
    if (!sb) return;
    try { sessionStorage.removeItem('oncourt.unlock'); } catch (e) {}
    sb.auth.signOut().then(function () { location.reload(); });
  };

  /* ---------- Banco: cache + tempo real ---------- */
  var cache = {};      // col -> Map(id -> {data, ts})
  var colL = {};       // col -> Set(listener)
  var docL = {};       // "col/id" -> Set(listener)

  function colMap(c) { return cache[c] || (cache[c] = new Map()); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function rid() { var a = new Uint8Array(15); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[b % 62]; }).join('').slice(0, 20); }
  function snapCol(c) {
    var docs = []; colMap(c).forEach(function (v, id) { docs.push({ id: id, data: function () { return clone(v.data); } }); });
    return { docs: docs, size: docs.length, empty: !docs.length };
  }
  function snapDoc(c, id) {
    var v = colMap(c).get(id);
    return { id: id, exists: !!v, data: function () { return v ? clone(v.data) : undefined; } };
  }
  function emit(c, id) {
    var s1 = colL[c]; if (s1) s1.forEach(function (fn) { try { fn(snapCol(c)); } catch (e) { console.error(e); } });
    var k = c + '/' + id, s2 = docL[k]; if (s2) s2.forEach(function (fn) { try { fn(snapDoc(c, id)); } catch (e) { console.error(e); } });
  }
  function emitAll() {
    Object.keys(colL).forEach(function (c) { colL[c].forEach(function (fn) { try { fn(snapCol(c)); } catch (e) {} }); });
    Object.keys(docL).forEach(function (k) { var i = k.indexOf('/'); var c = k.slice(0, i), id = k.slice(i + 1); docL[k].forEach(function (fn) { try { fn(snapDoc(c, id)); } catch (e) {} }); });
  }

  async function loadAll() {
    var fresh = {}, from = 0, step = 1000;
    for (;;) {
      var r = await sb.from('docs').select('col,id,data,ts').eq('user_id', uid).range(from, from + step - 1);
      if (r.error) throw r.error;
      r.data.forEach(function (row) { (fresh[row.col] || (fresh[row.col] = new Map())).set(row.id, { data: row.data, ts: Number(row.ts) || 0 }); });
      if (r.data.length < step) break;
      from += step;
    }
    // mantém gravações locais mais novas que ainda estão a caminho
    Object.keys(cache).forEach(function (c) {
      cache[c].forEach(function (v, id) {
        if (v.pending) { (fresh[c] || (fresh[c] = new Map())).set(id, v); }
      });
    });
    cache = fresh;
  }

  async function seedFolders() {
    if (colMap('folders').size) return;
    var now = Date.now();
    var rows = DEFAULT_FOLDERS.map(function (f, k) {
      var data = { name: f[1], color: f[2], order: k, createdAt: now + k };
      colMap('folders').set(f[0], { data: data, ts: now });
      return { user_id: uid, col: 'folders', id: f[0], data: data, ts: now };
    });
    var r = await sb.from('docs').upsert(rows, { onConflict: 'user_id,col,id' });
    if (r.error) console.warn(r.error);
  }

  var channel = null;
  function subscribe() {
    if (channel) { try { sb.removeChannel(channel); } catch (e) {} }
    channel = sb.channel('docs-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'user_id=eq.' + uid }, function (p) {
        if (p.eventType === 'DELETE') {
          var o = p.old || {}; if (!o.col || (o.user_id && o.user_id !== uid)) return;
          var cur = colMap(o.col).get(o.id); if (cur && cur.pending) return;
          colMap(o.col).delete(o.id); emit(o.col, o.id); return;
        }
        var n = p.new; if (!n || n.user_id !== uid) return;
        var m = colMap(n.col), have = m.get(n.id), ts = Number(n.ts) || 0;
        if (have && have.ts > ts) return;            // já temos versão mais nova
        m.set(n.id, { data: n.data, ts: ts }); emit(n.col, n.id);
      })
      .subscribe();
  }

  // iPhone pausa a conexão quando o app fica em segundo plano: recarrega ao voltar
  var lastSync = Date.now();
  function resync() {
    if (!sb || !uid) return;
    loadAll().then(function () { emitAll(); subscribe(); lastSync = Date.now(); }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - lastSync > 5000) resync(); });
  window.addEventListener('online', resync);

  function failure(e) {
    var err = new Error((e && e.message) || 'Falha ao salvar');
    var m = (e && e.message) || '';
    err.code = /jwt|auth/i.test(m) ? 'upstream_auth' : 'store_unavailable';
    return err;
  }

  async function writeDoc(c, id, data) {
    var ts = Date.now(), m = colMap(c);
    m.set(id, { data: clone(data), ts: ts, pending: true }); emit(c, id);
    var r = await sb.from('docs').upsert({ user_id: uid, col: c, id: id, data: data, ts: ts }, { onConflict: 'user_id,col,id' });
    var cur = m.get(id); if (cur && cur.ts === ts) delete cur.pending;
    if (r.error) throw failure(r.error);
  }
  async function deleteDoc(c, id) {
    var m = colMap(c); m.delete(id); emit(c, id);
    var r = await sb.from('docs').delete().eq('user_id', uid).eq('col', c).eq('id', id);
    if (r.error) throw failure(r.error);
  }

  function docRef(c, id) {
    return {
      id: id,
      get: function () { return Promise.resolve(snapDoc(c, id)); },
      set: function (data) { return writeDoc(c, id, data || {}); },
      update: function (patch) {
        var cur = colMap(c).get(id); var base = cur ? clone(cur.data) : {};
        Object.keys(patch || {}).forEach(function (k) {
          var v = patch[k]; if (v && typeof v === 'object' && v.__delete__) delete base[k]; else base[k] = v;
        });
        return writeDoc(c, id, base);
      },
      delete: function () { return deleteDoc(c, id); },
      onSnapshot: function (fn) {
        var k = c + '/' + id; (docL[k] || (docL[k] = new Set())).add(fn);
        setTimeout(function () { fn(snapDoc(c, id)); }, 0);
        return function () { docL[k].delete(fn); };
      }
    };
  }
  var db = {
    collection: function (c) {
      return {
        doc: function (id) { return docRef(c, id || rid()); },
        onSnapshot: function (fn) {
          (colL[c] || (colL[c] = new Set())).add(fn);
          setTimeout(function () { fn(snapCol(c)); }, 0);
          return function () { colL[c].delete(fn); };
        }
      };
    },
    doc: function (path) { var i = path.lastIndexOf('/'); return docRef(path.slice(0, i), path.slice(i + 1)); }
  };

  /* ---------- Arquivos (Supabase Storage) ---------- */
  function usedBytes() { var t = 0; colMap('files').forEach(function (v) { t += (v.data && v.data.size) || 0; }); return t; }
  var assets = {
    upload: async function (blob, opt) {
      if (!blob || !blob.size) { var e0 = new Error('vazio'); e0.code = 'invalid_request'; throw e0; }
      if (blob.size > MAX_FILE) { var e1 = new Error('grande'); e1.code = 'too_large'; throw e1; }
      if (usedBytes() + blob.size > MAX_TOTAL) { var e2 = new Error('cheio'); e2.code = 'quota_or_state'; throw e2; }
      var id = rid() + rid().slice(0, 12);
      var r = await sb.storage.from(BUCKET).upload(uid + '/' + id, blob, { contentType: (opt && opt.type) || blob.type || 'application/octet-stream', upsert: false });
      if (r.error) throw failure(r.error);
      return { id: id, url: '/_blob/' + id, sizeBytes: blob.size, contentType: (opt && opt.type) || blob.type };
    },
    list: async function () {
      return { assets: [], usage: { files: colMap('files').size, bytes: usedBytes(), maxFiles: 100000, maxBytes: MAX_TOTAL } };
    },
    delete: async function (ref) {
      var id = String(ref).replace(/^.*\/_blob\//, '');
      var r = await sb.storage.from(BUCKET).remove([uid + '/' + id]);
      if (r.error) throw failure(r.error);
      return { deleted: true };
    }
  };
  // a agenda busca arquivos em "/_blob/<id>": redireciona para o Storage
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /\/_blob\/([A-Za-z0-9]+)$/.exec(u);
    if (m && sb && uid) {
      return sb.storage.from(BUCKET).download(uid + '/' + m[1]).then(function (r) {
        if (r.error || !r.data) return new Response('', { status: 404 });
        return new Response(r.data, { status: 200 });
      });
    }
    return nativeFetch(input, init);
  };

  /* ---------- Downloads ---------- */
  var downloads = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = o.filename || 'arquivo';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return { saved: true };
    }
  };

  window.claude = {
    use: function (name) {
      return ready.then(function () {
        if (name === 'db') return db;
        if (name === 'assets') return assets;
        if (name === 'downloads') return downloads;
        return null;
      });
    }
  };
})();
