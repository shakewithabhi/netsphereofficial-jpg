package com.bytebox.feature.files.presentation.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.OfflinePin
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.components.toColor
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileItem

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileListItem(
    file: FileItem,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onMoreClick: () -> Unit,
    onStarClick: (() -> Unit)? = null,
    isPinned: Boolean = false,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onLongClick()
                },
            )
            .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Leading: Colored icon container or thumbnail
        Box(modifier = Modifier.size(44.dp), contentAlignment = Alignment.Center) {
            if (file.thumbnailUrl != null && file.category == FileCategory.IMAGE) {
                AsyncImage(
                    model = file.thumbnailUrl,
                    contentDescription = file.name,
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(ByteBoxTheme.radius.sm)),
                    contentScale = ContentScale.Crop,
                )
            } else {
                FileTypeIcon(category = file.category)
            }

            // Selection badge overlay
            if (isSelected) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = "Selected",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(18.dp)
                        .background(
                            color = MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                        ),
                )
            }
        }

        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))

        // Content
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = file.name,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = "${file.size.toReadableFileSize()}  ·  ${file.createdAt.toLocalDateTime().toRelativeTime()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }

        // Trailing: Offline pin indicator
        if (isPinned) {
            Icon(
                imageVector = Icons.Filled.OfflinePin,
                contentDescription = "Available offline",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
        }

        // Trailing: Star button
        if (onStarClick != null) {
            IconButton(onClick = onStarClick) {
                Icon(
                    imageVector = if (file.isStarred) Icons.Filled.Star else Icons.Outlined.StarBorder,
                    contentDescription = if (file.isStarred) "Unstar" else "Star",
                    tint = if (file.isStarred) Color(0xFFFFC107) else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Trailing: More button
        IconButton(onClick = onMoreClick) {
            Icon(
                Icons.Default.MoreVert,
                contentDescription = "More options",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
