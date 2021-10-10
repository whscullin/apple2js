/**
 * Tom Harte test data based test suite
 *
 * Uses test files from https://github.com/TomHarte/ProcessorTests
 * To use, set TOM_HARTE_TEST_PATH to local copy of that repository
 */

import fs from 'fs';

import CPU6502 from 'js/cpu6502';
import { toHex } from 'js/util';
import type { byte, word } from 'js/types';

import { toReadableState } from './util/cpu';
import { TestMemory } from './util/memory';

// JEST_DETAIL=true converts decimal values to hex before testing
// expectations, for better readability at the expense of speed.
const detail = !!process.env.JEST_DETAIL;

/**
 * Types for JSON tests
 */

/**
 * Memory address and value
 */
type MemoryValue = [address: word, value: byte]

/**
 * Represents initial and final CPU and memory states
 */
 interface TestState {
    /** Program counter */
    pc: word
    /** Stack register */
    s: byte
    /** Accumulator */
    a: byte
    /** X index */
    x: byte
    /** Y index */
    y: byte
    /** Processor status register */
    p: byte
    /** M */
    ram: MemoryValue[]
}

/**
 * CPU cycle memory operation
 */
type Cycle = [address: word, value: byte, type: 'read'|'write']

/**
 * One test record
 */
interface Test {
    /** Test name */
    name: string
    /** Initial CPU register and memory state */
    initial: TestState
    /**  Final CPU register and memory state */
    final: TestState
    /** Detailed CPU cycles */
    cycles: Cycle[]
}

/**
 * Initialize cpu and memory before test
 *
 * @param cpu Target cpu instance
 * @param state Initial test state
 */
function initState(cpu: CPU6502, state: TestState) {
    const { pc, s, a, x, y, p, ram } = state;
    cpu.setState({ cycles: 0, pc, sp: s, a, x, y, s: p });

    for (let idx = 0; idx < ram.length; idx++) {
        const [address, mem] = ram[idx];
        cpu.write(address, mem);
    }
}

/**
 * Pretty print 'address: val' if detail is turned on,
 * or passes through raw test data if not.
 *
 * @returns string or raw test data
 */
function toAddrValHex([address, val]: MemoryValue) {
    if (detail) {
        return `${toHex(address, 4)}: ${toHex(val)}`;
    } else {
        return [address, val];
    }
}

/**
 * Pretty print 'address: val (read|write)' if detail is turned on,
 * or passes through raw test data if not.
 *
 * @returns string or raw test data
 */
function toAddrValHexType([address, val, type]: Cycle) {
    if (detail) {
        return `${toHex(address, 4)}: ${toHex(val)} ${type}`;
    } else {
        return [address, val, type];
    }
}

/**
 * Compare end state and read write behavior of test run
 *
 * @param cpu Test CPU
 * @param memory Test memory
 * @param test Test data to compare against
 */
function expectState(cpu: CPU6502, memory: TestMemory, test: Test) {
    const { pc, s, a, x, y, p, ram } = test.final;
    expect(
        toReadableState(cpu.getState())
    ).toEqual(
        toReadableState({cycles: test.cycles.length, pc, sp: s, a, x, y, s: p })
    );

    // Retrieve relevant memory locations and values
    const result = [];
    for (let idx = 0; idx < ram.length; idx++) {
        const [address] = ram[idx];
        result.push([address, cpu.read(address)]);
    }
    expect(
        result.map(toAddrValHex)
    ).toEqual(
        ram.map(toAddrValHex)
    );

    expect(
        memory.getLog().map(toAddrValHexType)
    ).toEqual(
        test.cycles.map(toAddrValHexType)
    );
}

interface OpTest {
    op: string
    name: string
    mode: string
}

const testPath = process.env.TOM_HARTE_TEST_PATH;

// There are 10,0000 tests per test file, which would take several hours
// in jest. 16 is a manageable quantity that still gets good coverage.
const maxTests = 16;

if (testPath) {
    const testPath6502 = `${testPath}/6502/v1/`;
    const testPath65C02 = `${testPath}/wdc65c02/v1/`;

    const opAry6502: OpTest[] = [];
    const opAry65C02: OpTest[] = [];

    const buildOpArrays = () => {
        const cpu = new CPU6502();

        // Grab the implemented op codes
        // TODO: Decide which undocumented opcodes are worthwhile.
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
    };

    buildOpArrays();

    describe('Tom Harte', function() {
        let cpu: CPU6502;
        let memory: TestMemory;

        describe('6502', function() {
            beforeAll(function() {
                cpu = new CPU6502();
                memory = new TestMemory(256);
                cpu.addPageHandler(memory);
            });

            describe.each(opAry6502)('Test op $op $name $mode', ({op}) => {
                const data = fs.readFileSync(`${testPath6502}${op}.json`, 'utf-8');
                const tests = JSON.parse(data) as Test[];

                it.each(tests.slice(0, maxTests))('Test $name', (test) => {
                    initState(cpu, test.initial);
                    memory.logStart();
                    cpu.step();
                    memory.logStop();
                    expectState(cpu, memory, test);
                });
            });
        });

        describe('WDC 65C02', function() {
            beforeAll(function() {
                cpu = new CPU6502({ '65C02': true });
                memory = new TestMemory(256);
                cpu.addPageHandler(memory);
            });

            describe.each(opAry65C02)('Test op $op $name $mode', ({op}) => {
                const data = fs.readFileSync(`${testPath65C02}${op}.json`, 'utf-8');
                const tests = JSON.parse(data) as Test[];

                it.each(tests.slice(0, maxTests))('Test $name', (test) => {
                    initState(cpu, test.initial);
                    memory.logStart();
                    cpu.step();
                    memory.logStop();
                    expectState(cpu, memory, test);
                });
            });
        });
    });
} else {
    test('Skipping Tom Harte tests', () => { expect(testPath).toBeFalsy(); });
}
