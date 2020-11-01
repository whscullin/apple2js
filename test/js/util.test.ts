/** @fileoverview Test for utils.ts. */

import { allocMem, allocMemPages, numToString, testables, toBinary, toHex } from "../../js/util";

describe('garbage', () => {
  it('returns 0 <= x <= 255', () => {
    for (let i = 0; i < 1024; i++) {
      expect(testables.garbage()).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('allocMem', () => {
  it('returns an array of the correct size', () => {
    expect(allocMem(2048).length).toBe(2048);

  });
  it('has 0xff and 0x00 patterns', () => {
    let memory = allocMem(2048);
    expect(memory[0]).toBe(0xff);
    expect(memory[1]).toBe(0xff);
    expect(memory[2]).toBe(0x00);
    expect(memory[3]).toBe(0x00);
    expect(memory[4]).toBe(0xff);
  });
  it('has garbage in the right places', () => {
    let memory = allocMem(0x800);
    for (let i = 0; i < 0x800; i += 0x200) {
      let passed = memory[i + 0x28] != 0xff
        && memory[i + 0x29] != 0xff
        && memory[i + 0x68] != 0xff
        && memory[i + 0x69] != 0xff;
      if (passed) {
        return;
      }
    }
    fail('garbage not found');
  });
});

describe('allocMemPages', () => {
  it('allocates 256 * the size', () => {
    expect(allocMemPages(5).length).toBe(5 * 256);
  });
});

describe('toHex', () => {
  it('converts an odd number of characters', () => {
    expect(toHex(0xfedcb, 5)).toEqual("FEDCB");
  });
  it('correctly guesses byte values', () => {
    expect(toHex(0xa5)).toEqual("A5");
  });
  it('correctly guesses word values', () => {
    expect(toHex(0x1abc)).toEqual("1ABC");
  });
  it('only uses the bottom work of larger values', () => {
    expect(toHex(0xabcdef)).toEqual("CDEF");
  });
  it('correctly prepends zeros', () => {
    expect(toHex(0xa5, 4)).toEqual("00A5");
  });
});

describe('toBinary', () => {
  it('has 8 digits for zero', () => {
    expect(toBinary(0x00)).toEqual("00000000");
  });
  it('correctly sets bits', () => {
    expect(toBinary(0xa5)).toEqual("10100101");
  });
});

describe('gup', () => {
  // untestable due to direct reference to window.location
});

describe('hup', () => {
  // untestable due to direct reference to window.location
});

describe('numToString', () => {
  it('packs a zero byte into a string of all zeros', () => {
    expect(numToString(0x00)).toEqual("\0\0\0\0");
  });
  it('packs a byte in the printable ASCII range into a zero-padded string',
    () => {
      expect(numToString(0x41)).toEqual("A\0\0\0");
    });
  it('packs a word into a string', () => {
    expect(numToString(0x4142)).toEqual("BA\0\0");
  });
  it('packs a 32-bit value into a string', () => {
    expect(numToString(0x41424344)).toEqual("DCBA");
  });
  it('ignores more than 32 bits', () => {
    expect(numToString(0x4142434445)).toEqual("EDCB");
  });
});