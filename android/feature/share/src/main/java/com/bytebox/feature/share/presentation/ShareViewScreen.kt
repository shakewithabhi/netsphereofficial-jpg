package com.bytebox.feature.share.presentation

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SaveAlt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.ByteBoxButton
import com.bytebox.core.ui.components.ByteBoxOutlinedButton
import com.bytebox.core.ui.theme.ByteBoxTheme
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareViewScreen(
    code: String,
    onNavigateBack: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
    viewModel: ShareViewViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(code) {
        viewModel.loadShareInfo(code)
    }

    LaunchedEffect(uiState.saveError) {
        uiState.saveError?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    LaunchedEffect(uiState.isSaved) {
        if (uiState.isSaved) {
            snackbarHostState.showSnackbar("File saved to your storage!")
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Shared File") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            when {
                uiState.isLoading -> {
                    CircularProgressIndicator()
                }

                uiState.errorMessage != null -> {
                    ErrorContent(
                        message = uiState.errorMessage!!,
                        onRetry = { viewModel.loadShareInfo(code) },
                    )
                }

                uiState.needsPassword -> {
                    PasswordGate(
                        error = uiState.passwordError,
                        onSubmit = { viewModel.submitPassword(it) },
                    )
                }

                uiState.shareInfo != null -> {
                    ShareContent(
                        code = code,
                        uiState = uiState,
                        onDownload = { viewModel.downloadFile(code, context) },
                        onSaveToStorage = {
                            if (uiState.isLoggedIn) {
                                viewModel.saveToStorage(code)
                            }
                        },
                        onShare = {
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "https://byteboxapp.com/s/$code"
                                )
                            }
                            context.startActivity(Intent.createChooser(intent, "Share link"))
                        },
                        onPreviewEnded = { viewModel.onPreviewEnded() },
                        onNavigateToLogin = onNavigateToLogin,
                        onNavigateToRegister = onNavigateToRegister,
                    )
                }
            }
        }
    }
}

// region Password Gate

@Composable
private fun PasswordGate(
    error: String?,
    onSubmit: (String) -> Unit,
) {
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.padding(ByteBoxTheme.spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Surface(
            modifier = Modifier.size(80.dp),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    modifier = Modifier.size(40.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))

        Text(
            "This file is password protected",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

        Text(
            "Enter the password to view this file",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            isError = error != null,
            supportingText = error?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

        ByteBoxButton(
            text = "Submit",
            onClick = { onSubmit(password) },
            enabled = password.isNotBlank(),
        )
    }
}

// endregion

// region Share Content

@Composable
private fun ShareContent(
    code: String,
    uiState: ShareViewUiState,
    onDownload: () -> Unit,
    onSaveToStorage: () -> Unit,
    onShare: () -> Unit,
    onPreviewEnded: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    val shareInfo = uiState.shareInfo ?: return
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Video Preview
        if (shareInfo.isVideo && uiState.previewUrl != null) {
            VideoPreviewSection(
                previewUrl = uiState.previewUrl,
                previewDuration = uiState.previewDuration,
                fileName = shareInfo.fileName,
                isPreviewEnded = uiState.isPreviewEnded,
                onPreviewEnded = onPreviewEnded,
                onNavigateToLogin = onNavigateToLogin,
                onNavigateToRegister = onNavigateToRegister,
            )
        }
        // Image Preview
        else if (shareInfo.isImage && uiState.previewUrl != null) {
            ImagePreviewSection(previewUrl = uiState.previewUrl)
        }
        // File icon fallback
        else {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))
            FileIconSection(
                isFolder = shareInfo.isFolder,
                mimeType = shareInfo.mimeType,
                videoThumbnailUrl = shareInfo.videoThumbnailUrl,
                isVideo = shareInfo.isVideo,
            )
        }

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))

        // File Info
        FileInfoSection(
            fileName = shareInfo.fileName,
            fileSize = shareInfo.fileSize,
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))

        // Action Buttons
        ActionButtons(
            isLoggedIn = uiState.isLoggedIn,
            isDownloading = uiState.isDownloading,
            isSaving = uiState.isSaving,
            isSaved = uiState.isSaved,
            onDownload = onDownload,
            onSaveToStorage = onSaveToStorage,
            onShare = onShare,
            onNavigateToLogin = onNavigateToLogin,
            onNavigateToRegister = onNavigateToRegister,
        )

        // Not-logged-in promo
        if (!uiState.isLoggedIn) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))
            SignUpPromo(
                onNavigateToLogin = onNavigateToLogin,
                onNavigateToRegister = onNavigateToRegister,
            )
        }

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))
    }
}

