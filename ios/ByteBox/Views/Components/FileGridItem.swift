import SwiftUI

struct FileGridItem: View {
    let file: FileItem
    let onTap: () -> Void

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                // Thumbnail or Icon
                ZStack(alignment: .topTrailing) {
                    Group {
                        if file.isImage, let thumbURL = file.thumbnailUrl,
                           let url = URL(string: thumbURL) {
                            AsyncImage(url: url) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            } placeholder: {
                                iconPlaceholder
                            }
                        } else {
                            iconPlaceholder
                        }
                    }
                    .frame(height: 120)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .cornerRadius(10)

                    // Star badge
                    if file.isStarred == true {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                            .padding(6)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                            .padding(6)
                    }
                }

                // File name
                Text(file.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)

                // File size
                Text(file.formattedSize)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        }
    }

    private var iconPlaceholder: some View {
        ZStack {
            Color(.systemGray6)

            FileIcon(mimeType: file.mimeType)
                .font(.system(size: 36))
        }
    }
}

#Preview {
    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 12) {
        FileGridItem(file: FileItem(
            id: "1",
            name: "vacation_photo.jpg",
            mimeType: "image/jpeg",
            size: 2_048_000,
            folderId: nil,
            userId: nil,
            isStarred: true,
            isTrashed: false,
            thumbnailUrl: nil,
            createdAt: nil,
            updatedAt: nil,
            trashedAt: nil
        )) {}

        FileGridItem(file: FileItem(
            id: "2",
            name: "report_final_version.pdf",
            mimeType: "application/pdf",
            size: 512_000,
            folderId: nil,
            userId: nil,
            isStarred: false,
            isTrashed: false,
            thumbnailUrl: nil,
            createdAt: nil,
            updatedAt: nil,
            trashedAt: nil
        )) {}
    }
    .padding()
}
