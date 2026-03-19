package com.bytebox.feature.dashboard.presentation

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Brush
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import com.bytebox.core.ui.components.BannerAd
import com.bytebox.core.ui.components.UploadFAB
import com.bytebox.core.common.AdManager
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

// Premium gradient colors
private val headerGradient = Brush.verticalGradient(
    listOf(Color(0xFF1E40AF), Color(0xFF3B82F6), Color(0xFF60A5FA))
)
private val premiumGradient = Brush.horizontalGradient(
    listOf(Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFA78BFA))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onFolderClick: (folderId: String) -> Unit,
    onFileClick: (fileId: String, mimeType: String) -> Unit,
    onUploadClick: () -> Unit,
    onSeeAllFolders: () -> Unit,
    onNotificationClick: () -> Unit = {},
    notificationCount: Int = 0,
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
                    // ── Premium Header ──────────────────────────────────────
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(headerGradient),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp)
                                    .padding(top = 6.dp, bottom = 14.dp),
                            ) {
                                // Top row: greeting + actions
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column {
                                        Text(
                                            text = greeting,
                                            fontSize = 11.sp,
                                            color = Color.White.copy(alpha = 0.7f),
                                        )
                                        Text(
                                            text = uiState.user?.displayName?.ifBlank { null }
                                                ?: uiState.user?.email?.substringBefore("@")
                                                ?: "ByteBox",
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                        )
                                    }
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                                    ) {
                                        Box {
                                            IconButton(onClick = onNotificationClick) {
                                                Icon(
                                                    imageVector = if (notificationCount > 0) Icons.Filled.Notifications
                                                        else Icons.Outlined.NotificationsNone,
                                                    contentDescription = "Notifications",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(22.dp),
                                                )
                                            }
                                            if (notificationCount > 0) {
                                                Surface(
                                                    modifier = Modifier
                                                        .align(Alignment.TopEnd)
                                                        .padding(top = 6.dp, end = 6.dp),
                                                    shape = CircleShape,
                                                    color = Color(0xFFEF4444),
                                                ) {
                                                    Text(
                                                        text = if (notificationCount > 9) "9+" else notificationCount.toString(),
                                                        fontSize = 8.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White,
                                                        modifier = Modifier.padding(horizontal = 3.dp, vertical = 1.dp),
                                                    )
                                                }
                                            }
                                        }
                                        val initials = (uiState.user?.displayName
                                            ?: uiState.user?.email ?: "B")
                                            .split(" ")
                                            .take(2)
                                            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                                            .joinToString("")
                                            .take(2)
                                            .ifEmpty { "B" }
                                        Surface(
                                            modifier = Modifier.size(36.dp),
                                            shape = CircleShape,
                                            color = Color.White.copy(alpha = 0.15f),
                                            border = androidx.compose.foundation.BorderStroke(
                                                1.5.dp, Color.White.copy(alpha = 0.3f)
                                            ),
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = initials,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = Color.White,
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                // Search bar
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable(onClick = onSearchClick),
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color.White.copy(alpha = 0.15f),
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 14.dp, vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Search,
                                            contentDescription = null,
                                            tint = Color.White.copy(alpha = 0.6f),
                                            modifier = Modifier.size(16.dp),
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Search files...",
                                            color = Color.White.copy(alpha = 0.5f),
                                            fontSize = 13.sp,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // ── Storage indicator (compact) ─────────────────────────
                    item {
                        val storageUsed = uiState.user?.storageUsed ?: 0L
                        val storageLimit = uiState.user?.storageLimit ?: 5368709120L
                        val storagePercent = if (storageLimit > 0) (storageUsed.toFloat() / storageLimit).coerceIn(0f, 1f) else 0f
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(storagePercent)
                                        .height(4.dp)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(
                                            if (storagePercent > 0.9f) Color(0xFFEF4444)
                                            else MaterialTheme.colorScheme.primary
                                        )
                                        .animateContentSize(),
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "${storageUsed.toReadableFileSize()} / ${storageLimit.toReadableFileSize()}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    // ── Category tiles ──────────────────────────────────────
                    item {
                        CategoryGrid(
                            onFolderClick = onSeeAllFolders,
                            onFavoritesClick = onFavoritesClick,
                            onSharesClick = onSharesClick,
                            onCategoryFilter = { cats -> selectedFilter = cats },
                        )
                    }

                    // ── Banner Ad (free-tier only, subtle) ─────────────────
                    item {
                        BannerAd(
                            adUnitId = AdManager.BANNER_HOME,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        )
                    }

                    // ── Tabs ────────────────────────────────────────────────
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        TabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = Color.Transparent,
                            contentColor = MaterialTheme.colorScheme.primary,
                            divider = {},
                            indicator = { tabPositions ->
                                if (selectedTab < tabPositions.size) {
                                    TabRowDefaults.SecondaryIndicator(
                                        modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                                        height = 3.dp,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                            },
                        ) {
                            listOf("Recent", "Starred").forEachIndexed { index, label ->
                                Tab(
                                    selected = selectedTab == index,
                                    onClick = { selectedTab = index },
                                    text = {
                                        Text(
                                            text = label,
                                            fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                            fontSize = 14.sp,
                                        )
                                    },
                                )
                            }
                        }
                    }

                    // ── Filter chips (Recent tab only) ──────────────────────
                    if (selectedTab == 0) item {
                        Spacer(modifier = Modifier.height(12.dp))
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(filterGroups) { group ->
                                FilterChip(
                                    selected = selectedFilter == group.categories,
                                    onClick = { selectedFilter = group.categories },
                                    label = {
                                        Text(
                                            group.label,
                                            fontSize = 13.sp,
                                            fontWeight = if (selectedFilter == group.categories) FontWeight.SemiBold else FontWeight.Normal,
                                        )
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // ── Files list ──────────────────────────────────────────
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
                            Spacer(modifier = Modifier.height(24.dp))
                            EmptyState(
                                icon = if (selectedTab == 1) Icons.Default.Star else Icons.Default.FolderOpen,
                                title = if (selectedTab == 1) "No starred files" else "No files yet",
                                subtitle = if (selectedTab == 1) "Star files to see them here" else "Upload files to get started",
                            )
                        }
                    }

                    // ── Premium upgrade card ────────────────────────────────
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        PremiumUpgradeCard(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            onUploadClick = onUploadClick,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

// ── Category tiles ───────────────────────────────────────────────────────────

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
        CategoryTile("Photos", CoreR.drawable.ic_flat_photos, Color(0xFF059669), Color(0xFF065F46)) {
            onCategoryFilter(setOf(FileCategory.IMAGE))
        },
        CategoryTile("Videos", CoreR.drawable.ic_flat_videos, Color(0xFFDC2626), Color(0xFF7F1D1D)) {
            onCategoryFilter(setOf(FileCategory.VIDEO))
        },
        CategoryTile(
            "Docs", CoreR.drawable.ic_flat_docs, Color(0xFF3B82F6), Color(0xFF1E3A5F),
        ) {
            onCategoryFilter(
                setOf(
                    FileCategory.DOCUMENT,
                    FileCategory.PDF,
                    FileCategory.TEXT_DOCUMENT,
                    FileCategory.OFFICE_DOCUMENT,
                ),
            )
        },
        CategoryTile("Audio", CoreR.drawable.ic_flat_audio, Color(0xFF8B5CF6), Color(0xFF3B1F6E)) {
            onCategoryFilter(setOf(FileCategory.AUDIO))
        },
        CategoryTile("Folders", CoreR.drawable.ic_flat_folder, Color(0xFFF59E0B), Color(0xFF713F12)) {
            onFolderClick()
        },
        CategoryTile("Starred", CoreR.drawable.ic_flat_starred, Color(0xFFF97316), Color(0xFF7C2D12)) {
            onFavoritesClick()
        },
        CategoryTile("Shared", CoreR.drawable.ic_flat_shared, Color(0xFF06B6D4), Color(0xFF164E63)) {
            onSharesClick()
        },
        CategoryTile("More", CoreR.drawable.ic_flat_more, Color(0xFF6D28D9), Color(0xFFEDE9FE)) {},
    )

    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(tiles) { tile ->
            Card(
                modifier = Modifier
                    .width(78.dp)
                    .clickable(onClick = tile.onClick),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = tile.bgColor),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        painter = painterResource(tile.iconRes),
                        contentDescription = tile.label,
                        modifier = Modifier.size(38.dp),
                        tint = Color.Unspecified,
                    )
                    Text(
                        text = tile.label,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.9f),
                    )
                }
            }
        }
    }
}

@Composable
private fun PremiumUpgradeCard(
    modifier: Modifier = Modifier,
    onUploadClick: () -> Unit = {},
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(premiumGradient)
                .padding(20.dp),
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
                            color = Color.White.copy(alpha = 0.2f),
                        ) {
                            Text(
                                text = "PRO",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                letterSpacing = 1.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                        Text(
                            text = "ByteBox Pro",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "1 TB · Faster uploads · No ads",
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.7f),
                    )
                }
                Surface(
                    modifier = Modifier.clickable(onClick = onUploadClick),
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = Color(0xFF6366F1),
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            "Upload",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6366F1),
                        )
                    }
                }
            }
        }
    }
}
