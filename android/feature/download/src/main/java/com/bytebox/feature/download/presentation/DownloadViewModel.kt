package com.bytebox.feature.download.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.domain.model.DownloadTask
import com.bytebox.domain.repository.DownloadRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DownloadUiState(
    val tasks: List<DownloadTask> = emptyList()
)

@HiltViewModel
class DownloadViewModel @Inject constructor(
    private val downloadRepository: DownloadRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DownloadUiState())
    val uiState: StateFlow<DownloadUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            downloadRepository.getAllTasks().collect { tasks ->
                _uiState.update { it.copy(tasks = tasks) }
            }
        }
    }

    fun downloadFile(fileId: String, fileName: String, fileSize: Long) {
        viewModelScope.launch {
            downloadRepository.enqueueDownload(fileId, fileName, fileSize)
        }
    }

    fun cancelDownload(taskId: Long) {
        viewModelScope.launch { downloadRepository.cancelDownload(taskId) }
    }

    fun retryDownload(taskId: Long) {
        viewModelScope.launch { downloadRepository.retryDownload(taskId) }
    }

    fun clearCompleted() {
        viewModelScope.launch { downloadRepository.clearCompleted() }
    }
}
