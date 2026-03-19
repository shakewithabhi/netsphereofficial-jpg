package com.bytebox.feature.settings.presentation

import android.app.Activity
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
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

    // Image picker launcher
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { viewModel.uploadAvatar(it) }
    }

    // Show snackbar for avatar messages
    LaunchedEffect(uiState.avatarMessage) {
        uiState.avatarMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearAvatarMessage()
        }
    }

    // Show snackbar for password messages
    LaunchedEffect(uiState.changePasswordMessage) {
        uiState.changePasswordMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearChangePasswordMessage()
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
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
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            // Profile Photo Section
            SectionHeader(title = "Profile Photo")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(
                    modifier = Modifier.padding(ByteBoxTheme.spacing.lg),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer)
                            .clickable(enabled = !uiState.isUploadingAvatar) {
                                imagePickerLauncher.launch("image/*")
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        val avatarBitmap = remember(uiState.avatarBase64) {
                            uiState.avatarBase64?.let { base64 ->
                                try {
                                    val bytes = Base64.decode(base64, Base64.NO_WRAP)
                                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                } catch (e: Exception) {
                                    null
                                }
                            }
                        }

                        if (avatarBitmap != null) {
                            Image(
                                bitmap = avatarBitmap.asImageBitmap(),
                                contentDescription = "Profile photo",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            val initials = uiState.user?.displayName
                                ?.split(" ")
                                ?.take(2)
                                ?.mapNotNull { it.firstOrNull()?.uppercase() }
                                ?.joinToString("")
                                ?: "?"
                            Text(
                                text = initials,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }

                        if (uiState.isUploadingAvatar) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                                        CircleShape,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(32.dp),
                                    strokeWidth = 3.dp,
                                )
                            }
                        }

                        // Camera badge
                        if (!uiState.isUploadingAvatar) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.BottomEnd,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primary),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        Icons.Default.CameraAlt,
                                        contentDescription = "Change photo",
                                        modifier = Modifier.size(16.dp),
                                        tint = MaterialTheme.colorScheme.onPrimary,
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                    Text(
                        text = "Tap to change profile photo",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            // Change Password Section
            SectionHeader(title = "Change Password")

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = ByteBoxTheme.spacing.md)
                    .cardShadow(shape = RoundedCornerShape(ByteBoxTheme.radius.lg)),
                shape = RoundedCornerShape(ByteBoxTheme.radius.lg),
                color = MaterialTheme.colorScheme.surface,
            ) {
                ChangePasswordSection(
                    isLoading = uiState.isChangingPassword,
                    onChangePassword = { current, new -> viewModel.changePassword(current, new) },
                    wasSuccessful = uiState.changePasswordSuccess,
                )
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

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

@Composable
private fun ChangePasswordSection(
    isLoading: Boolean,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit,
    wasSuccessful: Boolean,
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showCurrentPassword by remember { mutableStateOf(false) }
    var showNewPassword by remember { mutableStateOf(false) }
    var showConfirmPassword by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    // Clear fields after successful password change
    LaunchedEffect(wasSuccessful) {
        if (wasSuccessful) {
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            validationError = null
        }
    }

    Column(modifier = Modifier.padding(ByteBoxTheme.spacing.lg)) {
        OutlinedTextField(
            value = currentPassword,
            onValueChange = {
                currentPassword = it
                validationError = null
            },
            label = { Text("Current Password") },
            singleLine = true,
            visualTransformation = if (showCurrentPassword) VisualTransformation.None
                else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showCurrentPassword = !showCurrentPassword }) {
                    Icon(
                        if (showCurrentPassword) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility,
                        contentDescription = if (showCurrentPassword) "Hide password"
                        else "Show password",
                    )
                }
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

        OutlinedTextField(
            value = newPassword,
            onValueChange = {
                newPassword = it
                validationError = null
            },
            label = { Text("New Password") },
            singleLine = true,
            visualTransformation = if (showNewPassword) VisualTransformation.None
                else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showNewPassword = !showNewPassword }) {
                    Icon(
                        if (showNewPassword) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility,
                        contentDescription = if (showNewPassword) "Hide password"
                        else "Show password",
                    )
                }
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        )

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

        OutlinedTextField(
            value = confirmPassword,
            onValueChange = {
                confirmPassword = it
                validationError = null
            },
            label = { Text("Confirm New Password") },
            singleLine = true,
            visualTransformation = if (showConfirmPassword) VisualTransformation.None
                else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showConfirmPassword = !showConfirmPassword }) {
                    Icon(
                        if (showConfirmPassword) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility,
                        contentDescription = if (showConfirmPassword) "Hide password"
                        else "Show password",
                    )
                }
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        )

        if (validationError != null) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))
            Text(
                text = validationError!!,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }

        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

        Button(
            onClick = {
                when {
                    currentPassword.isBlank() -> {
                        validationError = "Current password is required"
                    }
                    newPassword.isBlank() -> {
                        validationError = "New password is required"
                    }
                    newPassword.length < 6 -> {
                        validationError = "New password must be at least 6 characters"
                    }
                    newPassword != confirmPassword -> {
                        validationError = "Passwords do not match"
                    }
                    currentPassword == newPassword -> {
                        validationError = "New password must be different from current password"
                    }
                    else -> {
                        validationError = null
                        onChangePassword(currentPassword, newPassword)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading,
            shape = RoundedCornerShape(ByteBoxTheme.radius.md),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text("Change Password")
            }
        }
    }
}
