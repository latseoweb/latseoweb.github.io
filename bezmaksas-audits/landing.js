/**
 * LatSEO Landing Page — "Bezmaksas SEO Audits"
 * Form validation, submission, and conversion tracking
 */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────
  const form = document.getElementById('lp-audit-form');
  const formWrapper = document.getElementById('lp-form-wrapper');
  const successMsg = document.getElementById('lp-success');
  const submitBtn = document.getElementById('lp-submit-btn');

  const fields = {
    name:    { el: document.getElementById('lp-name'),    err: document.getElementById('lp-name-error') },
    website: { el: document.getElementById('lp-website'), err: document.getElementById('lp-website-error') },
    email:   { el: document.getElementById('lp-email'),   err: document.getElementById('lp-email-error') },
    phone:   { el: document.getElementById('lp-phone'),   err: document.getElementById('lp-phone-error') },
  };

  // ── Validation Rules ───────────────────────────────────────
  const validators = {
    name: function (v) {
      if (!v.trim()) return 'Lūdzu, ievadi savu vārdu.';
      if (v.trim().length < 2) return 'Vārdam jābūt vismaz 2 rakstzīmēm.';
      return '';
    },
    website: function (v) {
      if (!v.trim()) return 'Lūdzu, ievadi mājaslapas adresi.';
      // Accept with or without protocol
      const withProto = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
      if (!withProto.test(v.trim())) return 'Lūdzu, ievadi derīgu mājaslapas adresi (piem., tavauzņēmums.lv).';
      return '';
    },
    email: function (v) {
      if (!v.trim()) return 'Lūdzu, ievadi e-pasta adresi.';
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(v.trim())) return 'Lūdzu, ievadi derīgu e-pasta adresi.';
      return '';
    },
    phone: function (v) {
      if (!v.trim()) return 'Lūdzu, ievadi tālruņa numuru.';
      // Strip all non-digits
      const digits = v.replace(/\D/g, '');
      if (digits.length < 8) return 'Lūdzu, ievadi derīgu tālruņa numuru (vismaz 8 cipari).';
      return '';
    },
  };

  // ── Live Validation on Input ───────────────────────────────
  Object.keys(fields).forEach(function (name) {
    fields[name].el.addEventListener('input', function () {
      validateField(name);
    });
    fields[name].el.addEventListener('blur', function () {
      validateField(name);
    });
  });

  function validateField(name) {
    const input = fields[name].el;
    const errEl = fields[name].err;
    const msg = validators[name](input.value);

    if (msg) {
      input.classList.add('error');
      errEl.textContent = msg;
      return false;
    } else {
      input.classList.remove('error');
      errEl.textContent = '';
      return true;
    }
  }

  function validateAll() {
    let allValid = true;
    Object.keys(fields).forEach(function (name) {
      if (!validateField(name)) allValid = false;
    });
    return allValid;
  }

  // ── Phone Number Formatting (Latvian style) ────────────────
  fields.phone.el.addEventListener('input', function () {
    // Let the user type freely; validation handles checking
    // Optional: auto-format could be added here
  });

  // ── Form Submission ────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validateAll()) {
      // Scroll to first error
      const firstError = form.querySelector('.error');
      if (firstError) firstError.focus();
      return;
    }

    // Disable button & show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('lp-btn-loading');

    // Collect form data
    const formData = {
      name:    fields.name.el.value.trim(),
      website: fields.website.el.value.trim(),
      email:   fields.email.el.value.trim(),
      phone:   fields.phone.el.value.trim(),
      // Capture Google Ads parameters
      gclid:   getParam('gclid') || '',
      utm_source:   getParam('utm_source') || '',
      utm_medium:   getParam('utm_medium') || '',
      utm_campaign: getParam('utm_campaign') || '',
      utm_term:     getParam('utm_term') || '',
      utm_content:  getParam('utm_content') || '',
      fbclid:  getParam('fbclid') || '',
    };

    // Log conversion event before redirect (fires in-page)
    logConversion(formData);

    /*
    ═══════════════════════════════════════════════════════════
    FORMAS BACKEND KONFIGURĀCIJA (obligāti!):
    Pirms launch, uzstādi vienu no šiem, lai saņemtu datus:

    1. Formspree (bezmaksas 50/mēn):
       Noņem window.location zemāk un aizstāj ar:
       fetch('https://formspree.io/f/TavsID', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData),
       }).then(function(){ redirectToThankYou(formData.name); })
         .catch(handleError);

    2. Vai uzstādi HTML <form action="..." method="POST">
       un noņem visu šo JS handler.
    ═══════════════════════════════════════════════════════════
    */

    // Redirect to thank-you page (page load = conversion proof)
    redirectToThankYou(formData.name);
  });

  function redirectToThankYou(name) {
    // Build thank-you URL with first name for personalization
    var firstName = name.split(' ')[0];
    var tyUrl = '../paldies/?name=' + encodeURIComponent(firstName);

    // Pass through Google Ads params for tracking continuity
    var adParams = [];
    ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'].forEach(function (p) {
      var v = getParam(p);
      if (v) adParams.push(p + '=' + encodeURIComponent(v));
    });

    if (adParams.length) {
      // Store in sessionStorage so thank-you page can still access them
      // (they'll be in the referrer header but explicit is better)
      try {
        sessionStorage.setItem('lp_ad_params', adParams.join('&'));
      } catch (e) { /* ignore */ }
    }

    window.location.href = tyUrl;
  }

  function handleError() {
    submitBtn.disabled = false;
    submitBtn.classList.remove('lp-btn-loading');
    alert('Diemžēl radās kļūda. Lūdzu, mēģini vēlreiz vai sazinies ar mums pa e-pastu: sales@latseo.com');
  }

  // ── Google Ads Conversion Tracking ─────────────────────────
  function logConversion(data) {
    // Google Ads gtag conversion
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL', // ← Nomaini uz savu
      });
    }

    // Google Analytics 4 event
    if (typeof gtag === 'function') {
      gtag('event', 'generate_lead', {
        event_category: 'landing_page',
        event_label: 'bezmaksas_audits',
        value: 1,
      });
    }

    // Facebook Pixel
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', {
        content_name: 'Bezmaksas SEO Audits',
        content_category: 'SEO',
      });
    }

    // Console log for debugging (noņem production vidē)
    console.log('✅ Conversion logged:', data);
  }

  // ── URL Parameter Helper ───────────────────────────────────
  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  // ── Smooth Scroll for Anchor Links ─────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Focus the first input if scrolling to hero
        if (targetId === '#hero') {
          setTimeout(function () {
            fields.name.el.focus({ preventScroll: true });
          }, 400);
        }
      }
    });
  });

  // ── Intersection Observer for analytics (scroll depth) ─────
  if ('IntersectionObserver' in window) {
    const observedSections = ['ko-sanemsi', 'ka-notiek', 'why-us', 'urgency', 'final-cta'];
    const sectionEls = observedSections
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    if (sectionEls.length) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              // GA4 scroll tracking
              if (typeof gtag === 'function') {
                gtag('event', 'scroll_depth', {
                  event_category: 'landing_page',
                  event_label: entry.target.id,
                });
              }
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      sectionEls.forEach(function (el) { observer.observe(el); });
    }
  }

  // ── Preserve UTM params in anchor links ────────────────────
  (function preserveUTM() {
    const currentParams = window.location.search;
    if (!currentParams) return;

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      // Store original href
      if (!link.dataset.originalHref) {
        link.dataset.originalHref = link.getAttribute('href');
      }
    });
  })();

  console.log('🚀 LatSEO Landing Page initialized — gatavs konversijām.');
})();
