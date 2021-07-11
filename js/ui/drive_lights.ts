import type { DriveCallbacks, DriveNumber } from '../formats/types';

export default class DriveLights implements DriveCallbacks {
    constructor(private prefix: string) {}

    public driveLight(drive: DriveNumber, on: boolean) {
        const disk =
            document.querySelector<HTMLElement>(`#${this.prefix}${drive}`);
        if (disk) {
            disk.style.backgroundImage =
                on ? 'url(css/red-on-16.png)' :
                    'url(css/red-off-16.png)';
        }
    }

    public dirty(_drive: DriveNumber, _dirty: boolean) {
        // document.querySelector('#disksave' + drive).disabled = !dirty;
    }

    public label(drive: DriveNumber, label?: string, side?: string) {
        const labelElement =
            document.querySelector<HTMLElement>(`#${this.prefix}-label${drive}`);
        if (labelElement) {
            if (label) {
                labelElement.innerText = label + (side ? ` - ${side}` : '');
            }
            return labelElement.innerText;
        } else {
            return `Disk ${drive}`;
        }
    }
}
