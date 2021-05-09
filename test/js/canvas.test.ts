/** @fileoverview Test for gl.ts. */

import { generateImage } from 'jsdom-screenshot';
import { LoresPage2D, VideoModes2D } from 'js/canvas';
import apple2enh_char from 'js/roms/apple2enh_char';
import { createImageFromImageData } from 'test/util/image';

describe('LoresPage', () => {
    let canvas: HTMLCanvasElement;
    let lores1: LoresPage2D;
    let vm: VideoModes2D;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        vm = new VideoModes2D(canvas, true);
        lores1 = new LoresPage2D(vm, 1, apple2enh_char, true);
        vm.reset();
    });

    describe('text mode', () => {
        describe('40 column', () => {
            it('renders', async () => {
                for (let page = 0x4; page < 0x8; page++) {
                    for (let off = 0; off < 0x100; off++) {
                        lores1.write(page, off, off);
                    }
                }

                const img = createImageFromImageData(lores1.imageData);
                document.body.appendChild(img);
                const screen = await generateImage();
                expect(screen).toMatchImageSnapshot();
                img.remove();
            });

            it('renders alt chars', async () => {
                vm.altChar(true);
                for (let page = 0x4; page < 0x8; page++) {
                    for (let off = 0; off < 0x100; off++) {
                        lores1.write(page, off, off);
                    }
                }

                const img = createImageFromImageData(lores1.imageData);
                document.body.appendChild(img);
                const screen = await generateImage();
                expect(screen).toMatchImageSnapshot();
                img.remove();
            });
        });

        describe('80 column', () => {
            it('renders', async () => {
                vm._80col(true);
                const bank0 = lores1.bank0();
                const bank1 = lores1.bank1();
                for (let page = 0x4; page < 0x8; page++) {
                    for (let off = 0; off < 0x100; off++) {
                        bank0.write(page, off, off);
                        bank1.write(page, off, 255 - off);
                    }
                }

                const img = createImageFromImageData(lores1.imageData);
                document.body.appendChild(img);
                const screen = await generateImage();
                expect(screen).toMatchImageSnapshot();
                img.remove();
            });

            it('renders alt chars', async () => {
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

                const img = createImageFromImageData(lores1.imageData);
                document.body.appendChild(img);
                const screen = await generateImage();
                expect(screen).toMatchImageSnapshot();
                img.remove();
            });
        });
    });
});
