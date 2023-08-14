/** @jest-environment jsdom */
import fs from 'fs';

import Apple2IO from 'js/apple2io';
import DiskII, { Callbacks } from 'js/cards/disk2';
import CPU6502 from 'js/cpu6502';
import { DriveNumber, NibbleDisk, WozDisk } from 'js/formats/types';
import { byte } from 'js/types';
import { toHex } from 'js/util';
import { VideoModes } from 'js/videomodes';
import { BYTES_BY_SECTOR_IMAGE, BYTES_BY_TRACK_IMAGE } from '../formats/testdata/16sector';

jest.mock('js/apple2io');
jest.mock('js/videomodes');

type Phase = 0 | 1 | 2 | 3; // not exported from DiskII

const STEPS_PER_TRACK = 4;
const PHASES_PER_TRACK = 2;

function setTrack(diskII: DiskII, track: number) {
    const initialState = diskII.getState();
    initialState.drives[1].track = track * STEPS_PER_TRACK;
    initialState.drives[1].phase = (track * PHASES_PER_TRACK) % 4 as Phase;
    diskII.setState(initialState);
}

function setWriteProtected(diskII: DiskII, isWriteProtected: boolean) {
    const initialState = diskII.getState();
    initialState.drives[1].readOnly = isWriteProtected;
    diskII.setState(initialState);
}

