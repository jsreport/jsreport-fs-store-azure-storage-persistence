const Promise = require('bluebird')
const path = require('path')
const azure = require('azure-storage')
const stream = require('stream')

async function retry (fn, maxCount = 10) {
  let error
  for (var i = 0; i < maxCount; i++) {
    try {
      const res = await fn()
      return res
    } catch (e) {
      error = e
      await Promise.delay(i * 10)
    }
  }

  throw error
}

module.exports = ({ accountName, accountKey, container = 'jsreport', lock = {} }) => {
  if (!accountName) {
    throw new Error('The fs store is configured to use azure storage persistence but the accountName is not set. Use store.persistence.accountName or extensions.fs-store-azure-storage-persistence.accountName to set the proper value.')
  }
  if (!accountKey) {
    throw new Error('The fs store is configured to use azure storage persistence but the accountKey is not set. Use store.persistence.accountKey or extensions.fs-store-azure-storage-persistence.accountKey to set the proper value.')
  }

  if (lock.enabled !== false) {
    lock.leaseDuration = lock.leaseDuration || 30
    lock.retry = 100
  }

  const blobService = azure.createBlobService(accountName, accountKey)
  Promise.promisifyAll(blobService)

  return {
    init: () => blobService.createContainerIfNotExistsAsync(container),
    readdir: async (p) => {
      const res = await blobService.listBlobsSegmentedWithPrefixAsync(container, p, null)
      const topFilesOrDirectories = res.entries.map(e => e.name.replace(p, '').split('/').filter(f => f)[0])
      return [...new Set(topFilesOrDirectories)]
    },
    readFile: async (p) => {
      const data = []
      const writingStream = new stream.Writable({
        write: function (chunk, encoding, next) {
          data.push(chunk)
          next()
        }
      })
      await blobService.getBlobToStreamAsync(container, p, writingStream)
      return Buffer.concat(data)
    },
    writeFile: (p, c) => blobService.createBlockBlobFromTextAsync(container, p, c),
    appendFile: async (p, c) => {
      await blobService.createAppendBlobFromTextAsync(container, p, '')
      return blobService.appendFromTextAsync(container, p, c)
    },
    rename: async (p, pp) => {
      const blobsToRename = await blobService.listBlobsSegmentedWithPrefixAsync(container, p, null)
      return Promise.all(blobsToRename.entries.map(async (e) => {
        const newName = e.name.replace(p, pp)
        await blobService.startCopyBlobAsync(blobService.getUrl(container, e.name), container, newName)
        await blobService.deleteBlobAsync(container, e.name)
      }))
    },
    exists: async (p) => {
      const res = await blobService.doesBlobExistAsync(container, p)
      return res.exists
    },
    stat: async (p) => {
      const res = await blobService.doesBlobExistAsync(container, p)
      return { isDirectory: () => !res.exists }
    },
    mkdir: (p) => Promise.resolve(),
    remove: async (p) => {
      const blobsToRemove = await blobService.listBlobsSegmentedWithPrefixAsync(container, p, null)
      return Promise.all(blobsToRemove.entries.map(e => blobService.deleteBlobAsync(container, e.name)))
    },
    path: {
      join: (a, b) => a ? `${a}/${b}` : b,
      sep: '/',
      basename: path.basename
    },
    lock: () => lock.enabled !== false ? retry(() => blobService.acquireLeaseAsync(container, null, lock), lock.retry) : null,
    releaseLock: (l) => lock.enabled !== false ? blobService.releaseLeaseAsync(container, null, l.id) : null
  }
}
