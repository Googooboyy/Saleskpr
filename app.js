let products = JSON.parse(localStorage.getItem('bookmaker_products')) || [];
let history = JSON.parse(localStorage.getItem('bookmaker_history')) || [];
let sales = JSON.parse(localStorage.getItem('bookmaker_sales')) || [];
let productTypes = [...new Set(JSON.parse(localStorage.getItem('bookmaker_types')) || ['Notebook', 'Notepad', 'Bill Book', 'Voucher', 'Business Card', 'Flyer', 'Other'])];
let productStatuses = [...new Set(JSON.parse(localStorage.getItem('bookmaker_statuses')) || ['Running Low', 'Coming Soon', 'Discontinued'])];
let cart = [];
let stockFeedback = {};
let currentSort = 'name';
let currentTypeFilter = 'all';
let currentStatusFilter = 'all';

// Data Migration
const migrateLegacyData = () => {
    const legacySales = localStorage.getItem('bookmaker_total_sales');
    if (legacySales && parseFloat(legacySales) > 0) {
        // Only add the legacy entry if one doesn't already exist
        const alreadyMigrated = sales.some(s => s.productId === 'legacy');
        if (!alreadyMigrated) {
            sales.push({
                id: 'mig-' + Date.now(),
                productId: 'legacy',
                productName: 'Legacy Total',
                qty: 1,
                price: parseFloat(legacySales),
                timestamp: new Date().toLocaleString(),
                voided: false
            });
            localStorage.setItem('bookmaker_sales', JSON.stringify(sales));
        }
        // Always remove the old key so this migration never triggers again
        localStorage.removeItem('bookmaker_total_sales');
    }

    let migratedProducts = false;
    const now = Date.now();
    // Check if we need to fix existing identical timestamps (from previous migration)
    const timestamps = products.map(p => p.createdAt).filter(t => t);
    const uniqueTimestamps = new Set(timestamps);

    // If we have products and either some lack timestamps OR they all share the same one
    if (products.length > 0 && (timestamps.length < products.length || uniqueTimestamps.size === 1)) {
        products.forEach((p, index) => {
            // Re-assign timestamps with index-based offsets to ensure latest (higher index) is first
            p.createdAt = now + index;
        });
        migratedProducts = true;
    }
    // Migrate status from string to array
    products.forEach(p => {
        if (!p.status) {
            p.status = [];
            migratedProducts = true;
        } else if (typeof p.status === 'string') {
            p.status = [p.status];
            migratedProducts = true;
        }
        if (p.purchasePrice == null || Number.isNaN(Number(p.purchasePrice))) {
            const base = typeof p.price === 'number' && !Number.isNaN(p.price) ? p.price : parseFloat(p.price);
            p.purchasePrice = Number.isFinite(base) ? base : 0;
            migratedProducts = true;
        }
    });

    if (migratedProducts) {
        localStorage.setItem('bookmaker_products', JSON.stringify(products));
    }
};
migrateLegacyData();

// DOM Elements
const productGrid = document.getElementById('product-grid');
const noProductsEl = document.getElementById('no-products');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const pTypeSelect = document.getElementById('p-type');
const rankingsList = document.getElementById('product-rankings');
const buyerRankingsList = document.getElementById('buyer-rankings');
const statTotalSales = document.getElementById('stat-total-sales');
const statSelectedTotal = document.getElementById('stat-selected-total');
const statSelectedPercent = document.getElementById('stat-selected-percent');

const productModal = document.getElementById('product-modal');
const saleModal = document.getElementById('sale-modal');
const salesLogModal = document.getElementById('sales-log-modal');
const historyModal = document.getElementById('history-modal');
const typeModal = document.getElementById('type-modal');
const statusModal = document.getElementById('status-modal');
const pStatusContainer = document.getElementById('p-status-container');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmIconEl = document.getElementById('confirm-icon');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// Helper: Save
const saveData = () => {
    productTypes = [...new Set(productTypes)];
    productStatuses = [...new Set(productStatuses)];
    localStorage.setItem('bookmaker_products', JSON.stringify(products));
    localStorage.setItem('bookmaker_history', JSON.stringify(history));
    localStorage.setItem('bookmaker_sales', JSON.stringify(sales));
    localStorage.setItem('bookmaker_types', JSON.stringify(productTypes));
    localStorage.setItem('bookmaker_statuses', JSON.stringify(productStatuses));
    updateStats();
};

// Analytics & Stats
const updateStats = () => {
    // 1. Total Revenue
    const totalRevenue = sales.reduce((acc, sale) => sale.voided ? acc : acc + (sale.qty * sale.price), 0);
    statTotalSales.textContent = formatCurrency(totalRevenue);

    // 2. Ranked Products (All products)
    const productRevenues = products.map(p => {
        const revenue = sales.reduce((acc, s) => {
            return (!s.voided && s.productId === p.id) ? acc + (s.qty * s.price) : acc;
        }, 0);
        return { name: p.name, revenue: revenue, id: p.id };
    });

    const ranked = productRevenues.sort((a, b) => b.revenue - a.revenue);

    rankingsList.innerHTML = ranked.length
        ? ranked.map((p, i) => `
            <div class="rank-item" data-amount="${p.revenue}" onclick="toggleRankSelection(this)">
                <div class="rank-name">${p.name}</div>
                <span class="rank-amount">${formatCurrency(p.revenue)}</span>
            </div>
        `).join('')
        : '<div style="font-size: 0.8rem; color: #636E72;">Add products to see rankings.</div>';

    // 3. Ranked Buyers (New)
    const buyerMap = {};
    sales.forEach(s => {
        if (!s.voided && s.buyer) {
            buyerMap[s.buyer] = (buyerMap[s.buyer] || 0) + (s.qty * s.price);
        }
    });

    const rankedBuyers = Object.entries(buyerMap)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

    buyerRankingsList.innerHTML = rankedBuyers.length
        ? rankedBuyers.map(b => `
            <div class="rank-item buyer-rank-item" data-amount="${b.revenue}" onclick="toggleRankSelection(this)">
                <div class="rank-name">${b.name}</div>
                <span class="rank-amount">${formatCurrency(b.revenue)}</span>
            </div>
        `).join('')
        : '<div style="font-size: 0.8rem; color: #636E72;">Add sales with buyer names to see rankings.</div>';

    updateSelectedTotal();
    updateBuyerSuggestions();
};

