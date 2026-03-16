package com.bytebox.app.navigation

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign
import com.bytebox.app.BuildConfig
import com.bytebox.core.common.toReadableFileSize
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
    navController: NavHostController = rememberNavController(),
    deepLinkShareCode: String? = null
) {
    // Handle deep link share code
    LaunchedEffect(deepLinkShareCode) {
        if (deepLinkShareCode != null) {
            navController.navigate(Screen.ShareView.createRoute(deepLinkShareCode))
        }
    }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val bottomNavItems = listOf(
        BottomNavItem("Files", { Icon(Icons.Default.Folder, "Files") }, Screen.Files.route),
        BottomNavItem("Uploads", { Icon(Icons.Default.CloudUpload, "Uploads") }, Screen.Upload.createRoute(null)),
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
                    onNavigateToUpload = { folderId ->
                        navController.navigate(Screen.Upload.createRoute(folderId))
                    },
                    onNavigateToSearch = { /* Search is inline in FileListScreen */ }
                )
            }

            composable(
                route = Screen.Upload.route,
                arguments = listOf(
                    navArgument("folderId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                )
            ) { backStackEntry ->
                val folderId = backStackEntry.arguments?.getString("folderId")
                UploadScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToPreview = { fileId, mimeType ->
                        navController.navigate(Screen.Preview.createRoute(fileId, mimeType))
                    },
                    folderId = folderId
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

            composable(
                route = Screen.ShareView.route,
                arguments = listOf(
                    navArgument("code") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val code = backStackEntry.arguments?.getString("code") ?: return@composable
                ShareViewScreen(
                    code = code,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareViewScreen(code: String, onNavigateBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var fileName by remember { mutableStateOf("Loading...") }
    var fileSize by remember { mutableStateOf<Long?>(null) }
    var mimeType by remember { mutableStateOf("") }
    var shareType by remember { mutableStateOf("file") }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var downloadUrl by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(code) {
        try {
            val resp = java.net.URL("http://192.168.1.4:8080/api/v1/s/$code").openConnection() as java.net.HttpURLConnection
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
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentAlignment = Alignment.Center
        ) {
            when {
                isLoading -> CircularProgressIndicator()
                error != null -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.ErrorOutline, null, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(error!!)
                    }
                }
                else -> {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // File icon
                        Surface(
                            modifier = Modifier.size(96.dp),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Box(
                                contentAlignment = Alignment.Center
                            ) {
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
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))
                        Text(fileName, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
                        val sizeVal = fileSize
                        if (sizeVal != null && sizeVal > 0) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                sizeVal.toReadableFileSize(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Spacer(modifier = Modifier.height(32.dp))

                        // Download button
                        Button(
                            onClick = {
                                kotlinx.coroutines.MainScope().launch {
                                    try {
                                        val conn = java.net.URL("http://192.168.1.4:8080/api/v1/s/$code/download").openConnection() as java.net.HttpURLConnection
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
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
                        ) {
                            Icon(Icons.Default.Download, null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Download", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }
        }
    }
}
