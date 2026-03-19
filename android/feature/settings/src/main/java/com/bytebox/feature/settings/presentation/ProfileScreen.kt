package com.bytebox.feature.settings.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.components.ConfirmationDialog
import com.bytebox.core.ui.components.ProfileCard
import com.bytebox.core.ui.components.ProfileMenuItem
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.core.ui.theme.cardShadow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateToDashboard: () -> Unit,
    onNavigateToStorage: () -> Unit,
    onNavigateToShares: () -> Unit,
    onNavigateToTrash: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onLoggedOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Profile",
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
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
                .padding(padding),
        ) {
            // Profile card + storage overview
            uiState.user?.let { user ->
                ProfileCard(
                    displayName = user.displayName ?: "User",
                    email = user.email,
                    plan = user.plan,
                    modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.md),
                )
                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                if (user.storageLimit > 0) {
                    val fraction = (user.storageUsed.toFloat() / user.storageLimit).coerceIn(0f, 1f)
                    val percent = (fraction * 100).toInt()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = ByteBoxTheme.spacing.md)
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF2563EB), Color(0xFF06B6D4)),
                                ),
                            )
                            .padding(20.dp),
                    ) {
                        Column {
                            Text(
                                text = "Storage",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White.copy(alpha = 0.72f),
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "${user.storageUsed.toReadableFileSize()} of ${user.storageLimit.toReadableFileSize()} used",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            BoxWithConstraints(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(50.dp))
                                    .background(Color.White.copy(alpha = 0.25f)),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .width(maxWidth * fraction)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(50.dp))
                                        .background(Color.White),
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = "$percent% used",
                                    fontSize = 12.sp,
                                    color = Color.White.copy(alpha = 0.72f),
                                )
                                if (user.plan == "free") {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color.White.copy(alpha = 0.2f),
                                    ) {
                                        Text(
                                            text = "Upgrade ↗",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color.White,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Navigation menu
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    ProfileMenuItem(
                        icon = Icons.Default.Home,
                        label = "Home",
                        onClick = onNavigateToDashboard,
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    ProfileMenuItem(
                        icon = Icons.Default.Storage,
                        label = "Storage",
                        onClick = onNavigateToStorage,
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    ProfileMenuItem(
                        icon = Icons.Default.Link,
                        label = "Shared Files",
                        onClick = onNavigateToShares,
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    ProfileMenuItem(
                        icon = Icons.Default.Delete,
                        label = "Trash",
                        onClick = onNavigateToTrash,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

            // Settings menu
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    ProfileMenuItem(
                        icon = Icons.Default.Settings,
                        label = "Settings",
                        onClick = onNavigateToSettings,
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    ProfileMenuItem(
                        icon = Icons.Default.HelpOutline,
                        label = "Help & Support",
                        onClick = { },
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Sign out
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                ProfileMenuItem(
                    icon = Icons.AutoMirrored.Filled.Logout,
                    label = "Sign Out",
                    onClick = { showLogoutDialog = true },
                    tint = MaterialTheme.colorScheme.error,
                    labelColor = MaterialTheme.colorScheme.error,
                    showChevron = false,
                )
            }

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
