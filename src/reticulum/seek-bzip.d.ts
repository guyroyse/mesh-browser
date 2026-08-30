/**
 * Minimal declarations for seek-bzip, which ships no types.
 *
 * Only `decode` is declared - it is the only entry point we use. The package
 * has no encoder; see bz2.ts.
 */
declare module 'seek-bzip' {
  const Bunzip: {
    decode(data: Buffer | Uint8Array, outputLength?: number): Buffer
  }
  export default Bunzip
}
