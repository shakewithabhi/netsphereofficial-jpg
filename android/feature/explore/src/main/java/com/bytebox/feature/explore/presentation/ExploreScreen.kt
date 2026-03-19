package com.bytebox.feature.explore.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.domain.model.ExploreItem
import timber.log.Timber

private data class CategoryChip(val label: String, val value: String?)

private val categoryChips = listOf(
    CategoryChip("All", null),
    CategoryChip("Videos", "video"),
    CategoryChip("Images", "image"),
)

private fun avatarColor(name: String): Color {
    val colors = listOf(
        Color(0xFF2563EB), Color(0xFF059669), Color(0xFFDC2626),
        Color(0xFF7C3AED), Color(0xFFD97706), Color(0xFF0891B2),
    )
    return colors[(name.hashCode() and 0x7FFFFFFF) % colors.size]
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreScreen(
    onItemClick: (code: String) -> Unit,
    onUploadClick: () -> Unit = {},
    viewModel: ExploreViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val total = listState.layoutInfo.totalItemsCount
            lastVisible >= total - 3 && total > 0
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) viewModel.loadMore()
    }

    LifecycleResumeEffect(Unit) {
        viewModel.refresh()
        onPauseOrDispose {}
    }

    // Track which item index is most visible for inline video preview
    var activeVideoIndex by remember { mutableStateOf(-1) }
    LaunchedEffect(listState) {
        snapshotFlow {
            val visibleItems = listState.layoutInfo.visibleItemsInfo
            // Find the most centered visible item (skip first item which is the filter chips)
            visibleItems
                .filter { it.index > 0 }
                .maxByOrNull { info ->
                    val viewportCenter = listState.layoutInfo.viewportStartOffset +
                            (listState.layoutInfo.viewportEndOffset - listState.layoutInfo.viewportStartOffset) / 2
                    val itemCenter = info.offset + info.size / 2
                    -(kotlin.math.abs(viewportCenter - itemCenter))
                }?.index?.minus(1) ?: -1 // -1 for filter chip offset
        }.collect { idx ->
            activeVideoIndex = idx
        }
    }

    // Focus manager for search
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current

    // Full-screen search overlay (YouTube-style)
    if (uiState.isSearchActive) {
        val focusRequester = remember { androidx.compose.ui.focus.FocusRequester() }
        LaunchedEffect(Unit) { focusRequester.requestFocus() }

        Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            // Search bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { viewModel.clearSearch() }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
                androidx.compose.material3.OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = viewModel::onSearchQueryChanged,
                    modifier = Modifier
                        .weight(1f)
                        .focusRequester(focusRequester),
                    placeholder = { Text("Search videos, images...", fontSize = 14.sp) },
                    singleLine = true,
                    shape = RoundedCornerShape(24.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        imeAction = androidx.compose.ui.text.input.ImeAction.Search,
                    ),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onSearch = { viewModel.submitSearch(); focusManager.clearFocus() },
                    ),
                    trailingIcon = {
                        if (uiState.searchQuery.isNotBlank()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                )
                Spacer(modifier = Modifier.width(4.dp))
            }

            // Suggestions or search results
            when {
                uiState.isSearching -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                uiState.searchResults.isNotEmpty() -> {
                    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 88.dp)) {
                        item {
                            Text(
                                "${uiState.searchResults.size} results for \"${uiState.searchQuery}\"",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                        }
                        items(uiState.searchResults, key = { "search_${it.id}" }) { item ->
                            ExploreCard(
                                item = item,
                                isActivePreview = false,
                                onClick = { onItemClick(item.code) },
                                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp),
                            )
                        }
                    }
                }
                uiState.showSuggestions && uiState.suggestions.isNotEmpty() -> {
                    // Suggestions list
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(uiState.suggestions, key = { "sug_${it.id}" }) { suggestion ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.onSearchQueryChanged(suggestion.fileName)
                                        viewModel.submitSearch()
                                        focusManager.clearFocus()
                                    }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Default.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(suggestion.fileName, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("@${suggestion.ownerName}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
                uiState.searchQuery.isBlank() -> {
                    // Empty state — recent or trending placeholder
                    Box(modifier = Modifier.fillMaxSize().padding(top = 48.dp), contentAlignment = Alignment.TopCenter) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f), modifier = Modifier.size(64.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("Search for videos, images & more", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
        return@ExploreScreen
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(text = "Explore", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp) },
                actions = {
                    IconButton(onClick = { viewModel.activateSearch() }) {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.onBackground)
                    }
                    IconButton(onClick = onUploadClick) {
                        Icon(Icons.Default.CloudUpload, contentDescription = "Upload to Explore", tint = MaterialTheme.colorScheme.onBackground)
                    }
                },
                windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    actionIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
        when {
            uiState.isLoading && uiState.items.isEmpty() -> FileListShimmer(modifier = Modifier)
            uiState.errorMessage != null && uiState.items.isEmpty() -> ErrorState(
                message = uiState.errorMessage!!,
                onRetry = viewModel::load,
            )
            else -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 88.dp),
                ) {
                    // Filter chips
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(bottom = 8.dp),
                        ) {
                            items(categoryChips) { chip ->
                                FilterChip(
                                    selected = uiState.selectedCategory == chip.value,
                                    onClick = { viewModel.setCategory(chip.value) },
                                    label = { Text(chip.label) },
                                )
                            }
                        }
                    }

                    if (uiState.items.isEmpty()) {
                        item {
                            EmptyState(
                                icon = Icons.Default.PlayArrow,
                                title = "Nothing to explore yet",
                                subtitle = "Publicly shared files will appear here",
                            )
                        }
                    } else {
                        items(uiState.items.size, key = { uiState.items[it].id }) { index ->
                            val item = uiState.items[index]
                            val isActive = index == activeVideoIndex
                            ExploreCard(
                                item = item,
                                isActivePreview = isActive && item.category == FileCategory.VIDEO,
                                onClick = { onItemClick(item.code) },
                                modifier = Modifier
                                    .padding(horizontal = 16.dp)
                                    .padding(bottom = 16.dp),
                            )
                        }

                        if (uiState.isLoadingMore) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        } // close Box
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun InlineVideoPreview(
    videoUrl: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val exoPlayer = remember(videoUrl) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoUrl))
            prepare()
            volume = 0f
            repeatMode = Player.REPEAT_MODE_ONE
            playWhenReady = true
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
            }
        },
        modifier = modifier,
    )
}

