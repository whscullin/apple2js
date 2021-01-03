import { compareSequences } from './util';

describe('compareSequences', () => {
    it('matches at pos 0', () => {
        expect(
            compareSequences([0x01, 0x02, 0x03], [0x01, 0x02, 0x03], 0)
        ).toBeTruthy();
    });

    it('matches at pos 1', () => {
        expect(
            compareSequences([0x00, 0x01, 0x02, 0x03], [0x01, 0x02, 0x03], 1)
        ).toBeTruthy();
    });
});
