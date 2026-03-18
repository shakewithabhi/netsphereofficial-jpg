package com.bytebox.feature.dashboard.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.components.ColoredFolderCard
import com.bytebox.core.ui.components.DashboardGreetingHeader
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.RecentFileRow
import com.bytebox.core.ui.components.SectionHeader
import com.bytebox.core.ui.components.StorageIndicator
import com.bytebox.core.ui.components.BannerAd
import com.bytebox.core.ui.components.UploadFAB
import com.bytebox.core.common.AdManager
import com.bytebox.core.ui.theme.ByteBoxTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onFolderClick: (folderId: String) -> Unit,
    onFileClick: (fileId: String, mimeType: String) -> Unit,
    onUploadClick: () -> Unit,
    onSeeAllFolders: () -> Unit,
    onNotificationClick: () -> Unit = {},
    notificationCount: Int = 0,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.loadDashboard()
        onPauseOrDispose {}
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        floatingActionButton = {
            UploadFAB(onClick = onUploadClick)
        },
    ) { padding ->
        when {
            uiState.isLoading -> {
                FileListShimmer(modifier = Modifier.padding(padding))
            }
            uiState.errorMessage != null && uiState.user == null -> {
                ErrorState(
                    message = uiState.errorMessage!!,
                    onRetry = viewModel::loadDashboard,
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                ) {
                    // Greeting header
                    item {
                        DashboardGreetingHeader(
                            displayName = uiState.user?.displayName ?: "User",
                            notificationCount = notificationCount,
                            onNotificationClick = onNotificationClick,
                        )
                    }

                    // Storage indicator
                    uiState.user?.let { user ->
                        item {
                            StorageIndicator(
                                used = user.storageUsed,
                                total = user.storageLimit,
                                modifier = Modifier.padding(
                                    horizontal = ByteBoxTheme.spacing.lg,
                                    vertical = ByteBoxTheme.spacing.xs,
                                ),
                            )
                        }
                    }

                    // Banner Ad (free-tier only)
                    item {
                        BannerAd(
                            adUnitId = AdManager.BANNER_HOME,
                            modifier = Modifier.padding(
                                horizontal = ByteBoxTheme.spacing.md,
                            ),
                        )
                    }

                    item {
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                    }

                    // My Folders section
                    if (uiState.folders.isNotEmpty()) {
                        item {
                            SectionHeader(
                                title = "My Folders",
                                actionText = "See All",
                                onAction = onSeeAllFolders,
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = ByteBoxTheme.spacing.md),
                                horizontalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.sm),
                            ) {
                                itemsIndexed(uiState.folders) { index, folder ->
                                    ColoredFolderCard(
                                        name = folder.name,
                                        index = index,
                                        onClick = { onFolderClick(folder.id) },
                                    )
                                }
                            }
                        }

                        item {
                            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))
                        }
                    }

                    // Recent uploads section
                    if (uiState.recentFiles.isNotEmpty()) {
                        item {
                            SectionHeader(title = "Recent Uploads")
                        }

                        items(uiState.recentFiles, key = { it.id }) { file ->
                            RecentFileRow(
                                fileName = file.name,
                                fileSize = file.size,
                                category = file.category,
                                timeAgo = try {
                                    file.createdAt.toLocalDateTime().toRelativeTime()
                                } catch (_: Exception) {
                                    ""
                                },
                                onClick = { onFileClick(file.id, file.mimeType) },
                            )
                        }
                    }

                    // Empty state
                    if (uiState.folders.isEmpty() && uiState.recentFiles.isEmpty()) {
                        item {
                            EmptyState(
                                icon = Icons.Default.FolderOpen,
                                title = "Welcome to ByteBox",
                                subtitle = "Upload files or create folders to get started",
                            )
                        }
                    }
                }
            }
        }
    }
}
