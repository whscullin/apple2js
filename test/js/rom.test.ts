import type ROM from '../../js/roms/rom';
import OriginalROM from '../../js/roms/original';
import IntegerROM from '../../js/roms/intbasic';
import FPBasicROM from '../../js/roms/fpbasic';
import Apple2eROM from '../../js/roms/apple2e';
import Apple2enhROM from '../../js/roms/apple2enh';
import Apple2jROM from '../../js/roms/apple2j';

const roms: { [name: string]: { new(): ROM } } = {
    'original': OriginalROM,
    'integer': IntegerROM,
    'fpbasic': FPBasicROM,
    'apple2e': Apple2eROM,
    'apple2enh': Apple2enhROM,
    'apple2j': Apple2jROM,
};

for (const rom of Object.keys(roms)) {
    describe(`${rom}`, () => {
        it('is constructable', () => {
            new roms[rom]();
        });
    });
}
