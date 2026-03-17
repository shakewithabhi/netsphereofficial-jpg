package com.bytebox.feature.preview.presentation

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileVersion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreviewScreen(
    fileId: String,
    mimeType: String,
    onNavigateBack: () -> Unit,
    onDownload: (String) -> Unit,
    onShare: (String) -> Unit,
    viewModel: PreviewViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showVersionSheet by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(fileId) {
        viewModel.setFileInfo("", mimeType)
        viewModel.loadFile(fileId)
    }

    LaunchedEffect(uiState.versionActionMessage) {
        uiState.versionActionMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearVersionActionMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(uiState.fileName ?: "Preview") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showVersionSheet = true }) {
                        Icon(Icons.Default.History, contentDescription = "Version History")
                    }
                    IconButton(onClick = { onDownload(fileId) }) {
                        Icon(Icons.Default.Download, contentDescription = "Download")
                    }
                    IconButton(onClick = { onShare(fileId) }) {
                        Icon(Icons.Default.Share, contentDescription = "Share")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            when {
                uiState.isLoading -> CircularProgressIndicator()
                uiState.errorMessage != null -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(uiState.errorMessage!!)
                    }
                }
                uiState.previewUrl != null -> {
                    when (uiState.category) {
                        FileCategory.IMAGE -> ImagePreview(url = uiState.previewUrl!!)
                        FileCategory.VIDEO -> VideoPreview(url = uiState.previewUrl!!)
                        FileCategory.AUDIO -> AudioPreview(url = uiState.previewUrl!!, fileName = uiState.fileName ?: "Audio")
                        FileCategory.PDF -> PdfPreview(url = uiState.previewUrl!!)
                        FileCategory.DOCUMENT, FileCategory.OTHER -> UnsupportedPreview(mimeType = mimeType)
                    }
                }
            }
        }
    }

    if (showVersionSheet) {
        VersionHistoryBottomSheet(
            versions = uiState.versions,
            isLoading = uiState.isLoadingVersions,
            error = uiState.versionError,
            onDismiss = { showVersionSheet = false },
            onRestore = { versionNumber -> viewModel.restoreVersion(versionNumber) },
            onDelete = { versionNumber -> viewModel.deleteVersion(versionNumber) },
            onRetry = { viewModel.loadVersions() }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VersionHistoryBottomSheet(
    versions: List<FileVersion>,
    isLoading: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onRestore: (Int) -> Unit,
    onDelete: (Int) -> Unit,
    onRetry: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var confirmAction by remember { mutableStateOf<VersionAction?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(
            topStart = ByteBoxTheme.radius.lg,
            topEnd = ByteBoxTheme.radius.lg
        ),
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = ByteBoxTheme.spacing.md)
                .padding(bottom = ByteBoxTheme.spacing.xl)
        ) {
            Text(
                text = "Version History",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = ByteBoxTheme.spacing.md)
            )

            when {
                isLoading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                error != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = ByteBoxTheme.spacing.lg),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.ErrorOutline,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))
                        Text(
                            text = error,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                        TextButton(onClick = onRetry) {
                            Text("Retry")
                        }
                    }
                }
                versions.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = ByteBoxTheme.spacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No version history available",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 400.dp),
                        verticalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.xxs)
                    ) {
                        itemsIndexed(versions) { index, version ->
                            VersionItem(
                                version = version,
                                isCurrent = index == 0,
                                onRestore = { onRestore(version.versionNumber) },
                                onDelete = {
                                    confirmAction = VersionAction.Delete(version.versionNumber)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    confirmAction?.let { action ->
        when (action) {
            is VersionAction.Delete -> {
                ConfirmationDialog(
                    title = "Delete Version",
                    message = "Are you sure you want to delete version ${action.versionNumber}? This action cannot be undone.",
                    confirmText = "Delete",
                    isDestructive = true,
                    onConfirm = {
                        onDelete(action.versionNumber)
                        confirmAction = null
                    },
                    onDismiss = { confirmAction = null }
                )
            }
        }
    }
}

private sealed class VersionAction {
    data class Delete(val versionNumber: Int) : VersionAction()
}

@Composable
private fun VersionItem(
    version: FileVersion,
    isCurrent: Boolean,
    onRestore: () -> Unit,
    onDelete: () -> Unit
) {
    val formattedDate = remember(version.createdAt) {
        try {
            version.createdAt.toLocalDateTime().toRelativeTime()
        } catch (_: Exception) {
            version.createdAt
        }
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        color = if (isCurrent) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    horizontal = ByteBoxTheme.spacing.md,
                    vertical = ByteBoxTheme.spacing.sm
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCurrent) Icons.Default.CheckCircle else Icons.Default.History,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = if (isCurrent) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Version ${version.versionNumber}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal
                    )
                    if (isCurrent) {
                        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                        Surface(
                            shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                            color = MaterialTheme.colorScheme.primary
                        ) {
                            Text(
                                text = "Current",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.padding(
                                    horizontal = ByteBoxTheme.spacing.xs,
                                    vertical = 2.dp
                                )
                            )
                        }
                    }
                }
                Row {
                    Text(
                        text = version.size.toReadableFileSize(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = " \u00B7 ",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (!isCurrent) {
                IconButton(onClick = onRestore) {
                    Icon(
                        Icons.Default.RestorePage,
                        contentDescription = "Restore version ${version.versionNumber}",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete version ${version.versionNumber}",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun ImagePreview(url: String) {
    AsyncImage(
        model = url,
        contentDescription = "Image preview",
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Fit
    )
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun VideoPreview(url: String) {
    val context = LocalContext.current
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
            playWhenReady = true
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = true
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun AudioPreview(url: String, fileName: String) {
    val context = LocalContext.current
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
            playWhenReady = true
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.MusicNote,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(fileName, style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(24.dp))
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = true
                    controllerShowTimeoutMs = 0
                    controllerAutoShow = true
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
        )
    }
}

@Composable
private fun PdfPreview(url: String) {
    val context = LocalContext.current
    var pages by remember { mutableStateOf<List<Bitmap>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(url) {
        withContext(Dispatchers.IO) {
            try {
                val cacheFile = File(context.cacheDir, "preview_pdf_${url.hashCode()}.pdf")
                if (!cacheFile.exists()) {
                    URL(url).openStream().use { input ->
                        cacheFile.outputStream().use { output -> input.copyTo(output) }
                    }
                }
                val fd = ParcelFileDescriptor.open(cacheFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(fd)
                val bitmaps = mutableListOf<Bitmap>()
                val maxPages = minOf(renderer.pageCount, 20)
                for (i in 0 until maxPages) {
                    val page = renderer.openPage(i)
                    val bitmap = Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(android.graphics.Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    page.close()
                    bitmaps.add(bitmap)
                }
                renderer.close()
                fd.close()
                pages = bitmaps
                isLoading = false
            } catch (e: Exception) {
                error = e.message
                isLoading = false
            }
        }
    }

    when {
        isLoading -> {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(16.dp))
                Text("Loading PDF...")
            }
        }
        error != null -> {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(16.dp))
                Text("Failed to load PDF")
            }
        }
        else -> {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                itemsIndexed(pages) { index, bitmap ->
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Page ${index + 1}",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(4.dp),
                        contentScale = ContentScale.FillWidth
                    )
                }
            }
        }
    }
}

@Composable
private fun UnsupportedPreview(mimeType: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.AutoMirrored.Filled.InsertDriveFile,
            null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text("No preview available", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            mimeType,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            "Use the download button to view this file",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
