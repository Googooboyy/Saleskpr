let products = JSON.parse(localStorage.getItem('bookmaker_products')) || [];
let history = JSON.parse(localStorage.getItem('bookmaker_history')) || [];
let purchases = JSON.parse(localStorage.getItem('bookmaker_purchases')) || [];
let productTypes = [...new Set(JSON.parse(localStorage.getItem('bookmaker_types')) || ['Notebook', 'Notepad', 'Bill Book', 'Voucher', 'Business Card', 'Flyer', 'Other'])];
let productStatuses = [...new Set(JSON.parse(localStorage.getItem('bookmaker_statuses')) || ['Running Low', 'Coming Soon', 'Discontinued'])];
let cart = [];
let stockFeedback = {};
let currentSort = 'name';
let currentTypeFilter = 'all';
let currentStatusFilter = 'all';

// Data Migration (products and status only; no legacy purchases)
const migrateLegacyData = () => {
    let migratedProducts = false;
    const now = Date.now();
    const timestamps = products.map(p => p.createdAt).filter(t => t);
    const uniqueTimestamps = new Set(timestamps);

    if (products.length > 0 && (timestamps.length < products.length || uniqueTimestamps.size === 1)) {
        products.forEach((p, index) => {
            p.createdAt = now + index;
        });
        migratedProducts = true;
    }
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
const productRankingsList = document.getElementById('product-rankings');
const supplierRankingsList = document.getElementById('supplier-rankings');
const statTotalCost = document.getElementById('stat-total-sales');
const statSelectedTotal = document.getElementById('stat-selected-total');
const statSelectedPercent = document.getElementById('stat-selected-percent');

const productModal = document.getElementById('product-modal');
const purchaseModal = document.getElementById('purchase-modal');
const purchasesLogModal = document.getElementById('purchases-log-modal');
const historyModal = document.getElementById('history-modal');
const typeModal = document.getElementById('type-modal');
const statusModal = document.getElementById('status-modal');
const supplierModal = document.getElementById('supplier-modal');
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
    localStorage.setItem('bookmaker_purchases', JSON.stringify(purchases));
    localStorage.setItem('bookmaker_types', JSON.stringify(productTypes));
    localStorage.setItem('bookmaker_statuses', JSON.stringify(productStatuses));
    updateStats();
};

// Analytics & Stats (cost-based)
const updateStats = () => {
    const totalCost = purchases.reduce((acc, p) => p.voided ? acc : acc + (p.qty * p.price), 0);
    statTotalCost.textContent = formatCurrency(totalCost);

    const productCosts = products.map(p => {
        const cost = purchases.reduce((acc, pur) =>
            (!pur.voided && pur.productId === p.id) ? acc + (pur.qty * pur.price) : acc, 0);
        return { name: p.name, cost, id: p.id };
    });
    const rankedProducts = productCosts.sort((a, b) => b.cost - a.cost);

    productRankingsList.innerHTML = rankedProducts.length
        ? rankedProducts.map(p => `
            <div class="rank-item" data-amount="${p.cost}" onclick="toggleRankSelection(this)">
                <div class="rank-name">${p.name}</div>
                <span class="rank-amount">${formatCurrency(p.cost)}</span>
            </div>
        `).join('')
        : '<div style="font-size: 0.8rem; color: #636E72;">Add products to see rankings.</div>';

    const supplierMap = {};
    purchases.forEach(p => {
        if (!p.voided && p.supplier) {
            supplierMap[p.supplier] = (supplierMap[p.supplier] || 0) + (p.qty * p.price);
        }
    });
    const rankedSuppliers = Object.entries(supplierMap)
        .map(([name, cost]) => ({ name, cost }))
        .sort((a, b) => b.cost - a.cost);

    supplierRankingsList.innerHTML = rankedSuppliers.length
        ? rankedSuppliers.map(s => `
            <div class="rank-item supplier-rank-item" data-amount="${s.cost}" onclick="toggleRankSelection(this)">
                <div class="rank-name">${s.name}</div>
                <span class="rank-amount">${formatCurrency(s.cost)}</span>
            </div>
        `).join('')
        : '<div style="font-size: 0.8rem; color: #636E72;">Add purchases with supplier names to see rankings.</div>';

    updateSelectedTotal();
    updateSupplierSuggestions();
};

