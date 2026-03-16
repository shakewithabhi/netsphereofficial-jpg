package com.bytebox.core.common

object Constants {
    const val PAGE_SIZE = 50
    const val PREFETCH_THRESHOLD = 0.8f
    const val CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
    const val MAX_CONCURRENT_CHUNKS = 3
    const val SMALL_FILE_THRESHOLD = 10 * 1024 * 1024L // 10MB
    const val THUMBNAIL_CACHE_SIZE = 50L * 1024 * 1024 // 50MB
    const val PRESIGNED_URL_EXPIRY_HOURS = 1
    const val TRASH_RETENTION_DAYS = 30
    const val FREE_STORAGE_BYTES = 5L * 1024 * 1024 * 1024 // 5GB
}
