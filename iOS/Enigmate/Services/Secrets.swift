//
//  Secrets.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation

/// Secrets management system for the Enigmate app
/// This enum provides a safe way to access sensitive configuration data
/// like API keys and URLs from a plist file
enum Secrets {
    
    /// Development flag to switch between local and production Supabase
    /// Set to true to use local Supabase instance, false for production
    private static let useLocalSupabase = false
    
    /// Private dictionary that loads configuration from Secrets.plist
    /// This is a computed property that runs once when first accessed
    /// It reads the plist file from the app bundle and converts it to a dictionary
    private static let dict: [String: Any] = {
        // Try to find the Secrets.plist file in the app bundle
        guard
            let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
            // Read the file data
            let data = try? Data(contentsOf: url),
            // Parse the plist data into a dictionary
            let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else {
            // If any step fails, crash the app with a clear error message
            // This ensures we don't run with missing configuration
            fatalError("❌ Secrets.plist missing or unreadable")
        }
        return plist
    }()

    /// Supabase project URL for database connection
    /// Converts the string from plist to a URL object
    /// Force unwrapping is safe here because we validate the plist structure
    static var supabaseUrl: URL {
        if useLocalSupabase {
            // Local Supabase instance (run 'supabase start' first)
            return URL(string: "http://127.0.0.1:54321")!
        } else {
            // Production Supabase instance
            return URL(string: dict["SUPABASE_URL"] as! String)!
        }
    }
    
    /// Supabase anonymous API key for client-side authentication
    /// This key is used for public operations that don't require user authentication
    static var supabaseAnon: String {
        if useLocalSupabase {
            // Local anon key (you'll get this from 'supabase start' output)
            // Replace this with your actual local anon key
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        } else {
            // Production anon key
            return dict["SUPABASE_ANON_KEY"] as! String
        }
    }
}
