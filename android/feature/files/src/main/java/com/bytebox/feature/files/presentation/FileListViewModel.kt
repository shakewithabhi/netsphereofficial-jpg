package com.bytebox.feature.files.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.datastore.SortBy
import com.bytebox.core.datastore.SortOrder
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.core.datastore.ViewMode
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.FolderContents
import com.bytebox.domain.repository.FileRepository
import com.bytebox.domain.repository.ShareRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FileListUiState(
    val files: List<FileItem> = emptyList(),
    val folders: List<Folder> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val errorMessage: String? = null,
    val currentFolderId: String? = null,
    val currentFolderName: String = "My Files",
    val breadcrumbs: List<BreadcrumbItem> = listOf(BreadcrumbItem(null, "My Files")),
    val viewMode: ViewMode = ViewMode.LIST,
    val sortBy: SortBy = SortBy.NAME,
    val sortOrder: SortOrder = SortOrder.ASC,
    val nextCursor: String? = null,
    val selectedItems: Set<String> = emptySet(),
    val isSelectionMode: Boolean = false,
    val showCreateFolderDialog: Boolean = false,
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val shareUrl: String? = null,
    val shareItemName: String? = null,
    val shareItemSize: Long = 0,
    val shareItemMimeType: String? = null,
    val shareItemIsFolder: Boolean = false,
    val isCreatingShare: Boolean = false,
    val pinnedFileIds: Set<String> = emptySet(),
    val exploreShareSuccess: Boolean = false,
    val showRemoteUploadDialog: Boolean = false,
    val isRemoteUploading: Boolean = false,
    val remoteUploadError: String? = null,
    val remoteUploadSuccess: String? = null
)

data class BreadcrumbItem(val folderId: String?, val name: String)