const updateSupplierSuggestions = () => {
    const uniqueSuppliers = [...new Set(purchases.filter(p => p.supplier && p.supplier !== 'Guest').map(p => p.supplier))];
    const datalist = document.getElementById('supplier-suggestions');
    if (datalist) {
        datalist.innerHTML = uniqueSuppliers.map(name => `<option value="${name}">`).join('');
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
    const isSupplier = el.classList.contains('supplier-rank-item');
    if (isSupplier) {
        document.querySelectorAll('.rank-item:not(.supplier-rank-item)').forEach(e => e.classList.remove('selected'));
    } else {
        document.querySelectorAll('.supplier-rank-item').forEach(e => e.classList.remove('selected'));
    }
    el.classList.toggle('selected');
    updateSelectedTotal();
};

window.selectAllProducts = () => {
    document.querySelectorAll('.supplier-rank-item').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.rank-item:not(.supplier-rank-item)').forEach(el => el.classList.add('selected'));
    updateSelectedTotal();
};

window.selectTop3Products = () => {
    window.clearRankSelection();
    const items = document.querySelectorAll('.rank-item:not(.supplier-rank-item)');
    for (let i = 0; i < Math.min(3, items.length); i++) {
        items[i].classList.add('selected');
    }
    updateSelectedTotal();
};

const selectTopPercentage = (percent) => {
    window.clearRankSelection();
    const totalCost = parseFloat(statTotalCost.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    if (totalCost === 0) return;
    const target = totalCost * (percent / 100);
    let currentSum = 0;
    const items = document.querySelectorAll('.rank-item:not(.supplier-rank-item)');
    for (const item of items) {
        if (currentSum >= target) break;
        currentSum += parseFloat(item.getAttribute('data-amount') || 0);
        item.classList.add('selected');
    }
    updateSelectedTotal();
};

window.selectTop50Percent = () => selectTopPercentage(50);
window.selectTop80Percent = () => selectTopPercentage(80);

window.clearRankSelection = () => {
    document.querySelectorAll('.rank-item:not(.supplier-rank-item)').forEach(el => el.classList.remove('selected'));
    updateSelectedTotal();
};

window.selectAllSuppliers = () => {
    document.querySelectorAll('.rank-item:not(.supplier-rank-item)').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.supplier-rank-item').forEach(el => el.classList.add('selected'));
    updateSelectedTotal();
};

window.selectTop3Suppliers = () => {
    window.clearSupplierSelection();
    const items = document.querySelectorAll('.supplier-rank-item');
    for (let i = 0; i < Math.min(3, items.length); i++) {
        items[i].classList.add('selected');
    }
    updateSelectedTotal();
};

window.selectTop50PercentSuppliers = () => selectTopPercentageSupplier(50);
window.selectTop80PercentSuppliers = () => selectTopPercentageSupplier(80);

const selectTopPercentageSupplier = (percent) => {
    window.clearSupplierSelection();
    const totalCost = parseFloat(statTotalCost.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    if (totalCost === 0) return;
    const target = totalCost * (percent / 100);
    let currentSum = 0;
    const items = document.querySelectorAll('.supplier-rank-item');
    for (const item of items) {
        if (currentSum >= target) break;
        currentSum += parseFloat(item.getAttribute('data-amount') || 0);
        item.classList.add('selected');
    }
    updateSelectedTotal();
};

window.clearSupplierSelection = () => {
    document.querySelectorAll('.supplier-rank-item').forEach(el => el.classList.remove('selected'));
    updateSelectedTotal();
};

// Supplier Management
const renderSupplierManagement = () => {
    const list = document.getElementById('supplier-management-list');
    const uniqueSuppliers = [...new Set(purchases.filter(p => p.supplier && p.supplier !== 'Guest').map(p => p.supplier))].sort();
    list.innerHTML = uniqueSuppliers.length === 0
        ? '<div style="padding:40px; text-align:center; color:#636E72;">No distinct supplier records yet.</div>'
        : uniqueSuppliers.map(name => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-paper);">
                <span style="font-weight: 700; color: var(--text-ink);">${name}</span>
                <button class="btn btn-sm" data-supplier="${name.replace(/"/g, '&quot;')}" onclick="promptRenameSupplier(this.dataset.supplier)" style="padding: 4px 8px;">Rename</button>
            </div>
        `).join('');
};

document.getElementById('manage-suppliers-btn').onclick = () => {
    renderSupplierManagement();
    toggleModal(supplierModal, true);
};

window.promptRenameSupplier = (oldName) => {
    const newName = prompt(`Rename supplier "${oldName}" to:`, oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
        purchases.forEach(p => {
            if (p.supplier === oldName) p.supplier = newName.trim();
        });
        saveData();
        renderSupplierManagement();
        updateSupplierSuggestions();
    }
};

const updateSelectedTotal = () => {
    const selectedItems = document.querySelectorAll('.rank-item.selected');
    let selectedTotal = 0;
    selectedItems.forEach(item => {
        selectedTotal += parseFloat(item.getAttribute('data-amount') || 0);
    });
    const totalCost = parseFloat(statTotalCost.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const percentage = totalCost > 0 ? (selectedTotal / totalCost) * 100 : 0;
    statSelectedTotal.textContent = formatCurrency(selectedTotal);
    statSelectedPercent.textContent = percentage.toFixed(1) + '%';
};

window.adjustStock = (id, amount) => {
    const p = products.find(prod => prod.id === id);
    if (!p) return;
    const cardEl = document.querySelector(`[data-product-id="${id}"]`);
    if (!cardEl) return;

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
    stockFeedback[id].timer = setTimeout(() => {
        const finalChange = stockFeedback[id].total;
        p.stock = Math.max(0, p.stock + finalChange);
        saveData();

        const stockDisplay = cardEl.querySelector('.p-stock');
        if (stockDisplay) {
            stockDisplay.textContent = `${p.stock} in stock`;
            const flashClass = finalChange > 0 ? 'flash-success' : 'flash-danger';
            stockDisplay.classList.add(flashClass);
            setTimeout(() => stockDisplay.classList.remove(flashClass), 1000);
        }

        const badgeContainer = cardEl.querySelector('.product-badges');
        if (badgeContainer) {
            const lowStockBadge = badgeContainer.querySelector('.status-low-stock');
            if (p.stock < 10 && !lowStockBadge && !(p.status || []).includes('Discontinued')) {
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
};

window.setProductSort = (mode) => {
    currentSort = mode;
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`sort-${mode}`);
    if (targetBtn) targetBtn.classList.add('active');
    renderProducts();
};

// Render Products (Purchase button)
const renderProducts = () => {
    productGrid.innerHTML = '';

    let sortedProducts = [...products];

    if (currentSort === 'name') {
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'purchases') {
        const productCost = {};
        purchases.forEach(p => {
            if (!p.voided) {
                productCost[p.productId] = (productCost[p.productId] || 0) + (p.qty * p.price);
            }
        });
        sortedProducts.sort((a, b) => (productCost[b.id] || 0) - (productCost[a.id] || 0));
    } else if (currentSort === 'stock') {
        sortedProducts.sort((a, b) => a.stock - b.stock);
    } else if (currentSort === 'price') {
        sortedProducts.sort((a, b) => (b.purchasePrice ?? b.price) - (a.purchasePrice ?? a.price));
    } else if (currentSort === 'date') {
        sortedProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    if (currentTypeFilter !== 'all') {
        sortedProducts = sortedProducts.filter(p => p.type === currentTypeFilter);
    }
    if (currentStatusFilter !== 'all') {
        sortedProducts = sortedProducts.filter(p => p.status && p.status.includes(currentStatusFilter));
    }

    const filterCountEl = document.getElementById('filter-count');
    const visibleCountEl = document.getElementById('visible-count');
    const totalCountEl = document.getElementById('total-count');
    if (filterCountEl && visibleCountEl && totalCountEl) {
        visibleCountEl.textContent = sortedProducts.length;
        totalCountEl.textContent = products.length;
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
        const lastPurchase = purchases.find(pur => pur.productId === p.id && !pur.voided);
        const displayPrice = lastPurchase ? lastPurchase.price : (p.purchasePrice ?? p.price);

        card.innerHTML = `
            <div class="product-hero" style="background-image: ${p.image ? `url(${p.image})` : 'none'}; cursor: pointer;" title="View Full Image" onclick="viewImage('${p.image || ''}')">
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
                        <button class="btn btn-sm" onclick="viewHistory('${p.id}')" title="View History" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></button>
                        <button class="btn btn-sm" onclick="editProduct('${p.id}')" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn btn-sm" onclick="deleteProduct('${p.id}')" style="padding:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </div>
                <h3 class="product-name">${p.name}</h3>
                <p class="product-desc">${p.description || '...'}</p>
                <div class="card-footer" style="display:block">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                        <div class="card-meta">
                            <div class="p-price" title="${lastPurchase ? 'Last Cost' : 'Default purchase price'}">${formatCurrency(displayPrice)}</div>
                            <div class="p-stock">${p.stock} in stock</div>
                        </div>
                        <button class="btn btn-sell" onclick="openPurchaseModal('${p.id}')">Purchase</button>
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

// Modal Logic
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
    if (!content) return;
    const container = content.closest('.dash-performance');
    content.classList.toggle('collapsed');
    container.classList.toggle('collapsed');
};

const imageViewerModal = document.getElementById('image-viewer-modal');
const fullImageDisplay = document.getElementById('full-image-display');

window.viewImage = (src) => {
    if (!src) return;
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
    document.getElementById('pending-image-thumb').src = src;
    document.getElementById('pending-image-label').textContent = label || 'Selected';
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

document.getElementById('view-purchases-btn').addEventListener('click', () => {
    renderPurchasesLog();
    toggleModal(purchasesLogModal, true);
});

document.getElementById('close-purchases-log').addEventListener('click', () => toggleModal(purchasesLogModal, false));

document.querySelectorAll('[id^="close-"]').forEach(btn => {
    if (btn.id === 'close-modal') return;
    btn.onclick = () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) toggleModal(modal, false);
    };
});

