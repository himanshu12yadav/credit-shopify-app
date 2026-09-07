// Storefront script for Native Store Credit dynamic updates & interactions

function initCreditStorefront() {
  // 1. Dynamic Cashback Badge on Variant Change
  const badge = document.querySelector('[data-credit-cashback-badge]');
  if (badge) {
    const rate = parseFloat(badge.dataset.rate || '5') / 100;
    const fixed = parseFloat(badge.dataset.fixed || '0');
    const currency = badge.dataset.currency || '$';

    const updateAmount = (centsPrice) => {
      if (!centsPrice) return;
      const dollars = centsPrice / 100;
      const earned = (dollars * rate) + fixed;
      const amountEl = badge.querySelector('.credit-amount-highlight');
      if (amountEl) {
        amountEl.textContent = `${currency}${earned.toFixed(2)}`;
      }
    };

    // Listen to theme variant changes (Dawn / OS 2.0 standard events)
    document.addEventListener('variant:change', (e) => {
      if (e.detail && e.detail.variant && e.detail.variant.price) {
        updateAmount(e.detail.variant.price);
      }
    });

    // Fallback listener on product form changes
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm) {
      productForm.addEventListener('change', () => {
        const selectedOption = productForm.querySelector('select[name="id"] option:checked');
        if (selectedOption && selectedOption.dataset.price) {
          updateAmount(parseInt(selectedOption.dataset.price, 10));
        }
      });
    }
  }

  // 2. Referral Copy Link Interaction
  document.querySelectorAll('[data-credit-copy-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.dataset.target || '#credit-referral-link');
      if (!input) return;

      navigator.clipboard.writeText(input.value).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.backgroundColor = '#16a34a';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = '';
        }, 2000);
      });
    });
  });

  // 2b. URL Referral Parameter Tracking (?ref=REF-...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('shopify_credit_referral', refCode);
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { 'referral_code': refCode } })
      }).catch(() => {});
    }
  } catch (e) {}

  // 3. Storefront VIP Wallet Pass Modal Trigger
  const walletBtn = document.querySelector('[data-credit-wallet-btn]');
  const walletModal = document.querySelector('[data-vip-modal]');
  const modalClose = document.querySelector('[data-vip-modal-close]');

  if (walletBtn && walletModal) {
    walletBtn.addEventListener('click', () => {
      walletModal.style.display = 'flex';
    });

    if (modalClose) {
      modalClose.addEventListener('click', () => {
        walletModal.style.display = 'none';
      });
    }

    walletModal.addEventListener('click', (e) => {
      if (e.target === walletModal) {
        walletModal.style.display = 'none';
      }
    });
  }

  // 4. Real-time Customer Tier & Spend Hydration
  const vipWidget = document.querySelector('[data-vip-widget]');
  if (vipWidget && vipWidget.dataset.customerId) {
    const customerId = vipWidget.dataset.customerId;
    const shop = window.Shopify ? window.Shopify.shop : 'pdf-store-15eu7f4v.myshopify.com';
    const currency = vipWidget.dataset.currencySymbol || '$';

    fetch(`https://analyst-diamonds-rooms-deaf.trycloudflare.com/api/storefront/tier?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.customer) return;
        const c = data.customer;

        // Update Lifetime Spend
        const spendEl = vipWidget.querySelector('[data-vip-spend]');
        if (spendEl && c.totalSpent !== undefined) {
          spendEl.textContent = `${currency}${c.totalSpent.toFixed(2)}`;
        }

        // Update Orders Placed
        const ordersEl = vipWidget.querySelector('[data-vip-orders]');
        if (ordersEl && c.ordersCount !== undefined) {
          ordersEl.textContent = String(c.ordersCount);
        }

        // Update Active Tier Badge and Card Border
        if (c.tier) {
          const badgeEl = vipWidget.querySelector('[data-vip-badge]');
          const cardEl = vipWidget.querySelector('[data-vip-card]');
          const rateEl = vipWidget.querySelector('[data-vip-rate]');

          if (badgeEl) {
            badgeEl.textContent = `★ ${c.tier.name} VIP`;
            badgeEl.style.backgroundColor = c.tier.badgeColor || '#4f46e5';
          }
          if (cardEl) {
            cardEl.style.borderTopColor = c.tier.badgeColor || '#4f46e5';
          }
          if (rateEl) {
            rateEl.textContent = `${c.tier.cashbackRate}% Cashback`;
          }

          // Update Progress Bar
          const tiers = data.tiers || [];
          const currentIdx = tiers.findIndex((t) => t.id === c.tier.id);
          const nextTier = tiers[currentIdx + 1];

          const progressSection = vipWidget.querySelector('[data-vip-progress-section]');
          const maxTierBanner = vipWidget.querySelector('[data-vip-max-tier]');

          if (nextTier) {
            if (progressSection) progressSection.style.display = 'block';
            if (maxTierBanner) maxTierBanner.style.display = 'none';

            const needed = Math.max(0, nextTier.minSpend - c.totalSpent);
            const range = nextTier.minSpend - c.tier.minSpend;
            const progress = range > 0 ? Math.min(100, Math.round(((c.totalSpent - c.tier.minSpend) / range) * 100)) : 100;

            const titleEl = vipWidget.querySelector('[data-vip-progress-title]');
            const pctEl = vipWidget.querySelector('[data-vip-progress-percent]');
            const fillEl = vipWidget.querySelector('[data-vip-progress-fill]');
            const nudgeEl = vipWidget.querySelector('[data-vip-progress-nudge]');

            if (titleEl) titleEl.innerHTML = `Progress to <strong>${nextTier.name} (${nextTier.cashbackRate}% Cashback)</strong>`;
            if (pctEl) pctEl.textContent = `${progress}%`;
            if (fillEl) {
              fillEl.style.width = `${progress}%`;
              fillEl.style.background = `linear-gradient(90deg, ${c.tier.badgeColor || '#4f46e5'}, #4f46e5)`;
            }
            if (nudgeEl) nudgeEl.innerHTML = `🛍️ Spend <strong>${currency}${needed.toFixed(2)}</strong> more to unlock ${nextTier.name}!`;
          } else {
            // Max tier reached
            if (progressSection) progressSection.style.display = 'none';
            if (maxTierBanner) maxTierBanner.style.display = 'block';
          }
        }
      })
      .catch((err) => console.debug('VIP hydration:', err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCreditStorefront);
} else {
  initCreditStorefront();
}
