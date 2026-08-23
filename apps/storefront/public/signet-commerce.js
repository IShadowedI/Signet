/*
 * Signet universal commerce runtime.
 *
 * This single script is injected into EVERY client store page (any template),
 * so that products always link to product pages, catalogs uploaded via CSV in
 * the dashboard render cleanly, and purchases flow through to orders + invoices.
 *
 * It reads window.__SIGNET__ = { slug, apiBase } and wires any page that uses
 * the data-signet-* hooks below. Every hook is optional; a page uses only what
 * it needs.
 *
 *   Catalog grid:     [data-signet-catalog]
 *   Cart badge:       [data-signet-cart-count]  (also #cartCount / .cart-count)
 *   Product detail:   [data-signet-name] [data-signet-price] [data-signet-description]
 *                     [data-signet-image] [data-signet-color] [data-signet-size]
 *                     [data-signet-qty] [data-signet-add-detail]
 *   Cart page:        [data-signet-cart-items] [data-signet-cart-subtotal]
 *                     [data-signet-cart-total] [data-signet-cart-empty]
 *   Checkout:         [data-signet-checkout-summary] [data-signet-checkout-total]
 *                     [data-signet-email] [data-signet-po] [data-signet-place-order]
 *                     [data-signet-confirmation]
 */
(function () {
  "use strict";

  var CONFIG = window.__SIGNET__ || {};
  var SLUG = CONFIG.slug || (location.pathname.match(/\/store\/([^/]+)/) || [])[1] || "";
  var API = (CONFIG.apiBase || "").replace(/\/$/, "");
  var BASE = "/store/" + SLUG + "/";

  function api(path) {
    return API + path;
  }
  function storeUrl(rel) {
    return BASE + String(rel).replace(/^\//, "");
  }
  function money(n) {
    var v = Number(n || 0);
    return "$" + v.toFixed(2);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- cart (shared localStorage contract) ---------------- */

  var CART_KEY = "signet_cart_" + SLUG;

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function writeCart(lines) {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
    window.dispatchEvent(new CustomEvent("signet-cart-change", { detail: { slug: SLUG } }));
    paintCount();
  }
  function cartCount() {
    return readCart().reduce(function (s, l) {
      return s + l.quantity;
    }, 0);
  }
  function cartTotal() {
    return readCart().reduce(function (s, l) {
      return s + l.unitPrice * l.quantity;
    }, 0);
  }
  function addLine(line) {
    var lines = readCart();
    var existing = lines.filter(function (l) {
      return l.sku === line.sku;
    })[0];
    if (existing) existing.quantity += line.quantity;
    else lines.push(line);
    writeCart(lines);
  }
  function setQty(sku, qty) {
    var lines = readCart().map(function (l) {
      return l.sku === sku ? Object.assign({}, l, { quantity: qty }) : l;
    });
    writeCart(
      lines.filter(function (l) {
        return l.quantity > 0;
      })
    );
  }
  function removeLine(sku) {
    setQty(sku, 0);
  }
  function clearCart() {
    writeCart([]);
  }

  /* ---------------- data ---------------- */

  var STORE = null;
  function loadStore() {
    if (STORE) return Promise.resolve(STORE);
    return fetch(api("/api/storefront/" + encodeURIComponent(SLUG)), { credentials: "include" })
      .then(function (r) {
        return r.ok ? r.json() : { products: [] };
      })
      .then(function (data) {
        STORE = data;
        return data;
      })
      .catch(function () {
        STORE = { products: [] };
        return STORE;
      });
  }
  function findProduct(id) {
    return (STORE.products || []).filter(function (p) {
      return p.id === id;
    })[0];
  }

  /* ---------------- cart badge ---------------- */

  function paintCount() {
    var n = cartCount();
    var nodes = document.querySelectorAll("[data-signet-cart-count], #cartCount, .cart-count");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = String(n);
  }

  /* ---------------- catalog grid ---------------- */

  function categoryOf(p) {
    var text = ((p.name || "") + " " + (p.brand || "") + " " + (p.description || "")).toLowerCase();
    var map = ["apparel", "office", "equipment", "accessories"];
    for (var i = 0; i < map.length; i++) if (text.indexOf(map[i]) !== -1) return map[i];
    return "all";
  }

  function renderCatalog(grid) {
    var products = STORE.products || [];
    if (!products.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;color:#888;padding:2rem 0">No products in this store yet.</p>';
      return;
    }
    grid.innerHTML = products
      .map(function (p) {
        var price = p.fromPrice != null ? p.fromPrice : (p.variants && p.variants[0] ? p.variants[0].price : 0);
        var img = p.imageUrl
          ? '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" style="width:100%;height:100%;object-fit:cover">'
          : '<div class="product-placeholder">' + esc(p.name) + "</div>";
        return (
          '<article class="product-card" data-category="' +
          categoryOf(p) +
          '">' +
          '<a class="product-image" href="' +
          storeUrl("product/" + p.id) +
          '" style="display:block">' +
          img +
          "</a>" +
          '<div class="product-info">' +
          '<div class="product-category">' +
          esc(p.brand || "Catalog") +
          "</div>" +
          '<h3><a href="' +
          storeUrl("product/" + p.id) +
          '">' +
          esc(p.name) +
          "</a></h3>" +
          '<p class="product-description">' +
          esc(p.description || "") +
          "</p>" +
          '<div class="product-bottom">' +
          '<div class="price">' +
          money(price) +
          " <span>/ unit</span></div>" +
          '<button class="add-button" data-signet-add="' +
          p.id +
          '" aria-label="Add ' +
          esc(p.name) +
          '">+</button>' +
          "</div></div></article>"
        );
      })
      .join("");
  }

  /* ---------------- product detail ---------------- */

  function currentProductId() {
    var m = location.pathname.match(/\/product\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
    var q = new URLSearchParams(location.search).get("product") || new URLSearchParams(location.search).get("id");
    return q || null;
  }

  function fillProductDetail() {
    var mount = document.querySelector("[data-signet-name], [data-signet-add-detail]");
    if (!mount) return;
    var id = currentProductId();
    var p = id ? findProduct(id) : (STORE.products || [])[0];
    if (!p) return;
    var variants = p.variants || [];
    var price = p.fromPrice != null ? p.fromPrice : variants[0] ? variants[0].price : 0;

    setText("[data-signet-name]", p.name);
    setText("[data-signet-description]", p.description || "");
    setText("[data-signet-price]", money(price));
    var imageEl = document.querySelector("[data-signet-image]");
    if (imageEl && p.imageUrl) {
      imageEl.innerHTML = '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" style="width:100%;height:100%;object-fit:cover">';
    }

    var colors = uniq(
      variants
        .map(function (v) {
          return v.color;
        })
        .filter(Boolean)
    );
    var sizes = uniq(
      variants
        .map(function (v) {
          return v.size;
        })
        .filter(Boolean)
    );
    fillSelect("[data-signet-color]", colors, null);
    fillSelect("[data-signet-size]", sizes, "Select a size");

    var addBtn = document.querySelector("[data-signet-add-detail]");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var color = valueOf("[data-signet-color]");
        var size = valueOf("[data-signet-size]");
        if (sizes.length && (!size || size === "Select a size")) {
          alert("Please select a size.");
          return;
        }
        var qtyEl = document.querySelector("[data-signet-qty]");
        var qty = Math.max(1, Number(qtyEl && qtyEl.value) || 1);
        var variant =
          variants.filter(function (v) {
            return (!color || v.color === color) && (!size || v.size === size);
          })[0] ||
          variants[0] ||
          { sku: p.sku, price: price };
        addLine({
          sku: variant.sku,
          productId: p.id,
          name: p.name,
          size: variant.size,
          color: variant.color,
          unitPrice: variant.price != null ? variant.price : price,
          quantity: qty,
          imageUrl: p.imageUrl,
          allotmentEligible: !!p.allotmentEligible,
        });
        track("add_to_cart", { productId: p.id });
        location.href = storeUrl("cart");
      });
    }
  }

  /* ---------------- cart page ---------------- */

  function renderCartPage() {
    var host = document.querySelector("[data-signet-cart-items]");
    if (!host) return;
    var lines = readCart();
    var empty = document.querySelector("[data-signet-cart-empty]");
    if (!lines.length) {
      host.innerHTML = "";
      if (empty) empty.style.display = "";
    } else {
      if (empty) empty.style.display = "none";
      host.innerHTML = lines
        .map(function (l) {
          var meta = [l.color ? "Color: " + esc(l.color) : "", l.size ? "Size: " + esc(l.size) : ""]
            .filter(Boolean)
            .join("<br>");
          var thumb = l.imageUrl
            ? '<img src="' + esc(l.imageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover">'
            : "Product image";
          return (
            '<article class="cart-item" data-sku="' +
            esc(l.sku) +
            '">' +
            '<div class="item-image">' +
            thumb +
            "</div><div>" +
            '<div class="item-name">' +
            esc(l.name) +
            "</div>" +
            '<div class="item-meta">' +
            meta +
            "</div>" +
            '<div class="quantity">' +
            '<button data-signet-dec="' +
            esc(l.sku) +
            '">-</button><span>' +
            l.quantity +
            "</span>" +
            '<button data-signet-inc="' +
            esc(l.sku) +
            '">+</button></div>' +
            '</div><div class="item-price"><strong>' +
            money(l.unitPrice * l.quantity) +
            "</strong>" +
            '<button class="remove" data-signet-remove="' +
            esc(l.sku) +
            '">Remove</button></div></article>'
          );
        })
        .join("");
    }
    var subtotal = cartTotal();
    setText("[data-signet-cart-subtotal]", money(subtotal));
    setText("[data-signet-cart-total]", money(subtotal));
  }

  /* ---------------- checkout page ---------------- */

  function renderCheckout() {
    var summary = document.querySelector("[data-signet-checkout-summary]");
    var placeBtn = document.querySelector("[data-signet-place-order]");
    if (!summary && !placeBtn) return;
    var lines = readCart();

    if (summary) {
      summary.innerHTML = lines
        .map(function (l) {
          var meta = [l.color, l.size].filter(Boolean).join(" · ");
          return (
            '<div class="summary-product">' +
            '<div class="product-thumb">' +
            (l.imageUrl ? '<img src="' + esc(l.imageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : esc(l.name.slice(0, 6))) +
            "</div><div><strong>" +
            esc(l.name) +
            "</strong><span>" +
            esc(meta) +
            (meta ? "<br>" : "") +
            "Quantity: " +
            l.quantity +
            "</span></div>" +
            '<div class="product-price">' +
            money(l.unitPrice * l.quantity) +
            "</div></div>"
          );
        })
        .join("");
    }
    setText("[data-signet-checkout-total]", money(cartTotal()));

    if (placeBtn) {
      placeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        placeOrder(placeBtn);
      });
    }
  }

  function placeOrder(btn) {
    var lines = readCart();
    if (!lines.length) {
      alert("Your cart is empty.");
      return;
    }
    var original = btn.textContent;
    btn.textContent = "Processing…";
    btn.disabled = true;

    var emailEl = document.querySelector("[data-signet-email]");
    var poEl = document.querySelector("[data-signet-po]");
    var payload = {
      lines: lines.map(function (l) {
        return { variantSku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice };
      }),
      paymentMethod: "po",
      poNumber: poEl && poEl.value ? poEl.value : undefined,
      userEmail: emailEl && emailEl.value ? emailEl.value : undefined,
    };

    fetch(api("/api/storefront/" + encodeURIComponent(SLUG) + "/orders"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          return { ok: r.ok, body: body };
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body && res.body.error ? res.body.error : "Order failed");
        track("purchase", {});
        showConfirmation(res.body, lines);
        clearCart();
      })
      .catch(function (err) {
        btn.textContent = original;
        btn.disabled = false;
        alert(err.message || "Order could not be placed.");
      });
  }

  function showConfirmation(order, lines) {
    var total = lines.reduce(function (s, l) {
      return s + l.unitPrice * l.quantity;
    }, 0);
    var target = document.querySelector("[data-signet-confirmation]") || document.querySelector(".checkout-layout") || document.body;
    var rows = lines
      .map(function (l) {
        return (
          '<div class="summary-row"><span>' +
          esc(l.name) +
          " × " +
          l.quantity +
          "</span><strong>" +
          money(l.unitPrice * l.quantity) +
          "</strong></div>"
        );
      })
      .join("");
    var invoiceNo = order.invoiceNumber || order.invoice_number || null;
    target.innerHTML =
      '<div class="card" style="max-width:640px;margin:32px auto;text-align:center">' +
      '<div style="font-size:44px;line-height:1">✓</div>' +
      "<h2>Order placed</h2>" +
      '<p style="color:#687080">Your purchase has been submitted and an invoice has been generated.</p>' +
      '<div style="text-align:left;margin:20px 0;border-top:1px solid rgba(0,0,0,.08);padding-top:16px">' +
      '<div class="summary-row"><span>Order reference</span><strong>' +
      esc(order.id || "—") +
      "</strong></div>" +
      (invoiceNo ? '<div class="summary-row"><span>Invoice</span><strong>' + esc(invoiceNo) + "</strong></div>" : "") +
      '<div class="summary-row"><span>Status</span><strong>' +
      esc(order.status || "submitted") +
      "</strong></div>" +
      rows +
      '<div class="summary-total" style="display:flex;justify-content:space-between;margin-top:12px;font-weight:800"><span>Total</span><span>' +
      money(total) +
      "</span></div></div>" +
      '<a href="' +
      storeUrl("") +
      '"><button class="checkout" style="width:100%">Continue shopping →</button></a></div>";
    if (target.scrollIntoView) target.scrollIntoView({ behavior: "smooth" });
  }

  /* ---------------- category filter + search (home) ---------------- */

  function wireFilters() {
    var buttons = document.querySelectorAll(".category[data-category]");
    var cards = function () {
      return document.querySelectorAll(".product-card");
    };
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        for (var j = 0; j < buttons.length; j++) buttons[j].classList.remove("active");
        this.classList.add("active");
        var cat = this.getAttribute("data-category");
        var list = cards();
        for (var k = 0; k < list.length; k++) {
          var match = cat === "all" || list[k].getAttribute("data-category") === cat;
          list[k].style.display = match ? "" : "none";
        }
      });
    }

    var searchBtn = document.getElementById("searchButton");
    var overlay = document.getElementById("searchOverlay");
    var input = document.getElementById("searchInput");
    if (searchBtn && overlay) {
      searchBtn.addEventListener("click", function () {
        overlay.classList.add("open");
        if (input) setTimeout(function () { input.focus(); }, 50);
      });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) overlay.classList.remove("open");
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") overlay.classList.remove("open");
      });
    }
    if (input) {
      input.addEventListener("input", function () {
        var q = input.value.toLowerCase().trim();
        var list = cards();
        for (var k = 0; k < list.length; k++) {
          var text = list[k].textContent.toLowerCase();
          list[k].style.display = !q || text.indexOf(q) !== -1 ? "" : "none";
        }
      });
    }
  }

  /* ---------------- helpers ---------------- */

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function valueOf(sel) {
    var el = document.querySelector(sel);
    return el ? el.value : null;
  }
  function uniq(arr) {
    return arr.filter(function (v, i) {
      return arr.indexOf(v) === i;
    });
  }
  function fillSelect(sel, options, placeholder) {
    var el = document.querySelector(sel);
    if (!el) return;
    if (!options.length) {
      var wrap = el.closest(".option");
      if (wrap) wrap.style.display = "none";
      return;
    }
    var html = placeholder ? '<option>' + esc(placeholder) + "</option>" : "";
    html += options
      .map(function (o) {
        return "<option>" + esc(o) + "</option>";
      })
      .join("");
    el.innerHTML = html;
  }
  function track(type, extra) {
    try {
      fetch(api("/api/storefront/" + encodeURIComponent(SLUG) + "/track"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ type: type }, extra || {})),
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------------- delegated cart controls ---------------- */

  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-signet-add],[data-signet-inc],[data-signet-dec],[data-signet-remove]") : null;
    if (!el) return;
    if (el.hasAttribute("data-signet-add")) {
      e.preventDefault();
      var id = el.getAttribute("data-signet-add");
      var p = findProduct(id);
      if (!p) return;
      var v = (p.variants && p.variants[0]) || { sku: p.sku, price: p.fromPrice };
      addLine({
        sku: v.sku,
        productId: p.id,
        name: p.name,
        size: v.size,
        color: v.color,
        unitPrice: v.price != null ? v.price : p.fromPrice || 0,
        quantity: 1,
        imageUrl: p.imageUrl,
        allotmentEligible: !!p.allotmentEligible,
      });
      track("add_to_cart", { productId: p.id });
      flash(el);
    } else if (el.hasAttribute("data-signet-inc")) {
      bump(el.getAttribute("data-signet-inc"), 1);
    } else if (el.hasAttribute("data-signet-dec")) {
      bump(el.getAttribute("data-signet-dec"), -1);
    } else if (el.hasAttribute("data-signet-remove")) {
      removeLine(el.getAttribute("data-signet-remove"));
      renderCartPage();
    }
  });

  function bump(sku, delta) {
    var line = readCart().filter(function (l) {
      return l.sku === sku;
    })[0];
    if (!line) return;
    setQty(sku, line.quantity + delta);
    renderCartPage();
  }
  function flash(btn) {
    var old = btn.textContent;
    btn.textContent = "✓";
    setTimeout(function () {
      btn.textContent = old;
    }, 700);
  }

  /* ---------------- boot ---------------- */

  window.SignetStore = {
    readCart: readCart,
    addLine: addLine,
    clearCart: clearCart,
    count: cartCount,
    total: cartTotal,
  };

  window.addEventListener("signet-cart-change", function () {
    paintCount();
    renderCartPage();
  });

  function boot() {
    paintCount();
    loadStore().then(function () {
      var grid = document.querySelector("[data-signet-catalog]");
      if (grid) renderCatalog(grid);
      fillProductDetail();
      wireFilters();
      renderCartPage();
      renderCheckout();
      paintCount();
    });
    track("page_view", { path: location.pathname });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
