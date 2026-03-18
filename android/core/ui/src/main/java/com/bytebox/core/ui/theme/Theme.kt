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
    primary = AppleBlack,
    onPrimary = Color.White,
    primaryContainer = AppleGray6,
    onPrimaryContainer = AppleBlack,
    secondary = Color(0xFF3C3C43),
    onSecondary = Color.White,
    secondaryContainer = AppleGray5,
    onSecondaryContainer = AppleBlack,
    tertiary = AppleGreen,
    onTertiary = Color.White,
    error = AppleRed,
    onError = Color.White,
    errorContainer = Color(0xFFFFE5E3),
    onErrorContainer = Color(0xFF7F0000),
    background = AppleGray6,
    onBackground = AppleBlack,
    surface = Color.White,
    onSurface = AppleBlack,
    surfaceVariant = AppleGray5,
    onSurfaceVariant = AppleGray1,
    outline = AppleSeparator,
    outlineVariant = AppleGray5,
    inverseSurface = Color(0xFF1C1C1E),
    inverseOnSurface = Color.White,
    surfaceTint = AppleBlack,
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