const updateBuyerSuggestions = () => {
    const uniqueBuyers = [...new Set(sales.filter(s => s.buyer && s.buyer !== 'Guest').map(s => s.buyer))];
    const datalist = document.getElementById('buyer-suggestions');
    if (datalist) {
        datalist.innerHTML = uniqueBuyers.map(name => `<option value="${name}">`).join('');
    }
};

window.setProductTypeFilter = (type) => {
    currentTypeFilter = type;
    document.querySelectorAll('#type-filters .filter-btn').forEach(btn => btn.classList.remove('active'));

    const id = `filter-${type === 'all' ? 'all' : type.replace(/\s+/g, '-').toLowerCase()}`;
    const targetBtn = document.getElementById(id);
    if (targetBtn) targetBtn.classList.add('active');

    renderProducts();
};

window.setProductStatusFilter = (status) => {
    currentStatusFilter = status;
    document.querySelectorAll('#status-filters .filter-btn').forEach(btn => btn.classList.remove('active'));

    const id = `status-filter-${status === 'all' ? 'all' : status.replace(/\s+/g, '-').toLowerCase()}`;
    const targetBtn = document.getElementById(id);
    if (targetBtn) targetBtn.classList.add('active');

    renderProducts();
};

window.toggleRankSelection = (el) => {
    // If in the buyer section, clear product selections first (and vice versa)
    const isBuyer = el.classList.contains('buyer-rank-item');
    if (isBuyer) {
        document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(e => e.classList.remove('selected'));
    } else {
        document.querySelectorAll('.buyer-rank-item').forEach(e => e.classList.remove('selected'));
    }
    el.classList.toggle('selected');
    updateSelectedTotal();
};

window.selectAllProducts = () => {
    // Clear buyer selections first — mutual exclusion
    document.querySelectorAll('.buyer-rank-item').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(el => el.classList.add('selected'));
    updateSelectedTotal();
};

window.selectTop3Products = () => {
    window.clearRankSelection();
    const items = document.querySelectorAll('.rank-item:not(.buyer-rank-item)');
    for (let i = 0; i < Math.min(3, items.length); i++) {
        items[i].classList.add('selected');
    }
    updateSelectedTotal();
};

