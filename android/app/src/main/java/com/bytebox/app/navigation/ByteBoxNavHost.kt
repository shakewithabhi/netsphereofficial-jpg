package com.bytebox.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bytebox.app.BuildConfig
import com.bytebox.feature.auth.presentation.login.LoginScreen
import com.bytebox.feature.auth.presentation.register.RegisterScreen
import com.bytebox.feature.download.presentation.DownloadScreen
import com.bytebox.feature.files.presentation.FileListScreen
import com.bytebox.feature.preview.presentation.PreviewScreen
import com.bytebox.feature.settings.presentation.SettingsScreen
import com.bytebox.feature.share.presentation.ShareScreen
import com.bytebox.feature.trash.presentation.TrashScreen
import com.bytebox.feature.upload.presentation.UploadScreen

data class BottomNavItem(
    val label: String,
    val icon: @Composable () -> Unit,
    val route: String
)

@Composable
fun ByteBoxNavHost(
    navController: NavHostController = rememberNavController()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val bottomNavItems = listOf(
        BottomNavItem("Files", { Icon(Icons.Default.Folder, "Files") }, Screen.Files.route),
        BottomNavItem("Uploads", { Icon(Icons.Default.CloudUpload, "Uploads") }, Screen.Upload.route),
        BottomNavItem("Downloads", { Icon(Icons.Default.Download, "Downloads") }, Screen.Downloads.route),
        BottomNavItem("Shares", { Icon(Icons.Default.Link, "Shares") }, Screen.Shares.route),
        BottomNavItem("Settings", { Icon(Icons.Default.Settings, "Settings") }, Screen.Settings.route)
    )

    val showBottomBar = currentRoute in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = item.icon,
                            label = { Text(item.label) },
                            selected = currentRoute == item.route,
                            onClick = {
                                if (currentRoute != item.route) {
                                    navController.navigate(item.route) {
                                        popUpTo(Screen.Files.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Login.route,
            modifier = Modifier.padding(padding)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Files.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                    isDebug = BuildConfig.DEBUG,
                    testEmail = if (BuildConfig.DEBUG) BuildConfig.TEST_EMAIL else "",
                    testPassword = if (BuildConfig.DEBUG) BuildConfig.TEST_PASSWORD else ""
                )
            }

            composable(Screen.Register.route) {
                RegisterScreen(
                    onRegisterSuccess = {
                        navController.navigate(Screen.Files.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Files.route) {
                FileListScreen(
                    onFileClick = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                    onNavigateToUpload = { navController.navigate(Screen.Upload.route) },
                    onNavigateToSearch = { /* Search is inline in FileListScreen */ }
                )
            }

            composable(Screen.Upload.route) {
                UploadScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToPreview = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    }
                )
            }

            composable(Screen.Downloads.route) {
                DownloadScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.Preview.route,
                arguments = listOf(
                    navArgument("fileId") { type = NavType.StringType },
                    navArgument("mimeType") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val fileId = backStackEntry.arguments?.getString("fileId") ?: return@composable
                val mimeType = (backStackEntry.arguments?.getString("mimeType") ?: "").replace("_", "/")
                PreviewScreen(
                    fileId = fileId,
                    mimeType = mimeType,
                    onNavigateBack = { navController.popBackStack() },
                    onDownload = { /* Trigger download via DownloadViewModel */ },
                    onShare = { navController.navigate(Screen.Shares.route) }
                )
            }

            composable(Screen.Shares.route) {
                ShareScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onLoggedOut = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Trash.route) {
                TrashScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
