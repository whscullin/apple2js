import CPU6502 from '../../js/cpu6502';
import Debugger, { DebuggerContainer } from '../../js/debugger';
import { MemoryPages } from '../../js/types';
import { TestMemory } from '../util/memory';
import { bios } from '../util/bios';

describe('Debugger', () => {
    let cpu: CPU6502;
    let debuggerContainer: DebuggerContainer;
    let theDebugger: Debugger;
    let memory: MemoryPages;

    beforeEach(() => {
        cpu = new CPU6502();
        memory = new TestMemory(4);

        cpu.addPageHandler(memory);
        cpu.addPageHandler(bios);

        debuggerContainer = {
            getCPU: () => cpu,
            run: jest.fn(),
            stop: jest.fn(),
        };
        theDebugger = new Debugger(debuggerContainer);
    });

    describe('#utility', () => {
        it('should list without symbols', () => {
            const listing = theDebugger.list(0xff00);
            expect(listing[0]).toEqual(
                'FF00-           00 00       BRK #$00'
            );
        });

        it('should list with symbols', () => {
            theDebugger.addSymbols({0x00: 'ZERO', 0xFF00: 'ENTRY'});

            const listing = theDebugger.list(0xff00);
            expect(listing[0]).toEqual(
                'FF00- ENTRY     00 00       BRK #ZERO'
            );
        });

        it('should dump page', () => {
            const page = theDebugger.dumpPage(0xff);
            expect(page).toContain(
                'FF80: 48 45 4C 4C 4F 0D 00 00 00 00 00 00 00 00 00 00         HELLO...........'
            );
        });

        it('should dump registers', () => {
            const regs = theDebugger.dumpRegisters();
            expect(regs).toEqual(
                'A=00 X=00 Y=00 P=20 S=FF --------'
            );
        });
    });
});
