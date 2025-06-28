# SupabaseService Architecture Explanation

## Overview

The `SupabaseService` is the **core service layer** that acts as the single point of contact between your iOS app and Supabase (your backend). It handles all external communication and provides a clean, thread-safe interface for the rest of your app.

## Architecture Pattern

- **Actor-based**: Uses Swift's modern concurrency with actors for automatic thread safety
- **Reactive**: Provides both snapshot and streaming access to authentication state
- **Separation of Concerns**: UI layer handles rendering, this layer handles data operations

## Key Components

### 1. `client: SupabaseClient`

#### What it is:
The `client` is the **main gateway** to all Supabase services. It's an instance of `SupabaseClient` that handles all communication with your Supabase backend.

#### What it does:
- **Authentication**: Handles user sign-up, sign-in, sign-out, and session management
- **Database Operations**: Executes SQL queries, inserts, updates, deletes on your tables
- **File Storage**: Uploads, downloads, and manages files in Supabase storage buckets
- **Real-time**: Can listen to database changes in real-time (if needed)
- **API Communication**: Manages HTTP requests, authentication headers, and responses

#### How it works:
```swift
// Example of what happens internally when you call:
let riddle = try await client.database
    .from("riddles")
    .select()
    .eq("date", today)
    .single()
    .execute()

// The client:
// 1. Builds the HTTP request with proper headers
// 2. Sends it to your Supabase URL
// 3. Handles authentication tokens automatically
// 4. Parses the JSON response
// 5. Returns the result
```

#### Why it's important:
It's the **single point of contact** with your backend - all data flows through this client, ensuring consistent authentication, error handling, and connection management.

---

### 2. `session: Session?` with `didSet`

#### What it is:
The `session` is a **Session?** object that represents the current authentication state. It contains:
- User information (email, user ID)
- Authentication tokens (access token, refresh token)
- Session metadata (created date, expires date)

#### What it does:
- **Tracks Login State**: `nil` = logged out, `Session` = logged in
- **Stores User Data**: Contains the current user's information
- **Manages Tokens**: Holds the JWT tokens needed for authenticated requests

#### The `didSet` Magic:
```swift
private var session: Session? { 
    didSet { 
        broadcast(session) // This runs EVERY time session changes
    } 
}
```

#### How the `didSet` works:
1. **User logs in** → `session` gets set to a new `Session` object
2. **`didSet` triggers** → `broadcast(session)` is called automatically
3. **All listeners notified** → Every registered listener gets the new session
4. **User logs out** → `session` gets set to `nil`
5. **`didSet` triggers again** → All listeners get notified of logout

#### Why this is powerful:
- **Automatic**: No manual notification needed - it happens automatically
- **Reactive**: Your UI can react to auth changes without polling
- **Consistent**: All parts of your app stay in sync with auth state

---

### 3. `listeners: [UUID: (Session?) -> Void]`

#### What it is:
A dictionary that stores **callback functions** that want to be notified when the authentication state changes. Each listener is identified by a unique UUID.

#### Structure breakdown:
```swift
[UUID: (Session?) -> Void]
//  ^     ^              ^
//  |     |              |
//  |     |              └── Function that takes Session? and returns nothing
//  |     └── Function signature (the callback)
//  └── Unique identifier for each listener
```

#### What it does:
- **Stores Callbacks**: Keeps track of who wants auth notifications
- **Enables Broadcasting**: Allows the service to notify multiple parts of the app
- **Prevents Memory Leaks**: Each listener can be removed individually

#### How it works in practice:

##### Registration (when someone wants to listen):
```swift
// When authStateStream() is called:
let id = UUID()  // Generate unique ID
listeners[id] = { session in
    continuation.yield(session)  // Send to the AsyncStream
}
```

##### Notification (when auth changes):
```swift
// When session changes, didSet calls broadcast():
private func broadcast(_ value: Session?) {
    listeners.values.forEach { $0(value) }  // Call every callback
}
```

##### Cleanup (when listener stops listening):
```swift
// When AsyncStream terminates:
continuation.onTermination = { @Sendable _ in
    Task { await self.listeners.removeValue(forKey: id) }  // Remove from dictionary
}
```

#### Real-world example:
```swift
// Multiple parts of your app can listen simultaneously:

// 1. AuthView wants to know about login/logout
for await session in supabaseService.authStateStream() {
    if session != nil {
        showMainApp()
    } else {
        showLoginScreen()
    }
}

// 2. ProfileView wants to update user info
for await session in supabaseService.authStateStream() {
    if let session = session {
        updateUserProfile(session.user)
    }
}

// 3. SettingsView wants to enable/disable features
for await session in supabaseService.authStateStream() {
    enablePremiumFeatures(session != nil)
}
```

#### Why this pattern is excellent:
- **Decoupled**: Different parts of your app don't need to know about each other
- **Efficient**: Only one auth state change triggers all listeners
- **Memory Safe**: Listeners are automatically cleaned up when no longer needed
- **Scalable**: You can add as many listeners as needed without performance impact

---

## How They Work Together

```swift
// 1. User logs in via Supabase
client.auth.signIn(email: "user@example.com", password: "password")

// 2. Supabase client updates its internal state
// 3. Our stateChanged callback is triggered
client.auth.stateChanged { [weak self] _, newSession in
    Task { await self.updateSession(newSession) }
}

// 4. updateSession() is called
private func updateSession(_ newSession: Session?) {
    session = newSession  // This triggers didSet
}

// 5. didSet automatically calls broadcast()
private func broadcast(_ value: Session?) {
    listeners.values.forEach { $0(value) }  // Notify all listeners
}

// 6. All registered listeners receive the new session
// 7. UI updates automatically across the entire app
```

## Design Benefits

1. **Thread Safety**: Actor ensures all operations are thread-safe automatically
2. **Memory Management**: Proper cleanup of listeners prevents memory leaks
3. **Error Handling**: All operations throw errors for proper error handling
4. **Reactive**: Auth state changes automatically propagate to all listeners
5. **Testable**: Clean separation makes unit testing easier

## Usage Patterns

```swift
// Check current auth state
if let session = await supabaseService.currentSession() {
    // User is logged in
}

// Listen to auth changes
for await session in supabaseService.authStateStream() {
    // Handle login/logout events
}

// Get today's riddle
if let riddle = try await supabaseService.todaysRiddle() {
    // Display the riddle
}
```

This creates a **reactive, thread-safe, and efficient** authentication system that keeps your entire app in sync with the user's login state!
