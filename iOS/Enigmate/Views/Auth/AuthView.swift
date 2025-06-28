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
            SecureField("Password", text: $password)

            Button("Connect") {
                Task {
                    do   { try await supabase!.signIn(email: email, password: password) }
                    catch { errorMessage = error.localizedDescription }
                }
            }
            if let msg = errorMessage {
                Text(msg).foregroundColor(.red)
            }

            Button("Create account") {
                Task {
                    do   { try await supabase!.signUp(email: email, password: password) }
                    catch { errorMessage = error.localizedDescription }
                }
            }

            Button("Sign in with LinkedIn") {
                Task {
                    do   { try await supabase!.signInWithLinkedIn() }
                    catch { errorMessage = error.localizedDescription }
                }
            }
        }
        .padding()
    }
}
