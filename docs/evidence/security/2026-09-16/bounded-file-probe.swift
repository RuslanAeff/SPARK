import Foundation

@main
struct BoundedFileProbe {
  static func main() throws {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: url) }
    var passed = 0
    func check(_ bytes: Data, limit: Int, succeeds: Bool) throws {
      try bytes.write(to: url)
      do {
        _ = try readBoundedUtf8File(url, limit: limit)
        precondition(succeeds, "oversized or malformed data accepted")
      } catch { precondition(!succeeds, "valid data rejected") }
      passed += 1
    }
    try check(Data("{\"name\":\"İş\"}".utf8), limit: 16, succeeds: true)
    try check(Data("é".utf8), limit: 1, succeeds: false)
    try check(Data([0xFF]), limit: 10, succeeds: false)
    try check(Data(repeating: 32, count: 25 * 1024 * 1024), limit: 25 * 1024 * 1024, succeeds: true)
    try check(Data(repeating: 32, count: 26 * 1024 * 1024), limit: 25 * 1024 * 1024, succeeds: false)
    print("Bounded native Foundation file reader: \(passed) checks passed; iOS provider/security-scope and Android runtime remain untested.")
  }
}
