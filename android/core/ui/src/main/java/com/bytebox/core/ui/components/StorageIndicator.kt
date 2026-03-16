package com.bytebox.core.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bytebox.core.common.toReadableFileSize

@Composable
fun StorageIndicator(
    used: Long,
    total: Long,
    modifier: Modifier = Modifier
) {
    val progress = if (total > 0) (used.toFloat() / total.toFloat()).coerceIn(0f, 1f) else 0f
    val progressColor = when {
        progress > 0.9f -> MaterialTheme.colorScheme.error
        progress > 0.75f -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "${used.toReadableFileSize()} used",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "${total.toReadableFileSize()} total",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp),
            color = progressColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}
