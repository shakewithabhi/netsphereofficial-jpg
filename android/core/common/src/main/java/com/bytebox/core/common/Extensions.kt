package com.bytebox.core.common

import java.text.DecimalFormat
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun Long.toReadableFileSize(): String {
    if (this <= 0) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB", "TB")
    val digitGroups = (Math.log10(this.toDouble()) / Math.log10(1024.0)).toInt()
    val formatter = DecimalFormat("#,##0.#")
    return "${formatter.format(this / Math.pow(1024.0, digitGroups.toDouble()))} ${units[digitGroups]}"
}

fun String.toLocalDateTime(): LocalDateTime {
    return Instant.parse(this).atZone(ZoneId.systemDefault()).toLocalDateTime()
}

fun LocalDateTime.toRelativeTime(): String {
    val now = LocalDateTime.now()
    val minutes = java.time.Duration.between(this, now).toMinutes()
    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 1440 -> "${minutes / 60}h ago"
        minutes < 10080 -> "${minutes / 1440}d ago"
        else -> this.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
    }
}

fun String.mimeToCategory(): FileCategory = when {
    startsWith("image/") -> FileCategory.IMAGE
    startsWith("video/") -> FileCategory.VIDEO
    startsWith("audio/") -> FileCategory.AUDIO
    this == "application/pdf" -> FileCategory.PDF
    startsWith("text/") -> FileCategory.TEXT_DOCUMENT
    this in listOf(
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) -> FileCategory.OFFICE_DOCUMENT
    startsWith("application/") -> FileCategory.DOCUMENT
    else -> FileCategory.OTHER
}

enum class FileCategory {
    IMAGE, VIDEO, AUDIO, PDF, TEXT_DOCUMENT, OFFICE_DOCUMENT, DOCUMENT, OTHER
}
