package com.bytebox.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_preferences")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext context: Context
) {
    private val dataStore = context.dataStore

    val viewMode: Flow<ViewMode>
        get() = dataStore.data.map { prefs ->
            when (prefs[VIEW_MODE_KEY]) {
                "grid" -> ViewMode.GRID
                else -> ViewMode.LIST
            }
        }

    val sortBy: Flow<SortBy>
        get() = dataStore.data.map { prefs ->
            when (prefs[SORT_BY_KEY]) {
                "size" -> SortBy.SIZE
                "date" -> SortBy.DATE
                "type" -> SortBy.TYPE
                else -> SortBy.NAME
            }
        }

    val sortOrder: Flow<SortOrder>
        get() = dataStore.data.map { prefs ->
            when (prefs[SORT_ORDER_KEY]) {
                "desc" -> SortOrder.DESC
                else -> SortOrder.ASC
            }
        }

    val uploadOnWifiOnly: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[WIFI_ONLY_KEY] ?: true
        }

    val themeMode: Flow<ThemeMode>
        get() = dataStore.data.map { prefs ->
            when (prefs[THEME_MODE_KEY]) {
                "light" -> ThemeMode.LIGHT
                "dark" -> ThemeMode.DARK
                else -> ThemeMode.SYSTEM
            }
        }

    val autoUploadEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[AUTO_UPLOAD_ENABLED_KEY] ?: false
        }

    val autoUploadFolderId: Flow<String?>
        get() = dataStore.data.map { prefs ->
            prefs[AUTO_UPLOAD_FOLDER_ID_KEY]
        }

    val lastAutoUploadTimestamp: Flow<Long>
        get() = dataStore.data.map { prefs ->
            prefs[LAST_AUTO_UPLOAD_TIMESTAMP_KEY] ?: 0L
        }

    suspend fun setViewMode(mode: ViewMode) {
        dataStore.edit { it[VIEW_MODE_KEY] = mode.name.lowercase() }
    }

    suspend fun setSortBy(sort: SortBy) {
        dataStore.edit { it[SORT_BY_KEY] = sort.name.lowercase() }
    }

    suspend fun setSortOrder(order: SortOrder) {
        dataStore.edit { it[SORT_ORDER_KEY] = order.name.lowercase() }
    }

    suspend fun setUploadOnWifiOnly(wifiOnly: Boolean) {
        dataStore.edit { it[WIFI_ONLY_KEY] = wifiOnly }
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { it[THEME_MODE_KEY] = mode.name.lowercase() }
    }

    suspend fun setAutoUploadEnabled(enabled: Boolean) {
        dataStore.edit { it[AUTO_UPLOAD_ENABLED_KEY] = enabled }
    }

    suspend fun setAutoUploadFolderId(folderId: String?) {
        dataStore.edit {
            if (folderId != null) it[AUTO_UPLOAD_FOLDER_ID_KEY] = folderId
            else it.remove(AUTO_UPLOAD_FOLDER_ID_KEY)
        }
    }

    suspend fun setLastAutoUploadTimestamp(timestamp: Long) {
        dataStore.edit { it[LAST_AUTO_UPLOAD_TIMESTAMP_KEY] = timestamp }
    }

    companion object {
        private val VIEW_MODE_KEY = stringPreferencesKey("view_mode")
        private val SORT_BY_KEY = stringPreferencesKey("sort_by")
        private val SORT_ORDER_KEY = stringPreferencesKey("sort_order")
        private val WIFI_ONLY_KEY = booleanPreferencesKey("wifi_only_upload")
        private val THEME_MODE_KEY = stringPreferencesKey("theme_mode")
        private val AUTO_UPLOAD_ENABLED_KEY = booleanPreferencesKey("auto_upload_enabled")
        private val AUTO_UPLOAD_FOLDER_ID_KEY = stringPreferencesKey("auto_upload_folder_id")
        private val LAST_AUTO_UPLOAD_TIMESTAMP_KEY = longPreferencesKey("last_auto_upload_timestamp")
    }
}

enum class ViewMode { LIST, GRID }
enum class SortBy { NAME, SIZE, DATE, TYPE }
enum class SortOrder { ASC, DESC }
enum class ThemeMode { SYSTEM, LIGHT, DARK }
