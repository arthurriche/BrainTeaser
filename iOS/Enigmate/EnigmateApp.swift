//
//  EnigmateApp.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI
import OSLog

@main
struct EnigmateApp: App {
    // State to hold the SupabaseService instance
    @State private var supabaseService: SupabaseService? = nil

    let logger = Logger(subsystem: "com.clementmaubon.enigmate", category: "main")
    
//    init() {
//        do {
//            for family in UIFont.familyNames.sorted() {
//                print("▶︎ Family: \(family)")
//                for name in UIFont.fontNames(forFamilyName: family).sorted() {
//                    print("    - \(name)")
//                }
//            }
//        } catch {
//            fatalError("Could not initialize the model container: \(error)")
//        }
//    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.supabase, supabaseService)
                // Asynchronously initialize SupabaseService on appear
                .task {
                    do {
                        supabaseService = try await SupabaseService.create()
                    } catch {
                        logger.error("Failed to initialize Supabase: \(error.localizedDescription)")
                    }
                }
                // Handle deep links for authentication callbacks
                .onOpenURL { url in
                    // Handle authentication callback URLs (OAuth login or password reset)
                    if url.scheme == "enigmate" {
                        Task {
                            do {
                                try await supabaseService?.handleAuthCallback(url)
                            } catch {
                                logger.error("Error handling auth callback: \(error.localizedDescription)")
                            }
                        }
                    }
                }
        }
    }
}
