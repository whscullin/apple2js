export default function DriveLights()
{
    return {
        driveLight: function(drive, on) {
            var disk = document.querySelector('#disk' + drive);
            disk.style.backgroundImage =
                on ? 'url(css/red-on-16.png)' :
                    'url(css/red-off-16.png)';
        },
        dirty: function() {
            // document.querySelector('#disksave' + drive).disabled = !dirty;
        },
        label: function(drive, label) {
            if (label) {
                document.querySelector('#disklabel' + drive).innerText = label;
            }
            return document.querySelector('#disklabel' + drive).innerText;
        },
        getState: function() {
            return {
                disks: [
                    this.label(1),
                    this.label(2)
                ]
            };
        },
        setState: function(state) {
            if (state && state.disks) {
                this.label(1, state.disks[0].label);
                this.label(2, state.disks[1].label);
            }
        }
    };
}
