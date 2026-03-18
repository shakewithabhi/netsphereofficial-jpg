package com.bytebox.feature.files.presentation

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.OfflinePin
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.bytebox.core.common.toReadableFileSize
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.datastore.ViewMode
import com.bytebox.core.common.AdManager
import com.bytebox.core.ui.components.BannerAd
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.SectionHeader
import com.bytebox.core.ui.components.SpeedDialFAB
import com.bytebox.core.ui.components.SpeedDialItem
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.feature.files.presentation.components.FileGridItem
import com.bytebox.feature.files.presentation.components.FileListItem
import com.bytebox.feature.files.presentation.components.FolderBreadcrumb
import com.bytebox.feature.files.presentation.components.FolderItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileListScreen(
    onFileClick: (String, String) -> Unit,
    onNavigateToUpload: (folderId: String?) -> Unit,
    onNavigateToSearch: () -> Unit,
    onNavigateToTrash: () -> Unit = {},
    viewModel: FileListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

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
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleteTargetId by remember { mutableStateOf("") }
    var deleteTargetName by remember { mutableStateOf("") }
    var deleteTargetIsFolder by remember { mutableStateOf(false) }
    var showDeleteSelectedConfirm by remember { mutableStateOf(false) }
    var isSearchMode by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var isFabExpanded by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableIntStateOf(0) }

    BackHandler(enabled = uiState.breadcrumbs.size > 1 || uiState.isSelectionMode || isSearchMode) {
        when {
            isSearchMode -> {
                isSearchMode = false
                searchQuery = ""
                viewModel.search("")
            }
            uiState.isSelectionMode -> viewModel.clearSelection()
            else -> viewModel.navigateBack()
        }
    }

    Scaffold(
        topBar = {
            when {
                uiState.isSelectionMode -> {
                    TopAppBar(
                        title = { Text("${uiState.selectedItems.size} selected") },
                        navigationIcon = {
                            IconButton(onClick = viewModel::clearSelection) {
                                Icon(Icons.Default.Close, contentDescription = "Clear selection")
                            }
                        },
                        actions = {
                            IconButton(onClick = { showDeleteSelectedConfirm = true }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete selected")
                            }
                        },
                    )
                }
                isSearchMode -> {
                    TopAppBar(
                        title = {
                            TextField(
                                value = searchQuery,
                                onValueChange = {
                                    searchQuery = it
                                    viewModel.search(it)
                                },
                                placeholder = {
                                    Text(
                                        "Search files...",
                                        style = MaterialTheme.typography.bodyLarge,
                                    )
                                },
                                singleLine = true,
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                ),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        },
                        navigationIcon = {
                            IconButton(onClick = {
                                isSearchMode = false
                                searchQuery = ""
                                viewModel.search("")
                            }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                            }
                        },
                        actions = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = {
                                    searchQuery = ""
                                    viewModel.search("")
                                }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                    )
                }
                else -> {
                    TopAppBar(
                        title = {
                            Text(
                                uiState.currentFolderName,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                            )
                        },
                        actions = {
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
                                            },
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
                                                contentDescription = null,
                                            )
                                        },
                                    )
                                }
                            }
                        },
                    )
                }
            }
        },
        floatingActionButton = {
            if (!uiState.isSelectionMode && !isSearchMode) {
                SpeedDialFAB(
                    isExpanded = isFabExpanded,
                    onToggle = { isFabExpanded = !isFabExpanded },
                    items = listOf(
                        SpeedDialItem(
                            icon = Icons.Default.CreateNewFolder,
                            label = "New Folder",
                            onClick = viewModel::showCreateFolderDialog,
                        ),
                        SpeedDialItem(
                            icon = Icons.Default.CloudUpload,
                            label = "Upload",
                            onClick = { onNavigateToUpload(uiState.currentFolderId) },
                        ),
                        SpeedDialItem(
                            icon = Icons.Default.Link,
                            label = "Remote Upload",
                            onClick = viewModel::showRemoteUploadDialog,
                        ),
                    ),
                )
            }
        },
    ) { padding ->
        // Compute tab-filtered lists
        val isAtRoot = uiState.breadcrumbs.size <= 1
        val displayFolders = if (selectedTab == 0) uiState.folders else emptyList()
        val displayFiles = when (selectedTab) {
            1 -> uiState.files.filter { uiState.pinnedFileIds.contains(it.id) }
            2 -> uiState.files.filter { it.isStarred }
            else -> uiState.files
        }

        Column(modifier = Modifier.padding(padding)) {
            // Breadcrumb - always visible
            FolderBreadcrumb(
                breadcrumbs = uiState.breadcrumbs,
                onItemClick = viewModel::navigateToBreadcrumb,
            )

            // ── Root-level: persistent search bar + tabs + sort row ───────────
            if (isAtRoot && !isSearchMode && !uiState.isSelectionMode) {
                // Search bar
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .clickable { isSearchMode = true },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Search,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Search in ByteBox",
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                // Tabs: All | Offline | Starred
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = MaterialTheme.colorScheme.background,
                    contentColor = MaterialTheme.colorScheme.onBackground,
                    divider = {},
                ) {
                    listOf("All", "Offline", "Starred").forEachIndexed { index, label ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Text(
                                    text = label,
                                    fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                )
                            },
                        )
                    }
                }
                // Sort info row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showSortMenu = true }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.Sort,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Sort by ${uiState.sortBy.name.lowercase().replaceFirstChar { it.uppercase() }}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }

            when {
                uiState.isLoading -> {
                    FileListShimmer(
                        modifier = Modifier.padding(top = ByteBoxTheme.spacing.xs),
                    )
                }
                uiState.errorMessage != null -> {
                    ErrorState(
                        message = uiState.errorMessage!!,
                        onRetry = viewModel::loadContents,
                    )
                }
                displayFiles.isEmpty() && displayFolders.isEmpty() && !uiState.isLoading -> {
                    EmptyState(
                        icon = Icons.Default.FolderOpen,
                        title = if (selectedTab == 1) "No offline files" else if (selectedTab == 2) "No starred files" else "This folder is empty",
                        subtitle = if (selectedTab == 0) "Upload files or create folders to get started" else "",
                    )
                }
                uiState.viewMode == ViewMode.LIST -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(displayFolders, key = { it.id }) { folder ->
                            FolderItem(
                                folder = folder,
                                isSelected = uiState.selectedItems.contains(folder.id),
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(folder.id)
                                    else viewModel.navigateToFolder(folder)
                                },
                                onLongClick = { viewModel.toggleSelection(folder.id) },
                                onMoreClick = { contextMenuFolderId = folder.id },
                            )
                        }
                        if (displayFiles.isNotEmpty()) {
                            item {
                                SectionHeader(title = "Files")
                            }
                            displayFiles.forEachIndexed { index, file ->
                                item(key = file.id) {
                                    FileListItem(
                                        file = file,
                                        isSelected = uiState.selectedItems.contains(file.id),
                                        onClick = {
                                            if (uiState.isSelectionMode) viewModel.toggleSelection(file.id)
                                            else onFileClick(file.id, file.mimeType)
                                        },
                                        onLongClick = { viewModel.toggleSelection(file.id) },
                                        onMoreClick = { contextMenuFileId = file.id },
                                        onStarClick = { viewModel.toggleStar(file.id, file.isStarred) },
                                        isPinned = uiState.pinnedFileIds.contains(file.id),
                                    )
                                }
                                // Insert a banner ad after every 5 files
                                if ((index + 1) % 5 == 0) {
                                    item(key = "ad_after_file_$index") {
                                        BannerAd(
                                            adUnitId = AdManager.BANNER_FILES,
                                            modifier = Modifier.padding(
                                                horizontal = ByteBoxTheme.spacing.md,
                                            ),
                                        )
                                    }
                                }
                            }
                        }
                        if (uiState.isLoadingMore) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(ByteBoxTheme.spacing.md),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                }
                            }
                        }
                    }
                }
                else -> {
                    // Banner ad above the grid for free-tier users
                    BannerAd(
                        adUnitId = AdManager.BANNER_FILES,
                        modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md),
                    )
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 160.dp),
                        contentPadding = PaddingValues(ByteBoxTheme.spacing.xs),
                        horizontalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.xs),
                        verticalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.xs),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(uiState.folders, key = { it.id }) { folder ->
                            val folderIndex = uiState.folders.indexOf(folder)
                            com.bytebox.core.ui.components.ColoredFolderCard(
                                name = folder.name,
                                index = folderIndex,
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(folder.id)
                                    else viewModel.navigateToFolder(folder)
                                },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        items(uiState.files, key = { it.id }) { file ->
                            FileGridItem(
                                file = file,
                                isSelected = uiState.selectedItems.contains(file.id),
                                onClick = {
                                    if (uiState.isSelectionMode) viewModel.toggleSelection(file.id)
                                    else onFileClick(file.id, file.mimeType)
                                },
                                onLongClick = { viewModel.toggleSelection(file.id) },
                            )
                        }
                    }
                }
            }
        }
    }

    // Create folder dialog
    if (uiState.showCreateFolderDialog) {
        Dialog(onDismissRequest = viewModel::hideCreateFolderDialog) {
            Card(
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(modifier = Modifier.padding(ByteBoxTheme.spacing.xl)) {
                    Text("New Folder", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                    com.bytebox.core.ui.components.ByteBoxTextField(
                        value = newFolderName,
                        onValueChange = { newFolderName = it },
                        label = "Folder name",
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(onClick = {
                            viewModel.hideCreateFolderDialog()
                            newFolderName = ""
                        }) { Text("Cancel") }
                        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                        TextButton(
                            onClick = {
                                viewModel.createFolder(newFolderName)
                                newFolderName = ""
                            },
                            enabled = newFolderName.isNotBlank(),
                        ) { Text("Create") }
                    }
                }
            }
        }
    }

    // Rename folder dialog
    if (showRenameFolderDialog) {
        Dialog(onDismissRequest = { showRenameFolderDialog = false }) {
            Card(
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(modifier = Modifier.padding(ByteBoxTheme.spacing.xl)) {
                    Text("Rename Folder", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                    com.bytebox.core.ui.components.ByteBoxTextField(
                        value = renameFolderName,
                        onValueChange = { renameFolderName = it },
                        label = "Folder name",
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(onClick = { showRenameFolderDialog = false }) { Text("Cancel") }
                        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                        TextButton(
                            onClick = {
                                viewModel.renameFolder(renameFolderId, renameFolderName)
                                showRenameFolderDialog = false
                            },
                            enabled = renameFolderName.isNotBlank(),
                        ) { Text("Rename") }
                    }
                }
            }
        }
    }

    // Folder context menu
    contextMenuFolderId?.let { folderId ->
        val folder = uiState.folders.find { it.id == folderId }
        if (folder != null) {
            Dialog(onDismissRequest = { contextMenuFolderId = null }) {
                Card(
                    shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(vertical = ByteBoxTheme.spacing.xs)) {
                        Text(
                            text = folder.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.lg, vertical = ByteBoxTheme.spacing.sm),
                        )
                        ListItem(
                            headlineContent = { Text("Share") },
                            leadingContent = { Icon(Icons.Default.Share, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                viewModel.shareFolder(folderId)
                            },
                        )
                        ListItem(
                            headlineContent = { Text("Rename") },
                            leadingContent = { Icon(Icons.Default.Edit, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                renameFolderId = folderId
                                renameFolderName = folder.name
                                showRenameFolderDialog = true
                            },
                        )
                        ListItem(
                            headlineContent = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                            leadingContent = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            modifier = Modifier.clickable {
                                contextMenuFolderId = null
                                deleteTargetId = folderId
                                deleteTargetName = folder.name
                                deleteTargetIsFolder = true
                                showDeleteConfirm = true
                            },
                        )
                    }
                }
            }
        }
    }

    // File context menu
    contextMenuFileId?.let { fileId ->
        val file = uiState.files.find { it.id == fileId }
        if (file != null) {
            Dialog(onDismissRequest = { contextMenuFileId = null }) {
                Card(
                    shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(vertical = ByteBoxTheme.spacing.xs)) {
                        Text(
                            text = file.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.lg, vertical = ByteBoxTheme.spacing.sm),
                        )
                        ListItem(
                            headlineContent = { Text("Share") },
                            leadingContent = { Icon(Icons.Default.Share, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFileId = null
                                viewModel.shareFile(fileId)
                            },
                        )
                        ListItem(
                            headlineContent = { Text("Copy") },
                            leadingContent = { Icon(Icons.Default.ContentCopy, contentDescription = null) },
                            modifier = Modifier.clickable {
                                contextMenuFileId = null
                                viewModel.copyFile(fileId)
                            },
                        )
                        if (uiState.pinnedFileIds.contains(fileId)) {
                            ListItem(
                                headlineContent = { Text("Remove Offline") },
                                leadingContent = { Icon(Icons.Default.OfflinePin, contentDescription = null) },
                                modifier = Modifier.clickable {
                                    contextMenuFileId = null
                                    viewModel.unpinFile(fileId)
                                },
                            )
                        } else {
                            ListItem(
                                headlineContent = { Text("Make Available Offline") },
                                leadingContent = { Icon(Icons.Default.CloudDownload, contentDescription = null) },
                                modifier = Modifier.clickable {
                                    contextMenuFileId = null
                                    viewModel.pinFile(fileId)
                                },
                            )
                        }
                        ListItem(
                            headlineContent = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                            leadingContent = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            modifier = Modifier.clickable {
                                contextMenuFileId = null
                                deleteTargetId = fileId
                                deleteTargetName = file.name
                                deleteTargetIsFolder = false
                                showDeleteConfirm = true
                            },
                        )
                    }
                }
            }
        }
    }

    // Delete confirmation dialogs
    if (showDeleteConfirm) {
        ConfirmationDialog(
            title = "Delete",
            message = "Are you sure you want to delete \"$deleteTargetName\"?",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                if (deleteTargetIsFolder) viewModel.trashFolder(deleteTargetId)
                else viewModel.trashFile(deleteTargetId)
                showDeleteConfirm = false
            },
            onDismiss = { showDeleteConfirm = false },
        )
    }

    if (showDeleteSelectedConfirm) {
        ConfirmationDialog(
            title = "Delete ${uiState.selectedItems.size} items",
            message = "Are you sure you want to delete the selected items?",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                uiState.selectedItems.forEach { id ->
                    if (uiState.files.any { it.id == id }) viewModel.trashFile(id)
                    if (uiState.folders.any { it.id == id }) viewModel.trashFolder(id)
                }
                viewModel.clearSelection()
                showDeleteSelectedConfirm = false
            },
            onDismiss = { showDeleteSelectedConfirm = false },
        )
    }

    // Share dialog
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    uiState.shareUrl?.let { shareUrl ->
        Dialog(onDismissRequest = { viewModel.clearShareUrl() }) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ByteBoxTheme.radius.xl),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.xl),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Share Link",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        IconButton(onClick = { viewModel.clearShareUrl() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close")
                        }
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                    // File/Folder icon
                    Surface(
                        modifier = Modifier.size(64.dp),
                        shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                        color = if (uiState.shareItemIsFolder)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            MaterialTheme.colorScheme.secondaryContainer,
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
                                modifier = Modifier.size(32.dp),
                                tint = if (uiState.shareItemIsFolder)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.secondary,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                    Text(
                        text = uiState.shareItemName ?: "File",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )

                    if (!uiState.shareItemIsFolder && uiState.shareItemSize > 0) {
                        Text(
                            text = uiState.shareItemSize.toReadableFileSize(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                    // Link container
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(ByteBoxTheme.radius.md),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    ) {
                        Row(
                            modifier = Modifier.padding(ByteBoxTheme.spacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.Link,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                            Text(
                                text = shareUrl,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                    com.bytebox.core.ui.components.ByteBoxButton(
                        text = "Copy Link",
                        onClick = {
                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(shareUrl))
                        },
                        leadingIcon = Icons.Default.ContentCopy,
                    )

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

                    com.bytebox.core.ui.components.ByteBoxOutlinedButton(
                        text = "Share via...",
                        onClick = {
                            val sendIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(Intent.EXTRA_TEXT, "Check out this file on ByteBox: $shareUrl")
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Share via"))
                        },
                        leadingIcon = Icons.Default.Share,
                    )
                }
            }
        }
    }

    // Share loading indicator
    if (uiState.isCreatingShare) {
        Dialog(onDismissRequest = {}) {
            Card(
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Row(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.xl),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.md))
                    Text("Creating share link...")
                }
            }
        }
    }

    // Remote Upload dialog
    var remoteUploadUrl by remember { mutableStateOf("") }
    var remoteUploadFileName by remember { mutableStateOf("") }

    if (uiState.showRemoteUploadDialog) {
        Dialog(onDismissRequest = {
            if (!uiState.isRemoteUploading) viewModel.hideRemoteUploadDialog()
        }) {
            Card(
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(modifier = Modifier.padding(ByteBoxTheme.spacing.xl)) {
                    Text("Upload from URL", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))
                    Text(
                        "Download a file from the web directly to your ByteBox",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

                    com.bytebox.core.ui.components.ByteBoxTextField(
                        value = remoteUploadUrl,
                        onValueChange = { remoteUploadUrl = it },
                        label = "URL",
                        placeholder = "https://example.com/file.zip",
                        enabled = !uiState.isRemoteUploading,
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                    com.bytebox.core.ui.components.ByteBoxTextField(
                        value = remoteUploadFileName,
                        onValueChange = { remoteUploadFileName = it },
                        label = "File name (optional)",
                        placeholder = "Auto-detect from URL",
                        enabled = !uiState.isRemoteUploading,
                    )

                    if (uiState.remoteUploadError != null) {
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))
                        Text(
                            text = uiState.remoteUploadError!!,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                    if (uiState.isRemoteUploading) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))
                            Text("Downloading file...", style = MaterialTheme.typography.bodyMedium)
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            TextButton(onClick = {
                                viewModel.hideRemoteUploadDialog()
                                remoteUploadUrl = ""
                                remoteUploadFileName = ""
                            }) { Text("Cancel") }
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                            TextButton(
                                onClick = {
                                    viewModel.remoteUpload(remoteUploadUrl, remoteUploadFileName)
                                },
                                enabled = remoteUploadUrl.isNotBlank(),
                            ) { Text("Download to ByteBox") }
                        }
                    }
                }
            }
        }
    }

    // Reset fields when dialog closes after success
    if (!uiState.showRemoteUploadDialog && remoteUploadUrl.isNotEmpty()) {
        remoteUploadUrl = ""
        remoteUploadFileName = ""
    }

    // Remote upload success snackbar
    uiState.remoteUploadSuccess?.let { fileName ->
        Dialog(onDismissRequest = { viewModel.clearRemoteUploadSuccess() }) {
            Card(
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.xl),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(48.dp),
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                    Text("File saved!", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))
                    Text(
                        text = fileName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))
                    TextButton(onClick = { viewModel.clearRemoteUploadSuccess() }) {
                        Text("OK")
                    }
                }
            }
        }
    }
}
