const fileSystemAzureStorage = require('./fileSystemAzureStorage')

module.exports = (reporter, definition) => {
  if (reporter.fsStore) {
    reporter.fsStore.registerPersistence('azure-storage',
      (options) => (fileSystemAzureStorage(Object.assign({ logger: reporter.logger }, options, definition.options))))
  }
}
