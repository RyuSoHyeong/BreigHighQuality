var StateSwitcher = pc.createScript('stateSwitcher');

StateSwitcher.attributes.add('currentEntity', { type: 'entity' });
StateSwitcher.attributes.add('futureEntity', { type: 'entity' });

StateSwitcher.prototype.initialize = function () {
    const buttons = document.querySelectorAll('.state-panel .button');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const state = btn.dataset.state;
            const isCurrent = state === "0";

            if (this.currentEntity) this.currentEntity.enabled = isCurrent;
            if (this.futureEntity) this.futureEntity.enabled = !isCurrent;
        });
    });
};