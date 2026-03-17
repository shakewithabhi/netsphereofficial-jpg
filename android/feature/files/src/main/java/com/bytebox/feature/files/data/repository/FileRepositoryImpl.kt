package com.bytebox.feature.files.data.repository

import com.bytebox.core.common.Result
import com.bytebox.core.common.map
import com.bytebox.core.database.dao.FileDao
import com.bytebox.core.database.dao.FolderDao
import com.bytebox.core.database.entity.CachedFileEntity
import com.bytebox.core.database.entity.CachedFolderEntity
import com.bytebox.core.network.api.FileApi
import com.bytebox.core.network.dto.CreateFolderRequest
import com.bytebox.core.network.dto.FileDto
import com.bytebox.core.network.dto.FileVersionDto
import com.bytebox.core.network.dto.FolderDto
import com.bytebox.core.network.dto.RenameFolderRequest
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.FileVersion
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.FolderContents
import com.bytebox.domain.repository.FileRepository
import javax.inject.Inject

class FileRepositoryImpl @Inject constructor(
    private val fileApi: FileApi,
    private val fileDao: FileDao,
    private val folderDao: FolderDao
) : FileRepository {

    override suspend fun getFolderContents(
        folderId: String?,
        cursor: String?,
        sort: String,
        order: String
    ): Result<FolderContents> {
        val result = safeApiCall {
            if (folderId == null) {
                fileApi.getRootContents(cursor = cursor, sort = sort, order = order)
            } else {
                fileApi.getFolderContents(folderId, cursor = cursor, sort = sort, order = order)
            }
        }

        // Cache results
        if (result is Result.Success) {
            val data = result.data
            if (cursor == null) {
                // First page — replace cache for this folder
                fileDao.deleteFilesByFolder(folderId)
            }
            fileDao.insertFiles(data.files.map { it.toEntity() })
            folderDao.insertFolders(data.folders.map { it.toEntity() })
        }

        return result.map { response ->
            FolderContents(
                files = response.files.map { it.toDomain() },
                folders = response.folders.map { it.toDomain() },
                nextCursor = response.nextCursor,
                totalCount = response.totalCount
            )
        }
    }

    override suspend fun createFolder(name: String, parentId: String?): Result<Folder> {
        return safeApiCall {
            fileApi.createFolder(CreateFolderRequest(name, parentId))
        }.map { it.toDomain() }
    }

    override suspend fun renameFolder(id: String, name: String): Result<Folder> {
        return safeApiCall {
            fileApi.renameFolder(id, RenameFolderRequest(name))
        }.map { it.toDomain() }
    }

    override suspend fun deleteFolder(id: String): Result<Unit> {
        return safeApiCall { fileApi.deleteFolder(id) }
    }

    override suspend fun trashFile(id: String): Result<Unit> {
        return safeApiCall { fileApi.trashFile(id) }
    }

    override suspend fun restoreFile(id: String): Result<Unit> {
        return safeApiCall { fileApi.restoreFile(id) }
    }

    override suspend fun permanentDeleteFile(id: String): Result<Unit> {
        return safeApiCall { fileApi.permanentDeleteFile(id) }
    }

    override suspend fun trashFolder(id: String): Result<Unit> {
        return safeApiCall { fileApi.trashFolder(id) }
    }

    override suspend fun restoreFolder(id: String): Result<Unit> {
        return safeApiCall { fileApi.restoreFolder(id) }
    }

    override suspend fun getTrashContents(cursor: String?): Result<FolderContents> {
        return safeApiCall { fileApi.getTrashContents(cursor) }.map { response ->
            FolderContents(
                files = response.files.map { it.toDomain() },
                folders = response.folders.map { it.toDomain() },
                nextCursor = response.nextCursor,
                totalCount = response.totalCount
            )
        }
    }

    override suspend fun getDownloadUrl(fileId: String): Result<String> {
        return safeApiCall { fileApi.getDownloadUrl(fileId) }.map { it.url }
    }

    override suspend fun copyFile(fileId: String, folderId: String?): Result<Unit> {
        return safeApiCall {
            fileApi.copyFile(fileId, com.bytebox.core.network.dto.CopyFileRequest(folderId))
        }.map { }
    }

    override suspend fun searchFiles(query: String, cursor: String?): Result<FolderContents> {
        return safeApiCall { fileApi.searchFiles(query, cursor) }.map { response ->
            FolderContents(
                files = response.files.map { it.toDomain() },
                folders = response.folders.map { it.toDomain() },
                nextCursor = response.nextCursor,
                totalCount = response.totalCount
            )
        }
    }

    override suspend fun listVersions(fileId: String): Result<List<FileVersion>> {
        return safeApiCall { fileApi.listVersions(fileId) }.map { response ->
            response.versions.map { it.toDomain() }
        }
    }

    override suspend fun restoreVersion(fileId: String, versionNumber: Int): Result<Unit> {
        return safeApiCall { fileApi.restoreVersion(fileId, versionNumber) }
    }

    override suspend fun deleteVersion(fileId: String, versionNumber: Int): Result<Unit> {
        return safeApiCall { fileApi.deleteVersion(fileId, versionNumber) }
    }

    private fun FileVersionDto.toDomain() = FileVersion(
        id = id, fileId = fileId, versionNumber = versionNumber,
        size = size, contentHash = contentHash, createdAt = createdAt
    )

    private fun FileDto.toDomain() = FileItem(
        id = id, name = name, folderId = folderId, size = size,
        mimeType = mimeType, thumbnailUrl = thumbnailUrl, scanStatus = scanStatus,
        trashedAt = trashedAt, createdAt = createdAt, updatedAt = updatedAt
    )

    private fun FolderDto.toDomain() = Folder(
        id = id, name = name, parentId = parentId, path = path,
        trashedAt = trashedAt, createdAt = createdAt, updatedAt = updatedAt
    )

    private fun FileDto.toEntity() = CachedFileEntity(
        id = id, name = name, folderId = folderId, size = size,
        mimeType = mimeType, thumbnailUrl = thumbnailUrl, scanStatus = scanStatus,
        trashedAt = trashedAt, createdAt = createdAt, updatedAt = updatedAt
    )

    private fun FolderDto.toEntity() = CachedFolderEntity(
        id = id, name = name, parentId = parentId, path = path,
        trashedAt = trashedAt, createdAt = createdAt, updatedAt = updatedAt
    )
}
