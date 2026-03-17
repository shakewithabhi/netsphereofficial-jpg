package com.bytebox.feature.preview.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.Result
import com.bytebox.core.common.mimeToCategory
import com.bytebox.domain.model.FileVersion
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class PreviewUiState(
    val isLoading: Boolean = false,
    val fileName: String? = null,
    val previewUrl: String? = null,
    val category: FileCategory = FileCategory.OTHER,
    val errorMessage: String? = null,
    val mimeType: String = "",
    val versions: List<FileVersion> = emptyList(),
    val isLoadingVersions: Boolean = false,
    val versionError: String? = null,
    val versionActionMessage: String? = null
)

@HiltViewModel
class PreviewViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PreviewUiState())
    val uiState: StateFlow<PreviewUiState> = _uiState.asStateFlow()

    private var currentFileId: String? = null

    fun loadFile(fileId: String) {
        currentFileId = fileId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            when (val result = fileRepository.getDownloadUrl(fileId)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            previewUrl = result.data,
                            category = it.mimeType.mimeToCategory()
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = result.exception.message)
                    }
                }
                is Result.Loading -> {}
            }
        }

        loadVersions(fileId)
    }

    fun setFileInfo(fileName: String, mimeType: String) {
        _uiState.update {
            it.copy(fileName = fileName, mimeType = mimeType, category = mimeType.mimeToCategory())
        }
    }

    fun loadVersions(fileId: String? = null) {
        val id = fileId ?: currentFileId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingVersions = true, versionError = null) }

            when (val result = fileRepository.listVersions(id)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoadingVersions = false,
                            versions = result.data.sortedByDescending { v -> v.versionNumber }
                        )
                    }
                }
                is Result.Error -> {
                    Timber.e(result.exception, "Failed to load versions")
                    _uiState.update {
                        it.copy(
                            isLoadingVersions = false,
                            versionError = result.exception.message
                        )
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun restoreVersion(versionNumber: Int) {
        val fileId = currentFileId ?: return
        viewModelScope.launch {
            when (val result = fileRepository.restoreVersion(fileId, versionNumber)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(versionActionMessage = "Version $versionNumber restored")
                    }
                    loadVersions()
                    loadFile(fileId)
                }
                is Result.Error -> {
                    Timber.e(result.exception, "Failed to restore version")
                    _uiState.update {
                        it.copy(versionActionMessage = "Failed to restore: ${result.exception.message}")
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun deleteVersion(versionNumber: Int) {
        val fileId = currentFileId ?: return
        viewModelScope.launch {
            when (val result = fileRepository.deleteVersion(fileId, versionNumber)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(versionActionMessage = "Version $versionNumber deleted")
                    }
                    loadVersions()
                }
                is Result.Error -> {
                    Timber.e(result.exception, "Failed to delete version")
                    _uiState.update {
                        it.copy(versionActionMessage = "Failed to delete: ${result.exception.message}")
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearVersionActionMessage() {
        _uiState.update { it.copy(versionActionMessage = null) }
    }
}
