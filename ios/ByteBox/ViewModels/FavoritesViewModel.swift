import Foundation

@MainActor
final class FavoritesViewModel: ObservableObject {
    @Published var files: [FileItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false

    private let fileService = FileService.shared

    func loadStarredFiles() async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await fileService.getStarredFiles()
            files = response.files
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    func unstarFile(_ file: FileItem) async {
        do {
            try await fileService.unstarFile(fileId: file.id)
            files.removeAll { $0.id == file.id }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}
