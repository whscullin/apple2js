/*globals require module */
const path = require('path');

module.exports =
{
    devtool: 'source-map',
    entry: {
        main2: path.resolve('js/main2.js'),
        main2e: path.resolve('js/main2e.js'),
        test: path.resolve('js/test.js')
    },
    output: {
        path: path.resolve('dist/')
    },
    devServer: {
        compress: true,
        watchContentBase: true,
        writeToDisk: true
    }
};
