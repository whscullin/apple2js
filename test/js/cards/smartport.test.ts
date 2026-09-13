import SmartPort, { SmartPortState } from 'js/cards/smartport';
import { CPU6502 } from '@whscullin/cpu6502';
import { MemoryBlockDisk, DRIVE_NUMBERS, DriveNumber } from 'js/formats/types';
import { base64_json_parse, base64_json_stringify } from 'js/base64';
import { Card } from 'js/types';

function newCard() {
    return new SmartPort({} as CPU6502, null, { block: true });
}
function disk(drive: number) {
    return new MemoryBlockDisk('hdv', { name: 'drive-' + drive }, drive === 2, [
        new Uint8Array(512).fill(drive),
        new Uint8Array(512).fill(drive + 10),
        new Uint8Array(512),
    ]);
}

describe('SmartPort snapshots', () => {
    it.each([
        { drives: [] as DriveNumber[] },
        { drives: [1] as DriveNumber[] },
        { drives: [2] as DriveNumber[] },
        { drives: [1, 2] as DriveNumber[] },
    ])(
        'round-trips populated drives $drives into fresh and populated targets',
        async ({ drives }) => {
            const source = newCard();
            for (const drive of drives) {
                await source.setBlockDisk(drive, disk(drive));
            }
            const state = base64_json_parse(
                base64_json_stringify(await source.getState())
            ) as SmartPortState;
            expect(state.disks).toHaveLength(3);
            expect(state.disks[0]).toBeNull();
            for (const populated of [false, true]) {
                const target = newCard();
                if (populated) {
                    for (const drive of DRIVE_NUMBERS) {
                        await target.setBlockDisk(drive, disk(9));
                    }
                }
                await target.setState(state);
                for (const drive of drives) {
                    const restored = await target.getBlockDisk(drive);
                    expect(restored.metadata.name).toBe('drive-' + drive);
                    expect(restored.readOnly).toBe(drive === 2);
                    expect(restored.format).toBe('hdv');
                    expect(await restored.blockCount()).toBe(3);
                    for (let block = 0; block < 3; block++) {
                        expect(await restored.read(block)).toEqual(
                            await disk(drive).read(block)
                        );
                    }
                }
                for (const drive of DRIVE_NUMBERS.filter(
                    (drive) => !drives.includes(drive)
                )) {
                    expect(await target.getBlockDisk(drive)).toBeUndefined();
                }
            }
        }
    );

    it('preserves command status and both result registers', async () => {
        const source = newCard();
        await source.setState({
            disks: [null, null, null],
            statusByte: 0x27,
            xReg: 0x34,
            yReg: 0x12,
        });
        const state = base64_json_parse(
            base64_json_stringify(await source.getState())
        ) as SmartPortState;
        const target = newCard();
        await target.setState(state);
        const card: Card = target;
        expect(card.ioSwitch(0x81)).toBe(0x27);
        expect(card.ioSwitch(0x82)).toBe(0x34);
        expect(card.ioSwitch(0x83)).toBe(0x12);
    });

    it('uses initialization defaults for older snapshots, including the old two-entry layout', async () => {
        const target = newCard();
        await target.setState({
            disks: [null, null, null],
            statusByte: 0x27,
            xReg: 4,
            yReg: 5,
        });
        await target.setState({ disks: [null, null] });
        const card: Card = target;
        expect(card.ioSwitch(0x81)).toBe(0x80);
        expect(card.ioSwitch(0x82)).toBe(0);
        expect(card.ioSwitch(0x83)).toBe(0);
    });
});
