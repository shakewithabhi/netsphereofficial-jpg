import SwiftUI
import AVKit
import PDFKit

struct PreviewView: View {
    let file: FileItem

    @StateObject private var viewModel = PreviewViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading preview...")
                } else if let error = viewModel.errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Button("Retry") {
                            Task { await viewModel.loadPreview(for: file) }
                        }
                    }
                } else {
                    previewContent
                }
            }
            .navigationTitle(file.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    if let url = viewModel.downloadURL {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .task {
                await viewModel.loadPreview(for: file)
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
        }
    }

    @ViewBuilder
    private var previewContent: some View {
        if file.isImage {
            imagePreview
        } else if file.isVideo {
            videoPreview
        } else if file.isPDF {
            pdfPreview
        } else {
            genericPreview
        }
    }

    // MARK: - Image Preview

    private var imagePreview: some View {
        ZoomableImageView(url: viewModel.downloadURL)
    }

    // MARK: - Video Preview

    private var videoPreview: some View {
        Group {
            if let url = viewModel.downloadURL {
                VideoPlayer(player: AVPlayer(url: url))
                    .ignoresSafeArea()
            } else {
                ProgressView()
            }
        }
    }

    // MARK: - PDF Preview

    private var pdfPreview: some View {
        Group {
            if let localURL = viewModel.localFileURL {
                PDFKitView(url: localURL)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                ProgressView("Loading PDF...")
            }
        }
    }

    // MARK: - Generic Preview

    private var genericPreview: some View {
        VStack(spacing: 20) {
            Spacer()

            FileIcon(mimeType: file.mimeType)
                .font(.system(size: 72))

            Text(file.name)
                .font(.headline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Text(file.formattedSize)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if let url = viewModel.downloadURL {
                Link(destination: url) {
                    Label("Open in Browser", systemImage: "safari")
                        .font(.body.bold())
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.231, green: 0.510, blue: 0.965))
                        .foregroundStyle(.white)
                        .cornerRadius(10)
                }
            }

            Spacer()
        }
    }
}

// MARK: - Zoomable Image View

struct ZoomableImageView: View {
    let url: URL?

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        GeometryReader { geometry in
            if let url = url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .scaleEffect(scale)
                            .offset(offset)
                            .gesture(
                                MagnifyGesture()
                                    .onChanged { value in
                                        scale = lastScale * value.magnification
                                    }
                                    .onEnded { _ in
                                        lastScale = scale
                                        if scale < 1 {
                                            withAnimation {
                                                scale = 1
                                                lastScale = 1
                                                offset = .zero
                                                lastOffset = .zero
                                            }
                                        }
                                    }
                                    .simultaneously(
                                        with: DragGesture()
                                            .onChanged { value in
                                                offset = CGSize(
                                                    width: lastOffset.width + value.translation.width,
                                                    height: lastOffset.height + value.translation.height
                                                )
                                            }
                                            .onEnded { _ in
                                                lastOffset = offset
                                            }
                                    )
                            )
                            .onTapGesture(count: 2) {
                                withAnimation {
                                    if scale > 1 {
                                        scale = 1
                                        lastScale = 1
                                        offset = .zero
                                        lastOffset = .zero
                                    } else {
                                        scale = 3
                                        lastScale = 3
                                    }
                                }
                            }

                    case .failure:
                        VStack(spacing: 12) {
                            Image(systemName: "photo")
                                .font(.system(size: 48))
                                .foregroundStyle(.secondary)
                            Text("Failed to load image")
                                .foregroundStyle(.secondary)
                        }

                    case .empty:
                        ProgressView()

                    @unknown default:
                        ProgressView()
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
            }
        }
    }
}

// MARK: - PDFKit View

struct PDFKitView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = PDFDocument(url: url)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

#Preview {
    PreviewView(file: FileItem(
        id: "1",
        name: "test.jpg",
        mimeType: "image/jpeg",
        size: 1024,
        folderId: nil,
        userId: nil,
        isStarred: false,
        isTrashed: false,
        thumbnailUrl: nil,
        createdAt: nil,
        updatedAt: nil,
        trashedAt: nil
    ))
}
