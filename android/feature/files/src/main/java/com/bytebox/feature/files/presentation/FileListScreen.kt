package com.bytebox.feature.files.presentation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
    onNavigateToUpload: () -> Unit,
    onNavigateToSearch: () -> Unit,
    viewModel: FileListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showSortMenu by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }
    var contextMenuFileId by remember { mutableStateOf<String?>(null) }
    var contextMenuFolderId by remember { mutableStateOf<String?>(null) }

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
                    FloatingActionButton(onClick = onNavigateToUpload) {
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
}
