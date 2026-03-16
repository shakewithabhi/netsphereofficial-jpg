package com.bytebox.feature.share.presentation

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.EmptyState
import com.bytebox.domain.model.ShareLink

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareScreen(
    onNavigateBack: () -> Unit,
    viewModel: ShareViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Shared Links") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        if (uiState.shares.isEmpty() && !uiState.isLoading) {
            EmptyState(
                icon = Icons.Default.Link,
                title = "No shared links",
                subtitle = "Share files from the file browser to create links",
                modifier = Modifier.padding(padding)
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                items(uiState.shares, key = { it.id }) { share ->
                    ShareItem(
                        share = share,
                        onCopyLink = {
                            clipboardManager.setText(AnnotatedString(share.shareUrl))
                        },
                        onShareLink = {
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, share.shareUrl)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share link"))
                        },
                        onDelete = { viewModel.deleteShare(share.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ShareItem(
    share: ShareLink,
    onCopyLink: () -> Unit,
    onShareLink: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.InsertDriveFile, null, modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = share.fileName ?: "File",
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = share.fileSize?.toReadableFileSize() ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (share.hasPassword) {
                    AssistChip(
                        onClick = {},
                        label = { Text("Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, null, modifier = Modifier.size(16.dp)) },
                        modifier = Modifier.padding(end = 4.dp)
                    )
                }
                share.expiresAt?.let {
                    AssistChip(
                        onClick = {},
                        label = { Text("Expires") },
                        leadingIcon = { Icon(Icons.Default.Schedule, null, modifier = Modifier.size(16.dp)) }
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "${share.downloadCount} downloads",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row {
                OutlinedButton(onClick = onCopyLink, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Copy")
                }
                Spacer(modifier = Modifier.width(8.dp))
                OutlinedButton(onClick = onShareLink, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.Share, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Share")
                }
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