@Composable
private fun ExploreCard(
    item: ExploreItem,
    isActivePreview: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        // ── Thumbnail (edge-to-edge, 16:9) ──────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(5.dp))
                .aspectRatio(16f / 9f)
                .background(Color(0xFF1A1A2E)),
        ) {
            if (isActivePreview && item.hlsUrl != null) {
                InlineVideoPreview(videoUrl = item.hlsUrl!!, modifier = Modifier.fillMaxSize())
                Surface(
                    modifier = Modifier.align(Alignment.BottomStart).padding(8.dp),
                    shape = RoundedCornerShape(4.dp),
                    color = Color.Black.copy(alpha = 0.7f),
                ) {
                    Icon(Icons.Default.VolumeOff, null, tint = Color.White, modifier = Modifier.size(22.dp).padding(3.dp))
                }
            } else if (item.thumbnailUrl != null) {
                SubcomposeAsyncImage(
                    model = item.thumbnailUrl,
                    contentDescription = item.fileName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                    error = {
                        Box(Modifier.fillMaxSize().background(Color(0xFF1A1A2E)), contentAlignment = Alignment.Center) {
                            FileTypeIcon(category = item.category, containerSize = 48.dp)
                        }
                    },
                )
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    FileTypeIcon(category = item.category, containerSize = 48.dp)
                }
            }

            // Play button overlay (videos only, not previewing)
            if (item.category == FileCategory.VIDEO && !isActivePreview) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Surface(shape = CircleShape, color = Color.Black.copy(alpha = 0.6f), modifier = Modifier.size(48.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.PlayArrow, "Play", tint = Color.White, modifier = Modifier.size(28.dp))
                        }
                    }
                }
            }

            // Size badge (bottom-right, like YouTube duration)
            Surface(
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp),
                shape = RoundedCornerShape(4.dp),
                color = Color.Black.copy(alpha = 0.8f),
            ) {
                Text(
                    text = item.fileSize.toReadableFileSize(),
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        }

        // ── Info row (avatar + title/meta + more) ───────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .padding(top = 10.dp, bottom = 4.dp),
            verticalAlignment = Alignment.Top,
        ) {
            // Avatar
            val initials = item.ownerName
                .split(" ", limit = 2)
                .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                .take(2).joinToString("").ifEmpty { "?" }
            Box(
                modifier = Modifier
                    .padding(top = 2.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(avatarColor(item.ownerName)),
                contentAlignment = Alignment.Center,
            ) {
                Text(initials, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Title + meta
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.fileName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 20.sp,
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = buildString {
                        append(item.ownerName)
                        append("  \u00B7  ${formatCount(item.downloadCount)} views")
                        append("  \u00B7  ${formatCount(item.likeCount)} likes")
                        val time = try { item.createdAt.toLocalDateTime().toRelativeTime() } catch (_: Exception) { "" }
                        if (time.isNotEmpty()) append("  \u00B7  $time")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 12.sp,
                )
            }

            // More button
            IconButton(onClick = { /* TODO: more menu */ }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.MoreVert, "More", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
        }
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1_000_000 -> "${count / 1_000_000}M"
    count >= 1_000 -> "${count / 1_000}K"
    else -> count.toString()
}
