/**
 * Lifecycle contracts for long-lived subsystems.
 */

export interface Startable {
  start(): Promise<void>
}

export interface Stoppable {
  stop(): Promise<void>
}

export interface Lifecycle extends Startable, Stoppable {}
