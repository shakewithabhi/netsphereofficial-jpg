package com.bytebox.core.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bytebox.core.common.FileCategory
import com.bytebox.core.ui.R

@DrawableRes
fun FileCategory.toFlatIconRes(): Int = when (this) {
    FileCategory.IMAGE -> R.drawable.ic_flat_file_image
    FileCategory.VIDEO -> R.drawable.ic_flat_file_video
    FileCategory.AUDIO -> R.drawable.ic_flat_file_audio
    FileCategory.PDF -> R.drawable.ic_flat_file_pdf
    FileCategory.TEXT_DOCUMENT,
    FileCategory.OFFICE_DOCUMENT,
    FileCategory.DOCUMENT -> R.drawable.ic_flat_file_doc
    FileCategory.OTHER -> R.drawable.ic_flat_file_other
}

@Composable
fun FileTypeIcon(
    category: FileCategory,
    modifier: Modifier = Modifier,
    containerSize: Dp = 48.dp,
    iconSize: Dp = 48.dp,
) {
    Icon(
        painter = painterResource(category.toFlatIconRes()),
        contentDescription = category.name,
        modifier = modifier.size(containerSize),
        tint = Color.Unspecified,
    )
}
