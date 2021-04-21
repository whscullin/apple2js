module.exports = {
    'moduleNameMapper': {
        '^js/(.*)': '<rootDir>/js/$1',
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
};
