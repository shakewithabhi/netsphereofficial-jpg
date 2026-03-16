package com.bytebox.domain.usecase

import com.bytebox.core.common.Result
import com.bytebox.domain.model.FolderContents
import com.bytebox.domain.repository.FileRepository
import javax.inject.Inject

class GetFolderContentsUseCase @Inject constructor(
    private val fileRepository: FileRepository
) {
    suspend operator fun invoke(
        folderId: String?,
        cursor: String? = null,
        sort: String = "name",
        order: String = "asc"
    ): Result<FolderContents> = fileRepository.getFolderContents(folderId, cursor, sort, order)
}
