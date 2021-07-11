import MicroModal from 'micromodal';

export function loadingStart() {
    const meter = document.querySelector<HTMLDivElement>('#loading-modal .meter')!;
    meter.style.display = 'none';
    MicroModal.show('loading-modal');
}

export function loadingProgress(current: number, total: number) {
    if (total) {
        const meter = document.querySelector<HTMLDivElement>('#loading-modal .meter')!;
        const progress = document.querySelector<HTMLDivElement>('#loading-modal .progress')!;
        meter.style.display = 'block';
        progress.style.width = current / total * meter.clientWidth + 'px';
    }
}

export function loadingStop() {
    MicroModal.close('loading-modal');
}