describe('DiskII', () => {
    const mockApple2IO = new Apple2IO({} as unknown as CPU6502, {} as unknown as VideoModes);
    const callbacks: jest.Mocked<Callbacks> = {
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

    it('round-trips the state when there are no changes', () => {
        const diskII = new DiskII(mockApple2IO, callbacks);
        diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);

        const state = diskII.getState();
        diskII.setState(state);

        expect(diskII.getState()).toEqual(state);
    });

    it('round-trips the state when there are changes', () => {
        const diskII = new DiskII(mockApple2IO, callbacks);
        diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
        diskII.setBinary(2, 'BYTES_BY_SECTOR', 'po', BYTES_BY_SECTOR_IMAGE);

        const state = diskII.getState();
        // These are just arbitrary changes, not an exhaustive list of fields.
        (state.drives[1].driver as { skip: number }).skip = 1;
        state.controllerState.driveNo = 2;
        state.controllerState.latch = 0x42;
        state.controllerState.on = true;
        state.controllerState.q7 = true;
        const disk2 = state.drives[2].disk as NibbleDisk;
        disk2.tracks[14][12] = 0x80;
        state.drives[2].head = 1000;
        state.drives[2].phase = 3;
        diskII.setState(state);

        expect(diskII.getState()).toEqual(state);
    });

    it('calls all of the callbacks when state is restored', () => {
        const diskII = new DiskII(mockApple2IO, callbacks);
        diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
        jest.resetAllMocks();

        const state = diskII.getState();
        diskII.setState(state);

        expect(callbacks.driveLight).toHaveBeenCalledTimes(2);
        expect(callbacks.driveLight).toHaveBeenCalledWith(1, false);
        expect(callbacks.driveLight).toHaveBeenCalledWith(2, false);

        expect(callbacks.label).toHaveBeenCalledTimes(2);
        expect(callbacks.label).toHaveBeenCalledWith(1, 'BYTES_BY_TRACK', undefined);
        expect(callbacks.label).toHaveBeenCalledWith(2, 'Disk 2', undefined);

        expect(callbacks.dirty).toHaveBeenCalledTimes(2);
        expect(callbacks.dirty).toHaveBeenCalledWith(1, false);
        expect(callbacks.dirty).toHaveBeenCalledWith(2, false);
    });

    describe('drive lights', () => {
        it('turns on drive light 1 when the motor is turned on', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x89);  // turn on the motor

            expect(callbacks.driveLight).toHaveBeenCalledTimes(1);
            expect(callbacks.driveLight).toHaveBeenCalledWith(1, true);
        });

        it('turns off drive light 1 when the motor is turned off', () => {
            jest.useFakeTimers();
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.ioSwitch(0x89);  // turn on the motor
            callbacks.driveLight.mockReset();

            diskII.ioSwitch(0x88);  // turn off the motor

            jest.runAllTimers();
            expect(callbacks.driveLight).toHaveBeenCalledTimes(1);
            expect(callbacks.driveLight).toHaveBeenCalledWith(1, false);
            jest.useRealTimers();
        });

        it('turns on drive light 2 when drive 2 is selected and the motor is turned on', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x8B);  // select drive 2
            diskII.ioSwitch(0x89);  // turn on the motor

            expect(callbacks.driveLight).toHaveBeenCalledTimes(1);
            expect(callbacks.driveLight).toHaveBeenCalledWith(2, true);
        });

        it('turns off drive light 2 when drive 2 is selected and the motor is turned off', () => {
            jest.useFakeTimers();
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.ioSwitch(0x8B);  // select drive 2
            diskII.ioSwitch(0x89);  // turn on the motor
            callbacks.driveLight.mockReset();

            diskII.ioSwitch(0x88);  // turn off the motor

            jest.runAllTimers();
            expect(callbacks.driveLight).toHaveBeenCalledTimes(1);
            expect(callbacks.driveLight).toHaveBeenCalledWith(2, false);
            jest.useRealTimers();
        });

        it('turns off drive light 1 and turns on drive light two when drive 2 is selected', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8B);  // select drive 2

            expect(callbacks.driveLight).toHaveBeenCalledTimes(3);
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
            expect(state.drives[1].phase).toBe(0);
            expect(state.drives[1].track).toBe(0);
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
            expect(state.drives[1].phase).toBe(2);
            expect(state.drives[1].track).toBe(4);
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
            expect(state.drives[1].phase).toBe(0);
            expect(state.drives[1].track).toBe(2 * STEPS_PER_TRACK);
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
            expect(state.drives[1].phase).toBe(0);
            expect(state.drives[1].track).toBe(10 * STEPS_PER_TRACK);
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
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x87);  // coil 3 on
            diskII.ioSwitch(0x84);  // coil 2 off
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x86);  // coil 3 off
            diskII.ioSwitch(0x80);  // coil 0 off

            const state = diskII.getState();
            expect(state.drives[1].phase).toBe(0);
            // The emulated Disk II puts data for track n on the
            // 4 quarter-tracks starting with n * STEPS_PER_TRACK.
            // On a real Disk II, the data would likely be on 3
            // quarter-tracks starting with n * STEPS_PER_TRACK - 1,
            // leaving 1 essentially blank quarter track at the
            // half-track.
            expect(state.drives[1].track).toBe(35 * STEPS_PER_TRACK - 1);
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
            expect(state.drives[1].phase).toBe(3);
            expect(state.drives[1].track).toBe(15 * STEPS_PER_TRACK + 2);
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
            expect(state.drives[1].phase).toBe(0);
            expect(state.drives[1].track).toBe(14 * STEPS_PER_TRACK);
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
            expect(state.drives[1].phase).toBe(2);
            expect(state.drives[1].track).toBe(13 * STEPS_PER_TRACK);
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
            expect(state.drives[1].phase).toBe(2);
            expect(state.drives[1].track).toBe(0);
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
            expect(state.drives[1].phase).toBe(1);
            expect(state.drives[1].track).toBe(14.5 * STEPS_PER_TRACK);
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
            expect(state.drives[1].phase).toBe(3);
            expect(state.drives[1].track).toBe(15 * STEPS_PER_TRACK + 1);
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
            expect(state.drives[1].phase).toBe(1);
            expect(state.drives[1].track).toBe(14.25 * STEPS_PER_TRACK);
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
            let disk1 = diskII.getState().drives[1].disk as NibbleDisk;
            let track0 = disk1.tracks[0];
            expect(track0[0]).toBe(0xFF);

            diskII.ioSwitch(0x89);        // turn on the motor
            diskII.ioSwitch(0x8F, 0x80);  // write
            diskII.ioSwitch(0x8C);        // shift

            disk1 = diskII.getState().drives[1].disk as NibbleDisk;
            track0 = disk1.tracks[0];
            expect(track0[0]).toBe(0x80);
        });

        it('writes two nibbles to the disk', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            let disk1 = diskII.getState().drives[1].disk as NibbleDisk;
            let track0 = disk1.tracks[0];
            expect(track0[0]).toBe(0xFF);

            diskII.ioSwitch(0x89);        // turn on the motor
            diskII.ioSwitch(0x8F, 0x80);  // write
            diskII.ioSwitch(0x8C);        // shift
            diskII.ioSwitch(0x8F, 0x81);  // write
            diskII.ioSwitch(0x8C);        // shift

            disk1 = diskII.getState().drives[1].disk as NibbleDisk;
            track0 = disk1.tracks[0];
            expect(track0[0]).toBe(0x80);
            expect(track0[1]).toBe(0x81);
        });

        it('sets disk state to dirty and calls the dirty callback when written', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'BYTES_BY_TRACK', 'po', BYTES_BY_TRACK_IMAGE);
            let state = diskII.getState();
            state.drives[1].dirty = false;
            diskII.setState(state);
            jest.resetAllMocks();

            diskII.ioSwitch(0x89);        // turn on the motor
            diskII.ioSwitch(0x8F, 0x80);  // write
            diskII.ioSwitch(0x8C);        // shift

            expect(callbacks.dirty).toHaveBeenCalledTimes(1);
            expect(callbacks.dirty).toHaveBeenCalledWith(1, true);

            state = diskII.getState();
            expect(state.drives[1].dirty).toBeTruthy();
        });
    });

    describe('reading WOZ-based disks', () => {
        const DOS33_SYSTEM_MASTER_IMAGE =
            fs.readFileSync('test/js/cards/data/DOS 3.3 System Master.woz').buffer;

        it('accepts WOZ-based disks', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            expect(true).toBeTruthy();
        });

        it('stops the head at the end of the image', () => {
            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);
            setTrack(diskII, 33);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x85);  // coil 2 on
            for (let i = 0; i < 5; i++) {
                diskII.ioSwitch(0x87);  // coil 3 on
                diskII.ioSwitch(0x84);  // coil 2 off
                diskII.ioSwitch(0x81);  // coil 0 on
                diskII.ioSwitch(0x86);  // coil 3 off
                diskII.ioSwitch(0x83);  // coil 1 on
                diskII.ioSwitch(0x80);  // coil 0 off
                diskII.ioSwitch(0x85);  // coil 2 on
                diskII.ioSwitch(0x82);  // coil 1 off
            }
            diskII.ioSwitch(0x84);  // coil 2 off

            const state = diskII.getState();
            expect(state.drives[1].phase).toBe(2);
            // For WOZ images, the number of tracks is the number in the image.
            // The DOS3.3 System Master was imaged on a 40 track drive, so it
            // has data for all 40 tracks, even though the last few are garbage.
            expect(state.drives[1].track).toBe(40 * STEPS_PER_TRACK - 1);
        });

        it('spins the disk when motor is on', () => {
            let cycles: number = 0;
            (mockApple2IO.cycles as jest.Mock).mockImplementation(() => cycles);

            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            let state = diskII.getState();
            expect(state.drives[1].head).toBe(0);

            diskII.ioSwitch(0x89);  // turn on the motor
            cycles += 10;
            diskII.tick();

            state = diskII.getState();
            expect(state.drives[1].head).toBeGreaterThan(0);
        });

        it('does not spin the disk when motor is off', () => {
            let cycles: number = 0;
            (mockApple2IO.cycles as jest.Mock).mockImplementation(() => cycles);

            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            let state = diskII.getState();
            expect(state.drives[1].head).toBe(0);

            cycles += 10;
            diskII.tick();

            state = diskII.getState();
            expect(state.drives[1].head).toBe(0);
        });

        it('reads an FF sync byte from the beginning of the image', () => {
            let cycles: number = 0;
            (mockApple2IO.cycles as jest.Mock).mockImplementation(() => cycles);

            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8e);  // read mode

            // The initial bytes in the image are: FF 3F CF F3
            // making the bit stream:
            //
            //     1111 1111 0011 1111 1100 1111 1111 0011
            //
            // That's three FF sync bytes in a row. Assuming
            // the sequencer is in state 2, each sync byte takes
            // 32 clock cycles to read, is held for 8 clock
            // cycles while the extra zeros are shifted in, then
            // is held 8 more clock cycles while the sequencer
            // reads the next two bits.
            cycles += 40;  // shift 10 bits
            const nibble = diskII.ioSwitch(0x8c);  // read data
            expect(nibble).toBe(0xFF);
        });

        it('reads several FF sync bytes', () => {
            let cycles: number = 0;
            (mockApple2IO.cycles as jest.Mock).mockImplementation(() => cycles);

            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x8e);  // read mode

            // The initial bytes in the image are: FF 3F CF F3
            // making the bit stream:
            //
            //     1111 1111 0011 1111 1100 1111 1111 0011
            //
            // That's three FF sync bytes in a row. Assuming
            // the sequencer is in state 2, each sync byte takes
            // 32 clock cycles to read, is held for 8 clock
            // cycles while the extra zeros are shifted in, then
            // is held 8 more clock cycles while the sequencer
            // reads the next two bits.  This means that 3 sync
            // bytes will be available for 3 * 40 + 8 cycles.
            for (let i = 0; i < 3 * 40 + 8; i++) {
                cycles++;
                const nibble = diskII.ioSwitch(0x8c);  // read data
                if (nibble & 0x80) {
                    // Nibbles are only valid when the high bit is set.
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(nibble).toBe(0xFF);
                }
            }
        });

        it('reads random garbage on uninitialized tracks', () => {
            let cycles: number = 0;
            (mockApple2IO.cycles as jest.Mock).mockImplementation(() => cycles);

            const diskII = new DiskII(mockApple2IO, callbacks);
            diskII.setBinary(1, 'DOS 3.3 System Master', 'woz', DOS33_SYSTEM_MASTER_IMAGE);

            // Step to track 0.5
            diskII.ioSwitch(0x89);  // turn on the motor
            diskII.ioSwitch(0x81);  // coil 0 on
            diskII.ioSwitch(0x83);  // coil 1 on
            diskII.ioSwitch(0x80);  // coil 0 off
            diskII.ioSwitch(0x82);  // coil 1 off
            diskII.ioSwitch(0x8e);  // read mode

            // Try this test 5 times because we could get unlucky.
            let failures = 0;
            for (let i = 0; i < 5; i++) {
                // Read 5 nibbles
                const nibbles: byte[] = [];
                let read = false;
                while (nibbles.length < 5) {
                    cycles++;
                    const nibble = diskII.ioSwitch(0x8c);  // read data
                    const qa = nibble & 0x80;
                    if (qa && !read) {
                        nibbles.push(nibble);
                        read = true;
                    }
                    if (!qa && read) {
                        read = false;
                    }
                }
                // Test that the first doesn't equal any of the others.
                // (Yes, this test could fail with some bad luck.)
                let equal = false;
                for (let i = 1; i < 5; i++) {
                    equal ||= nibbles[0] === nibbles[i];
                }
                if (equal) {
                    failures++;
                }
            }
            expect(failures).toBeLessThan(2);
        });

        it('disk spins at a consistent speed', () => {
            const reader = new TestDiskReader(1, 'DOS 3.3 System Master', DOS33_SYSTEM_MASTER_IMAGE, mockApple2IO, callbacks);

            reader.diskII.ioSwitch(0x89);  // turn on the motor
            reader.diskII.ioSwitch(0x8e);  // read mode

            // Find track 0, sector 0
            reader.findSector(0);
            // Save the start cycles
            let lastCycles = mockApple2IO.cycles();
            // Find track 0, sector 0 again
            reader.findSector(0);
            let currentCycles = reader.cycles;
            expect(currentCycles - lastCycles).toBe(201216);
            lastCycles = currentCycles;
            // Find track 0, sector 0 once again
            reader.findSector(0);
            currentCycles = reader.cycles;
            expect(currentCycles - lastCycles).toBe(201216);
        });
    });

    describe('writing WOZ-based disks', () => {
        const DOS33_SYSTEM_MASTER_IMAGE =
            fs.readFileSync('test/js/cards/data/DOS 3.3 System Master.woz').buffer;

        it('can write something', () => {
            const reader = new TestDiskReader(1, 'DOS 3.3 System Master', DOS33_SYSTEM_MASTER_IMAGE, mockApple2IO, callbacks);
            const diskII = reader.diskII;
            const before = reader.rawTracks();

            diskII.ioSwitch(0x89);  // turn on the motor

            // emulate STA $C08F,X (5 CPU cycles)
            reader.cycles += 4;           // op + load address + work
            diskII.tick();
            reader.cycles += 1;
            diskII.ioSwitch(0x8F, 0x80);  // write
            // read $C08C,X
            reader.cycles += 4;           // op + load address + work
            diskII.tick();
            reader.cycles += 1;
            diskII.ioSwitch(0x8C);        // shift

            reader.cycles += 29;          // wait
            diskII.tick();                // nop (make sure the change is applied)

            const after = reader.rawTracks();
            expect(before).not.toEqual(after);
        });
    });
});

