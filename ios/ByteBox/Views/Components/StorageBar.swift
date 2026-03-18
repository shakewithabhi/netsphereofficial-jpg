import SwiftUI

struct StorageBar: View {
    let used: Int64
    let limit: Int64

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    private var percentage: Double {
        guard limit > 0 else { return 0 }
        return min(Double(used) / Double(limit), 1.0)
    }

    private var barColor: Color {
        if percentage > 0.9 {
            return .red
        } else if percentage > 0.75 {
            return .orange
        } else {
            return brandBlue
        }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(.systemGray5))
                    .frame(height: 10)

                RoundedRectangle(cornerRadius: 6)
                    .fill(barColor.gradient)
                    .frame(width: geometry.size.width * percentage, height: 10)
                    .animation(.easeInOut(duration: 0.5), value: percentage)
            }
        }
        .frame(height: 10)
    }
}

#Preview {
    VStack(spacing: 20) {
        StorageBar(used: 500_000_000, limit: 5_000_000_000)
        StorageBar(used: 4_000_000_000, limit: 5_000_000_000)
        StorageBar(used: 4_800_000_000, limit: 5_000_000_000)
    }
    .padding()
}
