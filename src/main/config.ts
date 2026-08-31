/**
 * Tunable settings.
 *
 * Everything here is a judgement call rather than a fact - a number someone
 * could reasonably want different. Protocol invariants (a destination hash is
 * 16 bytes, HTTP headers end with a blank line) deliberately stay next to the
 * code that depends on them, where changing one reads as the bug it would be.
 *
 * Shaped as a single object so that reading a config file later means merging
 * overrides into these defaults, rather than unpicking a module's worth of
 * separate bindings.
 */

export const config = {
  /*
   * How long the app waits for protocol clients to stop before forcing the
   * quit. Reticulum links run a 1-second watchdog and are the slowest thing
   * being torn down, so this is several of those - a stuck one must not hang
   * the exit.
   */
  shutdownTimeout: 5_000,

  /* Size the main window opens at; the natural home for persisted geometry later */
  window: {
    width: 1200,
    height: 800
  },

  reticulum: {
    /*
     * A LoRa path can genuinely take minutes, so these stay generous - the
     * spike's 30s was too tight. All in milliseconds.
     */
    pathDiscoveryTimeout: 120_000,
    linkEstablishmentTimeout: 120_000,
    responseTimeout: 300_000,

    /* How long an unused link is kept before being closed */
    linkIdleTimeout: 60_000,

    /*
     * How long a failed path discovery is remembered. Without it, every
     * subresource of a page on an unreachable host pays the full discovery
     * timeout in turn.
     */
    pathFailureTtl: 30_000,

    /*
     * The rserver protocol cannot match a response to a request, so a link
     * carries one request at a time. This is how many run in parallel per
     * destination.
     */
    maxLinksPerDestination: 4,

    /*
     * reticulum-js rejects Resource advertisements over 32 MB as a bomb
     * defense. Python RNS peers apply no such cap, so leaving the default would
     * silently break large downloads that work today.
     */
    maxResourceSize: 256 * 1024 * 1024
  }
}
