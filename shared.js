/**
 * Shared utilities for SalesKpr and SalesKpr pages
 */
window.formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
window.generateId = () => Math.random().toString(36).substr(2, 9);

let _toastTimer = null;
window.showToast = (message, duration = 3000) => {
    const el = document.getElementById('toast-notification');
    if (!el) return;
    if (_toastTimer) clearTimeout(_toastTimer);
    el.textContent = message;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    _toastTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
};

window.toggleModal = (modal, show) => {
    if (!modal) return;
    modal.classList.toggle('active', show);
    modal.closest('.modal-overlay')?.classList.toggle('active', show);
    const anyModalActive = document.querySelectorAll('.modal-overlay.active').length > 0;
    document.body.classList.toggle('modal-open', anyModalActive);
};

// Organisation branding (logo + name) – stored in localStorage, used in chits/logs
window.getOrgLogo = () => localStorage.getItem('bookmaker_org_logo') || '';
window.getOrgName = () => localStorage.getItem('bookmaker_org_name') || '';

window.renderOrgNameDisplay = () => {
    const display = document.getElementById('org-name-display');
    const btn = document.getElementById('org-name-btn');
    if (!display || !btn) return;
    const name = getOrgName();
    display.textContent = name || 'Organisation name';
    display.classList.toggle('placeholder', !name);
    btn.textContent = name ? 'Edit' : 'Add name';
};

window.initOrgBranding = () => {
    const logoInput = document.getElementById('org-logo-input');
    const logoPreview = document.getElementById('org-logo-preview');
    const logoPlaceholder = document.getElementById('org-logo-placeholder');
    const nameBtn = document.getElementById('org-name-btn');
    if (!logoInput || !nameBtn) return;

    const savedLogo = getOrgLogo();
    if (savedLogo) {
        logoPreview.src = savedLogo;
        logoPreview.style.display = 'block';
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
    renderOrgNameDisplay();

    logoInput.onchange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            localStorage.setItem('bookmaker_org_logo', dataUrl);
            if (logoPreview) {
                logoPreview.src = dataUrl;
                logoPreview.style.display = 'block';
            }
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };

    nameBtn.onclick = () => {
        const current = getOrgName();
        const val = prompt('Enter organisation name:', current || '');
        if (val !== null) {
            const trimmed = val.trim();
            localStorage.setItem('bookmaker_org_name', trimmed);
            renderOrgNameDisplay();
        }
    };
};
