//
//  ConversationView.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import SwiftUI

/// View that displays the conversation with The Master in a sheet
struct ConversationView: View {
    // MARK: - Properties
    @ObservedObject var conversationManager: ConversationManager
    @State private var messageText = ""
    @FocusState private var isTextFieldFocused: Bool
    @Binding var timeRemaining: TimeInterval
    @Binding var totalDuration: TimeInterval
    
    // Dismiss action for the sheet
    let onDismiss: () -> Void
    
    // MARK: - Body
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header with timer and dismiss button
                headerView
                
                Divider()
                    .background(Color.primaryText.opacity(0.3))
                
                // Conversation messages
                conversationScrollView
                
                // Message input area
                messageInputView
            }
            .background(backgroundGradient)
            .navigationBarHidden(true)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
    
    // MARK: - Header View
    private var headerView: some View {
        HStack {
            Spacer()
            
            // Timer display
            timerView
            
            Spacer()
            
            // Dismiss button
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.sfCompactRounded(fontStyle: .title3, fontWeight: .semibold))
                    .foregroundColor(Color.primaryText)
                    .frame(width: 30, height: 30)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(
            // Blurred background for header
            Color.palette1
                .opacity(0.95)
                .background(.ultraThinMaterial)
        )
    }
    
    // MARK: - Timer View
    private var timerView: some View {
        let minutes = Int(timeRemaining) / 60
        let seconds = Int(timeRemaining) % 60
        let timePercentage = timeRemaining / totalDuration
        let isLowTime = timePercentage <= 0.1
        
        return Text(String(format: "%02d:%02d", minutes, seconds))
            .font(.sfCompactRounded(fontStyle: .title2, fontWeight: .bold))
            .foregroundColor(isLowTime ? .red : Color.primaryText)
            .animation(.easeInOut(duration: 0.3), value: isLowTime)
    }
    
    // MARK: - Conversation Scroll View
    private var conversationScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Display all messages
                    ForEach(conversationManager.messages) { message in
                        MessageBubbleView(message: message)
                            .id(message.id)
                    }
                    
                    // Typing indicator when The Master is responding
                    if conversationManager.isTyping {
                        TypingIndicatorView()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 100) // Extra space for input field
            }
            .onChange(of: conversationManager.messages.count) { _ in
                // Auto-scroll to latest message
                if let lastMessage = conversationManager.messages.last {
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }
    
    // MARK: - Message Input View
    private var messageInputView: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.primaryText.opacity(0.3))
            
            HStack(spacing: 12) {
                // Text input field
                TextField("Ask your question...", text: $messageText)
                    .font(.sfCompactRounded(fontStyle: .body))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.palette2.opacity(0.8))
                            .stroke(Color.primaryText.opacity(0.3), lineWidth: 1)
                    )
                    .focused($isTextFieldFocused)
                
                // Send button
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.sfCompactRounded(fontStyle: .title2))
                        .foregroundColor(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 
                                       Color.primaryText.opacity(0.4) : Color.accent)
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                Color.palette1
                    .opacity(0.95)
                    .background(.ultraThinMaterial)
            )
        }
    }
    
    // MARK: - Helper Methods
    
    /// Sends the current message and clears the input field
    private func sendMessage() {
        let trimmedMessage = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        
        conversationManager.sendMessage(trimmedMessage)
        messageText = ""
    }
}

// MARK: - Message Bubble View

/// Individual message bubble for user and Master messages
struct MessageBubbleView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer(minLength: 60)
                
                // User message bubble
                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.text)
                        .font(.sfCompactRounded(fontStyle: .body))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 18)
                                .fill(Color.accent)
                        )
                    
                    Text("You")
                        .font(.sfCompactRounded(fontStyle: .caption, fontWeight: .medium))
                        .foregroundColor(Color.primaryText.opacity(0.7))
                }
            } else {
                // The Master's message bubble
                HStack(alignment: .top, spacing: 12) {
                    // The Master's avatar placeholder
                    Image("The_Master") // Assuming you have The Master image
                        .resizable()
                        .scaledToFill()
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.primaryText.opacity(0.3), lineWidth: 1)
                        )
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("The Master")
                            .font(.sfCompactRounded(fontStyle: .caption, fontWeight: .semibold))
                            .foregroundColor(Color.primaryText.opacity(0.8))
                        
                        Text(message.text)
                            .font(.sfCompactRounded(fontStyle: .body))
                            .foregroundColor(Color.primaryText)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 18)
                                    .fill(Color.palette2.opacity(0.8))
                                    .stroke(Color.primaryText.opacity(0.2), lineWidth: 1)
                            )
                    }
                }
                
                Spacer(minLength: 60)
            }
        }
    }
}

// MARK: - Typing Indicator View

/// Shows a typing indicator when The Master is responding
struct TypingIndicatorView: View {
    @State private var animationPhase = 0
    
    var body: some View {
        HStack {
            HStack(alignment: .top, spacing: 12) {
                // The Master's avatar
                Image("The_Master")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(Color.primaryText.opacity(0.3), lineWidth: 1)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("The Master")
                        .font(.sfCompactRounded(fontStyle: .caption, fontWeight: .semibold))
                        .foregroundColor(Color.primaryText.opacity(0.8))
                    
                    // Animated typing dots
                    HStack(spacing: 4) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(Color.primaryText.opacity(0.5))
                                .frame(width: 8, height: 8)
                                .scaleEffect(animationPhase == index ? 1.2 : 0.8)
                                .animation(
                                    Animation.easeInOut(duration: 0.6)
                                        .repeatForever()
                                        .delay(Double(index) * 0.2),
                                    value: animationPhase
                                )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color.palette2.opacity(0.8))
                            .stroke(Color.primaryText.opacity(0.2), lineWidth: 1)
                    )
                }
            }
            
            Spacer(minLength: 60)
        }
        .onAppear {
            animationPhase = 0
        }
    }
}

// MARK: - Preview

#Preview {
    @State var timeRemaining: TimeInterval = 1800 // 30 minutes
    @State var totalDuration: TimeInterval = 2700 // 45 minutes
    
    return ConversationView(
        conversationManager: ConversationManager(),
        timeRemaining: $timeRemaining,
        totalDuration: $totalDuration,
        onDismiss: {}
    )
}