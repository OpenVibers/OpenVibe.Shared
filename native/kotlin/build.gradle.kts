// The tiny build the native CI job (.github/workflows/native.yml) uses to compile the generated Kotlin.
//
// It resolves three things and writes them out: the Compose artifacts (the runtime, the UI, Material 3 and the
// icons), the Compose compiler plugin and the Kotlin compiler itself. The job then runs the compiler over the
// generated sources, so a generator that writes Kotlin nobody can compile fails the build here.
//
// The sources are not in this folder: scripts/native-check.js writes them into a temporary folder, and the job says
// where they are.
plugins {
    base
}

repositories {
    google()
    mavenCentral()
}

// The Compose versions the check compiles against. The runtime, the UI and the icons move together; Material 3 has
// its own line.
val composeVersion = "1.7.6"
val material3Version = "1.3.1"
// The Kotlin compiler and its Compose plugin have to be the same version.
val kotlinVersion = "2.0.21"

// The Compose artifacts are multiplatform: these attributes ask for the JVM ones (the desktop and the stub
// variants), not the common metadata.
val composeClasspath by configurations.creating {
    isCanBeConsumed = false
    isCanBeResolved = true
    attributes {
        attribute(Usage.USAGE_ATTRIBUTE, objects.named(Usage::class, Usage.JAVA_API))
        attribute(Category.CATEGORY_ATTRIBUTE, objects.named(Category::class, Category.LIBRARY))
        attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE, objects.named(LibraryElements::class, LibraryElements.JAR))
        attribute(Attribute.of("org.jetbrains.kotlin.platform.type", String::class.java), "jvm")
    }
}

val composeCompilerPlugin by configurations.creating {
    isCanBeConsumed = false
    isCanBeResolved = true
}

// The compiler itself: kotlinc's command line, plus what it needs to run.
val kotlinCompiler by configurations.creating {
    isCanBeConsumed = false
    isCanBeResolved = true
    attributes {
        attribute(Usage.USAGE_ATTRIBUTE, objects.named(Usage::class, Usage.JAVA_API))
        attribute(Category.CATEGORY_ATTRIBUTE, objects.named(Category::class, Category.LIBRARY))
        attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE, objects.named(LibraryElements::class, LibraryElements.JAR))
        attribute(Attribute.of("org.jetbrains.kotlin.platform.type", String::class.java), "jvm")
    }
}

dependencies {
    composeClasspath("androidx.compose.runtime:runtime:$composeVersion")
    composeClasspath("androidx.compose.runtime:runtime-saveable:$composeVersion")
    composeClasspath("androidx.compose.ui:ui:$composeVersion")
    composeClasspath("androidx.compose.ui:ui-text:$composeVersion")
    composeClasspath("androidx.compose.foundation:foundation:$composeVersion")
    composeClasspath("androidx.compose.material3:material3:$material3Version")
    composeClasspath("androidx.compose.material:material-icons-extended:$composeVersion")
    composeClasspath("org.jetbrains.kotlin:kotlin-stdlib:$kotlinVersion")
    // The kit renderer's JSON reader. Android carries org.json in the platform; the check compiles against the
    // same class from Maven Central, so the renderer is checked against the parser it ships with.
    composeClasspath("org.json:json:20240303")

    composeCompilerPlugin("org.jetbrains.kotlin:kotlin-compose-compiler-plugin-embeddable:$kotlinVersion")

    kotlinCompiler("org.jetbrains.kotlin:kotlin-compiler-embeddable:$kotlinVersion")
    kotlinCompiler("org.jetbrains.kotlin:kotlin-stdlib:$kotlinVersion")
    kotlinCompiler("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    kotlinCompiler("org.jetbrains:annotations:23.0.0")
    kotlinCompiler("org.jetbrains.intellij.deps:trove4j:1.0.20200330")
}

// Where the job reads the three classpaths from (OV_NATIVE_TOOLCHAIN).
tasks.register("writeToolchain") {
    val compose = composeClasspath
    val plugin = composeCompilerPlugin
    val compiler = kotlinCompiler
    val folder = providers.environmentVariable("OV_NATIVE_TOOLCHAIN").orElse("build/toolchain")
    doLast {
        val out = File(folder.get())
        out.mkdirs()
        File(out, "compose.txt").writeText(compose.files.joinToString(":") { it.absolutePath })
        File(out, "plugin.txt").writeText(plugin.files.joinToString(":") { it.absolutePath })
        File(out, "compiler.txt").writeText(compiler.files.joinToString(":") { it.absolutePath })
        logger.lifecycle("wrote the Compose classpath, the Compose compiler plugin and the Kotlin compiler to $out")
    }
}
