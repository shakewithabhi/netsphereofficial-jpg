package com.bytebox.app.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.byteboxapp.com.BuildConfig
import com.bytebox.core.common.toReadableFileSize
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.bytebox.feature.auth.presentation.forgotpassword.ForgotPasswordScreen
import com.bytebox.feature.auth.presentation.forgotpassword.ResetPasswordScreen
import com.bytebox.feature.auth.presentation.login.LoginScreen
import com.bytebox.feature.auth.presentation.onboarding.OnboardingScreen
import com.bytebox.feature.auth.presentation.register.RegisterScreen
import com.bytebox.feature.dashboard.presentation.DashboardScreen
import com.bytebox.feature.download.presentation.DownloadScreen
import com.bytebox.feature.files.presentation.FileListScreen
import com.bytebox.feature.preview.presentation.PreviewScreen
import com.bytebox.feature.settings.presentation.ProfileScreen
import com.bytebox.feature.settings.presentation.SettingsScreen
import com.bytebox.feature.settings.presentation.StorageAnalyticsScreen
import com.bytebox.feature.share.presentation.ShareScreen
import com.bytebox.feature.explore.presentation.ExploreScreen
import com.bytebox.feature.explore.presentation.ExploreVideoScreen
import com.bytebox.feature.files.presentation.favorites.FavoritesScreen
import com.bytebox.feature.trash.presentation.TrashScreen
import com.bytebox.feature.upload.presentation.UploadScreen
import kotlinx.coroutines.launch

data class BottomNavItem(
    val label: String,
    val icon: @Composable () -> Unit,
    val route: String
)

