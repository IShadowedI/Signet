'use strict';

/* ================================================
   DATA
================================================ */
const MH_PRODUCTS = [
  { id: 1,  name: 'Essential Oversized Hoodie', gender: 'unisex', category: 'sweatshirts', price: 42, originalPrice: 65, discount: 35, badge: 'Sale', rating: 4.6, reviews: 312, colors: ['#3b3b3b','#c0a080','#e8d5c5'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80' },
  { id: 2,  name: 'Slim Fit Stretch Jeans', gender: 'men', category: 'bottoms', price: 55, originalPrice: 80, discount: 31, badge: 'Hot', rating: 4.4, reviews: 218, colors: ['#1a1a2e','#6b7280','#4b3621'], sizes: ['28','30','32','34','36'], img: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=80' },
  { id: 3,  name: 'Floral Wrap Midi Dress', gender: 'women', category: 'dresses', price: 68, originalPrice: 95, discount: 28, badge: 'New', rating: 4.8, reviews: 145, colors: ['#f8c8d4','#7fbfb0','#fde68a'], sizes: ['XS','S','M','L'], img: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80' },
  { id: 4,  name: 'Performance Run Jacket', gender: 'unisex', category: 'activewear', price: 89, originalPrice: 120, discount: 26, badge: 'Sale', rating: 4.5, reviews: 97, colors: ['#111','#e5e7eb','#3b82f6'], sizes: ['S','M','L','XL'], img: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&q=80' },
  { id: 5,  name: 'Double Breasted Blazer', gender: 'unisex', category: 'outerwear', price: 112, originalPrice: 160, discount: 30, badge: 'Sale', rating: 4.7, reviews: 88, colors: ['#1a1a1a','#a0856b','#d4c5a9'], sizes: ['XS','S','M','L','XL','XXL'], img: 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=400&q=80' },
  { id: 6,  name: 'Cropped Ribbed Tank Top', gender: 'women', category: 'activewear', price: 24, originalPrice: 35, discount: 31, badge: null, rating: 4.3, reviews: 274, colors: ['#fff','#e5e7eb','#4b5563','#fde68a'], sizes: ['XS','S','M','L'], img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80' },
  { id: 7,  name: 'Plaid Wool Overcoat', gender: 'unisex', category: 'outerwear', price: 148, originalPrice: 220, discount: 33, badge: 'Sale', rating: 4.9, reviews: 63, colors: ['#4a3728','#6b6b6b','#d4c5a9'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1479936343636-73cdc5aae0c3?w=400&q=80' },
  { id: 8,  name: 'Classic Oxford Shirt', gender: 'men', category: 'tops', price: 38, originalPrice: 55, discount: 31, badge: null, rating: 4.2, reviews: 192, colors: ['#fff','#dbeafe','#fce7f3','#4b5563'], sizes: ['XS','S','M','L','XL','XXL'], img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80' },
  { id: 9,  name: 'Zip-Up Cropped Sweatshirt', gender: 'women', category: 'sweatshirts', price: 47, originalPrice: 70, discount: 33, badge: 'Hot', rating: 4.5, reviews: 156, colors: ['#fef3c7','#d1fae5','#ede9fe'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80' },
  { id: 10, name: 'High Waist Yoga Leggings', gender: 'women', category: 'activewear', price: 52, originalPrice: 75, discount: 31, badge: null, rating: 4.7, reviews: 383, colors: ['#111','#9ca3af','#6d28d9','#ec4899'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80' },
];

const FP_PRODUCTS = [
  { id: 11, name: 'Satin Slip Skirt', gender: 'women', category: 'skirts', price: 44, originalPrice: 62, discount: 29, badge: 'New', rating: 4.6, reviews: 201, colors: ['#d4c5a9','#e879f9','#000'], sizes: ['XS','S','M','L'], img: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&q=80' },
  { id: 12, name: 'Relaxed Cargo Trousers', gender: 'men', category: 'bottoms', price: 59, originalPrice: 85, discount: 31, badge: null, rating: 4.3, reviews: 128, colors: ['#4b3621','#1a1a1a','#6b7280'], sizes: ['28','30','32','34','36'], img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80' },
  { id: 13, name: 'Leather Look Biker Jacket', gender: 'unisex', category: 'outerwear', price: 135, originalPrice: 195, discount: 31, badge: 'Hot', rating: 4.8, reviews: 77, colors: ['#111','#4a3728'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80' },
  { id: 14, name: 'Broderie Anglaise Blouse', gender: 'women', category: 'tops', price: 39, originalPrice: 58, discount: 33, badge: 'Sale', rating: 4.4, reviews: 165, colors: ['#fff','#fce7f3','#dbeafe'], sizes: ['XS','S','M','L'], img: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=400&q=80' },
  { id: 15, name: 'Tailored Wide Leg Trousers', gender: 'women', category: 'bottoms', price: 72, originalPrice: 100, discount: 28, badge: 'New', rating: 4.7, reviews: 94, colors: ['#1a1a1a','#d4c5a9','#6b7280'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&q=80' },
  { id: 16, name: 'Ribbed Turtleneck Jumper', gender: 'unisex', category: 'sweatshirts', price: 55, originalPrice: 80, discount: 31, badge: null, rating: 4.5, reviews: 243, colors: ['#c0a080','#fff','#1a1a1a','#d4c5a9'], sizes: ['XS','S','M','L','XL'], img: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80' },
];

/* ================================================
   CART STATE
================================================ */
let cart = JSON.parse(localStorage.getItem('cl_cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('cl_wish') || '[]');

const ALL_PRODUCTS = [...MH_PRODUCTS, ...FP_PRODUCTS];

function saveCart() { localStorage.setItem('cl_cart', JSON.stringify(cart)); }
function saveWish() { localStorage.setItem('cl_wish', JSON.stringify(wishlist)); }

/* ================================================
   HELPERS
================================================ */
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

function stars(r) {
  const full = Math.round(r);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/* ================================================
   RENDER PRODUCT CARD
================================================ */
function renderProductCard(p) {
  const isSaved = wishlist.includes(p.id);
  const badgeHtml = p.badge
    ? `<span class="prod-badge prod-badge--${p.badge.toLowerCase()}">${p.badge}</span>`
    : '';
  const swatchHtml = (p.colors || []).slice(0, 4).map(c =>
    `<span class="prod-swatch" style="background:${c}"></span>`
  ).join('');

  const el = document.createElement('div');
  el.className = 'prod-card';
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="prod-card__img">
      <img src="${p.img}" alt="${p.name}" loading="lazy" />
      ${badgeHtml}
      <button class="prod-card__wish${isSaved ? ' active' : ''}" data-id="${p.id}" aria-label="Wishlist">
        <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>
      <button class="prod-card__add" data-id="${p.id}">+ Add to Bag</button>
    </div>
    <div class="prod-card__info">
      <div class="prod-card__rating">
        <span class="pc-stars">${stars(p.rating)}</span>
        <span>(${p.reviews})</span>
      </div>
      <div class="prod-card__name">${p.name}</div>
      <div class="prod-card__pricing">
        <span class="prod-card__price">$${p.price.toFixed(2)}</span>
        ${p.originalPrice ? `<span class="prod-card__original">$${p.originalPrice.toFixed(2)}</span>` : ''}
      </div>
      ${swatchHtml ? `<div class="prod-card__colors">${swatchHtml}</div>` : ''}
    </div>
  `;

  el.querySelector('.prod-card__add').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(p.id);
  });

  el.querySelector('.prod-card__wish').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWish(p.id, e.currentTarget);
  });

  // Clicking the card (not the buttons) goes to product page
  el.addEventListener('click', (e) => {
    if (e.target.closest('.prod-card__add') || e.target.closest('.prod-card__wish')) return;
    location.href = `product.html?id=${p.id}`;
  });
  el.style.cursor = 'pointer';

  return el;
}

/* ================================================
   CART
================================================ */
function addToCart(productId) {
  const p = ALL_PRODUCTS.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(c => c.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1, size: p.sizes ? p.sizes[0] : '' });
  }
  saveCart();
  updateCartUI();
  showToast(`${p.name} added to bag`);
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.id !== productId);
  saveCart();
  updateCartUI();
}

function updateCartQty(productId, delta) {
  const item = cart.find(c => c.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const badge = document.getElementById('cartBadge');
  const mcCount = document.getElementById('mcCount');
  const mcBody = document.getElementById('mcBody');
  const mcFt = document.getElementById('mcFt');
  const mcSub = document.getElementById('mcSubtotal');

  const total = cart.reduce((a, c) => a + c.qty, 0);
  if (badge) badge.textContent = total;
  const badgeM = document.getElementById('cartBadgeMobile');
  if (badgeM) badgeM.textContent = total;
  if (mcCount) mcCount.textContent = `(${total})`;

  if (!mcBody) return;

  if (cart.length === 0) {
    mcBody.innerHTML = `<div class="mc-empty"><p>Your bag is empty</p><button class="btn btn--dark" id="mcContShop">Continue Shopping</button></div>`;
    const btn = document.getElementById('mcContShop');
    if (btn) btn.addEventListener('click', () => closeMiniCart());
    if (mcFt) mcFt.style.display = 'none';
    return;
  }

  let subtotal = 0;
  const rows = cart.map(item => {
    const p = ALL_PRODUCTS.find(x => x.id === item.id);
    if (!p) return '';
    subtotal += p.price * item.qty;
    return `
      <div class="mc-item" data-id="${p.id}">
        <div class="mc-item__img"><img src="${p.img}" alt="${p.name}" /></div>
        <div>
          <div class="mc-item__name">${p.name}</div>
          <div class="mc-item__meta">Size: ${item.size}</div>
          <div class="mc-item__row">
            <span class="mc-item__price">$${(p.price * item.qty).toFixed(2)}</span>
            <div class="mc-qty">
              <button class="mc-minus" data-id="${p.id}">−</button>
              <span>${item.qty}</span>
              <button class="mc-plus" data-id="${p.id}">+</button>
              <button class="mc-remove" data-id="${p.id}" style="margin-left:6px;font-size:0.8rem;color:var(--mid-gray)">✕</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  mcBody.innerHTML = rows;
  mcBody.querySelectorAll('.mc-minus').forEach(b => b.addEventListener('click', () => updateCartQty(+b.dataset.id, -1)));
  mcBody.querySelectorAll('.mc-plus').forEach(b => b.addEventListener('click', () => updateCartQty(+b.dataset.id, 1)));
  mcBody.querySelectorAll('.mc-remove').forEach(b => b.addEventListener('click', () => removeFromCart(+b.dataset.id)));

  if (mcFt) {
    mcFt.style.display = 'flex';
    const checkoutBtn = mcFt.querySelector('.btn--dark.btn-block');
    if (checkoutBtn) checkoutBtn.onclick = () => location.href = 'cart.html';
  }
  if (mcSub) mcSub.textContent = `$${subtotal.toFixed(2)}`;
}

/* ================================================
   WISHLIST
================================================ */
function toggleWish(productId, btn) {
  const p = ALL_PRODUCTS.find(x => x.id === productId);
  if (!p) return;

  if (wishlist.includes(productId)) {
    wishlist = wishlist.filter(id => id !== productId);
    if (btn) {
      btn.classList.remove('active');
      const path = btn.querySelector('path');
      if (path) path.setAttribute('fill', 'none');
    }
    showToast(`Removed from wishlist`);
  } else {
    wishlist.push(productId);
    if (btn) {
      btn.classList.add('active');
      const path = btn.querySelector('path');
      if (path) path.setAttribute('fill', 'currentColor');
    }
    showToast(`${p.name} saved to wishlist`);
  }
  saveWish();
}

/* ================================================
   ANNOUNCEMENT BAR
================================================ */
(function initAnn() {
  const ann = document.getElementById('ann');
  const inner = document.getElementById('annInner');
  if (!ann || !inner) return;

  const msgs = inner.querySelectorAll('.ann__msg');
  let current = 0;

  function showMsg(i) {
    msgs.forEach((m, idx) => {
      m.classList.toggle('active', idx === i);
      m.style.opacity = idx === i ? '1' : '0';
      m.style.transform = idx === i ? 'translateY(0)' : 'translateY(14px)';
    });
  }

  const intervalId = setInterval(() => {
    current = (current + 1) % msgs.length;
    showMsg(current);
  }, 4200);

  const closeBtn = document.getElementById('annClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      ann.classList.add('hidden');
      clearInterval(intervalId);
    });
  }
})();

/* ================================================
   HEADER SCROLL
================================================ */
(function initHeaderScroll() {
  const header = document.getElementById('siteHeader');
  if (!header) return;
  const onScroll = () => {
    header.style.boxShadow = window.scrollY > 40
      ? '0 4px 20px rgba(0,0,0,0.12)'
      : '';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ================================================
   SEARCH TOGGLE
================================================ */
(function initSearch() {
  const input = document.getElementById('headerSearch');
  const submitBtn = document.getElementById('searchSubmit');
  if (!submitBtn || !input) return;

  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) showToast(`Searching for "${q}"…`);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) showToast(`Searching for "${q}"…`);
    }
  });
})();

/* ================================================
   HERO SLIDER
================================================ */
(function initHero() {
  const slides = document.querySelectorAll('.hero__slide');
  const dots = document.querySelectorAll('.hdot');
  if (!slides.length) return;

  let current = 0;
  let timer;

  function goTo(i) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (i + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  }

  function startAuto() {
    timer = setInterval(() => goTo(current + 1), 5500);
  }

  function resetAuto() {
    clearInterval(timer);
    startAuto();
  }

  document.getElementById('heroPrev')?.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  document.getElementById('heroNext')?.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

  dots.forEach(d => {
    d.addEventListener('click', () => { goTo(+d.dataset.idx); resetAuto(); });
  });

  startAuto();
})();

/* ================================================
   COPY DISCOUNT CODE
================================================ */
(function initCopy() {
  const btn = document.getElementById('copyBtn');
  const code = document.getElementById('copyCode');
  if (!btn || !code) return;
  btn.addEventListener('click', () => {
    const txt = code.textContent.trim();
    navigator.clipboard?.writeText(txt).then(() => {
      showToast(`Code "${txt}" copied!`);
    }).catch(() => {
      showToast(`Code: ${txt}`);
    });
  });
})();

/* ================================================
   MUST HAVE CAROUSEL
================================================ */
(function initMustHave() {
  const carousel = document.getElementById('mhCarousel');
  if (!carousel) return;

  function renderMH(cat) {
    carousel.innerHTML = '';
    const list = cat === 'all' ? MH_PRODUCTS : MH_PRODUCTS.filter(p => p.category === cat);
    list.forEach(p => carousel.appendChild(renderProductCard(p)));
  }

  document.querySelectorAll('.mh-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mh-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderMH(tab.dataset.cat);
    });
  });

  document.getElementById('mhPrev')?.addEventListener('click', () => {
    carousel.scrollBy({ left: -420, behavior: 'smooth' });
  });
  document.getElementById('mhNext')?.addEventListener('click', () => {
    carousel.scrollBy({ left: 420, behavior: 'smooth' });
  });

  renderMH('all');
})();

/* ================================================
   FEATURED PRODUCTS CAROUSEL
================================================ */
(function initFeatured() {
  const carousel = document.getElementById('fpCarousel');
  if (!carousel) return;

  FP_PRODUCTS.forEach(p => carousel.appendChild(renderProductCard(p)));

  document.getElementById('fpPrev')?.addEventListener('click', () => {
    carousel.scrollBy({ left: -440, behavior: 'smooth' });
  });
  document.getElementById('fpNext')?.addEventListener('click', () => {
    carousel.scrollBy({ left: 440, behavior: 'smooth' });
  });
})();

/* ================================================
   MINI CART TOGGLE
================================================ */
function openMiniCart() {
  document.getElementById('miniCart')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('show');
}
function closeMiniCart() {
  document.getElementById('miniCart')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
}

document.getElementById('cartToggle')?.addEventListener('click', openMiniCart);
document.getElementById('cartToggleMobile')?.addEventListener('click', openMiniCart);
document.getElementById('closeMiniCart')?.addEventListener('click', closeMiniCart);
document.getElementById('overlay')?.addEventListener('click', closeMiniCart);

/* ================================================
   FOOTER FORM
================================================ */
document.getElementById('footerForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input[type="email"]');
  if (input?.value) {
    showToast('Thanks for subscribing!');
    input.value = '';
  }
});

/* ================================================
   SCROLL REVEAL
================================================ */
(function initReveal() {
  const targets = document.querySelectorAll('.section-gap, .trust-bar, .discount-tiers');
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  targets.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
    obs.observe(el);
  });
})();

/* ================================================
   MOBILE MENU
================================================ */
(function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  if (!btn) return;

  // Create drawer if not present
  let drawer = document.getElementById('mobileDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobileDrawer';
    drawer.style.cssText = `
      position:fixed;top:0;left:-100%;width:min(300px,90vw);height:100vh;
      background:var(--white);z-index:1100;
      display:flex;flex-direction:column;
      box-shadow:4px 0 20px rgba(0,0,0,0.15);
      transition:left 0.35s cubic-bezier(0.25,0.46,0.45,0.94);
      overflow-y:auto;padding:20px;
    `;
    const drawerLinks = [
      { label: 'New In',       href: 'shop.html?cat=new' },
      { label: 'Women',        href: 'shop.html?cat=women' },
      { label: 'Men',          href: 'shop.html?cat=men' },
      { label: 'Sale',         href: 'shop.html?cat=sale' },
      { label: 'Collections',  href: 'lookbook.html' },
      { label: 'Brands',       href: 'shop.html' },
    ];
    drawer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <span style="font-family:var(--serif);font-size:1.3rem;font-weight:700;">Clothing</span>
        <button id="closeDrawer" style="font-size:1.8rem;line-height:1;color:var(--mid-gray);">&#215;</button>
      </div>
      <nav style="display:flex;flex-direction:column;gap:2px;">
        ${drawerLinks.map(l =>
          `<a href="${l.href}" style="display:block;padding:12px 0;border-bottom:1px solid var(--border);font-size:0.82rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);">${l.label}</a>`
        ).join('')}
        <a href="account.html" style="display:block;padding:12px 0;border-bottom:1px solid var(--border);font-size:0.82rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);">My Account</a>
        <a href="wishlist.html" style="display:block;padding:12px 0;border-bottom:1px solid var(--border);font-size:0.82rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);">Wishlist</a>
      </nav>
    `;
    document.body.appendChild(drawer);
    document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    drawer.style.left = '0';
    document.getElementById('overlay')?.classList.add('show');
  }
  function closeDrawer() {
    drawer.style.left = '-100%';
    document.getElementById('overlay')?.classList.remove('show');
  }

  btn.addEventListener('click', openDrawer);
  document.getElementById('overlay')?.addEventListener('click', () => {
    closeDrawer();
    closeMiniCart();
  });
})();

/* ================================================
   DARK MODE
================================================ */
(function initDarkMode() {
  const btn = document.getElementById('darkModeToggle');
  if (!btn) return;
  function applyDark(on) {
    document.body.classList.toggle('dark-mode', on);
    localStorage.setItem('cl_dark', on ? '1' : '');
  }
  applyDark(localStorage.getItem('cl_dark') === '1');
  btn.addEventListener('click', () => applyDark(!document.body.classList.contains('dark-mode')));
})();

/* ================================================
   INIT
================================================ */
updateCartUI();
