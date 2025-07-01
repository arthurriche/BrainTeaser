//
//  RiddleView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct RiddleView: View {

    @Environment(\.supabase) private var supabase
    @State private var riddle: Riddle?
    @State private var image: Image?
    @State private var loading = true

    var body: some View {
        // Use ZStack to layer background gradient behind content
        ZStack {
            // Background gradient layer
            backgroundGradient
            
            // Content layer
//            Group {
//                if loading {
//                    ProgressView("Chargement…")
//                        .foregroundColor(Color.primaryText)
//                } else if let riddle, let image {
//                    VStack(spacing: 16) {
//                        image
//                            .resizable()
//                            .scaledToFit()
//                        Text(riddle.prompt)
//                            .font(.sfCompactRounded(fontStyle: .headline))
//                            .foregroundColor(Color.primaryText)
//                    }
//                    .padding()
//                } else {
//                    Text("No riddle today")
//                        .foregroundColor(Color.primaryText)
//                }
//            }
        }
        .task { await load() }
    }

    private func load() async {
        defer { loading = false }
        do {
            if let ridd = try await supabase!.todaysRiddle() {
                riddle = ridd
                let imageData = try await supabase!.downloadPuzzleImageData(id: riddle!.getImageName())   
                image = Image(uiImage: UIImage(data: imageData)!)
            }
        } catch {
            print(error)
        }
    }
}
