/** @jest-environment jsdom */
/** @fileoverview Test for canvas.ts. */

import { VideoPage } from 'js/videomodes';
import { LoresPage2D, HiresPage2D, VideoModes2D } from 'js/canvas';
import apple2enh_char from 'js/roms/character/apple2enh_char';
import { createImageFromImageData } from 'test/util/image';
import RAM from 'js/ram';

function checkImageData(page: VideoPage) {
    page.refresh();
    const img = createImageFromImageData(page.imageData);
    expect(img).toMatchImageSnapshot();
}

describe('canvas', () => {
    describe('LoresPage', () => {
        let canvas: HTMLCanvasElement;
        let lores1: LoresPage2D;
        let vm: VideoModes2D;
        let ram: RAM[];

        beforeEach(() => {
            canvas = document.createElement('canvas');
            vm = new VideoModes2D(canvas, true);
            ram = [new RAM(0x00, 0xbf), new RAM(0x00, 0xbf)];
            lores1 = new LoresPage2D(vm, 1, ram, apple2enh_char, true);
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

                it('renders mono', () => {
                    vm.text(false);
                    vm.mono(true);

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

                it('renders mono', () => {
                    vm.text(false);
                    vm._80col(true);
                    vm.an3(false);
                    vm.mono(true);

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
        let hires1: HiresPage2D;
        let vm: VideoModes2D;
        let ram: RAM[];

        beforeEach(() => {
            canvas = document.createElement('canvas');
            vm = new VideoModes2D(canvas, true);
            ram = [new RAM(0x00, 0xbf), new RAM(0x00, 0xbf)];
            hires1 = new HiresPage2D(vm, 1, ram);
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

            it('renders mono', () => {
                vm.text(false);
                vm.mono(true);

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

            it('renders mono', () => {
                vm.text(false);
                vm._80col(true);
                vm.an3(false);
                vm.mono(true);

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
