/* ==========================================================================
   KAISERSTUHL DIGITAL - shared interactions + GSAP motion

   Ladereihenfolge pro Seite (alle defer):
     /vendor/gsap/gsap.min.js
     /vendor/gsap/ScrollTrigger.min.js
     /vendor/gsap/SplitText.min.js   (nur Inhaltsseiten)
     /vendor/lenis/lenis.min.js      (nur Inhaltsseiten)
     app.js

   Grundregel fuer jeden neuen Effekt: versteckte Anfangszustaende werden
   ausschliesslich hier per GSAP gesetzt, nie in CSS. Ohne JS, ohne GSAP oder
   bei prefers-reduced-motion existiert der Anfangszustand damit gar nicht
   erst und kein Inhalt kann unsichtbar haengen bleiben. Die beiden Ausnahmen
   sind die schon vorhandenen [data-reveal] und .hero__title .word - fuer die
   greifen .no-js, .anim-fallback und revealAll().
   ========================================================================== */
(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined';
  var reduce  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine    = window.matchMedia('(pointer: fine)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- MOTION-TOKENS ----------
     Eine Leiter statt verstreuter Einzelwerte. Die Spiegelbilder in CSS
     heissen --dur-fast / --dur-base / --dur-slow (siehe styles.css).
       fast  Hover und Feedback, muss sofort antworten
       base  Reveals beim Hereinscrollen
       slow  Hero-Auftritt, der einzige Moment mit Laenge
     Der Reveal-Versatz ist bewusst klein (14px): er soll als Aufblenden
     gelesen werden, nicht als Sprung. */
  var M = {
    fast:    0.25,
    base:    0.6,
    slow:    0.95,
    ease:    'power3.out',
    easeUI:  'power2.out',
    easeIO:  'power2.inOut',
    stagger: 0.08,
    scrub:   0.6,
    y:       14,
    start:   'top 88%'
  };

  var lenis = null;
  var drawerOpen = false;
  var clamp = function (v, max) { return Math.max(-max, Math.min(max, v)); };

  /* Schriften first: Zeilenumbrueche stehen erst fest, wenn die Webfonts da
     sind. Sonst splittet SplitText auf den Fallback-Umbruechen. */
  function whenFontsReady(cb) {
    var done = false, run = function () { if (!done) { done = true; cb(); } };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run);
      setTimeout(run, 1500);            // Sicherheitsnetz
    } else { run(); }
  }

  /* ==========================================================================
     SMOOTH SCROLL (Lenis)
     Nur mit Maus/Trackpad und nur ohne reduced motion. Auf Touch bleibt das
     native Scrollen - Lenis wuerde dort das Momentum des Systems ersetzen und
     sich schlechter anfuehlen als das Original.
     ========================================================================== */
  function initLenis() {
    if (typeof window.Lenis === 'undefined' || !fine || reduce) return;

    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false });

    // Lenis und ScrollTrigger muessen auf derselben Uhr laufen.
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // schaltet html{scroll-behavior:smooth} ab, sonst kaempfen beide
    document.documentElement.classList.add('has-lenis');

    // Ankerlinks uebernehmen. lenis.scrollTo beachtet scroll-padding-top,
    // der Nav-Versatz steht also weiterhin nur an einer Stelle (styles.css).
    document.addEventListener('click', function (e) {
      if (!lenis || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;

      var href = a.getAttribute('href') || '';
      if (href.indexOf('#') === -1) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      var norm = function (p) { return p.replace(/\/+$/, ''); };
      if (norm(url.pathname) !== norm(location.pathname)) return;   // andere Seite: normal navigieren
      if (!url.hash || url.hash === '#') return;
      var target = document.getElementById(url.hash.slice(1));
      if (!target) return;

      e.preventDefault();
      lenis.scrollTo(target);
      history.pushState(null, '', url.hash);
    });
  }

  /* ==========================================================================
     NAV: aktiver Link, Glas-Zustand, Drawer
     ========================================================================== */
  function initNav() {
    var nav = $('.nav');
    if (!nav) return;

    var norm = function (p) {
      p = (p || '').split(/[?#]/)[0].replace(/\/+$/, '');
      p = p.substring(p.lastIndexOf('/') + 1);
      return (p || 'index').replace('.html', '');
    };
    var current = norm(location.pathname);
    $$('.nav__links a, .drawer a').forEach(function (a) {
      if (a.classList.contains('nav__cta') || a.classList.contains('drawer__cta')) return;
      if (norm(a.getAttribute('href')) === current) a.classList.add('is-active');
    });

    // Glas-Zustand ueber einen Sentinel statt ueber einen Scroll-Listener
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none;';
    document.body.appendChild(sentinel);
    new IntersectionObserver(function (e) {
      nav.classList.toggle('scrolled', !e[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);

    var burger = $('.nav__burger'), drawer = $('.drawer'), scrim = $('.scrim');
    function setOpen(open) {
      if (!drawer) return;
      drawerOpen = open;
      drawer.classList.toggle('open', open);
      if (scrim) scrim.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      var s = burger.querySelectorAll('span');
      if (open) { s[0].style.transform = 'translateY(7px) rotate(45deg)'; s[1].style.opacity = '0'; s[2].style.transform = 'translateY(-7px) rotate(-45deg)'; }
      else { s.forEach(function (x) { x.style.transform = ''; x.style.opacity = ''; }); }
      document.body.style.overflow = open ? 'hidden' : '';
      if (lenis) { open ? lenis.stop() : lenis.start(); }
      // bei offenem Drawer darf die Leiste nie wegfahren
      if (open) nav.classList.remove('nav--away');
    }
    if (burger) burger.addEventListener('click', function () { setOpen(!drawer.classList.contains('open')); });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    $$('.drawer a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    var closeBtn = $('.drawer__close');
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
  }

  /* ---------- NAV-Bewegung: Fortschrittslinie + Wegfahren beim Runterscrollen ----------
     Die Linie sagt, wie weit die Seite noch geht. Das Wegfahren gibt beim
     Lesen den oberen Rand frei und holt die Navigation zurueck, sobald man
     hochscrollt, also sucht. Erst ab 400px, damit der Hero nichts flackert. */
  function initNavMotion() {
    var nav = $('.nav'); if (!nav) return;

    gsap.to(nav, {
      '--nav-progress': 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });

    ScrollTrigger.create({
      start: 400, end: 'max',
      onUpdate: function (self) {
        if (drawerOpen) { nav.classList.remove('nav--away'); return; }
        nav.classList.toggle('nav--away', self.direction === 1);
      },
      onLeaveBack: function () { nav.classList.remove('nav--away'); }
    });
  }

  /* ---------- Wortsplitter (haelt inline-Akzentspans als eigenes Wort) ---------- */
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

  /* ---------- Fallback: alles zeigen, wenn keine Bewegung / kein GSAP ---------- */
  function revealAll() {
    $$('[data-reveal]').forEach(function (e) { e.style.opacity = 1; e.style.transform = 'none'; });
    $$('.hero__title').forEach(function (h) { splitWords(h, 'word'); });
    $$('.hero__title .word').forEach(function (w) { w.style.opacity = 1; w.style.transform = 'none'; });
    var path = $('.steps__path'); if (path) path.style.strokeDashoffset = 0;
  }

  /* ==========================================================================
     HERO
     ========================================================================== */
  function initHero() {
    var title = $('.hero__title');
    if (!title) return;
    splitWords(title, 'word');

    // im Hintergrundtab friert rAF ein: Intro ueberspringen, Inhalt zeigen
    if (document.hidden) {
      gsap.set(title.querySelectorAll('.word'), { y: 0, opacity: 1 });
      gsap.set(['.hero__sub', '.hero__cta'], { clearProps: 'all' });
    } else {
      // Auf Unterseiten liegt schon der Seitenuebergang auf dem Auftritt.
      // Zwei Eingaenge hintereinander wirken zaeh, deshalb dort die kurze
      // Fassung: kaum Verzoegerung, engerer Versatz.
      var sub = title.closest('.hero--sub') !== null;
      // Zeitbudget der Startseite: das letzte Wort steht nach rund 0,95 s.
      // Die H1 ist das LCP-Element, laenger darf der Auftritt nicht dauern.
      gsap.to(title.querySelectorAll('.word'), {
        y: 0, opacity: 1, ease: M.ease,
        duration: sub ? 0.5 : 0.7,
        stagger: sub ? 0.03 : 0.04,
        delay:   sub ? 0    : 0.08
      });
      ['.hero__sub', '.hero__cta'].forEach(function (sel, i) {
        var el = $(sel); if (!el) return;
        gsap.from(el, { y: 18, opacity: 0, ease: M.ease,
          duration: sub ? 0.45 : M.base,
          delay: (sub ? 0.22 : 0.42) + i * (sub ? 0.08 : 0.12),
          clearProps: 'transform' });
      });
    }

    // Beim Wegscrollen sinkt der Hero-Inhalt leicht ab und blendet aus,
    // das Hintergrundbild zieht langsam auf. Zwei Ebenen, zwei Tempi.
    var hero = $('.hero');
    if (!hero || reduce) return;
    var inner = $('.hero__inner', hero);
    if (inner) {
      gsap.to(inner, {
        yPercent: -12, opacity: 0.25, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 }
      });
    }
    var bg = $('.hero__bg', hero);
    if (bg) {
      gsap.fromTo(bg, { scale: 1 }, {
        scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 }
      });
    }
  }

  /* ==========================================================================
     HERO-LOGO - Auftritt der Bildmarke

     Das Logo liegt seit dem Vektor-Tausch inline im Markup und ist dort
     vollstaendig sichtbar. Jeder versteckte Anfangszustand wird ausschliesslich
     hier gesetzt (Grundregel oben): ohne JS, ohne GSAP, im Hintergrundtab oder
     bei reduced motion passiert schlicht nichts und die Marke steht einfach da.

     Die Reihenfolge erzaehlt die Marke in vier Schritten:
       1 der Berg zeichnet sich als Linie und fuellt sich dahinter auf  (der Ort)
       2 der Pfeil laeuft seine eigene Richtung entlang                 (Wachstum)
       3 die Pixel stieben von der Pfeilspitze nach aussen weg          (digital)
       4 der Schriftzug setzt sich von links nach rechts                (der Name)
     Nach rund 1,15 s steht alles. Der Auftritt laeuft parallel zur H1, nicht
     davor: die H1 ist das LCP-Element und darf nicht warten.
     ========================================================================== */
  function initHeroLogo() {
    var svg = $('.hero__logo');
    if (!svg || reduce || document.hidden) return;

    var mountain = $('#kd-mountain', svg);
    var rect     = $('#kd-sweep-rect', svg);
    var pixels   = $$('#kd-pixels path', svg);
    var word     = $$('#kd-word path', svg);
    var digital  = $$('#kd-digital path', svg);
    if (!mountain || !rect) return;

    var full = rect.getAttribute('width');   // volle Breite steht im Markup

    gsap.timeline()
      /* 1 - pathLength="1" am Pfad macht die Strichlaenge unabhaengig von der
         Geometrie: 1 ist immer die ganze Kontur. Die Linie laeuft den Grat ab,
         die Flaeche zieht dahinter nach, dann verschwindet die Linie wieder. */
      .set(mountain, { fillOpacity: 0, stroke: 'currentColor', strokeWidth: 2.5,
                       strokeDasharray: 1, strokeDashoffset: 1 })
      .to(mountain, { strokeDashoffset: 0, duration: 0.60, ease: M.easeIO }, 0)
      .to(mountain, { fillOpacity: 1, duration: 0.42, ease: M.easeUI }, 0.22)
      .to(mountain, { strokeWidth: 0, duration: 0.25, ease: M.easeUI }, 0.45)

      /* 2 - der Pfeil wird nicht eingeblendet, sondern von links nach rechts
         freigegeben. Er bewegt sich dadurch in die Richtung, in die er zeigt. */
      .fromTo(rect, { attr: { width: 0 } },
                    { attr: { width: full }, duration: 0.50, ease: M.easeUI }, 0.32)

      /* 3 - die Pixel liegen in der Reihenfolge ihres Abstands zur Pfeilspitze
         im Markup, der Stagger laesst sie daher nach aussen wegstieben. */
      .from(pixels, { scale: 0, opacity: 0, transformOrigin: '50% 50%',
                      duration: 0.36, ease: 'back.out(2)', stagger: 0.04 }, 0.58)

      /* 4 - Schriftzug: kurzer Weg, enger Versatz. Soll sich setzen, nicht laufen. */
      .from(word,    { y: 14, opacity: 0, duration: 0.42, ease: M.ease,
                       stagger: 0.028 }, 0.40)
      .from(digital, { y: 9,  opacity: 0, duration: 0.38, ease: M.ease,
                       stagger: 0.025 }, 0.62);
  }

  /* ==========================================================================
     ABSCHNITTSUEBERSCHRIFTEN - Zeilen-Masken-Reveal (SplitText)
     Die Zeile schiebt sich hinter ihrer eigenen Maske hervor. Ersetzt den
     bisherigen Fade des ganzen Kopfblocks; der Absatz folgt versetzt.
     ========================================================================== */
  function collectHeadlines() {
    var out = [];
    $$('.sec-head').forEach(function (head) {
      var h2 = $('h2', head); if (!h2) return;
      head.removeAttribute('data-reveal');    // dieser Block gehoert ab jetzt uns
      out.push({ h2: h2, p: $('p', head) });
    });
    $$('.band__body h2, .case-block h2, .about__body h2, h2.contact-head').forEach(function (h2) {
      if (h2.hasAttribute('data-reveal') || h2.closest('[data-reveal]')) return;
      out.push({ h2: h2, p: null });
    });
    return out;
  }

  function hideHeadlines(items) {
    items.forEach(function (it) {
      gsap.set(it.h2, { opacity: 0 });
      if (it.p) gsap.set(it.p, { opacity: 0, y: M.y });
    });
  }

  function buildHeadlines(items) {
    if (typeof SplitText === 'undefined') {          // Plugin fehlt: schlicht aufblenden
      items.forEach(function (it) {
        gsap.to([it.h2, it.p].filter(Boolean), {
          opacity: 1, y: 0, duration: M.base, ease: M.ease, stagger: 0.1,
          scrollTrigger: { trigger: it.h2, start: M.start, once: true }
        });
      });
      return;
    }
    items.forEach(function (it) {
      SplitText.create(it.h2, {
        type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'sline',
        onSplit: function (self) {
          gsap.set(it.h2, { opacity: 1 });
          // Nach dem ersten Durchlauf nur noch den Endzustand herstellen -
          // autoSplit teilt bei Resize neu, das darf nicht neu animieren.
          if (it.done) {
            gsap.set(self.lines, { yPercent: 0 });
            if (it.p) gsap.set(it.p, { opacity: 1, y: 0 });
            return;
          }
          var tl = gsap.timeline({
            scrollTrigger: { trigger: it.h2, start: M.start, once: true },
            onComplete: function () { it.done = true; }
          });
          tl.from(self.lines, { yPercent: 108, duration: M.base, ease: M.ease, stagger: M.stagger });
          if (it.p) tl.to(it.p, { opacity: 1, y: 0, duration: M.base, ease: M.ease }, '-=0.38');
          return tl;
        }
      });
    });
  }

  /* ==========================================================================
     GENERISCHES SCROLL-REVEAL
     clearProps + Attribut entfernen: danach gehoert das Element wieder dem
     CSS, sonst blockiert das inline-transform jeden :hover-Lift.
     ========================================================================== */
  function initReveal() {
    $$('[data-reveal]').forEach(function (el) {
      var d = parseFloat(el.dataset.delay || 0);
      gsap.to(el, {
        y: 0, opacity: 1, duration: M.base, ease: M.ease, delay: d,
        scrollTrigger: { trigger: el, start: M.start },
        onComplete: function () {
          el.removeAttribute('data-reveal');
          gsap.set(el, { clearProps: 'transform,opacity' });
        }
      });
    });
  }

  /* ---------- vom CSS gesetzter Startversatz auf den Token ziehen ---------- */
  function tuneRevealOffset() {
    $$('[data-reveal]').forEach(function (el) { gsap.set(el, { y: M.y }); });
  }

  /* ==========================================================================
     MAGNETISCHE BUTTONS
     Nur die beiden Hauptaktionen, nur mit Maus. quickTo haelt die Bewegung
     ausserhalb des Renderzyklus, der Ausschlag ist auf 7px gedeckelt, damit
     der Button seine Trefferflaeche nie verlaesst.
     ========================================================================== */
  function initMagnetic() {
    if (!fine || reduce) return;
    $$('.btn--gold, .nav__cta').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
      var onMove = function (e) {
        var r = el.getBoundingClientRect();
        xTo(clamp((e.clientX - r.left - r.width / 2) * 0.3, 7));
        yTo(clamp((e.clientY - r.top - r.height / 2) * 0.5, 7));
      };
      var onLeave = function () { xTo(0); yTo(0); };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('blur', onLeave);
    });
  }

  /* ==========================================================================
     BENTO: Karten stapeln sich herein, die Icons zeichnen ihre Linien
     pathLength=1 normiert jede Form, damit dasarray/dashoffset fuer path,
     rect, circle und line gleich funktioniert.
     ========================================================================== */
  function initBento() {
    var grid = $('.bento'); if (!grid) return;
    gsap.from(grid.children, {
      y: 44, opacity: 0, duration: M.base, ease: M.ease, stagger: 0.1,
      scrollTrigger: { trigger: grid, start: 'top 80%' },
      clearProps: 'transform'
    });

    $$('.bento .icon-tile svg').forEach(function (svg) {
      var shapes = $$('path, rect, circle, line', svg);
      if (!shapes.length) return;
      shapes.forEach(function (s) {
        // pathLength normiert jede Form auf dieselbe Laenge. 100 statt 1:
        // GSAP rundet px-Werte, bei einer Spanne von 1 bliebe von der
        // Zeichenbewegung nur ein Sprung von 1 auf 0 uebrig.
        s.setAttribute('pathLength', '100');
        gsap.set(s, { strokeDasharray: 100, strokeDashoffset: 100 });
      });
      gsap.to(shapes, {
        strokeDashoffset: 0, duration: 0.85, ease: M.easeUI, stagger: 0.09,
        scrollTrigger: { trigger: svg.closest('.card'), start: 'top 85%', once: true }
      });
    });
  }

  /* ==========================================================================
     MARQUEE: GSAP-Schleife, die auf das Scrolltempo hoert
     Die Spur enthaelt den Inhalt doppelt, -50% ist genau eine Runde.
     ========================================================================== */
  function initMarquee() {
    var track = $('.marquee__track'); if (!track) return;
    var band = track.parentElement;

    track.style.animation = 'none';               // CSS-Schleife abloesen
    var loop = gsap.to(track, { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
    var setSpeed = gsap.quickTo(loop, 'timeScale', { duration: 0.6, ease: M.easeUI });
    var calmTimer = null, dir = 1;

    ScrollTrigger.create({
      trigger: band, start: 'top bottom', end: 'bottom top',
      onUpdate: function (self) {
        var v = self.getVelocity();
        if (v !== 0) dir = v < 0 ? -1 : 1;
        setSpeed(dir * gsap.utils.clamp(1, 4, 1 + Math.abs(v) / 900));
        clearTimeout(calmTimer);
        calmTimer = setTimeout(function () { setSpeed(dir); }, 180);   // wieder beruhigen
      },
      // ausserhalb des Viewports steht die Dauerbewegung still
      onToggle: function (self) { self.isActive ? loop.play() : loop.pause(); }
    });
    if (!ScrollTrigger.isInViewport(band)) loop.pause();

    if (fine) {
      band.addEventListener('mouseenter', function () { loop.pause(); });
      band.addEventListener('mouseleave', function () { if (ScrollTrigger.isInViewport(band)) loop.play(); });
    }
  }

  /* ---------- gepinnte "Warum"-Spalte (nur Desktop) ---------- */
  function initPin() {
    var wrap = $('.pin-wrap'); if (!wrap) return;
    var cards = $$('.pin-right .value-card');
    gsap.from(cards, {
      y: 40, opacity: 0, duration: M.base, ease: M.ease, stagger: 0.12,
      scrollTrigger: { trigger: '.pin-right', start: 'top 82%' }, clearProps: 'transform'
    });

    ScrollTrigger.matchMedia({
      '(min-width: 961px)': function () {
        ScrollTrigger.create({
          trigger: wrap, start: 'top 120px', endTrigger: '.pin-right', end: 'bottom 80%',
          pin: '.pin-left', pinSpacing: false
        });
      }
    });
  }

  /* ---------- wortweises Aufblenden (ueber-uns) ---------- */
  function initServices() {
    $$('.scrub-text').forEach(function (p) {
      splitWords(p, 'w');
      gsap.to(p.querySelectorAll('.w'), {
        opacity: 1, ease: 'none', stagger: 0.2,
        scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 60%', scrub: true }
      });
    });
  }

  /* ---------- FAQ-Akkordeon (einzige Stelle, die Hoehe animiert) ---------- */
  function initFAQ() {
    var items = $$('.faq-item'); if (!items.length) return;
    items.forEach(function (item) {
      var q = $('.faq-q', item), panel = $('.faq-panel', item), inner = $('.faq-panel__in', item);
      q.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        items.forEach(function (other) {
          if (other !== item && other.classList.contains('open')) {
            other.classList.remove('open');
            gsap.to($('.faq-panel', other), { height: 0, duration: 0.45, ease: M.easeIO });
            $('.faq-q', other).setAttribute('aria-expanded', 'false');
          }
        });
        if (isOpen) {
          item.classList.remove('open');
          gsap.to(panel, { height: 0, duration: 0.45, ease: M.easeIO });
          q.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('open');
          gsap.to(panel, { height: inner.offsetHeight, duration: 0.5, ease: M.easeUI,
            onComplete: function () { panel.style.height = 'auto'; } });
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Region-Chips ---------- */
  function initRegion() {
    var chips = $$('.region-chip'); if (!chips.length) return;
    gsap.from(chips, {
      scale: 0.6, opacity: 0, duration: M.base, ease: 'back.out(1.7)', stagger: 0.07,
      scrollTrigger: { trigger: '.region-badges', start: 'top 85%' }, clearProps: 'transform'
    });
  }

  /* ---------- 3 Schritte: Ziffern + gezeichnete Verbindungslinie ---------- */
  function initSteps() {
    var steps = $('.steps'); if (!steps) return;

    gsap.from($$('.step', steps), {
      y: 30, opacity: 0, duration: M.base, ease: M.ease, stagger: 0.18,
      scrollTrigger: { trigger: steps, start: 'top 80%' }, clearProps: 'transform'
    });
    gsap.from($$('.step__ghost', steps), {
      scale: 0.9, opacity: 0, duration: M.slow, ease: M.ease, stagger: 0.18,
      scrollTrigger: { trigger: steps, start: 'top 80%' }, clearProps: 'transform'
    });

    var path = $('.steps__path', steps);
    if (path) {
      gsap.fromTo(path, { strokeDashoffset: 100 }, {
        strokeDashoffset: 0, ease: 'none',
        scrollTrigger: { trigger: steps, start: 'top 72%', end: 'bottom 60%', scrub: M.scrub, invalidateOnRefresh: true }
      });
    }
  }

  /* ==========================================================================
     BILDKARTEN: Clip-Reveal von unten, Bild laeuft dabei auf Groesse
     Gilt fuer die Referenzleiste (Startseite) und das Showcase-Grid
     (/referenzen). Ein Effekt, zwei Orte, damit die Seiten zusammengehoeren.
     ========================================================================== */
  function clipReveal(media, img) {
    if (!media) return;
    gsap.set(media, { clipPath: 'inset(0% 0% 100% 0%)' });
    var tl = gsap.timeline({ scrollTrigger: { trigger: media, start: 'top 86%', once: true } });
    tl.to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: M.ease });
    if (img) {
      gsap.set(img, { scale: 1.12 });
      tl.to(img, { scale: 1, duration: 1.1, ease: M.ease, clearProps: 'transform' }, 0);
    }
    tl.set(media, { clearProps: 'clipPath' });
  }

  function initProof() {
    $$('.proof-card').forEach(function (card) {
      clipReveal($('.proof-card__media', card), $('.proof-card__media img', card));
    });
    if (!fine || reduce) return;

    // leichtes Kippen zur Maus, maximal 4 Grad
    $$('.proof-card').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        rx(((r.top + r.height / 2 - e.clientY) / r.height) * 8);
        ry(((e.clientX - r.left - r.width / 2) / r.width) * 8);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
  }

  function initShowcase() {
    var cards = $$('.showcase-card'); if (!cards.length) return;
    cards.forEach(function (card, i) {
      clipReveal($('.showcase-card__media', card), $('.showcase-card__desktop', card));
    });
    if (reduce) return;
    // Das Handy laeuft langsamer als der Desktop-Screenshot dahinter.
    ScrollTrigger.matchMedia({
      '(min-width: 768px)': function () {
        $$('.showcase-card__mobile').forEach(function (phone) {
          gsap.fromTo(phone, { yPercent: 6 }, {
            yPercent: -8, ease: 'none',
            scrollTrigger: { trigger: phone.closest('.showcase-card'), start: 'top bottom', end: 'bottom top', scrub: M.scrub, invalidateOnRefresh: true }
          });
        });
      }
    });
  }

  /* ==========================================================================
     PREISKARTEN: gestaffelt herein, das empfohlene Paket bekommt einmal
     einen Lichtschweif am Rand. Einmal, nicht im Takt - ein Dauerpuls zieht
     Aufmerksamkeit, ohne etwas zu sagen.
     ========================================================================== */
  function initPrices() {
    var feat = $('.price-card.is-feat'); if (!feat) return;

    var sheen = document.createElement('span');
    sheen.className = 'sheen';
    sheen.setAttribute('aria-hidden', 'true');
    feat.appendChild(sheen);                 // nur im Bewegungsfall ueberhaupt vorhanden

    gsap.timeline({ scrollTrigger: { trigger: feat, start: 'top 78%', once: true } })
      .set(sheen, { opacity: 1 })
      .fromTo(sheen, { backgroundPosition: '220% 0' },
                     { backgroundPosition: '-120% 0', duration: 1.5, ease: 'power2.inOut' })
      .to(sheen, { opacity: 0, duration: 0.3 }, '-=0.3');
  }

  /* ==========================================================================
     CTA-BAND: der goldene Glow folgt der Maus. Auf Touch atmet er langsam,
     aber nur solange das Band im Bild ist.
     ========================================================================== */
  function initCtaGlow() {
    var box = $('.cta-band__box'); if (!box || reduce) return;

    if (fine) {
      var setX = gsap.quickSetter(box, '--gx', '%');
      var setY = gsap.quickSetter(box, '--gy', '%');
      box.addEventListener('pointermove', function (e) {
        var r = box.getBoundingClientRect();
        setX(((e.clientX - r.left) / r.width) * 100);
        setY(((e.clientY - r.top) / r.height) * 100);
      });
      box.addEventListener('pointerleave', function () {
        gsap.to(box, { '--gx': '50%', '--gy': '0%', duration: 0.8, ease: M.easeUI });
      });
      return;
    }

    var breathe = gsap.to(box, {
      '--gy': '22%', duration: 3.6, ease: 'sine.inOut',
      yoyo: true, repeat: -1, paused: true
    });
    ScrollTrigger.create({
      trigger: box, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { self.isActive ? breathe.play() : breathe.pause(); }
    });
  }

  /* ---------- Case Study: Screenshot-Block mit Tiefe ---------- */
  function initShot() {
    var stage = $('[data-shot]'); if (!stage) return;
    var browser = $('.browser', stage), phone = $('.phone', stage);
    if (browser) {
      gsap.from(browser, {
        y: 36, opacity: 0, duration: M.slow, ease: M.ease,
        scrollTrigger: { trigger: stage, start: 'top 82%' }, clearProps: 'transform'
      });
    }
    if (!phone) return;
    gsap.from(phone, {
      y: 50, opacity: 0, duration: M.slow, ease: M.ease, delay: 0.15,
      scrollTrigger: { trigger: stage, start: 'top 82%' }
    });
    ScrollTrigger.matchMedia({
      '(min-width: 768px)': function () {
        gsap.fromTo(phone, { yPercent: 7 }, {
          yPercent: -9, ease: 'none',
          scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: M.scrub, invalidateOnRefresh: true }
        });
      }
    });
  }

  /* ---------- Leistungen: vollbreiter Bildstreifen mit langsamer Parallaxe ----------
     Das Bild ist 118% hoch und um -9% versetzt, deshalb bleibt es bei +-6%
     Versatz immer randlos. Nur gescrubbt, keine Dauerbewegung. */
  function initBand() {
    $$('[data-band]').forEach(function (band) {
      var img = $('.band__img', band); if (!img) return;
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: M.scrub, invalidateOnRefresh: true }
      });
    });
  }

  /* ---------- Karten-Spotlight (Glanz folgt dem Zeiger) ---------- */
  function initSpotlight() {
    if (!fine) return;
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ==========================================================================
     KONTAKTFORMULAR: Zustaende + gestaffeltes Einblenden + gezeichnetes Haekchen
     Formspree AJAX-Endpunkt.
     ========================================================================== */
  var FORM_ENDPOINT = 'https://formspree.io/f/xvznydkk';

  function drawCheck() {
    var ic = $('#form-success .form-success__ic svg path');
    if (!ic || !hasGSAP || reduce) return;
    ic.setAttribute('pathLength', '100');   // siehe initBento: 1 wuerde wegrunden
    gsap.fromTo(ic, { strokeDasharray: 100, strokeDashoffset: 100 },
                    { strokeDashoffset: 0, duration: 0.55, ease: M.easeUI, delay: 0.12 });
    gsap.from('#form-success .form-success__ic', { scale: 0.7, opacity: 0, duration: M.base, ease: 'back.out(1.6)' });
  }

  function initFormMotion() {
    var form = $('#contact-form'); if (!form) return;
    var rows = $$('.form-row, button[type="submit"]', form);
    if (!rows.length) return;
    gsap.from(rows, {
      y: M.y, opacity: 0, duration: M.base, ease: M.ease, stagger: 0.07,
      scrollTrigger: { trigger: form, start: 'top 85%' }, clearProps: 'transform'
    });
  }

  function initForm() {
    var form = $('#contact-form'); if (!form) return;
    var btn = $('button[type="submit"]', form);
    var status = $('.form__status', form);
    var success = $('#form-success');
    var btnLabel = btn ? btn.textContent : '';

    var PAKETE = {
      'wartung-basis': 'Wartung Basis (39 €/Monat)',
      'wartung-plus': 'Wartung Plus (79 €/Monat)',
      'bestehende-website': 'Bestehende Website übernehmen (Check 99 €)'
    };
    var interest = $('#f-interest', form);
    var paket = new URLSearchParams(location.search).get('paket');
    if (interest && paket && PAKETE[paket]) interest.value = PAKETE[paket];

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (status) { status.textContent = ''; status.classList.remove('err'); }
      if (btn) { btn.disabled = true; btn.textContent = 'Wird gesendet...'; }

      var done = function (ok) {
        if (ok) {
          form.classList.add('is-hidden');
          if (success) { success.classList.remove('is-hidden'); drawCheck(); }
        } else {
          if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
          if (status) { status.classList.add('err'); status.textContent = 'Es gab einen Fehler. Bitte schreib mir direkt an info@kaiserstuhl-digital.de'; }
        }
      };

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
    });
  }

  /* ---------- Screenshot-Rahmen: Fade nur, wenn das Bild abgeschnitten wird ---------- */
  function initShotClip() {
    $$('.browser__view').forEach(function (view) {
      var img = $('img', view); if (!img) return;
      var check = function () {
        view.classList.toggle('browser__view--clip', img.offsetHeight > view.clientHeight + 1);
      };
      if (img.complete) check(); else img.addEventListener('load', check);
      window.addEventListener('resize', check);
    });
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function boot() {
    document.documentElement.dataset.animReady = '1';   // Head-Failsafe abbestellen
    initNav();
    initForm();
    initShotClip();

    if (!hasGSAP || reduce) { revealAll(); initFAQ(); return; }

    initLenis();
    tuneRevealOffset();

    // Ueberschriften sofort verstecken, damit zwischen jetzt und fonts.ready
    // nichts aufblitzt. Gebaut wird erst, wenn die Schriften stehen.
    var heads = collectHeadlines();
    hideHeadlines(heads);
    whenFontsReady(function () { buildHeadlines(heads); ScrollTrigger.refresh(); });

    initHero();
    initHeroLogo();
    initNavMotion();
    initReveal();
    initBento();
    initMarquee();
    initPin();
    initServices();
    initFAQ();
    initRegion();
    initSteps();
    initProof();
    initShowcase();
    initPrices();
    initCtaGlow();
    initShot();
    initBand();
    initSpotlight();
    initMagnetic();
    initFormMotion();

    // Im Hintergrundtab friert rAF ein; beim Zurueckwechseln neu vermessen.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && window.ScrollTrigger) ScrollTrigger.refresh();
    });
    ScrollTrigger.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh(); });
})();
