import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import typescript2 from 'rollup-plugin-typescript2';

const external = [
  'react',
  'react-dom',
  'fs',
  'path',
  'util',
  'crypto',
  'os',
  'child_process',
  'stream',
  'events',
  'url',
  'http',
  'https',
  'zlib',
  'buffer',
  'querystring',
  'assert',
  'net',
  'tls',
  'dns',
  'readline',
  'cluster',
  'worker_threads',
  'perf_hooks',
  'inspector',
  'async_hooks',
  'v8',
  'vm',
  'module',
  'repl',
  'string_decoder',
  'timers',
  'tty',
  'dgram',
  'constants',
  'process'
];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript2({
        tsconfig: './tsconfig.json',
        declaration: false,
        jsx: 'react-jsx',
      }),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
];
