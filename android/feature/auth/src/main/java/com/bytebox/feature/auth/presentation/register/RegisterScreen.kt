package com.bytebox.feature.auth.presentation.register

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.ui.components.ByteBoxButton
import com.bytebox.core.ui.components.ByteBoxTextField
import com.bytebox.core.ui.theme.ByteBoxTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateBack: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState.registerSuccess) {
        if (uiState.registerSuccess) onRegisterSuccess()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(ByteBoxTheme.spacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier.widthIn(max = 400.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Create Account",
                    style = MaterialTheme.typography.headlineLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

                Text(
                    text = "Start storing your files securely",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))

                ByteBoxTextField(
                    value = uiState.displayName,
                    onValueChange = viewModel::onDisplayNameChange,
                    label = "Display Name",
                    leadingIcon = Icons.Default.Person,
                    imeAction = ImeAction.Next,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                ByteBoxTextField(
                    value = uiState.email,
                    onValueChange = viewModel::onEmailChange,
                    label = "Email",
                    leadingIcon = Icons.Default.Email,
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                ByteBoxTextField(
                    value = uiState.password,
                    onValueChange = viewModel::onPasswordChange,
                    label = "Password",
                    leadingIcon = Icons.Default.Lock,
                    isPassword = true,
                    imeAction = ImeAction.Next,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

                ByteBoxTextField(
                    value = uiState.confirmPassword,
                    onValueChange = viewModel::onConfirmPasswordChange,
                    label = "Confirm Password",
                    leadingIcon = Icons.Default.Lock,
                    isPassword = true,
                    imeAction = ImeAction.Done,
                    onImeAction = {
                        focusManager.clearFocus()
                        viewModel.register()
                    },
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

                Text(
                    text = "Password must contain: 1 uppercase, 1 lowercase, 1 digit, 1 special character",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                )

                if (uiState.errorMessage != null) {
                    Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))
                    Text(
                        text = uiState.errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))

                ByteBoxButton(
                    text = "Create Account",
                    onClick = viewModel::register,
                    isLoading = uiState.isLoading,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Already have an account?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(onClick = onNavigateBack) {
                        Text("Sign In")
                    }
                }
            }
        }
    }
}
