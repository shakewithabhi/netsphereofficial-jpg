package com.bytebox.feature.explore.data.di

import com.bytebox.domain.repository.ExploreRepository
import com.bytebox.feature.explore.data.ExploreRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class ExploreModule {

    @Binds
    @Singleton
    abstract fun bindExploreRepository(impl: ExploreRepositoryImpl): ExploreRepository
}
