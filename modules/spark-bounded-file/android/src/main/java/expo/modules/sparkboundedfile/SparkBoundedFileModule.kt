package expo.modules.sparkboundedfile

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

class SparkBoundedFileModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SparkBoundedFile")
    AsyncFunction("readUtf8") { source: String, limit: Int ->
      require(limit in 1..(25 * 1024 * 1024)) { "INVALID_FORMAT" }
      val uri = Uri.parse(source)
      val input = when (uri.scheme) {
        "content" -> appContext.reactContext?.contentResolver?.openInputStream(uri)
        "file" -> FileInputStream(requireNotNull(uri.path))
        else -> throw IllegalArgumentException("INVALID_FORMAT")
      } ?: throw IllegalArgumentException("INVALID_FORMAT")
      input.use { stream ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        while (true) {
          val count = stream.read(buffer, 0, minOf(buffer.size, limit - total + 1))
          if (count == -1) break
          if (count == 0) throw IllegalArgumentException("INVALID_FORMAT")
          total += count
          require(total <= limit) { "INVALID_FORMAT" }
          output.write(buffer, 0, count)
        }
        Charsets.UTF_8.newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(output.toByteArray())).toString()
      }
    }
  }
}
