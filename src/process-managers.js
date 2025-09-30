const path = require('path')

const { HttpProcessManager } = require('./http-process/manager')

module.exports = {
  pythonManager: new HttpProcessManager('python', [path.join(__dirname, 'python', 'main.py')])
}
