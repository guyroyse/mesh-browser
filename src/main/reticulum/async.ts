/**
 * Generic async primitives. No Reticulum dependency - kept separate so the
 * pooling logic reads as pooling rather than as promise plumbing.
 */

/** Bounds how many callers may hold a resource at once. */
export class Semaphore {
  readonly #capacity: number
  #permits: number
  #waiters: Array<() => void> = []

  constructor(permits: number) {
    this.#capacity = permits
    this.#permits = permits
  }

  async acquire(): Promise<void> {
    if (this.#permits > 0) {
      this.#permits--
      return
    }

    await new Promise<void>((resolve) => this.#waiters.push(resolve))
  }

  release(): void {
    const waiter = this.#waiters.shift()

    /* Hand the permit straight to the next waiter rather than round-tripping */
    if (waiter) {
      waiter()
      return
    }

    this.#permits++
  }

  /** True when nobody holds a permit and nobody is queued for one. */
  get idle(): boolean {
    return this.#permits === this.#capacity && this.#waiters.length === 0
  }
}

/**
 * A promise that rejects after `ms`, cancelled when `signal` aborts.
 *
 * For racing against work that settles on an event. Deliberately a plain
 * ref'd timer rather than `AbortSignal.timeout`, whose timer is unref'd and so
 * only fires while something else independently keeps the event loop alive - a
 * timeout the user is waiting on must not depend on that.
 */
export function rejectAfter(ms: number, message: string, signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)

    signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  })
}

/**
 * Reject if `promise` has not settled within `ms`.
 *
 * Named for what it does on expiry: `main.ts` has a same-shaped helper that
 * *resolves* on expiry, and one of the two had to stop being called
 * `withTimeout`.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    const settle = <A>(handler: (arg: A) => void) => (arg: A) => {
      clearTimeout(timer)
      handler(arg)
    }

    promise.then(settle(resolve), settle(reject))
  })
}
