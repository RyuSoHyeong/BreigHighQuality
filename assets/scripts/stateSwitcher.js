var StateSwitcher = pc.createScript('stateSwitcher');

StateSwitcher.attributes.add('currentEntity', { type: 'entity' });
StateSwitcher.attributes.add('futureEntity', { type: 'entity' });

StateSwitcher.prototype.initialize = function () {
    this._buttons = Array.from(document.querySelectorAll('.state-panel .button'));
    if (!this._buttons.length) return;

    this._onClick = (e) => {
        const btn = e.currentTarget;

        this._buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const state = btn.dataset.state;
        const isCurrent = state === "0";

        if (this.currentEntity) this.currentEntity.enabled = isCurrent;
        if (this.futureEntity) this.futureEntity.enabled = !isCurrent;
    };

    this._buttons.forEach(btn => {
        btn.addEventListener('click', this._onClick);
    });
};

StateSwitcher.prototype.onDestroy = function () {
    if (!this._buttons || !this._onClick) return;
    this._buttons.forEach(btn => btn.removeEventListener('click', this._onClick));
    this._buttons = null;
    this._onClick = null;
};