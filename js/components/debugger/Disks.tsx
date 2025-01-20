import { h, Fragment, JSX } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import cs from 'classnames';
import { Apple2 as Apple2Impl } from 'js/apple2';
import {
    BlockDisk,
    DiskFormat,
    DriveNumber,
    FloppyDisk,
    isBlockDiskFormat,
    isBlockStorage,
    isNibbleDisk,
    MassStorage,
} from 'js/formats/types';
import { slot } from 'js/apple2io';
import DiskII from 'js/cards/disk2';
import SmartPort from 'js/cards/smartport';
import createDiskFrom2MG from 'js/formats/2mg';
import createBlockDisk from 'js/formats/block';
import { ProDOSVolume } from 'js/formats/prodos';
import { FILE_TYPES, STORAGE_TYPES } from 'js/formats/prodos/constants';
import { Directory } from 'js/formats/prodos/directory';
import { FileEntry } from 'js/formats/prodos/file_entry';
import { VDH } from 'js/formats/prodos/vdh';
import { toHex } from 'js/util';

import styles from './css/Disks.module.scss';
import debuggerStyles from './css/Debugger.module.scss';
import { useCallback, useState } from 'preact/hooks';
import {
    DOS33,
    FileEntry as DOSEntry,
    isMaybeDOS33,
} from 'js/formats/dos/dos33';
import createDiskFromDOS from 'js/formats/do';
import { FileData, FileViewer } from './FileViewer';

/**
 * Formats a short date string
 *
 * @param date Data object
 * @returns Short string date
 */
const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

/**
 * Guard for determining whether a disk is a nibble or block based disk
 *
 * @param disk NibbleDisk or BlockDisk
 * @returns true if is BlockDisk
 */
function isBlockDisk(disk: FloppyDisk | BlockDisk): disk is BlockDisk {
    return !!(disk as BlockDisk).blockCount;
}

/**
 * Props for FileListing component
 */
interface FileListingProps {
    volume: ProDOSVolume;
    fileEntry: FileEntry;
    depth: number;
    setFileData: (fileData: FileData) => void;
}

/**
 * Renders a ProDOS file entry.
 *
 * @param depth Depth of listing from root
 * @param fileEntry ProDOS file entry to display
 * @returns FileListing component
 */
const FileListing = ({ depth, fileEntry, setFileData }: FileListingProps) => {
    const deleted = fileEntry.storageType === STORAGE_TYPES.DELETED;
    const doSetFileData = useCallback(() => {
        const getData = async () => {
            const binary = await fileEntry.getFileData();
            const text = await fileEntry.getFileText();
            if (binary && text) {
                setFileData({
                    binary,
                    text,
                    fileName: fileEntry.name,
                });
            }
        };
        void getData();
    }, [fileEntry, setFileData]);

    return (
        <tr>
            <td
                className={cs(styles.filename, { [styles.deleted]: deleted })}
                title={fileEntry.name}
                onClick={doSetFileData}
            >
                {'| '.repeat(depth)}
                {deleted ? (
                    <i className="fas fa-file-circle-xmark" />
                ) : (
                    <i className="fas fa-file" />
                )}{' '}
                {fileEntry.name}
            </td>
            <td>
                {FILE_TYPES[fileEntry.fileType] ??
                    `$${toHex(fileEntry.fileType)}`}
            </td>
            <td>{`$${toHex(fileEntry.auxType, 4)}`}</td>
            <td>{fileEntry.blocksUsed}</td>
            <td>{formatDate(fileEntry.creation)}</td>
            <td>{formatDate(fileEntry.lastMod)}</td>
        </tr>
    );
};

/**
 * Props for DirectoryListing Component.
 */
interface DirectoryListingProps {
    volume: ProDOSVolume;
    dirEntry: VDH | Directory;
    depth: number;
    setFileData: (fileData: FileData) => void;
}

/**
 * Displays information about a ProDOS directory, recursing through child
 * directories.
 *
 * @param volume ProDOS volume
 * @param depth Current directory depth
 * @param dirEntry Current directory entry to display
 * @returns DirectoryListing component
 */
