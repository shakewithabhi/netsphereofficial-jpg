package com.bytebox.feature.files.presentation.favorites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FavoritesUiState(
    val files: List<FileItem> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class FavoritesViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(FavoritesUiState())
    val uiState: StateFlow<FavoritesUiState> = _uiState.asStateFlow()

    init { loadFavorites() }

    fun loadFavorites() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = fileRepository.getStarredFiles()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        files = result.data.files,
                        isLoading = false
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = result.exception.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun unstarFile(fileId: String) {
        viewModelScope.launch {
            fileRepository.unstarFile(fileId)
            loadFavorites()
        }
    }
}
