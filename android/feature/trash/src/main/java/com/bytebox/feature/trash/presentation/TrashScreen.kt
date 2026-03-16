package com.bytebox.feature.trash.presentation

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.components.toColor
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
}

@Composable
private fun TrashFileItem(
    file: FileItem,
    onRestore: () -> Unit,
    onDelete: () -> Unit
) {
    ListItem(
        headlineContent = {
            Text(
                file.name,
                maxLines = 1,
                style = MaterialTheme.typography.titleSmall,
            )
        },
        supportingContent = {
            Text(
                file.size.toReadableFileSize(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        leadingContent = {
            FileTypeIcon(category = file.category)
        },
        trailingContent = {
            Row {
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
