module.exports = {
    'moduleNameMapper': {
        '^js/(.*)': '<rootDir>/js/$1',
        '^test/(.*)': '<rootDir>/test/$1',
    },
    'roots': [
        'js/',
        'test/',
    ],
    'testMatch': [
        '**/?(*.)+(spec|test).+(ts|js)'
    ],

    'transform': {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest'
    },
    'setupFilesAfterEnv': [
        '<rootDir>/test/jest-setup.js'
    ],
    'coveragePathIgnorePatterns': [
        '/node_modules/',
        '/js/roms/',
        '/test/',
    ]
};
