import { readdirSync } from 'fs'
import { join } from 'path'

export const loadSystemTasks = (agenda) => {
  const jobsPath = join(__dirname, '../systemTasks')
  readdirSync(jobsPath).forEach((file) => {
    const job = require(join(jobsPath, file))
    job(agenda)
  })
}
