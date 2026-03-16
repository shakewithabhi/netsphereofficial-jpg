package com.bytebox.feature.files.presentation.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.theme.*
import com.bytebox.domain.model.FileItem

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileListItem(
    file: FileItem,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ListItem(
        modifier = modifier.combinedClickable(
            onClick = onClick,
            onLongClick = onLongClick
        ),
        leadingContent = {
            Box(modifier = Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                if (isSelected) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = "Selected",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(40.dp)
                    )
                } else if (file.thumbnailUrl != null && file.category == FileCategory.IMAGE) {
                    AsyncImage(
                        model = file.thumbnailUrl,
                        contentDescription = file.name,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(MaterialTheme.shapes.small),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = file.category.toIcon(),
                        contentDescription = null,
                        tint = file.category.toColor(),
                        modifier = Modifier.size(40.dp)
                    )
                }
            }
        },
        headlineContent = {
            Text(
                text = file.name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        supportingContent = {
            Text(
                text = "${file.size.toReadableFileSize()} · ${file.createdAt.toLocalDateTime().toRelativeTime()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingContent = {
            IconButton(onClick = onMoreClick) {
                Icon(Icons.Default.MoreVert, contentDescription = "More options")
            }
        }
    )
}

fun FileCategory.toIcon() = when (this) {
    FileCategory.IMAGE -> Icons.Default.Image
    FileCategory.VIDEO -> Icons.Default.VideoFile
    FileCategory.AUDIO -> Icons.Default.AudioFile
    FileCategory.PDF -> Icons.Default.PictureAsPdf
    FileCategory.DOCUMENT -> Icons.Default.Description
    FileCategory.OTHER -> Icons.Default.InsertDriveFile
}

fun FileCategory.toColor() = when (this) {
    FileCategory.IMAGE -> FileImageColor
    FileCategory.VIDEO -> FileVideoColor
    FileCategory.AUDIO -> FileAudioColor
    FileCategory.PDF -> FilePdfColor
    FileCategory.DOCUMENT -> FileDocColor
    FileCategory.OTHER -> FileOtherColor
}
