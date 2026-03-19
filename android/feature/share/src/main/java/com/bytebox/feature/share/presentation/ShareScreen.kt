package com.bytebox.feature.share.presentation

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.SubcomposeAsyncImage
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.ShareLink
import kotlinx.coroutines.launch

// ── Share Targets ───────────────────────────────────────────────────────────

private data class ShareTarget(
    val label: String,
    val icon: ImageVector,
    val color: Color,
    val packageName: String? = null,
)

private val shareTargets = listOf(
    ShareTarget("Copy link", Icons.Default.Link, Color(0xFF2563EB)),
    ShareTarget("WhatsApp", Icons.Default.Share, Color(0xFF25D366), "com.whatsapp"),
    ShareTarget("Telegram", Icons.Default.Send, Color(0xFF0088CC), "org.telegram.messenger"),
    ShareTarget("More", Icons.Default.MoreHoriz, Color(0xFF6B7280)),
)

// ── Main Screen ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareScreen(
    onNavigateBack: () -> Unit,
    viewModel: ShareViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Handle share creation result
    LaunchedEffect(uiState.createdShareLink) {
        uiState.createdShareLink?.let { link ->
            clipboardManager.setText(AnnotatedString(link.shareUrl))
            snackbarHostState.showSnackbar("Link copied to clipboard!")
            viewModel.clearShareResult()
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Text("Share", style = MaterialTheme.typography.titleLarge)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            if (uiState.shares.isNotEmpty()) {
                FloatingActionButton(
                    onClick = { viewModel.openFilePicker() },
                    containerColor = MaterialTheme.colorScheme.primary,
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Create share")
                }
            }
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
            uiState.shares.isEmpty() -> {
                EmptyState(
                    icon = Icons.Default.Send,
                    title = "Welcome to Share",
                    subtitle = "Easily share and manage your sharing and receiving records here with ByteBox.",
                    action = {
                        Button(
                            onClick = { viewModel.openFilePicker() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 48.dp),
                            shape = RoundedCornerShape(ByteBoxTheme.radius.xl),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF2563EB),
                            ),
                        ) {
                            Text(
                                "Select files to share",
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    },
                    modifier = Modifier.padding(padding),
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(bottom = 88.dp),
                ) {
                    items(uiState.shares, key = { it.id }) { share ->
                        ShareItem(
                            share = share,
                            onCopyLink = {
                                clipboardManager.setText(AnnotatedString(share.shareUrl))
                                scope.launch {
                                    snackbarHostState.showSnackbar("Link copied!")
                                }
                            },
                            onShareLink = {
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, share.shareUrl)
                                }
                                context.startActivity(Intent.createChooser(intent, "Share link"))
                            },
                            onDelete = { viewModel.deleteShare(share.id) },
                        )
                    }
                }
            }
        }
    }

    // ── Step 2: File Picker Bottom Sheet ────────────────────────────────────
    if (uiState.showFilePicker) {
        FilePickerBottomSheet(
            uiState = uiState,
            onDismiss = { viewModel.closeFilePicker() },
            onFolderClick = { viewModel.navigatePickerToFolder(it) },
            onFileToggle = { viewModel.toggleFileSelection(it) },
            onFolderToggle = { viewModel.toggleFolderSelection(it) },
            onSelectAll = { viewModel.toggleSelectAll() },
            onSearchQueryChange = { viewModel.onPickerSearchQueryChanged(it) },
            onBack = { if (!viewModel.navigatePickerBack()) viewModel.closeFilePicker() },
            onConfirm = { viewModel.confirmFileSelection() },
        )
    }

    // ── Step 3: Share To Bottom Sheet ───────────────────────────────────────
    if (uiState.showShareOptions) {
        ShareToBottomSheet(
            uiState = uiState,
            onDismiss = { viewModel.closeShareOptions() },
            onTogglePrivateLink = { viewModel.togglePrivateLink() },
            onCopyLink = { viewModel.executeShare() },
            onShareVia = { packageName ->
                viewModel.executeShare()
                // The LaunchedEffect above handles clipboard copy;
                // for specific apps, we fire an intent after creation
            },
        )
    }
}

// ── Share Item Card ─────────────────────────────────────────────────────────

