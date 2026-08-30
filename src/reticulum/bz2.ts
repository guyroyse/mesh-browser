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

export const bz2 = {
  decompress(data: Uint8Array, outputLength: number): Uint8Array {
    return new Uint8Array(Bunzip.decode(Buffer.from(data), outputLength))
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
