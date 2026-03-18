import SwiftUI

struct FileRow: View {
    let file: FileItem
    let onTap: () -> Void

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Thumbnail or Icon
                if file.isImage, let thumbURL = file.thumbnailUrl,
                   let url = URL(string: thumbURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        FileIcon(mimeType: file.mimeType)
                            .frame(width: 40, height: 40)
                            .background(Color(.systemGray6))
                    }
                    .frame(width: 40, height: 40)
                    .cornerRadius(6)
                    .clipped()
                } else {
                    FileIcon(mimeType: file.mimeType)
                        .frame(width: 40, height: 40)
                }

                // File Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.name)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        Text(file.formattedSize)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if !file.formattedDate.isEmpty {
                            Text("  \(file.formattedDate)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Spacer()

                // Star indicator
                if file.isStarred == true {
                    Image(systemName: "star.fill")
                        .font(.caption)
                        .foregroundStyle(.yellow)
                }

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }

        Divider()
            .padding(.leading, 64)
    }
}

#Preview {
    VStack(spacing: 0) {
        FileRow(file: FileItem(
            id: "1",
            name: "vacation_photo.jpg",
            mimeType: "image/jpeg",
            size: 2_048_000,
            folderId: nil,
            userId: nil,
            isStarred: true,
            isTrashed: false,
            thumbnailUrl: nil,
            createdAt: "2024-01-15T10:30:00Z",
            updatedAt: nil,
            trashedAt: nil
        )) {}

        FileRow(file: FileItem(
            id: "2",
            name: "document.pdf",
            mimeType: "application/pdf",
            size: 512_000,
            folderId: nil,
            userId: nil,
            isStarred: false,
            isTrashed: false,
            thumbnailUrl: nil,
            createdAt: "2024-01-10T08:00:00Z",
            updatedAt: nil,
            trashedAt: nil
        )) {}
    }
}
