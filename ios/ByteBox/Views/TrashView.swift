import SwiftUI

struct TrashView: View {
    @StateObject private var viewModel = TrashViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.files.isEmpty {
                    ProgressView("Loading trash...")
                } else if viewModel.files.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "trash.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.secondary.opacity(0.5))
                        Text("Trash is empty")
                            .font(.title3)
                            .fontWeight(.medium)
                        Text("Files you delete will appear here")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(viewModel.files) { file in
                            HStack(spacing: 12) {
                                // Thumbnail for images
                                if file.isImage, let thumbURL = file.thumbnailUrl,
                                   let url = URL(string: thumbURL) {
                                    AsyncImage(url: url) { image in
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    } placeholder: {
                                        FileIcon(mimeType: file.mimeType)
                                    }
                                    .frame(width: 40, height: 40)
                                    .cornerRadius(6)
                                    .clipped()
                                } else {
                                    FileIcon(mimeType: file.mimeType)
                                        .frame(width: 40, height: 40)
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(file.name)
                                        .font(.body)
                                        .lineLimit(1)

                                    Text(file.formattedSize)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .swipeActions(edge: .leading) {
                                Button {
                                    Task { await viewModel.restoreFile(file) }
                                } label: {
                                    Label("Restore", systemImage: "arrow.uturn.backward")
                                }
                                .tint(.blue)
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    viewModel.confirmDelete(file)
                                } label: {
                                    Label("Delete", systemImage: "trash.slash")
                                }
                            }
                            .contextMenu {
                                Button {
                                    Task { await viewModel.restoreFile(file) }
                                } label: {
                                    Label("Restore", systemImage: "arrow.uturn.backward")
                                }

                                Button(role: .destructive) {
                                    viewModel.confirmDelete(file)
                                } label: {
                                    Label("Delete Permanently", systemImage: "trash.slash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Trash")
            .refreshable {
                await viewModel.loadTrash()
            }
            .task {
                await viewModel.loadTrash()
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
            .confirmationDialog(
                "Delete Permanently?",
                isPresented: $viewModel.showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete Permanently", role: .destructive) {
                    if let file = viewModel.fileToDelete {
                        Task { await viewModel.permanentDelete(file) }
                    }
                }
                Button("Cancel", role: .cancel) {
                    viewModel.fileToDelete = nil
                }
            } message: {
                Text("This action cannot be undone. The file will be permanently deleted.")
            }
        }
    }
}

#Preview {
    TrashView()
}
