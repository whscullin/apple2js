module.exports = {
    'moduleNameMapper': {
        '^js/(.*)': '<rootDir>/js/$1',
        '^test/(.*)': '<rootDir>/test/$1',
        '\\.css$': 'identity-obj-proxy',
        '\\.scss$': 'identity-obj-proxy',
        // For some reason the preact modules are not where they are
        // expected. This seems to have something to do with jest > v27.
        // https://github.com/preactjs/enzyme-adapter-preact-pure/issues/179#issuecomment-1201096897
        '^preact(/(.*)|$)': 'preact$1',
    },
    'roots': [
        'js/',
        'test/',
    ],
    'testMatch': [
        '**/?(*.)+(spec|test).+(ts|js|tsx)'
    ],
    'transform': {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.*\\.tsx$': 'ts-jest',
    },
    'transformIgnorePatterns': [
        '/node_modules/(?!(@testing-library/preact/dist/esm)/)',
    ],
    'setupFilesAfterEnv': [
        '<rootDir>/test/jest-setup.ts'
    ],
    'coveragePathIgnorePatterns': [
        '/node_modules/',
        '/js/roms/',
        '/test/',
    ],
    'preset': 'ts-jest',
};
