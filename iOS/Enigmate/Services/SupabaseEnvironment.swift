//
//  SupabaseService.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation
import SwiftUI

/// EnvironmentKey for SupabaseService
/// The defaultValue is nil to handle the initialization state gracefully.
/// This prevents crashes during app startup when the service hasn't been created yet.
private struct SupabaseKey: EnvironmentKey {
    static let defaultValue: SupabaseService? = nil
}

/// Extends SwiftUI's EnvironmentValues to provide access to the SupabaseService
/// This allows any SwiftUI view to access Supabase functionality through the environment
extension EnvironmentValues {
    /// The SupabaseService instance that can be accessed via the environment
    /// Usage: @Environment(\\.supabase) var supabase
    var supabase: SupabaseService? {
        get { self[SupabaseKey.self] } // get the value from the environment
        set { self[SupabaseKey.self] = newValue } // set the value in the environment
    }
}

// Environment key for password reset sheet state
private struct ShowPasswordResetKey: EnvironmentKey {
    static let defaultValue: Binding<Bool> = .constant(false)
}

extension EnvironmentValues {
    var showPasswordReset: Binding<Bool> {
        get { self[ShowPasswordResetKey.self] }
        set { self[ShowPasswordResetKey.self] = newValue }
    }
}