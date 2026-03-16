package com.bytebox.domain.model

data class FolderContents(
    val files: List<FileItem>,
    val folders: List<Folder>,
    val nextCursor: String?,
    val totalCount: Int
)
