import { Memory, Restorable, byte, memory } from './types';

export type bank = 0 | 1;
export type pageNo = 1 | 2;

export interface Color {
    0: byte, // red
    1: byte, // green
    2: byte, // blue
}

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

export interface VideoPage extends Memory, Restorable<GraphicsState> {
    imageData: ImageData
    dirty: Region;

    bank0(): Memory
    bank1(): Memory

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

    is80Col(): boolean
    isAltChar(): boolean
    isDoubleHires(): boolean
    isHires(): boolean
    isMixed(): boolean
    isPage2(): boolean
    isText(): boolean
}
