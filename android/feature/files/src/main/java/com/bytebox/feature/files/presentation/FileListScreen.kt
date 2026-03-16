package com.bytebox.feature.files.presentation

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.bytebox.core.common.toReadableFileSize
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.datastore.ViewMode
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.LoadingIndicator
import com.bytebox.feature.files.presentation.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileListScreen(
    onFileClick: (String, String) -> Unit,
    onNavigateToUpload: (folderId: String?) -> Unit,
    onNavigateToSearch: () -> Unit,
    viewModel: FileListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Reload contents when screen becomes visible (e.g., returning from Upload)
    LifecycleResumeEffect(Unit) {
        viewModel.loadContents()
        onPauseOrDispose {}
    }

    var showSortMenu by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }
    var contextMenuFileId by remember { mutableStateOf<String?>(null) }
    var contextMenuFolderId by remember { mutableStateOf<String?>(null) }
    var showRenameFolderDialog by remember { mutableStateOf(false) }
    var renameFolderId by remember { mutableStateOf("") }
    var renameFolderName by remember { mutableStateOf("") }

    BackHandler(enabled = uiState.breadcrumbs.size > 1 || uiState.isSelectionMode) {
        if (uiState.isSelectionMode) {
            viewModel.clearSelection()
        } else {
            viewModel.navigateBack()
        }
    }

    Scaffold(
        topBar = {
            if (uiState.isSelectionMode) {
                TopAppBar(
                    title = { Text("${uiState.selectedItems.size} selected") },
                    navigationIcon = {
                        IconButton(onClick = viewModel::clearSelection) {
                            Icon(Icons.Default.Close, contentDescription = "Clear selection")
                        }
                    },
                    actions = {
                        IconButton(onClick = {
                            uiState.selectedItems.forEach { id ->
                                if (uiState.files.any { it.id == id }) viewModel.trashFile(id)
                                if (uiState.folders.any { it.id == id }) viewModel.trashFolder(id)
                            }
                            viewModel.clearSelection()
                        }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete selected")
                        }
                    }
                )
            } else {
                TopAppBar(
                    title = { Text(uiState.currentFolderName) },
                    actions = {
                        IconButton(onClick = onNavigateToSearch) {
                            Icon(Icons.Default.Search, contentDescription = "Search")
                        }
                        IconButton(onClick = viewModel::toggleViewMode) {
                            Icon(
                                if (uiState.viewMode == ViewMode.LIST) Icons.Default.GridView else Icons.Default.ViewList,
                                contentDescription = "Toggle view"
                            )
                        }
                        Box {
                            IconButton(onClick = { showSortMenu = true }) {
                                Icon(Icons.Default.Sort, contentDescription = "Sort")
                            }
                            DropdownMenu(expanded = showSortMenu, onDismissRequest = { showSortMenu = false }) {
                                com.bytebox.core.datastore.SortBy.entries.forEach { sort ->
                                    DropdownMenuItem(
                                        text = { Text(sort.name.lowercase().replaceFirstChar { it.uppercase() }) },
                                        onClick = {
                                            viewModel.setSortBy(sort)
                                            showSortMenu = false
                                        },
                                        leadingIcon = {
                                            if (uiState.sortBy == sort) {
                                                Icon(Icons.Default.Check, contentDescription = null)
                                            }
                                        }
                                    )
                                }
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text(if (uiState.sortOrder == com.bytebox.core.datastore.SortOrder.ASC) "Ascending" else "Descending") },
                                    onClick = {
                                        viewModel.toggleSortOrder()
                                        showSortMenu = false
                                    },
                                    leadingIcon = {
                                        Icon(
                                            if (uiState.sortOrder == com.bytebox.core.datastore.SortOrder.ASC) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                        }
                    }
                )
            }
        },
        floatingActionButton = {
            if (!uiState.isSelectionMode) {
                Column {
                    SmallFloatingActionButton(
                        onClick = viewModel::showCreateFolderDialog,
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    ) {
                        Icon(Icons.Default.CreateNewFolder, contentDescription = "New folder")
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    FloatingActionButton(onClick = { onNavigateToUpload(uiState.currentFolderId) }) {
                        Icon(Icons.Default.CloudUpload, contentDescription = "Upload")
                    }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            if (uiState.breadcrumbs.size > 1) {
                FolderBreadcrumb(
                    breadcrumbs = uiState.breadcrumbs,
                    onItemClick = viewModel::navigateToBreadcrumb
                )
            }

            when {
                uiState.isLoading -> LoadingIndicator()
                uiState.errorMessage != null -> ErrorState(
                    message = uiState.errorMessage!!,
                    onRetry = viewModel::loadContents
                )
                uiState.files.isEmpty() && uiState.folders.isEmpty() -> EmptyState(
                    icon = Icons.Default.FolderOpen,
                    title = "This folder is empty",
                    subtitle = "Upload files or create folders to get started"
                )
                uiState.viewMode == ViewMode.LIST -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(uiState.folders, key = { it.id }) { folder ->
                            FolderItem(
                                folder = folder,
                                isSelected = uiState.selectedItems.contains(folder.id),
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(folder.id)
                                    else viewModel.navigateToFolder(folder)
                                },
                                onLongClick = { viewModel.toggleSelection(folder.id) },
                                onMoreClick = { contextMenuFolderId = folder.id }
                            )
                        }
                        items(uiState.files, key = { it.id }) { file ->
                            FileListItem(
                                file = file,
                                isSelected = uiState.selectedItems.contains(file.id),
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(file.id)
                                    else onFileClick(file.id, file.mimeType)
                                },
                                onLongClick = { viewModel.toggleSelection(file.id) },
                                onMoreClick = { contextMenuFileId = file.id }
                            )
                        }
                        if (uiState.isLoadingMore) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                }
                            }
                        }
                    }
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 120.dp),
                        contentPadding = PaddingValues(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(uiState.files, key = { it.id }) { file ->
                            FileGridItem(
                                file = file,
                                isSelected = uiState.selectedItems.contains(file.id),
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(file.id)
                                    else onFileClick(file.id, file.mimeType)
                                },
                                onLongClick = { viewModel.toggleSelection(file.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Create folder dialog
    if (uiState.showCreateFolderDialog) {
        AlertDialog(
            onDismissRequest = viewModel::hideCreateFolderDialog,
            title = { Text("New Folder") },
            text = {
                OutlinedTextField(
                    value = newFolderName,
                    onValueChange = { newFolderName = it },
                    label = { Text("Folder name") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.createFolder(newFolderName)
                        newFolderName = ""
                    },
                    enabled = newFolderName.isNotBlank()
                ) { Text("Create") }
            },
            dismissButton = {
                TextButton(onClick = {
                    viewModel.hideCreateFolderDialog()
                    newFolderName = ""
                }) { Text("Cancel") }
            }
        )
    }

    // Rename folder dialog
    if (showRenameFolderDialog) {
        AlertDialog(
            onDismissRequest = { showRenameFolderDialog = false },
            title = { Text("Rename Folder") },
            text = {
                OutlinedTextField(
                    value = renameFolderName,
                    onValueChange = { renameFolderName = it },
                    label = { Text("Folder name") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.renameFolder(renameFolderId, renameFolderName)
                        showRenameFolderDialog = false
                    },
                    enabled = renameFolderName.isNotBlank()
                ) { Text("Rename") }
            },
            dismissButton = {
                TextButton(onClick = { showRenameFolderDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Folder context menu
    contextMenuFolderId?.let { folderId ->
        val folder = uiState.folders.find { it.id == folderId }
        if (folder != null) {
            AlertDialog(
                onDismissRequest = { contextMenuFolderId = null },
                title = { Text(folder.name, maxLines = 1) },
                text = {
                    Column {
                        ListItem(
                            headlineContent = { Text("Share") },
                            leadingContent = { Icon(Icons.Default.Share, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                viewModel.shareFolder(folderId)
                            }
                        )
                        ListItem(
                            headlineContent = { Text("Rename") },
                            leadingContent = { Icon(Icons.Default.Edit, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                renameFolderId = folderId
                                renameFolderName = folder.name
                                showRenameFolderDialog = true
                            }
                        )
                        ListItem(
                            headlineContent = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                            leadingContent = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                viewModel.trashFolder(folderId)
                            }
                        )
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(onClick = { contextMenuFolderId = null }) { Text("Cancel") }
                }
            )
        }
    }

    // File context menu
    contextMenuFileId?.let { fileId ->
        val file = uiState.files.find { it.id == fileId }
        if (file != null) {
            AlertDialog(
                onDismissRequest = { contextMenuFileId = null },
                title = { Text(file.name, maxLines = 1) },
                text = {
                    Column {
                        ListItem(
                            headlineContent = { Text("Share") },
                            leadingContent = { Icon(Icons.Default.Share, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFileId = null
                                viewModel.shareFile(fileId)
                            }
                        )
                        ListItem(
                            headlineContent = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                            leadingContent = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            modifier = Modifier.clickable {
                                contextMenuFileId = null
                                viewModel.trashFile(fileId)
                            }
                        )
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(onClick = { contextMenuFileId = null }) { Text("Cancel") }
                }
            )
        }
    }

    // Share card dialog (TeraBox-style)
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    uiState.shareUrl?.let { shareUrl ->
        Dialog(onDismissRequest = { viewModel.clearShareUrl() }) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header with close button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Share Link",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { viewModel.clearShareUrl() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close")
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // File/Folder icon
                    Surface(
                        modifier = Modifier.size(72.dp),
                        shape = RoundedCornerShape(16.dp),
                        color = if (uiState.shareItemIsFolder)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            MaterialTheme.colorScheme.secondaryContainer
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = when {
                                    uiState.shareItemIsFolder -> Icons.Default.Folder
                                    uiState.shareItemMimeType?.startsWith("image/") == true -> Icons.Default.Image
                                    uiState.shareItemMimeType?.startsWith("video/") == true -> Icons.Default.Videocam
                                    uiState.shareItemMimeType?.startsWith("audio/") == true -> Icons.Default.MusicNote
                                    uiState.shareItemMimeType == "application/pdf" -> Icons.Default.PictureAsPdf
                                    else -> Icons.Default.Description
                                },
                                contentDescription = null,
                                modifier = Modifier.size(36.dp),
                                tint = if (uiState.shareItemIsFolder)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.secondary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // File name
                    Text(
                        text = uiState.shareItemName ?: "File",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )

                    // File size
                    if (!uiState.shareItemIsFolder && uiState.shareItemSize > 0) {
                        Text(
                            text = uiState.shareItemSize.toReadableFileSize(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Link container
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Link,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = shareUrl,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Copy Link button
                    Button(
                        onClick = {
                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(shareUrl))
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Copy Link", fontWeight = FontWeight.SemiBold)
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Share via button
                    OutlinedButton(
                        onClick = {
                            val sendIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(Intent.EXTRA_TEXT, "Check out this file on ByteBox: $shareUrl")
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Share via"))
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Share via...", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    // Share loading indicator
    if (uiState.isCreatingShare) {
        Dialog(onDismissRequest = {}) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(24.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("Creating share link...")
                }
            }
        }
    }
}
