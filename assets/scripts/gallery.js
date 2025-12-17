var Gallery = pc.createScript('gallery');

Gallery.attributes.add('galleryTextAsset', { type: 'asset', assetType: 'binary', title: 'Gallery Image List (.txt or .csv)'});

Gallery.prototype.initialize = function () {
    this.waitForGalleryDOM();
};

Gallery.prototype.waitForGalleryDOM = function () {
    const galleryButton = document.querySelector('[data-mode="Gallery"]');
    const galleryPanel = document.querySelector('.gallery-panel');

    if (galleryButton && galleryPanel) {
        this.setupGallery(galleryButton, galleryPanel);
    } else {
        requestAnimationFrame(this.waitForGalleryDOM.bind(this));
    }
};

Gallery.prototype.setupGallery = function (galleryButton, galleryPanel) {
    let galleryInitialized = false;

    galleryButton.addEventListener('click', () => {
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

        lines.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;

            if (index === 0) {
                thumb.className = 'thumbnail active';
                mainImage.src = url;
                currentIndex = 0;
            } else {
                thumb.className = 'thumbnail';
            }

            thumb.addEventListener('click', () => {
                currentIndex = index;
                mainImage.src = url;

                thumbnailsContainer.querySelectorAll('.thumbnail').forEach(t => {
                    t.className = 'thumbnail';
                });

                thumb.className = 'thumbnail active';
            });

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

        arrowLeft?.addEventListener('click', () => updateImage(currentIndex - 1));
        arrowRight?.addEventListener('click', () => updateImage(currentIndex + 1));
    });

    const closeBtn = galleryPanel.querySelector('.gallery-close');
    if (closeBtn) {
        const hideGallery = () => {
            galleryPanel.classList.add('hidden');
        };
        closeBtn.addEventListener('click', hideGallery);
        closeBtn.addEventListener('touchstart', hideGallery, { passive: true });
        closeBtn.addEventListener('pointerdown', hideGallery, { passive: true });
    }
    galleryPanel.classList.add('hidden');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !galleryPanel.classList.contains('hidden')) {
            galleryPanel.classList.add('hidden');
        }
    });
};