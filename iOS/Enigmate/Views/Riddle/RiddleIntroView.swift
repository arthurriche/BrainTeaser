//
//  RiddleIntroView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct RiddleIntroView: View {
    @Environment(\.supabase) private var supabase
    @State private var riddle: Riddle?
    @State private var riddleImage: Image?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var navigateToRiddle = false
    
    var body: some View {
        NavigationStack {
            // Use ZStack to layer background gradient behind content
            ZStack {
                // Background gradient layer
                backgroundGradient
                
                // Content layer
                VStack(spacing: 0) {
                    if isLoading {
                        // Loading state
                        Spacer()
                        ProgressView("Loading riddle...")
                            .foregroundColor(Color.primaryText)
                            .font(.sfCompactRounded(fontStyle: .body))
                        Spacer()
                    } else if let riddle = riddle {
                        // Release date and days left at the top
                        HStack() {
                            Text(formattedDate(from: Date()))
                                .font(.sfCompactRounded(fontStyle: .title3, fontWeight: .bold))
                                .foregroundColor(Color.primaryText.opacity(0.8))
                            
                            Spacer()

                            Text("43 days left")
                                .font(.sfCompactRounded(fontStyle: .body))
                                .foregroundColor(Color.primaryText.opacity(0.6))
                        }
                        .padding(.top, 20)
                        
                        Spacer()
                        
                        // Main content - riddle title and image
                        VStack(spacing: 16) {
                            // Riddle title
                            Text(riddle.title)
                                .font(.sfCompactRounded(fontStyle: .largeTitle, fontWeight: .heavy))
                                .foregroundColor(Color.primaryText)
                                .multilineTextAlignment(.center)
                                .lineLimit(3)
                                .padding(.horizontal, 20)
                            
                            // Riddle image
                            if let riddleImage = riddleImage {
                                riddleImage
                                    .resizable()
                                    .aspectRatio(1, contentMode: .fill) // Square aspect ratio
                                    .frame(width: 280, height: 280)
                                    .clipShape(RoundedRectangle(cornerRadius: 24))
                                    //.shadow(color: Color.black.opacity(0.2), radius: 10, x: 0, y: 4)
                            } else {
                                // Placeholder for image
                                RoundedRectangle(cornerRadius: 24)
                                    .fill(Color.primaryText.opacity(0.1))
                                    .frame(width: 280, height: 280)
                                    .overlay(
                                        Image(systemName: "photo")
                                            .font(.system(size: 40))
                                            .foregroundColor(Color.primaryText.opacity(0.3))
                                    )
                            }
                            
                            // Duration and difficulty
                            HStack(spacing: 16) {
                                // Duration
                                HStack(spacing: 4) {
                                    Image(systemName: "clock")
                                        .font(.sfCompactRounded(fontWeight: .medium, fontSize: 16))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                    Text(formatDuration(riddle.duration))
                                        .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                }
                                
                                // Difficulty
                                HStack(spacing: 4) {
                                    Image(systemName: "flame")
                                        .font(.sfCompactRounded(fontWeight: .medium, fontSize: 16))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                    Text(riddle.getDifficultyString())
                                        .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                }
                                
                                // User count (from concept image)
                                HStack(spacing: 4) {
                                    Image(systemName: "person.2")
                                        .font(.sfCompactRounded(fontWeight: .medium, fontSize: 16))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                    Text("831")
                                        .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                                        .foregroundColor(Color.primaryText.opacity(0.8))
                                }
                            }
                        }

                        Spacer()
                        
                        // Start button at the bottom
                        MainButton(
                            title: "Start",
                            backgroundColor: Color.accent,
                            foregroundColor: Color.primaryText,
                            size: .large
                        ) {
                            navigateToRiddle = true
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 40)
                        
                    } else if let errorMessage = errorMessage {
                        // Error state
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 48))
                                .foregroundColor(Color.matchingRed.opacity(0.8))
                            
                            Text("Failed to load riddle")
                                .font(.sfCompactRounded(fontStyle: .headline, fontWeight: .bold))
                                .foregroundColor(Color.primaryText)
                            
                            Text(errorMessage)
                                .font(.sfCompactRounded(fontStyle: .body))
                                .foregroundColor(Color.primaryText.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                            
                            MainButton(
                                title: "Try Again",
                                backgroundColor: Color.accent,
                                foregroundColor: Color.primaryText,
                                size: .large
                            ) {
                                loadTodaysRiddle()
                            }
                            .padding(.horizontal, 32)
                        }
                        Spacer()
                    } else {
                        // No riddle available state
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "calendar.badge.exclamationmark")
                                .font(.system(size: 48))
                                .foregroundColor(Color.primaryText.opacity(0.6))
                            
                            Text("No riddle today")
                                .font(.sfCompactRounded(fontStyle: .headline, fontWeight: .bold))
                                .foregroundColor(Color.primaryText)
                            
                            Text("Check back tomorrow for a new challenge!")
                                .font(.sfCompactRounded(fontStyle: .body))
                                .foregroundColor(Color.primaryText.opacity(0.7))
                                .multilineTextAlignment(.center)
                        }
                        Spacer()
                    }
                }
                .padding(40)
            }
            .navigationDestination(isPresented: $navigateToRiddle) {
                if riddle != nil {
                    RiddleView()
                }
            }
            /* .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign out") {
                        Task {
                            do {
                                try await supabase?.signOut()
                            } catch {
                                errorMessage = error.localizedDescription
                            }
                        }
                    }
                    .foregroundColor(Color.primaryText)
                    .font(.sfCompactRounded(fontStyle: .body, fontWeight: .medium))
                }
            } */
        }
        .onAppear {
            loadTodaysRiddle()
        }
    }
    
    // MARK: - Helper Functions
    
    /// Loads today's riddle from Supabase
    private func loadTodaysRiddle() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                // Check if supabase is available
                guard let supabase = supabase else {
                    await MainActor.run {
                        errorMessage = "Service unavailable"
                        isLoading = false
                    }
                    return
                }
                
                // Fetch today's riddle from Supabase
                if let fetchedRiddle = try await supabase.todaysRiddle() {
                    // Download the riddle image from Supabase
                    let imageData = try await supabase.downloadPuzzleImageData(id: fetchedRiddle.getImageName())
                    let uiImage = UIImage(data: imageData)
                    
                    await MainActor.run {
                        riddle = fetchedRiddle
                        riddleImage = uiImage != nil ? Image(uiImage: uiImage!) : nil
                        isLoading = false
                    }
                } else {
                    await MainActor.run {
                        riddle = nil
                        isLoading = false
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    /// Formats duration in minutes to "MM:SS" format
    private func formatDuration(_ seconds: Int?) -> String {
        guard let seconds = seconds else { return "No Time Limit" }
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        return "\(minutes):\(String(format: "%02d", remainingSeconds))"
    }
}

#Preview {
    RiddleIntroView()
}
