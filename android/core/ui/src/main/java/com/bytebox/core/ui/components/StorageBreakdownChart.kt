package com.bytebox.core.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.theme.ByteBoxTheme

data class StorageSegment(
    val label: String,
    val bytes: Long,
    val color: Color,
)

@Composable
fun StorageBreakdownChart(
    segments: List<StorageSegment>,
    totalBytes: Long,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.sm),
    ) {
        // Stacked bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(12.dp)
                .clip(RoundedCornerShape(ByteBoxTheme.radius.full))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Row(modifier = Modifier.matchParentSize()) {
                segments.forEach { segment ->
                    val fraction = if (totalBytes > 0) {
                        (segment.bytes.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
                    } else 0f

                    var target by remember { mutableFloatStateOf(0f) }
                    LaunchedEffect(fraction) { target = fraction }
                    val animatedFraction by animateFloatAsState(
                        targetValue = target,
                        animationSpec = tween(800),
                        label = "segment_${segment.label}",
                    )

                    if (animatedFraction > 0f) {
                        Box(
                            modifier = Modifier
                                .weight(animatedFraction.coerceAtLeast(0.001f))
                                .fillMaxHeight()
                                .background(segment.color)
                        )
                    }
                }
            }
        }

        // Legend
        segments.forEach { segment ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(segment.color)
                )
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                Text(
                    text = segment.label,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = segment.bytes.toReadableFileSize(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
