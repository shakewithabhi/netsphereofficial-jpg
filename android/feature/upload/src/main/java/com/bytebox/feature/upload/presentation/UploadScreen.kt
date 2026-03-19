package com.bytebox.feature.upload.presentation

import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.domain.model.UploadStatus
import com.bytebox.domain.model.UploadTask

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPreview: (fileId: String, mimeType: String) -> Unit = { _, _ -> },
    folderId: String? = null,
    sharePublicly: Boolean = false,
    viewModel: UploadViewModel = hiltViewModel()
) {
    LaunchedEffect(folderId) {
        viewModel.setCurrentFolder(folderId)
    }
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Privacy toggle state — pre-set from nav argument
    var sharePubliclyState by remember { mutableStateOf(sharePublicly) }

    // Handles URIs from any picker contract
    fun processPickedUris(uris: List<Uri>) {
        uris.forEach { uri ->
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = it.getColumnIndex(OpenableColumns.SIZE)
                    val name = if (nameIndex >= 0) it.getString(nameIndex) else "unknown"
                    val size = if (sizeIndex >= 0) it.getLong(sizeIndex) else 0L
                    val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"

                    // Copy to app cache so WorkManager can access it after URI permission expires
                    val cacheFile = File(context.cacheDir, "upload_${System.currentTimeMillis()}_$name")
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        cacheFile.outputStream().use { output -> input.copyTo(output) }
                    }
                    val cacheUri = Uri.fromFile(cacheFile)
                    viewModel.uploadFile(cacheUri, name, size, mimeType, sharePubliclyState)
                }
            }
        }
    }

    // Primary picker: GetMultipleContents — shows gallery + file manager, supports all formats
    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> -> processPickedUris(uris) }

    // Fallback: OpenMultipleDocuments for explicit file browsing
    val documentPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> -> processPickedUris(uris) }

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = { Text("Uploads") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState.tasks.any { it.status == UploadStatus.COMPLETED }) {
                        TextButton(onClick = viewModel::clearCompleted) {
                            Text("Clear done")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                    actionIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { filePicker.launch("*/*") }) {
                Icon(Icons.Default.Add, contentDescription = "Pick files")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Privacy toggle card — always visible
            PrivacyToggleCard(
                sharePublicly = sharePubliclyState,
                onToggle = { sharePubliclyState = it },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            if (uiState.tasks.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.CloudUpload,
                    title = "No uploads",
                    subtitle = "Tap + to select files to upload",
                )
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(uiState.tasks, key = { it.id }) { task ->
                        UploadTaskItem(
                            task = task,
                            onCancel = { viewModel.cancelUpload(task.id) },
                            onRetry = { viewModel.retryUpload(task.id) },
                            onRemove = { viewModel.removeUpload(task.id) },
                            onClick = {
                                val fileId = task.serverFileId
                                if (task.status == UploadStatus.COMPLETED && fileId != null) {
                                    onNavigateToPreview(fileId, task.mimeType)
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PrivacyToggleCard(
    sharePublicly: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (sharePublicly)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            else
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(
                imageVector = if (sharePublicly) Icons.Default.Public else Icons.Default.Lock,
                contentDescription = null,
                tint = if (sharePublicly) MaterialTheme.colorScheme.primary
                       else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Share to Public (Explore)",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = if (sharePublicly) "Visible to all users in Explore feed"
                           else "Only visible to you in Files",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = sharePublicly,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = MaterialTheme.colorScheme.primary,
                    checkedTrackColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            )
        }
    }
}

@Composable
private fun UploadTaskItem(
    task: UploadTask,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onRemove: () -> Unit,
    onClick: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current

    ListItem(
        modifier = if (task.status == UploadStatus.COMPLETED && task.serverFileId != null)
            Modifier.clickable(onClick = onClick) else Modifier,
        headlineContent = {
            Text(task.fileName, maxLines = 1)
        },
        supportingContent = {
            Column {
                Text(
                    text = "${task.fileSize.toReadableFileSize()} · ${task.status.name.lowercase().replaceFirstChar { it.uppercase() }}",
                    style = MaterialTheme.typography.bodySmall
                )
                if (task.status == UploadStatus.UPLOADING || task.status == UploadStatus.PENDING) {
                    Spacer(modifier = Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { task.progress },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                val shareUrl = task.shareUrl
                if (shareUrl != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = shareUrl,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                val errorMsg = task.errorMessage
                if (errorMsg != null) {
                    Text(
                        text = errorMsg,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        },
        leadingContent = {
            val isMedia = task.mimeType.startsWith("image/") || task.mimeType.startsWith("video/")
            if (isMedia && task.localFileUri.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    AsyncImage(
                        model = android.net.Uri.parse(task.localFileUri),
                        contentDescription = null,
                        modifier = Modifier.matchParentSize(),
                        contentScale = ContentScale.Crop,
                    )
                    if (task.status == UploadStatus.UPLOADING) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp).align(Alignment.BottomEnd).padding(2.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            } else {
                when (task.status) {
                    UploadStatus.COMPLETED -> Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                    UploadStatus.FAILED -> Icon(Icons.Default.Error, null, tint = MaterialTheme.colorScheme.error)
                    UploadStatus.UPLOADING -> CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    else -> Icon(Icons.Default.CloudUpload, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        trailingContent = {
            when (task.status) {
                UploadStatus.UPLOADING, UploadStatus.PENDING -> {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.Default.Close, contentDescription = "Cancel")
                    }
                }
                UploadStatus.FAILED -> {
                    Row {
                        IconButton(onClick = onRetry) {
                            Icon(Icons.Default.Refresh, contentDescription = "Retry")
                        }
                        IconButton(onClick = onRemove) {
                            Icon(Icons.Default.Delete, contentDescription = "Remove")
                        }
                    }
                }
                UploadStatus.COMPLETED -> {
                    Row {
                        val url = task.shareUrl
                        if (url != null) {
                            IconButton(onClick = {
                                clipboardManager.setText(AnnotatedString(url))
                            }) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy link")
                            }
                        }
                        if (task.serverFileId != null) {
                            Icon(
                                Icons.Default.ChevronRight,
                                contentDescription = "View",
                                modifier = Modifier.padding(12.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                else -> {}
            }
        }
    )
}
