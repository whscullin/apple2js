const path = require('path');

module.exports =
{
    devtool: 'source-map',
    mode: 'development',
    entry: {
        main2: path.resolve('js/entry2.js'),
        main2e: path.resolve('js/entry2e.js')
    },
    output: {
        path: path.resolve('dist/'),
        library: {
            name: 'Apple2',
            type: 'umd',
            export: 'Apple2',
        },
    },
    devServer: {
        compress: true,
        static: {
            watch: {
                ignored: /(node_modules|\.git)/
            },
            directory: __dirname,
        },
        dev: {
            publicPath: '/dist/',
        },
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
            {
                test: /\.ts$/i,
                use: [
                    {
                        loader: 'ts-loader'
                    },
                ],
                exclude: /node_modules/,
            }
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
};
