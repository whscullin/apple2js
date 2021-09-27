/**
 * Uses test files from https://github.com/TomHarte/ProcessorTests
 * To use set TOM_HARTE_TEST_PATH to local copy of that repository
 */

import fs from 'fs';

import CPU6502 from 'js/cpu6502';
import { toHex } from 'js/util';
import type { byte, word } from 'js/types';

import { toReadableState } from './util/cpu';
import Debugger from 'js/debugger';
import { TestMemory } from './util/memory';

// JEST_DETAIL=true converts decimal values to hex before testing
// expectations, for better readability at the expense of speed.
const detail = !!process.env.JEST_DETAIL;

/**
 * Types for JSON tests
 */
interface TestState {
    pc: word
    s: byte
    a: byte
    x: byte
    y: byte
    p: byte
    ram: [word, byte][]
}

interface Test {
    name: string
    initial: TestState
    final: TestState
    cycles: [word, byte, string][]
}

let memory: TestMemory;
let debug: Debugger | null;
let cpu: CPU6502;

/**
 * Initialize cpu and memory before test
 *
 * @param state Initial test state
 */

function initState(state: TestState) {
    const { pc, s, a, x, y, p, ram } = state;
    cpu.setState({ cycles: 0, pc, sp: s, a, x, y, s: p });

    for (let idx = 0; idx < ram.length; idx++) {
        const [address, mem] = ram[idx];
        const off = address & 0xff;
        const page = address >> 8;
        cpu.write(page, off, mem);
    }
}

/**
 * Pretty print 'address: val' if detail is turned on
 *
 * @returns
 */

function toAddrValHex([address, val]: [word, byte]) {
    if (detail) {
        return `${toHex(address, 4)}: ${toHex(val)}`;
    } else {
        return [address, val];
    }
}

/**
 * Pretty print 'address: val (read|write)' if detail is turned on
 *
 * @returns
 */

function toAddrValHexType([address, val, type]: [word, byte, string]) {
    if (detail) {
        return `${toHex(address, 4)}: ${toHex(val)} ${type}`;
    } else {
        return [address, val, type];
    }
}

/**
 * Compare end state and read write behavior of test run
 *
 * @param state Expected state
 * @param cycles Detailed read and write logging by cycle
 */
function expectState(state: TestState, cycles: [word, byte, string][]) {
    const { pc, s, a, x, y, p, ram } = state;
    expect(toReadableState(cpu.getState())).toEqual(
        toReadableState({cycles: cycles.length, pc, sp: s, a, x, y, s: p }));

    const result = [];
    for (let idx = 0; idx < ram.length; idx++) {
        const [address] = ram[idx];
        const off = address & 0xff;
        const page = address >> 8;
        result.push([address, cpu.read(page, off), '']);
    }
    expect(result.map(toAddrValHex)).toEqual(ram.map(toAddrValHex));
    expect(memory.getLog().map(toAddrValHexType)).toEqual(cycles.map(toAddrValHexType));
}

interface OpTest {
    op: string
    name: string
    mode: string
}

const opAry6502: OpTest[] = [];
const opAry65C02: OpTest[] = [];

cpu = new CPU6502();

// Grab the implemented op codes
// TODO: Decide whether which undocumented opcodes are worthwhile.
for (const op in cpu.OPS_6502) {
    const { name, mode } = cpu.OPS_6502[op];
    const test = { op: toHex(+op), name, mode };
    opAry6502.push(test);
    opAry65C02.push(test);
}

for (const op in cpu.OPS_65C02) {
    const { name, mode } = cpu.OPS_65C02[op];
    const test = { op: toHex(+op), name, mode };
    opAry65C02.push(test);
}
const testPath = process.env.TOM_HARTE_TEST_PATH;

const testPath6502 = `${testPath}/6502/v1/`;
const testPath65C02 = `${testPath}/wdc65c02/v1/`;

// There are 10,0000 tests per test file, which would take several hours
// in jest. 16 is a manageable quantity that still gets good coverage.
const maxTests = 16;

if (testPath) {
    describe('Tom Harte', function() {
        describe('6502', function() {
            beforeAll(function() {
                cpu = new CPU6502();
                memory = new TestMemory(256);
                cpu.addPageHandler(memory);
            });

            describe.each(opAry6502)('Test op $op $name $mode', ({op}) => {
                const data = fs.readFileSync(`${testPath6502}${op}.json`, 'utf-8');
                const tests = JSON.parse(data) as Test[];

                it.each(tests.slice(0, maxTests))('Test $name', ({ initial, final, cycles }) => {
                    initState(initial);
                    memory.logStart();
                    cpu.step();
                    memory.logStop();
                    expectState(final, cycles);
                });
            });
        });

        describe('WDC 65C02', function() {
            beforeAll(function() {
                cpu = new CPU6502({ '65C02': true });
                debug = new Debugger({
                    getCPU: () => (cpu),
                    run: () => {},
                    stop: () => {},
                });

                // To get really verbose test logging comment out this line.
                debug = null;

                memory = new TestMemory(256);
                cpu.addPageHandler(memory);
            });

            describe.each(opAry65C02)('Test op $op $name $mode', ({op}) => {
                const data = fs.readFileSync(`${testPath65C02}${op}.json`, 'utf-8');
                const tests = JSON.parse(data) as Test[];

                it.each(tests.slice(0, maxTests))('Test $name', ({ initial, final, cycles }) => {
                    initState(initial);
                    if (debug) {
                        console.info(initial, debug.dumpRegisters(), debug.dumpPC(initial.pc));
                    }
                    memory.logStart();
                    cpu.step();
                    memory.logStop();
                    expectState(final, cycles);
                });
            });
        });
    });
} else {
    test('Skipping Tom Harte tests', () => { expect(testPath).toBeFalsy(); });
}
