package com.bytebox.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bytebox.core.common.FileCategory
import com.bytebox.core.ui.theme.FileAudioColor
import com.bytebox.core.ui.theme.FileDocColor
import com.bytebox.core.ui.theme.FileImageColor
import com.bytebox.core.ui.theme.FileOtherColor
import com.bytebox.core.ui.theme.FilePdfColor
import com.bytebox.core.ui.theme.FileVideoColor

fun FileCategory.toColor(): Color = when (this) {
    FileCategory.IMAGE -> FileImageColor
    FileCategory.VIDEO -> FileVideoColor
    FileCategory.AUDIO -> FileAudioColor
    FileCategory.PDF -> FilePdfColor
    FileCategory.DOCUMENT -> FileDocColor
    FileCategory.OTHER -> FileOtherColor
}

fun FileCategory.toIcon(): ImageVector = when (this) {
    FileCategory.IMAGE -> Icons.Default.Image
    FileCategory.VIDEO -> Icons.Default.VideoFile
    FileCategory.AUDIO -> Icons.Default.AudioFile
    FileCategory.PDF -> Icons.Default.PictureAsPdf
    FileCategory.DOCUMENT -> Icons.Default.Description
    FileCategory.OTHER -> Icons.Default.InsertDriveFile
}

@Composable
fun FileTypeIcon(
    category: FileCategory,
    modifier: Modifier = Modifier,
    containerSize: Dp = 44.dp,
    iconSize: Dp = 24.dp,
) {
    val color = category.toColor()
    val icon = category.toIcon()

    Box(
        modifier = modifier
            .size(containerSize)
            .background(
                color = color.copy(alpha = 0.12f),
                shape = RoundedCornerShape(10.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = category.name,
            modifier = Modifier.size(iconSize),
            tint = color,
        )
    }
}
