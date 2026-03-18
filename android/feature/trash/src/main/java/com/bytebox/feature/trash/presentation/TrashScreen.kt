package com.bytebox.feature.trash.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrashScreen(
    onNavigateBack: () -> Unit,
    viewModel: TrashViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var deleteConfirmFileId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Trash",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        when {
            uiState.isLoading -> {
                FileListShimmer(
                    modifier = Modifier
                        .padding(padding)
                        .padding(top = ByteBoxTheme.spacing.xs),
                )
            }
            uiState.errorMessage != null -> {
                ErrorState(
                    message = uiState.errorMessage!!,
                    onRetry = viewModel::loadTrash,
                    modifier = Modifier.padding(padding),
                )
            }
            uiState.files.isEmpty() && uiState.folders.isEmpty() -> {
                EmptyState(
                    icon = Icons.Default.DeleteSweep,
                    title = "Trash is empty",
                    subtitle = "Deleted files will appear here for 30 days",
                    modifier = Modifier.padding(padding),
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                ) {
                    items(uiState.folders, key = { "folder_${it.id}" }) { folder ->
                        ListItem(
                            headlineContent = { Text(folder.name) },
                            leadingContent = {
                                Icon(
                                    Icons.Default.Folder,
                                    contentDescription = "Folder",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            },
                            trailingContent = {
                                IconButton(onClick = { viewModel.restoreFolder(folder.id) }) {
                                    Icon(Icons.Default.RestoreFromTrash, contentDescription = "Restore folder")
                                }
                            },
                        )
                    }
                    items(uiState.files, key = { "file_${it.id}" }) { file ->
                        TrashFileItem(
                            file = file,
                            onRestore = { viewModel.restoreFile(file.id) },
                            onDelete = { deleteConfirmFileId = file.id },
                            onPreview = { viewModel.loadPreview(file.id, file.name) },
                        )
                    }
                }
            }
        }
    }

    deleteConfirmFileId?.let { fileId ->
        ConfirmationDialog(
            title = "Delete permanently?",
            message = "This file will be permanently deleted and cannot be recovered.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                viewModel.permanentDeleteFile(fileId)
                deleteConfirmFileId = null
            },
            onDismiss = { deleteConfirmFileId = null },
        )
    }

    // Full image preview dialog
    uiState.previewUrl?.let { url ->
        Dialog(
            onDismissRequest = viewModel::dismissPreview,
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(onClick = viewModel::dismissPreview),
                contentAlignment = Alignment.Center,
            ) {
                AsyncImage(
                    model = url,
                    contentDescription = uiState.previewFileName ?: "Preview",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(ByteBoxTheme.spacing.md),
                    contentScale = ContentScale.Fit,
                )
                IconButton(
                    onClick = viewModel::dismissPreview,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(ByteBoxTheme.spacing.md),
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close preview",
                        tint = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun TrashFileItem(
    file: FileItem,
    onRestore: () -> Unit,
    onDelete: () -> Unit,
    onPreview: () -> Unit
) {
    val isImage = file.mimeType.startsWith("image/")

    ListItem(
        headlineContent = {
            Text(
                file.name,
                maxLines = 1,
                style = MaterialTheme.typography.titleSmall,
            )
        },
        supportingContent = {
            Column {
                Text(
                    file.size.toReadableFileSize(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                file.trashedAt?.let { trashedAt ->
                    Text(
                        "Trashed ${trashedAt.toLocalDateTime().toRelativeTime()}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        leadingContent = {
            Box(modifier = Modifier.size(44.dp), contentAlignment = Alignment.Center) {
                if (isImage && file.thumbnailUrl != null) {
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
            }
        },
        trailingContent = {
            Row {
                if (isImage) {
                    IconButton(onClick = onPreview) {
                        Icon(
                            Icons.Default.Visibility,
                            contentDescription = "Preview",
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                IconButton(onClick = onRestore) {
                    Icon(Icons.Default.RestoreFromTrash, contentDescription = "Restore file")
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.DeleteForever,
                        contentDescription = "Delete permanently",
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
    )
}