// endregion

// region Video Preview

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun VideoPreviewSection(
    previewUrl: String,
    previewDuration: Int,
    fileName: String,
    isPreviewEnded: Boolean,
    onPreviewEnded: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    val context = LocalContext.current
    val previewDurationMs = previewDuration * 1000L

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(previewUrl))
            prepare()
            playWhenReady = true
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    var isPlaying by remember { mutableStateOf(true) }
    var isMuted by remember { mutableStateOf(false) }
    var currentPosition by remember { mutableLongStateOf(0L) }
    var totalDuration by remember { mutableLongStateOf(0L) }
    var showControls by remember { mutableStateOf(true) }

    // Enforce preview time limit
    LaunchedEffect(isPlaying, isPreviewEnded) {
        while (!isPreviewEnded) {
            currentPosition = exoPlayer.currentPosition
            totalDuration = exoPlayer.duration.coerceAtLeast(0L)
            isPlaying = exoPlayer.isPlaying

            if (previewDurationMs > 0 && currentPosition >= previewDurationMs) {
                exoPlayer.pause()
                exoPlayer.seekTo(previewDurationMs)
                onPreviewEnded()
                break
            }
            delay(250)
        }
    }

    // Auto-hide controls
    LaunchedEffect(showControls) {
        if (showControls && isPlaying && !isPreviewEnded) {
            delay(4000)
            showControls = false
        }
    }

    val effectiveMaxDuration = if (previewDurationMs > 0) {
        previewDurationMs.coerceAtMost(totalDuration)
    } else {
        totalDuration
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .background(Color.Black)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
            ) {
                showControls = !showControls
            },
    ) {
        // Video surface
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Countdown timer
        if (!isPreviewEnded && previewDurationMs > 0) {
            val remaining = ((effectiveMaxDuration - currentPosition) / 1000).coerceAtLeast(0)
            val minutes = remaining / 60
            val seconds = remaining % 60
            Surface(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(ByteBoxTheme.spacing.sm),
                shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                color = Color.Black.copy(alpha = 0.7f),
            ) {
                Text(
                    text = "Preview: $minutes:${"%02d".format(seconds)} remaining",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White,
                    modifier = Modifier.padding(
                        horizontal = ByteBoxTheme.spacing.sm,
                        vertical = ByteBoxTheme.spacing.xxs,
                    ),
                )
            }
        }

        // Control overlay
        AnimatedVisibility(
            visible = showControls && !isPreviewEnded,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.3f)),
            ) {
                // Center play/pause
                IconButton(
                    onClick = {
                        if (isPlaying) exoPlayer.pause() else exoPlayer.play()
                        isPlaying = !isPlaying
                    },
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(56.dp),
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = Color.White,
                        modifier = Modifier.size(40.dp),
                    )
                }

                // Bottom bar: seek + mute
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = ByteBoxTheme.spacing.sm),
                ) {
                    Slider(
                        value = if (effectiveMaxDuration > 0) {
                            currentPosition.toFloat() / effectiveMaxDuration.toFloat()
                        } else 0f,
                        onValueChange = { fraction ->
                            val seekTo = (fraction * effectiveMaxDuration).toLong()
                            exoPlayer.seekTo(seekTo)
                            currentPosition = seekTo
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = ByteBoxTheme.spacing.xxs),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            formatTime(currentPosition) + " / " + formatTime(effectiveMaxDuration),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                        )
                        IconButton(onClick = {
                            isMuted = !isMuted
                            exoPlayer.volume = if (isMuted) 0f else 1f
                        }) {
                            Icon(
                                if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                                contentDescription = if (isMuted) "Unmute" else "Mute",
                                tint = Color.White,
                            )
                        }
                    }
                }
            }
        }

        // Preview ended overlay
        if (isPreviewEnded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.8f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(ByteBoxTheme.spacing.xl),
                ) {
                    Text(
                        "Preview ended",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))
                    Text(
                        "Save to your ByteBox to watch the full video",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f),
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))
                    Button(
                        onClick = onNavigateToRegister,
                        modifier = Modifier.fillMaxWidth(0.7f),
                        shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    ) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                        Text("Sign Up Free")
                    }
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))
                    OutlinedButton(
                        onClick = onNavigateToLogin,
                        modifier = Modifier.fillMaxWidth(0.7f),
                        shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color.White,
                        ),
                    ) {
                        Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                        Text("Login & Save")
                    }
                }
            }
        }
    }
}

