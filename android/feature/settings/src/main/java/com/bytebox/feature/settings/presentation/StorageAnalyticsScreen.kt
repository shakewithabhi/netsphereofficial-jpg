package com.bytebox.feature.settings.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.ByteBoxButton
import com.bytebox.core.ui.components.DonutChart
import com.bytebox.core.ui.components.DonutSegment
import com.bytebox.core.ui.components.StorageTypeRow
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.FileAudioColor
import com.bytebox.core.ui.theme.FileDocColor
import com.bytebox.core.ui.theme.FileImageColor
import com.bytebox.core.ui.theme.FileOtherColor
import com.bytebox.core.ui.theme.FileVideoColor
import com.bytebox.core.ui.theme.cardShadow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StorageAnalyticsScreen(
    onNavigateBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val user = uiState.user

    val totalUsed = user?.storageUsed ?: 0L
    val totalLimit = user?.storageLimit ?: 0L
    val available = (totalLimit - totalUsed).coerceAtLeast(0)

    // Estimate category breakdown from total (will be refined when backend provides category API)
    val imageBytes = (totalUsed * 0.35).toLong()
    val videoBytes = (totalUsed * 0.30).toLong()
    val docBytes = (totalUsed * 0.20).toLong()
    val audioBytes = (totalUsed * 0.10).toLong()
    val otherBytes = totalUsed - imageBytes - videoBytes - docBytes - audioBytes

    val segments = listOf(
        DonutSegment("Images", imageBytes.toFloat(), FileImageColor),
        DonutSegment("Videos", videoBytes.toFloat(), FileVideoColor),
        DonutSegment("Documents", docBytes.toFloat(), FileDocColor),
        DonutSegment("Audio", audioBytes.toFloat(), FileAudioColor),
        DonutSegment("Other", otherBytes.toFloat(), FileOtherColor),
    )

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = { Text("Storage") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(horizontal = ByteBoxTheme.spacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Donut chart
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.xl),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    DonutChart(
                        segments = segments,
                        size = 200.dp,
                        strokeWidth = 28.dp,
                        centerContent = {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = available.toReadableFileSize(),
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = "Available",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        },
                    )

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

                    Text(
                        text = "Total ${totalLimit.toReadableFileSize()}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Breakdown
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(ByteBoxTheme.spacing.md),
                ) {
                    Text(
                        text = "Storage Breakdown",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )

                    StorageTypeRow(
                        label = "Images",
                        bytes = imageBytes,
                        totalBytes = totalUsed,
                        color = FileImageColor,
                    )
                    StorageTypeRow(
                        label = "Videos",
                        bytes = videoBytes,
                        totalBytes = totalUsed,
                        color = FileVideoColor,
                    )
                    StorageTypeRow(
                        label = "Documents",
                        bytes = docBytes,
                        totalBytes = totalUsed,
                        color = FileDocColor,
                    )
                    StorageTypeRow(
                        label = "Audio",
                        bytes = audioBytes,
                        totalBytes = totalUsed,
                        color = FileAudioColor,
                    )
                    StorageTypeRow(
                        label = "Other",
                        bytes = otherBytes,
                        totalBytes = totalUsed,
                        color = FileOtherColor,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            ByteBoxButton(
                text = "Upgrade Plan",
                onClick = { },
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))
        }
    }
}
