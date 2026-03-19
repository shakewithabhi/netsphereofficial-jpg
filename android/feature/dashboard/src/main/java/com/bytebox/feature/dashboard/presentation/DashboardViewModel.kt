package com.bytebox.feature.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.AdManager
import com.bytebox.core.common.Result
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.domain.model.FileItem
import com.bytebox.domain.model.Folder
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
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
    private val uploadTaskDao: UploadTaskDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
        observeUploadCompletions()
    }

    private fun observeUploadCompletions() {
        viewModelScope.launch {
            var hadActive = false
            uploadTaskDao.getActiveTasks()
                .map { it.isNotEmpty() }
                .distinctUntilChanged()
                .collect { hasActive ->
                    Timber.d("DASHBOARD: Upload observer — hasActive=$hasActive, hadActive=$hadActive")
                    if (hadActive && !hasActive) {
                        Timber.d("DASHBOARD: All uploads completed! Triggering refresh...")
                        loadDashboard()
                    }
                    hadActive = hasActive
                }
        }
    }

    fun loadDashboard() {
        Timber.d("DASHBOARD: loadDashboard() called")
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            // Load profile
            when (val result = authRepository.getProfile()) {
                is Result.Success -> {
                    Timber.d("DASHBOARD: Profile loaded: ${result.data.email}")
                    _uiState.update { it.copy(user = result.data) }
                    // Cache user plan and update ad visibility
                    userPreferences.setUserPlan(result.data.plan)
                    AdManager.setShouldShowAds(result.data.plan == "free")
                }
                is Result.Error -> {
                    Timber.e("DASHBOARD: Profile failed: ${result.exception.message}")
                    _uiState.update { it.copy(errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }

            // Load recent files (across all folders) and root folders in parallel
            val recentDeferred = async { fileRepository.getRecentFiles(limit = 10) }
            val foldersDeferred = async {
                fileRepository.getFolderContents(
                    folderId = null,
                    sort = "created_at",
                    order = "desc",
                )
            }

            val foldersResult = foldersDeferred.await()
            when (val result = recentDeferred.await()) {
                is Result.Success -> {
                    Timber.d("DASHBOARD: getRecentFiles returned ${result.data.size} files: ${result.data.map { it.name }}")
                    _uiState.update { it.copy(recentFiles = result.data) }
                }
                is Result.Error -> {
                    Timber.e("DASHBOARD: getRecentFiles FAILED: ${result.exception.message}")
                    // Fallback: use root folder contents if /files/recent is unavailable
                    if (foldersResult is Result.Success) {
                        val fallbackFiles = foldersResult.data.files.take(10)
                        Timber.d("DASHBOARD: Fallback to getFolderContents, got ${fallbackFiles.size} files: ${fallbackFiles.map { it.name }}")
                        _uiState.update {
                            it.copy(recentFiles = fallbackFiles)
                        }
                    } else {
                        Timber.e("DASHBOARD: Fallback also failed, foldersResult is error")
                    }
                }
                is Result.Loading -> {}
            }

            when (foldersResult) {
                is Result.Success -> {
                    Timber.d("DASHBOARD: getFolderContents returned ${foldersResult.data.folders.size} folders, ${foldersResult.data.files.size} files")
                    _uiState.update {
                        it.copy(folders = foldersResult.data.folders, isLoading = false)
                    }
                }
                is Result.Error -> {
                    Timber.e("DASHBOARD: getFolderContents FAILED: ${foldersResult.exception.message}")
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = foldersResult.exception.message)
                    }
                }
                is Result.Loading -> {}
            }

            Timber.d("DASHBOARD: Final state — recentFiles=${_uiState.value.recentFiles.size}, folders=${_uiState.value.folders.size}, isLoading=${_uiState.value.isLoading}, error=${_uiState.value.errorMessage}")
        }
    }

    fun trashFile(fileId: String) {
        viewModelScope.launch {
            when (fileRepository.trashFile(fileId)) {
                is Result.Success -> {
                    _uiState.update { state ->
                        state.copy(recentFiles = state.recentFiles.filter { it.id != fileId })
                    }
                }
                is Result.Error -> {}
                is Result.Loading -> {}
            }
        }
    }
}
