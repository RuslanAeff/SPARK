import CommonCrypto
import Foundation

/// SEC-01 / ADR-018: yedek parolasından AES-256 anahtarı (PBKDF2-HMAC-SHA256).
/// Parola UTF-8 baytlarıyla, açık uzunlukla verilir (NUL'da kesilmez).
/// Sınırlar JS tarafındakiyle aynıdır; kötü niyetli dosyadaki aşırı tur reddedilir.
func sparkPbkdf2Sha256(password: String, saltHex: String, iterations: Int, keyLength: Int) throws -> String {
  let passwordBytes = Array(password.utf8)
  guard !passwordBytes.isEmpty, passwordBytes.count <= 1024,
        iterations >= 100_000, iterations <= 2_000_000,
        keyLength == 32,
        let salt = sparkBytesFromHex(saltHex), salt.count >= 16, salt.count <= 64 else {
    throw NSError(domain: "INVALID_FORMAT", code: 2)
  }
  var derived = [UInt8](repeating: 0, count: keyLength)
  let status = passwordBytes.withUnsafeBufferPointer { pwd in
    salt.withUnsafeBufferPointer { saltPtr in
      pwd.baseAddress!.withMemoryRebound(to: Int8.self, capacity: pwd.count) { pwdChars in
        CCKeyDerivationPBKDF(
          CCPBKDFAlgorithm(kCCPBKDF2),
          pwdChars, pwd.count,
          saltPtr.baseAddress, saltPtr.count,
          CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
          UInt32(iterations),
          &derived, keyLength
        )
      }
    }
  }
  guard status == Int32(kCCSuccess) else { throw NSError(domain: "KDF_FAILED", code: Int(status)) }
  defer { for i in derived.indices { derived[i] = 0 } }
  return derived.map { String(format: "%02x", $0) }.joined()
}

func sparkBytesFromHex(_ hex: String) -> [UInt8]? {
  let chars = Array(hex.utf8)
  guard chars.count % 2 == 0 else { return nil }
  var out = [UInt8]()
  out.reserveCapacity(chars.count / 2)
  var i = 0
  while i < chars.count {
    guard let hi = sparkHexNibble(chars[i]), let lo = sparkHexNibble(chars[i + 1]) else { return nil }
    out.append(hi << 4 | lo)
    i += 2
  }
  return out
}

private func sparkHexNibble(_ c: UInt8) -> UInt8? {
  switch c {
  case 48...57: return c - 48
  case 97...102: return c - 87
  default: return nil
  }
}
