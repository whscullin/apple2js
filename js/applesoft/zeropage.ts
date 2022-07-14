/*
 * Zero page locations used by Applesoft. The names come from
 * the commented decompilation produced by the Merlin Pro
 * assembler, revision 4/27/84. There is evidence from
 * https://www.pagetable.com/?p=774 that the original Microsoft
 * BASIC source code used these names as well.
 */

/** Start of program (word) */
export const TXTTAB = 0x67;
/** Start of variables (word) */
export const VARTAB = 0x69;
/** Start of arrays (word) */
export const ARYTAB = 0x6B;
/** End of strings (word). (Strings are allocated down from HIMEM.) */
export const STREND = 0x6D;
/** Current line */
export const CURLINE = 0x75;
/** Floating Point accumulator (float) */
export const FAC = 0x9D;
/** Floating Point arguments (float) */
export const ARG = 0xA5;
/**
 * End of program (word). This is actually 1 or 2 bytes past the three
 * zero bytes that end the program.
 */
export const PRGEND = 0xAF;
