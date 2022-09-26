export interface SystemType {
    rom: string;
    characterRom: string;
    e: boolean;
    enhanced: boolean;
    sectors: 13 | 16;
}

// Enhanced Apple //e

export const defaultSystem = {
    rom: 'apple2enh',
    characterRom: 'apple2enh_char',
    e: true,
    enhanced: true,
    sectors: 16,
} as const;

export const systemTypes: Record<string, Partial<SystemType>> = {
    // Apple //e
    apple2e: {
        rom: 'apple2e',
        characterRom: 'apple2e_char',
        enhanced: false
    },
    apple2rm: {
        characterRom: 'rmfont_char',
    },
    apple2ex: {
        rom: 'apple2ex',
        e: false,
    },

    // Apple ][s
    apple2: {
        rom: 'intbasic',
        characterRom: 'apple2_char',
        e: false,
    },
    apple213: {
        rom: 'intbasic',
        characterRom: 'apple2_char',
        e: false,
        sectors: 13,
    },
    original: {
        rom: 'original',
        characterRom: 'apple2_char',
        e: false,
    },
    apple2jplus: {
        rom: 'apple2j',
        characterRom: 'apple2j_char',
        e: false,
    },
    apple2pig: {
        rom: 'fpbasic',
        characterRom: 'pigfont_char',
        e: false,
    },
    apple2lc:{
        rom: 'fpbasic',
        characterRom: 'apple2lc_char',
        e: false,
    },
    apple2plus: {
        rom: 'fpbasic',
        characterRom: 'apple2_char',
        e: false,
    }
} as const;
