package com.bytebox.core.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val SoftShadowColor = Color(0x0D000000)

fun Modifier.softShadow(
    elevation: Dp = 6.dp,
    shape: Shape = RoundedCornerShape(20.dp),
    color: Color = SoftShadowColor,
): Modifier = this.shadow(
    elevation = elevation,
    shape = shape,
    ambientColor = color,
    spotColor = color,
)

fun Modifier.cardShadow(
    shape: Shape = RoundedCornerShape(20.dp),
): Modifier = softShadow(
    elevation = 8.dp,
    shape = shape,
    color = Color(0x0A000000),
)

fun Modifier.elevatedShadow(
    shape: Shape = RoundedCornerShape(20.dp),
): Modifier = softShadow(
    elevation = 16.dp,
    shape = shape,
    color = Color(0x14000000),
)
