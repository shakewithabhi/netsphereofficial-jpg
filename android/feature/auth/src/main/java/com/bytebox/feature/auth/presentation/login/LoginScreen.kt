package com.bytebox.feature.auth.presentation.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bytebox.core.ui.components.ByteBoxButton
import com.bytebox.core.ui.components.ByteBoxTextField
import com.bytebox.core.ui.components.OrDivider
import com.bytebox.core.ui.components.SocialLoginButton
import com.bytebox.core.ui.theme.ByteBoxTheme
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import timber.log.Timber

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToForgotPassword: () -> Unit = {},
    isDebug: Boolean = false,
    testEmail: String = "",
    testPassword: String = "",
    googleClientId: String = "",
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(uiState.loginSuccess) {
        if (uiState.loginSuccess) onLoginSuccess()
    }

    val onGoogleSignIn: () -> Unit = {
        coroutineScope.launch {
            try {
                val credentialManager = CredentialManager.create(context)
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(googleClientId)
                    .build()
                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()
                val result = credentialManager.getCredential(context, request)
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(result.credential.data)
                viewModel.googleLogin(googleIdTokenCredential.idToken)
            } catch (e: Exception) {
                Timber.e(e, "Google sign-in failed")
                viewModel.clearError()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(ByteBoxTheme.spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Column(
            modifier = Modifier.widthIn(max = 400.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Logo icon — rounded square
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Cloud,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            Text(
                text = "Welcome back",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
            Text(
                text = "Sign in to your ByteBox account",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))



            ByteBoxTextField(
                value = uiState.email,
                onValueChange = viewModel::onEmailChange,
                label = "Email",
                leadingIcon = Icons.Default.Email,
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
                error = null,
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.sm))

            ByteBoxTextField(
                value = uiState.password,
                onValueChange = viewModel::onPasswordChange,
                label = "Password",
                leadingIcon = Icons.Default.Lock,
                isPassword = true,
                imeAction = ImeAction.Done,
                onImeAction = {
                    focusManager.clearFocus()
                    viewModel.login()
                },
                error = null,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onNavigateToForgotPassword) {
                    Text(
                        text = "Forgot password?",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            if (uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = ByteBoxTheme.spacing.xs),
                )
            }

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

            ByteBoxButton(
                text = "Sign In",
                onClick = viewModel::login,
                isLoading = uiState.isLoading,
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            OrDivider()

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.lg))

            com.bytebox.core.ui.components.ByteBoxOutlinedButton(
                text = "Continue with Google",
                onClick = onGoogleSignIn,
                enabled = !uiState.isLoading && googleClientId.isNotBlank(),
            )

            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxl))

            Row(
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Don't have an account?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onNavigateToRegister) {
                    Text("Sign Up")
                }
            }

            if (isDebug) {
                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xl))
                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = ByteBoxTheme.spacing.xxl),
                    color = MaterialTheme.colorScheme.outlineVariant,
                )
                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))

                Text(
                    text = "DEBUG",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xs))

                OutlinedButton(
                    onClick = { viewModel.fillTestCredentials(testEmail, testPassword) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Fill Test Credentials")
                }

                Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))

                Text(
                    text = "$testEmail / $testPassword",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                )
            }
        }
    }
}
