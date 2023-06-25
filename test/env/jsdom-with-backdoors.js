/**
 * This is a total and terrible hack that allows us to create otherwise
 * uninstantiable jsdom objects. Currently this exposes a way to create
 * `FileList` objects.
 * 
 * This was inspired by felipochoa's implementation in GitHub issue:
 * https://github.com/jsdom/jsdom/issues/1272. This implementation is
 * "better" because it does all of the dirty work during environment
 * setup. It still requires typing.
 */

import JsdomEnvironment from 'jest-environment-jsdom';

export default class JsdomEnvironmentWithBackDoors extends JsdomEnvironment {
    async setup() {
        await super.setup();
        const jsdomUtils = require('jsdom/lib/jsdom/living/generated/utils');
        const jsdomFileList = require('jsdom/lib/jsdom/living/generated/FileList');

        this.global.backdoors = {
            newFileList: (...files) => {
                const impl = jsdomFileList.createImpl(this.global);
                const fileList = Object.assign([...files], {
                    item: i => fileList[i],
                    [jsdomUtils.implSymbol]: impl,
                });
                impl[jsdomUtils.wrapperSymbol] = fileList;
                const fileListCtor = this.global[jsdomUtils.ctorRegistrySymbol].FileList;
                Object.setPrototypeOf(fileList, fileListCtor.prototype);
                return fileList;
            },
        };
    }
}
