module.exports = {
  'name': 'fs-store-azure-storage-persistence',
  'main': 'lib/main.js',
  'dependencies': ['templates', 'fs-store'],
  'optionsSchema': {
    extensions: {
      'fs-store': {
        type: 'object',
        properties: {
          persistence: {
            type: 'object',
            properties: {
              provider: { type: 'string', enum: ['azure-storage'] }
            }
          }
        }
      },
      'fs-store-azure-storage-persistence': {
        type: 'object',
        properties: {
          accountName: { type: 'string' },
          accountKey: { type: 'string' },
          container: { type: 'string' },
          lock: {
            type: 'object',
            properties: {
              retry: { type: 'number' },
              leaseDuration: { type: 'number' },
              enabled: { type: 'boolean' }
            }
          }
        }
      }
    }
  }
}
