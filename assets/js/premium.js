/* ═══════════════════════════════════════════════════════════════════════════
   CA RESHMA JADHAV & COMPANY — PREMIUM INTERACTION LAYER
   v1.0 · Load with `defer` just before </body>.

   Entirely additive and defensive: every block checks for its elements and
   no-ops if they are absent, so the same file is safe on all 18 pages
   regardless of which components each one happens to use.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────────────────────────────────────────────────────────────────────
     1. SCROLL-AWARE NAVIGATION
     Adds .is-scrolled past a threshold. rAF-throttled so scrolling stays on
     the compositor — a nav that stutters undoes everything else.
     ───────────────────────────────────────────────────────────────────────── */
  (function navChrome() {
    /* Phase 0 bridge: live Apple pages use plain <nav>, newer pages use
       .nav-container / nav.nav — support all three. */
    var nav = document.querySelector('.nav-container') ||
              document.querySelector('nav.nav') ||
              document.querySelector('body > nav');
    if (!nav) return;

    var THRESHOLD = 24, ticking = false, last = null;

    function apply() {
      ticking = false;
      var on = window.scrollY > THRESHOLD;
      if (on !== last) {          // only touch the DOM on an actual change
        nav.classList.toggle('is-scrolled', on);
        last = on;
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     2. REVEAL SAFETY NET
     Pages animate .reveal via their own IntersectionObserver. Two ways that
     leaves content permanently invisible — a hard failure on a content site:
       a) reduced-motion is on and the observer still gates visibility
       b) an element is already in view before the observer attaches
     Both are covered here without duplicating the page's own logic.
     ───────────────────────────────────────────────────────────────────────── */
  (function revealSafety() {
    /* Phase 0 bridge: support BOTH .reveal/.visible and .reveal-target/.is-visible. */
    var els = document.querySelectorAll('.reveal, .reveal-target');
    if (!els.length) return;

    function show(el) {
      el.classList.add('visible');
      el.classList.add('is-visible');
      /* Cascade: let grids stagger their children via CSS delay. */
      if (el.classList.contains('content-grid') || el.classList.contains('trust-grid')) {
        el.classList.add('is-visible');
      }
    }

    if (reduced || !('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) show(els[i]);
      return;
    }
    // Anything still hidden after load and already on screen gets shown.
    window.addEventListener('load', function () {
      setTimeout(function () {
        document.querySelectorAll('.reveal:not(.visible), .reveal-target:not(.is-visible)').forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) show(el);
        });
      }, 400);
    });
  })();

  /* ── Phase 0 bridge: cascade parent grids + hero entrance ── */
  (function revealCascade() {
    if (!('IntersectionObserver' in window) || reduced) {
      document.querySelectorAll('.content-grid, .trust-grid').forEach(function (g) {
        g.classList.add('is-visible');
      });
      /* links/blog use .reveal/.visible — never leave them hidden. */
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('visible');
      });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('.content-grid, .trust-grid').forEach(function (g) { io.observe(g); });
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); rio.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) { rio.observe(el); });
    }
    /* Hero blur+rise entrance, once. */
    if (!reduced) document.body.classList.add('prem-hero-in');
  })();

  /* ── Mobile sticky CRO bar: Call / WhatsApp / Instagram / Facebook ──
     Injected once and ALWAYS kept at the bottom. Visibility is gated by
     matchMedia in JS (plus the CSS media query as a second gate), and core
     positioning rides inline so the bar survives even a missing stylesheet. */
  (function mobileCtaBar() {
    function build() {
    if (document.getElementById('mob-cta')) return;
    if (!document.body) return;
    /* NOTE: must be a DIV — a <nav> would inherit every page's
       `nav { top: 0 }` rule and pin itself to the viewport top. */
    var bar = document.createElement('div');
    bar.id = 'mob-cta';
    bar.className = 'mob-cta';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Quick contact');
    bar.innerHTML =
      '<a class="mob-call" href="tel:+918177922977" aria-label="Call CA Reshma Jadhav now">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Call</a>' +
      '<a class="mob-wa" href="https://wa.me/918177922977?text=Hi%20CA%20Reshma!%20I%20have%20a%20query." target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607z"/></svg>WhatsApp</a>' +
      '<a class="mob-ig" href="https://instagram.com/ca_reshmajadhav_bizadvisor" target="_blank" rel="noopener" aria-label="Open Instagram profile">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>Insta</a>' +
      '<a class="mob-fb" href="https://www.facebook.com/profile.php?id=100008590300209" target="_blank" rel="noopener" aria-label="Open Facebook profile">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>FB</a>';
    /* Core positioning rides inline so the bar survives a missing stylesheet;
       prettiness still comes from premium.css. */
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:1150;';
    document.body.appendChild(bar);
    var mq = (window.matchMedia)
      ? window.matchMedia('(max-width: 767.98px)') : null;
    function applyBar() {
      var show = !mq || mq.matches;
      bar.style.display = show ? 'flex' : 'none';
    }
    if (mq && mq.addEventListener) mq.addEventListener('change', applyBar);
    else if (mq && mq.addListener) mq.addListener(applyBar);
    applyBar();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', build);
    } else {
      build();
    }
  })();

  /* ── Phase 0 bridge: inject accessible hamburger on plain-<nav> pages ── */
  (function injectedMobileNav() {
    var nav = document.querySelector('.nav-container') ||
              document.querySelector('nav.nav') ||
              document.querySelector('body > nav');
    if (!nav) return;
    var links = nav.querySelector('.nav-links, #nav-menu');
    if (!links) return;
    if (nav.querySelector('#hamburger, .prem-hamburger')) return; // newer page owns it
    if (!nav.style.position) nav.style.position = 'fixed';

    var btn = document.createElement('button');
    btn.className = 'prem-hamburger';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    function set(open) {
      links.classList.toggle('open', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    btn.addEventListener('click', function () {
      set(!links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') set(false);
    });
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     3. FOCUS-TRAP + RESTORE FOR THE CONTACT PANEL
     The panel is a dialog. Without trapping, keyboard focus walks out of it
     into the page behind — the kind of detail that separates a product from
     a page. Wraps the page's existing cfabToggle rather than replacing it.
     ───────────────────────────────────────────────────────────────────────── */
  (function focusTrap() {
    var root = document.getElementById('cfab');
    if (!root || typeof window.cfabToggle !== 'function') return;

    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),' +
              'textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    var opener = null;
    var original = window.cfabToggle;

    window.cfabToggle = function (force) {
      var willOpen = (typeof force === 'boolean')
        ? force : !root.classList.contains('open');
      if (willOpen) opener = document.activeElement;
      original.apply(this, arguments);
      if (!willOpen && opener && typeof opener.focus === 'function') {
        opener.focus();
        opener = null;
      }
    };

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !root.classList.contains('open')) return;
      var panel = root.querySelector('.cfab-panel');
      if (!panel) return;

      var items = Array.prototype.filter.call(
        panel.querySelectorAll(SEL),
        function (el) { return el.offsetParent !== null; }
      );
      if (!items.length) return;

      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     4. MOBILE NAV — accessible disclosure
     The hamburger toggles a panel but never announced its state. One
     attribute; meaningful to every screen-reader user.
     ───────────────────────────────────────────────────────────────────────── */
  (function navA11y() {
    var burger = document.getElementById('hamburger');
    var menu   = document.getElementById('nav-menu');
    if (!burger || !menu) return;

    if (!menu.id) menu.id = 'nav-menu';
    burger.setAttribute('aria-controls', menu.id);
    burger.setAttribute('aria-expanded', 'false');

    // The page's own handler toggles the class; mirror it into ARIA.
    new MutationObserver(function () {
      burger.setAttribute('aria-expanded',
        menu.classList.contains('open') ? 'true' : 'false');
    }).observe(menu, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.focus();
      }
    });
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     5. EXTERNAL LINK HARDENING
     target="_blank" without rel="noopener" hands the opened tab a reference
     back to this window. Cheap to leak, cheap to fix, and it is a security
     expectation on any site that handles client financial data.
     ───────────────────────────────────────────────────────────────────────── */
  (function hardenLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
      var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      if (rel.indexOf('noopener') === -1) rel.push('noopener');
      if (rel.indexOf('noreferrer') === -1) rel.push('noreferrer');
      a.setAttribute('rel', rel.join(' '));
    });
  })();

  /* ─────────────────────────────────────────────────────────────────────────
     6. SCROLL PROGRESS
     A 2px gold hairline at the top of the viewport. On long service pages it
     answers "how much of this is left" without occupying any layout space.
     ───────────────────────────────────────────────────────────────────────── */
  (function scrollProgress() {
    if (reduced) return;
    if (document.body.scrollHeight < window.innerHeight * 2.2) return; // short page

    var bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText =
      'position:fixed;top:0;left:0;height:2px;width:0;z-index:1400;' +
      'background:linear-gradient(90deg,#A9861C,#C9A227,#E8C050);' +
      'box-shadow:0 0 8px rgba(201,162,39,.45);' +
      'transition:width 90ms linear;pointer-events:none;will-change:width';
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();

})();
