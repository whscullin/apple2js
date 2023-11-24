import LanguageCard from '../../../js/cards/langcard';
import Apple2ROM from '../../../js/roms/system/fpbasic';

describe('Language Card', () => {
    it('is constructable', () => {
        const langCard = new LanguageCard(new Apple2ROM());
        expect(langCard).not.toBeNull();
    });

    it('requires prewrite to write to bank1', () => {
        const langCard = new LanguageCard(new Apple2ROM());

        // From https://github.com/whscullin/apple2js/issues/187
        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        langCard.ioSwitch(0x89, 0x00); // WRTCOUNT = 0, READ DISABLE (write still enabled)
        langCard.ioSwitch(0x89); // WRTCOUNT = WRITCOUNT + 1, READ DISABLE (write still enabled)
        langCard.write(0xd0, 0x00, 0xa1);
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write still enabled)
        expect(langCard.read(0xd0, 0x00)).toBe(0xa1);
    });

    it('prewrite is reset on write access before write', () => {
        const langCard = new LanguageCard(new Apple2ROM());

        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        langCard.ioSwitch(0x89, 0x00); // WRTCOUNT = 0, READ DISABLE
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write not enabled yet)
        langCard.ioSwitch(0x8b, 0x00); // WRTCOUNT = 0, READ ENABLE (write still not enabled)
        const oldValue = langCard.read(0xd0, 0x00);
        langCard.write(0xd0, 0x00, 0xa1); // writes to the void
        expect(langCard.read(0xd0, 0x00)).toBe(oldValue); // reads old value
    });

    it('write stays active with overzealous switching', () => {
        const langCard = new LanguageCard(new Apple2ROM());

        // Action descriptions from Sather, Table 5.5, p. 5-24, UtAIIe:
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write enabled)
        langCard.write(0xd0, 0x00, 0xa1);
        langCard.ioSwitch(0x8b); // WRTCOUNT = WRTCOUNT + 1, READ ENABLE (write still enabled)
        expect(langCard.read(0xd0, 0x00)).toBe(0xa1);
    });
});
