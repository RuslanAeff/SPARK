import fs from 'fs';
import path from 'path';

describe('SparkBoundedFile Android build configuration', () => {
  it('declares the library version required by the Expo module Gradle plugin', () => {
    const buildGradle = fs.readFileSync(
      path.join(__dirname, '..', 'android', 'build.gradle'),
      'utf8'
    );

    expect(buildGradle).toMatch(/defaultConfig\s*\{[\s\S]*versionCode\s+1/);
    expect(buildGradle).toMatch(/defaultConfig\s*\{[\s\S]*versionName\s+['"]1\.0\.0['"]/);
  });
});
