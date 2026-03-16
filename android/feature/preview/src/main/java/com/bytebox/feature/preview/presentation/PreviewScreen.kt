package com.bytebox.feature.preview.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bytebox.core.common.FileCategory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreviewScreen(
    fileId: String,
    mimeType: String,
    onNavigateBack: () -> Unit,
    onDownload: (String) -> Unit,
    onShare: (String) -> Unit,
    viewModel: PreviewViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(fileId) {
        viewModel.loadFile(fileId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.fileName ?: "Preview") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { onDownload(fileId) }) {
                        Icon(Icons.Default.Download, contentDescription = "Download")
                    }
                    IconButton(onClick = { onShare(fileId) }) {
                        Icon(Icons.Default.Share, contentDescription = "Share")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            when {
                uiState.isLoading -> CircularProgressIndicator()
                uiState.errorMessage != null -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(uiState.errorMessage!!)
                    }
                }
                uiState.previewUrl != null -> {
                    when (uiState.category) {
                        FileCategory.IMAGE -> ImagePreview(url = uiState.previewUrl!!)
                        FileCategory.VIDEO -> VideoPreview(url = uiState.previewUrl!!)
                        FileCategory.AUDIO -> AudioPreview(url = uiState.previewUrl!!, fileName = uiState.fileName ?: "Audio")
                        FileCategory.PDF -> PdfPreview(url = uiState.previewUrl!!)
                        else -> UnsupportedPreview(mimeType = mimeType)
                    }
                }
            }
        }
    }
}

@Composable
private fun ImagePreview(url: String) {
    AsyncImage(
        model = url,
        contentDescription = "Image preview",
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Fit
    )
}

@Composable
private fun VideoPreview(url: String) {
    // ExoPlayer would be initialized here in production
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.PlayCircleFilled,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text("Video Player", style = MaterialTheme.typography.titleMedium)
        Text(
            "Media3 ExoPlayer integration",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AudioPreview(url: String, fileName: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.MusicNote,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(fileName, style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            "Audio Player",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PdfPreview(url: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.PictureAsPdf,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text("PDF Viewer", style = MaterialTheme.typography.titleMedium)
        Text(
            "PdfRenderer integration",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun UnsupportedPreview(mimeType: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.InsertDriveFile, null, modifier = Modifier.size(64.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text("Preview not available")
        Text(mimeType, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
