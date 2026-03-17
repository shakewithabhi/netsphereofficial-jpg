package com.bytebox.feature.settings.presentation

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
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.ui.components.SectionHeader
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.cardShadow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
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

            // Auto-Upload Section
            SectionHeader(title = "Auto-Upload")

            ListItem(
                headlineContent = { Text("Camera Auto-Upload") },
                supportingContent = { Text("Automatically upload new photos and videos") },
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

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

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
