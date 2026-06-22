/* ==========================================================================
   KAISERSTUHL DIGITAL - shared interactions + GSAP motion
   GSAP + ScrollTrigger are loaded via CDN before this file (defer).
   Every animation is guarded so this one file runs on every page.
   ========================================================================== */
(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- NAV: active link + glass scroll state + mobile drawer ---------- */
  function initNav() {
    var nav = $('.nav');
    if (!nav) return;

    // active link by current filename (works for .html and cleanUrls)
    var path = location.pathname.replace(/\/$/, '/index.html');
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    $$('.nav__links a, .drawer a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href && (href === file || href.replace('.html', '') === file.replace('.html', '')) && !a.classList.contains('nav__cta')) {
        a.classList.add('is-active');
      }
    });

    // scrolled state via IntersectionObserver sentinel (no scroll listener)
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none;';
    document.body.appendChild(sentinel);
    new IntersectionObserver(function (e) {
      nav.classList.toggle('scrolled', !e[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);

    // mobile drawer
    var burger = $('.nav__burger'), drawer = $('.drawer'), scrim = $('.scrim');
    function setOpen(open) {
      if (!drawer) return;
      drawer.classList.toggle('open', open);
      if (scrim) scrim.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      var s = burger.querySelectorAll('span');
      if (open) { s[0].style.transform = 'translateY(7px) rotate(45deg)'; s[1].style.opacity = '0'; s[2].style.transform = 'translateY(-7px) rotate(-45deg)'; }
      else { s.forEach(function (x) { x.style.transform = ''; x.style.opacity = ''; }); }
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (burger) burger.addEventListener('click', function () { setOpen(!drawer.classList.contains('open')); });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    $$('.drawer a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    var closeBtn = $('.drawer__close');
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
  }

  /* ---------- word splitter (keeps inline accent spans as their own word) ---------- */
  function splitWords(el, cls) {
    if (!el || el.dataset.split) return;
    el.dataset.split = '1';
    var nodes = [];
    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (tok) {
          if (tok === '') return;
          if (/^\s+$/.test(tok)) { nodes.push(document.createTextNode(tok)); return; }
          var s = document.createElement('span'); s.className = cls; s.textContent = tok; nodes.push(s);
        });
      } else if (node.nodeType === 1) {
        node.classList.add(cls); nodes.push(node);
      }
    });
    el.innerHTML = '';
    nodes.forEach(function (n) { el.appendChild(n); });
  }

  /* ---------- fallback: reveal everything if no motion / no GSAP ---------- */
  function revealAll() {
    $$('[data-reveal]').forEach(function (e) { e.style.opacity = 1; e.style.transform = 'none'; });
    $$('.hero__title').forEach(function (h) { splitWords(h, 'word'); });
    $$('.hero__title .word').forEach(function (w) { w.style.opacity = 1; w.style.transform = 'none'; });
    var line = $('.steps__line'); if (line) line.style.transform = 'scaleX(1)';
  }

  /* ---------- HERO: word stagger on load ---------- */
  function initHero() {
    var title = $('.hero__title');
    if (!title) return;
    splitWords(title, 'word');
    gsap.to(title.querySelectorAll('.word'), { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.05, delay: 0.15 });
    var seq = ['.hero__sub', '.hero__cta', '.scroll-ind'];
    seq.forEach(function (sel, i) {
      var el = $(sel); if (!el) return;
      gsap.from(el, { y: 22, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.5 + i * 0.14 });
    });
  }

  /* ---------- generic scroll reveal ---------- */
  function initReveal() {
    $$('[data-reveal]').forEach(function (el) {
      var d = parseFloat(el.dataset.delay || 0);
      gsap.to(el, {
        y: 0, opacity: 1, duration: 0.85, ease: 'power3.out', delay: d,
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });
  }

  /* ---------- BENTO: stack in from below ---------- */
  function initBento() {
    var grid = $('.bento'); if (!grid) return;
    gsap.from(grid.children, {
      y: 64, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: grid, start: 'top 80%' }
    });
  }

  /* ---------- PINNED "WARUM" (desktop only) ---------- */
  function initPin() {
    var wrap = $('.pin-wrap'); if (!wrap) return;
    var cards = $$('.pin-right .value-card');
    gsap.from(cards, { y: 60, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: '.pin-right', start: 'top 82%' } });

    ScrollTrigger.matchMedia({
      '(min-width: 961px)': function () {
        ScrollTrigger.create({
          trigger: wrap, start: 'top 120px', endTrigger: '.pin-right', end: 'bottom 80%',
          pin: '.pin-left', pinSpacing: false
        });
      }
    });
  }

  /* ---------- LEISTUNGEN: image scale scrub + body word reveal ---------- */
  function initServices() {
    $$('.service__media img').forEach(function (img) {
      gsap.fromTo(img, { scale: 0.85 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: img, start: 'top 90%', end: 'center center', scrub: true }
      });
      gsap.to(img, {
        opacity: 0.3, ease: 'none',
        scrollTrigger: { trigger: img.closest('.service'), start: 'bottom 70%', end: 'bottom 30%', scrub: true }
      });
    });
    $$('.scrub-text').forEach(function (p) {
      splitWords(p, 'w');
      gsap.to(p.querySelectorAll('.w'), {
        opacity: 1, ease: 'none', stagger: 0.2,
        scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 60%', scrub: true }
      });
    });
  }

  /* ---------- FAQ: GSAP height accordion ---------- */
  function initFAQ() {
    var items = $$('.faq-item'); if (!items.length) return;
    items.forEach(function (item) {
      var q = $('.faq-q', item), panel = $('.faq-panel', item), inner = $('.faq-panel__in', item);
      q.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        items.forEach(function (other) {
          if (other !== item && other.classList.contains('open')) {
            other.classList.remove('open');
            gsap.to($('.faq-panel', other), { height: 0, duration: 0.45, ease: 'power2.inOut' });
            $('.faq-q', other).setAttribute('aria-expanded', 'false');
          }
        });
        if (isOpen) {
          item.classList.remove('open');
          gsap.to(panel, { height: 0, duration: 0.45, ease: 'power2.inOut' });
          q.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('open');
          gsap.to(panel, { height: inner.offsetHeight, duration: 0.5, ease: 'power2.out',
            onComplete: function () { panel.style.height = 'auto'; } });
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- REGION badges: stagger pop-in ---------- */
  function initRegion() {
    var chips = $$('.region-chip'); if (!chips.length) return;
    gsap.from(chips, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', stagger: 0.07,
      scrollTrigger: { trigger: '.region-badges', start: 'top 85%' } });
  }

  /* ---------- KONTAKT: 3-step line draw + step pop ---------- */
  function initSteps() {
    var steps = $('.steps'); if (!steps) return;
    var tl = gsap.timeline({ scrollTrigger: { trigger: steps, start: 'top 78%' } });
    tl.from('.step', { y: 36, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.18 })
      .fromTo('.steps__line', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 0.2);
  }

  /* ---------- card spotlight (pointer-follow glow) ---------- */
  function initSpotlight() {
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- CONTACT FORM: loading / success / error states ----------
     Set FORM_ENDPOINT to your real handler (Formspree id, /api/contact, etc.).
     Empty string = demo mode: simulates a successful send so the UX is visible. */
  var FORM_ENDPOINT = '';
  function initForm() {
    var form = $('#contact-form'); if (!form) return;
    var btn = $('button[type="submit"]', form);
    var status = $('.form__status', form);
    var success = $('#form-success');
    var btnLabel = btn ? btn.textContent : '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (status) { status.textContent = ''; status.classList.remove('err'); }
      if (btn) { btn.disabled = true; btn.textContent = 'Wird gesendet...'; }

      var done = function (ok) {
        if (ok) {
          form.classList.add('is-hidden');
          if (success) success.classList.remove('is-hidden');
        } else {
          if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
          if (status) { status.classList.add('err'); status.textContent = 'Es gab einen Fehler. Bitte schreib mir direkt an info@kaiserstuhl-digital.de'; }
        }
      };

      if (!FORM_ENDPOINT) { setTimeout(function () { done(true); }, 900); return; } // demo mode
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    document.documentElement.dataset.animReady = '1'; // cancel the head failsafe
    initNav();
    initForm();
    if (!hasGSAP || reduce) { revealAll(); initFAQ(); return; }
    initHero();
    initReveal();
    initBento();
    initPin();
    initServices();
    initFAQ();
    initRegion();
    initSteps();
    initSpotlight();
    // Recover correct positions when a backgrounded tab becomes visible
    // (browsers freeze requestAnimationFrame while hidden).
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && window.ScrollTrigger) ScrollTrigger.refresh();
    });
    ScrollTrigger.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh(); });
})();
