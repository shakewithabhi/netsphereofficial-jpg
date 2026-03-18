package com.bytebox.feature.settings.presentation

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.AdManager
import com.bytebox.core.ui.components.SectionHeader
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.cardShadow
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val showAds by AdManager.showAds.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Settings",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding),
        ) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // Preferences Section
            SectionHeader(title = "Preferences")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    ListItem(
                        headlineContent = { Text("Upload on Wi-Fi only") },
                        supportingContent = { Text("Only upload files when connected to Wi-Fi") },
                        leadingContent = {
                            Icon(
                                Icons.Default.Wifi,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        trailingContent = {
                            Switch(
                                checked = uiState.uploadOnWifiOnly,
                                onCheckedChange = viewModel::setUploadOnWifiOnly,
                            )
                        },
                    )

                    ListItem(
                        headlineContent = { Text("Appearance") },
                        supportingContent = {
                            Text(
                                when (uiState.themeMode) {
                                    com.bytebox.core.datastore.ThemeMode.SYSTEM -> "Follow system"
                                    com.bytebox.core.datastore.ThemeMode.LIGHT -> "Light"
                                    com.bytebox.core.datastore.ThemeMode.DARK -> "Dark"
                                }
                            )
                        },
                        leadingContent = {
                            Icon(
                                Icons.Default.DarkMode,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        trailingContent = {
                            Switch(
                                checked = uiState.themeMode == com.bytebox.core.datastore.ThemeMode.DARK,
                                onCheckedChange = { isDark ->
                                    viewModel.setThemeMode(
                                        if (isDark) com.bytebox.core.datastore.ThemeMode.DARK
                                        else com.bytebox.core.datastore.ThemeMode.LIGHT
                                    )
                                },
                            )
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Camera Backup Section
            SectionHeader(title = "Camera Backup")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    ListItem(
                        headlineContent = { Text("Auto Camera Backup") },
                        supportingContent = { Text("Automatically back up photos and videos from your camera roll to ByteBox") },
                        leadingContent = {
                            Icon(
                                Icons.Default.PhotoCamera,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        trailingContent = {
                            Switch(
                                checked = uiState.autoUploadEnabled,
                                onCheckedChange = viewModel::setAutoUploadEnabled,
                            )
                        },
                    )

                    if (uiState.autoUploadEnabled) {
                        ListItem(
                            headlineContent = { Text("Backup Now") },
                            supportingContent = { Text("Run a backup immediately") },
                            leadingContent = {
                                Icon(
                                    Icons.Default.Backup,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            },
                            modifier = Modifier.clickable { viewModel.runBackupNow() },
                        )
                    }

                    ListItem(
                        headlineContent = {
                            Text(
                                "Backs up new photos and videos to a \"Camera Backup\" folder in your ByteBox storage. Runs every 6 hours when connected to a network.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Storage Section
            SectionHeader(title = "Storage")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                ListItem(
                    headlineContent = { Text("Manage Storage") },
                    supportingContent = { Text("View storage breakdown and upgrade plan") },
                    leadingContent = {
                        Icon(
                            Icons.Default.Storage,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    modifier = Modifier.clickable { },
                )
            }

            // Watch Ad for Extra Storage (free-tier only)
            if (showAds) {
                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                SectionHeader(title = "Bonus Storage")

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = ByteBoxTheme.spacing.md)
                        .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    color = MaterialTheme.colorScheme.surface,
                ) {
                    ListItem(
                        headlineContent = { Text("Watch Ad for Extra Storage") },
                        supportingContent = { Text("Watch a short video to earn 50 MB of bonus storage") },
                        leadingContent = {
                            Icon(
                                Icons.Default.CardGiftcard,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        },
                        modifier = Modifier.clickable {
                            val activity = context as? Activity
                            if (activity != null && AdManager.isRewardedReady()) {
                                AdManager.showRewarded(
                                    activity = activity,
                                    onRewarded = { _ ->
                                        scope.launch {
                                            snackbarHostState.showSnackbar(
                                                "You earned bonus storage!"
                                            )
                                        }
                                    },
                                    onDismissed = {},
                                )
                            } else {
                                scope.launch {
                                    snackbarHostState.showSnackbar("Ad not ready yet. Please try again shortly.")
                                }
                            }
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // About Section
            SectionHeader(title = "About")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    ListItem(
                        headlineContent = { Text("Version") },
                        supportingContent = { Text("1.0.0") },
                        leadingContent = {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                    )

                    ListItem(
                        headlineContent = { Text("Privacy Policy") },
                        leadingContent = {
                            Icon(
                                Icons.Default.Policy,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        modifier = Modifier.clickable { },
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))
        }
    }
}
