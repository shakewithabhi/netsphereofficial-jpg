package com.bytebox.core.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class DonutSegment(
    val label: String,
    val value: Float,
    val color: Color,
)

@Composable
fun DonutChart(
    segments: List<DonutSegment>,
    modifier: Modifier = Modifier,
    size: Dp = 200.dp,
    strokeWidth: Dp = 24.dp,
    gapAngle: Float = 3f,
    centerContent: @Composable () -> Unit = {},
) {
    val total = segments.sumOf { it.value.toDouble() }.toFloat()

    var animationProgress by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(segments) { animationProgress = 1f }
    val animatedProgress by animateFloatAsState(
        targetValue = animationProgress,
        animationSpec = tween(durationMillis = 1000),
        label = "donut_progress",
    )

    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val canvasSize = this.size.minDimension
            val stroke = strokeWidth.toPx()
            val arcSize = canvasSize - stroke
            val topLeft = Offset(stroke / 2, stroke / 2)
            val drawSize = Size(arcSize, arcSize)

            if (total <= 0f) {
                // Draw empty ring
                drawArc(
                    color = Color(0xFFE2E8F0),
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = drawSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
                return@Canvas
            }

            val totalGap = gapAngle * segments.size
            val availableAngle = 360f - totalGap

            var startAngle = -90f
            segments.forEach { segment ->
                val sweep = (segment.value / total) * availableAngle * animatedProgress
                if (sweep > 0f) {
                    drawArc(
                        color = segment.color,
                        startAngle = startAngle,
                        sweepAngle = sweep,
                        useCenter = false,
                        topLeft = topLeft,
                        size = drawSize,
                        style = Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                }
                startAngle += sweep + gapAngle
            }
        }

        centerContent()
    }
}
