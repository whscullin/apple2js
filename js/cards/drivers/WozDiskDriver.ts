import Apple2IO from '../../apple2io';
import { DriveNumber, WozDisk } from '../../formats/types';
import { toHex } from '../../util';
import { SEQUENCER_ROM } from '../disk2';
import { BaseDiskDriver } from './BaseDiskDriver';
import { ControllerState, Drive, DriverState, LssClockCycle, LssState } from './types';

interface WozDiskDriverState extends DriverState {
    clock: LssClockCycle;
    state: LssState;
    lastCycles: number;
    zeros: number;
}

export class WozDiskDriver extends BaseDiskDriver {
    /** Logic state sequencer clock cycle. */
    private clock: LssClockCycle;
    /** Logic state sequencer state. */
    private state: LssState;
    /** Current CPU cycle count. */
    private lastCycles: number = 0;
    /**
     * Number of zeros read in a row. The Disk ][ can only read two zeros in a
     * row reliably; above that and the drive starts reporting garbage.  See
     * "Freaking Out Like a MC3470" in the WOZ spec.
     */
    private zeros = 0;

    constructor(
        driveNo: DriveNumber,
        drive: Drive,
        readonly disk: WozDisk,
        controller: ControllerState,
        private readonly onDirty: () => void,
        private readonly io: Apple2IO) {
        super(driveNo, drive, disk, controller);

        // From the example in UtA2e, p. 9-29, col. 1, para. 1., this is
        // essentially the start of the sequencer loop and produces
        // correctly synced nibbles immediately.  Starting at state 0
        // would introduce a spurrious 1 in the latch at the beginning,
        // which requires reading several more sync bytes to sync up.
        this.state = 2;
        this.clock = 0;
    }

    onDriveOn(): void {
        this.lastCycles = this.io.cycles();
    }

    onDriveOff(): void {
        // nothing
    }

    /**
     * Spin the disk under the read/write head for WOZ images.
     *
     * This implementation emulates every clock cycle of the 2 MHz
     * sequencer since the last time it was called in order to
     * determine the current state. Because this is called on
     * every access to the softswitches, the data in the latch
     * will be correct on every read.
     *
     * The emulation of the disk makes a few simplifying assumptions:
     *
     * *   The motor turns on instantly.
     * *   The head moves tracks instantly.
     * *   The length (in bits) of each track of the WOZ image
     *     represents one full rotation of the disk and that each
     *     bit is evenly spaced.
     * *   Writing will not change the track length. This means
     *     that short tracks stay short.
     * *   The read head picks up the next bit when the sequencer
     *     clock === 4.
     * *   Head position X on track T is equivalent to head position
     *     X on track T′. (This is not the recommendation in the WOZ
     *     spec.)
     * *   Unspecified tracks contain a single zero bit. (A very
     *     short track, indeed!)
     * *   Two zero bits are sufficient to cause the MC3470 to freak
     *     out. When freaking out, it returns 0 and 1 with equal
     *     probability.
     * *   Any softswitch changes happen before `moveHead`. This is
     *     important because it means that if the clock is ever
     *     advanced more than one cycle between calls, the
     *     softswitch changes will appear to happen at the very
     *     beginning, not just before the last cycle.
     */
    private moveHead() {
        // TODO(flan): Short-circuit if the drive is not on.
        const cycles = this.io.cycles();

        // Spin the disk the number of elapsed cycles since last call
        let workCycles = (cycles - this.lastCycles) * 2;
        this.lastCycles = cycles;

        const drive = this.drive;
        const disk = this.disk;
        const controller = this.controller;

        // TODO(flan): Improve unformatted track behavior. The WOZ
        // documentation suggests using an empty track of 6400 bytes
        // (51,200 bits).
        const track = disk.rawTracks[disk.trackMap[drive.track]] || [0];

        while (workCycles-- > 0) {
            let pulse: number = 0;
            if (this.clock === 4) {
                pulse = track[drive.head];
                if (!pulse) {
                    // More than 2 zeros can not be read reliably.
                    // TODO(flan): Revisit with the new MC3470
                    // suggested 4-bit window behavior.
                    if (++this.zeros > 2) {
                        const r = Math.random();
                        pulse = r >= 0.5 ? 1 : 0;
                    }
                } else {
                    this.zeros = 0;
                }
            }

            let idx = 0;
            idx |= pulse ? 0x00 : 0x01;
            idx |= controller.latch & 0x80 ? 0x02 : 0x00;
            idx |= controller.q6 ? 0x04 : 0x00;
            idx |= controller.q7 ? 0x08 : 0x00;
            idx |= this.state << 4;

            const command = SEQUENCER_ROM[controller.sectors][idx];

            this.debug(`clock: ${this.clock} state: ${toHex(this.state)} pulse: ${pulse} command: ${toHex(command)} q6: ${controller.q6} latch: ${toHex(controller.latch)}`);

            switch (command & 0xf) {
                case 0x0: // CLR
                    controller.latch = 0;
                    break;
                case 0x8: // NOP
                    break;
                case 0x9: // SL0
                    controller.latch = (controller.latch << 1) & 0xff;
                    break;
                case 0xA: // SR
                    controller.latch >>= 1;
                    if (this.isWriteProtected()) {
                        controller.latch |= 0x80;
                    }
                    break;
                case 0xB: // LD
                    controller.latch = controller.bus;
                    this.debug('Loading', toHex(controller.latch), 'from bus');
                    break;
                case 0xD: // SL1
                    controller.latch = ((controller.latch << 1) | 0x01) & 0xff;
                    break;
                default:
                    this.debug(`unknown command: ${toHex(command & 0xf)}`);
            }
            this.state = (command >> 4 & 0xF) as LssState;

            if (this.clock === 4) {
                if (this.isOn()) {
                    if (controller.q7) {
                        // TODO(flan): This assumes that writes are happening in
                        // a "friendly" way, namely where the track was originally
                        // written. To do this correctly, the virtual head should
                        // actually keep track of the current quarter track plus
                        // the one on each side. Then, when writing, it should
                        // check that all three are actually the same rawTrack. If
                        // they aren't, then the trackMap has to be updated as
                        // well.
                        track[drive.head] = this.state & 0x8 ? 0x01 : 0x00;
                        this.debug('Wrote', this.state & 0x8 ? 0x01 : 0x00);
                        drive.dirty = true;
                        this.onDirty();
                    }

                    if (++drive.head >= track.length) {
                        drive.head = 0;
                    }
                }
            }

            if (++this.clock > 7) {
                this.clock = 0;
            }
        }
    }

    tick(): void {
        this.moveHead();
    }

    onQ6High(_readMode: boolean): void {
        // nothing?
    }

    onQ6Low(): void {
        // nothing?
    }

    clampTrack(): void {
        // For NibbleDisks, the emulator clamps the track to the available
        // range.
        if (this.drive.track < 0) {
            this.drive.track = 0;
        }
        const lastTrack = this.disk.trackMap.length - 1;
        if (this.drive.track > lastTrack) {
            this.drive.track = lastTrack;
        }
    }

    getState(): WozDiskDriverState {
        const { clock, state, lastCycles, zeros } = this;
        return { clock, state, lastCycles, zeros };
    }

    setState(state: WozDiskDriverState) {
        this.clock = state.clock;
        this.state = state.state;
        this.lastCycles = state.lastCycles;
        this.zeros = state.zeros;
    }
}