const selectTopPercentage = (percent) => {
    window.clearRankSelection();
    const totalRev = parseFloat(statTotalSales.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    if (totalRev === 0) return;

    const target = totalRev * (percent / 100);
    let currentSum = 0;
    const items = document.querySelectorAll('.rank-item:not(.buyer-rank-item)');

    for (const item of items) {
        if (currentSum >= target) break;
        const amount = parseFloat(item.getAttribute('data-amount') || 0);
        item.classList.add('selected');
        currentSum += amount;
    }
    updateSelectedTotal();
};

window.selectTop50Percent = () => selectTopPercentage(50);
window.selectTop80Percent = () => selectTopPercentage(80);

window.clearRankSelection = () => {
    document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(el => el.classList.remove('selected'));
    updateSelectedTotal();
};

// Buyer Selection Helpers
window.selectAllBuyers = () => {
    // Clear product selections first — mutual exclusion
    document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.buyer-rank-item').forEach(el => el.classList.add('selected'));
    updateSelectedTotal();
};

window.selectTop3Buyers = () => {
    window.clearBuyerSelection();
    document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(el => el.classList.remove('selected'));
    const items = document.querySelectorAll('.buyer-rank-item');
    for (let i = 0; i < Math.min(3, items.length); i++) {
        items[i].classList.add('selected');
    }
    updateSelectedTotal();
};

window.selectTop50PercentBuyers = () => selectTopPercentageBuyer(50);
window.selectTop80PercentBuyers = () => selectTopPercentageBuyer(80);

const selectTopPercentageBuyer = (percent) => {
    window.clearBuyerSelection();
    document.querySelectorAll('.rank-item:not(.buyer-rank-item)').forEach(el => el.classList.remove('selected'));
    const totalRev = parseFloat(statTotalSales.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    if (totalRev === 0) return;

    const target = totalRev * (percent / 100);
    let currentSum = 0;
    const items = document.querySelectorAll('.buyer-rank-item');

    for (const item of items) {
        if (currentSum >= target) break;
        const amount = parseFloat(item.getAttribute('data-amount') || 0);
        item.classList.add('selected');
        currentSum += amount;
    }
    updateSelectedTotal();
};

window.clearBuyerSelection = () => {
    document.querySelectorAll('.buyer-rank-item').forEach(el => el.classList.remove('selected'));
    updateSelectedTotal();
};

// Buyer Management logic
const renderBuyerManagement = () => {
    const list = document.getElementById('buyer-management-list');
    const uniqueBuyers = [...new Set(sales.filter(s => s.buyer && s.buyer !== 'Guest').map(s => s.buyer))].sort();

    list.innerHTML = uniqueBuyers.length === 0
        ? '<div style="padding:40px; text-align:center; color:#636E72;">No distinct buyer records yet.</div>'
        : uniqueBuyers.map(name => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-paper);">
                <span style="font-weight: 700; color: var(--text-ink);">${name}</span>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm" onclick="promptRenameBuyer('${name}')" style="padding: 4px 8px;">Rename</button>
                </div>
            </div>
        `).join('');
};

document.getElementById('manage-buyers-btn').onclick = () => {
    renderBuyerManagement();
    toggleModal(buyerModal, true);
};

window.promptRenameBuyer = (oldName) => {
    const newName = prompt(`Rename buyer "${oldName}" to:`, oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
        sales.forEach(s => {
            if (s.buyer === oldName) s.buyer = newName.trim();
        });
        saveData();
        renderBuyerManagement();
    }
};

const updateSelectedTotal = () => {
    const selectedItems = document.querySelectorAll('.rank-item.selected');
    let selectedTotal = 0;
    selectedItems.forEach(item => {
        selectedTotal += parseFloat(item.getAttribute('data-amount') || 0);
    });

    // Get total revenue for percentage calculation
    const totalRev = parseFloat(statTotalSales.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const percentage = totalRev > 0 ? (selectedTotal / totalRev) * 100 : 0;

    statSelectedTotal.textContent = formatCurrency(selectedTotal);
    statSelectedPercent.textContent = percentage.toFixed(1) + '%';
};

window.adjustStock = (id, amount) => {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    const cardEl = document.querySelector(`[data-product-id="${id}"]`);
    if (cardEl) {
        if (!stockFeedback[id]) {
            stockFeedback[id] = { total: 0, timer: null };
        }

        stockFeedback[id].total += amount;

        let feedbackEl = cardEl.querySelector('.stock-adjust-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.className = 'stock-adjust-feedback';
            cardEl.appendChild(feedbackEl);
        }

        const sign = stockFeedback[id].total > 0 ? '+' : '';
        feedbackEl.textContent = `${sign}${stockFeedback[id].total}`;
        feedbackEl.classList.remove('negative');
        if (stockFeedback[id].total < 0) feedbackEl.classList.add('negative');
        feedbackEl.classList.add('active');

        if (stockFeedback[id].timer) clearTimeout(stockFeedback[id].timer);

        // Finalize after 2.5 seconds
        stockFeedback[id].timer = setTimeout(() => {
            const finalChange = stockFeedback[id].total;
            p.stock = Math.max(0, p.stock + finalChange);
            saveData();

            // UI Update: Main card stock
            const stockDisplay = cardEl.querySelector('.p-stock');
            if (stockDisplay) {
                stockDisplay.textContent = `${p.stock} in stock`;
                const flashClass = finalChange > 0 ? 'flash-success' : 'flash-danger';
                stockDisplay.classList.add(flashClass);
                setTimeout(() => stockDisplay.classList.remove(flashClass), 1000);
            }

            // UI Update: Badges
            const badgeContainer = cardEl.querySelector('.product-badges');
            if (badgeContainer) {
                const lowStockBadge = badgeContainer.querySelector('.status-low-stock');
                if (p.stock < 10 && !lowStockBadge && p.status !== 'Discontinued') {
                    const badge = document.createElement('span');
                    badge.className = 'badge status-badge status-low-stock';
                    badge.textContent = 'Low Stock';
                    badgeContainer.appendChild(badge);
                } else if (p.stock >= 10 && lowStockBadge) {
                    lowStockBadge.remove();
                }
            }

            feedbackEl.classList.remove('active');
            updateStats();
            stockFeedback[id] = null;
        }, 2100);
    }
};

window.setProductSort = (mode) => {
    currentSort = mode;

    // Update active button UI
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`sort-${mode}`);
    if (targetBtn) targetBtn.classList.add('active');

    renderProducts();
};

// Render Products
const renderProducts = () => {
    productGrid.innerHTML = '';

    // 1. Prepare sorted list
    let sortedProducts = [...products];

    if (currentSort === 'name') {
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'sales') {
        const productRevenue = {};
        sales.forEach(s => {
            if (!s.voided) {
                productRevenue[s.productId] = (productRevenue[s.productId] || 0) + (s.qty * s.price);
            }
        });
        sortedProducts.sort((a, b) => (productRevenue[b.id] || 0) - (productRevenue[a.id] || 0));
    } else if (currentSort === 'stock') {
        sortedProducts.sort((a, b) => a.stock - b.stock);
    } else if (currentSort === 'price') {
        sortedProducts.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'date') {
        sortedProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (currentSort === 'status') {
        const statusOrder = ['Running Low', 'Coming Soon', 'Discontinued'];
        sortedProducts.sort((a, b) => {
            const aStatus = a.status?.[0] || '';
            const bStatus = b.status?.[0] || '';
            const aIdx = statusOrder.indexOf(aStatus);
            const bIdx = statusOrder.indexOf(bStatus);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    }

    // 2. Apply Type Filter
    if (currentTypeFilter !== 'all') {
        sortedProducts = sortedProducts.filter(p => p.type === currentTypeFilter);
    }

    // 3. Apply Status Filter
    if (currentStatusFilter !== 'all') {
        sortedProducts = sortedProducts.filter(p => p.status && p.status.includes(currentStatusFilter));
    }

    // Update filter count indicator
    const filterCountEl = document.getElementById('filter-count');
    const visibleCountEl = document.getElementById('visible-count');
    const totalCountEl = document.getElementById('total-count');

    if (filterCountEl && visibleCountEl && totalCountEl) {
        visibleCountEl.textContent = sortedProducts.length;
        totalCountEl.textContent = products.length;
        // Only show if we are actually filtering or if some items are hidden
        filterCountEl.style.display = products.length > sortedProducts.length ? 'block' : 'none';
    }

    if (sortedProducts.length === 0) {
        noProductsEl.style.display = 'block';
        return;
    }
    noProductsEl.style.display = 'none';

    sortedProducts.forEach(p => {
        const isLowStock = p.stock < 10;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', p.id);

        const getStatusClass = (status) => `status-${status.toLowerCase().replace(/\s+/g, '-')}`;

        // Get last known sale price
        const lastSale = sales.find(s => s.productId === p.id && !s.voided);
        const displayPrice = lastSale ? lastSale.price : p.price;

        card.innerHTML = `
            <div class="product-hero" 
                 style="background-image: ${p.image ? `url(${p.image})` : 'none'}; cursor: pointer;"
                 title="View Full Image"
                 onclick="viewImage('${p.image || ''}')">
                ${!p.image ? '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#B2BEC3; font-size:0.7rem">No Image</div>' : ''}
            </div>
            <div class="card-content">
                <div class="card-header">
                    <div class="product-badges">
                        <span class="badge type-badge" style="background:#F1F2F6">${p.type}</span>
                        ${(p.status || []).map(s => `<span class="badge status-badge ${getStatusClass(s)}">${s}</span>`).join('')}
                        ${isLowStock && !(p.status || []).includes('Discontinued') ? `<span class="badge status-badge status-low-stock">Low Stock</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="viewHistory('${p.id}')" title="View History" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></button>
                        <button class="btn btn-sm" onclick="editProduct('${p.id}')" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn btn-sm" onclick="deleteProduct('${p.id}')" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </div>
                <h3 class="product-name">${p.name}</h3>
                <p class="product-desc">${p.description || '...'}</p>
                <div class="card-footer" style="display:block">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                        <div class="card-meta">
                            <div class="p-price" title="${lastSale ? 'Last sale price' : 'Default sales price'}">${formatCurrency(displayPrice)}</div>
                            <div class="p-stock">${p.stock} in stock</div>
                        </div>
                        <button class="btn btn-sell" onclick="openSaleModal('${p.id}')">
                            Sale
                        </button>
                    </div>
                    <div class="stock-adjust-btns">
                        <button class="btn-stock minus" onclick="adjustStock('${p.id}', -1)">-1</button>
                        <button class="btn-stock" onclick="adjustStock('${p.id}', 1)">+1</button>
                        <button class="btn-stock" onclick="adjustStock('${p.id}', 3)">+3</button>
                        <button class="btn-stock" onclick="adjustStock('${p.id}', 5)">+5</button>
                    </div>
                </div>
            </div>
        `;
        productGrid.appendChild(card);
    });
};

// Modal Logic (toggleModal from shared.js)
const showConfirm = (options) => {
    return new Promise((resolve) => {
        confirmTitleEl.textContent = options.title || 'Are you sure?';
        confirmMessageEl.textContent = options.message || '';
        confirmIconEl.textContent = options.icon || '❓';
        confirmOkBtn.textContent = options.okText || 'Yes, Proceed';
        confirmCancelBtn.textContent = options.cancelText || 'Cancel';

        const handleOk = () => {
            toggleModal(confirmModal, false);
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            toggleModal(confirmModal, false);
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmOkBtn.removeEventListener('click', handleOk);
            confirmCancelBtn.removeEventListener('click', handleCancel);
        };

        confirmOkBtn.addEventListener('click', handleOk);
        confirmCancelBtn.addEventListener('click', handleCancel);

        toggleModal(confirmModal, true);
    });
};

window.toggleRankingSection = (contentId) => {
    const content = document.getElementById(contentId);
    const container = content.closest('.dash-performance');
    content.classList.toggle('collapsed');
    container.classList.toggle('collapsed');
};

const imageViewerModal = document.getElementById('image-viewer-modal');
const fullImageDisplay = document.getElementById('full-image-display');

window.viewImage = (src) => {
    if (!src) return;
    // Don't open image viewer if the product modal is currently open
    if (productModal.classList.contains('active')) return;
    fullImageDisplay.src = src;
    toggleModal(imageViewerModal, true);
};

// Event Listeners
document.getElementById('close-image-viewer').onclick = () => toggleModal(imageViewerModal, false);

addProductBtn.addEventListener('click', () => {
    document.getElementById('modal-title').textContent = 'New Product';
    productForm.reset();
    document.getElementById('product-id').value = '';
    renderTypeOptions();
    renderStatusOptions();
    document.getElementById('p-image-url').value = '';
    const preview = document.getElementById('current-image-preview');
    preview.style.display = 'none';
    preview.dataset.existingImage = '';
    document.getElementById('pending-image-preview').style.display = 'none';
    document.getElementById('p-image').value = '';
    toggleModal(productModal, true);
});

document.getElementById('close-modal').addEventListener('click', () => toggleModal(productModal, false));

// Clear existing image button
document.getElementById('clear-image-btn').addEventListener('click', () => {
    const preview = document.getElementById('current-image-preview');
    preview.style.display = 'none';
    preview.dataset.existingImage = '';
    document.getElementById('current-image-thumb').src = '';
});

// Pending image preview: show selected file or URL with x to cancel
const hidePendingImagePreview = () => {
    const pending = document.getElementById('pending-image-preview');
    pending.style.display = 'none';
    document.getElementById('pending-image-thumb').src = '';
    document.getElementById('pending-image-label').textContent = '';
    document.getElementById('p-image').value = '';
    document.getElementById('p-image-url').value = '';
};
const showPendingImagePreview = (src, label) => {
    const pending = document.getElementById('pending-image-preview');
    pending.querySelector('#pending-image-thumb').src = src;
    pending.querySelector('#pending-image-label').textContent = label || 'Selected';
    pending.style.display = 'flex';
};
document.getElementById('p-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => { showPendingImagePreview(reader.result, file.name); };
        reader.readAsDataURL(file);
    } else hidePendingImagePreview();
});
document.getElementById('p-image-url').addEventListener('input', () => {
    const url = document.getElementById('p-image-url').value.trim();
    const file = document.getElementById('p-image').files[0];
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        showPendingImagePreview(url, url);
    } else if (file) {
        const reader = new FileReader();
        reader.onload = () => showPendingImagePreview(reader.result, file.name);
        reader.readAsDataURL(file);
    } else {
        hidePendingImagePreview();
    }
});
document.getElementById('clear-pending-image-btn').addEventListener('click', hidePendingImagePreview);

