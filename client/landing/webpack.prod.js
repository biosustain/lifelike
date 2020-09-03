const path = require('path');
const {merge} = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src', 'index.html'),
      hash: false,
      filename: path.resolve(__dirname, 'dist', 'landing.html'),
    }),
    new CopyPlugin({
      patterns: [
        {from: path.resolve(__dirname, 'assets'), to: path.resolve(__dirname, 'dist', 'assets')},
      ],
    }),
  ],
});
