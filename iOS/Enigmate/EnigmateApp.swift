//
//  EnigmateApp.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

@main
struct EnigmateApp: App {
    // State to hold the SupabaseService instance
    @State private var supabaseService: SupabaseService? = nil

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.supabase, supabaseService)
                // Asynchronously initialize SupabaseService on appear
                .task {
                    do {
                        let service = try await SupabaseService.create()
                        supabaseService = service
                    } catch {
                        // Log error but don't crash the app
                        print("Failed to initialize SupabaseService: \(error.localizedDescription)")
                    }
                }
        }
    }
}
