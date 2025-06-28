//
//  ContentView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct ContentView: View {
    @Environment(\.supabase) private var supabase

    var body: some View {
        if supabase.session == nil {
            AuthView()
        } else {
            RiddleView()
        }
    }
}

#Preview {
    ContentView()
}
