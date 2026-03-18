package com.bytebox.feature.share.data

import com.bytebox.core.common.Result
import com.bytebox.core.common.map
import com.bytebox.core.network.api.ShareApi
import com.bytebox.core.network.dto.CreateShareRequest
import com.bytebox.core.network.dto.ExploreItemDto
import com.bytebox.core.network.dto.ShareDto
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.ExploreItem
import com.bytebox.domain.model.ShareLink
import com.bytebox.domain.repository.ShareRepository
import javax.inject.Inject

class ShareRepositoryImpl @Inject constructor(
    private val shareApi: ShareApi
) : ShareRepository {

    override suspend fun createShare(
        fileId: String?,
        folderId: String?,
        password: String?,
        expiresAt: String?,
        maxDownloads: Int?
    ): Result<ShareLink> {
        return safeApiCall {
            shareApi.createShare(CreateShareRequest(
                fileId = fileId,
                folderId = folderId,
                password = password,
                expiresAt = expiresAt,
                maxDownloads = maxDownloads
            ))
        }.map { it.toDomain() }
    }

    override suspend fun getMyShares(cursor: String?): Result<List<ShareLink>> {
        return safeApiCall { shareApi.getMyShares(cursor) }.map { response ->
            response.shares.map { it.toDomain() }
        }
    }

    override suspend fun deleteShare(id: String): Result<Unit> {
        return safeApiCall { shareApi.deleteShare(id) }
    }

    override suspend fun getShareByCode(code: String): Result<ShareLink> {
        return safeApiCall { shareApi.getShare(code) }.map { it.toDomain() }
    }

    override suspend fun getExploreItems(
        cursor: String?,
        category: String?,
    ): Result<Pair<List<ExploreItem>, String?>> {
        return safeApiCall {
            shareApi.getExploreItems(cursor = cursor, category = category)
        }.map { response ->
            response.items.map { it.toDomain() } to response.nextCursor
        }
    }

    private fun ShareDto.toDomain() = ShareLink(
        id = id, fileId = fileId, code = code, shareUrl = shareUrl,
        hasPassword = hasPassword, expiresAt = expiresAt, maxDownloads = maxDownloads,
        downloadCount = downloadCount, isActive = isActive, fileName = fileName,
        fileSize = fileSize, createdAt = createdAt
    )

    private fun ExploreItemDto.toDomain() = ExploreItem(
        id = id, code = code, fileName = fileName, fileSize = fileSize,
        mimeType = mimeType, thumbnailUrl = thumbnailUrl, ownerName = ownerName,
        downloadCount = downloadCount, createdAt = createdAt,
    )
}
