package com.bytebox.feature.files.presentation.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.NotificationItem
import com.bytebox.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationsUiState(
    val notifications: List<NotificationItem> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val unreadCount: Int = 0
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init {
        loadNotifications()
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = fileRepository.getNotifications()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        notifications = result.data,
                        isLoading = false,
                        unreadCount = result.data.count { !it.isRead }
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

    fun loadUnreadCount() {
        viewModelScope.launch {
            when (val result = fileRepository.getUnreadNotificationCount()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(unreadCount = result.data)
                }
                else -> {}
            }
        }
    }

    fun markAsRead(id: String) {
        viewModelScope.launch {
            fileRepository.markNotificationRead(id)
            _uiState.value = _uiState.value.copy(
                notifications = _uiState.value.notifications.map {
                    if (it.id == id) it.copy(isRead = true) else it
                },
                unreadCount = (_uiState.value.unreadCount - 1).coerceAtLeast(0)
            )
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            fileRepository.markAllNotificationsRead()
            _uiState.value = _uiState.value.copy(
                notifications = _uiState.value.notifications.map { it.copy(isRead = true) },
                unreadCount = 0
            )
        }
    }
}
