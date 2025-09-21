const path = require('path')

const { ProcessManager } = require('./process-manager/manager')

module.exports = {
  reticulumManager: new ProcessManager('python', [path.join(__dirname, 'python', 'main.py')])
}
