import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

export default [
  {
    input: 'src/loader/loader.ts',
    output: {
      file: 'dist/sdk.min.js',
      format: 'iife',
      name: '_sp',
    },
    plugins: [
      typescript(),
      terser({
        mangle: { toplevel: true, properties: { regex: /^_/ } },
        compress: { passes: 3, unsafe: true },
        output: { comments: false },
      }),
    ],
  },
  {
    input: 'src/core/sw/worker.ts',
    output: {
      file: 'dist/sw.js',
      format: 'iife',
    },
    plugins: [typescript(), terser()],
  },
]
