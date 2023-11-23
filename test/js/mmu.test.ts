import Apple2IO from 'js/apple2io';
import MMU from '../../js/mmu';
import { CPU6502 } from '@whscullin/cpu6502';
import { HiresPage, LoresPage, VideoModes, VideoPage } from 'js/videomodes';
import Apple2eROM from '../../js/roms/system/apple2e';
import { MemoryPages } from 'js/types';

function newFakeMemoryPages() {
    return {} as unknown as MemoryPages;
}

function newFakeVideoPage(): VideoPage {
    const bank0Pages = newFakeMemoryPages();
    const bank1Pages = newFakeMemoryPages();
    return {
        bank0() {
            return bank0Pages;
        },
        bank1() {
            return bank1Pages;
        },
    } as unknown as VideoPage;
}

function newFakeLoresPage(): LoresPage {
    return newFakeVideoPage() as unknown as LoresPage;
}

function newFakeHiresPage(): HiresPage {
    return newFakeVideoPage() as unknown as HiresPage;
}

describe('MMU', () => {
    const fakeVideoModes = {} as unknown as VideoModes;
    const fakeCPU = {} as unknown as CPU6502;
    const fakeLoResPage1 = newFakeLoresPage();
    const fakeLoResPage2 = newFakeLoresPage();
    const fakeHiResPage1 = newFakeHiresPage();
    const fakeHiResPage2 = newFakeHiresPage();
    const fakeApple2IO = {} as unknown as Apple2IO;

    it('is constructable', () => {
        const mmu = new MMU(fakeCPU, fakeVideoModes, fakeLoResPage1, fakeLoResPage2,
            fakeHiResPage1, fakeHiResPage2, fakeApple2IO, new Apple2eROM());
        expect(mmu).not.toBeNull();
    });

    it('requires prewrite to write to bank1', () => {
        const mmu = new MMU(fakeCPU, fakeVideoModes, fakeLoResPage1, fakeLoResPage2,
            fakeHiResPage1, fakeHiResPage2, fakeApple2IO, new Apple2eROM());

        // From https://github.com/whscullin/apple2js/issues/187
        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        mmu._access(0x89, 0x00); // WRTCOUNT = 0, READ DISABLE (write still enabled)
        mmu._access(0x89);       // WRTCOUNT = WRITCOUNT + 1, READ DISABLE (write still enabled)
        mmu.write(0xd0, 0x00, 0xa1);
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write still enabled)
        expect(mmu.read(0xd0, 0x00)).toBe(0xa1);
    });

    it('prewrite is reset on write access before write', () => {
        const mmu = new MMU(fakeCPU, fakeVideoModes, fakeLoResPage1, fakeLoResPage2,
            fakeHiResPage1, fakeHiResPage2, fakeApple2IO, new Apple2eROM());

        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        mmu._access(0x89, 0x00); // WRTCOUNT = 0, READ DISABLE
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write not enabled yet)
        mmu._access(0x8b, 0x00); // WRTCOUNT = 0, READ ENABLE (write still not enabled)
        const oldValue = mmu.read(0xd0, 0x00);
        mmu.write(0xd0, 0x00, 0xa1); // writes to the void
        expect(mmu.read(0xd0, 0x00)).toBe(oldValue); // reads old value
    });


    it('write stays active with overzealous switching', () => {
        const mmu = new MMU(fakeCPU, fakeVideoModes, fakeLoResPage1, fakeLoResPage2,
            fakeHiResPage1, fakeHiResPage2, fakeApple2IO, new Apple2eROM());

        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        mmu.write(0xd0, 0x00, 0xa1);
        mmu._access(0x8b);       // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write still enabled)
        expect(mmu.read(0xd0, 0x00)).toBe(0xa1);
    });
});
