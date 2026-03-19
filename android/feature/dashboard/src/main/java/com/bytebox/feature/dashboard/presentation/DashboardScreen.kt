package com.bytebox.feature.dashboard.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.R as CoreR
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.RecentFileRow
import com.bytebox.core.ui.components.UploadFAB
import com.bytebox.core.ui.theme.ByteBoxTheme

private data class FilterGroup(val label: String, val categories: Set<FileCategory>?)

private val filterGroups = listOf(
    FilterGroup("All", null),
    FilterGroup("Images", setOf(FileCategory.IMAGE)),
    FilterGroup("Videos", setOf(FileCategory.VIDEO)),
    FilterGroup(
        "Docs",
        setOf(
            FileCategory.DOCUMENT,
            FileCategory.PDF,
            FileCategory.TEXT_DOCUMENT,
            FileCategory.OFFICE_DOCUMENT,
        ),
    ),
    FilterGroup("Audio", setOf(FileCategory.AUDIO)),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onFolderClick: (folderId: String) -> Unit,
    onFileClick: (fileId: String, mimeType: String) -> Unit,
    onUploadClick: () -> Unit,
    onSeeAllFolders: () -> Unit,
    onFavoritesClick: () -> Unit = {},
    onSharesClick: () -> Unit = {},
    onSearchClick: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }
    var selectedFilter by remember { mutableStateOf<Set<FileCategory>?>(null) }

    val hour = remember { java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY) }
    val greeting = when (hour) {
        in 5..11 -> "Good morning"
        in 12..17 -> "Good afternoon"
        else -> "Good evening"
    }

    LifecycleResumeEffect(Unit) {
        viewModel.loadDashboard()
        onPauseOrDispose {}
    }

    val displayFiles = remember(uiState.recentFiles, selectedTab, selectedFilter) {
        if (selectedTab == 1) emptyList()
        else if (selectedFilter == null) uiState.recentFiles
        else uiState.recentFiles.filter { it.category in selectedFilter!! }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0),
        floatingActionButton = { UploadFAB(onClick = onUploadClick) },
    ) { padding ->
        when {
            uiState.isLoading && uiState.recentFiles.isEmpty() && uiState.user == null -> FileListShimmer(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = padding.calculateTopPadding()),
            )
            uiState.errorMessage != null && uiState.user == null -> Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = padding.calculateTopPadding()),
            ) {
                ErrorState(
                    message = uiState.errorMessage!!,
                    onRetry = viewModel::loadDashboard,
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = padding.calculateBottomPadding() + 88.dp),
                ) {
                    // ── Header ────────────────────────────────────────────────
                    item {
                        Column {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(),
                            ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp)
                                    .padding(top = 2.dp, bottom = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column {
                                    Text(
                                        text = greeting,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(
                                        text = uiState.user?.displayName?.ifBlank { null }
                                            ?: uiState.user?.email?.substringBefore("@")
                                            ?: "ByteBox",
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onBackground,
                                    )
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Box {
                                        IconButton(onClick = {}) {
                                            Icon(
                                                imageVector = Icons.Default.Notifications,
                                                contentDescription = "Notifications",
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        // Notification badge
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .align(Alignment.TopEnd)
                                                .padding(end = 10.dp, top = 10.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFFEF4444)),
                                        )
                                    }
                                    val initials = (uiState.user?.displayName
                                        ?: uiState.user?.email ?: "B")
                                        .split(" ")
                                        .take(2)
                                        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                                        .joinToString("")
                                        .take(2)
                                        .ifEmpty { "B" }
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF2563EB)),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = initials,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                        )
                                    }
                                }
                            }
                        }
                        }
                    }

                    // ── Search bar ────────────────────────────────────────────
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                                .clickable(onClick = onSearchClick),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "Search files…",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                    fontSize = 14.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                Icon(
                                    imageVector = Icons.Default.FilterList,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // ── Category grid ─────────────────────────────────────────
                    item {
                        CategoryGrid(
                            onFolderClick = onSeeAllFolders,
                            onFavoritesClick = onFavoritesClick,
                            onSharesClick = onSharesClick,
                            onCategoryFilter = { cats -> selectedFilter = cats },
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    // ── Premium upgrade card ───────────────────────────────────
                    item {
                        PremiumUpgradeCard(modifier = Modifier.padding(horizontal = 16.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    // ── Tabs ──────────────────────────────────────────────────
                    item {
                        TabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = MaterialTheme.colorScheme.background,
                            contentColor = MaterialTheme.colorScheme.primary,
                            divider = {},
                        ) {
                            listOf("Recent", "Starred").forEachIndexed { index, label ->
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
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // ── Filter chips (Recent tab only) ────────────────────────
                    if (selectedTab == 0) item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(filterGroups) { group ->
                                FilterChip(
                                    selected = selectedFilter == group.categories,
                                    onClick = { selectedFilter = group.categories },
                                    label = { Text(group.label) },
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // ── Files list ────────────────────────────────────────────
                    if (displayFiles.isNotEmpty()) {
                        items(displayFiles, key = { it.id }) { file ->
                            RecentFileRow(
                                fileName = file.name,
                                fileSize = file.size,
                                category = file.category,
                                timeAgo = try {
                                    file.createdAt.toLocalDateTime().toRelativeTime()
                                } catch (_: Exception) { "" },
                                onClick = { onFileClick(file.id, file.mimeType) },
                                modifier = Modifier
                                    .padding(horizontal = 16.dp)
                                    .padding(bottom = ByteBoxTheme.spacing.xs),
                                thumbnailUrl = file.thumbnailUrl,
                            )
                        }
                    } else {
                        item {
                            EmptyState(
                                icon = if (selectedTab == 1) Icons.Default.Star else Icons.Default.FolderOpen,
                                title = if (selectedTab == 1) "No starred files" else "No files yet",
                                subtitle = if (selectedTab == 1) "Star files to see them here" else "Upload files to get started",
                            )
                        }
                    }

                }
            }
        }
    }
}

// ── Private composables ───────────────────────────────────────────────────────

private data class CategoryTile(
    val label: String,
    val iconRes: Int,
    val tintColor: Color,
    val bgColor: Color,
    val onClick: () -> Unit,
)

@Composable
private fun CategoryGrid(
    onFolderClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onSharesClick: () -> Unit,
    onCategoryFilter: (Set<FileCategory>?) -> Unit,
) {
    val tiles = listOf(
        CategoryTile("Photos", CoreR.drawable.ic_flat_photos, Color(0xFF059669), Color(0xFFECFDF5)) {
            onCategoryFilter(setOf(FileCategory.IMAGE))
        },
        CategoryTile("Videos", CoreR.drawable.ic_flat_videos, Color(0xFFDC2626), Color(0xFFFEF2F2)) {
            onCategoryFilter(setOf(FileCategory.VIDEO))
        },
        CategoryTile("Docs", CoreR.drawable.ic_flat_docs, Color(0xFF2563EB), Color(0xFFEFF6FF)) {
            onCategoryFilter(
                setOf(
                    FileCategory.DOCUMENT,
                    FileCategory.PDF,
                    FileCategory.TEXT_DOCUMENT,
                    FileCategory.OFFICE_DOCUMENT,
                ),
            )
        },
        CategoryTile("Audio", CoreR.drawable.ic_flat_audio, Color(0xFF7C3AED), Color(0xFFF5F3FF)) {
            onCategoryFilter(setOf(FileCategory.AUDIO))
        },
        CategoryTile("Folders", CoreR.drawable.ic_flat_folder, Color(0xFFD97706), Color(0xFFFFFBEB)) {
            onFolderClick()
        },
        CategoryTile("Starred", CoreR.drawable.ic_flat_starred, Color(0xFFB45309), Color(0xFFFEF3C7)) {
            onFavoritesClick()
        },
        CategoryTile("Shared", CoreR.drawable.ic_flat_shared, Color(0xFF0891B2), Color(0xFFECFEFF)) {
            onSharesClick()
        },
        CategoryTile("More", CoreR.drawable.ic_flat_more, Color(0xFF6D28D9), Color(0xFFEDE9FE)) {},
    )

    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        tiles.chunked(4).forEach { rowTiles ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                rowTiles.forEach { tile ->
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clickable(onClick = tile.onClick),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 10.dp)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(18.dp))
                                .background(tile.bgColor),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                painter = painterResource(tile.iconRes),
                                contentDescription = tile.label,
                                modifier = Modifier.size(32.dp),
                                tint = Color.Unspecified,
                            )
                        }
                        Text(
                            text = tile.label,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PremiumUpgradeCard(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFFDEEAFD))
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color(0xFF2563EB),
                    ) {
                        Text(
                            text = "Pro",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        )
                    }
                    Text(
                        text = "Upgrade to Pro — get 1 TB storage",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF2563EB),
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = {},
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
            ) {
                Text("Upgrade", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
