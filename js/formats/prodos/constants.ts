import { byte } from 'js/types';

export const BLOCK_SIZE = 512;

export const STORAGE_TYPES = {
    DELETED: 0x0,
    SEEDLING: 0x1,
    SAPLING: 0x2,
    TREE: 0x3,
    PASCAL: 0x4,
    EXTENDED: 0x5,
    DIRECTORY: 0xd,
    SUBDIRECTORY_HEADER: 0xe,
    VDH_HEADER: 0xf,
} as const;

export const ACCESS_TYPES = {
    DELETE: 0x80,
    RENAME: 0x40,
    BACKUP: 0x20,
    WRITE: 0x02,
    READ: 0x01,
    ALL: 0xe3,
} as const;

export const FILE_TYPES: Record<byte, string> = {
    0x00: 'UNK', // Typeless file (SOS and ProDOS)
    0x01: 'BAD', // Bad block file
    0x02: 'PDC', // Pascal code file
    0x03: 'PTX', // Pascal text file
    0x04: 'TXT', // ASCII text file (SOS and ProDOS)
    0x05: 'PDA', // Pascal data file
    0x06: 'BIN', // General binary file (SOS and ProDOS)
    0x07: 'FNT', // Font file
    0x08: 'FOT', // Graphics screen file
    0x09: 'BA3', // Business BASIC program file
    0x0a: 'DA3', // Business BASIC data file
    0x0b: 'WPF', // Word Processor file
    0x0c: 'SOS', // SOS system file
    0x0f: 'DIR', // Directory file (SOS and ProDOS)
    0x10: 'RPD', // RPS data file
    0x11: 'RPI', // RPS index file
    0x12: 'AFD', // AppleFile discard file
    0x13: 'AFM', // AppleFile model file
    0x14: 'ARF', // AppleFile report format file
    0x15: 'SCL', // Screen Library file
    0x19: 'ADB', // AppleWorks Data Base file
    0x1a: 'AWP', // AppleWorks Word Processor file
    0x1b: 'ASP', // AppleWorks Spreadsheet file
    0xef: 'PAR', // Pascal area
    0xf0: 'CMD', // ProDOS CI added command file
    0xfa: 'INT', // Integer BASIC program file
    0xfb: 'IVR', // Integer BASIC variable file
    0xfc: 'BAS', // Applesoft program file
    0xfd: 'VAR', // Applesoft variables file
    0xfe: 'REL', // Relocatable code file (EDASM)
    0xff: 'SYS', // ProDOS system file
} as const;
