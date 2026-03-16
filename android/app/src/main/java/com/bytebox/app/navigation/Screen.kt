package com.bytebox.app.navigation

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object Files : Screen("files")
    data object Upload : Screen("upload")
    data object Downloads : Screen("downloads")
    data object Preview : Screen("preview/{fileId}/{mimeType}") {
        fun createRoute(fileId: String, mimeType: String) =
            "preview/$fileId/${mimeType.replace("/", "_")}"
    }
    data object Shares : Screen("shares")
    data object Settings : Screen("settings")
    data object Trash : Screen("trash")
}
