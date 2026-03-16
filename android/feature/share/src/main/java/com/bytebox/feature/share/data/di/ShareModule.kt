package com.bytebox.feature.share.data.di

import com.bytebox.domain.repository.ShareRepository
import com.bytebox.feature.share.data.ShareRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class ShareModule {

    @Binds
    @Singleton
    abstract fun bindShareRepository(impl: ShareRepositoryImpl): ShareRepository
}
