package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.FileVersion
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.FolderContents

interface FileRepository {
    suspend fun getFolderContents(
        folderId: String?,
        cursor: String? = null,
        sort: String = "name",
        order: String = "asc"
    ): Result<FolderContents>

    suspend fun createFolder(name: String, parentId: String?): Result<Folder>
    suspend fun renameFolder(id: String, name: String): Result<Folder>
    suspend fun deleteFolder(id: String): Result<Unit>
    suspend fun trashFile(id: String): Result<Unit>
    suspend fun restoreFile(id: String): Result<Unit>
    suspend fun permanentDeleteFile(id: String): Result<Unit>
    suspend fun trashFolder(id: String): Result<Unit>
    suspend fun restoreFolder(id: String): Result<Unit>
    suspend fun getTrashContents(cursor: String? = null): Result<FolderContents>
    suspend fun getDownloadUrl(fileId: String): Result<String>
    suspend fun searchFiles(query: String, cursor: String? = null): Result<FolderContents>
    suspend fun copyFile(fileId: String, folderId: String?): Result<Unit>
    suspend fun listVersions(fileId: String): Result<List<FileVersion>>
    suspend fun restoreVersion(fileId: String, versionNumber: Int): Result<Unit>
    suspend fun deleteVersion(fileId: String, versionNumber: Int): Result<Unit>
}
