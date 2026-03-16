package com.bytebox.core.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bytebox.core.ui.R
import com.bytebox.core.ui.theme.ByteBoxTheme

@Composable
fun ByteBoxBrandHeader(
    modifier: Modifier = Modifier,
    showTagline: Boolean = true,
    logoSize: Dp = 96.dp,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(
            painter = painterResource(id = R.drawable.ic_bytebox_logo),
            contentDescription = "ByteBox",
            modifier = Modifier.size(logoSize),
        )
        Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.md))
        Text(
            text = "ByteBox",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (showTagline) {
            Spacer(modifier = Modifier.height(ByteBoxTheme.spacing.xxs))
            Text(
                text = "Cloud Storage",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
