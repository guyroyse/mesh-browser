import { ReticulumClient } from '@rns/client'

/*
 * One long-lived client for the life of the app. Reticulum keeps per-process
 * routing and identity caches, so a client per fetch would re-discover every
 * path from cold.
 */
export const reticulumClient = new ReticulumClient()