const DirectoryListing = ({
    volume,
    depth,
    dirEntry,
    setFileData,
}: DirectoryListingProps) => {
    const [open, setOpen] = useState(depth === 0);
    const [children, setChildren] = useState<JSX.Element[]>([]);
    useEffect(() => {
        const load = async () => {
            const children: JSX.Element[] = [];
            for (let idx = 0; idx < dirEntry.entries.length; idx++) {
                const fileEntry = dirEntry.entries[idx];
                if (fileEntry.storageType === STORAGE_TYPES.DIRECTORY) {
                    const dirEntry = new Directory(volume, fileEntry);
                    await dirEntry.init();
                    children.push(
                        <DirectoryListing
                            key={idx}
                            depth={depth + 1}
                            volume={volume}
                            dirEntry={dirEntry}
                            setFileData={setFileData}
                        />
                    );
                } else {
                    children.push(
                        <FileListing
                            key={idx}
                            depth={depth + 1}
                            volume={volume}
                            fileEntry={fileEntry}
                            setFileData={setFileData}
                        />
                    );
                }
            }
            setChildren(children);
        };
        void load();
    }, [depth, dirEntry, setFileData, volume]);

    return (
        <>
            <tr>
                <td
                    className={styles.filename}
                    onClick={() => setOpen((open) => !open)}
                    title={dirEntry.name}
                >
                    {'| '.repeat(depth)}
                    <i
                        className={cs('fas', {
                            'fa-folder-open': open,
                            'fa-folder-closed': !open,
                        })}
                    />{' '}
                    {dirEntry.name}
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td>{formatDate(dirEntry.creation)}</td>
                <td></td>
            </tr>
            {open && children}
        </>
    );
};

/**
 * Props for CatalogEntry component
 */
interface CatalogEntryProps {
    dos: DOS33;
    fileEntry: DOSEntry;
    setFileData: (fileData: FileData) => void;
}

/**
 * Component for a single DOS 3.x catalog entry
 *
 * @param entry Catalog entry to display
 * @returns CatalogEntry component
 */
const CatalogEntry = ({ dos, fileEntry, setFileData }: CatalogEntryProps) => {
    const doSetFileData = useCallback(() => {
        const { data } = dos.readFile(fileEntry);
        setFileData({
            binary: data,
            text: dos.dumpFile(fileEntry),
            fileName: fileEntry.name,
        });
    }, [dos, fileEntry, setFileData]);

    return (
        <tr onClick={doSetFileData}>
            <td
                className={cs(styles.filename, {
                    [styles.deleted]: fileEntry.deleted,
                })}
            >
                {fileEntry.locked && <i className="fas fa-lock" />}{' '}
                {fileEntry.name}
            </td>
            <td>{fileEntry.type}</td>
            <td>{fileEntry.size}</td>
            <td></td>
        </tr>
    );
};

/**
 * Catalog component props
 */
interface CatalogProps {
    dos: DOS33;
    setFileData: (fileData: FileData) => void;
}

/**
 * DOS 3.3 disk catalog component
 *
 * @param dos DOS 3.3 disk object
 * @returns Catalog component
 */

const Catalog = ({ dos, setFileData }: CatalogProps) => {
    const catalog = useMemo(() => dos.readCatalog(), [dos]);
    return (
        <>
            {catalog.map((fileEntry, idx) => (
                <CatalogEntry
                    key={idx}
                    dos={dos}
                    fileEntry={fileEntry}
                    setFileData={setFileData}
                />
            ))}
        </>
    );
};

interface ProDOSData {
    prodos: ProDOSVolume;
    freeCount: number;
    vdh: VDH;
}

/**
 * Props for DiskInfo component
 */
interface DiskInfoProps {
    massStorage: MassStorage<DiskFormat>;
    driveNo: DriveNumber;
    setFileData: (fileData: FileData) => void;
}

/**
 * Top level disk info component, handles determining what sort of disk
 * is present and using the appropriate sub-component depending on whether
 * it's a ProDOS block disk or a DOS 3.3 disk.
 *
 * TODO(whscullin): Does not handle woz or 13 sector.
 *
 * @param massStorage The storage device
 * @param drive The drive number
 * @returns DiskInfo component
 */
