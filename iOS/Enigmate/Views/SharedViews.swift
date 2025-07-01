import SwiftUI

// MARK: Backgrounds

// A reusable background gradient used across views
let backgroundGradient: some View = LinearGradient(
    gradient: Gradient(colors: [Color.palette1, Color.palette1]),
    startPoint: .bottom,
    endPoint: .top
).ignoresSafeArea()

// MARK: - Shared Button Styles

/// Enum to define different button size variants
enum ButtonSize {
    case medium  // Current style - .body font, 56 height, 16 corner radius
    case small   // Capsule style - .body font, smaller height, capsule shape
    case large   // Compact large - .title2 font, bigger height, smaller width for rectangle look
}

/// Custom button style for authentication buttons with inner shadows and rounded rectangle design
struct MainButtonStyle: ButtonStyle {
    let backgroundColor: Color
    let foregroundColor: Color
    let size: ButtonSize
    
    init(backgroundColor: Color = Color.accent, foregroundColor: Color = Color.primaryText, size: ButtonSize = .medium) {
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
        self.size = size
    }
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(fontForSize())
            .frame(maxWidth: maxWidthForSize(), minHeight: heightForSize())
            .background(
                RoundedRectangle(cornerRadius: cornerRadiusForSize())
                    .fill(backgroundColor)
                    .overlay(
                        // Inner shadows using overlays
                        RoundedRectangle(cornerRadius: cornerRadiusForSize())
                            .stroke(Color.black.opacity(0.4), lineWidth: 2)
                            .blur(radius: 2.5)
                            .offset(y: -1)
                            .mask(RoundedRectangle(cornerRadius: cornerRadiusForSize()).fill(LinearGradient(colors: [Color.clear, Color.black], startPoint: .top, endPoint: .bottom)))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadiusForSize())
                            .stroke(Color.white.opacity(0.6), lineWidth: 2)
                            .blur(radius: 2.5)
                            .offset(y: 1)
                            .mask(RoundedRectangle(cornerRadius: cornerRadiusForSize()).fill(LinearGradient(colors: [Color.black, Color.clear], startPoint: .top, endPoint: .bottom)))
                    )
                    .shadow(color: Color.black.opacity(0.1), radius: 1, x: 0, y: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
    
    // MARK: - Size Configuration Methods
    
    /// Returns the appropriate font for the button size
    private func fontForSize() -> Font {
        switch size {
        case .medium:
            return .sfCompactRounded(fontStyle: .body, fontWeight: .semibold)
        case .small:
            return .sfCompactRounded(fontStyle: .caption, fontWeight: .medium)
        case .large:
            return .sfCompactRounded(fontStyle: .title, fontWeight: .heavy)
        }
    }
    
    /// Returns the appropriate height for the button size
    private func heightForSize() -> CGFloat {
        switch size {
        case .medium:
            return 60
        case .small:
            return 48
        case .large:
            return 72
        }
    }
    
    /// Returns the appropriate corner radius for the button size
    private func cornerRadiusForSize() -> CGFloat {
        switch size {
        case .medium:
            return 16
        case .small:
            return 22  // Capsule style - half of height
        case .large:
            return 16
        }
    }
    
    /// Returns the appropriate max width for the button size
    private func maxWidthForSize() -> CGFloat? {
        switch size {
        case .medium:
            return .infinity  // Full width
        case .small:
            return .infinity  // Full width but capsule shape
        case .large:
            return 200  // Smaller width for compact rectangle look
        }
    }
}

// MARK: - Shared Components

/// Reusable authentication button with icon and text
struct MainButton: View {
    let title: String
    let iconName: String?
    let isSFSymbol: Bool?
    let action: () -> Void
    let backgroundColor: Color
    let foregroundColor: Color
    let size: ButtonSize
    
    init(
        title: String,
        iconName: String? = nil,
        backgroundColor: Color = Color.accent,
        foregroundColor: Color = .black,
        size: ButtonSize = .medium,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.iconName = iconName
        // Determine if icon is SF Symbol based on common SF Symbol naming patterns
        self.isSFSymbol = iconName?.contains(".") == true || iconName?.contains("envelope") == true
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
        self.size = size
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let iconName = iconName {
                    // Check if it's an SF Symbol or custom image
                    if isSFSymbol ?? true {
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
                    //.font(.sfCompactRounded(fontStyle: .title3, fontWeight: .medium))
                    .foregroundColor(foregroundColor)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .buttonStyle(MainButtonStyle(backgroundColor: backgroundColor, foregroundColor: foregroundColor, size: size))
    }
}

// MARK: - Usage Examples

/*
 
 ## MainButton Usage with Different Sizes:
 
 ### Medium Button (Default)
 ```swift
 MainButton(title: "Sign In") { 
     // action 
 }
 
 // Or explicitly:
 MainButton(title: "Sign In", size: .medium) { 
     // action 
 }
 ```
 
 ### Small Button (Capsule Style)
 ```swift
 MainButton(title: "Cancel", size: .small) { 
     // action 
 }
 ```
 
 ### Large Button (Compact Rectangle)
 ```swift
 MainButton(title: "Continue", size: .large) { 
     // action 
 }
 ```
 
 ### With Custom Colors and Icons
 ```swift
 MainButton(
     title: "Email Sign In",
     iconName: "envelope",
     backgroundColor: .blue,
     foregroundColor: .white,
     size: .large
 ) { 
     // action 
 }
 ```
 
 ### Direct ButtonStyle Usage
 ```swift
 Button("Custom Button") { 
     // action 
 }
 .buttonStyle(MainButtonStyle(size: .small))
 ```
 
 */
