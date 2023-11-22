import { CPU6502 } from '@whscullin/cpu6502';
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
            run: jest.fn(),
            stop: jest.fn(),
            isRunning: jest.fn(),
        };
        theDebugger = new Debugger(cpu, debuggerContainer);
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
                'A=00 X=00 Y=00 P=20 S=FF --X-----'
            );
        });

        it('should dump the stack,', () => {
            const stack = theDebugger.getStack();
            const lines = stack.split('\n');
            expect(lines).toHaveLength(256);
            expect(lines[0]).toMatch('* $01FF 00');
            expect(lines[1]).toMatch('  $01FE 00');
            expect(lines[254]).toMatch('  $0101 00');
            expect(lines[255]).toMatch('  $0100 00');
        });

        it('should dump the stack with size', () => {
            const stack = theDebugger.getStack(32);
            const lines = stack.split('\n');
            expect(lines).toHaveLength(32);
            expect(lines[0]).toMatch('* $01FF 00');
            expect(lines[1]).toMatch('  $01FE 00');
            expect(lines[30]).toMatch('  $01E1 00');
            expect(lines[31]).toMatch('  $01E0 00');
        });

        it('should dump the stack within size', () => {
            const registers = cpu.getState();
            registers.sp = 0xE3;
            cpu.setState(registers);
            const stack = theDebugger.getStack(32);
            const lines = stack.split('\n');
            expect(lines).toHaveLength(32);
            expect(lines[0]).toMatch('  $01FF 00');
            expect(lines[1]).toMatch('  $01FE 00');
            expect(lines[28]).toMatch('* $01E3 00');
            expect(lines[29]).toMatch('  $01E2 00');
            expect(lines[30]).toMatch('  $01E1 00');
            expect(lines[31]).toMatch('  $01E0 00');
        });

        it('should dump the stack with size and move the window', () => {
            const registers = cpu.getState();
            registers.sp = 0xC3;
            cpu.setState(registers);
            const stack = theDebugger.getStack(32);
            const lines = stack.split('\n');
            expect(lines).toHaveLength(32);
            expect(lines[0]).toMatch('  $01DF 00');
            expect(lines[1]).toMatch('  $01DE 00');
            expect(lines[28]).toMatch('* $01C3 00');
            expect(lines[29]).toMatch('  $01C2 00');
            expect(lines[30]).toMatch('  $01C1 00');
            expect(lines[31]).toMatch('  $01C0 00');
        });
    });
});
