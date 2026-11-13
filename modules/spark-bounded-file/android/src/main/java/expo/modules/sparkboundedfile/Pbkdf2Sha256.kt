package expo.modules.sparkboundedfile

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * SEC-01 / ADR-018: yedek parolasından AES-256 anahtarı (PBKDF2-HMAC-SHA256,
 * RFC 8018). Platformun HmacSHA256'sı üzerine elle kurulur: parola tam olarak
 * UTF-8 baytlarıyla kullanılır (SecretKeyFactory'nin char[] dönüşümüne bağlı
 * kalınmaz) ve iOS CommonCrypto ile bayt bayt aynı sonucu verir.
 * Sınırlar JS tarafındakiyle aynıdır; kötü niyetli dosyadaki aşırı tur reddedilir.
 */
internal fun sparkPbkdf2Sha256(password: String, saltHex: String, iterations: Int, keyLength: Int): String {
  val passwordBytes = password.toByteArray(Charsets.UTF_8)
  val salt = sparkBytesFromHex(saltHex)
  require(
    passwordBytes.isNotEmpty() && passwordBytes.size <= 1024 &&
      iterations in 100_000..2_000_000 &&
      keyLength == 32 &&
      salt != null && salt.size in 16..64
  ) { "INVALID_FORMAT" }

  val mac = Mac.getInstance("HmacSHA256")
  mac.init(SecretKeySpec(passwordBytes, "HmacSHA256"))
  passwordBytes.fill(0)
  val hLen = mac.macLength
  val out = ByteArray(keyLength)
  val u = ByteArray(hLen)
  val t = ByteArray(hLen)
  var offset = 0
  var block = 1
  while (offset < keyLength) {
    mac.update(salt!!)
    mac.update(
      byteArrayOf(
        (block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte()
      )
    )
    mac.doFinal(u, 0)
    System.arraycopy(u, 0, t, 0, hLen)
    for (i in 1 until iterations) {
      mac.update(u)
      mac.doFinal(u, 0)
      for (k in 0 until hLen) t[k] = (t[k].toInt() xor u[k].toInt()).toByte()
    }
    val length = minOf(hLen, keyLength - offset)
    System.arraycopy(t, 0, out, offset, length)
    offset += length
    block += 1
  }
  u.fill(0)
  t.fill(0)
  // Yerel ayardan bağımsız küçük harfli hex.
  val digits = "0123456789abcdef"
  val hex = StringBuilder(keyLength * 2)
  for (b in out) {
    val v = b.toInt() and 0xff
    hex.append(digits[v ushr 4]).append(digits[v and 0x0f])
  }
  out.fill(0)
  return hex.toString()
}

internal fun sparkBytesFromHex(hex: String): ByteArray? {
  if (hex.length % 2 != 0) return null
  val out = ByteArray(hex.length / 2)
  for (i in out.indices) {
    val hi = Character.digit(hex[i * 2], 16)
    val lo = Character.digit(hex[i * 2 + 1], 16)
    if (hi < 0 || lo < 0 || hex[i * 2].isUpperCase() || hex[i * 2 + 1].isUpperCase()) return null
    out[i] = ((hi shl 4) or lo).toByte()
  }
  return out
}
