// The tiny Gradle build the native CI job uses to put the Compose artifacts on a classpath.
// It has no source of its own: scripts/native-check.js writes the generated Kotlin into a temporary folder and
// OV_NATIVE_SRC says where.
rootProject.name = "openvibe-native-kotlin"
