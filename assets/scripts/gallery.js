var Gallery = pc.createScript('gallery');

Gallery.attributes.add('galleryTextAsset', { type: 'asset', assetType: 'text'});

Gallery.prototype.initialize = function () {
    this._rafId = 0;

    this._galleryButton = null;
    this._galleryPanel = null;

    this._initialized = false;
    this._currentIndex = 0;

    this._mainImage = null;
    this._thumbnails = null;
    this._arrowLeft = null;
    this._arrowRight = null;

    this._onOpen = null;
    this._onKeyDown = null;
    this._onThumbClick = null;
    this._onLeft = null;
    this._onRight = null;
    this._onClose = null;

    this._waitForDom = this.waitForGalleryDOM.bind(this);
    this._rafId = requestAnimationFrame(this._waitForDom);
};

Gallery.prototype.waitForGalleryDOM = function () {
    const btn = document.querySelector('[data-mode="Gallery"]');
    const panel = document.querySelector('.gallery-panel');

    if (btn && panel) {
        this.setupGallery(btn, panel);
        return;
    }

    this._rafId = requestAnimationFrame(this._waitForDom);
};

Gallery.prototype.getLines = function () {
    const raw = this.app.assets.get(this.galleryTextAsset.id)?.resource || '';
    return raw
        .trim()
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
};

Gallery.prototype.setHidden = function (hidden) {
    this._galleryPanel?.classList.toggle('hidden', !!hidden);
};

Gallery.prototype.updateActiveThumb = function () {
    if (!this._thumbnails) return;
    const thumbs = this._thumbnails.querySelectorAll('.thumbnail');
    thumbs.forEach((t, i) => t.className = i === this._currentIndex ? 'thumbnail active' : 'thumbnail');
};

Gallery.prototype.setIndex = function (lines, idx) {
    if (!lines.length) return;

    if (idx < 0) idx = lines.length - 1;
    if (idx >= lines.length) idx = 0;

    this._currentIndex = idx;

    if (this._mainImage) this._mainImage.src = lines[this._currentIndex];
    this.updateActiveThumb();
};

Gallery.prototype.setupGallery = function (galleryButton, galleryPanel) {
    this._galleryButton = galleryButton;
    this._galleryPanel = galleryPanel;

    this._onOpen = () => {
        this.setHidden(false);
        if (this._initialized) return;

        const lines = this.getLines();
        if (!lines.length) {
            console.warn('[Gallery] No URLs found in galleryTextAsset');
            return;
        }

        this._initialized = true;

        this._mainImage = galleryPanel.querySelector('.gallery-main-image');
        this._thumbnails = galleryPanel.querySelector('.gallery-thumbnails');
        this._arrowLeft = galleryPanel.querySelector('.gallery-left');
        this._arrowRight = galleryPanel.querySelector('.gallery-right');

        this._thumbnails?.replaceChildren();

        this._onThumbClick = (e) => {
            const img = e.target.closest('img.thumbnail');
            if (!img) return;
            this.setIndex(lines, img.dataset.index | 0);
        };

        this._onLeft = () => this.setIndex(lines, this._currentIndex - 1);
        this._onRight = () => this.setIndex(lines, this._currentIndex + 1);

        this._thumbnails?.addEventListener('click', this._onThumbClick);
        this._arrowLeft?.addEventListener('click', this._onLeft);
        this._arrowRight?.addEventListener('click', this._onRight);

        lines.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.dataset.index = index;
            thumb.className = index === 0 ? 'thumbnail active' : 'thumbnail';
            this._thumbnails?.appendChild(thumb);
        });

        this._currentIndex = 0;
        if (this._mainImage) this._mainImage.src = lines[0];

        setTimeout(() => { if (this._thumbnails) this._thumbnails.scrollLeft = 0; }, 10);
    };

    galleryButton.addEventListener('click', this._onOpen);

    const closeBtn = galleryPanel.querySelector('.gallery-close');
    if (closeBtn) {
        this._onClose = () => this.setHidden(true);
        closeBtn.addEventListener('click', this._onClose);
        closeBtn.addEventListener('touchstart', this._onClose, { passive: true });
        closeBtn.addEventListener('pointerdown', this._onClose, { passive: true });
    }

    this._onKeyDown = (e) => {
        if (e.key === 'Escape' && this._galleryPanel && !this._galleryPanel.classList.contains('hidden')) {
            this.setHidden(true);
        }
    };
    document.addEventListener('keydown', this._onKeyDown);

    this.setHidden(true);
};

Gallery.prototype.onDestroy = function () {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;

    if (this._galleryButton && this._onOpen) this._galleryButton.removeEventListener('click', this._onOpen);

    if (this._galleryPanel) {
        const closeBtn = this._galleryPanel.querySelector('.gallery-close');
        if (closeBtn && this._onClose) {
            closeBtn.removeEventListener('click', this._onClose);
            closeBtn.removeEventListener('touchstart', this._onClose);
            closeBtn.removeEventListener('pointerdown', this._onClose);
        }
    }

    this._thumbnails?.removeEventListener('click', this._onThumbClick);
    this._arrowLeft?.removeEventListener('click', this._onLeft);
    this._arrowRight?.removeEventListener('click', this._onRight);

    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);

    this._galleryButton = null;
    this._galleryPanel = null;

    this._mainImage = null;
    this._thumbnails = null;
    this._arrowLeft = null;
    this._arrowRight = null;

    this._onOpen = null;
    this._onKeyDown = null;
    this._onThumbClick = null;
    this._onLeft = null;
    this._onRight = null;
    this._onClose = null;
};