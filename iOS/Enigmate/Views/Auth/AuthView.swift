//
//  AuthView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct AuthView: View {
    @Environment(\.supabase) private var supabase
    @State private var errorMessage: String?
    @State private var showEmailAuth = false
    
    var body: some View {
        // Use ZStack to layer background gradient behind content
        ZStack {
            // Background gradient layer
            backgroundGradient
            
            // Content layer
            VStack(alignment: .center, spacing: 32) {
                // Add top spacer to push content toward center
                //Spacer()
                
                VStack(spacing: 16) {
                    Image("TransparentAppIcon")
                        .resizable()
                        .frame(width: 128, height: 128)

                    Text("Enigmate")
                        .font(.sfCompactRounded(fontWeight: .black, fontSize: 64))
                        .foregroundColor(Color.primaryText)
                    
                    Text("1 riddle a day. 100 days.\nYou vs the World.")
                        .font(.sfCompactRounded(fontStyle: .title2))
                        .foregroundColor(Color.primaryText.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                
                // Authentication options
                VStack(spacing: 16) {
                    // LinkedIn sign-in button
                    AuthButton(
                        title: "Continue with LinkedIn",
                        iconName: "LinkedInIcon",
                        backgroundColor: Color.linkedIn,
                        foregroundColor: .white
                    ) {
                        signInWithLinkedIn()
                    }
                    
                    // X (Twitter) sign-in button  
                    AuthButton(
                        title: "Continue with X",
                        iconName: "XIcon",
                        backgroundColor: .black,
                        foregroundColor: .white
                    ) {
                        signInWithX()
                    }
                    
                    // Email sign-in button
                    AuthButton(
                        title: "Continue with Email",
                        iconName: "envelope.fill",
                        backgroundColor: Color.white,
                        foregroundColor: .black
                    ) {
                        showEmailAuth = true
                    }
                }
                
                // Error message display
                if errorMessage != nil {
                    Text("Login failed. Please try again.")
                        .foregroundColor(Color.matchingRed.opacity(0.9)) // Adjusted red for better visibility
                        .font(.sfCompactRounded(fontStyle: .caption))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .transition(.opacity)
                }
                
                // Add bottom spacer to balance the layout
                //Spacer()
            }
            .padding(.horizontal, 24)
        }
        .sheet(isPresented: $showEmailAuth) {
            EmailAuthView()
        }
    }
    
    // MARK: - Authentication Methods
    
    /// Handle LinkedIn sign-in
    private func signInWithLinkedIn() {
        errorMessage = nil
        
        Task {
            do {
                try await supabase?.signInWithLinkedIn()
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to sign in with LinkedIn: \(error.localizedDescription)"
                }
            }
        }
    }
    
    /// Handle X (Twitter) sign-in
    private func signInWithX() {
        errorMessage = nil
        
        Task {
            do {
                try await supabase?.signInWithX()
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to sign in with X: \(error.localizedDescription)"
                }
            }
        }
    }
}
