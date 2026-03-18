import Foundation

@MainActor
final class PreviewViewModel: ObservableObject {
    @Published var downloadURL: URL?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var localFileURL: URL?

    private let fileService = FileService.shared

    func loadPreview(for file: FileItem) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await fileService.getDownloadURL(fileId: file.id)
            downloadURL = URL(string: response.url)

            if file.isImage || file.isPDF {
                await downloadFile(from: response.url, fileName: file.name)
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    private func downloadFile(from urlString: String, fileName: String) async {
        guard let url = URL(string: urlString) else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let tempDir = FileManager.default.temporaryDirectory
            let fileURL = tempDir.appendingPathComponent(fileName)
            try data.write(to: fileURL)
            localFileURL = fileURL
        } catch {
            errorMessage = "Failed to download file: \(error.localizedDescription)"
            showError = true
        }
    }
}
