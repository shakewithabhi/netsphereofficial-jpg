package com.bytebox.feature.preview.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.Result
import com.bytebox.core.common.mimeToCategory
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PreviewUiState(
    val isLoading: Boolean = false,
    val fileName: String? = null,
    val previewUrl: String? = null,
    val category: FileCategory = FileCategory.OTHER,
    val errorMessage: String? = null,
    val mimeType: String = ""
)

@HiltViewModel
class PreviewViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PreviewUiState())
    val uiState: StateFlow<PreviewUiState> = _uiState.asStateFlow()

    fun loadFile(fileId: String) {
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
    }

    fun setFileInfo(fileName: String, mimeType: String) {
        _uiState.update {
            it.copy(fileName = fileName, mimeType = mimeType, category = mimeType.mimeToCategory())
        }
    }
}
