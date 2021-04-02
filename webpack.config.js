const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  entry: './src/entrypoint.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'brainweb.js',
    library: 'brainweb',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: './examples/*.html',
          to: '.',
        },
      ]
    }),
  ],
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    writeToDisk: true,
    disableHostCheck: true,
    host: '0.0.0.0',
    port: 5500,
  },
};