document.getElementById('view-sales-btn').addEventListener('click', () => { renderSalesLog(); toggleModal(salesLogModal, true); });
document.getElementById('close-sales-log').addEventListener('click', () => toggleModal(salesLogModal, false));

// Generic close-* button handler (excludes product-modal which uses its own explicit listener)
document.querySelectorAll('[id^="close-"]').forEach(btn => {
    if (btn.id === 'close-modal') return; // product modal has its own handler
    btn.onclick = () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) toggleModal(modal, false);
    };
});

// Sale Logging
window.openSaleModal = (id) => {
    const p = products.find(prod => prod.id === id);
    if (p.stock <= 0) return alert("Out of stock.");

    // Get last sale price for this product
    const lastSale = sales.find(s => s.productId === id && !s.voided);
    const initialPrice = lastSale ? lastSale.price : p.price;

    document.getElementById('sale-product-name').textContent = p.name;
    document.getElementById('sale-product-id').value = p.id;
    document.getElementById('sale-stock-display').textContent = p.stock;
    document.getElementById('s-qty').max = p.stock;
    document.getElementById('s-qty').value = 1;
    document.getElementById('s-price').value = initialPrice;
    document.getElementById('s-remarks').value = '';

    toggleModal(saleModal, true);
};

document.getElementById('sale-form').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('sale-product-id').value;
    const qty = parseInt(document.getElementById('s-qty').value);
    const unitPrice = parseFloat(document.getElementById('s-price').value);
    const remarks = document.getElementById('s-remarks').value.trim();
    const p = products.find(prod => prod.id === id);

    // Check if adding this would exceed stock (including what's already in cart)
    const inCartQty = cart.filter(item => item.productId === id).reduce((acc, item) => acc + item.qty, 0);
    if (inCartQty + qty > p.stock) {
        return alert(`Cannot add ${qty} more. Total in cart (${inCartQty + qty}) exceeds current stock (${p.stock}).`);
    }

    cart.push({
        cartId: generateId(),
        productId: id,
        productName: p.name,
        qty: qty,
        price: unitPrice,
        remarks: remarks
    });

    renderCart();
    toggleModal(saleModal, false);
    toggleModal(document.getElementById('cart-drawer-overlay'), true);
};

