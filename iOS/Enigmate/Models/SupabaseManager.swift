//
//  SupabaseManager.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation
import Supabase

final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: Secrets.supabaseUrl,
            supabaseKey: Secrets.supabaseAnon
        )
    }

    // Convenience short-cuts
    var auth: AuthClient      { client.auth }
    var db:   PostgrestClient { client.database }
    var rpc:  FunctionsClient { client.functions }
    var storage: StorageClient { client.storage }
}