@HiltViewModel
class FileListViewModel @Inject constructor(
    private val fileRepository: FileRepository,
    private val shareRepository: ShareRepository,
    private val userPreferences: UserPreferences,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(FileListUiState())
    val uiState: StateFlow<FileListUiState> = _uiState.asStateFlow()
    private var searchJob: Job? = null

    init {
        viewModelScope.launch {
            userPreferences.viewMode.collect { mode ->
                _uiState.update { it.copy(viewMode = mode) }
            }
        }
        viewModelScope.launch {
            userPreferences.sortBy.collect { sort ->
                _uiState.update { it.copy(sortBy = sort) }
                loadContents()
            }
        }
        viewModelScope.launch {
            userPreferences.sortOrder.collect { order ->
                _uiState.update { it.copy(sortOrder = order) }
                loadContents()
            }
        }
        loadContents()
    }

    fun loadContents() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val state = _uiState.value
            val result = fileRepository.getFolderContents(
                folderId = state.currentFolderId,
                sort = state.sortBy.name.lowercase(),
                order = state.sortOrder.name.lowercase()
            )
            when (result) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            files = result.data.files,
                            folders = result.data.folders,
                            nextCursor = result.data.nextCursor,
                            isLoading = false
                        )
                    }
                    refreshPinnedStatus()
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun loadMore() {
        val cursor = _uiState.value.nextCursor ?: return
        if (_uiState.value.isLoadingMore) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            val state = _uiState.value
            val result = fileRepository.getFolderContents(
                folderId = state.currentFolderId,
                cursor = cursor,
                sort = state.sortBy.name.lowercase(),
                order = state.sortOrder.name.lowercase()
            )
            when (result) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            files = it.files + result.data.files,
                            folders = it.folders + result.data.folders,
                            nextCursor = result.data.nextCursor,
                            isLoadingMore = false
                        )
                    }
                }
                is Result.Error -> _uiState.update { it.copy(isLoadingMore = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun navigateToFolder(folder: Folder) {
        _uiState.update {
            it.copy(
                currentFolderId = folder.id,
                currentFolderName = folder.name,
                breadcrumbs = it.breadcrumbs + BreadcrumbItem(folder.id, folder.name),
                selectedItems = emptySet(),
                isSelectionMode = false
            )
        }
        loadContents()
    }

    fun navigateToBreadcrumb(item: BreadcrumbItem) {
        val crumbs = _uiState.value.breadcrumbs
        val index = crumbs.indexOf(item)
        if (index < 0) return

        _uiState.update {
            it.copy(
                currentFolderId = item.folderId,
                currentFolderName = item.name,
                breadcrumbs = crumbs.subList(0, index + 1),
                selectedItems = emptySet(),
                isSelectionMode = false
            )
        }
        loadContents()
    }

    fun navigateBack(): Boolean {
        val crumbs = _uiState.value.breadcrumbs
        if (crumbs.size <= 1) return false

        val parent = crumbs[crumbs.size - 2]
        _uiState.update {
            it.copy(
                currentFolderId = parent.folderId,
                currentFolderName = parent.name,
                breadcrumbs = crumbs.dropLast(1)
            )
        }
        loadContents()
        return true
    }

    fun toggleViewMode() {
        viewModelScope.launch {
            val newMode = if (_uiState.value.viewMode == ViewMode.LIST) ViewMode.GRID else ViewMode.LIST
            userPreferences.setViewMode(newMode)
        }
    }

    fun setSortBy(sort: SortBy) {
        viewModelScope.launch { userPreferences.setSortBy(sort) }
    }

    fun toggleSortOrder() {
        viewModelScope.launch {
            val newOrder = if (_uiState.value.sortOrder == SortOrder.ASC) SortOrder.DESC else SortOrder.ASC
            userPreferences.setSortOrder(newOrder)
        }
    }

    fun toggleSelection(id: String) {
        _uiState.update {
            val newSelected = it.selectedItems.toMutableSet()
            if (newSelected.contains(id)) newSelected.remove(id) else newSelected.add(id)
            it.copy(selectedItems = newSelected, isSelectionMode = newSelected.isNotEmpty())
        }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedItems = emptySet(), isSelectionMode = false) }
    }

    fun showCreateFolderDialog() {
        _uiState.update { it.copy(showCreateFolderDialog = true) }
    }

    fun hideCreateFolderDialog() {
        _uiState.update { it.copy(showCreateFolderDialog = false) }
    }

    fun createFolder(name: String) {
        viewModelScope.launch {
            val result = fileRepository.createFolder(name, _uiState.value.currentFolderId)
            if (result is Result.Success) {
                hideCreateFolderDialog()
                loadContents()
            }
        }
    }

    fun renameFolder(folderId: String, newName: String) {
        viewModelScope.launch {
            fileRepository.renameFolder(folderId, newName)
            loadContents()
        }
    }

    fun copyFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.copyFile(fileId, _uiState.value.currentFolderId)
            loadContents()
        }
    }

    fun toggleStar(fileId: String, isCurrentlyStarred: Boolean) {
        // Optimistically update the local state
        _uiState.update { state ->
            state.copy(
                files = state.files.map { file ->
                    if (file.id == fileId) file.copy(isStarred = !isCurrentlyStarred) else file
                }
            )
        }
        viewModelScope.launch {
            val result = if (isCurrentlyStarred) {
                fileRepository.unstarFile(fileId)
            } else {
                fileRepository.starFile(fileId)
            }
            // Revert on failure
            if (result is Result.Error) {
                _uiState.update { state ->
                    state.copy(
                        files = state.files.map { file ->
                            if (file.id == fileId) file.copy(isStarred = isCurrentlyStarred) else file
                        }
                    )
                }
            }
        }
    }

    fun trashFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.trashFile(fileId)
            loadContents()
        }
    }

    fun trashFolder(folderId: String) {
        viewModelScope.launch {
            fileRepository.trashFolder(folderId)
            loadContents()
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.update { it.copy(isSearching = false) }
            loadContents()
            return
        }

        searchJob = viewModelScope.launch {
            delay(300) // debounce
            _uiState.update { it.copy(isSearching = true, isLoading = true) }
            when (val result = fileRepository.searchFiles(query)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            files = result.data.files,
                            folders = result.data.folders,
                            isLoading = false,
                        )
                    }
                }
                is Result.Error -> _uiState.update { it.copy(isLoading = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun shareFile(fileId: String) {
        val file = _uiState.value.files.find { it.id == fileId }
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingShare = true) }
            when (val result = shareRepository.createShare(fileId = fileId)) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        shareUrl = result.data.shareUrl,
                        shareItemName = file?.name ?: "File",
                        shareItemSize = file?.size ?: 0,
                        shareItemMimeType = file?.mimeType,
                        shareItemIsFolder = false,
                        isCreatingShare = false
                    )
                }
                is Result.Error -> _uiState.update { it.copy(isCreatingShare = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun clearExploreShareSuccess() {
        _uiState.update { it.copy(exploreShareSuccess = false) }
    }

    fun shareToExplore(fileId: String) {
        val file = _uiState.value.files.find { it.id == fileId }
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingShare = true) }
            // Create a public share (no password) — this makes it visible in Explore
            when (val result = shareRepository.createShare(fileId = fileId)) {
                is Result.Success -> _uiState.update { state ->
                    state.copy(
                        shareUrl = result.data.shareUrl,
                        shareItemName = file?.name ?: "File",
                        shareItemSize = file?.size ?: 0,
                        shareItemMimeType = file?.mimeType,
                        shareItemIsFolder = false,
                        isCreatingShare = false,
                        exploreShareSuccess = true,
                        files = state.files.map { f ->
                            if (f.id == fileId) f.copy(shareCode = result.data.code) else f
                        },
                    )
                }
                is Result.Error -> _uiState.update { it.copy(isCreatingShare = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun unshareFromExplore(fileId: String, shareCode: String) {
        viewModelScope.launch {
            // Find the share ID by code and delete it
            when (shareRepository.deleteShare(shareCode)) {
                is Result.Success -> {
                    // Update local state to remove share_code
                    _uiState.update { state ->
                        state.copy(
                            files = state.files.map { f ->
                                if (f.id == fileId) f.copy(shareCode = null) else f
                            }
                        )
                    }
                }
                is Result.Error -> {}
                is Result.Loading -> {}
            }
        }
    }

    fun shareFolder(folderId: String) {
        val folder = _uiState.value.folders.find { it.id == folderId }
        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingShare = true) }
            when (val result = shareRepository.createShare(folderId = folderId)) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        shareUrl = result.data.shareUrl,
                        shareItemName = folder?.name ?: "Folder",
                        shareItemSize = 0,
                        shareItemMimeType = null,
                        shareItemIsFolder = true,
                        isCreatingShare = false
                    )
                }
                is Result.Error -> _uiState.update { it.copy(isCreatingShare = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun clearShareUrl() {
        _uiState.update { it.copy(shareUrl = null, shareItemName = null) }
    }

    fun pinFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.pinFile(fileId)
            _uiState.update { it.copy(pinnedFileIds = it.pinnedFileIds + fileId) }
        }
    }

    fun unpinFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.unpinFile(fileId)
            _uiState.update { it.copy(pinnedFileIds = it.pinnedFileIds - fileId) }
        }
    }

    fun showRemoteUploadDialog() {
        _uiState.update { it.copy(showRemoteUploadDialog = true, remoteUploadError = null, remoteUploadSuccess = null) }
    }

    fun hideRemoteUploadDialog() {
        _uiState.update { it.copy(showRemoteUploadDialog = false, remoteUploadError = null, remoteUploadSuccess = null) }
    }

    fun remoteUpload(url: String, fileName: String?) {
        if (url.isBlank()) return
        val trimmedUrl = url.trim()
        if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
            _uiState.update { it.copy(remoteUploadError = "Please enter a valid URL starting with http:// or https://") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isRemoteUploading = true, remoteUploadError = null) }
            val result = fileRepository.remoteUpload(
                url = trimmedUrl,
                folderId = _uiState.value.currentFolderId,
                fileName = fileName?.takeIf { it.isNotBlank() }
            )
            when (result) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isRemoteUploading = false,
                            remoteUploadSuccess = result.data.name,
                            showRemoteUploadDialog = false
                        )
                    }
                    loadContents()
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(
                            isRemoteUploading = false,
                            remoteUploadError = result.exception.message ?: "Failed to download file"
                        )
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearRemoteUploadSuccess() {
        _uiState.update { it.copy(remoteUploadSuccess = null) }
    }

    private fun refreshPinnedStatus() {
        viewModelScope.launch {
            val fileIds = _uiState.value.files.map { it.id }
            val pinned = fileIds.filter { fileRepository.isFilePinned(it) }.toSet()
            _uiState.update { it.copy(pinnedFileIds = pinned) }
        }
    }
}
