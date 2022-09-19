import { Callbacks } from '../cards/disk2';
import type { DriveNumber } from '../formats/types';

export default class DriveLights implements Callbacks {
    public driveLight(driveNo: DriveNumber, on: boolean) {
        const disk = document.querySelector<HTMLElement>(`#disk${driveNo}`);
        if (disk) {
            disk.style.backgroundImage =
                on ? 'url(css/red-on-16.png)' :
                    'url(css/red-off-16.png)';
        }
    }

    public dirty(_driveNo: DriveNumber, _dirty: boolean) {
        // document.querySelector('#disksave' + drive).disabled = !dirty;
    }

    public label(driveNo: DriveNumber, label?: string, side?: string) {
        const labelElement = document.querySelector<HTMLElement>(`#disk-label${driveNo}`);
        let labelText = '';
        if (labelElement) {
            labelText = labelElement.innerText;
            if (label) {
                labelText = `${label || ''} ${(side ? `- ${side}` : '')}`;
                labelElement.innerText = labelText;
            }
        }
        return labelText;
    }
}
