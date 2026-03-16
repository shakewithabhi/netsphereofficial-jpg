package com.bytebox.domain.usecase

import com.bytebox.core.common.Result
import com.bytebox.domain.model.ShareLink
import com.bytebox.domain.repository.ShareRepository
import javax.inject.Inject

class CreateShareUseCase @Inject constructor(
    private val shareRepository: ShareRepository
) {
    suspend operator fun invoke(
        fileId: String,
        password: String? = null,
        expiresAt: String? = null,
        maxDownloads: Int? = null
    ): Result<ShareLink> = shareRepository.createShare(fileId, password, expiresAt, maxDownloads)
}
