import SwiftUI

struct FavoritesView: View {
    @StateObject private var viewModel = FavoritesViewModel()
    @State private var selectedFile: FileItem?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.files.isEmpty {
                    ProgressView("Loading favorites...")
                } else if viewModel.files.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "star.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.secondary.opacity(0.5))
                        Text("No favorites yet")
                            .font(.title3)
                            .fontWeight(.medium)
                        Text("Star files to find them quickly here")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(viewModel.files) { file in
                            FileRow(file: file) {
                                selectedFile = file
                            }
                            .swipeActions(edge: .trailing) {
                                Button {
                                    Task { await viewModel.unstarFile(file) }
                                } label: {
                                    Label("Unstar", systemImage: "star.slash")
                                }
                                .tint(.orange)
                            }
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Favorites")
            .refreshable {
                await viewModel.loadStarredFiles()
            }
            .task {
                await viewModel.loadStarredFiles()
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
            .sheet(item: $selectedFile) { file in
                PreviewView(file: file)
            }
        }
    }
}

#Preview {
    FavoritesView()
}