// Purchase Logging
window.openPurchaseModal = (id) => {
    const p = products.find(prod => prod.id === id);
    const lastPurchase = purchases.find(pur => pur.productId === id && !pur.voided);
    const initialPrice = lastPurchase ? lastPurchase.price : (p.purchasePrice ?? p.price);

    document.getElementById('purchase-product-name').textContent = p.name;
    document.getElementById('purchase-product-id').value = p.id;
    document.getElementById('purchase-stock-display').textContent = p.stock;
    document.getElementById('purchase-qty').value = 1;
    document.getElementById('purchase-price').value = initialPrice;
    document.getElementById('purchase-remarks').value = '';

    toggleModal(purchaseModal, true);
};

document.getElementById('purchase-form').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('purchase-product-id').value;
    const qty = parseInt(document.getElementById('purchase-qty').value);
    const unitPrice = parseFloat(document.getElementById('purchase-price').value);
    const remarks = document.getElementById('purchase-remarks').value.trim();
    const p = products.find(prod => prod.id === id);

    cart.push({
        cartId: generateId(),
        productId: id,
        productName: p.name,
        qty,
        price: unitPrice,
        remarks
    });

    renderCart();
    toggleModal(purchaseModal, false);
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

document.getElementById('finalize-purchase-btn').onclick = async () => {
    if (cart.length === 0) return alert("Cart is empty.");

    const confirmed = await showConfirm({
        title: 'Complete Purchase',
        message: 'Are you sure you want to finalize and record these purchases? This will increase your stock inventory.',
        icon: '📦',
        okText: 'Finalize Purchase'
    });
    if (!confirmed) return;

    const supplierName = document.getElementById('cart-supplier-name').value.trim() || 'Guest';

    cart.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
            p.stock += item.qty;
            purchases.unshift({
                id: generateId(),
                productId: item.productId,
                productName: item.productName,
                supplier: supplierName,
                qty: item.qty,
                price: item.price,
                remarks: item.remarks || '',
                timestamp: new Date().toLocaleString(),
                voided: false
            });
        }
    });

    document.getElementById('cart-supplier-name').value = '';
    cart = [];
    saveData();
    renderProducts();
    renderCart();
    toggleModal(document.getElementById('cart-drawer-overlay'), false);
    showToast('✅ Purchases recorded successfully!');
};