const renderCart = () => {
    const list = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-count');

    list.innerHTML = cart.length === 0
        ? '<div style="text-align:center; color:#636E72; padding:40px 0;">Your cart is empty.</div>'
        : cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.productName}</span>
                    <span class="cart-item-meta">${item.qty} units @ ${formatCurrency(item.price)}</span>
                    ${item.remarks ? `<div style="font-size: 0.7rem; color: var(--accent-blue); font-style: italic; margin-top: 2px;">Note: ${item.remarks}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="cart-item-price">${formatCurrency(item.qty * item.price)}</span>
                    <button class="btn-remove" onclick="removeFromCart('${item.cartId}')">Remove</button>
                </div>
            </div>
        `).join('');

    const total = cart.reduce((acc, item) => acc + (item.qty * item.price), 0);
    totalEl.textContent = formatCurrency(total);
    countEl.textContent = cart.length;
};

window.removeFromCart = (cartId) => {
    cart = cart.filter(item => item.cartId !== cartId);
    renderCart();
};

const exportCartAsChit = (quiet = false) => {
    if (cart.length === 0) return;
    const buyerName = document.getElementById('cart-buyer-name').value.trim() || 'Guest';
    const orgName = typeof getOrgName === 'function' ? getOrgName() : '';
    const now = new Date();
    const dateStr = now.toLocaleString();
    const total = cart.reduce((acc, item) => acc + item.qty * item.price, 0);

    const lines = [
        '========================================',
        orgName ? `         ${orgName.toUpperCase()}` : '            SALES CHIT',
        '========================================',
        '',
        `Date:   ${dateStr}`,
        `Buyer:  ${buyerName}`,
        '',
        '----------------------------------------',
        'Item                     Qty   Price    Total',
        '----------------------------------------'
    ];
    cart.forEach(item => {
        const lineTotal = item.qty * item.price;
        const name = String(item.productName).slice(0, 24).padEnd(24);
        const qty = String(item.qty).padStart(3);
        const price = formatCurrency(item.price).padStart(8);
        const tot = formatCurrency(lineTotal).padStart(10);
        lines.push(`${name} ${qty} ${price} ${tot}`);
        if (item.remarks) lines.push(`  Remarks: ${item.remarks}`);
    });
    lines.push('----------------------------------------');
    lines.push(`TOTAL${''.padEnd(33)}${formatCurrency(total)}`);
    lines.push('========================================');
    lines.push('');
    lines.push('Powered by SalesKpr · https://mar.sg');

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chit_${buyerName.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    if (!quiet) showToast('Chit exported');
};

document.getElementById('export-chit-btn').onclick = () => { if (cart.length === 0) return alert("Cart is empty."); exportCartAsChit(); };

document.getElementById('finalize-sale-btn').onclick = async () => {
    if (cart.length === 0) return alert("Cart is empty.");

    const confirmed = await showConfirm({
        title: 'Complete Sale',
        message: 'Are you sure you want to finalize and record these sales? This will update your stock inventory. A chit will be exported.',
        icon: '🛒',
        okText: 'Finalize Sale'
    });
    if (!confirmed) return;

    // Export chit before clearing cart (for record / slip)
    exportCartAsChit(true);

    const buyerName = document.getElementById('cart-buyer-name').value.trim() || 'Guest';

    cart.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
            p.stock -= item.qty;
            sales.unshift({
                id: generateId(),
                productId: item.productId,
                productName: item.productName,
                buyer: buyerName,
                qty: item.qty,
                price: item.price,
                remarks: item.remarks || '',
                timestamp: new Date().toLocaleString(),
                voided: false
            });
        }
    });

    // Reset buyer name for next cart
    document.getElementById('cart-buyer-name').value = '';

    cart = [];
    saveData();
    renderProducts();
    renderCart();
    toggleModal(document.getElementById('cart-drawer-overlay'), false);
    showToast('✅ Sales recorded successfully!');
};

