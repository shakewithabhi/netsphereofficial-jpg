package com.bytebox.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.AdManager
import com.bytebox.core.common.Result
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val user: User? = null,
    val folders: List<Folder> = emptyList(),
    val recentFiles: List<FileItem> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val fileRepository: FileRepository,
    private val userPreferences: UserPreferences,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
    }

    fun loadDashboard() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            // Load profile
            when (val result = authRepository.getProfile()) {
                is Result.Success -> {
                    _uiState.update { it.copy(user = result.data) }
                    // Cache user plan and update ad visibility
                    userPreferences.setUserPlan(result.data.plan)
                    AdManager.setShouldShowAds(result.data.plan == "free")
                }
                is Result.Error -> _uiState.update { it.copy(errorMessage = result.exception.message) }
                is Result.Loading -> {}
            }

            // Load root folder contents (sorted by date for recent files)
            when (val result = fileRepository.getFolderContents(
                folderId = null,
                sort = "created_at",
                order = "desc",
            )) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            folders = result.data.folders,
                            recentFiles = result.data.files.take(10),
                            isLoading = false,
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
}
