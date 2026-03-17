package com.bytebox.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.cardShadow
import com.bytebox.core.ui.theme.getFolderColors

@Composable
fun ColoredFolderCard(
    name: String,
    index: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    val colors = getFolderColors(index)

    Surface(
        modifier = modifier
            .width(140.dp)
            .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg))
            .clip(RoundedCornerShape(ByteBoxTheme.radius.lg))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column {
            // Colored top stripe
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(colors.accent)
            )

            Column(
                modifier = Modifier.padding(ByteBoxTheme.spacing.md),
                horizontalAlignment = Alignment.Start,
            ) {
                // Folder icon in tinted container
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(
                            color = colors.background,
                            shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.Folder,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = colors.accent,
                    )
                }

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                Text(
                    text = name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )

                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
