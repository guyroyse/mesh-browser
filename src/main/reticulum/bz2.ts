/**
 * bz2 codec for Reticulum Resources.
 *
 * Python RNS bz2-compresses Resources; reticulum-js is zero-dependency by
 * design and ships no codec, so one must be injected per link or every fetch
 * from a Python peer fails in Resource.assemble with "Resource is compressed
 * but no bz2 module was provided".
 *
 * This is invisible in JS-to-JS testing - only a real Python peer exercises it.
 */

import Bunzip from 'seek-bzip'

const INITIAL_BUFFER = 64 * 1024

export const bz2 = {
  /**
   * Decompress a Resource body, bounded by the advertised uncompressed size.
   *
   * `maxOutputLength` is reticulum-js's resource-bomb defence: an upper bound,
   * not a promise. Handing that number straight to seek-bzip does something
   * different - it allocates a fixed buffer of exactly that size with resizing
   * disabled, then throws "outputsize does not match decoded input" unless the
   * body decodes to precisely that many bytes.
   *
   * Supplying our own sink honours the bound as a bound: output shorter than
   * advertised is fine, and anything longer is refused the moment it exceeds.
   */
  decompress(data: Uint8Array, maxOutputLength: number): Uint8Array {
    let buffer = Buffer.alloc(Math.min(maxOutputLength, INITIAL_BUFFER))
    let length = 0

    const sink = {
      writeByte(byte: number): void {
        if (length >= maxOutputLength) {
          throw new Error(`bz2 output exceeds the advertised ${maxOutputLength} bytes`)
        }

        if (length >= buffer.length) {
          const grown = Buffer.alloc(Math.min(maxOutputLength, buffer.length * 2))
          buffer.copy(grown)
          buffer = grown
        }

        buffer[length++] = byte
      },

      getBuffer(): Buffer {
        return buffer.subarray(0, length)
      }
    }

    Bunzip.decode(Buffer.from(data), sink)

    /* Copied out so the result does not retain the grown buffer */
    return new Uint8Array(buffer.subarray(0, length))
  },

  /*
   * seek-bzip exports decode/decodeBlock/Stream only - there is no encoder.
   * Fetching never compresses; sending a Resource (an upload or POST) would,
   * and will need a different package such as compressjs.
   */
  compress(): Uint8Array {
    throw new Error('bz2 compression is not supported - seek-bzip cannot encode')
  }
}
