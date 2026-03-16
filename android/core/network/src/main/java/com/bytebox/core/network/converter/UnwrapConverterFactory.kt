package com.bytebox.core.network.converter

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonReader
import com.squareup.moshi.Moshi
import okhttp3.ResponseBody
import retrofit2.Converter
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.lang.reflect.Type

class UnwrapConverterFactory(private val moshi: Moshi) : Converter.Factory() {

    private val moshiFactory = MoshiConverterFactory.create(moshi)

    override fun responseBodyConverter(
        type: Type,
        annotations: Array<out Annotation>,
        retrofit: Retrofit
    ): Converter<ResponseBody, *>? {
        // For Unit responses (e.g., logout, delete), just check success
        if (type == Unit::class.java) {
            return Converter<ResponseBody, Unit> { body ->
                body.close()
                Unit
            }
        }

        val delegate: JsonAdapter<Any> = moshi.adapter(type)
        return UnwrapConverter(delegate, moshi)
    }

    override fun requestBodyConverter(
        type: Type,
        parameterAnnotations: Array<out Annotation>,
        methodAnnotations: Array<out Annotation>,
        retrofit: Retrofit
    ): Converter<*, okhttp3.RequestBody>? {
        return moshiFactory.requestBodyConverter(type, parameterAnnotations, methodAnnotations, retrofit)
    }
}

private class UnwrapConverter<T>(
    private val delegate: JsonAdapter<T>,
    private val moshi: Moshi
) : Converter<ResponseBody, T> {

    override fun convert(body: ResponseBody): T? {
        val source = body.source()
        val reader = JsonReader.of(source)
        reader.isLenient = true

        var data: T? = null
        reader.beginObject()
        while (reader.hasNext()) {
            when (reader.nextName()) {
                "data" -> data = delegate.fromJson(reader)
                else -> reader.skipValue()
            }
        }
        reader.endObject()
        body.close()
        return data
    }
}
