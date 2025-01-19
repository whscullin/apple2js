import { MemoryPages, Restorable } from './types';

export type bank = 0 | 1;
export type pageNo = 1 | 2;

export interface Region {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface VideoModesState {
    textMode: boolean;
    mixedMode: boolean;
    hiresMode: boolean;
    pageMode: pageNo;
    _80colMode: boolean;
    altCharMode: boolean;
    an3State: boolean;
    flag: number;
}

export interface VideoPage extends MemoryPages {
    imageData: ImageData;
    dirty: Region;

    bank0(): MemoryPages;
    bank1(): MemoryPages;

    refresh: () => void;
}

export interface LoresPage extends VideoPage {
    getText: () => string;
}

export interface HiresPage extends VideoPage {}

export interface VideoModes extends Restorable<VideoModesState> {
    textMode: boolean;
    mixedMode: boolean;
    hiresMode: boolean;
    pageMode: pageNo;
    _80colMode: boolean;
    altCharMode: boolean;
    an3State: boolean;
    doubleHiresMode: boolean;

    flag: number;
    monoMode: boolean;

    context: CanvasRenderingContext2D;

    page(pageNo: number): void;

    blit(altData?: ImageData): boolean;

    reset(): void;

    setLoresPage(page: pageNo, lores: LoresPage): void;
    getLoresPage(page: pageNo): LoresPage;
    setHiresPage(page: pageNo, lores: HiresPage): void;
    getHiresPage(page: pageNo): HiresPage;

    _80col(on: boolean): void;
    altChar(on: boolean): void;
    an3(on: boolean): void;
    doubleHires(on: boolean): void;
    hires(on: boolean): void;
    mixed(on: boolean): void;
    text(on: boolean): void;

    is80Col(): boolean;
    isAltChar(): boolean;
    isDoubleHires(): boolean;
    isHires(): boolean;
    isMixed(): boolean;
    isPage2(): boolean;
    isText(): boolean;

    mono(on: boolean): void;
    scanlines(on: boolean): void;

    getText(): string;
    getCanvasAsBlob(): Promise<Blob>;

    ready: Promise<void>;

    getState(): VideoModesState;
}

export async function copyScreenToClipboard(vm: VideoModes) {
    const text = vm.getText();
    if (typeof ClipboardItem !== 'undefined') {
        const data: Record<string, Blob> = {};
        if (!vm.textMode) {
            const blob = await vm.getCanvasAsBlob();
            data[blob.type] = blob;
        } else {
            const htmlBlob = new Blob([`<pre>${text}</pre>`], {
                type: 'text/html',
            });
            data[htmlBlob.type] = htmlBlob;

            const textBlob = new Blob([text], {
                type: 'text/plain',
            });
            data[textBlob.type] = textBlob;
        }

        await navigator.clipboard.write([new ClipboardItem(data)]);
    } else {
        await navigator.clipboard.writeText(text);
    }
}
