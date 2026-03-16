package com.bytebox.feature.trash.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TrashUiState(
    val files: List<FileItem> = emptyList(),
    val folders: List<Folder> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class TrashViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrashUiState())
    val uiState: StateFlow<TrashUiState> = _uiState.asStateFlow()

    init {
        loadTrash()
    }

    fun loadTrash() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = fileRepository.getTrashContents()) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            files = result.data.files,
                            folders = result.data.folders,
                            isLoading = false
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun restoreFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.restoreFile(fileId)
            loadTrash()
        }
    }

    fun restoreFolder(folderId: String) {
        viewModelScope.launch {
            fileRepository.restoreFolder(folderId)
            loadTrash()
        }
    }

    fun permanentDeleteFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.permanentDeleteFile(fileId)
            loadTrash()
        }
    }
}
