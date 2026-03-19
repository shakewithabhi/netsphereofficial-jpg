package com.bytebox.feature.explore.presentation

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.util.Rational
import android.view.View
import android.view.WindowInsetsController
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Comment
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPicture
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SlowMotionVideo
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toRelativeTime
import com.bytebox.domain.model.ExploreItem
import kotlinx.coroutines.delay

private data class SpeedOption(val label: String, val speed: Float)

private val speedOptions = listOf(
    SpeedOption("0.5x", 0.5f),
    SpeedOption("0.75x", 0.75f),
    SpeedOption("Normal", 1.0f),
    SpeedOption("1.25x", 1.25f),
    SpeedOption("1.5x", 1.5f),
    SpeedOption("2x", 2.0f),
)

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreVideoScreen(
    code: String,
    onNavigateBack: () -> Unit,
    onNavigateToItem: ((code: String) -> Unit)? = null,
    viewModel: ExploreVideoViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context as? Activity
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    // Track fullscreen state
    var isFullscreen by remember { mutableStateOf(false) }

    // Enter/exit immersive mode
    @Suppress("DEPRECATION")
    fun enterImmersive() {
        activity?.let { act ->
            act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            val window = act.window
            // Use both old and new APIs for maximum compatibility
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
            WindowInsetsControllerCompat(window, window.decorView).let { controller ->
                controller.hide(WindowInsetsCompat.Type.systemBars())
                controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        }
    }

    @Suppress("DEPRECATION")
    fun exitImmersive() {
        activity?.let { act ->
            act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            val window = act.window
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            WindowCompat.setDecorFitsSystemWindows(window, true)
            WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
        }
    }

    // Handle back in fullscreen: exit fullscreen instead of navigating back
    BackHandler(enabled = isFullscreen) {
        isFullscreen = false
        exitImmersive()
    }

    // Sync fullscreen with orientation and re-apply immersive after config change
    LaunchedEffect(isLandscape) {
        isFullscreen = isLandscape
        if (isLandscape) {
            // Re-apply immersive after orientation change (config change resets system UI)
            delay(100)
            enterImmersive()
        }
    }

    // Restore on dispose
    @Suppress("DEPRECATION")
    DisposableEffect(Unit) {
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            activity?.let { act ->
                val window = act.window
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
                WindowCompat.setDecorFitsSystemWindows(window, true)
                WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    LaunchedEffect(code) { viewModel.load(code) }

    if (isFullscreen) {
        // Fullscreen: only show the video player
        val info = uiState.shareInfo
        val hlsUrl = info?.hlsUrl
        val downloadUrl = uiState.downloadUrl
        val videoUrl = hlsUrl ?: downloadUrl

        if (videoUrl != null) {
            YouTubeStylePlayer(
                hlsUrl = if (hlsUrl != null) hlsUrl else null,
                progressiveUrl = if (hlsUrl == null) videoUrl else null,
                thumbnailUrl = info?.videoThumbnailUrl ?: info?.thumbnailUrl,
                isFullscreen = true,
                onToggleFullscreen = {
                    isFullscreen = false
                    exitImmersive()
                },
                onPipRequest = { enterPip(activity) },
            )
        } else {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.White)
            }
        }
    } else {
        // Normal portrait mode
        Scaffold(
            containerColor = Color(0xFF0F172A),
            topBar = {
                TopAppBar(
                    title = {},
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White,
                            )
                        }
                    },
                    windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Black,
                        navigationIconContentColor = Color.White,
                    ),
                )
            },
        ) { padding ->
            when {
                uiState.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Color.White)
                    }
                }
                uiState.error != null -> {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(uiState.error!!, color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(16.dp))
                            TextButton(onClick = { viewModel.load(code) }) { Text("Retry", color = Color(0xFF60A5FA)) }
                        }
                    }
                }
                else -> {
                    val info = uiState.shareInfo
                    val listState = rememberLazyListState()
                    Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize().imePadding(),
                        ) {
                            // Video player
                            item {
                                val hlsUrl = info?.hlsUrl
                                val isImage = info?.mimeType?.startsWith("image/") == true
                                when {
                                    info?.isVideo == true && !hlsUrl.isNullOrBlank() -> {
                                        YouTubeStylePlayer(
                                            hlsUrl = hlsUrl,
                                            thumbnailUrl = info.videoThumbnailUrl ?: info.thumbnailUrl,
                                            isFullscreen = false,
                                            onToggleFullscreen = {
                                                isFullscreen = true
                                                enterImmersive()
                                            },
                                            onPipRequest = { enterPip(activity) },
                                        )
                                    }
                                    info?.isVideo == true -> {
                                        val downloadUrl = uiState.downloadUrl
                                        if (downloadUrl != null) {
                                            YouTubeStylePlayer(
                                                progressiveUrl = downloadUrl,
                                                thumbnailUrl = info.videoThumbnailUrl ?: info.thumbnailUrl,
                                                isFullscreen = false,
                                                onToggleFullscreen = {
                                                    isFullscreen = true
                                                    activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                                                },
                                                onPipRequest = { enterPip(activity) },
                                            )
                                        } else {
                                            LaunchedEffect(code) { viewModel.fetchDownloadUrl(code) {} }
                                            Box(
                                                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                                                contentAlignment = Alignment.Center,
                                            ) { CircularProgressIndicator(color = Color.White) }
                                        }
                                    }
                                    isImage -> {
                                        val previewUrl = info.thumbnailUrl ?: uiState.downloadUrl
                                        if (previewUrl != null) {
                                            Box(modifier = Modifier.fillMaxWidth().background(Color.Black), contentAlignment = Alignment.Center) {
                                                SubcomposeAsyncImage(
                                                    model = previewUrl, contentDescription = info.fileName,
                                                    modifier = Modifier.fillMaxWidth(), contentScale = ContentScale.FillWidth,
                                                    error = { FilePreviewPlaceholder() },
                                                )
                                            }
                                        } else {
                                            LaunchedEffect(code) { viewModel.fetchDownloadUrl(code) {} }
                                            Box(
                                                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                                                contentAlignment = Alignment.Center,
                                            ) { CircularProgressIndicator(color = Color.White) }
                                        }
                                    }
                                    else -> {
                                        Box(
                                            modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            val preview = info?.videoThumbnailUrl ?: info?.thumbnailUrl
                                            if (preview != null) {
                                                SubcomposeAsyncImage(model = preview, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, error = { FilePreviewPlaceholder() })
                                            } else { FilePreviewPlaceholder() }
                                        }
                                    }
                                }
                            }

                            // Title and metadata
                            item {
                                Column(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(16.dp)) {
                                    Text(info?.fileName ?: "Shared File", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        if (info?.ownerName?.isNotEmpty() == true) { Text("@${info.ownerName}", fontSize = 13.sp, color = Color(0xFF94A3B8)); Text("  ·  ", fontSize = 13.sp, color = Color(0xFF64748B)) }
                                        val fileSize = info?.fileSize; if (fileSize != null && fileSize > 0) { Text(fileSize.toReadableFileSize(), fontSize = 13.sp, color = Color(0xFF94A3B8)); Text("  ·  ", fontSize = 13.sp, color = Color(0xFF64748B)) }
                                        Text("${info?.downloadCount ?: 0} downloads", fontSize = 13.sp, color = Color(0xFF94A3B8))
                                    }
                                }
                            }

                            // Action buttons
                            item {
                                Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    FilledTonalButton(onClick = { viewModel.toggleLike(code) }, modifier = Modifier.weight(1f), enabled = !uiState.isLikeLoading) {
                                        if (uiState.isLikeLoading) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                        else Icon(if (info?.isLiked == true) Icons.Default.Favorite else Icons.Default.FavoriteBorder, "Like", tint = if (info?.isLiked == true) Color(0xFFEF4444) else Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp)); Text("${info?.likeCount ?: 0} Likes", color = if (info?.isLiked == true) Color(0xFFEF4444) else Color(0xFF94A3B8))
                                    }
                                    FilledTonalButton(onClick = { viewModel.fetchDownloadUrl(code) { url -> context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }, modifier = Modifier.weight(1f), enabled = !uiState.isDownloading) {
                                        if (uiState.isDownloading) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                        else Icon(Icons.Default.Download, "Download", modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp)); Text("Download")
                                    }
                                }
                            }

                            // Related videos
                            if (uiState.relatedItems.isNotEmpty()) {
                                item { HorizontalDivider(color = Color(0xFF334155), thickness = 1.dp); Text("Up next", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(horizontal = 16.dp, vertical = 12.dp)) }
                                items(uiState.relatedItems, key = { "related_${it.id}" }) { relatedItem -> RelatedItemRow(item = relatedItem, onClick = { onNavigateToItem?.invoke(relatedItem.code) }) }
                                item { HorizontalDivider(color = Color(0xFF334155), thickness = 1.dp) }
                            }

                            // Comments
                            item {
                                Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.AutoMirrored.Filled.Comment, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp)); Spacer(modifier = Modifier.width(8.dp))
                                    Text("${info?.commentCount ?: uiState.comments.size} Comments", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = Color.White)
                                }
                            }
                            item {
                                Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    OutlinedTextField(value = uiState.commentText, onValueChange = viewModel::updateCommentText, modifier = Modifier.weight(1f), placeholder = { Text("Add a comment...", color = Color(0xFF64748B), fontSize = 14.sp) }, isError = uiState.commentError != null, singleLine = true, shape = RoundedCornerShape(24.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    IconButton(onClick = { viewModel.submitComment(code) }, enabled = !uiState.isSubmittingComment && uiState.commentText.isNotBlank()) {
                                        if (uiState.isSubmittingComment) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color(0xFF60A5FA))
                                        else Icon(Icons.AutoMirrored.Filled.Send, "Send", tint = if (uiState.commentText.isNotBlank()) Color(0xFF60A5FA) else Color(0xFF475569))
                                    }
                                }
                                if (uiState.commentError != null) Text(uiState.commentError!!, color = Color(0xFFEF4444), fontSize = 12.sp, modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(start = 16.dp, end = 16.dp, bottom = 8.dp))
                            }
                            if (uiState.isCommentsLoading) { item { Box(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = Color(0xFF60A5FA)) } } }
                            else if (uiState.comments.isEmpty()) { item { Box(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(32.dp), contentAlignment = Alignment.Center) { Text("No comments yet. Be the first!", color = Color(0xFF64748B), fontSize = 14.sp, textAlign = TextAlign.Center) } } }
                            else { items(uiState.comments, key = { it.id }) { comment -> CommentItem(comment.userName, comment.content, comment.createdAt) } }
                            item { Spacer(modifier = Modifier.height(24.dp)) }
                        }
                    }
                }
            }
        }
    }
}

