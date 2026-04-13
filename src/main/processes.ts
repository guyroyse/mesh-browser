import { HttpProcessManager } from '@http-process/manager'

import { pythonPath } from './config'

export const pythonManager = new HttpProcessManager(['python', 'python3'], [pythonPath])
