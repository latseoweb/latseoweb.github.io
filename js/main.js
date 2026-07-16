/* ============================================================
   LatSEO - Main JavaScript
   Handles: Navigation, Language Switcher, Scroll Effects,
   Mobile Menu, Form Handling, Animations
   ============================================================ */

(function () {
  'use strict';

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
    menu.classList.add('header__mobile-menu--open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu(toggle, menu) {
    toggle.classList.remove('header__mobile-toggle--open');
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
     Webhook URL is encoded to prevent scraping from public repo.
     Protections: honeypot, rate-limit, time-check, encoded URL.
     ========================================================== */
  function initContactForm() {
    // Decode webhook URL (base64 encoded to hide from scrapers)
    var WEBHOOK = atob('aHR0cHM6Ly9ob29rLmV1MS5tYWtlLmNvbS9vbWJmb2pkcWhzY3NwcnM1ODg3bjJuZjd1Y2RjM2dsNw==');

    var COOLDOWN_MS = 30000;    // 30 seconds between submissions
    var MIN_FILL_TIME = 3000;   // form must take at least 3 seconds to fill

    var forms = document.querySelectorAll('.contact-form');

    forms.forEach(function (form) {
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
            var submitBtn = form.querySelector('.contact-form__submit');
            var remain = Math.ceil((COOLDOWN_MS - (now - parseInt(lastSubmit, 10))) / 1000);
            submitBtn.textContent = 'Uzgaidi ' + remain + 's...';
            submitBtn.style.background = '#F59E0B';
            submitBtn.style.opacity = '1';
            setTimeout(function () {
              submitBtn.textContent = 'Submit';
              submitBtn.style.background = '';
              submitBtn.style.opacity = '';
            }, 2000);
            return;
          }
        } catch (_) { /* localStorage unavailable — allow */ }

        // ── TIME CHECK: too fast = bot ──
        var fillTime = Date.now() - formStartTime;
        if (fillTime < MIN_FILL_TIME) {
          var submitBtn2 = form.querySelector('.contact-form__submit');
          submitBtn2.textContent = 'Pārāk ātri!';
          submitBtn2.style.background = '#EF4444';
          submitBtn2.style.opacity = '1';
          setTimeout(function () {
            submitBtn2.textContent = 'Submit';
            submitBtn2.style.background = '';
            submitBtn2.style.opacity = '';
          }, 2000);
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
        submitBtn.textContent = 'Notiek nosūtīšana...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';

        // Collect form data (exclude honeypot)
        var formData = new FormData(form);
        var data = {};
        formData.forEach(function (value, key) {
          if (key !== '_honey') {
            data[key] = value.trim();
          }
        });
        // Add security metadata
        data._t = Date.now();
        data._src = window.location.href;

        // Send to Make.com webhook (URL encoded in code)
        fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        .then(function (response) {
          if (response.ok) {
            submitBtn.textContent = '✓ Nosūtīts!';
            submitBtn.style.background = '#10B981';
            submitBtn.style.opacity = '1';
            submitBtn.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)';
            form.reset();
            formStartTime = Date.now(); // reset timer
          } else {
            submitBtn.textContent = 'Kļūda! Mēģini vēlreiz';
            submitBtn.style.background = '#EF4444';
            submitBtn.style.opacity = '1';
          }
        })
        .catch(function () {
          submitBtn.textContent = 'Kļūda! Mēģini vēlreiz';
          submitBtn.style.background = '#EF4444';
          submitBtn.style.opacity = '1';
        })
        .finally(function () {
          setTimeout(function () {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
            submitBtn.style.opacity = '';
            submitBtn.style.boxShadow = '';
          }, 3000);
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

})();
