//
//  RiddleIntroView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct RiddleIntroView: View {
    @Environment(\.supabase) private var supabase
    @State private var errorMessage: String? = nil

    var body: some View {
        // Use ZStack to layer background gradient behind content
        ZStack {
            // Background gradient layer
            backgroundGradient
            
            // Content layer
            VStack {
                Image(systemName: "globe")
                    .imageScale(.large)
                    .foregroundStyle(Color.primaryText)
                Text("Hello, world!")
                    .foregroundColor(Color.primaryText)
                Button("Sign out") {
                    Task {
                        do   { try await supabase!.signOut() }
                        catch { errorMessage = error.localizedDescription }
                    }
                }
                .foregroundColor(Color.primaryText)
            }
            .padding()
        }
    }
}

#Preview {
    RiddleIntroView()
}
