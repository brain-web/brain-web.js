const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
    new HtmlWebpackPlugin({
      template: './example/index.html',
    }),
  ],
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    disableHostCheck: true,
    host: '0.0.0.0',
    port: 5500,
  },
};
