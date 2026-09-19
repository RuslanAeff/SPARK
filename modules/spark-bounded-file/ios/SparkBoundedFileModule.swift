import ExpoModulesCore
import Foundation

public class SparkBoundedFileModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SparkBoundedFile")
    AsyncFunction("readUtf8") { (source: String, limit: Int) -> String in
      guard limit > 0, limit <= 25 * 1024 * 1024,
            let url = URL(string: source), url.isFileURL else {
        throw NSError(domain: "INVALID_FORMAT", code: 1)
      }
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      return try readBoundedUtf8File(url, limit: limit)
    }
  }
}
