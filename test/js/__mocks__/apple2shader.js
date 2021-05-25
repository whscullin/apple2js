export const screenEmu = (function () {
    return {
        C: {
            NTSC_DETAILS: {
                imageSize: {
                    width: 560,
                    height: 192,
                },
            },
        },
        DisplayConfiguration: class {},
        Point: class {},
        ScreenView: class {
            initOpenGL() {}
        },
        Size: class{},
    };
})();
