package com.bytebox.feature.explore.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.domain.model.ExploreItem

private data class CategoryChip(val label: String, val value: String?)

private val categoryChips = listOf(
    CategoryChip("All", null),
    CategoryChip("Videos", "video"),
    CategoryChip("Images", "image"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreScreen(
    onItemClick: (code: String) -> Unit,
    viewModel: ExploreViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    // Trigger loadMore when near the end of the list
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

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Explore",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        when {
            uiState.isLoading -> FileListShimmer(modifier = Modifier.padding(padding))
            uiState.errorMessage != null && uiState.items.isEmpty() -> ErrorState(
                message = uiState.errorMessage!!,
                onRetry = viewModel::load,
            )
            else -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
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
                        items(uiState.items, key = { it.id }) { item ->
                            ExploreCard(
                                item = item,
                                onClick = { onItemClick(item.code) },
                                modifier = Modifier
                                    .padding(horizontal = 16.dp)
                                    .padding(bottom = 12.dp),
                            )
                        }

                        // Loading more indicator
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
    }
}

@Composable
private fun ExploreCard(
    item: ExploreItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column {
            // Thumbnail area (16:9)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)),
            ) {
                if (item.thumbnailUrl != null) {
                    AsyncImage(
                        model = item.thumbnailUrl,
                        contentDescription = item.fileName,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    // Fallback colored background with icon
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center,
                    ) {
                        FileTypeIcon(category = item.category, containerSize = 56.dp)
                    }
                }

                // Play button overlay for videos
                if (item.category == FileCategory.VIDEO) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.Black.copy(alpha = 0.55f),
                            modifier = Modifier.size(52.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Play",
                                    tint = Color.White,
                                    modifier = Modifier.size(30.dp),
                                )
                            }
                        }
                    }
                }

                // Category badge (top-right)
                val badgeColor = when (item.category) {
                    FileCategory.VIDEO -> Color(0xFFFF5722)
                    FileCategory.IMAGE -> Color(0xFF388E3C)
                    FileCategory.AUDIO -> Color(0xFF9C27B0)
                    else -> Color(0xFF1E88E5)
                }
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = badgeColor,
                ) {
                    Text(
                        text = when (item.category) {
                            FileCategory.VIDEO -> "VIDEO"
                            FileCategory.IMAGE -> "IMAGE"
                            FileCategory.AUDIO -> "AUDIO"
                            FileCategory.PDF -> "PDF"
                            else -> "FILE"
                        },
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                    )
                }
            }

            // Info row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FileTypeIcon(category = item.category, containerSize = 36.dp)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.fileName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = buildString {
                            if (item.ownerName.isNotEmpty()) append("@${item.ownerName}  ·  ")
                            append(try { item.createdAt.toLocalDateTime().toRelativeTime() } catch (_: Exception) { "" })
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                    Text(
                        text = buildString {
                            append(item.fileSize.toReadableFileSize())
                            if (item.downloadCount > 0) append("  ·  ${item.downloadCount} downloads")
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
