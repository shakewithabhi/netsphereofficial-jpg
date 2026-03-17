package com.bytebox.core.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class ByteBoxRadius(
    val none: Dp = 0.dp,
    val xs: Dp = 6.dp,
    val sm: Dp = 10.dp,
    val md: Dp = 16.dp,
    val lg: Dp = 20.dp,
    val xl: Dp = 24.dp,
    val xxl: Dp = 28.dp,
    val full: Dp = 9999.dp,
)

val LocalByteBoxRadius = staticCompositionLocalOf { ByteBoxRadius() }