document.getElementById('cart-btn').onclick = () => toggleModal(document.getElementById('cart-drawer-overlay'), true);
document.getElementById('close-cart').onclick = () => toggleModal(document.getElementById('cart-drawer-overlay'), false);

// Product Type/Status Management (shared with sales)
const renderTypeOptions = () => pTypeSelect.innerHTML = productTypes.map(t => `<option value="${t}">${t}</option>`).join('');

const renderTypes = () => {
    const container = document.getElementById('type-list-container');
    if (!container) return;
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
    if (!pStatusContainer) return;
    pStatusContainer.innerHTML = productStatuses.map(s => `
        <label class="status-checkbox-label" style="display: flex; align-items: center; gap: 8px; background: #F8FAFC; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-paper); cursor: pointer; font-size: 0.8rem; transition: var(--transition);">
            <input type="checkbox" name="status" value="${s}" style="width: auto; margin: 0;">
            ${s}
        </label>
    `).join('');
};

const renderStatuses = () => {
    const container = document.getElementById('status-list-container');
    if (!container) return;
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
    if (cb) cb.checked = !cb.checked;
    toggleModal(statusModal, false);
};

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
            products.forEach(p => { if (p.type === oldType) p.type = newType.trim(); });
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

// Product CRUD
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
        };
    } else if (url) {
        data.image = url;
        finishSave(id, data);
    } else {
        if (existingImage) data.image = existingImage;
        finishSave(id, data);
    }
};

