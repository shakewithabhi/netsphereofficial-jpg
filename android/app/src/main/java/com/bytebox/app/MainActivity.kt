package com.bytebox.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.bytebox.app.navigation.ByteBoxNavHost
import com.bytebox.core.ui.theme.ByteBoxTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ByteBoxTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ByteBoxNavHost()
                }
            }
        }
    }
}
