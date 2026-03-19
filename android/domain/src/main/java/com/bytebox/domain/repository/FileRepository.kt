package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.FileVersion
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.FolderContents
import com.bytebox.domain.model.NotificationItem

interface FileRepository {
    suspend fun getFolderContents(
        folderId: String?,
        cursor: String? = null,
        sort: String = "name",
        order: String = "asc"
    ): Result<FolderContents>

    suspend fun getRecentFiles(limit: Int = 20): Result<List<FileItem>>
    suspend fun createFolder(name: String, parentId: String?): Result<Folder>
    suspend fun renameFolder(id: String, name: String): Result<Folder>
    suspend fun deleteFolder(id: String): Result<Unit>
    suspend fun trashFile(id: String): Result<Unit>
    suspend fun restoreFile(id: String): Result<Unit>
    suspend fun permanentDeleteFile(id: String): Result<Unit>
    suspend fun trashFolder(id: String): Result<Unit>
    suspend fun restoreFolder(id: String): Result<Unit>
    suspend fun starFile(id: String): Result<Unit>
    suspend fun unstarFile(id: String): Result<Unit>
    suspend fun getStarredFiles(cursor: String? = null): Result<FolderContents>
    suspend fun getTrashContents(cursor: String? = null): Result<FolderContents>
    suspend fun getDownloadUrl(fileId: String): Result<String>
    suspend fun searchFiles(query: String, cursor: String? = null): Result<FolderContents>
    suspend fun copyFile(fileId: String, folderId: String?): Result<Unit>
    suspend fun listVersions(fileId: String): Result<List<FileVersion>>
    suspend fun restoreVersion(fileId: String, versionNumber: Int): Result<Unit>
    suspend fun deleteVersion(fileId: String, versionNumber: Int): Result<Unit>
    suspend fun pinFile(fileId: String): Result<Unit>
    suspend fun unpinFile(fileId: String): Result<Unit>
    suspend fun isFilePinned(fileId: String): Boolean
    suspend fun getNotifications(limit: Int = 20): Result<List<NotificationItem>>
    suspend fun getUnreadNotificationCount(): Result<Int>
    suspend fun markNotificationRead(id: String): Result<Unit>
    suspend fun markAllNotificationsRead(): Result<Unit>
    suspend fun registerPushToken(token: String): Result<Unit>
    suspend fun remoteUpload(url: String, folderId: String? = null, fileName: String? = null): Result<FileItem>
    suspend fun renameFile(id: String, name: String): Result<FileItem>
    suspend fun moveFile(id: String, targetFolderId: String?): Result<FileItem>
}
