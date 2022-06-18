/** @jest-environment jsdom */
import Apple2IO from 'js/apple2io';
import DiskII, { Callbacks } from 'js/cards/disk2';
import CPU6502 from 'js/cpu6502';
import { VideoModes } from 'js/videomodes';
import { mocked } from 'ts-jest/utils';
import { BYTES_BY_TRACK_IMAGE } from '../formats/testdata/16sector';

jest.mock('js/apple2io');
jest.mock('js/videomodes');

type Phase = 0 | 1 | 2 | 3; // not exported from DiskII

const STEPS_PER_TRACK = 4;
const PHASES_PER_TRACK = 2;

function setTrack(diskII: DiskII, track: number) {
    const initialState = diskII.getState();
    initialState.drives[0].track = track * STEPS_PER_TRACK;
    initialState.drives[0].phase = (track * PHASES_PER_TRACK) % 4 as Phase;
    diskII.setState(initialState);
}

function setWriteProtected(diskII: DiskII, isWriteProtected: boolean) {
    const initialState = diskII.getState();
    initialState.drives[0].readOnly = isWriteProtected;
    diskII.setState(initialState);
}

describe('DiskII', () => {
    const mockApple2IO = new Apple2IO({} as unknown as CPU6502, {} as unknown as VideoModes);
    const callbacks: Callbacks = {
        driveLight: jest.fn(),
        dirty: jest.fn(),
        label: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('is constructable', () => {
        const diskII = new DiskII(mockApple2IO, callbacks);
        expect(diskII).not.toBeNull();
    });

    describe('drive lights', () => {
        it('turns on drive light 1 when the motor is turned on', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x89);  // turn on the motor

            expect(callbacks.driveLight).toBeCalledTimes(1);
            expect(callbacks.driveLight).toBeCalledWith(1, true);
        });

        it('turns off drive light 1 when the motor is turned off', () => {
            jest.useFakeTimers();
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.ioSwitch(0x89);  // turn on the motor
            mocked(callbacks.driveLight).mockReset();

            diskII.ioSwitch(0x88);  // turn off the motor

            jest.runAllTimers();
            expect(callbacks.driveLight).toBeCalledTimes(1);
            expect(callbacks.driveLight).toBeCalledWith(1, false);
            jest.useRealTimers();
        });

        it('turns on drive light 2 when drive 2 is selected and the motor is turned on', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x8B);  // select drive 2
            diskII.ioSwitch(0x89);  // turn on the motor

            expect(callbacks.driveLight).toBeCalledTimes(1);
            expect(callbacks.driveLight).toBeCalledWith(2, true);
        });

        it('turns off drive light 2 when drive 2 is selected and the motor is turned off', () => {
            jest.useFakeTimers();
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.ioSwitch(0x8B);  // select drive 2
            diskII.ioSwitch(0x89);  // turn on the motor
            mocked(callbacks.driveLight).mockReset();

            diskII.ioSwitch(0x88);  // turn off the motor

            jest.runAllTimers();
            expect(callbacks.driveLight).toBeCalledTimes(1);
            expect(callbacks.driveLight).toBeCalledWith(2, false);
            jest.useRealTimers();
        });

        it('turns off drive light 1 and turns on drive light two when drive 2 is selected', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8B);  // select drive 2

            expect(callbacks.driveLight).toBeCalledTimes(3);
            expect(callbacks.driveLight).toHaveBeenNthCalledWith(1, 1, true);
            expect(callbacks.driveLight).toHaveBeenNthCalledWith(2, 1, false);
            expect(callbacks.driveLight).toHaveBeenNthCalledWith(3, 2, true);
        });
    });

    describe('head positioning', () => {
        it('does not allow head positioning when the drive is off', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x84);  // coil 2 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(0);
            expect(state.drives[0].track).toBe(0);
        });

        it('allows head positioning when the drive is on', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x84);  // coil 2 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(2);
            expect(state.drives[0].track).toBe(4);
        });

        it('moves the head to track 2 from track 0 when all phases are cycled', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x80);  // coil 0 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(0);
            expect(state.drives[0].track).toBe(2 * STEPS_PER_TRACK);
        });

        it('moves the head to track 10 from track 8 when all phases are cycled', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 8);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x80);  // coil 0 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(0);
            expect(state.drives[0].track).toBe(10 * STEPS_PER_TRACK);
        });

        it('stops the head at track 34', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 33);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x80);  // coil 0 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(0);
            // The emulated Disk II puts data for track n on the
            // 4 quarter-tracks starting with n * STEPS_PER_TRACK.
            // On a real Disk II, the data would likely be on 3
            // quarter-tracks starting with n * STEPS_PER_TRACK - 1,
            // leaving 1 essentially blank quarter track at the
            // half-track.
            expect(state.drives[0].track).toBe(35 * STEPS_PER_TRACK - 1);
        });

        it('moves a half track when only one phase is activated', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x86);  // coil 3 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(3);
            expect(state.drives[0].track).toBe(15 * STEPS_PER_TRACK + 2);
        });

        it('moves backward one track when phases are cycled in reverse', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x80);  // coil 0 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(0);
            expect(state.drives[0].track).toBe(14 * STEPS_PER_TRACK);
        });

        it('moves backward two tracks when all phases are cycled in reverse', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x84);  // coil 2 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(2);
            expect(state.drives[0].track).toBe(13 * STEPS_PER_TRACK);
        });

        it('does not move backwards past track 0', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 1);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x84);  // coil 2 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(2);
            expect(state.drives[0].track).toBe(0);
        });

        it('moves backward one half track', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x82);  // coil 1 off

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(1);
            expect(state.drives[0].track).toBe(14.5 * STEPS_PER_TRACK);
        });

        // The emulated Disk II is not able to step quarter tracks because
        // it does not track when phases are turned off.
        // eslint-disable-next-line jest/no-disabled-tests
        it.skip('moves a quarter track when two neighboring phases are activated and held', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x87);  // coil 3 on

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(3);
            expect(state.drives[0].track).toBe(15 * STEPS_PER_TRACK + 1);
        });

        // The emulated Disk II is not able to step quarter tracks because
        // it does not track when phases are turned off.
        // eslint-disable-next-line jest/no-disabled-tests
        it.skip('moves backward one quarter track', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setTrack(diskII, 15);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            diskII.ioSwitch(0x83);  // coil 1 on

            const state = diskII.getState();
            expect(state.drives[0].phase).toBe(1);
            expect(state.drives[0].track).toBe(14.25 * STEPS_PER_TRACK);
        });
    });

    describe('reading nibble-based disks', () => {
        it('spins the disk', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8e);  // read mode

            // Just check for changing nibbles
            let spinning = false;
            const firstNibble = diskII.ioSwitch(0x8c);  // read data
            for (let i = 0; i < 512; i++) {
                const thisNibble = diskII.ioSwitch(0x8c);  // read data
                if (thisNibble >= 0x80 && firstNibble !== thisNibble) {
                    spinning = true;
                }
            }
            expect(spinning).toBeTruthy();
        });

        it('after reading the data, the data register is set to zero', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8e);  // read mode

            // Find address field prolog
            let nibble = diskII.ioSwitch(0x8c);  // read data
            for (let i = 0; i < 512 && nibble !== 0xD5; i++) {
                nibble = diskII.ioSwitch(0x8c);  // read data
            }
            expect(nibble).toBe(0xD5);
            nibble = diskII.ioSwitch(0x8c);  // read data
            // expect next read to be a zero because the sequencer is waiting
            // for data
            expect(nibble).toBe(0x00);
        });

        it('after reading the data, then zero, there is new data', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8e);  // read mode

            // Find address field prolog
            let nibble = diskII.ioSwitch(0x8c);  // read data
            for (let i = 0; i < 512 && nibble !== 0xD5; i++) {
                nibble = diskII.ioSwitch(0x8c);  // read data
            }
            expect(nibble).toBe(0xD5);
            nibble = diskII.ioSwitch(0x8c);  // read data
            // expect next read to be a zero
            expect(nibble).toBe(0x00);
            // expect next read to be new data
            nibble = diskII.ioSwitch(0x8c);  // read data
            expect(nibble).toBe(0xAA);
        });

        it('read write protect status', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            setWriteProtected(diskII, true);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8E);  // read mode
            diskII.ioSwitch(0x8D);  // read write protect if read
            const isWriteProtected = diskII.ioSwitch(0x8E);  // read data

            expect(isWriteProtected).toBe(0xff);
        });
    });

    describe('writing nibble-based disks', () => {
        it('writes a nibble to the disk', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            let track0 = diskII.getState().drives[0].tracks[0];
            expect(track0[0]).toBe(0xFF);

            diskII.ioSwitch(0x89);        // turn on the motor
            diskII.ioSwitch(0x8F, 0x80);  // write
            diskII.ioSwitch(0x8C);        // shift

            track0 = diskII.getState().drives[0].tracks[0];
            expect(track0[0]).toBe(0x80);
        });

        it('writes two nibbles to the disk', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            let track0 = diskII.getState().drives[0].tracks[0];
            expect(track0[0]).toBe(0xFF);

            diskII.ioSwitch(0x89);        // turn on the motor
            diskII.ioSwitch(0x8F, 0x80);  // write
            diskII.ioSwitch(0x8C);        // shift
            diskII.ioSwitch(0x8F, 0x81);  // write
            diskII.ioSwitch(0x8C);        // shift

            track0 = diskII.getState().drives[0].tracks[0];
            expect(track0[0]).toBe(0x80);
            expect(track0[1]).toBe(0x81);
        });
    });
});
