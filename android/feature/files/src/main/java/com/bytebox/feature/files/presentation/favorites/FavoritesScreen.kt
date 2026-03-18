package com.bytebox.feature.files.presentation.favorites

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.common.toLocalDateTime
import com.bytebox.core.common.toRelativeTime
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.core.ui.components.ErrorState
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.components.FileTypeIcon
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.domain.model.FileItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesScreen(
    onNavigateBack: () -> Unit,
    onFileClick: (fileId: String, mimeType: String) -> Unit = { _, _ -> },
    viewModel: FavoritesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Favorites",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            uiState.isLoading -> {
                FileListShimmer(
                    modifier = Modifier
                        .padding(padding)
                        .padding(top = ByteBoxTheme.spacing.xs),
                )
            }
            uiState.errorMessage != null -> {
                ErrorState(
                    message = uiState.errorMessage!!,
                    onRetry = viewModel::loadFavorites,
                    modifier = Modifier.padding(padding),
                )
            }
            uiState.files.isEmpty() -> {
                EmptyState(
                    icon = Icons.Outlined.StarBorder,
                    title = "No favorites yet",
                    subtitle = "Star files to quickly find them here",
                    modifier = Modifier.padding(padding),
                )
            }
            else -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = viewModel::loadFavorites,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(uiState.files, key = { it.id }) { file ->
                            FavoriteFileItem(
                                file = file,
                                onClick = { onFileClick(file.id, file.mimeType) },
                                onUnstar = { viewModel.unstarFile(file.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FavoriteFileItem(
    file: FileItem,
    onClick: () -> Unit,
    onUnstar: () -> Unit
) {
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        headlineContent = {
            Text(
                file.name,
                maxLines = 1,
                style = MaterialTheme.typography.titleSmall,
            )
        },
        supportingContent = {
            Text(
                "${file.size.toReadableFileSize()}  ·  ${file.createdAt.toLocalDateTime().toRelativeTime()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        leadingContent = {
            FileTypeIcon(category = file.category)
        },
        trailingContent = {
            IconButton(onClick = onUnstar) {
                Icon(
                    Icons.Filled.Star,
                    contentDescription = "Remove from favorites",
                    tint = Color(0xFFFFC107),
                )
            }
        },
    )
}