@Composable
private fun ShareItem(
    share: ShareLink,
    onCopyLink: () -> Unit,
    onShareLink: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xxs),
        shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = ByteBoxTheme.elevation.xs),
    ) {
        Column(modifier = Modifier.padding(ByteBoxTheme.spacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.InsertDriveFile,
                    contentDescription = "File",
                    modifier = Modifier.size(24.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = share.fileName ?: "File",
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = share.fileSize?.toReadableFileSize() ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (share.hasPassword) {
                    AssistChip(
                        onClick = {},
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                        },
                        modifier = Modifier.padding(end = ByteBoxTheme.spacing.xxs),
                    )
                }
                share.expiresAt?.let {
                    AssistChip(
                        onClick = {},
                        label = { Text("Expires") },
                        leadingIcon = {
                            Icon(Icons.Default.Schedule, contentDescription = null, modifier = Modifier.size(16.dp))
                        },
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "${share.downloadCount} downloads",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            Row {
                OutlinedButton(
                    onClick = onCopyLink,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xxs))
                    Text("Copy")
                }
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                OutlinedButton(
                    onClick = onShareLink,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xxs))
                    Text("Share")
                }
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete share", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

// ── File Picker Bottom Sheet (Step 2) ───────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilePickerBottomSheet(
    uiState: ShareUiState,
    onDismiss: () -> Unit,
    onFolderClick: (Folder) -> Unit,
    onFileToggle: (String) -> Unit,
    onFolderToggle: (String) -> Unit,
    onSelectAll: () -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    BackHandler {
        if (uiState.pickerFolderStack.size > 1) onBack() else onDismiss()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = ByteBoxTheme.radius.lg, topEnd = ByteBoxTheme.radius.lg),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (uiState.pickerFolderStack.size > 1) {
                    IconButton(onClick = onBack, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xxs))
                }
                Text(
                    text = if (uiState.pickerFolderStack.size > 1)
                        uiState.pickerFolderStack.last().name
                    else
                        "Share files",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            // Search bar
            OutlinedTextField(
                value = uiState.pickerSearchQuery,
                onValueChange = onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xs),
                placeholder = { Text("Search", fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
                singleLine = true,
                shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp),
            )

            // Content
            if (uiState.pickerIsLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                }
            } else {
                // "All" select-all row
                val allFileIds = uiState.pickerFiles.map { it.id }.toSet()
                val allSelected = allFileIds.isNotEmpty() && allFileIds == uiState.selectedFileIds

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false),
                ) {
                    // Select All row
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelectAll() }
                                .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "All",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            Checkbox(
                                checked = allSelected,
                                onCheckedChange = { onSelectAll() },
                            )
                        }
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f),
                            modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md),
                        )
                    }

                    // Folders
                    items(uiState.pickerFolders, key = { "folder_${it.id}" }) { folder ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onFolderClick(folder) }
                                .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.Folder,
                                contentDescription = null,
                                tint = Color(0xFFFFC107),
                                modifier = Modifier.size(40.dp),
                            )
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))
                            Text(
                                folder.name,
                                style = MaterialTheme.typography.bodyLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            Checkbox(
                                checked = folder.id in uiState.selectedFolderIds,
                                onCheckedChange = { onFolderToggle(folder.id) },
                            )
                        }
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f),
                            modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md),
                        )
                    }

                    // Files
                    items(uiState.pickerFiles, key = { "file_${it.id}" }) { file ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onFileToggle(file.id) }
                                .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            // Thumbnail or icon
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(ByteBoxTheme.radius.xs)),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (file.thumbnailUrl != null) {
                                    SubcomposeAsyncImage(
                                        model = file.thumbnailUrl,
                                        contentDescription = file.name,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop,
                                        error = {
                                            FileTypeIcon(category = file.category, containerSize = 40.dp)
                                        },
                                    )
                                } else {
                                    FileTypeIcon(category = file.category, containerSize = 40.dp)
                                }
                            }
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    file.name,
                                    style = MaterialTheme.typography.bodyLarge,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    file.size.toReadableFileSize(),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Checkbox(
                                checked = file.id in uiState.selectedFileIds,
                                onCheckedChange = { onFileToggle(file.id) },
                            )
                        }
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f),
                            modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md),
                        )
                    }
                }
            }

            // Bottom confirm bar
            if (uiState.hasSelection) {
                HorizontalDivider()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(ByteBoxTheme.spacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${uiState.selectionCount} selected",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Button(
                        onClick = onConfirm,
                        shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                    ) {
                        Text("Next")
                    }
                }
            }
        }
    }
}

// ── Share To Bottom Sheet (Step 3) ──────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareToBottomSheet(
    uiState: ShareUiState,
    onDismiss: () -> Unit,
    onTogglePrivateLink: () -> Unit,
    onCopyLink: () -> Unit,
    onShareVia: (String?) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val context = LocalContext.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = ByteBoxTheme.radius.lg, topEnd = ByteBoxTheme.radius.lg),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = ByteBoxTheme.spacing.xl),
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Share to",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

            // Share targets row
            LazyRow(
                contentPadding = PaddingValues(horizontal = ByteBoxTheme.spacing.md),
                horizontalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.lg),
            ) {
                items(shareTargets) { target ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clickable {
                                if (target.packageName == null && target.label == "Copy link") {
                                    onCopyLink()
                                } else if (target.label == "More") {
                                    onShareVia(null)
                                } else {
                                    onShareVia(target.packageName)
                                }
                            }
                            .padding(vertical = ByteBoxTheme.spacing.xs),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(target.color),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                target.icon,
                                contentDescription = target.label,
                                tint = Color.White,
                                modifier = Modifier.size(28.dp),
                            )
                        }
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
                        Text(
                            target.label,
                            style = MaterialTheme.typography.labelSmall,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
            HorizontalDivider(modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md))
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // Validity row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Validity",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "Permanently Valid",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    " >",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Private link toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Set private link",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(modifier = Modifier.weight(1f))
                Switch(
                    checked = uiState.isPrivateLink,
                    onCheckedChange = { onTogglePrivateLink() },
                )
            }

            // Extraction code (visible when private link is on)
            AnimatedVisibility(visible = uiState.isPrivateLink) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Extraction Code",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        uiState.extractionCode,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        " >",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Loading indicator
            if (uiState.isCreatingShare) {
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
