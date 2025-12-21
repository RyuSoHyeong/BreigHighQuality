var Gallery = pc.createScript('gallery');

Gallery.attributes.add('galleryTextAsset', { type: 'asset', assetType: 'binary', title: 'Gallery Image List (.txt or .csv)'});

Gallery.prototype.initialize = function () {
    this._rafId = 0;
    this._onKeyDown = null;
    this._closeHandlers = null;
    this._arrowHandlers = null;

    this.waitForGalleryDOM();
};

Gallery.prototype.waitForGalleryDOM = function () {
    const galleryButton = document.querySelector('[data-mode="Gallery"]');
    const galleryPanel = document.querySelector('.gallery-panel');

    if (galleryButton && galleryPanel) {
        this.setupGallery(galleryButton, galleryPanel);
    } else {
        this._rafId = requestAnimationFrame(this.waitForGalleryDOM.bind(this));
    }
};

Gallery.prototype.setupGallery = function (galleryButton, galleryPanel) {
    this._galleryButton = galleryButton;
    this._galleryPanel = galleryPanel;

    let galleryInitialized = false;

    this._onOpen = () => {
        galleryPanel.classList.remove('hidden');

        if (galleryInitialized) return;
        galleryInitialized = true;

        const mainImage = galleryPanel.querySelector('.gallery-main-image');
        const thumbnailsContainer = galleryPanel.querySelector('.gallery-thumbnails');
        const arrowLeft = galleryPanel.querySelector('.gallery-left');
        const arrowRight = galleryPanel.querySelector('.gallery-right');

        const raw = this.app.assets.get(this.galleryTextAsset.id)?.resource;
        const lines = raw.trim().split('\n').map(s => s.trim()).filter(Boolean);

        if (!lines.length) {
            console.warn('[Gallery] No URLs found in galleryTextAsset');
            return;
        }

        let currentIndex = 0;

        thumbnailsContainer.innerHTML = '';

        const onThumbClick = (e) => {
            const img = e.target.closest('img.thumbnail');
            if (!img) return;

            const idx = img.dataset.index | 0;
            currentIndex = idx;
            mainImage.src = lines[currentIndex];

            thumbnailsContainer.querySelectorAll('.thumbnail').forEach((t, i) => {
                t.className = i === currentIndex ? 'thumbnail active' : 'thumbnail';
            });
        };

        thumbnailsContainer.addEventListener('click', onThumbClick);

        lines.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.dataset.index = index;

            if (index === 0) {
                thumb.className = 'thumbnail active';
                mainImage.src = url;
                currentIndex = 0;
            } else {
                thumb.className = 'thumbnail';
            }

            thumbnailsContainer.appendChild(thumb);
        });

        setTimeout(() => {
            thumbnailsContainer.scrollLeft = 0;
        }, 10);

        const updateImage = (index) => {
            if (index < 0) index = lines.length - 1;
            if (index >= lines.length) index = 0;
            currentIndex = index;
            mainImage.src = lines[currentIndex];
            thumbnailsContainer.querySelectorAll('.thumbnail').forEach((t, i) => {
                t.className = i === currentIndex ? 'thumbnail active' : 'thumbnail';
            });
        };

        const onLeft = () => updateImage(currentIndex - 1);
        const onRight = () => updateImage(currentIndex + 1);

        arrowLeft?.addEventListener('click', onLeft);
        arrowRight?.addEventListener('click', onRight);

        this._arrowHandlers = { arrowLeft, arrowRight, onLeft, onRight, thumbnailsContainer, onThumbClick };
    };

    galleryButton.addEventListener('click', this._onOpen);

    const closeBtn = galleryPanel.querySelector('.gallery-close');
    if (closeBtn) {
        const hideGallery = () => {
            galleryPanel.classList.add('hidden');
        };
        const onClick = hideGallery;
        const onTouch = hideGallery;
        const onPointer = hideGallery;

        closeBtn.addEventListener('click', onClick);
        closeBtn.addEventListener('touchstart', onTouch, { passive: true });
        closeBtn.addEventListener('pointerdown', onPointer, { passive: true });

        this._closeHandlers = { closeBtn, onClick, onTouch, onPointer };
    }

    galleryPanel.classList.add('hidden');

    this._onKeyDown = (e) => {
        if (e.key === 'Escape' && !galleryPanel.classList.contains('hidden')) {
            galleryPanel.classList.add('hidden');
        }
    };
    document.addEventListener('keydown', this._onKeyDown);
};

Gallery.prototype.onDestroy = function () {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;

    if (this._galleryButton && this._onOpen) {
        this._galleryButton.removeEventListener('click', this._onOpen);
    }

    if (this._closeHandlers) {
        const { closeBtn, onClick, onTouch, onPointer } = this._closeHandlers;
        closeBtn.removeEventListener('click', onClick);
        closeBtn.removeEventListener('touchstart', onTouch);
        closeBtn.removeEventListener('pointerdown', onPointer);
        this._closeHandlers = null;
    }

    if (this._arrowHandlers) {
        const { arrowLeft, arrowRight, onLeft, onRight, thumbnailsContainer, onThumbClick } = this._arrowHandlers;
        arrowLeft?.removeEventListener('click', onLeft);
        arrowRight?.removeEventListener('click', onRight);
        thumbnailsContainer?.removeEventListener('click', onThumbClick);
        this._arrowHandlers = null;
    }

    if (this._onKeyDown) {
        document.removeEventListener('keydown', this._onKeyDown);
        this._onKeyDown = null;
    }

    this._galleryButton = null;
    this._galleryPanel = null;
    this._onOpen = null;
};