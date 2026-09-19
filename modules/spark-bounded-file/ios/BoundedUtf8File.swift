import Foundation

func readBoundedUtf8File(_ url: URL, limit: Int) throws -> String {
  guard limit > 0, limit <= 25 * 1024 * 1024 else { throw NSError(domain: "INVALID_FORMAT", code: 1) }
  let handle = try FileHandle(forReadingFrom: url)
  defer { try? handle.close() }
  var bytes = Data()
  while true {
    let chunk = try handle.read(upToCount: min(8192, limit - bytes.count + 1)) ?? Data()
    if chunk.isEmpty { break }
    guard bytes.count + chunk.count <= limit else {
      throw NSError(domain: "INVALID_FORMAT", code: 1)
    }
    bytes.append(chunk)
  }
  guard let text = String(data: bytes, encoding: .utf8) else {
    throw NSError(domain: "INVALID_FORMAT", code: 1)
  }
  return text
}
