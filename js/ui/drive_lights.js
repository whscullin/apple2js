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
                document.querySelector('#disk-label' + drive).innerText = label;
            }
            return document.querySelector('#disk-label' + drive).innerText;
        }
    };
}
