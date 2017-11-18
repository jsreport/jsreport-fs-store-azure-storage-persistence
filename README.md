# jsreport-fs-store-azure-storage-persistence
[![NPM Version](http://img.shields.io/npm/v/jsreport-fs-store-azure-storage-persistence.svg?style=flat-square)](https://npmjs.com/package/jsreport-fs-store-azure-storage-persistence)
[![Build Status](https://travis-ci.org/jsreport/jsreport-fs-store-azure-storage-persistence.png?branch=master)](https://travis-ci.org/jsreport/jsreport-fs-store-azure-storage-persistence)

**Make jsreport [fs store](https://github.com/jsreport/jsreport-fs-store) persisting entities into azure blob storage.**


## Installation

> npm install jsreport-fs-store:next    
> npm install jsreport-fs-store-azure-storage-persistence

And alter jsreport configuration 
```js
"connectionString": { 
  "name": "fs2",
  "persistence": {
    "name": "azure-storage",
    "accountName": "...",
    "accountKey": "..."
  }
},	
```