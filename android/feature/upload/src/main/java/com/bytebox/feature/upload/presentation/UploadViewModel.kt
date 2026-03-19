package com.bytebox.feature.upload.presentation

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.domain.model.UploadTask
import com.bytebox.domain.repository.UploadRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UploadUiState(
    val tasks: List<UploadTask> = emptyList(),
    val currentFolderId: String? = null
)

@HiltViewModel
class UploadViewModel @Inject constructor(
    private val uploadRepository: UploadRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(UploadUiState(
        currentFolderId = savedStateHandle.get<String>("folderId")
    ))
    val uiState: StateFlow<UploadUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            uploadRepository.getAllTasks().collect { tasks ->
                _uiState.update { it.copy(tasks = tasks) }
            }
        }
    }

    fun uploadFile(uri: Uri, fileName: String, fileSize: Long, mimeType: String, sharePublicly: Boolean = false) {
        viewModelScope.launch {
            uploadRepository.enqueueUpload(
                localFileUri = uri.toString(),
                fileName = fileName,
                fileSize = fileSize,
                mimeType = mimeType,
                folderId = _uiState.value.currentFolderId,
                sharePublicly = sharePublicly,
            )
        }
    }

    fun cancelUpload(taskId: Long) {
        viewModelScope.launch { uploadRepository.cancelUpload(taskId) }
    }

    fun retryUpload(taskId: Long) {
        viewModelScope.launch { uploadRepository.retryUpload(taskId) }
    }

    fun clearCompleted() {
        viewModelScope.launch { uploadRepository.clearCompleted() }
    }

    fun removeUpload(taskId: Long) {
        viewModelScope.launch { uploadRepository.removeUpload(taskId) }
    }

    fun setCurrentFolder(folderId: String?) {
        _uiState.update { it.copy(currentFolderId = folderId) }
    }
}
