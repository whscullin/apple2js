import { Callbacks, DriveNumber } from '../cards/disk2';

export default class DriveLights implements Callbacks {
    public driveLight(drive: DriveNumber, on: boolean) {
        const disk =
            document.querySelector('#disk' + drive)! as HTMLElement;
        disk.style.backgroundImage =
            on ? 'url(css/red-on-16.png)' :
                'url(css/red-off-16.png)';
    }

    public dirty() {
        // document.querySelector('#disksave' + drive).disabled = !dirty;
    }

    public label(drive: DriveNumber, label: string) {
        const labelElement =
            document.querySelector('#disk-label' + drive)! as HTMLElement;
        if (label) {
            labelElement.innerText = label;
        }
        return labelElement.innerText;
    }
}
