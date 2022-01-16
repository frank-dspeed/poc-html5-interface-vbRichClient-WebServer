import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json'
import MagicString from 'magic-string'
import { existsSync } from 'fs';
// start Prepare OutPut Dir




// End Prepare OutPut Dir
const output = {
  dir: 'audio-automation-luncher/package.nw',
  format: 'cjs',
  entryFileNames: '[name].js',
  chunkFileNames: '[name].js'
}

const plugins = [json(),resolve(),commonjs({
    esmExternals: ( id ) => { return false; },
    transformMixedEsModules: true,
})]

const bundels = [
  {
    input: 'audio-automation-luncher/dependencies.js',
    plugins,
    output: { ...output, banner: '// @ts-nocheck'}
  },{
  external: (k) => k.indexOf('dependencies.js') > -1 || k === 'nw.gui',
  input: 'audio-automation-luncher/index.js',
  plugins,
  output,
  watch: {
    // include and exclude govern which files to watch. by
    // default, all dependencies will be watched
    exclude: ['node_modules/**']
  }
}];

if (!existsSync('audio-automation-luncher/package.nw/dependencies.js')) {
  bundels.push({
    input: 'audio-automation-luncher/dependencies.js',
    plugins,
    output: { ...output, banner: '// @ts-nocheck'}
  })
};



export default bundels;