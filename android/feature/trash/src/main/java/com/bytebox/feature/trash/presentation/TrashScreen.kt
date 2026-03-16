package com.bytebox.feature.trash.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.LoadingIndicator
import com.bytebox.domain.model.FileItem
import com.bytebox.feature.files.presentation.components.toColor
import com.bytebox.feature.files.presentation.components.toIcon

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
                title = { Text("Trash") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        when {
            uiState.isLoading -> LoadingIndicator(modifier = Modifier.padding(padding))
            uiState.errorMessage != null -> ErrorState(
                message = uiState.errorMessage!!,
                onRetry = viewModel::loadTrash,
                modifier = Modifier.padding(padding)
            )
            uiState.files.isEmpty() && uiState.folders.isEmpty() -> EmptyState(
                icon = Icons.Default.DeleteSweep,
                title = "Trash is empty",
                subtitle = "Deleted files will appear here for 30 days",
                modifier = Modifier.padding(padding)
            )
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    items(uiState.folders, key = { "folder_${it.id}" }) { folder ->
                        ListItem(
                            headlineContent = { Text(folder.name) },
                            leadingContent = {
                                Icon(Icons.Default.Folder, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            },
                            trailingContent = {
                                IconButton(onClick = { viewModel.restoreFolder(folder.id) }) {
                                    Icon(Icons.Default.RestoreFromTrash, "Restore")
                                }
                            }
                        )
                    }
                    items(uiState.files, key = { "file_${it.id}" }) { file ->
                        TrashFileItem(
                            file = file,
                            onRestore = { viewModel.restoreFile(file.id) },
                            onDelete = { deleteConfirmFileId = file.id }
                        )
                    }
                }
            }
        }
    }

    // Permanent delete confirmation
    deleteConfirmFileId?.let { fileId ->
        AlertDialog(
            onDismissRequest = { deleteConfirmFileId = null },
            title = { Text("Delete permanently?") },
            text = { Text("This file will be permanently deleted and cannot be recovered.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.permanentDeleteFile(fileId)
                    deleteConfirmFileId = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirmFileId = null }) { Text("Cancel") }
            }
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
        headlineContent = { Text(file.name, maxLines = 1) },
        supportingContent = {
            Text(
                file.size.toReadableFileSize(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        leadingContent = {
            Icon(
                file.category.toIcon(),
                null,
                tint = file.category.toColor().copy(alpha = 0.6f)
            )
        },
        trailingContent = {
            Row {
                IconButton(onClick = onRestore) {
                    Icon(Icons.Default.RestoreFromTrash, "Restore")
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.DeleteForever, "Delete permanently", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    )
}
