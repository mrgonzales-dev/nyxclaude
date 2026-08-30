/**
 * Shared external dependency lists for CLI and SDK bundles.
 *
 * Used by build.ts and validate-externals.ts.
 * When adding a new dependency to package.json, check if it should be
 * added here (large packages, native modules, or packages with many exports).
 */

// Packages that should be kept external in ALL bundles (CLI + SDK).
export const COMMON_EXTERNALS: string[] = [
  // Native image processing
  'sharp',
  // @vscode/ripgrep ships a platform-specific binary alongside its
  // index.js and resolves the path via __dirname at runtime. Bundling
  // would freeze the build host's absolute path into dist/cli.mjs, so we
  // keep it external and rely on the npm package being installed.
  '@vscode/ripgrep',
  // Orama search engine
  '@orama/orama',
  '@orama/plugin-data-persistence',
  // web-tree-sitter ships a WASM file alongside its JS and resolves the
  // path via require.resolve at runtime; bundling would freeze the build
  // host's absolute path, so keep it external.
  'web-tree-sitter',
  // tree-sitter-wasms ships per-language .wasm files resolved via
  // require.resolve at runtime — same bundling concern as web-tree-sitter.
  'tree-sitter-wasms',
  // NYXCLAUDE: fff (Fast File Finder) — native C library loaded via ffi-rs.
  // Ships compiled JS + platform-specific native binary. Keep external so
  // the native binary path resolves correctly at runtime under node.
  '@ff-labs/fff-node',
]

// Additional packages external only in the SDK bundle (TUI + heavy deps)
export const SDK_ONLY_EXTERNALS: string[] = [
  'react',
  'react-reconciler',
  '@anthropic-ai/sdk',
  '@modelcontextprotocol/sdk',
]

// Optional runtime packages: dynamically imported only when a provider/feature
// needs them, and NOT listed in package.json `dependencies`, so a default
// `npm install -g nyxclaude` stays small and warning-free.
//
// Two shapes (see RUNTIME_INDIRECTION_ONLY_EXTERNALS below):
//   - Most stay external in both bundles (in COMMON_EXTERNALS) so esbuild never
//     inlines them — they ARE referenced where esbuild can see them.
//   - The indirection-only subset (@anthropic-ai/{bedrock,foundry}-sdk) is the
//     opposite: loaded purely via the runtime importer, so esbuild never sees a
//     static reference and they must stay OUT of the externals lists.
export const OPTIONAL_RUNTIME_EXTERNALS: string[] = [
  // Native image processing — loaded via dynamic import in the image tools.
  // Optional: only image reads need it, and it carries a native install
  // script. Kept opt-in so default installs run no install scripts.
  'sharp',
]

// OPTIONAL_RUNTIME_EXTERNALS that are loaded ONLY through the runtime importer
// (the `new Function` indirection in src/utils/optionalRuntimeModule.ts), so
// esbuild never sees a static reference to them. These must NOT appear in the
// externals lists.
export const RUNTIME_INDIRECTION_ONLY_EXTERNALS: string[] = []

// OPTIONAL_RUNTIME_EXTERNALS that are NOT direct devDependencies because they
// are pulled transitively by another optional package's dependency tree, so
// source builds/tests still resolve them. Every OTHER optional external must be
// a direct devDependency (validated) so `bun install` source/dev builds keep
// working.
export const TRANSITIVE_OPTIONAL_EXTERNALS: string[] = []

// Computed full lists
export const CLI_EXTERNALS: string[] = COMMON_EXTERNALS
export const SDK_EXTERNALS: string[] = [...COMMON_EXTERNALS, ...SDK_ONLY_EXTERNALS]

// Packages intentionally bundled (not external, not flagged by validation)
// These are small utilities that are fine to inline into the output bundle.
export const INTENTIONALLY_BUNDLED: string[] = [
  // Anthropic sandbox runtime — statically imported (utils/sandbox/sandbox-adapter.ts).
  '@anthropic-ai/sandbox-runtime',
  // CLI / TUI utilities
  '@alcalzone/ansi-tokenize',
  '@commander-js/extra-typings',
  'bidi-js',
  'chalk',
  'cli-boxes',
  'cli-highlight',
  'commander',
  'emoji-regex',
  'env-paths',
  'figures',
  'get-east-asian-width',
  'indent-string',
  'supports-hyperlinks',
  'wrap-ansi',
  // Data formats
  'jsonc-parser',
  'yaml',
  'marked',
  'turndown',
  'xss',
  // Data utilities
  'ajv',
  'auto-bind',
  'diff',
  'fflate',
  'fuse.js',
  'ignore',
  'lodash-es',
  'lru-cache',
  'p-map',
  'picomatch',
  'proper-lockfile',
  'qrcode',
  'semver',
  'shell-quote',
  'signal-exit',
  'type-fest',
  // Networking
  'axios',
  'cross-spawn',
  'duck-duck-scrape',
  'execa',
  'https-proxy-agent',
  'tree-kill',
  'undici',
  'ws',
  // React ecosystem (react/react-reconciler are SDK_ONLY_EXTERNALS, bundled in CLI)
  'react',
  'react-compiler-runtime',
  'react-reconciler',
  'usehooks-ts',
  // Anthropic SDK (external in SDK bundle, bundled in CLI)
  '@anthropic-ai/sdk',
  // MCP SDK (external in SDK bundle, bundled in CLI)
  '@modelcontextprotocol/sdk',
  // Schema validation
  'zod',
    // gRPC (bundled into CLI, not external)
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  // Language server protocol
  'vscode-languageserver-protocol',
  // File watching
  'chokidar',
  // Graph algorithms (repo map PageRank)
  'graphology',
  'graphology-metrics',
  // Tokenizer for repo map token budgeting
  'js-tiktoken',
]
