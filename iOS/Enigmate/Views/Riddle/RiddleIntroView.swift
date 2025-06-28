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
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, world!")
            Button("Sign out") {
                Task {
                    do   { try await supabase!.signOut() }
                    catch { errorMessage = error.localizedDescription }
                }
            }
        }
        .padding()
    }
}

#Preview {
    RiddleIntroView()
}
