package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.ShareLink

interface ShareRepository {
    suspend fun createShare(
        fileId: String,
        password: String? = null,
        expiresAt: String? = null,
        maxDownloads: Int? = null
    ): Result<ShareLink>

    suspend fun getMyShares(cursor: String? = null): Result<List<ShareLink>>
    suspend fun deleteShare(id: String): Result<Unit>
    suspend fun getShareByCode(code: String): Result<ShareLink>
}
