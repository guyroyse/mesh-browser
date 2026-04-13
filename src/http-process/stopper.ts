import { ChildProcess } from 'child_process'

export async function stopProcess(process: ChildProcess) {
  if (!process) return
  process.kill()
}