class TestDiskReader {
    cycles: number = 0;
    nibbles = 0;
    diskII: DiskII;

    constructor(driveNo: DriveNumber, label: string, image: ArrayBufferLike, apple2IO: Apple2IO, callbacks: Callbacks) {
        (apple2IO.cycles as jest.Mock).mockImplementation(() => this.cycles);

        this.diskII = new DiskII(apple2IO, callbacks);
        this.diskII.setBinary(driveNo, label, 'woz', image);
    }

    readNibble(): byte {
        let result: number = 0;
        for (let i = 0; i < 100; i++) {
            this.cycles++;
            const nibble = this.diskII.ioSwitch(0x8c);  // read data
            if (nibble & 0x80) {
                result = nibble;
            } else if (result & 0x80) {
                this.nibbles++;
                return result;
            }
        }
        throw new Error('Did not find a nibble in 100 clock cycles');
    }

    findAddressField() {
        let s = '';
        for (let i = 0; i < 600; i++) {
            let nibble = this.readNibble();
            if (nibble !== 0xD5) {
                s += ` ${toHex(nibble)}`;
                continue;
            }
            nibble = this.readNibble();
            if (nibble !== 0xAA) {
                continue;
            }
            nibble = this.readNibble();
            if (nibble !== 0x96) {
                continue;
            }
            return;
        }
        throw new Error(`Did not find an address field in 500 nibbles: ${s}`);
    }

    nextSector() {
        this.findAddressField();
        const volume = (this.readNibble() << 1 | 1) & this.readNibble();
        const track = (this.readNibble() << 1 | 1) & this.readNibble();
        const sector = (this.readNibble() << 1 | 1) & this.readNibble();
        // console.log(`vol: ${volume} trk: ${track} sec: ${thisSector} ${this.diskII.head()} ${this.nibbles}`);
        return { volume, track, sector };
    }

    findSector(sector: byte) {
        for (let i = 0; i < 32; i++) {
            const { sector: thisSector } = this.nextSector();
            if (sector === thisSector) {
                return;
            }
        }
        throw new Error(`Did not find sector ${sector} in 32 sectors`);
    }

    rawTracks() {
        // NOTE(flan): Hack to access private properties.
        const disk = (this.diskII as unknown as { disks: WozDisk[] }).disks[1];
        const result: Uint8Array[] = [];
        for (let i = 0; i < disk.rawTracks.length; i++) {
            result[i] = disk.rawTracks[i].slice(0);
        }

        return result;
    }
}