document.getElementById('cart-btn').onclick = () => toggleModal(document.getElementById('cart-drawer-overlay'), true);
document.getElementById('close-cart').onclick = () => toggleModal(document.getElementById('cart-drawer-overlay'), false);

// Product Type Management
const renderTypeOptions = () => pTypeSelect.innerHTML = productTypes.map(t => `<option value="${t}">${t}</option>`).join('');

const renderTypes = () => {
    const container = document.getElementById('type-list-container');
    container.innerHTML = productTypes.map(t => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-paper);">
            <span style="font-weight: 600; font-size: 0.9rem;">${t}</span>
            <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm" onclick="renameType('${t}')" title="Rename" style="padding: 4px 8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn btn-sm btn-primary" onclick="selectType('${t}')" style="padding: 4px 12px; background: var(--accent-blue);">Select</button>
                <button class="btn btn-sm btn-danger" onclick="removeType('${t}')" style="padding: 4px 8px;">Remove</button>
            </div>
        </div>
    `).join('');
};

document.getElementById('manage-types-btn').onclick = () => {
    renderTypes();
    toggleModal(typeModal, true);
};

const addType = (andSelect = false) => {
    const input = document.getElementById('new-type-input');
    const val = input.value.trim();
    if (val && !productTypes.includes(val)) {
        productTypes.push(val);
        input.value = '';
        saveData();
        renderTypes();
        renderTypeOptions();
        renderTypeFilters();
        if (andSelect) selectType(val);
    }
};
document.getElementById('add-type-btn').onclick = () => addType(false);
document.getElementById('add-and-select-type-btn').onclick = () => addType(true);

const renderStatusOptions = () => {
    pStatusContainer.innerHTML = productStatuses.map(s => `
        <label class="status-checkbox-label" style="display: flex; align-items: center; gap: 8px; background: #F8FAFC; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-paper); cursor: pointer; font-size: 0.8rem; transition: var(--transition);">
            <input type="checkbox" name="status" value="${s}" style="width: auto; margin: 0;">
            ${s}
        </label>
    `).join('');
};

const renderStatuses = () => {
    const container = document.getElementById('status-list-container');
    container.innerHTML = productStatuses.map(s => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-paper);">
            <span style="font-weight: 600; font-size: 0.9rem;">${s}</span>
            <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm" onclick="renameStatus('${s}')" title="Rename" style="padding: 4px 8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn btn-sm btn-primary" onclick="selectStatus('${s}')" style="padding: 4px 12px; background: var(--accent-blue);">Select</button>
                <button class="btn btn-sm btn-danger" onclick="removeStatus('${s}')" style="padding: 4px 8px;">Remove</button>
            </div>
        </div>
    `).join('');
};

document.getElementById('manage-statuses-btn').onclick = () => {
    renderStatuses();
    toggleModal(statusModal, true);
};

document.getElementById('add-status-btn').onclick = () => {
    const input = document.getElementById('new-status-input');
    const val = input.value.trim();
    if (val && !productStatuses.includes(val)) {
        productStatuses.push(val);
        input.value = '';
        saveData();
        renderStatuses();
        renderStatusOptions();
        renderStatusFilters();
    }
};

window.removeStatus = async (status) => {
    const confirmed = await showConfirm({
        title: 'Remove Status Tag',
        message: `Are you sure you want to permanently remove the status tag "${status}"?`,
        icon: '🗑️',
        okText: 'Remove Tag'
    });
    if (confirmed) {
        productStatuses = productStatuses.filter(s => s !== status);
        if (currentStatusFilter === status) currentStatusFilter = 'all';
        // Update all products to remove this status from their array
        products.forEach(p => {
            if (p.status && Array.isArray(p.status)) {
                p.status = p.status.filter(s => s !== status);
            }
        });
        saveData();
        renderStatuses();
        renderStatusOptions();
        renderStatusFilters();
    }
};

window.renameStatus = (oldStatus) => {
    const newStatus = prompt("Enter new name for status tag:", oldStatus);
    if (newStatus && newStatus.trim() !== "" && newStatus !== oldStatus) {
        const idx = productStatuses.indexOf(oldStatus);
        const trimmedNew = newStatus.trim();
        if (idx !== -1) {
            productStatuses[idx] = trimmedNew;
            // Update any products using this status in their array
            products.forEach(p => {
                if (p.status && Array.isArray(p.status)) {
                    p.status = p.status.map(s => s === oldStatus ? trimmedNew : s);
                }
            });
            if (currentStatusFilter === oldStatus) currentStatusFilter = trimmedNew;
            saveData();
            renderStatuses();
            renderStatusOptions();
            renderStatusFilters();
            renderProducts();
        }
    }
};

document.getElementById('close-status-modal').onclick = () => toggleModal(statusModal, false);

window.selectStatus = (status) => {
    const cb = pStatusContainer.querySelector(`input[value="${status}"]`);
    if (cb) cb.checked = !cb.checked; // Toggle when selecting from manage dialog
    toggleModal(statusModal, false);
};

