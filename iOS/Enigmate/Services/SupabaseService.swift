//
//  SupabaseService.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

//
//  SupabaseService.swift
//  Enigmate
//
//  A UIKit-free / Combine-free service built on  Swift-Concurrency
//  ---------------------------------------------------------------------
//  • Actor = automatic thread-safety, no locks to manage
//  • AsyncStream = modern replacement for Combine publishers
//  • Returns raw Data for images – UI layer decides how to render
//

import Foundation
import Supabase

/// Main service class for handling all Supabase operations (authentication, database, storage)
/// 
/// This actor provides a thread-safe (no locks to manage) interface to Supabase services using Swift's modern
/// concurrency features. It acts as the single point of contact between the app and Supabase,
/// handling authentication state management, database queries, and file storage operations.
/// 
/// Key Design Principles:
/// - Thread Safety: Uses Swift actors for automatic thread safety
/// - Reactive: Provides both snapshot and streaming access to auth state
/// - Separation of Concerns: UI layer handles rendering, this layer handles data (no UI layer in this layer)
/// - Error Handling: All operations throw errors for proper error handling
actor SupabaseService {

    // MARK: – Private state
    
    /// The main Supabase client instance for all API operations
    private let client: SupabaseClient 
    
    /// Current authentication session - automatically broadcasts changes to all listeners
    /// The didSet observer ensures all registered listeners get notified of session changes
    private var session: Session? { 
        didSet { 
            broadcast(session) // Notify all listeners when session changes
        } 
    }
    
    /// Dictionary of registered listeners for auth state changes
    /// Each listener is identified by a UUID and receives Session? updates
    private var listeners: [UUID: (Session?) -> Void] = [:]

    // MARK: – Initialization
    
    /// Private initializer. Use static async create() to instantiate.
    private init(client: SupabaseClient, session: Session?) {
        self.client = client
        self.session = session
        
        // Set up auth state change monitoring
        // Listen for auth state changes and update session
        Task {
            for await (_, newSession) in client.auth.authStateChanges {
                await self.updateSession(newSession)
            }
        }
    }

    /// Async factory method to create the service, handling async/throwing property access
    static func create() async throws -> SupabaseService {
        let client = SupabaseClient(
            supabaseURL: Secrets.supabaseUrl,
            supabaseKey: Secrets.supabaseAnon
        )
        let session = try await client.auth.session
        return SupabaseService(client: client, session: session)
    }

    // MARK: – Authentication (Snapshot + Streaming Access)

    /// Returns the current authentication session at the time of the call
    /// This is a "snapshot" - it gives you the current state but doesn't notify of future changes
    /// Use this when you just need to check if user is logged in at a specific moment
    func currentSession() -> Session? { 
        session 
    }

    /// Creates an AsyncSequence that yields authentication state changes
    /// This is the "streaming" approach - you get notified of every auth state change
    /// 
    /// Usage example:
    /// ```swift
    /// for await session in supabaseService.authStateStream() {
    ///     // Handle session changes (login, logout, token refresh, etc.)
    /// }
    /// ```
    func authStateStream() -> AsyncStream<Session?> {
        AsyncStream { continuation in
            Task { [weak self] in
                guard let self else { return }
                // 1) Immediately send the current session state to the new listener
                let currentSession = await self.session
                continuation.yield(currentSession)

                // 2) Register this listener to receive future updates
                let id = UUID()
                await self.addListener(id: id) { continuation.yield($0) }

                // 3) Clean up the listener when the consumer stops listening
                continuation.onTermination = { _ in
                    Task { [weak self] in
                        guard let self else { return }
                        await self.removeListener(id: id)
                    }
                }
            }
        }
    }

    /// Private actor-isolated method to add a listener
    private func addListener(id: UUID, _ callback: @escaping (Session?) -> Void) {
        listeners[id] = callback
    }

    /// Private actor-isolated method to remove a listener
    private func removeListener(id: UUID) {
        listeners.removeValue(forKey: id)
    }

    /// Registers a new user account with email and password
    /// Throws an error if registration fails (invalid email, weak password, etc.)
    func signUp(email: String, password: String) async throws {
        _ = try await client.auth.signUp(email: email, password: password)
    }

    /// Authenticates a user with email and password
    /// Throws an error if credentials are invalid or authentication fails
    func signIn(email: String, password: String) async throws {
        _ = try await client.auth.signIn(email: email, password: password)
    }

    /// Signs out the current user and clears the session
    /// This will trigger auth state change notifications to all listeners
    func signOut() async throws {
        try await client.auth.signOut()
    }

    // MARK: – Database Operations

    /// Fetches today's riddle from the database
    /// 
    /// This method:
    /// 1. Gets today's date in ISO8601 format (YYYY-MM-DD)
    /// 2. Queries the "riddles" table for a record matching today's date
    /// 3. Returns the riddle if found, nil if no riddle exists for today
    /// 
    /// The query uses .single() which expects exactly one result and throws if none or multiple found
    func todaysRiddle() async throws -> Riddle? {
        let today = ISO8601DateFormatter().string(from: .now)
        return try await client
            .from("riddles")
            .select()
            .eq("date", value: today)
            .single()
            .execute(decoding: Riddle?.self)
    }

    // MARK: – File Storage Operations

    /// Downloads image data from Supabase storage
    /// 
    /// This method downloads raw bytes from the "riddle-images" bucket.
    /// The UI layer is responsible for converting the Data into UIImage/SwiftUI Image.
    /// This separation allows the service to be UI-framework agnostic.
    /// 
    /// - Parameter path: The file path within the bucket (e.g., "riddle1.jpg")
    /// - Returns: Raw image data that can be converted to UIImage or SwiftUI Image
    func downloadPuzzleImageData(path: String) async throws -> Data {
        try await client.storage
            .from("riddle-images")     // Target storage bucket
            .download(path: path)      // Download the file at the specified path
    }

    // MARK: – Internal Helper Methods

    /// Updates the session state and triggers the didSet observer
    /// This method is called by the auth state change handler
    private func updateSession(_ newSession: Session?) {
        session = newSession  // This triggers the didSet observer which broadcasts to listeners
    }

    /// Notifies all registered listeners of a session state change
    /// Called automatically whenever the session changes (via didSet)
    private func broadcast(_ value: Session?) {
        listeners.values.forEach { $0(value) }
    }
}
