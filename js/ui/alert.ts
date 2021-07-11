import MicroModal from 'micromodal';

export function openAlert(msg: string) {
    const el = document.querySelector<HTMLDivElement>('#alert-modal .message')!;
    el.innerText = msg;
    MicroModal.show('alert-modal');
}
