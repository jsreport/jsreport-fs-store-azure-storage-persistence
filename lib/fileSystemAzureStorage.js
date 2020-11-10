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
    lock.leaseDuration = lock.leaseDuration || 60
    lock.retry = 100
  }

  const blobService = azure.createBlobService(accountName, accountKey)
  Promise.promisifyAll(blobService)

  return {
    init: () => blobService.createContainerIfNotExistsAsync(container),
    readdir: async (p) => {
      const res = await blobService.listBlobsSegmentedWithPrefixAsync(container, p, null)
      const topFilesOrDirectories = res.entries
        .filter(e =>
          e.name === p ||
          e.name.startsWith(p + '/') ||
          p === ''
        )
        .map(e => e.name.replace(p, '').split('/').filter(f => f)[0])
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
    writeFile: (p, c) => {
      const buffer = Buffer.from(c)
      let s = new stream.Readable()
      s._read = () => {}
      s.push(buffer)
      s.push(null)
      return blobService.createBlockBlobFromStreamAsync(container, p, s, buffer.length)
    },
    appendFile: async function (p, c) {
      let existingBuffer = Buffer.from([])
      try {
        existingBuffer = await this.readFile(p)
      } catch (e) {
        // doesn't exist yet
      }

      const finalBuffer = Buffer.concat([existingBuffer, Buffer.from(c)])

      let s = new stream.Readable()
      s._read = () => {}
      s.push(finalBuffer)
      s.push(null)
      return blobService.createBlockBlobFromStreamAsync(container, p, s, finalBuffer.length)
    },
    rename: async (p, pp) => {
      const blobsToRename = await blobService.listBlobsSegmentedWithPrefixAsync(container, p, null)
      const entriesToRename = blobsToRename.entries.filter(e =>
        e.name === p ||
        e.name.startsWith(p + '/') ||
        p === ''
      )
      await Promise.all(entriesToRename.map(async (e) => {
        const newName = e.name.replace(p, pp)
        await blobService.startCopyBlobAsync(blobService.getUrl(container, e.name), container, newName)
      }))

      return Promise.all(entriesToRename.map((e) => blobService.deleteBlobAsync(container, e.name)))
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
      return Promise.all(blobsToRemove.entries
        .filter(e =>
          e.name === p ||
          e.name.startsWith(p + '/') ||
          p === ''
        )
        .map(e => blobService.deleteBlobAsync(container, e.name)))
    },
    copyFile: (p, pp) => blobService.startCopyBlobAsync(blobService.getUrl(container, p), container, pp),
    path: {
      join: (...args) => args.filter(a => a).join('/'),
      sep: '/',
      basename: path.basename
    },
    lock: () => lock.enabled !== false ? retry(() => blobService.acquireLeaseAsync(container, null, lock), lock.retry) : null,
    releaseLock: async (l) => {
      if (lock.enabled !== false) {
        try {
          await blobService.releaseLeaseAsync(container, null, l.id)
        } catch (e) {
          // this throws when the lease was in the meantime acquired by another process because of timeout
        }
      }
    }
  }
}
