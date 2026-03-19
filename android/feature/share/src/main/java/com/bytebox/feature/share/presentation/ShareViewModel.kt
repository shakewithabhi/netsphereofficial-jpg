package com.bytebox.feature.share.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.ShareLink
import com.bytebox.domain.repository.FileRepository
import com.bytebox.domain.repository.ShareRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PickerBreadcrumb(val folderId: String?, val name: String)

data class ShareUiState(
    // Existing share list
    val shares: List<ShareLink> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,

    // Step 2: File Picker
    val showFilePicker: Boolean = false,
    val pickerFolders: List<Folder> = emptyList(),
    val pickerFiles: List<FileItem> = emptyList(),
    val pickerIsLoading: Boolean = false,
    val pickerFolderStack: List<PickerBreadcrumb> = listOf(PickerBreadcrumb(null, "All Files")),
    val pickerSearchQuery: String = "",
    val pickerIsSearching: Boolean = false,
    val selectedFileIds: Set<String> = emptySet(),
    val selectedFolderIds: Set<String> = emptySet(),

    // Step 3: Share Options
    val showShareOptions: Boolean = false,
    val isPrivateLink: Boolean = false,
    val extractionCode: String = "",
    val isCreatingShare: Boolean = false,
    val createdShareLink: ShareLink? = null,
) {
    val currentFolderId: String? get() = pickerFolderStack.lastOrNull()?.folderId
    val selectionCount: Int get() = selectedFileIds.size + selectedFolderIds.size
    val hasSelection: Boolean get() = selectionCount > 0
}

@HiltViewModel
class ShareViewModel @Inject constructor(
    private val shareRepository: ShareRepository,
    private val fileRepository: FileRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareUiState())
    val uiState: StateFlow<ShareUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadShares()
    }

    fun loadShares() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = shareRepository.getMyShares()) {
                is Result.Success -> _uiState.update { it.copy(shares = result.data, isLoading = false) }
                is Result.Error -> _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                is Result.Loading -> {}
            }
        }
    }

    fun deleteShare(id: String) {
        viewModelScope.launch {
            shareRepository.deleteShare(id)
            loadShares()
        }
    }

    // ── File Picker (Step 2) ────────────────────────────────────────────────

    fun openFilePicker() {
        _uiState.update {
            it.copy(
                showFilePicker = true,
                pickerFolderStack = listOf(PickerBreadcrumb(null, "All Files")),
                selectedFileIds = emptySet(),
                selectedFolderIds = emptySet(),
                pickerSearchQuery = "",
            )
        }
        loadPickerContents(null)
    }

    fun closeFilePicker() {
        _uiState.update {
            it.copy(
                showFilePicker = false,
                pickerFolders = emptyList(),
                pickerFiles = emptyList(),
                pickerFolderStack = listOf(PickerBreadcrumb(null, "All Files")),
                selectedFileIds = emptySet(),
                selectedFolderIds = emptySet(),
                pickerSearchQuery = "",
                pickerIsSearching = false,
            )
        }
    }

    private fun loadPickerContents(folderId: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(pickerIsLoading = true) }
            when (val result = fileRepository.getFolderContents(folderId)) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        pickerFolders = result.data.folders,
                        pickerFiles = result.data.files,
                        pickerIsLoading = false,
                    )
                }
                is Result.Error -> _uiState.update {
                    it.copy(pickerIsLoading = false, errorMessage = result.exception.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun navigatePickerToFolder(folder: Folder) {
        _uiState.update {
            it.copy(
                pickerFolderStack = it.pickerFolderStack + PickerBreadcrumb(folder.id, folder.name),
                pickerSearchQuery = "",
                pickerIsSearching = false,
            )
        }
        loadPickerContents(folder.id)
    }

    fun navigatePickerBack(): Boolean {
        val stack = _uiState.value.pickerFolderStack
        if (stack.size <= 1) return false
        _uiState.update {
            val newStack = it.pickerFolderStack.dropLast(1)
            it.copy(
                pickerFolderStack = newStack,
                pickerSearchQuery = "",
                pickerIsSearching = false,
            )
        }
        loadPickerContents(_uiState.value.currentFolderId)
        return true
    }

    fun onPickerSearchQueryChanged(query: String) {
        _uiState.update { it.copy(pickerSearchQuery = query) }
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.update { it.copy(pickerIsSearching = false) }
            loadPickerContents(_uiState.value.currentFolderId)
            return
        }
        searchJob = viewModelScope.launch {
            delay(300)
            _uiState.update { it.copy(pickerIsSearching = true, pickerIsLoading = true) }
            when (val result = fileRepository.searchFiles(query)) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        pickerFolders = result.data.folders,
                        pickerFiles = result.data.files,
                        pickerIsLoading = false,
                    )
                }
                is Result.Error -> _uiState.update {
                    it.copy(pickerIsLoading = false, errorMessage = result.exception.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun toggleFileSelection(fileId: String) {
        _uiState.update {
            val newSet = it.selectedFileIds.toMutableSet()
            if (fileId in newSet) newSet.remove(fileId) else newSet.add(fileId)
            it.copy(selectedFileIds = newSet, selectedFolderIds = emptySet())
        }
    }

    fun toggleFolderSelection(folderId: String) {
        _uiState.update {
            val newSet = it.selectedFolderIds.toMutableSet()
            if (folderId in newSet) newSet.remove(folderId) else newSet.add(folderId)
            it.copy(selectedFolderIds = newSet, selectedFileIds = emptySet())
        }
    }

    fun toggleSelectAll() {
        _uiState.update { state ->
            val allFileIds = state.pickerFiles.map { it.id }.toSet()
            val allSelected = allFileIds == state.selectedFileIds && state.selectedFolderIds.isEmpty()
            if (allSelected) {
                state.copy(selectedFileIds = emptySet(), selectedFolderIds = emptySet())
            } else {
                state.copy(selectedFileIds = allFileIds, selectedFolderIds = emptySet())
            }
        }
    }

    // ── Share Options (Step 3) ──────────────────────────────────────────────

    fun confirmFileSelection() {
        _uiState.update {
            it.copy(
                showFilePicker = false,
                showShareOptions = true,
                extractionCode = generateCode(),
            )
        }
    }

    fun closeShareOptions() {
        _uiState.update { it.copy(showShareOptions = false) }
    }

    fun togglePrivateLink() {
        _uiState.update {
            val newPrivate = !it.isPrivateLink
            it.copy(
                isPrivateLink = newPrivate,
                extractionCode = if (newPrivate) generateCode() else "",
            )
        }
    }

    fun executeShare() {
        val state = _uiState.value
        val fileId = state.selectedFileIds.firstOrNull()
        val folderId = state.selectedFolderIds.firstOrNull()
        if (fileId == null && folderId == null) return

        viewModelScope.launch {
            _uiState.update { it.copy(isCreatingShare = true) }
            val password = if (state.isPrivateLink) state.extractionCode else null
            val result = shareRepository.createShare(
                fileId = fileId,
                folderId = folderId,
                password = password,
            )
            when (result) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isCreatingShare = false,
                            createdShareLink = result.data,
                        )
                    }
                    loadShares()
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(isCreatingShare = false, errorMessage = result.exception.message)
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearShareResult() {
        _uiState.update {
            it.copy(
                showShareOptions = false,
                showFilePicker = false,
                createdShareLink = null,
                selectedFileIds = emptySet(),
                selectedFolderIds = emptySet(),
                isPrivateLink = false,
                extractionCode = "",
                pickerSearchQuery = "",
            )
        }
    }

    private fun generateCode(): String {
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return (1..4).map { chars.random() }.joinToString("")
    }
}
