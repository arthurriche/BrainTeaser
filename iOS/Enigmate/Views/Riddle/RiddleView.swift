//
//  RiddleView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

/// Main view for displaying riddles with conversation functionality
struct RiddleView: View {
    
    // MARK: - Environment & State Properties
    @Environment(\.supabase) private var supabase
    @StateObject private var conversationManager = ConversationManager()
    @StateObject private var riddleTimer = RiddleTimer()
    
    // Riddle data state
    @State private var riddle: Riddle?
    @State private var riddleImage: Image?
    @State private var masterImage: Image?
    @State private var loading = true
    
    // UI state
    @State private var messageText = ""
    @State private var showingConversation = false
    @FocusState private var isTextFieldFocused: Bool
    
    // MARK: - Body
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background gradient layer
                backgroundGradient
                
                VStack(spacing: 0) {
                    // Header with timer
                    headerView
                    
                    // Main content
                    contentView
                    
                    // Bottom text input
                    messageInputView
                }
            }
        }
        .task { await loadRiddle() }
        .sheet(isPresented: $showingConversation) {
            ConversationView(
                conversationManager: conversationManager,
                timeRemaining: $riddleTimer.timeRemaining,
                totalDuration: $riddleTimer.totalDuration,
                onDismiss: { showingConversation = false }
            )
        }
    }
    
    // MARK: - Header View
    
    /// Header containing the countdown timer with red color when time is low
    private var headerView: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                
                // Timer display
                Text(riddleTimer.formattedTime)
                    .font(.sfCompactRounded(fontStyle: .title2, fontWeight: .bold))
                    .foregroundColor(riddleTimer.isLowTime ? .red : Color.primaryText)
                    .animation(.easeInOut(duration: 0.3), value: riddleTimer.isLowTime)
                
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(
                // Blurred background for smooth text passage
                Color.palette1
                    .opacity(0.95)
                    .background(.ultraThinMaterial)
            )
            
            // Subtle border for visual separation
            Rectangle()
                .fill(Color.primaryText.opacity(0.2))
                .frame(height: 1)
        }
    }
    
    // MARK: - Content View
    
    /// Main scrollable content area with riddle information and Master section
    private var contentView: some View {
        ScrollView {
            LazyVStack(spacing: 24) {
                if loading {
                    // Loading state
                    loadingView
                } else if let riddle = riddle {
                    // Riddle content
                    riddleContentView(riddle: riddle)
                    
                    // The Master section at bottom
                    masterSectionView
                } else {
                    // Error state
                    errorView
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 120) // Extra space for input field
        }
    }
    
    /// Loading state view
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(Color.accent)
            
            Text("Loading today's riddle...")
                .font(.sfCompactRounded(fontStyle: .headline, fontWeight: .medium))
                .foregroundColor(Color.primaryText.opacity(0.8))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 100)
    }
    
    /// Riddle content display
    private func riddleContentView(riddle: Riddle) -> some View {
        VStack(spacing: 20) {
            // Riddle title
            Text(riddle.title)
                .font(.sfCompactRounded(fontStyle: .largeTitle, fontWeight: .bold))
                .foregroundColor(Color.primaryText)
                .multilineTextAlignment(.center)
                .padding(.top, 10)
            
            // Riddle image if available
            if let riddleImage = riddleImage {
                riddleImage
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 300)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
            }
            
            // Riddle question
            Text(riddle.question)
                .font(.sfCompactRounded(fontStyle: .body, fontWeight: .regular))
                .foregroundColor(Color.primaryText)
                .lineSpacing(6)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    
    /// The Master section at bottom of content
    private var masterSectionView: some View {
        VStack(spacing: 16) {
            // The Master's image
            Group {
                if let masterImage = masterImage {
                    masterImage
                        .resizable()
                        .scaledToFill()
                } else {
                    // Fallback placeholder
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.palette2.opacity(0.6))
                        .overlay(
                            Image(systemName: "person.circle")
                                .font(.system(size: 40))
                                .foregroundColor(Color.primaryText.opacity(0.6))
                        )
                }
            }
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.primaryText.opacity(0.3), lineWidth: 2)
            )
            .shadow(color: Color.black.opacity(0.2), radius: 6, x: 0, y: 3)
            
            // "What do you think?" text
            Text("What do you think?")
                .font(.sfCompactRounded(fontStyle: .title2, fontWeight: .semibold))
                .foregroundColor(Color.primaryText)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 40)
        .padding(.bottom, 20)
    }
    
    /// Error state view
    private var errorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(Color.primaryText.opacity(0.6))
            
            Text("No riddle available today")
                .font(.sfCompactRounded(fontStyle: .headline, fontWeight: .medium))
                .foregroundColor(Color.primaryText.opacity(0.8))
            
            Text("Please check back later")
                .font(.sfCompactRounded(fontStyle: .body))
                .foregroundColor(Color.primaryText.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 100)
    }
    
    // MARK: - Message Input View
    
    /// Bottom text input area in ChatGPT style
    private var messageInputView: some View {
        VStack(spacing: 0) {
            // Subtle top border
            Rectangle()
                .fill(Color.primaryText.opacity(0.2))
                .frame(height: 1)
            
            HStack(spacing: 12) {
                // Text input field with ChatGPT-style design
                TextField("Message The Master...", text: $messageText)
                    .font(.sfCompactRounded(fontStyle: .body))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.palette2.opacity(0.8))
                            .stroke(Color.primaryText.opacity(0.3), lineWidth: 1.5)
                    )
                    .focused($isTextFieldFocused)
                    .onSubmit {
                        sendMessage()
                    }
                
                // Send button
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 
                                       Color.primaryText.opacity(0.4) : Color.accent)
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .animation(.easeInOut(duration: 0.2), value: messageText.isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(
                // Blurred background for input area
                Color.palette1
                    .opacity(0.95)
                    .background(.ultraThinMaterial)
            )
        }
    }
    
    // MARK: - Helper Methods
    
    /// Loads the daily riddle and starts the timer
    private func loadRiddle() async {
        defer { loading = false }
        
        do {
            // Load the riddle
            if let dailyRiddle = try await supabase!.todaysRiddle() {
                riddle = dailyRiddle
                
                // Load riddle image
                let imageData = try await supabase!.downloadPuzzleImageData(id: dailyRiddle.getImageName())
                riddleImage = Image(uiImage: UIImage(data: imageData)!)
                
                // Start timer
                riddleTimer.start(durationInMinutes: dailyRiddle.duration ?? 45) // Default 45 minutes
            }
            
            // Load The Master's image
            loadMasterImage()
            
        } catch {
            print("Error loading riddle: \(error)")
        }
    }
    
    /// Loads The Master's image from resources
    private func loadMasterImage() {
        // Try to load The Master image from bundle
        if let image = UIImage(named: "The_Master") {
            masterImage = Image(uiImage: image)
        }
    }
    
    
    /// Sends the current message and opens the conversation sheet
    private func sendMessage() {
        let trimmedMessage = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        
        // Send message to conversation manager
        conversationManager.sendMessage(trimmedMessage)
        
        // Clear input and show conversation
        messageText = ""
        isTextFieldFocused = false
        
        // Smooth transition to conversation sheet
        withAnimation(.easeInOut(duration: 0.3)) {
            showingConversation = true
        }
    }
}

// MARK: - Preview

#Preview {
    RiddleView()
        .environmentObject(SupabaseManager()) // You may need to adjust this based on your SupabaseManager
}