// Initialize Type Filters in UI
const renderTypeFilters = () => {
    const container = document.getElementById('type-filters');
    if (!container) return;
    container.innerHTML = `
        <button onclick="setProductTypeFilter('all')" class="btn btn-sm filter-btn ${currentTypeFilter === 'all' ? 'active' : ''}" id="filter-all">All</button>
        ${productTypes.map(t => `
            <button onclick="setProductTypeFilter('${t}')" class="btn btn-sm filter-btn ${currentTypeFilter === t ? 'active' : ''}" id="filter-${t.replace(/\s+/g, '-').toLowerCase()}">${t}</button>
        `).join('')}
        <button onclick="openManageTypes()" class="btn btn-sm filter-btn filter-manage">Manage Category</button>
    `;
};

const renderStatusFilters = () => {
    const container = document.getElementById('status-filters');
    if (!container) return;
    container.innerHTML = `
        <button onclick="setProductStatusFilter('all')" class="btn btn-sm filter-btn ${currentStatusFilter === 'all' ? 'active' : ''}" id="status-filter-all">All</button>
        ${productStatuses.map(s => `
            <button onclick="setProductStatusFilter('${s}')" class="btn btn-sm filter-btn ${currentStatusFilter === s ? 'active' : ''}" id="status-filter-${s.replace(/\s+/g, '-').toLowerCase()}">${s}</button>
        `).join('')}
        <button onclick="openManageStatuses()" class="btn btn-sm filter-btn filter-manage">Manage Status</button>
    `;
};

window.openManageTypes = () => {
    renderTypes();
    toggleModal(typeModal, true);
};
window.openManageStatuses = () => {
    renderStatuses();
    toggleModal(statusModal, true);
};

window.removeType = async (type) => {
    const confirmed = await showConfirm({
        title: 'Remove Type',
        message: `Are you sure you want to permanently remove the type "${type}"?`,
        icon: '📂',
        okText: 'Remove Type'
    });
    if (confirmed) {
        productTypes = productTypes.filter(t => t !== type);
        if (currentTypeFilter === type) currentTypeFilter = 'all';
        saveData();
        renderTypes();
        renderTypeOptions();
        renderTypeFilters();
    }
};

window.renameType = (oldType) => {
    const newType = prompt("Enter new name for product type:", oldType);
    if (newType && newType.trim() !== "" && newType !== oldType) {
        const idx = productTypes.indexOf(oldType);
        if (idx !== -1) {
            productTypes[idx] = newType.trim();
            // Update any products using this type
            products.forEach(p => {
                if (p.type === oldType) p.type = newType.trim();
            });
            if (currentTypeFilter === oldType) currentTypeFilter = newType.trim();
            saveData();
            renderTypes();
            renderTypeOptions();
            renderTypeFilters();
            renderProducts();
        }
    }
};

document.getElementById('close-types').onclick = () => toggleModal(typeModal, false);

window.selectType = (type) => {
    pTypeSelect.value = type;
    toggleModal(typeModal, false);
};

// CRUD Logic (Simplified for brevity as requested)
productForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const purchasePrice = parseFloat(document.getElementById('p-purchase-price').value);
    const salesPrice = parseFloat(document.getElementById('p-sales-price').value);
    const stockRaw = document.getElementById('p-stock').value;
    const stock = parseInt(stockRaw, 10);
    if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        alert('Please enter a valid purchase price (0 or more).');
        return;
    }
    if (Number.isNaN(salesPrice) || salesPrice < 0) {
        alert('Please enter a valid sales price (0 or more).');
        return;
    }
    if (stockRaw.trim() === '' || Number.isNaN(stock) || stock < 0) {
        alert('Please enter a valid stock level (0 or more).');
        return;
    }
    const data = {
        name: document.getElementById('p-name').value,
        type: document.getElementById('p-type').value,
        purchasePrice,
        price: salesPrice,
        stock,
        status: Array.from(pStatusContainer.querySelectorAll('input[name="status"]:checked')).map(cb => cb.value),
        description: document.getElementById('p-desc').value,
    };
    const file = document.getElementById('p-image').files[0];
    const url = document.getElementById('p-image-url').value.trim();
    const preview = document.getElementById('current-image-preview');
    const existingImage = preview.dataset.existingImage || '';

    if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            data.image = reader.result;
            finishSave(id, data);
        }
    } else if (url) {
        data.image = url;
        finishSave(id, data);
    } else {
        // No new file or URL — use existing image only if it wasn't cleared
        if (existingImage) data.image = existingImage;
        finishSave(id, data);
    }
};

const finishSave = (id, data) => {
    if (id) {
        const idx = products.findIndex(p => p.id === id);
        products[idx] = { ...products[idx], ...data };
    } else {
        products.push({
            id: generateId(),
            ...data,
            createdAt: Date.now()
        });
    }
    saveData();
    renderProducts();
    toggleModal(productModal, false);
};

window.viewHistory = (id) => {
    const p = products.find(prod => prod.id === id);
    const pSales = sales.filter(s => s.productId === id);

    document.getElementById('history-product-name').textContent = p.name;
    const historyList = document.getElementById('history-list');

    historyList.innerHTML = pSales.length === 0
        ? '<div style="padding:20px; text-align:center; color:#636E72;">No sales history for this product.</div>'
        : pSales.map(s => `
            <div style="padding:12px; border-bottom: 1px solid var(--border-paper); display:flex; justify-content:space-between; align-items:center; ${s.voided ? 'opacity:0.5; text-decoration:line-through;' : ''}">
                <div>
                    <div style="font-weight:700; font-size:0.9rem;">${s.timestamp}</div>
                    <div style="font-size:0.8rem; color:#636E72;">${s.qty} units @ ${formatCurrency(s.price)}</div>
                </div>
                <div style="font-weight:800; color:var(--success);">${formatCurrency(s.qty * s.price)}</div>
            </div>
        `).join('');

    toggleModal(historyModal, true);
};

