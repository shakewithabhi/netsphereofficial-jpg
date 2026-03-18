package com.bytebox.feature.preview.presentation

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import java.util.concurrent.TimeUnit

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
                        FileCategory.VIDEO -> VideoPreview(
                            url = uiState.previewUrl!!,
                            fileName = uiState.fileName ?: "Video"
                        )
                        FileCategory.AUDIO -> AudioPreview(
                            url = uiState.previewUrl!!,
                            fileName = uiState.fileName ?: "Audio"
                        )
                        FileCategory.PDF -> PdfPreview(url = uiState.previewUrl!!)
                        FileCategory.TEXT_DOCUMENT -> TextDocumentPreview(
                            textContent = uiState.textContent,
                            isLoading = uiState.isDownloading,
                            fileName = uiState.fileName ?: "Text File"
                        )
                        FileCategory.OFFICE_DOCUMENT -> OfficeDocumentPreview(
                            url = uiState.previewUrl!!,
                            mimeType = mimeType,
                            fileName = uiState.fileName ?: "Document",
                            localFilePath = uiState.localFilePath,
                            isDownloading = uiState.isDownloading,
                            downloadProgress = uiState.downloadProgress,
                            onDownloadForOpen = {
                                val ext = when {
                                    mimeType.contains("word") || mimeType.contains("document") -> ".docx"
                                    mimeType.contains("excel") || mimeType.contains("sheet") -> ".xlsx"
                                    mimeType.contains("powerpoint") || mimeType.contains("presentation") -> ".pptx"
                                    else -> ""
                                }
                                viewModel.downloadFileForPreview(uiState.previewUrl!!, ext)
                            }
                        )
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

// region Version History

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

// endregion

// region Image Preview

@Composable
private fun ImagePreview(url: String) {
    AsyncImage(
        model = url,
        contentDescription = "Image preview",
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Fit
    )
}

// endregion

// region Video Preview with Controls

private val PLAYBACK_SPEEDS = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun VideoPreview(url: String, fileName: String) {
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

    var showControls by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var currentPosition by remember { mutableLongStateOf(0L) }
    var totalDuration by remember { mutableLongStateOf(0L) }
    var currentSpeedIndex by remember { mutableIntStateOf(2) } // 1.0x default
    var isFullscreen by remember { mutableStateOf(false) }
    var showSubtitleMessage by remember { mutableStateOf(false) }
    var showSpeedMenu by remember { mutableStateOf(false) }

    // Update position periodically
    LaunchedEffect(isPlaying) {
        while (true) {
            currentPosition = exoPlayer.currentPosition
            totalDuration = exoPlayer.duration.coerceAtLeast(0L)
            isPlaying = exoPlayer.isPlaying
            delay(500)
        }
    }

    // Auto-hide controls
    LaunchedEffect(showControls) {
        if (showControls && isPlaying) {
            delay(4000)
            showControls = false
        }
    }

    // Handle fullscreen orientation
    val activity = context as? Activity
    DisposableEffect(isFullscreen) {
        if (isFullscreen) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        } else {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) {
                showControls = !showControls
            }
    ) {
        // Video surface
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false // We use our own controls
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Control overlay
        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.4f))
            ) {
                // Top bar: back, file name, CC button
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .align(Alignment.TopCenter),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = fileName,
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 8.dp)
                    )
                    IconButton(onClick = {
                        showSubtitleMessage = true
                    }) {
                        Icon(
                            Icons.Default.ClosedCaption,
                            contentDescription = "Subtitles",
                            tint = Color.White
                        )
                    }
                }

                // Center: rewind, play/pause, forward
                Row(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalArrangement = Arrangement.spacedBy(32.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Rewind 10s
                    IconButton(
                        onClick = {
                            exoPlayer.seekTo((exoPlayer.currentPosition - 10_000).coerceAtLeast(0))
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            Icons.Default.Replay10,
                            contentDescription = "Rewind 10 seconds",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }

                    // Play/Pause
                    IconButton(
                        onClick = {
                            if (exoPlayer.isPlaying) {
                                exoPlayer.pause()
                            } else {
                                exoPlayer.play()
                            }
                            isPlaying = !isPlaying
                        },
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.2f))
                    ) {
                        Icon(
                            if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(48.dp)
                        )
                    }

                    // Forward 10s
                    IconButton(
                        onClick = {
                            exoPlayer.seekTo(
                                (exoPlayer.currentPosition + 10_000)
                                    .coerceAtMost(exoPlayer.duration)
                            )
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            Icons.Default.Forward10,
                            contentDescription = "Forward 10 seconds",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                }

                // Bottom: seekbar, time, speed, fullscreen
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    // Seek bar
                    Slider(
                        value = if (totalDuration > 0) {
                            currentPosition.toFloat() / totalDuration.toFloat()
                        } else 0f,
                        onValueChange = { fraction ->
                            exoPlayer.seekTo((fraction * totalDuration).toLong())
                        },
                        colors = SliderDefaults.colors(
                            thumbColor = MaterialTheme.colorScheme.primary,
                            activeTrackColor = MaterialTheme.colorScheme.primary,
                            inactiveTrackColor = Color.White.copy(alpha = 0.3f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Time and controls row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Current time / total time
                        Text(
                            text = "${formatDuration(currentPosition)} / ${formatDuration(totalDuration)}",
                            color = Color.White,
                            style = MaterialTheme.typography.bodySmall
                        )

                        Spacer(modifier = Modifier.weight(1f))

                        // Speed button
                        Box {
                            TextButton(onClick = { showSpeedMenu = true }) {
                                Text(
                                    text = "${PLAYBACK_SPEEDS[currentSpeedIndex]}x",
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            DropdownMenu(
                                expanded = showSpeedMenu,
                                onDismissRequest = { showSpeedMenu = false }
                            ) {
                                PLAYBACK_SPEEDS.forEachIndexed { index, speed ->
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = "${speed}x",
                                                fontWeight = if (index == currentSpeedIndex) {
                                                    FontWeight.Bold
                                                } else FontWeight.Normal
                                            )
                                        },
                                        onClick = {
                                            currentSpeedIndex = index
                                            exoPlayer.setPlaybackSpeed(speed)
                                            showSpeedMenu = false
                                        },
                                        leadingIcon = if (index == currentSpeedIndex) {
                                            {
                                                Icon(
                                                    Icons.Default.Check,
                                                    contentDescription = null,
                                                    tint = MaterialTheme.colorScheme.primary
                                                )
                                            }
                                        } else null
                                    )
                                }
                            }
                        }

                        // Fullscreen toggle
                        IconButton(onClick = { isFullscreen = !isFullscreen }) {
                            Icon(
                                if (isFullscreen) Icons.Default.FullscreenExit
                                else Icons.Default.Fullscreen,
                                contentDescription = if (isFullscreen) "Exit fullscreen"
                                else "Enter fullscreen",
                                tint = Color.White
                            )
                        }
                    }
                }
            }
        }

        // Subtitle snackbar
        if (showSubtitleMessage) {
            Snackbar(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp),
                action = {
                    TextButton(onClick = { showSubtitleMessage = false }) {
                        Text("OK")
                    }
                }
            ) {
                Text("No subtitles available")
            }

            LaunchedEffect(showSubtitleMessage) {
                delay(3000)
                showSubtitleMessage = false
            }
        }
    }
}

