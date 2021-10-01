import { createDiskFromJsonDisk } from 'js/formats/create_disk';
import { testDisk } from './testdata/json';

describe('createDiskFromJsonDisk', () => {
    it('parses a JSON disk', () => {
        const disk = createDiskFromJsonDisk(testDisk);
        expect(disk).toEqual({
            encoding: 'nibble',
            format: 'dsk',
            name: 'Test Disk',
            readOnly: undefined,
            side: 'Front',
            volume: 254,
            tracks: expect.any(Array)
        });
    });
});
