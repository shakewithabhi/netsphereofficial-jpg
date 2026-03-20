package com.bytebox.feature.settings.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.Notification
import com.bytebox.domain.repository.NotificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationUiState(
    val notifications: List<Notification> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class NotificationViewModel @Inject constructor(
    private val notificationRepository: NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationUiState())
    val uiState: StateFlow<NotificationUiState> = _uiState.asStateFlow()

    init {
        loadNotifications()
        loadUnreadCount()
        startPolling()
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = notificationRepository.getNotifications()) {
                is Result.Success -> _uiState.update {
                    it.copy(
                        notifications = result.data,
                        isLoading = false,
                        unreadCount = result.data.count { n -> !n.isRead }
                    )
                }
                is Result.Error -> _uiState.update {
                    it.copy(isLoading = false, error = result.exception.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    fun loadUnreadCount() {
        viewModelScope.launch {
            when (val result = notificationRepository.getUnreadCount()) {
                is Result.Success -> _uiState.update { it.copy(unreadCount = result.data) }
                is Result.Error -> {} // Silently fail for count polling
                is Result.Loading -> {}
            }
        }
    }

    fun markAsRead(id: String) {
        viewModelScope.launch {
            when (notificationRepository.markAsRead(id)) {
                is Result.Success -> {
                    _uiState.update { state ->
                        val updated = state.notifications.map { n ->
                            if (n.id == id) n.copy(isRead = true) else n
                        }
                        state.copy(
                            notifications = updated,
                            unreadCount = updated.count { !it.isRead }
                        )
                    }
                }
                is Result.Error -> {}
                is Result.Loading -> {}
            }
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            when (notificationRepository.markAllAsRead()) {
                is Result.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            notifications = state.notifications.map { it.copy(isRead = true) },
                            unreadCount = 0
                        )
                    }
                }
                is Result.Error -> {}
                is Result.Loading -> {}
            }
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(30_000L) // Poll every 30 seconds
                loadUnreadCount()
            }
        }
    }
}
