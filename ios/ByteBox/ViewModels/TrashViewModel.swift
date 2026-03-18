import Foundation

@MainActor
final class TrashViewModel: ObservableObject {
    @Published var files: [FileItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var showDeleteConfirmation = false
    @Published var fileToDelete: FileItem?

    private let fileService = FileService.shared

    func loadTrash() async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await fileService.getTrash()
            files = response.files
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    func restoreFile(_ file: FileItem) async {
        do {
            try await fileService.restoreFile(fileId: file.id)
            files.removeAll { $0.id == file.id }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func permanentDelete(_ file: FileItem) async {
        do {
            try await fileService.permanentDelete(fileId: file.id)
            files.removeAll { $0.id == file.id }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func confirmDelete(_ file: FileItem) {
        fileToDelete = file
        showDeleteConfirmation = true
    }
}