private fun formatDuration(millis: Long): String {
    if (millis <= 0) return "0:00"
    val hours = TimeUnit.MILLISECONDS.toHours(millis)
    val minutes = TimeUnit.MILLISECONDS.toMinutes(millis) % 60
    val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%d:%02d", minutes, seconds)
    }
}

// endregion

// region Audio Preview

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

// endregion

// region PDF Preview

@Composable
private fun PdfPreview(url: String) {
    val context = LocalContext.current
    var pages by remember { mutableStateOf<List<Bitmap>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var totalPageCount by remember { mutableIntStateOf(0) }

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
                totalPageCount = renderer.pageCount
                val bitmaps = mutableListOf<Bitmap>()
                val maxPages = minOf(renderer.pageCount, 50)
                for (i in 0 until maxPages) {
                    val page = renderer.openPage(i)
                    val bitmap = Bitmap.createBitmap(
                        page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888
                    )
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
            val listState = rememberLazyListState()
            val currentVisiblePage by remember {
                derivedStateOf {
                    listState.firstVisibleItemIndex + 1
                }
            }

            Box(modifier = Modifier.fillMaxSize()) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize()
                ) {
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

                // Page indicator overlay
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
                    shadowElevation = 4.dp
                ) {
                    Text(
                        text = "Page $currentVisiblePage of $totalPageCount",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// endregion

// region Text Document Preview

@Composable
private fun TextDocumentPreview(
    textContent: String?,
    isLoading: Boolean,
    fileName: String
) {
    when {
        isLoading -> {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(16.dp))
                Text("Loading document...")
            }
        }
        textContent != null -> {
            Column(modifier = Modifier.fillMaxSize()) {
                // File name header
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ) {
                    Text(
                        text = fileName,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                // Scrollable text content
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp)
                ) {
                    Text(
                        text = textContent,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        lineHeight = 20.sp,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
        else -> {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(16.dp))
                Text("Failed to load document")
            }
        }
    }
}

// endregion

// region Office Document Preview

@Composable
private fun OfficeDocumentPreview(
    url: String,
    mimeType: String,
    fileName: String,
    localFilePath: String?,
    isDownloading: Boolean,
    downloadProgress: Float,
    onDownloadForOpen: () -> Unit
) {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.AutoMirrored.Filled.InsertDriveFile,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = fileName,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))

        val docType = when {
            mimeType.contains("word") || mimeType.contains("document") -> "Word Document"
            mimeType.contains("excel") || mimeType.contains("sheet") -> "Excel Spreadsheet"
            mimeType.contains("powerpoint") || mimeType.contains("presentation") -> "PowerPoint Presentation"
            else -> "Office Document"
        }
        Text(
            text = docType,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (isDownloading) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(8.dp))
                if (downloadProgress > 0f) {
                    Text(
                        text = "${(downloadProgress * 100).toInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else if (localFilePath != null) {
            // File is downloaded, open in external app
            Button(
                onClick = {
                    try {
                        val file = File(localFilePath)
                        val uri = FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            file
                        )
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, mimeType)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        context.startActivity(Intent.createChooser(intent, "Open with"))
                    } catch (_: Exception) {
                        // Fallback: no app to handle this type
                    }
                }
            ) {
                Icon(Icons.Default.OpenInNew, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open in External App")
            }
        } else {
            // Offer to download and open
            Text(
                text = "This document type cannot be previewed in-app.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onDownloadForOpen) {
                Icon(Icons.Default.OpenInNew, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open in External App")
            }
        }
    }
}

// endregion

// region Unsupported Preview

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

// endregion
