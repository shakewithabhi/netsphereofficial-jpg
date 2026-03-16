package com.bytebox.feature.settings.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.components.SectionHeader
import com.bytebox.core.ui.components.ShimmerBox
import com.bytebox.core.ui.components.StorageIndicator
import com.bytebox.core.ui.theme.ByteBoxTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Settings",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding),
        ) {
            // Profile Card
            if (uiState.user == null && uiState.isLoading) {
                // Shimmer placeholder while loading
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xs),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    elevation = CardDefaults.cardElevation(defaultElevation = ByteBoxTheme.elevation.xs),
                ) {
                    Column(modifier = Modifier.padding(ByteBoxTheme.spacing.lg)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ShimmerBox(width = 52.dp, height = 52.dp, radius = 26.dp)
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))
                            Column {
                                ShimmerBox(width = 120.dp, height = 16.dp)
                                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
                                ShimmerBox(width = 160.dp, height = 12.dp)
                                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
                                ShimmerBox(width = 60.dp, height = 10.dp)
                            }
                        }
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                        ShimmerBox(modifier = Modifier.fillMaxWidth(), height = 8.dp)
                    }
                }
            }

            uiState.user?.let { user ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = ByteBoxTheme.spacing.md, vertical = ByteBoxTheme.spacing.xs),
                    shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                    elevation = CardDefaults.cardElevation(
                        defaultElevation = ByteBoxTheme.elevation.xs,
                    ),
                ) {
                    Column(modifier = Modifier.padding(ByteBoxTheme.spacing.lg)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.AccountCircle,
                                contentDescription = null,
                                modifier = Modifier.size(52.dp),
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(modifier = Modifier.width(ByteBoxTheme.spacing.sm))
                            Column {
                                Text(
                                    text = user.displayName ?: "User",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text = user.email,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = "${user.plan.replaceFirstChar { it.uppercase() }} plan",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                        StorageIndicator(used = user.storageUsed, total = user.storageLimit)
                    }
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // Preferences Section
            SectionHeader(title = "Preferences")

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

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // Storage Section
            SectionHeader(title = "Storage")

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

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // About Section
            SectionHeader(title = "About")

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

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

            // Sign Out
            ListItem(
                headlineContent = {
                    Text("Sign out", color = MaterialTheme.colorScheme.error)
                },
                leadingContent = {
                    Icon(
                        Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                    )
                },
                modifier = Modifier.clickable { showLogoutDialog = true },
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))
        }
    }

    if (showLogoutDialog) {
        ConfirmationDialog(
            title = "Sign Out",
            message = "Are you sure you want to sign out?",
            confirmText = "Sign Out",
            isDestructive = true,
            onConfirm = { viewModel.logout(onLoggedOut) },
            onDismiss = { showLogoutDialog = false },
        )
    }
}
