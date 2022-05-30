/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { merge } = require('webpack-merge');

const baseConfig = {
    devtool: 'source-map',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/i,
                use: [
                    {
                        loader: 'ts-loader'
                    },
                ],
                exclude: /node_modules/,
            },
        ],
    },
    output: {
        publicPath: 'dist/',
        path: path.resolve('dist/'),
        filename: '[name].bundle.js',
        chunkFilename: '[name].bundle.js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias: {
            js: path.resolve(__dirname, 'js/'),
            json: path.resolve(__dirname, 'json/'),
        }
    },
};

const appConfig = merge(baseConfig,
    {
        entry: {
            main2: path.resolve('js/entry2.ts'),
            main2e: path.resolve('js/entry2e.ts'),
            preact: path.resolve('js/entry.tsx'),
        },
        output: {
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
                    ignored: /(node_modules|test|\.git)/
                },
                directory: __dirname,
            },
            devMiddleware: {
                publicPath: '/dist/',
            },
        },
    }
);

const workletConfig = merge(baseConfig,
    {
        target: false,
        entry: {
            audio_worker: path.resolve('js/ui/audio_worker.ts')
        },
        output: {
            globalObject: 'globalThis',
        },
    }
);

const workerConfig = merge(baseConfig,
    {
        target: false,
        entry: {
            format_worker: path.resolve('workers/format.worker.ts')
        },
        output: {
            globalObject: 'globalThis',
        },
    },
);

exports.default = [appConfig, workletConfig, workerConfig];
