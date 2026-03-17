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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.Green500
import com.bytebox.core.ui.theme.Amber500
import com.bytebox.core.ui.theme.Red500
import com.bytebox.core.ui.theme.Blue500
import com.bytebox.core.ui.theme.Blue400

@Composable
fun StorageIndicator(
    used: Long,
    total: Long,
    modifier: Modifier = Modifier
) {
    val targetProgress = if (total > 0) (used.toFloat() / total.toFloat()).coerceIn(0f, 1f) else 0f

    var animatedTarget by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(targetProgress) {
        animatedTarget = targetProgress
    }

    val animatedProgress by animateFloatAsState(
        targetValue = animatedTarget,
        animationSpec = tween(durationMillis = 800),
        label = "storage_progress",
    )

    val progressBrush = when {
        targetProgress > 0.9f -> Brush.horizontalGradient(listOf(Red500, Red500))
        targetProgress > 0.75f -> Brush.horizontalGradient(listOf(Amber500, Amber500))
        else -> Brush.horizontalGradient(listOf(Blue500, Blue400))
    }

    val percentText = "${(targetProgress * 100).toInt()}%"

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "${used.toReadableFileSize()} of ${total.toReadableFileSize()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = percentText,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(ByteBoxTheme.radius.full))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction = animatedProgress)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(ByteBoxTheme.radius.full))
                    .background(progressBrush)
            )
        }
    }
}