@Composable
fun ByteBoxNavHost(
    navController: NavHostController = rememberNavController(),
    deepLinkShareCode: String? = null
) {
    LaunchedEffect(deepLinkShareCode) {
        if (deepLinkShareCode != null) {
            navController.navigate(Screen.ShareView.createRoute(deepLinkShareCode))
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // 5-tab navigation: Home, Files, Explore, Shares, Profile
    val bottomNavItems = listOf(
        BottomNavItem("Home", { Icon(Icons.Default.Home, "Home") }, Screen.Dashboard.route),
        BottomNavItem("Files", { Icon(Icons.Default.Folder, "Files") }, Screen.Files.route),
        BottomNavItem("Explore", { Icon(Icons.Default.Explore, "Explore") }, Screen.Explore.route),
        BottomNavItem("Shares", { Icon(Icons.Default.Link, "Shares") }, Screen.Shares.route),
        BottomNavItem("Profile", { Icon(Icons.Default.Person, "Profile") }, Screen.Profile.route),
    )

    val showBottomBar = currentRoute in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = Color(0xFF1E293B),
                    tonalElevation = 0.dp,
                ) {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = item.icon,
                            label = { Text(item.label, style = MaterialTheme.typography.labelSmall) },
                            selected = currentRoute == item.route,
                            onClick = {
                                if (currentRoute != item.route) {
                                    navController.navigate(item.route) {
                                        popUpTo(Screen.Dashboard.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color.White,
                                selectedTextColor = Color(0xFF60A5FA),
                                indicatorColor = Color(0xFF2563EB).copy(alpha = 0.30f),
                                unselectedIconColor = Color.White.copy(alpha = 0.45f),
                                unselectedTextColor = Color.White.copy(alpha = 0.45f),
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Login.route,
            modifier = Modifier.padding(padding),
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = tween(300),
                ) + fadeIn(animationSpec = tween(300))
            },
            exitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Start,
                    animationSpec = tween(300),
                ) + fadeOut(animationSpec = tween(300))
            },
            popEnterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = tween(250),
                ) + fadeIn(animationSpec = tween(250))
            },
            popExitTransition = {
                slideOutOfContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.End,
                    animationSpec = tween(250),
                ) + fadeOut(animationSpec = tween(250))
            },
        ) {
            composable(Screen.Onboarding.route) {
                OnboardingScreen(
                    onGetStarted = {
                        navController.navigate(Screen.Register.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    },
                    onSignIn = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    },
                )
            }

            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                    onNavigateToForgotPassword = { navController.navigate(Screen.ForgotPassword.route) },
                    isDebug = BuildConfig.DEBUG,
                    testEmail = if (BuildConfig.DEBUG) BuildConfig.TEST_EMAIL else "",
                    testPassword = if (BuildConfig.DEBUG) BuildConfig.TEST_PASSWORD else "",
                    googleClientId = BuildConfig.GOOGLE_CLIENT_ID,
                )
            }

            composable(Screen.Register.route) {
                RegisterScreen(
                    onRegisterSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onFolderClick = { folderId ->
                        navController.navigate(Screen.Files.route)
                    },
                    onFileClick = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                    onUploadClick = {
                        navController.navigate(Screen.Upload.createRoute(null, sharePublicly = false))
                    },
                    onSeeAllFolders = {
                        navController.navigate(Screen.Files.route)
                    },
                    onFavoritesClick = {
                        navController.navigate(Screen.Favorites.route)
                    },
                    onSharesClick = {
                        navController.navigate(Screen.Shares.route)
                    },
                    onNotificationsClick = {
                        // TODO: Navigate to Notifications screen when implemented
                        android.widget.Toast.makeText(navController.context, "Notifications coming soon!", android.widget.Toast.LENGTH_SHORT).show()
                    },
                    onProfileClick = {
                        navController.navigate(Screen.Profile.route) {
                            popUpTo(Screen.Dashboard.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }

            composable(Screen.ForgotPassword.route) {
                ForgotPasswordScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToResetPassword = { token ->
                        navController.navigate(Screen.ResetPassword.createRoute(token))
                    },
                )
            }

            composable(
                route = Screen.ResetPassword.route,
                arguments = listOf(
                    navArgument("token") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                ),
            ) {
                ResetPasswordScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                )
            }

            composable(Screen.Files.route) {
                FileListScreen(
                    onFileClick = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                    onNavigateToUpload = { folderId ->
                        navController.navigate(Screen.Upload.createRoute(folderId))
                    },
                    onNavigateToSearch = { },
                    onNavigateToTrash = { navController.navigate(Screen.Trash.route) },
                )
            }

            composable(
                route = Screen.Upload.route,
                arguments = listOf(
                    navArgument("folderId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("sharePublicly") {
                        type = NavType.BoolType
                        defaultValue = false
                    },
                ),
            ) { backStackEntry ->
                val folderId = backStackEntry.arguments?.getString("folderId")
                val sharePublicly = backStackEntry.arguments?.getBoolean("sharePublicly") ?: false
                UploadScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToPreview = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                    folderId = folderId,
                    sharePublicly = sharePublicly,
                )
            }

            composable(Screen.Downloads.route) {
                DownloadScreen(
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(
                route = Screen.Preview.route,
                arguments = listOf(
                    navArgument("fileId") { type = NavType.StringType },
                    navArgument("mimeType") { type = NavType.StringType },
                ),
            ) { backStackEntry ->
                val fileId = backStackEntry.arguments?.getString("fileId") ?: return@composable
                val mimeType = (backStackEntry.arguments?.getString("mimeType") ?: "").replace("_", "/")
                PreviewScreen(
                    fileId = fileId,
                    mimeType = mimeType,
                    onNavigateBack = { navController.popBackStack() },
                    onDownload = { },
                    onShare = { navController.navigate(Screen.Shares.route) },
                )
            }

            composable(Screen.Shares.route) {
                ShareScreen(
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Profile.route) {
                val activity = LocalContext.current as? android.app.Activity
                ProfileScreen(
                    onNavigateToDashboard = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Dashboard.route) { inclusive = true }
                        }
                    },
                    onNavigateToStorage = {
                        navController.navigate(Screen.StorageAnalytics.route)
                    },
                    onNavigateToShares = {
                        navController.navigate(Screen.Shares.route) {
                            popUpTo(Screen.Dashboard.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onNavigateToTrash = {
                        navController.navigate(Screen.Trash.route)
                    },
                    onNavigateToSettings = {
                        navController.navigate(Screen.Settings.route)
                    },
                    onLoggedOut = {
                        activity?.let {
                            val intent = it.intent
                            it.finish()
                            it.startActivity(intent)
                        }
                    },
                )
            }

            composable(Screen.Settings.route) {
                val activity = LocalContext.current as? android.app.Activity
                SettingsScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onLoggedOut = {
                        activity?.let {
                            val intent = it.intent
                            it.finish()
                            it.startActivity(intent)
                        }
                    },
                )
            }

            composable(Screen.StorageAnalytics.route) {
                StorageAnalyticsScreen(
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Trash.route) {
                TrashScreen(
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Favorites.route) {
                FavoritesScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onFileClick = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                )
            }

            composable(Screen.Explore.route) {
                ExploreScreen(
                    onItemClick = { code ->
                        navController.navigate(Screen.ExploreVideo.createRoute(code))
                    },
                    onUploadClick = {
                        navController.navigate(Screen.Upload.createRoute(null, sharePublicly = true))
                    },
                )
            }

            composable(
                route = Screen.ExploreVideo.route,
                arguments = listOf(
                    navArgument("code") { type = NavType.StringType },
                ),
            ) { backStackEntry ->
                val code = backStackEntry.arguments?.getString("code") ?: return@composable
                ExploreVideoScreen(
                    code = code,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToItem = { relatedCode ->
                        navController.navigate(Screen.ExploreVideo.createRoute(relatedCode))
                    },
                )
            }

            composable(
                route = Screen.ShareView.route,
                arguments = listOf(
                    navArgument("code") { type = NavType.StringType },
                ),
            ) { backStackEntry ->
                val code = backStackEntry.arguments?.getString("code") ?: return@composable
                ShareViewScreen(
                    code = code,
                    onNavigateBack = { navController.popBackStack() },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareViewScreen(code: String, onNavigateBack: () -> Unit) {
    val context = LocalContext.current
    var fileName by remember { mutableStateOf("Loading...") }
    var fileSize by remember { mutableStateOf<Long?>(null) }
    var mimeType by remember { mutableStateOf("") }
    var shareType by remember { mutableStateOf("file") }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(code) {
        try {
            val resp = java.net.URL("${BuildConfig.BASE_URL}s/$code").openConnection() as java.net.HttpURLConnection
            resp.setRequestProperty("Accept", "application/json")
            if (resp.responseCode == 200) {
                val json = org.json.JSONObject(resp.inputStream.bufferedReader().readText())
                val data = if (json.has("data")) json.getJSONObject("data") else json
                fileName = data.optString("file_name", data.optString("folder_name", "Shared File"))
                fileSize = if (data.has("file_size")) data.optLong("file_size") else null
                mimeType = data.optString("mime_type", "")
                shareType = data.optString("share_type", "file")
            } else {
                error = "Share not found or expired"
            }
        } catch (e: Exception) {
            error = e.message
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Shared File") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = androidx.compose.ui.graphics.Color.White,
                    navigationIconContentColor = androidx.compose.ui.graphics.Color.White,
                ),
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            when {
                isLoading -> CircularProgressIndicator()
                error != null -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.ErrorOutline,
                            null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
                        Text(
                            error!!,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                else -> {
                    Column(
                        modifier = Modifier.padding(ByteBoxTheme.spacing.xxl),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Surface(
                            modifier = Modifier.size(96.dp),
                            shape = RoundedCornerShape(ByteBoxTheme.radius.xxl),
                            color = MaterialTheme.colorScheme.primaryContainer,
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    when {
                                        shareType == "folder" -> Icons.Default.Folder
                                        mimeType.startsWith("image/") -> Icons.Default.Image
                                        mimeType.startsWith("video/") -> Icons.Default.Videocam
                                        mimeType.startsWith("audio/") -> Icons.Default.MusicNote
                                        else -> Icons.Default.Description
                                    },
                                    null,
                                    modifier = Modifier.size(48.dp),
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))
                        Text(
                            fileName,
                            style = MaterialTheme.typography.headlineMedium,
                            textAlign = TextAlign.Center,
                        )

                        val sizeVal = fileSize
                        if (sizeVal != null && sizeVal > 0) {
                            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
                            Text(
                                sizeVal.toReadableFileSize(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }

                        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))

                        com.bytebox.core.ui.components.ByteBoxButton(
                            text = "Download",
                            onClick = {
                                kotlinx.coroutines.MainScope().launch {
                                    try {
                                        val conn = java.net.URL("${BuildConfig.BASE_URL}s/$code/download").openConnection() as java.net.HttpURLConnection
                                        conn.requestMethod = "POST"
                                        conn.setRequestProperty("Content-Type", "application/json")
                                        conn.doOutput = true
                                        conn.outputStream.write("{}".toByteArray())
                                        if (conn.responseCode == 200) {
                                            val json = org.json.JSONObject(conn.inputStream.bufferedReader().readText())
                                            val data = if (json.has("data")) json.getJSONObject("data") else json
                                            val url = data.getString("url")
                                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                                            context.startActivity(intent)
                                        }
                                    } catch (_: Exception) {}
                                }
                            },
                            leadingIcon = Icons.Default.Download,
                        )
                    }
                }
            }
        }
    }
}
