var StateSwitcher = pc.createScript('stateSwitcher');

StateSwitcher.attributes.add('currentEntity', { type: 'entity' });
StateSwitcher.attributes.add('futureEntity', { type: 'entity' });

StateSwitcher.prototype.initialize = function () {
    this._buttons = Array.from(document.querySelectorAll('.state-panel .button'));
    if (!this._buttons.length) return;

    this._onClick = (e) => {
        const btn = e.currentTarget;

        for (const b of this._buttons) b.classList.toggle('active', b === btn);

        const isCurrent = btn.dataset.state === "0";
        if (this.currentEntity) this.currentEntity.enabled = isCurrent;
        if (this.futureEntity) this.futureEntity.enabled = !isCurrent;
    };

    for (const btn of this._buttons) btn.addEventListener('click', this._onClick);
};

StateSwitcher.prototype.onDestroy = function () {
    if (this._buttons && this._onClick) {
        for (const btn of this._buttons) btn.removeEventListener('click', this._onClick);
    }
    this._buttons = null;
    this._onClick = null;
};