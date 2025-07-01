//
//  ChatMessage.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation

/// Represents a single message in the conversation with The Master
struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let isFromUser: Bool
    let timestamp: Date
    
    init(text: String, isFromUser: Bool) {
        self.text = text
        self.isFromUser = isFromUser
        self.timestamp = Date()
    }
}

/// Manages the conversation state and The Master's responses
@MainActor
class ConversationManager: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isTyping = false
    
    /// Adds a user message and triggers The Master's response
    func sendMessage(_ text: String) {
        // Add user message
        let userMessage = ChatMessage(text: text, isFromUser: true)
        messages.append(userMessage)
        
        // Simulate The Master typing and respond
        simulateMasterResponse()
    }
    
    /// Simulates The Master's response with a realistic delay
    private func simulateMasterResponse() {
        isTyping = true
        
        // Simulate typing delay based on message length
        let delay = Double.random(in: 1.5...3.0)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.isTyping = false
            
            // Generate The Master's response based on the conversation context
            let response = self?.generateMasterResponse() ?? "Hmm, interesting observation."
            let masterMessage = ChatMessage(text: response, isFromUser: false)
            self?.messages.append(masterMessage)
        }
    }
    
    /// Generates contextual responses from The Master
    private func generateMasterResponse() -> String {
        let responses = [
            "Ah, a thoughtful approach. Consider the deeper meaning behind the symbols.",
            "Interesting perspective. What if you looked at this from a different angle?",
            "You're on the right track. The answer often lies in what's not immediately obvious.",
            "Think beyond the literal. What story do the elements tell together?",
            "Good observation. Now, what patterns do you notice that might guide you?",
            "The solution requires both logic and intuition. Trust your instincts.",
            "Every detail has purpose. Which elements seem most significant to you?",
            "Excellent reasoning. Continue following that thread of thought.",
            "Sometimes the simplest interpretation is the correct one. What's your first instinct?",
            "The path to enlightenment is never straightforward. Consider alternative meanings."
        ]
        
        return responses.randomElement() ?? "Continue your exploration, young seeker."
    }
}