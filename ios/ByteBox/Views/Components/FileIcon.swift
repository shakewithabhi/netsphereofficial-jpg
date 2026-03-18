import SwiftUI

struct FileIcon: View {
    let mimeType: String?

    private var iconName: String {
        guard let mimeType = mimeType else { return "doc.fill" }

        if mimeType.hasPrefix("image/") {
            return "photo.fill"
        } else if mimeType.hasPrefix("video/") {
            return "video.fill"
        } else if mimeType.hasPrefix("audio/") {
            return "music.note"
        } else if mimeType == "application/pdf" {
            return "doc.richtext.fill"
        } else if mimeType.contains("word") || mimeType.contains("document") {
            return "doc.fill"
        } else if mimeType.contains("spreadsheet") || mimeType.contains("excel") {
            return "tablecells.fill"
        } else if mimeType.contains("presentation") || mimeType.contains("powerpoint") {
            return "rectangle.fill.on.rectangle.fill"
        } else if mimeType.contains("zip") || mimeType.contains("archive") || mimeType.contains("compressed") {
            return "doc.zipper"
        } else if mimeType.hasPrefix("text/") {
            return "doc.text.fill"
        } else if mimeType.contains("json") || mimeType.contains("xml") || mimeType.contains("javascript") {
            return "chevron.left.forwardslash.chevron.right"
        } else {
            return "doc.fill"
        }
    }

    private var iconColor: Color {
        guard let mimeType = mimeType else { return .gray }

        if mimeType.hasPrefix("image/") {
            return .green
        } else if mimeType.hasPrefix("video/") {
            return .purple
        } else if mimeType.hasPrefix("audio/") {
            return .pink
        } else if mimeType == "application/pdf" {
            return .red
        } else if mimeType.contains("word") || mimeType.contains("document") {
            return Color(red: 0.231, green: 0.510, blue: 0.965)
        } else if mimeType.contains("spreadsheet") || mimeType.contains("excel") {
            return .green
        } else if mimeType.contains("presentation") || mimeType.contains("powerpoint") {
            return .orange
        } else if mimeType.contains("zip") || mimeType.contains("archive") {
            return .brown
        } else if mimeType.hasPrefix("text/") || mimeType.contains("json") {
            return .secondary
        } else {
            return .gray
        }
    }

    var body: some View {
        Image(systemName: iconName)
            .font(.title3)
            .foregroundStyle(iconColor)
    }
}

#Preview {
    VStack(spacing: 16) {
        FileIcon(mimeType: "image/jpeg")
        FileIcon(mimeType: "video/mp4")
        FileIcon(mimeType: "audio/mpeg")
        FileIcon(mimeType: "application/pdf")
        FileIcon(mimeType: "application/zip")
        FileIcon(mimeType: "text/plain")
        FileIcon(mimeType: nil)
    }
}
