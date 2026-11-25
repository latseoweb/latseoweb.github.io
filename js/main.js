/* ============================================================
   LatSEO - Main JavaScript
   Handles: Navigation, Language Switcher, Scroll Effects,
   Mobile Menu, Form Handling, Animations
   ============================================================ */

(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var EN = document.documentElement.lang === 'en';

  /* ==========================================================
     DOM READY
     ========================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    initMobileMenu();
    initScrollEffects();
    initScrollReveal();
    initSmoothScroll();
    initContactForm();
    initCurrentPageHighlight();
    initEventTracking();
    initAdConversionTracking();
  });

  /* ==========================================================
     MOBILE MENU
     ========================================================== */
  function initMobileMenu() {
    var toggle = document.querySelector('.header__mobile-toggle');
    var menu = document.querySelector('.header__mobile-menu');
    var links = menu ? menu.querySelectorAll('a') : [];

    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.contains('header__mobile-menu--open');
      if (isOpen) {
        closeMobileMenu(toggle, menu);
      } else {
        openMobileMenu(toggle, menu);
      }
    });

    // Close menu when a link is clicked
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileMenu(toggle, menu);
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('header__mobile-menu--open')) {
        closeMobileMenu(toggle, menu);
      }
    });
  }

  function openMobileMenu(toggle, menu) {
    toggle.classList.add('header__mobile-toggle--open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.classList.add('header__mobile-menu--open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu(toggle, menu) {
    toggle.classList.remove('header__mobile-toggle--open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('header__mobile-menu--open');
    document.body.style.overflow = '';
  }

  /* ==========================================================
     SCROLL EFFECTS (Header background, Scroll-to-top)
     ========================================================== */
  function initScrollEffects() {
    var header = document.querySelector('.site-header');
    var scrollTopBtn = document.querySelector('.scroll-top');

    if (!header && !scrollTopBtn) return;

    var ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var scrollY = window.pageYOffset;

          // Header background on scroll
          if (header) {
            if (scrollY > 50) {
              header.classList.add('site-header--scrolled');
            } else {
              header.classList.remove('site-header--scrolled');
            }
          }

          // Scroll-to-top button
          if (scrollTopBtn) {
            if (scrollY > 600) {
              scrollTopBtn.classList.add('scroll-top--visible');
            } else {
              scrollTopBtn.classList.remove('scroll-top--visible');
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    });

    // Scroll-to-top button click
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ==========================================================
     SCROLL REVEAL ANIMATIONS
     ========================================================== */
  function initScrollReveal() {
    var revealElements = document.querySelectorAll('.reveal');
    var staggerContainers = document.querySelectorAll('.reveal-stagger');

    if (revealElements.length === 0 && staggerContainers.length === 0) return;

    var observerOptions = {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.1
    };

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (entry.target.classList.contains('reveal-stagger')) {
            entry.target.classList.add('reveal-stagger--visible');
          } else {
            entry.target.classList.add('reveal--visible');
          }
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    revealElements.forEach(function (el) {
      observer.observe(el);
    });

    staggerContainers.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ==========================================================
     SMOOTH SCROLL FOR ANCHOR LINKS
     ========================================================== */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var targetId = link.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      var headerHeight = document.querySelector('.site-header')?.offsetHeight || 72;
      var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    });
  }

  /* ==========================================================
     CONTACT FORM — SECURE SUBMISSION
     Form -> Cloudflare Worker (scripts/form-worker) -> Make.com.
     The Make URL is only in the Worker's secrets. The Worker checks
     Origin, Cloudflare Turnstile, honeypot, field lengths and a per-IP limit.
     Turnstile loads only when someone starts filling a form.
     ========================================================== */
  var FORM_ENDPOINT = 'https://latseo-forma.adrians-79c.workers.dev/';
  var TURNSTILE_SITEKEY = '0x4AAAAAAGSRUIroV_qiy2QQ';
  var tsLoading = null;

  function loadTurnstile() {
    if (tsLoading) return tsLoading;
    tsLoading = new Promise(function (resolve, reject) {
      window.latseoTurnstileReady = function () { resolve(window.turnstile); };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=latseoTurnstileReady';
      s.async = true;
      s.onerror = function () { tsLoading = null; reject(new Error('turnstile')); };
      document.head.appendChild(s);
    });
    return tsLoading;
  }

  // One invisible-unless-needed Turnstile widget per form; resolves with a fresh token.
  function protectForm(form) {
    var st = { id: null, token: '', waiters: [] };
    var box = document.createElement('div');
    box.className = 'contact-form__captcha';
    var submit = form.querySelector('.contact-form__submit');
    form.insertBefore(box, submit);
    function render() {
      if (st.id !== null) return;
      st.id = 'pending';
      loadTurnstile().then(function (ts) {
        st.id = ts.render(box, {
          sitekey: TURNSTILE_SITEKEY, appearance: 'interaction-only', size: 'flexible',
          language: EN ? 'en' : 'lv', 'response-field': false,
          callback: function (t) { st.token = t; st.waiters.splice(0).forEach(function (w) { w(t); }); },
          'expired-callback': function () { st.token = ''; },
          'error-callback': function () { st.token = ''; }
        });
      }).catch(function () { st.id = null; });
    }
    form.addEventListener('focusin', render, { once: true });
    form.addEventListener('pointerdown', render, { once: true });
    return {
      token: function () {
        render();
        if (st.token) return Promise.resolve(st.token);
        return new Promise(function (resolve, reject) {
          st.waiters.push(resolve);
          setTimeout(function () { reject(new Error('captcha-timeout')); }, 15000);
        });
      },
      reset: function () {
        st.token = '';
        if (window.turnstile && st.id && st.id !== 'pending') { try { window.turnstile.reset(st.id); } catch (_) {} }
      }
    };
  }

  function initContactForm() {

    var COOLDOWN_MS = 30000;    // 30 seconds between submissions
    var MIN_FILL_TIME = 3000;   // form must take at least 3 seconds to fill

    var forms = document.querySelectorAll('.contact-form');

    forms.forEach(function (form) {
      var captcha = protectForm(form);
      // Track when user starts interacting with the form
      var formStartTime = Date.now();
      var fields = form.querySelectorAll('input:not([type="hidden"]):not([name="_honey"]), textarea');
      fields.forEach(function (field) {
        field.addEventListener('focus', function () {
          if (!formStartTime) formStartTime = Date.now();
        }, { once: true });
        field.addEventListener('input', function () {
          if (!formStartTime) formStartTime = Date.now();
        }, { once: true });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // ── HONEYPOT CHECK: bots auto-fill hidden fields ──
        var honey = form.querySelector('.contact-form__honey');
        if (honey && honey.value.trim() !== '') {
          // Silently reject — bot thinks it succeeded
          form.reset();
          return;
        }

        // ── RATE LIMIT CHECK (localStorage) ──
        try {
          var lastSubmit = localStorage.getItem('latseo_form_ts');
          var now = Date.now();
          if (lastSubmit && (now - parseInt(lastSubmit, 10)) < COOLDOWN_MS) {
            var remain = Math.ceil((COOLDOWN_MS - (now - parseInt(lastSubmit, 10))) / 1000);
            showStatus(form, EN ? 'Please wait ' + remain + ' s and try again.' : 'Lūdzu, uzgaidiet ' + remain + ' s un mēģiniet vēlreiz.', 'error');
            return;
          }
        } catch (_) { /* localStorage unavailable — allow */ }

        // ── TIME CHECK: too fast = bot ──
        var fillTime = Date.now() - formStartTime;
        if (fillTime < MIN_FILL_TIME) {
          showStatus(form, EN ? 'Please check the fields and press the button again.' : 'Lūdzu, pārbaudiet laukus un nospiediet pogu vēlreiz.', 'error');
          return;
        }

        // Basic validation
        var inputs = form.querySelectorAll('input[required], textarea[required]');
        var isValid = true;

        inputs.forEach(function (input) {
          if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#EF4444';
            input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
          } else {
            input.style.borderColor = '';
            input.style.boxShadow = '';
          }
        });

        if (!isValid) return;

        // Email validation
        var emailInput = form.querySelector('input[type="email"]');
        if (emailInput && emailInput.value.trim()) {
          var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailInput.value.trim())) {
            emailInput.style.borderColor = '#EF4444';
            emailInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
            return;
          }
        }

        // Save submission timestamp
        try {
          localStorage.setItem('latseo_form_ts', Date.now().toString());
        } catch (_) {}

        // Submit button UI feedback
        var submitBtn = form.querySelector('.contact-form__submit');
        var originalText = submitBtn.textContent;
        submitBtn.textContent = EN ? 'Sending…' : 'Notiek nosūtīšana…';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';

        // Collect form data (exclude honeypot)
        var formData = new FormData(form);
        var data = {};
        formData.forEach(function (value, key) {
          data[key] = value.trim();
        });

        // Ja kalkulatorā ir saglabāta izvēles kopsavilkums, pievieno to ziņai,
        // lai tā būtu redzama e-pasta paziņojumā ("Ziņa" laukā).
        if (data.calc_summary && data.calc_summary.trim()) {
          var summary = data.calc_summary.trim();
          data.message = (data.message && data.message.trim())
            ? data.message.trim() + "\n\n" + summary
            : summary;
        }

        // Add security metadata
        data._t = Date.now();
        data._src = window.location.href;

        // Turnstile token, then send to the Worker
        var sent = false;
        submitBtn.textContent = EN ? 'Checking…' : 'Notiek pārbaude…';
        captcha.token()
        .then(function (token) {
          data['cf-turnstile-response'] = token;
          submitBtn.textContent = EN ? 'Sending…' : 'Notiek nosūtīšana…';
          return fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            keepalive: true
          });
        })
        .then(function (response) {
          captcha.reset();     // a token works only once
          if (!response.ok) throw new Error('HTTP ' + response.status);
          sent = true;
          var redirectTarget = form.getAttribute('data-redirect');
          var go = function () { if (redirectTarget) window.location.href = redirectTarget; };
          // Konversijas tikai pēc veiksmīgas nosūtīšanas
          if (typeof gtag === 'function') {
            gtag('event', 'conversion', { 'send_to': 'AW-18351723640/d5EGCK2B59YcEPio5K5E' });
            gtag('event', 'generate_lead', {
              'lead_source': data.page_source || window.location.pathname,
              'need': data.need || '',
              'event_callback': go
            });
          }
          if (redirectTarget) {
            setTimeout(go, 1200); // ja GA4 nav pieejams
          } else {
            form.reset();
            formStartTime = Date.now();
            showStatus(form, EN ? 'Thank you, your request has been sent. I will reply within 24 hours.' : 'Paldies, pieprasījums nosūtīts. Atbildēšu 24 stundu laikā.', 'ok');
          }
        })
        .catch(function () {
          // Ļauj mēģināt vēlreiz uzreiz
          captcha.reset();
          try { localStorage.removeItem('latseo_form_ts'); } catch (_) {}
          showStatus(form, EN ? 'Sending failed. Please call +371 24424434 or email sales@latseo.com.' : 'Neizdevās nosūtīt. Lūdzu, zvaniet +371 24424434 vai rakstiet sales@latseo.com.', 'error');
        })
        .finally(function () {
          if (!sent || !form.getAttribute('data-redirect')) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '';
          }
        });
      });

      // Clear error styling on input
      form.querySelectorAll('input, textarea').forEach(function (input) {
        input.addEventListener('input', function () {
          input.style.borderColor = '';
          input.style.boxShadow = '';
        });
      });
    });
  }

  function showStatus(form, text, type) {
    var el = form.querySelector('.contact-form__status');
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('role', 'status');
      form.appendChild(el);
    }
    el.className = 'contact-form__status contact-form__status--' + type;
    el.textContent = text;
  }

  /* ==========================================================
     CURRENT PAGE HIGHLIGHT IN NAVIGATION
     ========================================================== */
  function initCurrentPageHighlight() {
    var currentPath = window.location.pathname;
    var navLinks = document.querySelectorAll('.header__nav-link');

    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // Normalize paths for comparison
      if (href === '/' && (currentPath === '/' || currentPath === '/index.html')) {
        link.classList.add('header__nav-link--active');
      } else if (href !== '/' && currentPath.includes(href.replace(/\/$/, ''))) {
        link.classList.add('header__nav-link--active');
      }
    });
  }

  /* ==========================================================
     COUNTER ANIMATION (for stat numbers)
     ========================================================== */
  function animateCounter(el, target, duration) {
    var start = 0;
    var startTime = null;
    var hasPercent = target.toString().includes('%');
    var numericTarget = parseInt(target, 10);

    if (isNaN(numericTarget)) {
      el.textContent = target;
      return;
    }

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * numericTarget);

      el.textContent = hasPercent ? current + '%' : current;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    window.requestAnimationFrame(step);
  }

  // Initialize counter animations when visible
  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var target = el.getAttribute('data-count');
        if (target && !el.dataset.counted) {
          el.dataset.counted = 'true';
          animateCounter(el, target, 2000);
        }
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(function (el) {
    counterObserver.observe(el);
  });

  /* ==========================================================
     GA4 EVENT TRACKING — WhatsApp, Phone, Form
     ========================================================== */
  function initEventTracking() {
    // Track WhatsApp clicks
    document.addEventListener('click', function (e) {
      var waLink = e.target.closest('a[href*="wa.me"]');
      if (waLink) {
        if (typeof gtag === 'function') {
          gtag('event', 'whatsapp_click', {
            'event_category': 'lead',
            'event_label': window.location.href,
            'value': 1
          });
        }
      }
    });

    // Track phone clicks (tel: links)
    document.addEventListener('click', function (e) {
      var telLink = e.target.closest('a[href^="tel:"]');
      if (telLink) {
        if (typeof gtag === 'function') {
          gtag('event', 'phone_click', {
            'event_category': 'lead',
            'event_label': telLink.getAttribute('href'),
            'value': 1
          });
        }
      }
    });

    // Track CTA button clicks
    document.addEventListener('click', function (e) {
      var ctaBtn = e.target.closest('.header__cta, .cta-section__contact-link[href*="tel:"], .btn--primary[href*="kontakti"]');
      if (ctaBtn) {
        if (typeof gtag === 'function') {
          gtag('event', 'cta_click', {
            'event_category': 'lead',
            'event_label': ctaBtn.textContent.trim() || ctaBtn.getAttribute('href'),
            'value': 1
          });
        }
      }
    });
  }

  /* ==========================================================
     GOOGLE ADS — zvana/WhatsApp klikšķi NEtiek skaitīti kā formas
     konversija (agrāk tie izmantoja to pašu konversijas ID un
     uzpūta pieteikumu skaitu). Ja vajag, izveidot atsevišķu
     konversijas darbību Google Ads un ielikt tās ID šeit.
     ========================================================== */
  function initAdConversionTracking() {}

})();