const finishSave = (id, data) => {
    if (id) {
        const idx = products.findIndex(p => p.id === id);
        products[idx] = { ...products[idx], ...data };
    } else {
        products.push({ id: generateId(), ...data, createdAt: Date.now() });
    }
    saveData();
    renderProducts();
    toggleModal(productModal, false);
};

window.viewHistory = (id) => {
    const p = products.find(prod => prod.id === id);
    const pPurchases = purchases.filter(pur => pur.productId === id);

    document.getElementById('history-product-name').textContent = p.name;
    const historyList = document.getElementById('history-list');

    historyList.innerHTML = pPurchases.length === 0
        ? '<div style="padding:20px; text-align:center; color:#636E72;">No purchase history for this product.</div>'
        : pPurchases.map(pur => `
            <div style="padding:12px; border-bottom: 1px solid var(--border-paper); display:flex; justify-content:space-between; align-items:center; ${pur.voided ? 'opacity:0.5; text-decoration:line-through;' : ''}">
                <div>
                    <div style="font-weight:700; font-size:0.9rem;">${pur.timestamp}</div>
                    <div style="font-size:0.8rem; color:#636E72;">${pur.qty} units @ ${formatCurrency(pur.price)} | ${pur.supplier || 'Guest'}</div>
                </div>
                <div style="font-weight:800; color:var(--success);">${formatCurrency(pur.qty * pur.price)}</div>
            </div>
        `).join('');

    toggleModal(historyModal, true);
};

