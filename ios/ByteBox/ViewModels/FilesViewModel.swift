import Foundation
import SwiftUI

struct FolderBreadcrumb: Identifiable, Hashable {
    let id: String
    let name: String
}

@MainActor
final class FilesViewModel: ObservableObject {
    @Published var files: [FileItem] = []
    @Published var folders: [FolderItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var searchText = ""
    @Published var isSearching = false
    @Published var searchResults: [FileItem] = []
    @Published var isGridView = false
    @Published var showCreateFolder = false
    @Published var newFolderName = ""

    var currentFolderId: String? = nil
    @Published var folderStack: [FolderBreadcrumb] = []

    private let fileService = FileService.shared

    var currentFolderName: String {
        folderStack.last?.name ?? "My Files"
    }

    var displayFiles: [FileItem] {
        isSearching ? searchResults : files
    }

    // MARK: - Load Contents

    func loadContents() async {
        isLoading = true
        errorMessage = nil

        do {
            let contents: FolderContents
            if let folderId = currentFolderId {
                contents = try await fileService.getFolderContents(folderId: folderId)
            } else {
                contents = try await fileService.getRootContents()
            }
            files = contents.files
            folders = contents.folders
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    // MARK: - Navigation

    func navigateToFolder(_ folder: FolderItem) {
        folderStack.append(FolderBreadcrumb(id: folder.id, name: folder.name))
        currentFolderId = folder.id
        Task {
            await loadContents()
        }
    }

    func navigateBack() {
        guard !folderStack.isEmpty else { return }
        folderStack.removeLast()
        currentFolderId = folderStack.last?.id
        Task {
            await loadContents()
        }
    }

    func navigateToRoot() {
        folderStack.removeAll()
        currentFolderId = nil
        Task {
            await loadContents()
        }
    }

    func navigateToBreadcrumb(_ breadcrumb: FolderBreadcrumb) {
        guard let index = folderStack.firstIndex(of: breadcrumb) else { return }
        folderStack = Array(folderStack.prefix(through: index))
        currentFolderId = breadcrumb.id
        Task {
            await loadContents()
        }
    }

    // MARK: - Create Folder

    func createFolder() async {
        guard !newFolderName.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        do {
            let _ = try await fileService.createFolder(
                name: newFolderName.trimmingCharacters(in: .whitespaces),
                parentId: currentFolderId
            )
            newFolderName = ""
            await loadContents()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    // MARK: - Star / Unstar

    func toggleStar(for file: FileItem) async {
        do {
            if file.isStarred == true {
                try await fileService.unstarFile(fileId: file.id)
            } else {
                try await fileService.starFile(fileId: file.id)
            }
            await loadContents()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    // MARK: - Trash

    func trashFile(_ file: FileItem) async {
        do {
            try await fileService.trashFile(fileId: file.id)
            await loadContents()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    // MARK: - Copy

    func copyFile(_ file: FileItem) async {
        do {
            let _ = try await fileService.copyFile(fileId: file.id, folderId: currentFolderId)
            await loadContents()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    // MARK: - Search

    func search() async {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else {
            isSearching = false
            searchResults = []
            return
        }

        isSearching = true
        do {
            let response = try await fileService.searchFiles(query: query)
            searchResults = response.files
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func clearSearch() {
        searchText = ""
        isSearching = false
        searchResults = []
    }

    // MARK: - Upload

    func uploadFile(data: Data, fileName: String, mimeType: String) async {
        do {
            let _ = try await fileService.uploadFile(
                data: data,
                fileName: fileName,
                mimeType: mimeType,
                folderId: currentFolderId
            )
            await loadContents()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}
