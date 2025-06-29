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
import os.log
import AuthenticationServices

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
    
    /// Logger instance for this service
    private let logger = Logger(subsystem: "com.enigmate.supabase", category: "service")
    
    /// The main Supabase client instance for all API operations
    private let client: SupabaseClient 
    
    /// Current authentication session - automatically broadcasts changes to all listeners
    /// The didSet observer ensures all registered listeners get notified of session changes
    private var session: Session? { 
        didSet { 
            logger.info("Authentication session changed: \(self.session?.user.email ?? "nil", privacy: .private)")
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
        
        logger.info("SupabaseService initialized with session: \(session?.user.email ?? "nil", privacy: .private)")
        
        // Set up auth state change monitoring
        // Listen for auth state changes and update session
        Task {
            logger.debug("Starting auth state change monitoring")
            for await (_, newSession) in client.auth.authStateChanges {
                await self.updateSession(newSession)
            }
        }
    }

    /// Async factory method to create the service, handling async/throwing property access
    static func create() async throws -> SupabaseService {
        // Need to create a new logger instance here because the logger is private to the service
        let logger = Logger(subsystem: "com.enigmate.supabase", category: "service")
        logger.info("Creating SupabaseService instance")
        
        let client = SupabaseClient(
            supabaseURL: Secrets.supabaseUrl,
            supabaseKey: Secrets.supabaseAnon
        )
        
        // Try to get existing session, but don't fail if there isn't one
        // This is especially important for local development where users start fresh
        let session: Session?
        do {
            session = try await client.auth.session
            logger.info("Found existing session for user: \(session?.user.email ?? "unknown", privacy: .private)")
        } catch {
            // No existing session found - this is normal for fresh app launches
            session = nil
            logger.info("No existing session found - user will need to sign in")
        }
        
        logger.info("SupabaseService created successfully")
        return SupabaseService(client: client, session: session)
    }

    // MARK: – Authentication (Snapshot + Streaming Access)

    /// Returns the current authentication session at the time of the call
    /// This is a "snapshot" - it gives you the current state but doesn't notify of future changes
    /// Use this when you just need to check if user is logged in at a specific moment
    func currentSession() -> Session? { 
        logger.debug("Current session requested: \(self.session?.user.email ?? "nil", privacy: .private)")
        return session 
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
        logger.debug("Creating new auth state stream")
        return AsyncStream { continuation in
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
        logger.debug("Added auth listener with ID: \(id)")
    }

    /// Private actor-isolated method to remove a listener
    private func removeListener(id: UUID) {
        listeners.removeValue(forKey: id)
        logger.debug("Removed auth listener with ID: \(id)")
    }

    /// Registers a new user account with email and password
    /// Throws an error if registration fails (invalid email, weak password, etc.)
    func signUp(email: String, password: String, data: [String: AnyJSON]? = nil) async throws {
        logger.info("Attempting user sign up for email: \(email, privacy: .private)")
        do {
            _ = try await client.auth.signUp(email: email, password: password, data: data)
            logger.info("User sign up successful for email: \(email, privacy: .private)")
        } catch {
            logger.error("User sign up failed for email: \(email, privacy: .private), error: \(error.localizedDescription)")
            throw error
        }
    }

    /// Authenticates a user with email and password
    /// Throws an error if credentials are invalid or authentication fails
    func signIn(email: String, password: String) async throws {
        logger.info("Attempting user sign in for email: \(email, privacy: .private)")
        do {
            _ = try await client.auth.signIn(email: email, password: password)
            logger.info("User sign in successful for email: \(email, privacy: .private)")
        } catch {
            logger.error("User sign in failed for email: \(email, privacy: .private), error: \(error.localizedDescription)")
            throw error
        }
    }

    /// Signs in the current user with LinkedIn
    func signInWithLinkedIn() async throws {
        logger.info("Attempting user sign in with LinkedIn")
        do {
            // Use the configured Supabase URL instead of hardcoding it
            let redirectURL = Secrets.supabaseUrl.appendingPathComponent("/auth/v1/callback")
            logger.info("Using redirect URL: \(redirectURL.absoluteString)")
            
            _ = try await client.auth.signInWithOAuth(
                provider: .linkedinOIDC,
                redirectTo: redirectURL,
                scopes: "openid profile email"
            ) { (session: ASWebAuthenticationSession) in
                session.presentationContextProvider = nil // Allow system to handle presentation
                logger.info("LinkedIn OAuth session configured")
            }
            logger.info("User sign in with LinkedIn initiated successfully")
        } catch {
            logger.error("User sign in with LinkedIn failed: \(error.localizedDescription)")
            throw error
        }
    }

    /// Signs in the current user with Twitter (X)
    func signInWithX() async throws {
        logger.info("Attempting user sign in with Twitter")
        do {
            // Use the configured Supabase URL instead of hardcoding it
            let redirectURL = Secrets.supabaseUrl.appendingPathComponent("/auth/v1/callback")
            logger.info("Using redirect URL: \(redirectURL.absoluteString)")
            
            _ = try await client.auth.signInWithOAuth(
                provider: .twitter,
                redirectTo: redirectURL
            ) { (session: ASWebAuthenticationSession) in
                session.presentationContextProvider = nil // Allow system to handle presentation
                logger.info("Twitter OAuth session configured")
            }
            logger.info("User sign in with Twitter initiated successfully")
        } catch {
            logger.error("User sign in with Twitter failed: \(error.localizedDescription)")
            throw error
        }
    }

    /// Signs out the current user and clears the session
    /// This will trigger auth state change notifications to all listeners
    func signOut() async throws {
        logger.info("Attempting user sign out")
        do {
            try await client.auth.signOut()
            logger.info("User sign out successful")
        } catch {
            logger.error("User sign out failed: \(error.localizedDescription)")
            throw error
        }
    }

    /// Initiates password reset flow for the specified email address
    /// This will send a password reset email to the provided email address
    func resetPassword(email: String) async throws {
        logger.info("Attempting to reset password for email: \(email, privacy: .private)")
        do {
            try await client.auth.resetPasswordForEmail(email)
            logger.info("Password reset email sent successfully to: \(email, privacy: .private)")
        } catch {
            logger.error("Password reset failed for email: \(email, privacy: .private), error: \(error.localizedDescription)")
            throw error
        }
    }

    /// Handles the OAuth callback URL after social sign-in
    /// This method should be called when the app receives the callback URL from the OAuth provider
    func handleOAuthCallback(_ url: URL) async throws {
        logger.info("Handling OAuth callback URL")
        do {
            // Use the configured Supabase URL instead of hardcoding it
            try await client.auth.session(from: url)
            logger.info("OAuth callback processed successfully with url: \(url)")
        } catch {
            logger.error("Failed to process OAuth callback: \(error.localizedDescription)")
            throw error
        }
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
        // Format today's date as ISO8601 string (e.g., "2025-01-27")
        let today = ISO8601DateFormatter().string(from: .now)
        logger.info("Fetching today's riddle for date: \(today)")

        do {
            // Query the database for today's riddle using the new API
            let riddle: [Riddle] = try await client
                .from("riddles")           // Target table
                .select()                  // Select all columns
                .eq("date", value: today)  // Where date equals today
                .single()                  // Expect exactly one result
                .execute()
                .value// Execute the query

            // Decode the response into a Riddle object
            logger.info("Successfully fetched today's riddle with ID: \(riddle[0].id)")
            return riddle[0]
        } catch {
            logger.error("Failed to fetch today's riddle for date \(today): \(error.localizedDescription)")
            throw error
        }
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
        logger.info("Downloading puzzle image from path: \(path)")
        do {
            let imageData = try await client.storage
                .from("riddle-images")     // Target storage bucket
                .download(path: path)      // Download the file at the specified path
            
            logger.info("Successfully downloaded puzzle image from path: \(path), size: \(imageData.count) bytes")
            return imageData
        } catch {
            logger.error("Failed to download puzzle image from path \(path): \(error.localizedDescription)")
            throw error
        }
    }

    // MARK: – Internal Helper Methods

    /// Updates the session state and triggers the didSet observer
    /// This method is called by the auth state change handler
    private func updateSession(_ newSession: Session?) {
        logger.debug("Updating session state: \(newSession?.user.email ?? "nil", privacy: .private)")
        session = newSession  // This triggers the didSet observer which broadcasts to listeners
    }

    /// Notifies all registered listeners of a session state change
    /// Called automatically whenever the session changes (via didSet)
    private func broadcast(_ value: Session?) {
        logger.debug("Broadcasting session change to \(self.listeners.count) listeners")
        listeners.values.forEach { $0(value) }
    }
}
