import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(String)
    case unauthorized
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        case .unauthorized:
            return "Session expired. Please log in again."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let message: String?
}

struct EmptyResponse: Decodable {}

final class APIClient {
    static let shared = APIClient()

    private var baseURL: String {
        get { UserDefaults.standard.string(forKey: "server_url") ?? "https://api.byteboxapp.com" }
        set { UserDefaults.standard.set(newValue, forKey: "server_url") }
    }

    var authToken: String? {
        get { UserDefaults.standard.string(forKey: "access_token") }
        set { UserDefaults.standard.set(newValue, forKey: "access_token") }
    }

    var refreshToken: String? {
        get { UserDefaults.standard.string(forKey: "refresh_token") }
        set { UserDefaults.standard.set(newValue, forKey: "refresh_token") }
    }

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
    }

    func setBaseURL(_ url: String) {
        var sanitized = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if sanitized.hasSuffix("/") {
            sanitized = String(sanitized.dropLast())
        }
        UserDefaults.standard.set(sanitized, forKey: "server_url")
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: [String: Any]? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var urlComponents = URLComponents(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        if let queryItems = queryItems {
            urlComponents.queryItems = queryItems
        }

        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method

        if let token = authToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        do {
            let (data, response) = try await session.data(for: urlRequest)

            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 401 {
                    if let refreshed = try? await attemptTokenRefresh() {
                        authToken = refreshed.accessToken
                        if let rt = refreshed.refreshToken {
                            self.refreshToken = rt
                        }
                        return try await request(method, path: path, body: body, queryItems: queryItems)
                    }
                    throw APIError.unauthorized
                }

                if httpResponse.statusCode >= 400 {
                    if let apiResponse = try? decoder.decode(APIResponse<EmptyResponse>.self, from: data) {
                        throw APIError.serverError(apiResponse.message ?? "Server error (\(httpResponse.statusCode))")
                    }
                    throw APIError.serverError("Server error (\(httpResponse.statusCode))")
                }
            }

            let apiResponse = try decoder.decode(APIResponse<T>.self, from: data)
            guard apiResponse.success, let responseData = apiResponse.data else {
                throw APIError.serverError(apiResponse.message ?? "Unknown error")
            }
            return responseData
        } catch let error as APIError {
            throw error
        } catch let error as DecodingError {
            throw APIError.decodingError(error)
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Upload

    func upload(
        path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fields: [String: String] = [:]
    ) async throws -> FileItem {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        let boundary = UUID().uuidString
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        urlRequest.httpBody = body

        let (data, response) = try await session.data(for: urlRequest)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode >= 400 {
            if let apiResponse = try? decoder.decode(APIResponse<EmptyResponse>.self, from: data) {
                throw APIError.serverError(apiResponse.message ?? "Upload failed")
            }
            throw APIError.serverError("Upload failed (\(httpResponse.statusCode))")
        }

        let apiResponse = try decoder.decode(APIResponse<FileItem>.self, from: data)
        guard apiResponse.success, let file = apiResponse.data else {
            throw APIError.serverError(apiResponse.message ?? "Upload failed")
        }
        return file
    }

    // MARK: - Token Refresh

    private func attemptTokenRefresh() async throws -> AuthTokens {
        guard let rt = refreshToken else {
            throw APIError.unauthorized
        }

        guard let url = URL(string: "\(baseURL)/auth/refresh") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": rt])

        let (data, _) = try await session.data(for: urlRequest)
        let apiResponse = try decoder.decode(APIResponse<AuthTokens>.self, from: data)

        guard apiResponse.success, let tokens = apiResponse.data else {
            throw APIError.unauthorized
        }
        return tokens
    }

    // MARK: - Convenience DELETE with no response body

    func requestVoid(
        _ method: String,
        path: String,
        body: [String: Any]? = nil
    ) async throws {
        let _: EmptyResponse = try await request(method, path: path, body: body)
    }
}
