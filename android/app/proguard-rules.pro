# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * { @retrofit2.http.* <methods>; }

# Moshi
-keep class com.bytebox.**.dto.** { *; }
-keepclassmembers class * { @com.squareup.moshi.Json <fields>; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
