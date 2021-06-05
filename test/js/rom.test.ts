import type ROM from '../../js/roms/rom';
import OriginalROM from '../../js/roms/system/original';
import IntegerROM from '../../js/roms/system/intbasic';
import FPBasicROM from '../../js/roms/system/fpbasic';
import Apple2eROM from '../../js/roms/system/apple2e';
import Apple2enhROM from '../../js/roms/system/apple2enh';
import Apple2jROM from '../../js/roms/system/apple2j';

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
