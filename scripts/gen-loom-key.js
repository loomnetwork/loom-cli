const loom = require('loom-js')
const fs = require('fs')
const path = require('path')

const prefix = process.argv[2]

if (!prefix) {
    throw new Error('prefix not specified')
}

const privateKey = loom.CryptoUtils.generatePrivateKey()
const privateKeyString = loom.CryptoUtils.Uint8ArrayToB64(privateKey)

fs.writeFileSync(path.join(__dirname, `../${prefix}_private_key`), privateKeyString)
