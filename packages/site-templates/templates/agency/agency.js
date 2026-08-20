'use strict';
/* ==========================================================================
   NEXUS Digital Agency — agency.js
   ========================================================================== */

// ── Header scroll
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── Active nav link
(function () {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a, .mobile-nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('?')[0];
    if (href === path || (href === 'index.html' && (path === '' || path === 'index.html'))) {
      a.classList.add('active');
    }
  });
})();

// ── Mobile menu
const navToggle  = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
if (navToggle && mobileMenu) {
  navToggle.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      navToggle.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ── Scroll reveal
(function () {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

// ── Animated counters
(function () {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const run = el => {
    const target   = parseFloat(el.dataset.count);
    const suffix   = el.dataset.suffix || '';
    const prefix   = el.dataset.prefix || '';
    const duration = 1900;
    const start    = performance.now();
    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      const v = target * easeOut(p);
      el.textContent = prefix + (target % 1 === 0 ? Math.floor(v) : v.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  counters.forEach(el => io.observe(el));
})();

// ── Portfolio filter
(function () {
  const tabs  = document.querySelectorAll('.filter-tab');
  const items = document.querySelectorAll('.portfolio-full-item');
  if (!tabs.length || !items.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      items.forEach(item => {
        const show = filter === 'all' || item.dataset.category === filter;
        item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        if (show) {
          item.style.display = '';
          requestAnimationFrame(() => { item.style.opacity = '1'; item.style.transform = ''; });
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.96)';
          setTimeout(() => { if (!show) item.style.display = 'none'; }, 310);
        }
      });
    });
  });
})();

// ── Contact form
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn  = form.querySelector('[type="submit"]');
    const orig = btn.textContent;
    btn.disabled   = true;
    btn.textContent = 'Sending…';
    setTimeout(() => {
      btn.textContent = 'Message Sent ✓';
      btn.style.background = 'var(--green)';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = orig;
        btn.style.background = '';
        form.reset();
      }, 3000);
    }, 1200);
  });
})();

// ── Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ── Hero typewriter (cycles accent word)
(function () {
  const el = document.getElementById('heroAccent');
  if (!el) return;
  const words = ['experiences', 'products', 'brands', 'futures'];
  let idx = 0, charIdx = words[0].length, deleting = false;
  const tick = () => {
    const word = words[idx];
    if (!deleting) {
      charIdx++;
      el.textContent = word.slice(0, charIdx);
      if (charIdx === word.length) { deleting = true; setTimeout(tick, 2400); return; }
    } else {
      charIdx--;
      el.textContent = word.slice(0, charIdx);
      if (charIdx === 0) { deleting = false; idx = (idx + 1) % words.length; }
    }
    setTimeout(tick, deleting ? 55 : 95);
  };
  setTimeout(tick, 2000);
})();

// ── Blog category filter
(function () {
  const tabs  = document.querySelectorAll('.blog-filter-tab');
  const cards = document.querySelectorAll('.blog-filterable');
  if (!tabs.length || !cards.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;
      cards.forEach(card => {
        const show = cat === 'all' || card.dataset.cat === cat;
        card.style.transition = 'opacity 0.3s ease';
        if (show) {
          card.style.display = '';
          requestAnimationFrame(() => { card.style.opacity = '1'; });
        } else {
          card.style.opacity = '0';
          setTimeout(() => { card.style.display = 'none'; }, 310);
        }
      });
    });
  });
})();
