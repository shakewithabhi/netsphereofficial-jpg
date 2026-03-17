package com.bytebox.core.ui.theme

import androidx.compose.ui.graphics.Color

data class FolderColorPair(
    val accent: Color,
    val background: Color,
)

private val folderColorPalette = listOf(
    FolderColorPair(FolderBlue, FolderBlueBg),
    FolderColorPair(FolderPurple, FolderPurpleBg),
    FolderColorPair(FolderPink, FolderPinkBg),
    FolderColorPair(FolderOrange, FolderOrangeBg),
    FolderColorPair(FolderGreen, FolderGreenBg),
    FolderColorPair(FolderYellow, FolderYellowBg),
    FolderColorPair(FolderRed, FolderRedBg),
    FolderColorPair(FolderTeal, FolderTealBg),
)

fun getFolderColors(index: Int): FolderColorPair {
    return folderColorPalette[index % folderColorPalette.size]
}

fun getFolderAccentColor(index: Int): Color {
    return folderColorPalette[index % folderColorPalette.size].accent
}

fun getFolderBackgroundColor(index: Int): Color {
    return folderColorPalette[index % folderColorPalette.size].background
}
