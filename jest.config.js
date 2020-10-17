module.exports = {
  "roots": [
    "js/",
    "test/",
  ],
  "testMatch": [
    "**/?(*.)+(spec|test).+(ts|js)"
  ],
  "transform": {
    "^.+\\.js$": "babel-jest",
    "^.+\\.ts$": "ts-jest"
  },
}