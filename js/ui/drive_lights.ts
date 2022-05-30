import { Callbacks } from '../cards/disk2';
import type { DriveNumber } from '../formats/types';

export default class DriveLights implements Callbacks {
    public driveLight(drive: DriveNumber, on: boolean) {
        const disk = document.querySelector<HTMLElement>(`#disk${drive}`);
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
        const labelElement = document.querySelector<HTMLElement>(`#disk-label${drive}`);
        const labelText = `${label || ''} ${(side ? `- ${side}` : '')}`;
        if (label && labelElement) {
            labelElement.innerText = labelText;
        }
        return labelText;
    }
}
