package com.bytebox.feature.auth.presentation.onboarding

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bytebox.core.ui.components.LottieAnimatedAsset

private val GradientStart = Color(0xFF6B63F6)
private val GradientEnd   = Color(0xFF9B6FE8)

@Composable
fun OnboardingScreen(
    onGetStarted: () -> Unit,
    onSignIn: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(GradientStart, GradientEnd),
                    start = androidx.compose.ui.geometry.Offset(0f, 0f),
                    end   = androidx.compose.ui.geometry.Offset(1000f, 2000f),
                )
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // ── Illustration with Lottie floating badges ─────────────────────
            Box(
                modifier = Modifier.size(280.dp),
                contentAlignment = Alignment.Center,
            ) {
                // Hero Lottie animation (rotating ring + floating folder)
                LottieAnimatedAsset(
                    assetFileName = "lottie_onboarding_hero.json",
                    modifier = Modifier.size(240.dp),
                )

                // Lottie badge — top left (Lock)
                LottieAnimatedAsset(
                    assetFileName = "lottie_badge_lock.json",
                    modifier = Modifier
                        .size(54.dp)
                        .align(Alignment.TopStart)
                        .offset(x = 4.dp, y = 18.dp)
                        .rotate(-10f),
                )
                // Lottie badge — top right (Cloud)
                LottieAnimatedAsset(
                    assetFileName = "lottie_badge_cloud.json",
                    modifier = Modifier
                        .size(54.dp)
                        .align(Alignment.TopEnd)
                        .offset(x = (-4).dp, y = 26.dp)
                        .rotate(8f),
                )
                // Lottie badge — bottom left (Share)
                LottieAnimatedAsset(
                    assetFileName = "lottie_badge_share.json",
                    modifier = Modifier
                        .size(54.dp)
                        .align(Alignment.BottomStart)
                        .offset(x = 10.dp, y = (-14).dp)
                        .rotate(6f),
                )
                // Lottie badge — bottom right (Speed)
                LottieAnimatedAsset(
                    assetFileName = "lottie_badge_speed.json",
                    modifier = Modifier
                        .size(54.dp)
                        .align(Alignment.BottomEnd)
                        .offset(x = (-10).dp, y = (-10).dp)
                        .rotate(-8f),
                )
            }

            Spacer(modifier = Modifier.height(36.dp))

            // ── Title ────────────────────────────────────────────────────────
            Text(
                text = "Manage Storage",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Easily manage and access your data\nfrom all media",
                fontSize = 15.sp,
                color = Color.White.copy(alpha = 0.75f),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )

            Spacer(modifier = Modifier.height(32.dp))

            // ── Pagination dots ──────────────────────────────────────────────
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PaginationDot(active = false)
                PaginationDot(active = true)
                PaginationDot(active = false)
                PaginationDot(active = false)
            }

            Spacer(modifier = Modifier.height(40.dp))

            // ── CTA button ───────────────────────────────────────────────────
            Button(
                onClick = onGetStarted,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(26.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = GradientStart,
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
            ) {
                Text(
                    text = "Get Started",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Sign in text link
            androidx.compose.material3.TextButton(onClick = onSignIn) {
                Text(
                    text = "Already have an account? Sign In",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 14.sp,
                )
            }
        }
    }
}

@Composable
private fun PaginationDot(active: Boolean) {
    val width by animateDpAsState(
        targetValue = if (active) 20.dp else 6.dp,
        label = "dot_width",
    )
    Box(
        modifier = Modifier
            .height(6.dp)
            .width(width)
            .clip(CircleShape)
            .background(
                if (active) Color.White.copy(alpha = 0.90f)
                else Color.White.copy(alpha = 0.30f)
            ),
    )
}
