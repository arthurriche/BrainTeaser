//
//  SupabaseService.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation
import SwiftUI

private struct SupabaseKey: EnvironmentKey {
    static let defaultValue = SupabaseService()   // safe default for tests
}

/// Extends SwiftUI's EnvironmentValues to provide access to the SupabaseService
/// This allows any SwiftUI view to access Supabase functionality through the environment
extension EnvironmentValues {
    /// The SupabaseService instance that can be accessed via the environment
    /// Usage: @Environment(\.supabase) var supabase
    var supabase: SupabaseService {
        get { self[SupabaseKey.self] } // get the value from the environment
        set { self[SupabaseKey.self] = newValue } // set the value in the environment
    }
}