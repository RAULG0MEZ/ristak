const crypto = require('crypto')

// AES-256-GCM helpers using hex-encoded key from META_ENCRYPTION_KEY
function getKey() {
  const hex = process.env.META_ENCRYPTION_KEY
  if (!hex) throw new Error('META_ENCRYPTION_KEY is required')
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('META_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

function encrypt(text) {
  if (text == null) return null
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as base64: iv.tag.ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

function decrypt(payload) {
  if (!payload) return null
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

module.exports = { encrypt, decrypt }

