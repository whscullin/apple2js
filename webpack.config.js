const path = require('path');

module.exports =
{
    devtool: 'source-map',
    entry: {
        main2: path.resolve('js/entry2.js'),
        main2e: path.resolve('js/entry2e.js')
    },
    output: {
        path: path.resolve('dist/'),
        library: 'Apple2',
        libraryExport: 'Apple2',
        libraryTarget: 'var'
    },
    devServer: {
        compress: true,
        publicPath: '/dist/',
        watchContentBase: true
    },
    module: {
        rules: [
            {
                test: /\.2mg$/i,
                use: [
                    {
                        loader: 'file-loader',
                    },
                ],
            },
            {
                test: /\.rom$/i,
                use: [
                    {
                        loader: 'raw-loader',
                    },
                ],
            },
        ],
    },
};