private fun formatTime(ms: Long): String {
    val totalSeconds = ms / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "$minutes:${"%02d".format(seconds)}"
}

// endregion

// region Image Preview

@Composable
private fun ImagePreviewSection(previewUrl: String) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .clip(RoundedCornerShape(0.dp))
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(1f, 5f)
                    if (scale > 1f) {
                        offsetX += pan.x
                        offsetY += pan.y
                    } else {
                        offsetX = 0f
                        offsetY = 0f
                    }
                }
            },
    ) {
        AsyncImage(
            model = previewUrl,
            contentDescription = "Image preview",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offsetX,
                    translationY = offsetY,
                ),
        )
    }
}

// endregion

// region File Icon

@Composable
private fun FileIconSection(
    isFolder: Boolean,
    mimeType: String,
    videoThumbnailUrl: String?,
    isVideo: Boolean,
) {
    if (isVideo && videoThumbnailUrl != null) {
        // Show video thumbnail
        AsyncImage(
            model = videoThumbnailUrl,
            contentDescription = "Video thumbnail",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(120.dp)
                .clip(RoundedCornerShape(ByteBoxTheme.radius.xl)),
        )
    } else {
        Surface(
            modifier = Modifier.size(96.dp),
            shape = RoundedCornerShape(ByteBoxTheme.radius.xxl),
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    when {
                        isFolder -> Icons.Default.Folder
                        mimeType.startsWith("image/") -> Icons.Default.Image
                        mimeType.startsWith("video/") -> Icons.Default.Videocam
                        mimeType.startsWith("audio/") -> Icons.Default.MusicNote
                        else -> Icons.Default.Description
                    },
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

// endregion

// region File Info

@Composable
private fun FileInfoSection(fileName: String, fileSize: Long) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.xl),
    ) {
        Text(
            text = fileName,
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        if (fileSize > 0) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
            Text(
                text = fileSize.toReadableFileSize(),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
        Text(
            text = "Shared via ByteBox",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// endregion

// region Action Buttons

@Composable
private fun ActionButtons(
    isLoggedIn: Boolean,
    isDownloading: Boolean,
    isSaving: Boolean,
    isSaved: Boolean,
    onDownload: () -> Unit,
    onSaveToStorage: () -> Unit,
    onShare: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = ByteBoxTheme.spacing.xl),
        verticalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.sm),
    ) {
        // Download button
        ByteBoxButton(
            text = "Download",
            onClick = onDownload,
            isLoading = isDownloading,
            leadingIcon = Icons.Default.Download,
        )

        // Save to My Storage button
        if (isLoggedIn) {
            ByteBoxOutlinedButton(
                text = if (isSaved) "Saved to Storage" else "Save to My Storage",
                onClick = onSaveToStorage,
                enabled = !isSaving && !isSaved,
                leadingIcon = if (isSaved) Icons.Default.Check else Icons.Default.SaveAlt,
            )
            if (isSaving) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = ByteBoxTheme.spacing.md),
                )
            }
        } else {
            ByteBoxOutlinedButton(
                text = "Save to My Storage",
                onClick = onNavigateToLogin,
                leadingIcon = Icons.Default.SaveAlt,
            )
        }

        // Share button
        ByteBoxOutlinedButton(
            text = "Share",
            onClick = onShare,
            leadingIcon = Icons.Default.Share,
        )
    }
}

// endregion

// region Sign Up Promo

@Composable
private fun SignUpPromo(
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = ByteBoxTheme.spacing.xl),
        shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
        ),
    ) {
        Column(
            modifier = Modifier.padding(ByteBoxTheme.spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "Join ByteBox",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

            val benefits = listOf(
                "Get 10GB free storage",
                "Watch full videos",
                "Access your files anywhere",
            )
            benefits.forEach { benefit ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = ByteBoxTheme.spacing.xxs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                    Text(
                        benefit,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

            Button(
                onClick = onNavigateToRegister,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
            ) {
                Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                Text("Create Free Account")
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            OutlinedButton(
                onClick = onNavigateToLogin,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
            ) {
                Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                Text("Login")
            }
        }
    }
}

// endregion

// region Error Content

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(ByteBoxTheme.spacing.xxl),
    ) {
        Icon(
            Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
        Text(
            message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
        ByteBoxOutlinedButton(
            text = "Retry",
            onClick = onRetry,
        )
    }
}

// endregion
