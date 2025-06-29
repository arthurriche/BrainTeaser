import SwiftUI

// MARK: Backgrounds

// A reusable background gradient used across views
let backgroundGradient: some View = LinearGradient(
    gradient: Gradient(colors: [Color.palette1, Color.palette1]),
    startPoint: .bottom,
    endPoint: .top
).ignoresSafeArea()

// MARK: - Shared Button Styles

/// Custom button style for authentication buttons with inner shadows and rounded rectangle design
struct AuthButtonStyle: ButtonStyle {
    let backgroundColor: Color
    let foregroundColor: Color
    
    init(backgroundColor: Color = Color.accent, foregroundColor: Color = Color.primaryText) {
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
    }
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.sfCompactRounded(fontStyle: .body, fontWeight: .medium))
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(backgroundColor)
                    .overlay(
                        // Inner shadows using overlays
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.black.opacity(0.4), lineWidth: 2)
                            .blur(radius: 2.5)
                            .offset(y: -1)
                            .mask(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [Color.clear, Color.black], startPoint: .top, endPoint: .bottom)))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.6), lineWidth: 2)
                            .blur(radius: 2.5)
                            .offset(y: 1)
                            .mask(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [Color.black, Color.clear], startPoint: .top, endPoint: .bottom)))
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Shared Components

/// Reusable authentication button with icon and text
struct AuthButton: View {
    let title: String
    let iconName: String?
    let isSFSymbol: Bool
    let action: () -> Void
    let backgroundColor: Color
    let foregroundColor: Color
    
    init(
        title: String,
        iconName: String? = nil,
        backgroundColor: Color = Color.accent,
        foregroundColor: Color = .black,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.iconName = iconName
        // Determine if icon is SF Symbol based on common SF Symbol naming patterns
        self.isSFSymbol = iconName?.contains(".") == true || iconName?.contains("envelope") == true
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let iconName = iconName {
                    // Check if it's an SF Symbol or custom image
                    if isSFSymbol {
                        Image(systemName: iconName)
                            .font(.sfCompactRounded(fontWeight: .medium, fontSize: 20)) // Custom size for icon
                            .frame(width: 40, height: 40)
                            .foregroundColor(foregroundColor)
                    } else {
                        Image(iconName)
                            .resizable()
                            .frame(width: 32, height: 32)
                    }
                }
                
                Text(title)
                    .font(.sfCompactRounded(fontStyle: .title3, fontWeight: .medium))
                    .foregroundColor(foregroundColor)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .buttonStyle(AuthButtonStyle(backgroundColor: backgroundColor, foregroundColor: foregroundColor))
    }
}