window.editProduct = (id) => {
    // Don't open edit if product modal is already active (prevents hijacking mid-add)
    if (productModal.classList.contains('active')) return;
    const p = products.find(prod => prod.id === id);
    document.getElementById('modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-purchase-price').value = p.purchasePrice != null && !Number.isNaN(Number(p.purchasePrice)) ? p.purchasePrice : (p.price ?? '');
    document.getElementById('p-sales-price').value = p.price ?? '';
    document.getElementById('p-stock').value = p.stock;
    renderStatusOptions();
    if (p.status && Array.isArray(p.status)) {
        p.status.forEach(s => {
            const cb = pStatusContainer.querySelector(`input[value="${s}"]`);
            if (cb) cb.checked = true;
        });
    }
    document.getElementById('p-desc').value = p.description || '';
    document.getElementById('p-image-url').value = p.image && p.image.startsWith('http') ? p.image : '';
    renderTypeOptions();
    pTypeSelect.value = p.type;

    // Show or hide the existing image preview banner
    const preview = document.getElementById('current-image-preview');
    const thumb = document.getElementById('current-image-thumb');
    if (p.image) {
        thumb.src = p.image;
        preview.style.display = 'flex';
        preview.dataset.existingImage = p.image;
    } else {
        preview.style.display = 'none';
        preview.dataset.existingImage = '';
    }
    document.getElementById('pending-image-preview').style.display = 'none';
    document.getElementById('p-image').value = '';

    toggleModal(productModal, true);
};

window.deleteProduct = async (id) => {
    const confirmed = await showConfirm({
        title: 'Delete Product',
        message: 'Are you sure you want to permanently delete this product? All stock data will be lost.',
        icon: '⚠️',
        okText: 'Delete Forever'
    });
    if (confirmed) {
        products = products.filter(p => p.id !== id);
        saveData();
        renderProducts();
    }
};

const renderSalesLog = () => {
    const body = document.getElementById('sales-log-body');
    const clearBtn = document.getElementById('clear-voided-btn');

    const hasVoided = sales.some(s => s.voided);
    clearBtn.style.display = hasVoided ? 'block' : 'none';

    body.innerHTML = sales.map(s => `
        <tr class="${s.voided ? 'voided-sale' : ''}">
            <td>${s.timestamp}</td>
            <td>
                <div style="font-weight:700;">${s.productName}</div>
                <div style="font-size:0.75rem; color:#636E72;">Buyer: ${s.buyer || 'Guest'}</div>
            </td>
            <td>${s.qty}</td>
            <td>${formatCurrency(s.qty * s.price)}</td>
            <td>${s.voided ? 'Voided' : `<button onclick="voidSale('${s.id}')" class="btn btn-sm btn-danger">Void</button>`}</td>
        </tr>
    `).join('');
};

document.getElementById('clear-voided-btn').onclick = async () => {
    const confirmed = await showConfirm({
        title: 'Clear History',
        message: 'Permanently remove all voided entries from the sales log? This action cannot be undone.',
        icon: '🧹',
        okText: 'Clear All'
    });
    if (confirmed) {
        sales = sales.filter(s => !s.voided);
        saveData();
        renderSalesLog();
    }
};

// Sales Log Export/Import
document.getElementById('export-sales-btn').onclick = () => {
    const data = {
        sales,
        exportedAt: new Date().toISOString(),
        orgName: typeof getOrgName === 'function' ? getOrgName() : ''
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Sales log exported');
};

document.getElementById('import-sales-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : (parsed.sales || []);
        if (!Array.isArray(arr) || arr.length === 0) {
            alert('No valid sales data found in the file.');
            return;
        }
        const confirmed = await showConfirm({
            title: 'Import Sales',
            message: `Import ${arr.length} record(s) and add them to your existing sales log?`,
            icon: '📥',
            okText: 'Import & Merge'
        });
        if (!confirmed) return;
        const existingIds = new Set(sales.map(s => s.id));
        const toAdd = arr.filter(r => r.productId != null && r.qty != null && r.price != null).map(r => ({
            ...r,
            id: existingIds.has(r.id) ? generateId() : r.id,
            voided: !!r.voided
        }));
        sales = [...toAdd, ...sales];
        saveData();
        renderSalesLog();
        updateStats();
        renderProducts();
        showToast(`✅ Imported ${toAdd.length} sales record(s)`);
    } catch (err) {
        alert('Failed to import: invalid JSON or file format.');
    }
};

window.voidSale = (id) => {
    const s = sales.find(x => x.id === id);
    const p = products.find(x => x.id === s.productId);
    if (p) p.stock += s.qty;
    s.voided = true;
    saveData();
    renderProducts();
    renderSalesLog();
};

// Deep links from Help / bookmarks: #sales-log, #cart
(() => {
    const h = location.hash.slice(1);
    if (h === 'sales-log') {
        renderSalesLog();
        toggleModal(salesLogModal, true);
    } else if (h === 'cart') {
        toggleModal(document.getElementById('cart-drawer-overlay'), true);
    }
})();

// Init
[...document.querySelectorAll('.modal-overlay')].forEach(m => {
    // Product modal must NEVER close by clicking the backdrop — user could accidentally lose their form data
    if (m.id === 'product-modal') return;

    let isMouseDownOnOverlay = false;
    m.addEventListener('mousedown', (e) => {
        isMouseDownOnOverlay = (e.target === m);
    });
    m.addEventListener('mouseup', (e) => {
        if (isMouseDownOnOverlay && e.target === m) {
            toggleModal(m, false);
        }
        isMouseDownOnOverlay = false;
    });
});
renderProducts();
updateStats();
renderTypeFilters();
renderStatusFilters();
renderStatusOptions();
if (typeof initOrgBranding === 'function') initOrgBranding();
