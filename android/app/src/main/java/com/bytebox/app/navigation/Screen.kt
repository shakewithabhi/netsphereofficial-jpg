package com.bytebox.app.navigation

sealed class Screen(val route: String) {
    data object Onboarding : Screen("onboarding")
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object Dashboard : Screen("dashboard")
    data object Files : Screen("files")
    data object Upload : Screen("upload?folderId={folderId}") {
        fun createRoute(folderId: String?) =
            if (folderId != null) "upload?folderId=$folderId" else "upload"
    }
    data object Downloads : Screen("downloads")
    data object Preview : Screen("preview/{fileId}/{mimeType}") {
        fun createRoute(fileId: String, mimeType: String) =
            "preview/$fileId/${mimeType.replace("/", "_")}"
    }
    data object Shares : Screen("shares")
    data object ForgotPassword : Screen("forgot_password")
    data object ResetPassword : Screen("reset_password?token={token}") {
        fun createRoute(token: String?) =
            if (token != null) "reset_password?token=$token" else "reset_password"
    }
    data object Settings : Screen("settings")
    data object Profile : Screen("profile")
    data object StorageAnalytics : Screen("storage_analytics")
    data object Trash : Screen("trash")
    data object Favorites : Screen("favorites")
    data object Notifications : Screen("notifications")
    data object ShareView : Screen("share_view/{code}") {
        fun createRoute(code: String) = "share_view/$code"
    }
}
