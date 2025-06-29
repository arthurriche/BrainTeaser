//
//  ContentView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI
import Auth

struct ContentView: View {
    @Environment(\.supabase) private var supabase
    @Environment(\.showPasswordReset) private var showPasswordReset
    @State private var session: Session? = nil

    var body: some View {
        // Use ZStack to layer background gradient behind content
        ZStack {
            // Background gradient layer
            backgroundGradient
            
            // Content layer
            Group {
                if let supabase = supabase {
                    // Service is available, show the main app content
                    Group {
                        if session == nil {
                            AuthView()
                        } else {
                            RiddleIntroView()
                        }
                    }
                    .task {
                        // Listen to auth state changes using the streaming approach
                        for await authSession in await supabase.authStateStream() {
                            session = authSession
                        }
                    }
                } else {
                    // Service is not yet available, show loading
                    ProgressView("Loading...")
                        .foregroundColor(Color.primaryText) // Ensure visibility on gradient background
                }
            }
        }
        .sheet(isPresented: showPasswordReset) {
            PasswordResetView()
        }
    }
}
