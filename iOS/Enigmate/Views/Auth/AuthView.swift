//
//  AuthView.swift
//  Enigmate
//
//  Created by Clément Maubon on 25/06/2025.
//

import SwiftUI

struct AuthView: View {

    @Environment(\.supabase) private var supabase
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
            SecureField("Mot de passe", text: $password)

            Button("Se connecter") {
                Task {
                    do   { try await supabase.signIn(email: email, password: password) }
                    catch { errorMessage = error.localizedDescription }
                }
            }
            if let msg = errorMessage {
                Text(msg).foregroundColor(.red)
            }
        }
        .padding()
    }
}