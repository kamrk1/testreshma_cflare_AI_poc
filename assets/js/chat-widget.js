/**
 * CA Reshma — website chat widget (high-visibility teaser + dark glass chat)
 * Talks to PocketAI OCI router /chat (no GAS logging).
 */
(function () {
  'use strict';

  var CFG = {
    apiUrl: 'https://ai.hotelvyankatesh.online/chat',
    token: 'd37c635c6132240e980949451760b05241b059bc2c02075d',
    waLink: 'https://wa.me/918177922977',
    title: 'Ask CA Reshma',
    fabLabel: 'Have a CA Question?',
    placeholder: 'Ask about services, timings, address…',
    greeting:
      'Hello! Ask about our services, office timings, address, or fees. मराठीतही विचारू शकता.',
    teaser: 'Need tax help? Ask AI in English or मराठी 👋',
    chips: [
      { label: '📄 Fees & Charges', message: 'What are your fees and charges?' },
      { label: '⏰ Office Timings', message: 'What are your office timings?' },
      { label: '📍 Location / Address', message: 'What is your office address?' },
    ],
  };

  var SESSION_KEY = 'pocketai_web_session';
  var TEASER_KEY = 'pocketai_teaser_dismissed';

  var SPARKLE_SVG =
    '<svg class="pai-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path stroke="#E8C050" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
    'd="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>' +
    '<path stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9" ' +
    'd="M16.5 5.25l.25.9a2.25 2.25 0 001.6 1.6l.9.25-.9.25a2.25 2.25 0 00-1.6 1.6l-.25.9-.25-.9a2.25 2.25 0 00-1.6-1.6l-.9-.25.9-.25a2.25 2.25 0 001.6-1.6l.25-.9z"/>' +
    '</svg>';

  var WA_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';

  var SEND_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' +
    '</svg>';

  function sessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id =
          'web_' +
          Date.now().toString(36) +
          '_' +
          Math.random().toString(36).slice(2, 10);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return 'web_' + Date.now().toString(36);
    }
  }

  function teaserDismissed() {
    try {
      return localStorage.getItem(TEASER_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setTeaserDismissed() {
    try {
      localStorage.setItem(TEASER_KEY, '1');
    } catch (e) { /* ignore */ }
  }

  function injectStyles() {
    if (document.getElementById('pai-chat-styles')) return;
    var css =
      '#pai-chat-root{all:initial;font-family:DM Sans,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}' +
      '#pai-chat-root *{box-sizing:border-box}' +
      '#pai-scrim{position:fixed;inset:0;z-index:99998;background:rgba(13,27,42,.45);opacity:0;pointer-events:none;transition:opacity .28s ease}' +
      '#pai-scrim.show{opacity:1;pointer-events:auto}' +
      /* Dock: FAB + teaser above sticky footer */
      '#pai-dock{position:fixed;right:20px;bottom:96px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:10px}' +
      '#pai-teaser{position:relative;max-width:min(280px,calc(100vw - 48px));background:#fff;color:#0F172A;' +
      'padding:10px 34px 10px 14px;border-radius:14px;font-size:13px;line-height:1.4;font-weight:500;' +
      'box-shadow:0 10px 28px rgba(0,0,0,.28);opacity:0;transform:translateY(8px) scale(.96);' +
      'pointer-events:none;visibility:hidden;transition:opacity .3s ease,transform .3s cubic-bezier(.22,1,.36,1),visibility .3s}' +
      '#pai-teaser.show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;visibility:visible}' +
      '#pai-teaser::after{content:"";position:absolute;right:28px;bottom:-6px;width:12px;height:12px;background:#fff;' +
      'transform:rotate(45deg);border-radius:2px;box-shadow:2px 2px 4px rgba(0,0,0,.06)}' +
      '#pai-teaser-x{position:absolute;top:6px;right:8px;border:none;background:transparent;color:#64748b;' +
      'font-size:16px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}' +
      '#pai-teaser-x:hover{background:#f1f5f9;color:#0F172A}' +
      /* High-visibility default pill */
      '#pai-fab{position:relative;height:48px;min-width:48px;padding:0 18px 0 14px;border-radius:999px;' +
      'border:1.5px solid #E2B04A;cursor:pointer;overflow:hidden;' +
      'display:inline-flex;align-items:center;justify-content:center;gap:8px;' +
      'background:rgba(11,19,43,.92);color:#fff;font-weight:600;font-size:13.5px;' +
      '-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
      'box-shadow:0 8px 25px rgba(226,176,74,.25),0 0 0 0 rgba(226,176,74,.2);' +
      'transition:padding .28s cubic-bezier(.22,1,.36,1),gap .25s ease,min-width .28s ease,box-shadow .35s ease,border-color .25s ease;' +
      'animation:paiFloatPulse 3s ease-in-out infinite}' +
      '#pai-fab::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;' +
      'background:linear-gradient(135deg,rgba(232,192,80,.18),rgba(30,58,95,.15) 50%,transparent 75%)}' +
      '#pai-fab .pai-icon{position:relative;z-index:1;width:20px;height:20px;flex:0 0 20px;display:block}' +
      '#pai-fab .pai-label{position:relative;z-index:1;white-space:nowrap;color:#fff;letter-spacing:.01em}' +
      '#pai-fab:hover{box-shadow:0 10px 32px rgba(226,176,74,.35),0 0 0 4px rgba(226,176,74,.1);border-color:#E8C050}' +
      '#pai-fab.is-open{animation:none;padding:0;min-width:52px;width:52px;gap:0;' +
      'box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 0 3px rgba(201,162,39,.22)}' +
      '#pai-fab.is-open .pai-label{display:none}' +
      '#pai-fab:focus-visible{outline:2px solid #E8C050;outline-offset:3px}' +
      '@keyframes paiFloatPulse{' +
      '0%,100%{box-shadow:0 8px 25px rgba(226,176,74,.25),0 0 0 0 rgba(226,176,74,.22);transform:translateY(0)}' +
      '50%{box-shadow:0 12px 32px rgba(226,176,74,.38),0 0 0 6px rgba(226,176,74,0);transform:translateY(-2px)}' +
      '}' +
      /* Dark glass panel */
      '#pai-panel{position:fixed;right:20px;bottom:168px;z-index:99999;width:min(380px,calc(100vw - 24px));' +
      'height:min(520px,calc(100vh - 190px));display:flex;flex-direction:column;overflow:hidden;' +
      'background:rgba(15,23,42,.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
      'border-radius:20px;border:1px solid rgba(226,176,74,.28);' +
      'box-shadow:0 24px 64px rgba(0,0,0,.4);transform-origin:bottom right;' +
      'opacity:0;visibility:hidden;pointer-events:none;' +
      'transform:translateY(12px) scale(.96);' +
      'transition:opacity .28s ease,transform .32s cubic-bezier(.22,1,.36,1),visibility .32s}' +
      '#pai-panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}' +
      '@media(max-width:480px){' +
      '#pai-dock{right:12px;bottom:88px}' +
      '#pai-panel{right:12px;left:12px;width:auto;bottom:156px;transform-origin:bottom center}' +
      '#pai-fab .pai-label{font-size:12.5px}' +
      '#pai-fab{padding:0 14px 0 12px}' +
      '}' +
      /* Header */
      '#pai-head{padding:14px 14px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'border-bottom:1px solid rgba(226,176,74,.22);background:rgba(11,19,43,.55)}' +
      '#pai-head-left{display:flex;align-items:center;gap:10px;min-width:0}' +
      '#pai-avatar{position:relative;width:40px;height:40px;border-radius:50%;flex:0 0 40px;' +
      'background:linear-gradient(145deg,#1E3A5F,#0D1B2A);border:1px solid rgba(226,176,74,.4);' +
      'display:flex;align-items:center;justify-content:center}' +
      '#pai-avatar .pai-icon{width:20px;height:20px}' +
      '#pai-online{position:absolute;right:0;bottom:0;width:10px;height:10px;border-radius:50%;' +
      'background:#22c55e;border:2px solid #0f172a;box-shadow:0 0 0 1px rgba(34,197,94,.35)}' +
      '#pai-head-meta{min-width:0}' +
      '#pai-head-meta strong{display:block;font-size:14px;font-weight:700;color:#F8F4EC;letter-spacing:.01em;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#pai-head-meta span{display:block;font-size:11px;color:#94a3b8;margin-top:2px}' +
      '#pai-head-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}' +
      '#pai-wa{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;' +
      'border-radius:10px;background:rgba(37,211,102,.12);color:#25D366;border:1px solid rgba(37,211,102,.35);' +
      'text-decoration:none;transition:background .2s}' +
      '#pai-wa:hover{background:rgba(37,211,102,.22)}' +
      '#pai-close{background:transparent;border:none;color:#cbd5e1;font-size:22px;cursor:pointer;line-height:1;' +
      'width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center}' +
      '#pai-close:hover{background:rgba(255,255,255,.08);color:#fff}' +
      /* Messages */
      '#pai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;' +
      'background:linear-gradient(180deg,rgba(15,23,42,.2),rgba(13,27,42,.55))}' +
      '.pai-bubble{max-width:90%;padding:11px 13px;border-radius:16px;font-size:13.5px;line-height:1.5;' +
      'white-space:pre-wrap;word-break:break-word}' +
      '.pai-bot{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);' +
      'color:#e2e8f0;border-bottom-left-radius:6px}' +
      '.pai-user{align-self:flex-end;background:linear-gradient(135deg,#C9A227,#E2B04A);color:#0D1B2A;' +
      'font-weight:500;border-bottom-right-radius:6px}' +
      '.pai-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}' +
      '.pai-chip{border:1px solid rgba(226,176,74,.4);background:rgba(226,176,74,.1);color:#F8F4EC;' +
      'border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;' +
      'font-family:inherit;transition:background .2s,border-color .2s,transform .15s}' +
      '.pai-chip:hover{background:rgba(226,176,74,.22);border-color:#E2B04A;transform:translateY(-1px)}' +
      /* Integrated composer */
      '#pai-form{padding:12px;border-top:1px solid rgba(226,176,74,.18);background:rgba(11,19,43,.65)}' +
      '#pai-composer{display:flex;align-items:center;gap:6px;padding:4px 4px 4px 12px;' +
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;' +
      'transition:border-color .2s,box-shadow .2s}' +
      '#pai-composer:focus-within{border-color:rgba(226,176,74,.55);box-shadow:0 0 0 3px rgba(226,176,74,.12)}' +
      '#pai-input{flex:1;border:none;background:transparent;padding:10px 4px;font-size:14px;outline:none;' +
      'font-family:inherit;color:#F8F4EC;min-width:0}' +
      '#pai-input::placeholder{color:#94a3b8}' +
      '#pai-send{border:none;border-radius:11px;width:40px;height:40px;flex:0 0 40px;' +
      'background:#C9A227;color:#0D1B2A;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;' +
      'transition:background .2s,transform .15s}' +
      '#pai-send:hover{background:#E8C050}' +
      '#pai-send:disabled{opacity:.45;cursor:wait}' +
      '@media (prefers-reduced-motion:reduce){' +
      '#pai-fab{animation:none;transition:none}' +
      '#pai-teaser,#pai-panel,#pai-scrim,.pai-chip{transition:none}' +
      '}';

    var style = document.createElement('style');
    style.id = 'pai-chat-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function addMsg(box, role, text) {
    var b = el('div', { class: 'pai-bubble pai-' + role });
    b.textContent = text;
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    return b;
  }

  function mount() {
    injectStyles();

    var root = el('div', { id: 'pai-chat-root' });
    var scrim = el('div', { id: 'pai-scrim', 'aria-hidden': 'true' });
    var dock = el('div', { id: 'pai-dock' });

    var teaser = el('div', {
      id: 'pai-teaser',
      role: 'status',
      'aria-live': 'polite',
    });
    teaser.appendChild(document.createTextNode(CFG.teaser));
    var teaserX = el('button', {
      id: 'pai-teaser-x',
      type: 'button',
      'aria-label': 'Dismiss tip',
    }, '×');
    teaser.appendChild(teaserX);

    var fab = el('button', {
      id: 'pai-fab',
      type: 'button',
      'aria-label': CFG.fabLabel,
      'aria-expanded': 'false',
      'aria-controls': 'pai-panel',
    });
    fab.innerHTML = SPARKLE_SVG + '<span class="pai-label">' + CFG.fabLabel + '</span>';

    dock.appendChild(teaser);
    dock.appendChild(fab);

    var panel = el('div', {
      id: 'pai-panel',
      role: 'dialog',
      'aria-label': CFG.title,
      'aria-modal': 'false',
    });

    var head = el('div', { id: 'pai-head' });
    var headLeft = el('div', { id: 'pai-head-left' });
    var avatar = el('div', { id: 'pai-avatar' });
    avatar.innerHTML = SPARKLE_SVG + '<span id="pai-online" title="Online"></span>';
    var meta = el('div', { id: 'pai-head-meta' });
    meta.appendChild(el('strong', null, 'CA Reshma AI Assistant'));
    meta.appendChild(el('span', null, 'Online · replies in EN & मराठी'));
    headLeft.appendChild(avatar);
    headLeft.appendChild(meta);

    var headActions = el('div', { id: 'pai-head-actions' });
    var wa = el('a', {
      id: 'pai-wa',
      href: CFG.waLink,
      target: '_blank',
      rel: 'noopener',
      'aria-label': 'Chat on WhatsApp',
      title: 'WhatsApp',
    });
    wa.innerHTML = WA_SVG;
    var close = el('button', { id: 'pai-close', type: 'button', 'aria-label': 'Close chat' }, '×');
    headActions.appendChild(wa);
    headActions.appendChild(close);
    head.appendChild(headLeft);
    head.appendChild(headActions);

    var msgs = el('div', { id: 'pai-msgs' });
    addMsg(msgs, 'bot', CFG.greeting);

    var chips = el('div', { class: 'pai-chips' });
    CFG.chips.forEach(function (chip) {
      var btn = el('button', { type: 'button', class: 'pai-chip' }, chip.label);
      btn.setAttribute('data-msg', chip.message);
      chips.appendChild(btn);
    });
    msgs.appendChild(chips);

    var form = el('form', { id: 'pai-form' });
    var composer = el('div', { id: 'pai-composer' });
    var input = el('input', {
      id: 'pai-input',
      type: 'text',
      placeholder: CFG.placeholder,
      autocomplete: 'off',
      maxlength: '2000',
    });
    var send = el('button', {
      id: 'pai-send',
      type: 'submit',
      'aria-label': 'Send message',
    });
    send.innerHTML = SEND_SVG;
    composer.appendChild(input);
    composer.appendChild(send);
    form.appendChild(composer);

    panel.appendChild(head);
    panel.appendChild(msgs);
    panel.appendChild(form);
    root.appendChild(scrim);
    root.appendChild(dock);
    root.appendChild(panel);
    document.body.appendChild(root);

    var sending = false;

    function hideTeaser() {
      teaser.classList.remove('show');
    }

    function dismissTeaser() {
      hideTeaser();
      setTeaserDismissed();
    }

    function setOpen(open) {
      panel.classList.toggle('open', open);
      scrim.classList.toggle('show', open);
      fab.classList.toggle('is-open', open);
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-modal', open ? 'true' : 'false');
      if (open) {
        hideTeaser();
        setTimeout(function () { input.focus(); }, 40);
      } else {
        fab.focus();
      }
    }

    function toggle(open) {
      if (open === undefined) open = !panel.classList.contains('open');
      setOpen(open);
    }

    function sendMessage(text) {
      text = (text || '').trim();
      if (!text || sending) return;
      if (chips.parentNode) chips.parentNode.removeChild(chips);
      input.value = '';
      addMsg(msgs, 'user', text);
      sending = true;
      send.disabled = true;
      fetch(CFG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Token': CFG.token,
        },
        body: JSON.stringify({ message: text, sessionId: sessionId() }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.reply) addMsg(msgs, 'bot', res.j.reply);
          else addMsg(msgs, 'bot', 'Sorry, something went wrong. Please WhatsApp us: +91 8177922977');
        })
        .catch(function () {
          addMsg(msgs, 'bot', 'Network error. Please WhatsApp us: +91 8177922977');
        })
        .finally(function () {
          sending = false;
          send.disabled = false;
          input.focus();
        });
    }

    fab.addEventListener('click', function () { toggle(); });
    close.addEventListener('click', function () { setOpen(false); });
    scrim.addEventListener('click', function () { setOpen(false); });
    teaserX.addEventListener('click', function (e) {
      e.stopPropagation();
      dismissTeaser();
    });
    teaser.addEventListener('click', function () {
      dismissTeaser();
      setOpen(true);
    });

    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('.pai-chip');
      if (!btn) return;
      setOpen(true);
      sendMessage(btn.getAttribute('data-msg') || btn.textContent);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        e.preventDefault();
        setOpen(false);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage(input.value);
    });

    if (!teaserDismissed()) {
      setTimeout(function () {
        if (!panel.classList.contains('open') && !teaserDismissed()) {
          teaser.classList.add('show');
        }
      }, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