/* ============================================================
   Sīkdatņu piekrišana (Google Consent Mode v2)
   Izvēle: localStorage "latseo-consent" = {a: analītika, m: reklāma, t: datums}.
   Noklusējums (build.py <head>) ir viss "denied"; šeit tikai banneris un update.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'latseo-consent';
  var EN = document.documentElement.lang === 'en';
  var TXT = EN ? {
    text: 'We use cookies to measure visits (Google Analytics, Microsoft Clarity) and ad results (Google Ads) — only if you agree.',
    accept: 'Accept all', reject: 'Necessary only', more: 'Privacy policy', href: '/en/privacy-policy/', label: 'Cookie consent'
  } : {
    text: 'Izmantojam sīkdatnes apmeklējuma mērīšanai (Google Analytics, Microsoft Clarity) un reklāmas rezultātiem (Google Ads) — tikai ar Jūsu piekrišanu.',
    accept: 'Pieņemt visas', reject: 'Tikai nepieciešamās', more: 'Privātuma politika', href: '/privatuma-politika/', label: 'Sīkdatņu piekrišana'
  };

  function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }

  function save(all) {
    var v = all ? 'granted' : 'denied';
    try { localStorage.setItem(KEY, JSON.stringify({ a: all ? 1 : 0, m: all ? 1 : 0, t: new Date().toISOString().slice(0, 10) })); } catch (e) {}
    if (typeof gtag === 'function') {
      gtag('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });
    }
    if (all && window.latseoClarity) window.latseoClarity();
    if (!all && window.clarity) window.clarity('consent', false);
  }

  function show() {
    if (document.getElementById('consent')) return;
    var hasPolicy = !!document.querySelector('.footer__legal-links a[href="' + TXT.href + '"]');
    var box = document.createElement('div');
    box.id = 'consent';
    box.className = 'consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', TXT.label);
    box.innerHTML = '<p class="consent__text">' + TXT.text +
      (hasPolicy ? ' <a href="' + TXT.href + '">' + TXT.more + '</a>' : '') + '</p>' +
      '<div class="consent__btns"><button type="button" class="btn btn--dark consent__btn" data-c="0">' + TXT.reject + '</button>' +
      '<button type="button" class="btn btn--primary consent__btn" data-c="1">' + TXT.accept + '</button></div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      save(b.getAttribute('data-c') === '1');
      box.remove();
      document.documentElement.classList.remove('has-consent-bar');
    });
    document.body.appendChild(box);
    document.documentElement.classList.add('has-consent-bar');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!read()) show();
    document.querySelectorAll('[data-consent-open]').forEach(function (b) {
      b.addEventListener('click', function () { show(); });
    });
  });
})();
