// babel.config.js
module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    node: 'current',
                },
            },
        ],
        [
            '@babel/typescript',
            {
                isTSX: true,
                allExtensions: true,
            },
        ],
    ],
    plugins: [
        [
            '@babel/plugin-transform-react-jsx',
            {
                runtime: 'automatic',
            },
        ],
    ],
};
