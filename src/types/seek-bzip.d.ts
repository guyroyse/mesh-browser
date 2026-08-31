/**
 * Minimal declarations for seek-bzip, which ships no types.
 *
 * Note the second argument is an *output sink or an exact buffer size*, not a
 * maximum - passing a number makes the decoder reject any result that is not
 * exactly that long. See bz2.ts.
 */
declare module 'seek-bzip' {
  interface OutputSink {
    writeByte(byte: number): void
    getBuffer(): Buffer
  }

  const Bunzip: {
    decode(data: Buffer | Uint8Array, output?: number | OutputSink, multistream?: boolean): Buffer
  }

  export default Bunzip
}
