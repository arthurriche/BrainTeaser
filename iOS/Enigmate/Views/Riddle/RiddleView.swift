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
        Group {
            if loading {
                ProgressView("Chargement…")
            } else if let riddle, let image {
                VStack(spacing: 16) {
                    image
                        .resizable()
                        .scaledToFit()
                    Text(riddle.prompt)
                        .font(.headline)
                }
                .padding()
            } else {
                Text("Aucune énigme aujourd’hui")
            }
        }
        .task { await load() }
    }

    private func load() async {
        defer { loading = false }
        do {
            if let ridd = try await supabase!.todaysRiddle() {
                riddle = ridd
                let imageData = try await supabase!.downloadPuzzleImageData(path: ridd.imageUrl)
                image = Image(uiImage: UIImage(data: imageData)!)
            }
        } catch {
            print(error)
        }
    }
}
