module.exports = {
    'moduleNameMapper': {
        '^js/(.*)': '<rootDir>/js/$1',
        '^test/(.*)': '<rootDir>/test/$1',
        '\\.css$': 'identity-obj-proxy',
        '\\.scss$': 'identity-obj-proxy',
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
    'setupFilesAfterEnv': [
        '<rootDir>/test/jest-setup.ts'
    ],
    'coveragePathIgnorePatterns': [
        '/node_modules/',
        '/js/roms/',
        '/test/',
    ]
};
