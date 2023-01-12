import { ComponentChildren, h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import cs from 'classnames';

import { Apple2 as Apple2Impl } from 'js/apple2';
import MMU from 'js/mmu';
import LanguageCard from 'js/cards/langcard';

import styles from './css/Memory.module.scss';
import debuggerStyles from './css/Debugger.module.scss';

/**
 * Encapsulates the read/write status of a bank
 */
interface ReadWrite {
    read: boolean;
    write: boolean;
}

/**
 * Encapsulates the read/write status of a language card
 */
interface LC extends ReadWrite {
    bank0: ReadWrite;
    bank1: ReadWrite;
    rom: ReadWrite;
}

/**
 * Encapsulates the read/write status of an aux/main memory bank.
 */
interface Bank extends ReadWrite {
    lc: LC;
    hires: ReadWrite;
    text: ReadWrite;
    zp: ReadWrite;
}

/**
 * Encapsulates the read/write status of aux main memory and rom banks.
 */
interface Banks {
    main: Bank;
    aux: Bank;
    io: ReadWrite;
    intcxrom: ReadWrite;
}

/**
 * Computes a language card state for an MMU aux or main bank.
 *
 * @param mmu MMU object
 * @param altzp Compute for main or aux bank
 * @returns LC read/write state
 */
const calcLC = (mmu: MMU, altzp: boolean) => {
    const read = mmu.readbsr && (mmu.altzp === altzp);
    const write = mmu.writebsr && (mmu.altzp === altzp);
    return {
        read,
        write,
        bank0: {
            read: read && !mmu.bank1,
            write: write && !mmu.bank1,
        },
        bank1: {
            read: read && mmu.bank1,
            write: write && mmu.bank1,
        },
        rom: {
            read: !mmu.readbsr,
            write: !mmu.writebsr,
        },
    };
};

/**
 * Computes the hires aux or main read/write status.
 *
 * @param mmu MMU object
 * @param aux Compute for main or aux bank
 * @returns Hires pags read/write state
 */
const calcHires = (mmu: MMU, aux: boolean) => {
    const page2sel = mmu.hires && mmu._80store;
    return {
        read: page2sel ? mmu.page2 === aux : mmu.auxread === aux,
        write: page2sel ? mmu.page2 === aux : mmu.auxwrite === aux,
    };
};

/**
 * Computes the text aux or main read/write status.
 *
 * @param mmu MMU object
 * @param aux Compute for main or aux bank
 * @returns Text page read/write state
 */
const calcText = (mmu: MMU, aux: boolean) => {
    const page2sel = mmu._80store;
    return {
        read: page2sel ? mmu.page2 === aux : mmu.auxread === aux,
        write: page2sel ? mmu.page2 === aux : mmu.auxwrite === aux,
    };
};

/**
 * Creates read/write state from a flag
 *
 * @param flag Read/write flag
 * @returns A read/write state
 */
const readAndWrite = (flag: boolean) => {
    return {
        read: flag,
        write: flag,
    };
};

/**
 * Computes the aux or main bank read/write status.
 *
 * @param mmu MMU object
 * @param aux Compute for main or aux bank
 * @returns read/write state
 */
const calcBanks = (mmu: MMU): Banks => {
    return {
        main: {
            read: !mmu.auxread,
            write: !mmu.auxwrite,
            lc: calcLC(mmu, false),
            hires: calcHires(mmu, false),
            text: calcText(mmu, false),
            zp: readAndWrite(!mmu.altzp),
        },
        aux: {
            read: mmu.auxread,
            write: mmu.auxwrite,
            lc: calcLC(mmu, true),
            hires: calcHires(mmu, true),
            text: calcText(mmu, true),
            zp: readAndWrite(mmu.altzp),
        },
        io: readAndWrite(!mmu.intcxrom),
        intcxrom: readAndWrite(mmu.intcxrom),
    };
};

/**
 * Computes the read/write state of a language card.
 *
 * @param card The language card
 * @returns read/write state
 */
const calcLanguageCard = (card: LanguageCard): LC => {
    const read = card.readbsr;
    const write = card.writebsr;
    return {
        read,
        write,
        bank0: {
            read: read && !card.bsr2,
            write: write && !card.bsr2,
        },
        bank1: {
            read: read && card.bsr2,
            write: write && card.bsr2,
        },
        rom: {
            read: !card.readbsr,
            write: !card.writebsr,
        }
    };
};

/**
 * Computes the classes for a bank from read/write state.
 *
 * @param rw Read/write state
 * @returns Classes
 */
const rw = (rw: ReadWrite) => {
    return {
        [styles.read]: rw.read,
        [styles.write]: rw.write,
        [styles.inactive]: !rw.write && !rw.read,
    };
};

/**
 * Properties for LanguageCard component
 */
interface LanguageCardMapProps {
    lc: LC;
    children?: ComponentChildren;
}

/**
 * Language card state component use by both the MMU and LanguageCard
 * visualizations.
 *
 * @param lc LC state
 * @param children label component
 * @returns LanguageCard component
 */
const LanguageCardMap = ({ lc, children }: LanguageCardMapProps) => {
    return (
        <div className={cs(styles.bank)}>
            <div className={cs(styles.lc, rw(lc))}>
                {children} LC
            </div>
            <div className={styles.lcbanks}>
                <div className={cs(styles.lcbank, styles.lcbank0, rw(lc.bank0))}>
                    Bank 0
                </div>
                <div className={cs(styles.lcbank, rw(lc.bank1))}>
                    Bank 1
                </div>
            </div>
        </div>
    );
};

/**
 * Legend of state colors. Green for read, red for write, blue for both, grey for
 * inactive.
 *
 * @returns Legend component
 */
const Legend = () => {
    return (
        <div>
            <div>
                <div className={cs(styles.read, styles.legend)}> </div> Read
            </div>
            <div>
                <div className={cs(styles.write, styles.legend)}> </div> Write
            </div>
            <div>
                <div className={cs(styles.write, styles.read, styles.legend)}> </div> Read/Write
            </div>
            <div>
                <div className={cs(styles.inactive, styles.legend)}> </div> Inactive
            </div>
        </div>
    );
};

/**
 * Properties for the Memory component.
 */
export interface MemoryProps {
    apple2: Apple2Impl | undefined;
}

/**
 * Memory debugger component. Displays the active state of banks of
 * memory - aux, 80 column and language card depending up the machine.
 *
 * @param apple2 Apple2 object
 * @returns Memory component
 */
export const Memory = ({ apple2 }: MemoryProps) => {
    const animationRef = useRef<number>(0);
    const [banks, setBanks] = useState<Banks>();
    const [lc, setLC] = useState<LC>();

    const animate = useCallback(() => {
        if (apple2) {
            const mmu = apple2.getMMU();
            if (mmu) {
                setBanks(calcBanks(mmu));
            } else {
                const card = apple2.getIO().getSlot(0);
                if (card instanceof LanguageCard) {
                    setLC(calcLanguageCard(card));
                }
            }
        }
        animationRef.current = requestAnimationFrame(animate);
    }, [apple2]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [animate]);

    if (banks) {
        return (
            <div className={styles.memory}>
                <div className={debuggerStyles.heading}>MMU</div>
                <div className={cs(styles.upperMemory, debuggerStyles.row)}>
                    <LanguageCardMap lc={banks.aux.lc}>
                        Aux
                    </LanguageCardMap>
                    <LanguageCardMap lc={banks.main.lc}>
                        Main
                    </LanguageCardMap>
                    <div className={cs(styles.bank)}>
                        <div className={cs(styles.rom, rw(banks.main.lc.rom))}>
                            ROM
                        </div>
                    </div>
                </div>
                <div className={cs(debuggerStyles.row)}>
                    <div className={cs(styles.io, rw(banks.io))}>
                        IO
                    </div>
                    <div className={cs(styles.intcxrom, rw(banks.intcxrom))}>
                        CXROM
                    </div>
                </div>
                <div className={cs(styles.lowerMemory, debuggerStyles.row)}>
                    <div className={cs(styles.bank, rw(banks.aux))}>
                        Aux Mem
                        <div className={cs(styles.hires, rw(banks.aux.hires))}>
                            Hires
                        </div>
                        <div className={cs(styles.text, rw(banks.aux.text))}>
                            Text/Lores
                        </div>
                        <div className={cs(styles.zp, rw(banks.aux.zp))}>
                            Stack/ZP
                        </div>
                    </div>
                    <div className={cs(styles.bank, rw(banks.main))}>
                        Main Mem
                        <div className={cs(styles.hires, rw(banks.main.hires))}>
                            Hires
                        </div>
                        <div className={cs(styles.text, rw(banks.main.text))}>
                            Text/Lores
                        </div>
                        <div className={cs(styles.zp, rw(banks.main.zp))}>
                            <span>Stack/ZP</span>
                        </div>
                    </div>
                </div>
                <hr />
                <Legend />
            </div>
        );
    } else if (lc) {
        return (
            <div className={styles.memory}>
                <div className={debuggerStyles.heading}>Language Card</div>
                <div className={cs(debuggerStyles.row, styles.languageCard)}>
                    <LanguageCardMap lc={lc} />
                    <div className={cs(styles.bank)}>
                        <div className={cs(styles.rom, rw(lc.rom))}>
                            ROM
                        </div>
                    </div>
                </div>
                <hr />
                <Legend />
            </div>
        );
    } else {
        return null;
    }
};
