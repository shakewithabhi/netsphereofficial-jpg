package com.bytebox.core.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = Blue500,
    onPrimary = Color.White,
    primaryContainer = Blue100,
    onPrimaryContainer = Blue900,
    secondary = Slate600,
    onSecondary = Color.White,
    secondaryContainer = Slate100,
    onSecondaryContainer = Slate900,
    tertiary = Blue400,
    onTertiary = Color.White,
    error = Red600,
    onError = Color.White,
    errorContainer = Red50,
    onErrorContainer = Red900,
    background = Slate50,
    onBackground = Slate900,
    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate500,
    outline = Slate300,
    outlineVariant = Slate200,
    inverseSurface = Slate900,
    inverseOnSurface = Slate100,
    surfaceTint = Blue500,
)

private val DarkColorScheme = darkColorScheme(
    primary = Blue400,
    onPrimary = Blue950,
    primaryContainer = Blue900,
    onPrimaryContainer = Blue100,
    secondary = Slate400,
    onSecondary = Slate900,
    secondaryContainer = Slate800,
    onSecondaryContainer = Slate100,
    tertiary = Blue300,
    onTertiary = Blue950,
    error = Red400,
    onError = Red950,
    errorContainer = Red950,
    onErrorContainer = Red100,
    background = Zinc950,
    onBackground = Zinc100,
    surface = Zinc900,
    onSurface = Zinc100,
    surfaceVariant = Zinc800,
    onSurfaceVariant = Zinc400,
    outline = Zinc700,
    outlineVariant = Zinc800,
    inverseSurface = Zinc100,
    inverseOnSurface = Zinc900,
    surfaceTint = Blue400,
)

@Composable
fun ByteBoxTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    CompositionLocalProvider(
        LocalByteBoxSpacing provides ByteBoxSpacing(),
        LocalByteBoxRadius provides ByteBoxRadius(),
        LocalByteBoxElevation provides ByteBoxElevation(),
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ByteBoxTypography,
            content = content
        )
    }
}

object ByteBoxTheme {
    val spacing: ByteBoxSpacing
        @Composable
        @ReadOnlyComposable
        get() = LocalByteBoxSpacing.current

    val radius: ByteBoxRadius
        @Composable
        @ReadOnlyComposable
        get() = LocalByteBoxRadius.current

    val elevation: ByteBoxElevation
        @Composable
        @ReadOnlyComposable
        get() = LocalByteBoxElevation.current
}
