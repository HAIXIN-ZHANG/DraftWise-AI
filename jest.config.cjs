/** @type {import("jest").Config} */
module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "babel-jest",
      {
        plugins: ["@babel/plugin-transform-modules-commonjs"],
        presets: ["@babel/preset-typescript"],
      },
    ],
  },
};
