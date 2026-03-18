import SwiftUI
import PhotosUI

struct FilesView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = FilesViewModel()

    @State private var showUploadSheet = false
    @State private var showPhotoPicker = false
    @State private var showDocumentPicker = false
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var selectedFile: FileItem?
    @State private var showComments = false
    @State private var commentFile: FileItem?
    @State private var shareURL: URL?
    @State private var showShareSheet = false

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)
    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 12)
    ]

    @EnvironmentObject var adManager: AdManager

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                VStack(spacing: 0) {
                    // Banner ad between toolbar and file content for free users
                    if adManager.showAds {
                        BannerAdView(adUnitID: AdManager.bannerFiles)
                            .frame(height: 50)
                    }

                    // Breadcrumbs
                    if !viewModel.folderStack.isEmpty {
                        breadcrumbBar
                    }

                    // Content
                    if viewModel.isLoading && viewModel.files.isEmpty && viewModel.folders.isEmpty {
                        Spacer()
                        ProgressView("Loading...")
                        Spacer()
                    } else if viewModel.displayFiles.isEmpty && viewModel.folders.isEmpty && !viewModel.isSearching {
                        emptyState
                    } else {
                        fileContent
                    }
                }

                // FAB Upload Button
                uploadFAB
            }
            .navigationTitle(viewModel.currentFolderName)
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $viewModel.searchText, prompt: "Search files...")
            .onSubmit(of: .search) {
                Task { await viewModel.search() }
            }
            .onChange(of: viewModel.searchText) { newValue in
                if newValue.isEmpty {
                    viewModel.clearSearch()
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            viewModel.isGridView.toggle()
                        } label: {
                            Image(systemName: viewModel.isGridView ? "list.bullet" : "square.grid.2x2")
                        }

                        Button {
                            viewModel.showCreateFolder = true
                        } label: {
                            Image(systemName: "folder.badge.plus")
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarLeading) {
                    if !viewModel.folderStack.isEmpty {
                        Button {
                            viewModel.navigateBack()
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                Text("Back")
                            }
                        }
                    }
                }
            }
            .refreshable {
                await viewModel.loadContents()
            }
            .task {
                await viewModel.loadContents()
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
            .alert("New Folder", isPresented: $viewModel.showCreateFolder) {
                TextField("Folder name", text: $viewModel.newFolderName)
                Button("Create") {
                    Task { await viewModel.createFolder() }
                }
                Button("Cancel", role: .cancel) {
                    viewModel.newFolderName = ""
                }
            } message: {
                Text("Enter a name for the new folder")
            }
            .confirmationDialog("Upload", isPresented: $showUploadSheet) {
                Button("Photo Library") {
                    showPhotoPicker = true
                }
                Button("Browse Files") {
                    showDocumentPicker = true
                }
                Button("Cancel", role: .cancel) {}
            }
            .photosPicker(
                isPresented: $showPhotoPicker,
                selection: $selectedPhotoItems,
                maxSelectionCount: 10,
                matching: .any(of: [.images, .videos])
            )
            .onChange(of: selectedPhotoItems) { items in
                Task {
                    for item in items {
                        await handlePhotoPickerItem(item)
                    }
                    selectedPhotoItems = []
                }
            }
            .sheet(item: $selectedFile) { file in
                PreviewView(file: file)
            }
            .sheet(item: $commentFile) { file in
                CommentsSheet(file: file)
            }
            .sheet(isPresented: $showDocumentPicker) {
                DocumentPickerView { urls in
                    Task {
                        for url in urls {
                            await handleDocumentPickerURL(url)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Breadcrumbs

    private var breadcrumbBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                Button("My Files") {
                    viewModel.navigateToRoot()
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                ForEach(viewModel.folderStack) { crumb in
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Button(crumb.name) {
                        viewModel.navigateToBreadcrumb(crumb)
                    }
                    .font(.caption)
                    .foregroundStyle(crumb == viewModel.folderStack.last ? brandBlue : .secondary)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - File Content

    private var fileContent: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                // Folders
                if !viewModel.folders.isEmpty && !viewModel.isSearching {
                    sectionHeader("Folders")

                    ForEach(viewModel.folders) { folder in
                        folderRow(folder)
                    }
                }

                // Files
                if !viewModel.displayFiles.isEmpty {
                    sectionHeader(viewModel.isSearching ? "Search Results" : "Files")

                    if viewModel.isGridView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(viewModel.displayFiles) { file in
                                FileGridItem(file: file) {
                                    selectedFile = file
                                }
                                .contextMenu { fileContextMenu(file) }
                            }
                        }
                        .padding(.horizontal)
                    } else {
                        ForEach(viewModel.displayFiles) { file in
                            FileRow(file: file) {
                                selectedFile = file
                            }
                            .contextMenu { fileContextMenu(file) }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "folder.fill")
                .font(.system(size: 64))
                .foregroundStyle(.secondary.opacity(0.5))
            Text("No files yet")
                .font(.title3)
                .fontWeight(.medium)
            Text("Tap the + button to upload files")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    // MARK: - Upload FAB

    private var uploadFAB: some View {
        Button {
            showUploadSheet = true
        } label: {
            Image(systemName: "plus")
                .font(.title2.bold())
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(brandBlue)
                .clipShape(Circle())
                .shadow(color: brandBlue.opacity(0.4), radius: 8, x: 0, y: 4)
        }
        .padding(.trailing, 20)
        .padding(.bottom, 20)
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .padding(.horizontal)
            .padding(.top, 16)
            .padding(.bottom, 8)
    }

    // MARK: - Folder Row

    private func folderRow(_ folder: FolderItem) -> some View {
        Button {
            viewModel.navigateToFolder(folder)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "folder.fill")
                    .font(.title3)
                    .foregroundStyle(brandBlue)
                    .frame(width: 36)

                Text(folder.name)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }

        Divider().padding(.leading, 60)
    }

    // MARK: - Context Menu

    @ViewBuilder
    private func fileContextMenu(_ file: FileItem) -> some View {
        Button {
            Task { await viewModel.toggleStar(for: file) }
        } label: {
            Label(
                file.isStarred == true ? "Remove from Favorites" : "Add to Favorites",
                systemImage: file.isStarred == true ? "star.slash" : "star"
            )
        }

        Button {
            Task { await viewModel.copyFile(file) }
        } label: {
            Label("Make a Copy", systemImage: "doc.on.doc")
        }

        Button {
            commentFile = file
        } label: {
            Label("Comments", systemImage: "bubble.left")
        }

        Divider()

        Button(role: .destructive) {
            Task { await viewModel.trashFile(file) }
        } label: {
            Label("Move to Trash", systemImage: "trash")
        }
    }

    // MARK: - Upload Handlers

    private func handlePhotoPickerItem(_ item: PhotosPickerItem) async {
        if let data = try? await item.loadTransferable(type: Data.self) {
            let mimeType: String
            let ext: String

            if let contentType = item.supportedContentTypes.first {
                if contentType.conforms(to: .movie) {
                    mimeType = "video/mp4"
                    ext = "mp4"
                } else {
                    mimeType = "image/jpeg"
                    ext = "jpg"
                }
            } else {
                mimeType = "application/octet-stream"
                ext = "bin"
            }

            let fileName = "upload_\(Int(Date().timeIntervalSince1970)).\(ext)"
            await viewModel.uploadFile(data: data, fileName: fileName, mimeType: mimeType)
        }
    }

    private func handleDocumentPickerURL(_ url: URL) async {
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }

        guard let data = try? Data(contentsOf: url) else { return }

        let mimeType = mimeTypeForURL(url)
        await viewModel.uploadFile(data: data, fileName: url.lastPathComponent, mimeType: mimeType)
    }

    private func mimeTypeForURL(_ url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        let mimeTypes: [String: String] = [
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
            "mp4": "video/mp4", "mov": "video/quicktime", "avi": "video/x-msvideo",
            "pdf": "application/pdf", "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt": "text/plain", "mp3": "audio/mpeg", "wav": "audio/wav",
            "zip": "application/zip", "json": "application/json"
        ]
        return mimeTypes[ext] ?? "application/octet-stream"
    }
}

// MARK: - Document Picker

struct DocumentPickerView: UIViewControllerRepresentable {
    let onPick: ([URL]) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item])
        picker.allowsMultipleSelection = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: ([URL]) -> Void

        init(onPick: @escaping ([URL]) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            onPick(urls)
        }
    }
}

#Preview {
    FilesView()
        .environmentObject(AuthManager())
        .environmentObject(AdManager.shared)
}
