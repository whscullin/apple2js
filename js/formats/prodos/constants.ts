export const BLOCK_SIZE = 512;

export const STORAGE_TYPES = {
    DELETED: 0x0,
    SEEDLING: 0x1,
    SAPLING: 0x2,
    TREE: 0x3,
    DIRECTORY: 0xD,
    SUBDIRECTORY_HEADER: 0xE,
    VDH_HEADER: 0xF
} as const;

export const ACCESS_TYPES = {
    DELETE: 0x80,
    RENAME: 0x40,
    BACKUP: 0x20,
    WRITE: 0x02,
    READ: 0x01,
    ALL: 0xE3
} as const;

export const FILE_TYPES = {
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
    0x0A: 'DA3', // Business BASIC data file
    0x0B: 'WPF', // Word Processor file
    0x0C: 'SOS', // SOS system file
    0x0F: 'DIR', // Directory file (SOS and ProDOS)
    0x10: 'RPD', // RPS data file
    0x11: 'RPI', // RPS index file
    0x12: 'AFD', // AppleFile discard file
    0x13: 'AFM', // AppleFile model file
    0x14: 'ARF', // AppleFile report format file
    0x15: 'SCL', // Screen Library file
    0x19: 'ADB', // AppleWorks Data Base file
    0x1A: 'AWP', // AppleWorks Word Processor file
    0x1B: 'ASP', // AppleWorks Spreadsheet file
    0xEF: 'PAR', // Pascal area
    0xF0: 'CMD', // ProDOS CI added command file
    0xFA: 'INT', // Integer BASIC program file
    0xFB: 'IVR', // Integer BASIC variable file
    0xFC: 'BAS', // Applesoft program file
    0xFD: 'VAR', // Applesoft variables file
    0xFE: 'REL', // Relocatable code file (EDASM)
    0xFF: 'SYS'  // ProDOS system file
} as const;