window.editProduct = (id) => {
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

// Purchase Log
const renderPurchasesLog = () => {
    const body = document.getElementById('purchases-log-body');
    const clearBtn = document.getElementById('clear-voided-btn');
    const hasVoided = purchases.some(p => p.voided);
    clearBtn.style.display = hasVoided ? 'block' : 'none';

    body.innerHTML = purchases.map(p => `
        <tr class="${p.voided ? 'voided-sale' : ''}">
            <td>${p.timestamp}</td>
            <td>
                <div style="font-weight:700;">${p.productName}</div>
                <div style="font-size:0.75rem; color:#636E72;">Supplier: ${p.supplier || 'Guest'}</div>
            </td>
            <td>${p.qty}</td>
            <td>${formatCurrency(p.qty * p.price)}</td>
            <td>${p.voided ? 'Voided' : `<button onclick="voidPurchase('${p.id}')" class="btn btn-sm btn-danger">Void</button>`}</td>
        </tr>
    `).join('');
};

document.getElementById('clear-voided-btn').onclick = async () => {
    const confirmed = await showConfirm({
        title: 'Clear History',
        message: 'Permanently remove all voided entries from the purchase log? This action cannot be undone.',
        icon: '🧹',
        okText: 'Clear All'
    });
    if (confirmed) {
        purchases = purchases.filter(p => !p.voided);
        saveData();
        renderPurchasesLog();
    }
};

// Purchase Log Export/Import
document.getElementById('export-purchases-btn').onclick = () => {
    const data = {
        purchases,
        exportedAt: new Date().toISOString(),
        orgName: typeof getOrgName === 'function' ? getOrgName() : ''
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Purchase log exported');
};

document.getElementById('import-purchases-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : (parsed.purchases || []);
        if (!Array.isArray(arr) || arr.length === 0) {
            alert('No valid purchase data found in the file.');
            return;
        }
        const confirmed = await showConfirm({
            title: 'Import Purchases',
            message: `Import ${arr.length} record(s) and add them to your existing purchase log?`,
            icon: '📥',
            okText: 'Import & Merge'
        });
        if (!confirmed) return;
        const existingIds = new Set(purchases.map(p => p.id));
        const toAdd = arr.filter(r => r.productId != null && r.qty != null && r.price != null).map(r => ({
            ...r,
            id: existingIds.has(r.id) ? generateId() : r.id,
            voided: !!r.voided
        }));
        purchases = [...toAdd, ...purchases];
        saveData();
        renderPurchasesLog();
        updateStats();
        renderProducts();
        showToast(`✅ Imported ${toAdd.length} purchase record(s)`);
    } catch (err) {
        alert('Failed to import: invalid JSON or file format.');
    }
};

window.voidPurchase = (id) => {
    const p = purchases.find(x => x.id === id);
    const prod = products.find(x => x.id === p.productId);
    if (prod) prod.stock -= p.qty;
    p.voided = true;
    saveData();
    renderProducts();
    renderPurchasesLog();
};

document.getElementById('close-purchase-modal').onclick = () => toggleModal(purchaseModal, false);
document.getElementById('close-supplier-modal').onclick = () => toggleModal(supplierModal, false);

// Deep links from Help / bookmarks: #purchases-log, #cart
(() => {
    const h = location.hash.slice(1);
    if (h === 'purchases-log') {
        renderPurchasesLog();
        toggleModal(purchasesLogModal, true);
    } else if (h === 'cart') {
        toggleModal(document.getElementById('cart-drawer-overlay'), true);
    }
})();

// Modal backdrop close
[...document.querySelectorAll('.modal-overlay')].forEach(m => {
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

// Init
renderProducts();
updateStats();
renderTypeFilters();
renderStatusFilters();
renderStatusOptions();
if (typeof initOrgBranding === 'function') initOrgBranding();
