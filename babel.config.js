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
                jsxPragma: 'h'
            }
        ],
    ],
    plugins: [
        [
            '@babel/plugin-transform-react-jsx', {
                pragma: 'h',
                pragmaFrag: 'Fragment',
            }
        ]
    ]
};
