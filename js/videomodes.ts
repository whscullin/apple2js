import { MemoryPages, Restorable, byte, memory } from './types';

export type bank = 0 | 1;
export type pageNo = 1 | 2;

export interface Region {
    top: number,
    bottom: number,
    left: number,
    right: number,
}

export interface GraphicsState {
    page: byte;
    mono: boolean;
    buffer: memory[];
}

export interface VideoModesState {
    grs: [gr1: GraphicsState, gr2: GraphicsState],
    hgrs: [hgr1: GraphicsState, hgr2: GraphicsState],
    textMode: boolean,
    mixedMode: boolean,
    hiresMode: boolean,
    pageMode: pageNo,
    _80colMode: boolean,
    altCharMode: boolean,
    an3: boolean,
}

export interface VideoPage extends MemoryPages, Restorable<GraphicsState> {
    imageData: ImageData
    dirty: Region;

    bank0(): MemoryPages
    bank1(): MemoryPages

    mono: (on: boolean) => void
    refresh: () => void
}

export interface LoresPage extends VideoPage {
    getText: () => string
}

export interface HiresPage extends VideoPage {

}

export interface VideoModes extends Restorable<VideoModesState> {
    page(pageNo: number): void

    blit(altData?: ImageData): boolean

    reset(): void

    _80col(on: boolean): void
    altchar(on: boolean): void
    doubleHires(on: boolean): void
    enhanced(on: boolean): void
    hires(on: boolean): void
    mixed(on: boolean): void
    text(on: boolean): void

    is80Col(): boolean
    isAltChar(): boolean
    isDoubleHires(): boolean
    isHires(): boolean
    isMixed(): boolean
    isPage2(): boolean
    isText(): boolean
}
