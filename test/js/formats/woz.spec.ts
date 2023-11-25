import { ENCODING_BITSTREAM } from 'js/formats/types';
import createDiskFromWoz from 'js/formats/woz';
import { mockWoz1, mockWoz2, mockTMAP } from './testdata/woz';

describe('woz', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
    });

    it('can parse Woz version 1', () => {
        const options = {
            name: 'Unknown',
            volume: 254,
            readOnly: true,
            rawData: mockWoz1,
        };

        const disk = createDiskFromWoz(options);
        expect(disk).toEqual({
            metadata: { name: 'Mock Woz 1', side: undefined },
            readOnly: true,
            encoding: ENCODING_BITSTREAM,
            format: 'woz',
            trackMap: mockTMAP,
            // prettier-ignore
            rawTracks: [new Uint8Array([
                1, 1, 0, 1, 0, 1, 0, 1,
                1, 0, 1, 0, 1, 0, 1, 0,
                1, 0, 0, 1, 0, 1, 1, 0,
            ])],
            info: {
                bitTiming: 0,
                bootSector: 0,
                cleaned: 0,
                compatibleHardware: 0,
                creator: 'Apple2JS                        ',
                diskType: 1,
                largestTrack: 0,
                requiredRAM: 0,
                sides: 0,
                synchronized: 1,
                version: 1,
                writeProtected: 0,
            },
        });
    });

    it('can parse Woz version 2', () => {
        const options = {
            name: 'Unknown',
            volume: 254,
            readOnly: true,
            rawData: mockWoz2,
        };

        const disk = createDiskFromWoz(options);
        expect(disk).toEqual({
            metadata: {
                name: 'Mock Woz 2',
                side: 'B',
            },
            readOnly: true,
            encoding: ENCODING_BITSTREAM,
            format: 'woz',
            trackMap: mockTMAP,
            // prettier-ignore
            rawTracks: [new Uint8Array([
                1, 1, 0, 1, 0, 1, 0, 1,
                1, 0, 1, 0, 1, 0, 1, 0,
                1, 0, 0, 1, 0, 1, 1, 0,
            ])],
            info: {
                bitTiming: 0,
                bootSector: 0,
                cleaned: 0,
                compatibleHardware: 0,
                creator: 'Apple2JS                        ',
                diskType: 1,
                largestTrack: 0,
                requiredRAM: 0,
                sides: 1,
                synchronized: 1,
                version: 2,
                writeProtected: 0,
            },
        });
    });
});