private fun enterPip(activity: Activity?) {
    if (activity == null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .build()
        activity.enterPictureInPictureMode(params)
    }
}

// ── YouTube-style video player with full controls ─────────────────────────────

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun YouTubeStylePlayer(
    hlsUrl: String? = null,
    progressiveUrl: String? = null,
    thumbnailUrl: String?,
    isFullscreen: Boolean = false,
    onToggleFullscreen: () -> Unit = {},
    onPipRequest: () -> Unit = {},
) {
    val context = LocalContext.current
    val videoUrl = hlsUrl ?: progressiveUrl ?: return

    val exoPlayer = remember(videoUrl) {
        ExoPlayer.Builder(context).build().apply {
            if (hlsUrl != null) {
                val dataSourceFactory = DefaultHttpDataSource.Factory()
                val hlsSource = HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(hlsUrl))
                setMediaSource(hlsSource)
            } else {
                setMediaItem(MediaItem.fromUri(videoUrl))
            }
            prepare()
            playWhenReady = false
        }
    }

    DisposableEffect(exoPlayer) { onDispose { exoPlayer.release() } }

    var isPlaying by remember { mutableStateOf(false) }
    var showControls by remember { mutableStateOf(true) }
    var currentPosition by remember { mutableLongStateOf(0L) }
    var totalDuration by remember { mutableLongStateOf(0L) }
    var isSeeking by remember { mutableStateOf(false) }
    var seekPosition by remember { mutableFloatStateOf(0f) }
    var isBuffering by remember { mutableStateOf(false) }
    var currentSpeed by remember { mutableFloatStateOf(1f) }
    var showSpeedMenu by remember { mutableStateOf(false) }
    var showSettingsMenu by remember { mutableStateOf(false) }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            if (!isSeeking) { currentPosition = exoPlayer.currentPosition; totalDuration = exoPlayer.duration.coerceAtLeast(0L) }
            delay(250)
        }
    }
    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying) { delay(4000); showControls = false }
    }
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing }
            override fun onPlaybackStateChanged(state: Int) { isBuffering = state == Player.STATE_BUFFERING }
        }
        exoPlayer.addListener(listener)
        onDispose { exoPlayer.removeListener(listener) }
    }

    val playerModifier = if (isFullscreen) Modifier.fillMaxSize().background(Color.Black)
    else Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black)

    Box(
        modifier = playerModifier.clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { showControls = !showControls },
    ) {
        // Thumbnail
        if (!isPlaying && currentPosition == 0L && thumbnailUrl != null) {
            SubcomposeAsyncImage(
                model = thumbnailUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                error = {
                    Box(modifier = Modifier.fillMaxSize().background(Color.Black))
                },
            )
        }
        // ExoPlayer
        AndroidView(
            factory = { ctx -> PlayerView(ctx).apply { player = exoPlayer; useController = false; setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER) } },
            modifier = Modifier.fillMaxSize(),
        )
        // Buffering
        if (isBuffering) { Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color.White, modifier = Modifier.size(40.dp), strokeWidth = 3.dp) } }

        // Controls overlay
        AnimatedVisibility(visible = showControls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f))) {
                // Top-right: settings, PiP
                Row(modifier = Modifier.align(Alignment.TopEnd).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Speed indicator
                    if (currentSpeed != 1f) {
                        Surface(shape = RoundedCornerShape(4.dp), color = Color.Black.copy(alpha = 0.7f), modifier = Modifier.clickable { showSpeedMenu = true }) {
                            Text("${currentSpeed}x", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }
                    // Settings button (speed + quality)
                    Box {
                        IconButton(onClick = { showSettingsMenu = !showSettingsMenu; showControls = true }) {
                            Icon(Icons.Default.Settings, "Settings", tint = Color.White, modifier = Modifier.size(24.dp))
                        }
                        DropdownMenu(expanded = showSettingsMenu, onDismissRequest = { showSettingsMenu = false }) {
                            // Speed submenu
                            Text("Playback Speed", fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                            speedOptions.forEach { option ->
                                DropdownMenuItem(
                                    text = {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(option.label, fontWeight = if (currentSpeed == option.speed) FontWeight.Bold else FontWeight.Normal)
                                            if (currentSpeed == option.speed) { Spacer(Modifier.width(8.dp)); Text("✓", color = Color(0xFF3B82F6)) }
                                        }
                                    },
                                    onClick = {
                                        currentSpeed = option.speed
                                        exoPlayer.playbackParameters = PlaybackParameters(option.speed)
                                        showSettingsMenu = false
                                    },
                                )
                            }
                            HorizontalDivider()
                            // Quality (informational)
                            DropdownMenuItem(
                                text = { Text("Quality: Auto") },
                                onClick = { showSettingsMenu = false },
                            )
                        }
                    }
                    // PiP button
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        IconButton(onClick = { onPipRequest(); showControls = true }) {
                            Icon(Icons.Default.PictureInPicture, "Picture in Picture", tint = Color.White, modifier = Modifier.size(24.dp))
                        }
                    }
                }

                // Center: rewind, play/pause, forward
                Row(modifier = Modifier.align(Alignment.Center), horizontalArrangement = Arrangement.spacedBy(32.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { exoPlayer.seekTo((exoPlayer.currentPosition - 10_000).coerceAtLeast(0)); showControls = true }, modifier = Modifier.size(48.dp)) {
                        Icon(Icons.Default.Replay10, "Rewind 10s", tint = Color.White, modifier = Modifier.size(36.dp))
                    }
                    Surface(shape = CircleShape, color = Color.Black.copy(alpha = 0.6f), modifier = Modifier.size(64.dp).clickable { if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play(); showControls = true }) {
                        Box(contentAlignment = Alignment.Center) { Icon(if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, if (isPlaying) "Pause" else "Play", tint = Color.White, modifier = Modifier.size(40.dp)) }
                    }
                    IconButton(onClick = { exoPlayer.seekTo((exoPlayer.currentPosition + 10_000).coerceAtMost(exoPlayer.duration)); showControls = true }, modifier = Modifier.size(48.dp)) {
                        Icon(Icons.Default.Forward10, "Forward 10s", tint = Color.White, modifier = Modifier.size(36.dp))
                    }
                }

                // Bottom: seekbar + timestamps + fullscreen
                if (totalDuration > 0) {
                    Column(modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Slider(
                            value = if (isSeeking) seekPosition else (currentPosition.toFloat() / totalDuration.toFloat()).coerceIn(0f, 1f),
                            onValueChange = { isSeeking = true; seekPosition = it },
                            onValueChangeFinished = { exoPlayer.seekTo((seekPosition * totalDuration).toLong()); isSeeking = false; showControls = true },
                            modifier = Modifier.fillMaxWidth().height(24.dp),
                            colors = SliderDefaults.colors(thumbColor = Color(0xFFEF4444), activeTrackColor = Color(0xFFEF4444), inactiveTrackColor = Color.White.copy(alpha = 0.3f)),
                        )
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(formatDuration(if (isSeeking) (seekPosition * totalDuration).toLong() else currentPosition), color = Color.White, fontSize = 11.sp)
                            Text(" / ", color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
                            Text(formatDuration(totalDuration), color = Color.White, fontSize = 11.sp)
                            Spacer(modifier = Modifier.weight(1f))
                            // Fullscreen toggle
                            IconButton(onClick = { onToggleFullscreen(); showControls = true }, modifier = Modifier.size(36.dp)) {
                                Icon(
                                    if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                                    "Fullscreen",
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilePreviewPlaceholder() {
    Box(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f), contentAlignment = Alignment.Center) {
        Icon(Icons.Default.VideoFile, null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(64.dp))
    }
}

@Composable
private fun RelatedItemRow(item: ExploreItem, onClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(width = 140.dp, height = 80.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFF334155)), contentAlignment = Alignment.Center) {
            if (item.thumbnailUrl != null) {
                SubcomposeAsyncImage(model = item.thumbnailUrl, contentDescription = item.fileName, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, error = { Icon(Icons.Default.VideoFile, null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(32.dp)) })
            } else { Icon(Icons.Default.VideoFile, null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(32.dp)) }
            if (item.category == FileCategory.VIDEO) { Surface(shape = CircleShape, color = Color.Black.copy(alpha = 0.6f), modifier = Modifier.size(28.dp)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(16.dp)) } } }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(item.fileName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(modifier = Modifier.height(4.dp))
            Text(buildString { if (item.ownerName.isNotEmpty()) append("@${item.ownerName}"); append("  ·  ${item.downloadCount} views"); append("  ·  ${item.fileSize.toReadableFileSize()}") }, style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CommentItem(userName: String, content: String, createdAt: String) {
    Row(modifier = Modifier.fillMaxWidth().background(Color(0xFF1E293B)).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.Top) {
        Surface(shape = CircleShape, color = Color(0xFF334155), modifier = Modifier.size(36.dp)) { Box(contentAlignment = Alignment.Center) { Text((userName.firstOrNull()?.uppercaseChar() ?: '?').toString(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) } }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (userName.isNotBlank()) "@$userName" else "User", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFFE2E8F0))
                Text(try { createdAt.toLocalDateTime().toRelativeTime() } catch (_: Exception) { "" }, fontSize = 11.sp, color = Color(0xFF64748B))
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(content, fontSize = 14.sp, color = Color(0xFFCBD5E1))
        }
    }
    HorizontalDivider(color = Color(0xFF334155), thickness = 0.5.dp, modifier = Modifier.padding(horizontal = 16.dp))
}

private fun formatDuration(ms: Long): String {
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}
