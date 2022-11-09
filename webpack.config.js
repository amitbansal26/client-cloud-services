const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "src/index.js"),
  target: 'node',
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    libraryTarget: "commonjs-module",
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: [
          '/node_modules/',
          path.resolve(__dirname, './src/')
        ],
        use: "babel-loader"
      },
    ],
  },
  mode: "development",
};
