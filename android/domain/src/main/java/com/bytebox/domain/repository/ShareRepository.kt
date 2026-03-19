package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.ExploreItem
import com.bytebox.domain.model.ShareComment
import com.bytebox.domain.model.ShareInfo
import com.bytebox.domain.model.ShareLink

interface ShareRepository {
    suspend fun createShare(
        fileId: String? = null,
        folderId: String? = null,
        password: String? = null,
        expiresAt: String? = null,
        maxDownloads: Int? = null
    ): Result<ShareLink>

    suspend fun getMyShares(cursor: String? = null): Result<List<ShareLink>>
    suspend fun deleteShare(id: String): Result<Unit>
    suspend fun getShareByCode(code: String): Result<ShareLink>

    suspend fun getExploreItems(
        cursor: String? = null,
        category: String? = null,
    ): Result<Pair<List<ExploreItem>, String?>>

    suspend fun searchExploreItems(query: String, limit: Int = 20): Result<List<ExploreItem>>


    // Public share info with social data
    suspend fun getPublicShareInfo(code: String): Result<ShareInfo>

    // Download URL
    suspend fun getPublicDownloadUrl(code: String): Result<String>

    // Social
    suspend fun toggleLike(code: String): Result<Pair<Boolean, Int>>
    suspend fun getComments(code: String, limit: Int = 50, offset: Int = 0): Result<List<ShareComment>>
    suspend fun addComment(code: String, content: String): Result<ShareComment>
}
