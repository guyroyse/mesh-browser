const path = require('path')

const { HttpProcessManager } = require('./http-process/manager')

module.exports = {
  pythonManager: new HttpProcessManager(['python', 'python3'], [path.join(__dirname, 'python', 'main.py')])
}
