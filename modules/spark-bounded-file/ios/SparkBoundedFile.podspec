Pod::Spec.new do |s|
  s.name = 'SparkBoundedFile'
  s.version = '1.0.0'
  s.summary = 'Bounded local backup reads for SPARK'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'SPARK'
  s.homepage = 'https://example.invalid/spark-bounded-file'
  s.platforms = { :ios => '15.1' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end
