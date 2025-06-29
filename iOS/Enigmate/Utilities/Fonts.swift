//
//  Fonts.swift
//  Enigmate
//
//  Created by Clément Maubon on 27/04/2025.
//

import SwiftUI

extension Font {

    // Simplified to always use SF Compact Rounded
    static func from(
        _ fontName: String, fontStyle: Font.TextStyle = .body, fontWeight: Weight = .regular,
        fontSize: CGFloat? = nil
    ) -> Font {
        // Always return SF Compact Rounded regardless of fontName parameter
        return sfCompactRounded(fontStyle: fontStyle, fontWeight: fontWeight, fontSize: fontSize)
    }
    
    // Main SF Compact Rounded function
    static func sfCompactRounded(
        fontStyle: Font.TextStyle = .body, fontWeight: Weight = .regular, fontSize: CGFloat? = nil
    ) -> Font {
        return Font.custom(SFCompactRounded(weight: fontWeight).rawValue, size: fontSize ?? fontStyle.size)
    }
}

// SF Compact Rounded font enum based on your font files
enum SFCompactRounded: String {
    case ultralight = "SFCompactRounded-Ultralight"
    case thin = "SFCompactRounded-Thin"
    case light = "SFCompactRounded-Light"
    case regular = "SFCompactRounded-Regular"
    case medium = "SFCompactRounded-Medium"
    case semibold = "SFCompactRounded-Semibold"
    case bold = "SFCompactRounded-Bold"
    case heavy = "SFCompactRounded-Heavy"
    case black = "SFCompactRounded-Black"
    
    init(weight: Font.Weight) {
        switch weight {
        case .ultraLight:
            self = .ultralight
        case .thin:
            self = .thin
        case .light:
            self = .light
        case .regular:
            self = .regular
        case .medium:
            self = .medium
        case .semibold:
            self = .semibold
        case .bold:
            self = .bold
        case .heavy:
            self = .heavy
        case .black:
            self = .black
        default:
            self = .regular
        }
    }
}

extension Font.TextStyle {
    var size: CGFloat {
        switch self {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 11
        @unknown default: return 17
        }
    }
}
