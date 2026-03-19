package com.bytebox.feature.share.data

import com.bytebox.core.common.Result
import com.bytebox.core.common.map
import com.bytebox.core.network.api.ShareApi
import com.bytebox.core.network.dto.AddCommentRequest
import com.bytebox.core.network.dto.CreateShareRequest
import com.bytebox.core.network.dto.ExploreItemDto
import com.bytebox.core.network.dto.ShareCommentDto
import com.bytebox.core.network.dto.ShareDto
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.ExploreItem
import com.bytebox.domain.model.ShareComment
import com.bytebox.domain.model.ShareInfo
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

    override suspend fun getPublicShareInfo(code: String): Result<ShareInfo> {
        return safeApiCall { shareApi.getPublicShareInfo(code) }.map { dto ->
            ShareInfo(
                shareType = dto.shareType,
                fileName = dto.fileName,
                fileSize = dto.fileSize,
                mimeType = dto.mimeType,
                folderName = dto.folderName,
                hasPassword = dto.hasPassword,
                isVideo = dto.isVideo,
                thumbnailUrl = dto.thumbnailUrl,
                videoThumbnailUrl = dto.videoThumbnailUrl,
                hlsUrl = dto.hlsUrl,
                likeCount = dto.likeCount,
                commentCount = dto.commentCount,
                isLiked = dto.isLiked,
                ownerName = dto.ownerName,
                downloadCount = dto.downloadCount,
            )
        }
    }

    override suspend fun getPublicDownloadUrl(code: String): Result<String> {
        return safeApiCall { shareApi.downloadPublicShare(code) }.map { it.url }
    }

    override suspend fun toggleLike(code: String): Result<Pair<Boolean, Int>> {
        return safeApiCall { shareApi.toggleLike(code) }.map { it.liked to it.likeCount }
    }

    override suspend fun getComments(code: String, limit: Int, offset: Int): Result<List<ShareComment>> {
        return safeApiCall { shareApi.getComments(code, limit, offset) }.map { resp ->
            resp.comments.map { it.toDomain() }
        }
    }

    override suspend fun addComment(code: String, content: String): Result<ShareComment> {
        return safeApiCall { shareApi.addComment(code, AddCommentRequest(content)) }.map { it.toDomain() }
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
        likeCount = likeCount, commentCount = commentCount, hlsUrl = hlsUrl,
    )

    private fun ShareCommentDto.toDomain() = ShareComment(
        id = id, shareId = shareId, userId = userId, userName = userName,
        content = content, createdAt = createdAt,
    )
}
