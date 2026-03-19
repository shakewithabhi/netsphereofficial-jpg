package com.bytebox.feature.share.presentation

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.bytebox.core.ui.components.FileListShimmer
import com.bytebox.core.ui.theme.ByteBoxTheme
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
        contentWindowInsets = WindowInsets(0),
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Text(
                        "Shared Links",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        when {
            uiState.isLoading -> {
                FileListShimmer(
                    modifier = Modifier
                        .padding(padding)
                        .padding(top = ByteBoxTheme.spacing.xs),
                )
            }
            uiState.shares.isEmpty() -> {
                EmptyState(
                    icon = Icons.Default.Link,
                    title = "No shared links",
                    subtitle = "Share files from the file browser to create links",
                    modifier = Modifier.padding(padding),
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
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
                            onDelete = { viewModel.deleteShare(share.id) },
                        )
                    }
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
            .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xxs),
        shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = ByteBoxTheme.elevation.xs,
        ),
    ) {
        Column(modifier = Modifier.padding(ByteBoxTheme.spacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.InsertDriveFile,
                    contentDescription = "File",
                    modifier = Modifier.size(24.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = share.fileName ?: "File",
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = share.fileSize?.toReadableFileSize() ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (share.hasPassword) {
                    AssistChip(
                        onClick = {},
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(
                                Icons.Default.Lock,
                                contentDescription = "Password protected",
                                modifier = Modifier.size(16.dp),
                            )
                        },
                        modifier = Modifier.padding(end = ByteBoxTheme.spacing.xxs),
                    )
                }
                share.expiresAt?.let {
                    AssistChip(
                        onClick = {},
                        label = { Text("Expires") },
                        leadingIcon = {
                            Icon(
                                Icons.Default.Schedule,
                                contentDescription = "Has expiry",
                                modifier = Modifier.size(16.dp),
                            )
                        },
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "${share.downloadCount} downloads",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            Row {
                OutlinedButton(
                    onClick = onCopyLink,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xxs))
                    Text("Copy")
                }
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                OutlinedButton(
                    onClick = onShareLink,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.sm),
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xxs))
                    Text("Share")
                }
                Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.xs))
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete share", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
