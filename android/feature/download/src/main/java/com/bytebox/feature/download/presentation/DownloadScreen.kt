package com.bytebox.feature.download.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.domain.model.DownloadStatus
import com.bytebox.domain.model.DownloadTask

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DownloadScreen(
    onNavigateBack: () -> Unit,
    viewModel: DownloadViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = { Text("Downloads") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (uiState.tasks.any { it.status == DownloadStatus.COMPLETED }) {
                        TextButton(onClick = viewModel::clearCompleted) {
                            Text("Clear done")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                    actionIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        }
    ) { padding ->
        if (uiState.tasks.isEmpty()) {
            EmptyState(
                icon = Icons.Default.Download,
                title = "No downloads",
                subtitle = "Downloaded files will appear here",
                modifier = Modifier.padding(padding)
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                items(uiState.tasks, key = { it.id }) { task ->
                    DownloadTaskItem(
                        task = task,
                        onCancel = { viewModel.cancelDownload(task.id) },
                        onRetry = { viewModel.retryDownload(task.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun DownloadTaskItem(
    task: DownloadTask,
    onCancel: () -> Unit,
    onRetry: () -> Unit
) {
    ListItem(
        headlineContent = { Text(task.fileName, maxLines = 1) },
        supportingContent = {
            Column {
                Text(
                    "${task.bytesDownloaded.toReadableFileSize()} / ${task.fileSize.toReadableFileSize()}",
                    style = MaterialTheme.typography.bodySmall
                )
                if (task.status == DownloadStatus.DOWNLOADING) {
                    Spacer(modifier = Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { task.progress },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                task.errorMessage?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        leadingContent = {
            when (task.status) {
                DownloadStatus.COMPLETED -> Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                DownloadStatus.FAILED -> Icon(Icons.Default.Error, null, tint = MaterialTheme.colorScheme.error)
                DownloadStatus.DOWNLOADING -> CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                else -> Icon(Icons.Default.Download, null)
            }
        },
        trailingContent = {
            when (task.status) {
                DownloadStatus.DOWNLOADING, DownloadStatus.PENDING ->
                    IconButton(onClick = onCancel) { Icon(Icons.Default.Close, "Cancel") }
                DownloadStatus.FAILED ->
                    IconButton(onClick = onRetry) { Icon(Icons.Default.Refresh, "Retry") }
                else -> {}
            }
        }
    )
}
