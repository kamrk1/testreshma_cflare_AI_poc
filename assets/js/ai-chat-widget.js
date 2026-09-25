/**
 * CA Reshma — Cloudflare AI Search chat widget (POC).
 * Calls same-origin /api/chat — no CORS, no external host.
 * Keep CFG.botName / CFG.escalationContact in sync with the KV "site-config"
 * doc (worker/src/config.ts) — this is UI chrome only, the Worker is the
 * source of truth for what the bot actually says.
 */
(function () {
  'use strict';

  var CFG = {
    apiUrl: '/api/chat',
    botName: 'CA Reshma AI Assistant',
    escalationContact: 'WhatsApp +91 81779 22977',
    waLink: 'https://wa.me/918177922977',
    fabLabel: 'Have a CA Question?',
    placeholder: 'Ask about services, timings, address…',
    greeting:
      'Hello! Ask about our services, office timings, address, or fees. मराठीतही विचारू शकता, हिंदी में भी पूछ सकते हैं.',
    privacyNote:
      'This chat is AI-assisted and answers only from this website’s published content. Do not share sensitive documents here.',
    teaser: 'Need tax help? Ask AI in English, मराठी or हिंदी 👋',
    maxHistoryTurns: 6,
  };

  var SESSION_KEY = 'ca_ai_chat_session';
  var TEASER_KEY = 'ca_ai_chat_teaser_dismissed';
  var HISTORY_KEY = 'ca_ai_chat_history';

  var SEND_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  function sessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'ca_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return 'ca_' + Date.now().toString(36);
    }
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-CFG.maxHistoryTurns)));
    } catch (e) { /* ignore */ }
  }

  function teaserDismissed() {
    try { return localStorage.getItem(TEASER_KEY) === '1'; } catch (e) { return false; }
  }
  function setTeaserDismissed() {
    try { localStorage.setItem(TEASER_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function injectStyles() {
    if (document.getElementById('ca-ai-chat-styles')) return;
    var css =
      '#ca-ai-root{all:initial;font-family:DM Sans,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}' +
      '#ca-ai-root *{box-sizing:border-box}' +
      '#ca-ai-scrim{position:fixed;inset:0;z-index:99998;background:rgba(13,27,42,.45);opacity:0;pointer-events:none;transition:opacity .28s ease}' +
      '#ca-ai-scrim.show{opacity:1;pointer-events:auto}' +
      '#ca-ai-dock{position:fixed;right:20px;bottom:96px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:10px}' +
      '#ca-ai-teaser{position:relative;max-width:min(280px,calc(100vw - 48px));background:#fff;color:#0F172A;padding:10px 34px 10px 14px;border-radius:14px;font-size:13px;line-height:1.4;font-weight:500;box-shadow:0 10px 28px rgba(0,0,0,.28);opacity:0;transform:translateY(8px) scale(.96);pointer-events:none;visibility:hidden;transition:opacity .3s ease,transform .3s cubic-bezier(.22,1,.36,1),visibility .3s}' +
      '#ca-ai-teaser.show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;visibility:visible}' +
      '#ca-ai-teaser-x{position:absolute;top:6px;right:8px;border:none;background:transparent;color:#64748b;font-size:16px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}' +
      '#ca-ai-fab{position:relative;height:48px;padding:0 18px 0 14px;border-radius:999px;border:1.5px solid #E2B04A;cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:rgba(11,19,43,.92);color:#fff;font-weight:600;font-size:13.5px;box-shadow:0 8px 25px rgba(226,176,74,.25)}' +
      '#ca-ai-fab.is-open{padding:0;width:52px;justify-content:center;gap:0}' +
      '#ca-ai-fab .ca-ai-label{white-space:nowrap}' +
      '#ca-ai-fab.is-open .ca-ai-label{display:none}' +
      '#ca-ai-panel{position:fixed;right:20px;bottom:168px;z-index:99999;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 190px));display:flex;flex-direction:column;overflow:hidden;background:rgba(15,23,42,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:20px;border:1px solid rgba(226,176,74,.28);box-shadow:0 24px 64px rgba(0,0,0,.4);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(12px) scale(.96);transition:opacity .28s ease,transform .32s cubic-bezier(.22,1,.36,1),visibility .32s}' +
      '#ca-ai-panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}' +
      '@media(max-width:480px){#ca-ai-dock{right:12px;bottom:88px}#ca-ai-panel{right:12px;left:12px;width:auto;bottom:156px}}' +
      '#ca-ai-head{padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(226,176,74,.22);background:rgba(11,19,43,.55)}' +
      '#ca-ai-head strong{display:block;font-size:14px;color:#F8F4EC}' +
      '#ca-ai-head span{display:block;font-size:11px;color:#94a3b8;margin-top:2px}' +
      '#ca-ai-close,#ca-ai-wa{background:transparent;border:none;color:#cbd5e1;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}' +
      '#ca-ai-close:hover,#ca-ai-wa:hover{background:rgba(255,255,255,.08)}' +
      '#ca-ai-privacy{font-size:10.5px;line-height:1.4;color:#94a3b8;padding:6px 14px;border-bottom:1px solid rgba(226,176,74,.14)}' +
      '#ca-ai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg,rgba(15,23,42,.2),rgba(13,27,42,.55))}' +
      '.ca-ai-bubble{max-width:90%;padding:11px 13px;border-radius:16px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}' +
      '.ca-ai-bot{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);color:#e2e8f0;border-bottom-left-radius:6px}' +
      '.ca-ai-user{align-self:flex-end;background:linear-gradient(135deg,#C9A227,#E2B04A);color:#0D1B2A;font-weight:500;border-bottom-right-radius:6px}' +
      '.ca-ai-sources{font-size:11px;margin-top:4px;display:flex;flex-direction:column;gap:2px}' +
      '.ca-ai-sources a{color:#E8C050}' +
      '#ca-ai-form{padding:12px;border-top:1px solid rgba(226,176,74,.18);background:rgba(11,19,43,.65)}' +
      '#ca-ai-composer{display:flex;align-items:center;gap:6px;padding:4px 4px 4px 12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px}' +
      '#ca-ai-input{flex:1;border:none;background:transparent;padding:10px 4px;font-size:14px;outline:none;color:#F8F4EC;min-width:0;font-family:inherit}' +
      '#ca-ai-send{border:none;border-radius:11px;width:40px;height:40px;flex:0 0 40px;background:#C9A227;color:#0D1B2A;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
      '#ca-ai-send:disabled{opacity:.45;cursor:wait}';
    var style = document.createElement('style');
    style.id = 'ca-ai-chat-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function addBubble(box, role, text) {
    var b = el('div', { class: 'ca-ai-bubble ca-ai-' + role });
    b.textContent = text;
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    return b;
  }

  function addSources(box, sources) {
    if (!sources || !sources.length) return;
    var wrap = el('div', { class: 'ca-ai-sources' });
    sources.forEach(function (s) {
      if (!s.url) return;
      var a = el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title || s.url);
      wrap.appendChild(a);
    });
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function mount() {
    injectStyles();

    var root = el('div', { id: 'ca-ai-root' });
    var scrim = el('div', { id: 'ca-ai-scrim', 'aria-hidden': 'true' });
    var dock = el('div', { id: 'ca-ai-dock' });

    var teaser = el('div', { id: 'ca-ai-teaser', role: 'status', 'aria-live': 'polite' });
    teaser.appendChild(document.createTextNode(CFG.teaser));
    var teaserX = el('button', { id: 'ca-ai-teaser-x', type: 'button', 'aria-label': 'Dismiss tip' }, '×');
    teaser.appendChild(teaserX);

    var fab = el('button', { id: 'ca-ai-fab', type: 'button', 'aria-label': CFG.fabLabel, 'aria-expanded': 'false' });
    fab.innerHTML = '<span class="ca-ai-label">' + CFG.fabLabel + '</span>';

    dock.appendChild(teaser);
    dock.appendChild(fab);

    var panel = el('div', { id: 'ca-ai-panel', role: 'dialog', 'aria-label': CFG.botName, 'aria-modal': 'false' });

    var head = el('div', { id: 'ca-ai-head' });
    var headMeta = el('div');
    headMeta.appendChild(el('strong', null, CFG.botName));
    headMeta.appendChild(el('span', null, 'Online · EN / मराठी / हिंदी'));
    var headActions = el('div');
    var wa = el('a', { id: 'ca-ai-wa', href: CFG.waLink, target: '_blank', rel: 'noopener', title: 'WhatsApp', 'aria-label': 'WhatsApp' }, '💬');
    var close = el('button', { id: 'ca-ai-close', type: 'button', 'aria-label': 'Close chat' }, '×');
    headActions.appendChild(wa);
    headActions.appendChild(close);
    head.appendChild(headMeta);
    head.appendChild(headActions);

    var privacy = el('div', { id: 'ca-ai-privacy' }, CFG.privacyNote);

    var msgs = el('div', { id: 'ca-ai-msgs' });
    var history = loadHistory();
    if (!history.length) {
      addBubble(msgs, 'bot', CFG.greeting);
    } else {
      history.forEach(function (turn) { addBubble(msgs, turn.role === 'assistant' ? 'bot' : 'user', turn.content); });
    }

    var form = el('form', { id: 'ca-ai-form' });
    var composer = el('div', { id: 'ca-ai-composer' });
    var input = el('input', { id: 'ca-ai-input', type: 'text', placeholder: CFG.placeholder, autocomplete: 'off', maxlength: '2000' });
    var send = el('button', { id: 'ca-ai-send', type: 'submit', 'aria-label': 'Send message' });
    send.innerHTML = SEND_SVG;
    composer.appendChild(input);
    composer.appendChild(send);
    form.appendChild(composer);

    panel.appendChild(head);
    panel.appendChild(privacy);
    panel.appendChild(msgs);
    panel.appendChild(form);
    root.appendChild(scrim);
    root.appendChild(dock);
    root.appendChild(panel);
    document.body.appendChild(root);

    var sending = false;

    function setOpen(open) {
      panel.classList.toggle('open', open);
      scrim.classList.toggle('show', open);
      fab.classList.toggle('is-open', open);
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        teaser.classList.remove('show');
        setTimeout(function () { input.focus(); }, 40);
      } else {
        fab.focus();
      }
    }

    async function sendMessage(text) {
      text = (text || '').trim();
      if (!text || sending) return;
      input.value = '';
      addBubble(msgs, 'user', text);
      history.push({ role: 'user', content: text });

      sending = true;
      send.disabled = true;
      var botBubble = addBubble(msgs, 'bot', '…');
      botBubble.textContent = '';

      try {
        var res = await fetch(CFG.apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: history.slice(0, -1).slice(-CFG.maxHistoryTurns),
            sessionId: sessionId(),
          }),
        });

        if (!res.ok) {
          var errBody = await res.json().catch(function () { return {}; });
          botBubble.textContent = errBody.error || ('Sorry, something went wrong. Please contact us: ' + CFG.escalationContact);
          sending = false;
          send.disabled = false;
          input.focus();
          return;
        }

        var contentType = res.headers.get('content-type') || '';
        var fullText = '';

        if (contentType.indexOf('application/json') !== -1) {
          var data = await res.json();
          fullText = data.reply || '';
          botBubble.textContent = fullText;
          addSources(msgs, data.sources);
        } else {
          var reader = res.body.getReader();
          var decoder = new TextDecoder();
          for (;;) {
            var chunk = await reader.read();
            if (chunk.done) break;
            fullText += decoder.decode(chunk.value, { stream: true });
            botBubble.textContent = fullText;
            msgs.scrollTop = msgs.scrollHeight;
          }
          var sourcesHeader = res.headers.get('x-chat-sources');
          if (sourcesHeader) {
            try { addSources(msgs, JSON.parse(decodeURIComponent(sourcesHeader))); } catch (e) { /* ignore */ }
          }
        }

        history.push({ role: 'assistant', content: fullText });
        saveHistory(history);
      } catch (e) {
        botBubble.textContent = 'Network error. Please contact us: ' + CFG.escalationContact;
      } finally {
        sending = false;
        send.disabled = false;
        input.focus();
      }
    }

    fab.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
    close.addEventListener('click', function () { setOpen(false); });
    scrim.addEventListener('click', function () { setOpen(false); });
    teaserX.addEventListener('click', function (e) { e.stopPropagation(); teaser.classList.remove('show'); setTeaserDismissed(); });
    teaser.addEventListener('click', function () { setTeaserDismissed(); setOpen(true); });
    form.addEventListener('submit', function (e) { e.preventDefault(); sendMessage(input.value); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false);
    });

    if (!teaserDismissed()) {
      setTimeout(function () {
        if (!panel.classList.contains('open') && !teaserDismissed()) teaser.classList.add('show');
      }, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