const DiskInfo = ({ massStorage, driveNo, setFileData }: DiskInfoProps) => {
    const [disk, setDisk] = useState<BlockDisk | FloppyDisk | null>();
    const [proDOSData, setProDOSData] = useState<ProDOSData>();
    useEffect(() => {
        const load = async () => {
            if (isBlockStorage(massStorage)) {
                const disk = await massStorage.getBlockDisk(driveNo);
                if (disk) {
                    const prodos = new ProDOSVolume(disk);
                    const vdh = await prodos.vdh();
                    const bitMap = await prodos.bitMap();
                    const freeBlocks = await bitMap.freeBlocks();
                    const freeCount = freeBlocks.length;
                    setProDOSData({ freeCount, prodos, vdh });
                } else {
                    setProDOSData(undefined);
                }
                setDisk(disk);
                return;
            }
            const massStorageData = await massStorage.getBinary(driveNo, 'po');
            if (massStorageData) {
                const { data, readOnly, ext } = massStorageData;
                const { name } = massStorageData.metadata;
                let disk: BlockDisk | FloppyDisk | null = null;
                if (ext === '2mg') {
                    disk = createDiskFrom2MG({
                        name,
                        rawData: data,
                        readOnly,
                        volume: 254,
                    });
                } else if (data.byteLength < 800 * 1024) {
                    const doData = await massStorage.getBinary(driveNo, 'do');
                    if (doData) {
                        if (isMaybeDOS33(doData)) {
                            disk = createDiskFromDOS({
                                name,
                                rawData: doData.data,
                                readOnly,
                                volume: 254,
                            });
                        }
                    }
                }
                if (!disk && isBlockDiskFormat(ext)) {
                    disk = createBlockDisk(ext, {
                        name,
                        rawData: data,
                        readOnly,
                        volume: 254,
                    });
                }
                if (disk && isBlockDisk(disk)) {
                    const prodos = new ProDOSVolume(disk);
                    const vdh = await prodos.vdh();
                    const bitMap = await prodos.bitMap();
                    const freeBlocks = await bitMap.freeBlocks();
                    const freeCount = freeBlocks.length;
                    setProDOSData({ freeCount, prodos, vdh });
                }
                setDisk(disk);
            }
        };
        void load();
    }, [massStorage, driveNo]);

    if (disk) {
        try {
            if (proDOSData) {
                const { totalBlocks } = proDOSData.vdh;
                const freeCount = proDOSData.freeCount;
                const usedCount = totalBlocks - freeCount;
                return (
                    <div className={styles.volume}>
                        <table>
                            <thead>
                                <tr>
                                    <th className={styles.filename}>
                                        Filename
                                    </th>
                                    <th className={styles.type}>Type</th>
                                    <th className={styles.aux}>Aux</th>
                                    <th className={styles.blocks}>Blocks</th>
                                    <th className={styles.created}>Created</th>
                                    <th className={styles.modified}>
                                        Modified
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <DirectoryListing
                                    depth={0}
                                    volume={proDOSData.prodos}
                                    dirEntry={proDOSData.vdh}
                                    setFileData={setFileData}
                                />
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={1}>
                                        Blocks Free: {freeCount}
                                    </td>
                                    <td colSpan={3}>Used: {usedCount}</td>
                                    <td colSpan={2}>Total: {totalBlocks}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            } else if (isNibbleDisk(disk)) {
                const dos = new DOS33(disk);
                return (
                    <div className={styles.volume}>
                        <table>
                            <thead>
                                <tr>
                                    <th className={styles.filename}>
                                        Filename
                                    </th>
                                    <th className={styles.type}>Type</th>
                                    <th className={styles.sectors}>Sectors</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <Catalog dos={dos} setFileData={setFileData} />
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>Volume Number:</td>
                                    <td colSpan={3}>{dos.getVolumeNumber()}</td>
                                </tr>
                                <tr>
                                    <td>Used Sectors:</td>
                                    <td colSpan={3}>{dos.usedSectorCount()}</td>
                                </tr>
                                <tr>
                                    <td>Free Sectors:</td>
                                    <td colSpan={3}>{dos.freeSectorCount()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            }
        } catch (error) {
            console.error(error);
            return <pre>Unknown volume</pre>;
        }
    }
    return <pre>No disk</pre>;
};

/**
 * Disks component props
 */
export interface DisksProps {
    apple2: Apple2Impl;
}

/**
 * A debugger panel that displays information about currently mounted
 * disks.
 *
 * @param apple2 The apple2 object
 * @returns Disks component
 */
export const Disks = ({ apple2 }: DisksProps) => {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const io = apple2.getIO();
    const cards: MassStorage<DiskFormat>[] = [];

    const onClose = useCallback(() => {
        setFileData(null);
    }, []);

    for (let idx = 0; idx <= 7; idx++) {
        const card = io.getSlot(idx as slot);
        if (card instanceof DiskII || card instanceof SmartPort) {
            cards.push(card);
        }
    }

    return (
        <div>
            {cards.map((card, idx) => (
                <div key={idx}>
                    <div className={debuggerStyles.subHeading}>
                        {card.constructor.name} - 1
                    </div>
                    <DiskInfo
                        massStorage={card}
                        driveNo={1}
                        setFileData={setFileData}
                    />
                    <div className={debuggerStyles.subHeading}>
                        {card.constructor.name} - 2
                    </div>
                    <DiskInfo
                        massStorage={card}
                        driveNo={2}
                        setFileData={setFileData}
                    />
                </div>
            ))}
            <FileViewer fileData={fileData} onClose={onClose} />
        </div>
    );
};
