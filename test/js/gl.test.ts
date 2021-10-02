/** @jest-environment jsdom */
/** @fileoverview Test for canvas.ts. */

import { VideoPage } from 'js/videomodes';
import { LoresPageGL, HiresPageGL, VideoModesGL } from 'js/gl';
import apple2enh_char from 'js/roms/character/apple2enh_char';
import { createImageFromImageData } from 'test/util/image';

function checkImageData(page: VideoPage) {
    page.refresh();
    const img = createImageFromImageData(page.imageData);
    expect(img).toMatchImageSnapshot();
}

describe('gl', () => {

    describe('LoresPage', () => {
        let canvas: HTMLCanvasElement;
        let lores1: LoresPageGL;
        let vm: VideoModesGL;

        beforeEach(async () => {
            canvas = document.createElement('canvas');
            vm = new VideoModesGL(canvas, true);
            await vm.ready;
            lores1 = new LoresPageGL(vm, 1, apple2enh_char, true);
            vm.reset();
            vm.hires(false);
        });

        describe('text mode', () => {
            describe('40 column', () => {
                it('renders', () => {
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            lores1.write(page, off, off);
                        }
                    }

                    checkImageData(lores1);
                });

                it('renders alt chars', () => {
                    vm.altChar(true);
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            lores1.write(page, off, off);
                        }
                    }

                    checkImageData(lores1);
                });
            });

            describe('80 column', () => {
                it('renders', () => {
                    vm._80col(true);
                    const bank0 = lores1.bank0();
                    const bank1 = lores1.bank1();
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            bank0.write(page, off, off);
                            bank1.write(page, off, 255 - off);
                        }
                    }

                    checkImageData(lores1);
                });

                it('renders alt chars', () => {
                    vm.altChar(true);
                    vm._80col(true);
                    const bank0 = lores1.bank0();
                    const bank1 = lores1.bank1();
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            bank0.write(page, off, off);
                            bank1.write(page, off, 255 - off);
                        }
                    }

                    checkImageData(lores1);
                });
            });
        });

        describe('graphics mode', () => {
            describe('lores', () => {
                it('renders', () => {
                    vm.text(false);
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            lores1.write(page, off, off);
                        }
                    }

                    checkImageData(lores1);
                });

                it('renders mixed', () => {
                    vm.text(false);
                    vm.mixed(true);

                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            lores1.write(page, off, off);
                        }
                    }

                    checkImageData(lores1);
                });
            });

            describe('double lores', () => {
                it('renders', () => {
                    vm.text(false);
                    vm._80col(true);
                    vm.an3(false);

                    const bank0 = lores1.bank0();
                    const bank1 = lores1.bank1();
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            bank0.write(page, off, off);
                            bank1.write(page, off, 255 - off);
                        }
                    }

                    checkImageData(lores1);
                });

                it('renders mixed', () => {
                    vm.text(false);
                    vm.mixed(true);
                    vm._80col(true);
                    vm.an3(false);

                    const bank0 = lores1.bank0();
                    const bank1 = lores1.bank1();
                    for (let page = 0x4; page < 0x8; page++) {
                        for (let off = 0; off < 0x100; off++) {
                            bank0.write(page, off, off);
                            bank1.write(page, off, 255 - off);
                        }
                    }

                    checkImageData(lores1);
                });
            });
        });
    });

    describe('HiresPage', () => {
        let canvas: HTMLCanvasElement;
        let hires1: HiresPageGL;
        let vm: VideoModesGL;

        beforeEach(() => {
            canvas = document.createElement('canvas');
            vm = new VideoModesGL(canvas, true);
            hires1 = new HiresPageGL(vm, 1);
            vm.reset();
            vm.hires(true);
        });

        describe('hires', () => {
            it('renders', () => {
                vm.text(false);
                for (let page = 0x20; page < 0x40; page++) {
                    for (let off = 0; off < 0x100; off++) {
                        hires1.write(page, off, off);
                    }
                }

                checkImageData(hires1);
            });
        });

        describe('double lores', () => {
            it('renders', () => {
                vm.text(false);
                vm._80col(true);
                vm.an3(false);

                const bank0 = hires1.bank0();
                const bank1 = hires1.bank1();
                for (let page = 0x20; page < 0x40; page++) {
                    for (let off = 0; off < 0x100; off++) {
                        bank0.write(page, off, off);
                        bank1.write(page, off, 255 - off);
                    }
                }

                checkImageData(hires1);
            });
        });
    });
});
