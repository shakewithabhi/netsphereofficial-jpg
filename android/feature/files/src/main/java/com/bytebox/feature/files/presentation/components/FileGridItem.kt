package com.bytebox.feature.files.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileItem

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileGridItem(
    file: FileItem,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    Card(
        modifier = modifier
            .combinedClickable(
                onClick = onClick,
                onLongClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onLongClick()
                },
            ),
        shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
        border = if (isSelected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null,
        elevation = CardDefaults.cardElevation(
            defaultElevation = ByteBoxTheme.elevation.xs,
        ),
    ) {
        Column(
            modifier = Modifier.padding(ByteBoxTheme.spacing.xs),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Preview area - 4:3 aspect ratio
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(ByteBoxTheme.radius.sm)),
                contentAlignment = Alignment.Center,
            ) {
                if (file.thumbnailUrl != null && (file.category == FileCategory.IMAGE || file.category == FileCategory.VIDEO)) {
                    SubcomposeAsyncImage(
                        model = file.thumbnailUrl,
                        contentDescription = file.name,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(ByteBoxTheme.radius.sm)),
                        contentScale = ContentScale.Crop,
                        error = {
                            FileTypeIcon(
                                category = file.category,
                                containerSize = 56.dp,
                                iconSize = 28.dp,
                            )
                        },
                    )
                } else {
                    FileTypeIcon(
                        category = file.category,
                        containerSize = 56.dp,
                        iconSize = 28.dp,
                    )
                }

                // Selection badge
                if (isSelected) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = "Selected",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .size(22.dp)
                            .background(
                                color = MaterialTheme.colorScheme.surface,
                                shape = RoundedCornerShape(11.dp),
                            ),
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            Text(
                text = file.name,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            Text(
                text = file.size.toReadableFileSize(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
