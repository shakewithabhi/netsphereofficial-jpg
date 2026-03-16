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
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = Indigo600,
    onPrimary = Zinc50,
    primaryContainer = Indigo100,
    onPrimaryContainer = Indigo900,
    secondary = Slate600,
    onSecondary = Zinc50,
    secondaryContainer = Slate100,
    onSecondaryContainer = Slate900,
    tertiary = Indigo500,
    onTertiary = Zinc50,
    error = Red600,
    onError = Zinc50,
    errorContainer = Red50,
    onErrorContainer = Red900,
    background = Zinc50,
    onBackground = Zinc900,
    surface = Zinc50,
    onSurface = Zinc900,
    surfaceVariant = Zinc100,
    onSurfaceVariant = Zinc600,
    outline = Zinc300,
    outlineVariant = Zinc200,
    inverseSurface = Zinc900,
    inverseOnSurface = Zinc100,
    surfaceTint = Indigo600,
)

private val DarkColorScheme = darkColorScheme(
    primary = Indigo400,
    onPrimary = Indigo950,
    primaryContainer = Indigo900,
    onPrimaryContainer = Indigo100,
    secondary = Slate400,
    onSecondary = Slate900,
    secondaryContainer = Slate800,
    onSecondaryContainer = Slate100,
    tertiary = Indigo300,
    onTertiary = Indigo950,
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
    surfaceTint = Indigo400,
)

@Composable
fun ByteBoxTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
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
