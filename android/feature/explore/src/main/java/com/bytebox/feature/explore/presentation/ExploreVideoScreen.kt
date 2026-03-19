package com.bytebox.feature.explore.presentation

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
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
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toRelativeTime
import kotlinx.coroutines.delay

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreVideoScreen(
    code: String,
    onNavigateBack: () -> Unit,
    viewModel: ExploreVideoViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(code) { viewModel.load(code) }

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
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Color.White)
                }
            }
            uiState.error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            uiState.error!!,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(16.dp),
                        )
                        TextButton(onClick = { viewModel.load(code) }) {
                            Text("Retry", color = Color(0xFF60A5FA))
                        }
                    }
                }
            }
            else -> {
                val info = uiState.shareInfo
                val listState = rememberLazyListState()
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .imePadding(),
                ) {
                    // Video player or image/file preview
                    item {
                        val hlsUrl = info?.hlsUrl
                        val isImage = info?.mimeType?.startsWith("image/") == true
                        when {
                            info?.isVideo == true && !hlsUrl.isNullOrBlank() -> {
                                HlsVideoPlayer(
                                    hlsUrl = hlsUrl,
                                    thumbnailUrl = info.videoThumbnailUrl ?: info.thumbnailUrl,
                                )
                            }
                            isImage -> {
                                // Show image using thumbnail URL (presigned) or trigger download URL
                                val previewUrl = info.thumbnailUrl ?: uiState.downloadUrl
                                if (previewUrl != null) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Color.Black),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        AsyncImage(
                                            model = previewUrl,
                                            contentDescription = info.fileName,
                                            modifier = Modifier.fillMaxWidth(),
                                            contentScale = ContentScale.FillWidth,
                                        )
                                    }
                                } else {
                                    // Trigger fetch of download URL to show image
                                    LaunchedEffect(code) { viewModel.fetchDownloadUrl(code) {} }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .aspectRatio(16f / 9f)
                                            .background(Color.Black),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        CircularProgressIndicator(color = Color.White)
                                    }
                                }
                            }
                            else -> {
                                // Non-playable: show thumbnail or generic icon
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(16f / 9f)
                                        .background(Color.Black),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    val preview = info?.videoThumbnailUrl ?: info?.thumbnailUrl
                                    if (preview != null) {
                                        AsyncImage(
                                            model = preview,
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop,
                                        )
                                    } else {
                                        Icon(
                                            Icons.Default.VideoFile,
                                            contentDescription = null,
                                            tint = Color.White.copy(alpha = 0.4f),
                                            modifier = Modifier.size(64.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Title and metadata
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF1E293B))
                                .padding(16.dp),
                        ) {
                            Text(
                                text = info?.fileName ?: "Shared File",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (info?.ownerName?.isNotEmpty() == true) {
                                    Text(
                                        text = "@${info.ownerName}",
                                        fontSize = 13.sp,
                                        color = Color(0xFF94A3B8),
                                    )
                                    Text(
                                        text = "  ·  ",
                                        fontSize = 13.sp,
                                        color = Color(0xFF64748B),
                                    )
                                }
                                val fileSize = info?.fileSize
                                if (fileSize != null && fileSize > 0) {
                                    Text(
                                        text = fileSize.toReadableFileSize(),
                                        fontSize = 13.sp,
                                        color = Color(0xFF94A3B8),
                                    )
                                    Text(
                                        text = "  ·  ",
                                        fontSize = 13.sp,
                                        color = Color(0xFF64748B),
                                    )
                                }
                                Text(
                                    text = "${info?.downloadCount ?: 0} downloads",
                                    fontSize = 13.sp,
                                    color = Color(0xFF94A3B8),
                                )
                            }
                        }
                    }

                    // Action buttons: Like + Download
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF1E293B))
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            // Like button
                            FilledTonalButton(
                                onClick = { viewModel.toggleLike(code) },
                                modifier = Modifier.weight(1f),
                                enabled = !uiState.isLikeLoading,
                            ) {
                                if (uiState.isLikeLoading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                    )
                                } else {
                                    Icon(
                                        imageVector = if (info?.isLiked == true) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = "Like",
                                        tint = if (info?.isLiked == true) Color(0xFFEF4444) else Color(0xFF94A3B8),
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "${info?.likeCount ?: 0} Likes",
                                    color = if (info?.isLiked == true) Color(0xFFEF4444) else Color(0xFF94A3B8),
                                )
                            }

                            // Download button
                            FilledTonalButton(
                                onClick = {
                                    viewModel.fetchDownloadUrl(code) { url ->
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                        context.startActivity(intent)
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                enabled = !uiState.isDownloading,
                            ) {
                                if (uiState.isDownloading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                    )
                                } else {
                                    Icon(
                                        Icons.Default.Download,
                                        contentDescription = "Download",
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Download")
                            }
                        }
                    }

                    // Comments section header
                    item {
                        HorizontalDivider(color = Color(0xFF334155), thickness = 1.dp)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF1E293B))
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Comment,
                                contentDescription = null,
                                tint = Color(0xFF94A3B8),
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "${info?.commentCount ?: uiState.comments.size} Comments",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                            )
                        }
                    }

                    // Comment input
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF1E293B))
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedTextField(
                                value = uiState.commentText,
                                onValueChange = viewModel::updateCommentText,
                                modifier = Modifier.weight(1f),
                                placeholder = {
                                    Text(
                                        "Add a comment...",
                                        color = Color(0xFF64748B),
                                        fontSize = 14.sp,
                                    )
                                },
                                isError = uiState.commentError != null,
                                singleLine = true,
                                shape = RoundedCornerShape(24.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            IconButton(
                                onClick = { viewModel.submitComment(code) },
                                enabled = !uiState.isSubmittingComment && uiState.commentText.isNotBlank(),
                            ) {
                                if (uiState.isSubmittingComment) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        strokeWidth = 2.dp,
                                        color = Color(0xFF60A5FA),
                                    )
                                } else {
                                    Icon(
                                        Icons.AutoMirrored.Filled.Send,
                                        contentDescription = "Send",
                                        tint = if (uiState.commentText.isNotBlank()) Color(0xFF60A5FA) else Color(0xFF475569),
                                    )
                                }
                            }
                        }
                        if (uiState.commentError != null) {
                            Text(
                                text = uiState.commentError!!,
                                color = Color(0xFFEF4444),
                                fontSize = 12.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF1E293B))
                                    .padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                            )
                        }
                    }

                    // Comments list
                    if (uiState.isCommentsLoading) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF1E293B))
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(24.dp),
                                    strokeWidth = 2.dp,
                                    color = Color(0xFF60A5FA),
                                )
                            }
                        }
                    } else if (uiState.comments.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF1E293B))
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "No comments yet. Be the first!",
                                    color = Color(0xFF64748B),
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    } else {
                        items(uiState.comments, key = { it.id }) { comment ->
                            CommentItem(
                                userName = comment.userName,
                                content = comment.content,
                                createdAt = comment.createdAt,
                            )
                        }
                    }

                    // Bottom padding
                    item { Spacer(modifier = Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun HlsVideoPlayer(
    hlsUrl: String,
    thumbnailUrl: String?,
) {
    val context = LocalContext.current
    val exoPlayer = remember(hlsUrl) {
        val dataSourceFactory = DefaultHttpDataSource.Factory()
        val hlsMediaSource = HlsMediaSource.Factory(dataSourceFactory)
            .createMediaSource(MediaItem.fromUri(hlsUrl))
        ExoPlayer.Builder(context).build().apply {
            setMediaSource(hlsMediaSource)
            prepare()
            playWhenReady = false
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose { exoPlayer.release() }
    }

    var isPlaying by remember { mutableStateOf(false) }
    var showControls by remember { mutableStateOf(true) }
    var currentPosition by remember { mutableLongStateOf(0L) }
    var totalDuration by remember { mutableLongStateOf(0L) }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            currentPosition = exoPlayer.currentPosition
            totalDuration = exoPlayer.duration.coerceAtLeast(0L)
            delay(500)
        }
    }

    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying) {
            delay(3500)
            showControls = false
        }
    }

    // Listen to playback state changes
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
        }
        exoPlayer.addListener(listener)
        onDispose { exoPlayer.removeListener(listener) }
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
        // Thumbnail shown before playback starts
        if (!isPlaying && thumbnailUrl != null) {
            AsyncImage(
                model = thumbnailUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }

        // ExoPlayer view
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Controls overlay
        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center,
            ) {
                // Play/Pause button
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.6f),
                    modifier = Modifier
                        .size(64.dp)
                        .clickable {
                            if (exoPlayer.isPlaying) {
                                exoPlayer.pause()
                            } else {
                                exoPlayer.play()
                            }
                            showControls = true
                        },
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp),
                        )
                    }
                }

                // Seek bar at bottom
                if (totalDuration > 0) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        androidx.compose.material3.LinearProgressIndicator(
                            progress = { (currentPosition.toFloat() / totalDuration.toFloat()).coerceIn(0f, 1f) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp)),
                            color = Color(0xFF3B82F6),
                            trackColor = Color.White.copy(alpha = 0.3f),
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = formatDuration(currentPosition),
                                color = Color.White,
                                fontSize = 11.sp,
                            )
                            Text(
                                text = formatDuration(totalDuration),
                                color = Color.White,
                                fontSize = 11.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentItem(
    userName: String,
    content: String,
    createdAt: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1E293B))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        // Avatar circle
        Surface(
            shape = CircleShape,
            color = Color(0xFF334155),
            modifier = Modifier.size(36.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = (userName.firstOrNull()?.uppercaseChar() ?: '?').toString(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = if (userName.isNotBlank()) "@$userName" else "User",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = Color(0xFFE2E8F0),
                )
                Text(
                    text = try { createdAt.toLocalDateTime().toRelativeTime() } catch (_: Exception) { "" },
                    fontSize = 11.sp,
                    color = Color(0xFF64748B),
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = content,
                fontSize = 14.sp,
                color = Color(0xFFCBD5E1),
            )
        }
    }
    HorizontalDivider(
        color = Color(0xFF334155),
        thickness = 0.5.dp,
        modifier = Modifier.padding(horizontal = 16.dp),
    )
}

private fun formatDuration(ms: Long): String {
    val totalSeconds = ms / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
