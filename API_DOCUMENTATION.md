# Enigmate API Documentation

## Overview

Enigmate is a riddle-solving app built with a **Supabase backend** and **iOS SwiftUI frontend**. This documentation covers all public APIs, services, models, and UI components.

## Table of Contents

1. [Backend APIs](#backend-apis)
2. [iOS Services](#ios-services)
3. [iOS Models](#ios-models)
4. [iOS UI Components](#ios-ui-components)
5. [iOS Utilities](#ios-utilities)
6. [Database Schema](#database-schema)
7. [Authentication System](#authentication-system)
8. [Configuration](#configuration)

---

## Backend APIs

### Edge Function: `riddle_today`

**Endpoint**: `POST /functions/v1/riddle_today`  
**Description**: Retrieves today's riddle with question and image URL.

#### Request
```http
POST /functions/v1/riddle_today
Authorization: Bearer <supabase_anon_key>
Content-Type: application/json
```

#### Response
```json
{
  "id": 1,
  "question": "You're traveling through a country...",
  "imageURL": "https://psziiemacrkzqdutwvic.supabase.co/storage/v1/object/sign/riddle-images/1.png?token=..."
}
```

#### Error Response
```json
{
  "error": "Riddle not found"
}
```

#### Implementation Details
- Uses UTC date (`YYYY-MM-DD` format) to determine "today"
- Queries `riddles` table filtering by `release_date`
- Returns hardcoded image URLs for development (IDs 1, 2, 5)
- Returns 404 if no riddle exists for today

#### Example Usage (curl)
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/riddle_today' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  --header 'Content-Type: application/json'
```

---

## iOS Services

### SupabaseService

**File**: `iOS/Enigmate/Services/SupabaseService.swift`  
**Type**: `Actor` (Thread-safe)  
**Description**: Main service class handling all Supabase operations.

#### Initialization

```swift
// Async factory method
let service = try await SupabaseService.create()
```

#### Authentication Methods

##### `currentSession() -> Session?`
Returns the current authentication session (snapshot approach).

```swift
if let session = await supabaseService.currentSession() {
    print("User is logged in: \(session.user.email)")
} else {
    print("User is not logged in")
}
```

##### `authStateStream() -> AsyncStream<Session?>`
Creates a stream of authentication state changes (reactive approach).

```swift
for await session in supabaseService.authStateStream() {
    if let session = session {
        // User logged in
        showMainApp()
    } else {
        // User logged out
        showAuthView()
    }
}
```

##### `signUp(email: String, password: String, data: [String: AnyJSON]?) async throws`
Registers a new user account.

```swift
do {
    try await supabaseService.signUp(
        email: "user@example.com",
        password: "securePassword123",
        data: ["name": "John Doe"]
    )
    print("User registration successful")
} catch {
    print("Registration failed: \(error.localizedDescription)")
}
```

##### `signIn(email: String, password: String) async throws`
Authenticates a user with email and password.

```swift
do {
    try await supabaseService.signIn(
        email: "user@example.com",
        password: "securePassword123"
    )
    print("User sign-in successful")
} catch {
    print("Sign-in failed: \(error.localizedDescription)")
}
```

##### `signInWithLinkedIn() async throws`
Initiates LinkedIn OAuth authentication.

```swift
do {
    try await supabaseService.signInWithLinkedIn()
    // OAuth flow initiated, user will be redirected to LinkedIn
} catch {
    print("LinkedIn sign-in failed: \(error.localizedDescription)")
}
```



##### `signOut() async throws`
Signs out the current user.

```swift
do {
    try await supabaseService.signOut()
    print("User signed out successfully")
} catch {
    print("Sign-out failed: \(error.localizedDescription)")
}
```

##### `resetPassword(email: String) async throws`
Initiates password reset flow.

```swift
do {
    try await supabaseService.resetPassword(email: "user@example.com")
    print("Password reset email sent")
} catch {
    print("Password reset failed: \(error.localizedDescription)")
}
```

##### `updatePassword(newPassword: String) async throws`
Updates the current user's password (requires active session).

```swift
do {
    try await supabaseService.updatePassword(newPassword: "newSecurePassword123")
    print("Password updated successfully")
} catch {
    print("Password update failed: \(error.localizedDescription)")
}
```

##### `handleAuthCallback(_ url: URL) async throws -> AuthCallbackType`
Handles OAuth and password reset callback URLs.

```swift
// In your App's onOpenURL handler
.onOpenURL { url in
    if url.scheme == "enigmate" {
        Task {
            do {
                let callbackType = try await supabaseService?.handleAuthCallback(url)
                if callbackType == .passwordReset {
                    showPasswordReset = true
                }
            } catch {
                print("Error handling auth callback: \(error.localizedDescription)")
            }
        }
    }
}
```

#### Database Methods

##### `todaysRiddle() async throws -> Riddle?`
Fetches today's riddle from the database.

```swift
do {
    if let riddle = try await supabaseService.todaysRiddle() {
        print("Today's riddle: \(riddle.question)")
        displayRiddle(riddle)
    } else {
        print("No riddle available today")
    }
} catch {
    print("Failed to fetch riddle: \(error.localizedDescription)")
}
```

#### Storage Methods

##### `downloadPuzzleImageData(id: String) async throws -> Data`
Downloads image data from Supabase storage.

```swift
do {
    let imageData = try await supabaseService.downloadPuzzleImageData(id: "riddle-1.png")
    let image = UIImage(data: imageData)
    displayImage(image)
} catch {
    print("Failed to download image: \(error.localizedDescription)")
}
```

#### Environment Integration

The service integrates with SwiftUI's environment system:

```swift
// In your main app
.environment(\.supabase, supabaseService)

// In any view
@Environment(\.supabase) private var supabase
```

---

## iOS Models

### Riddle

**File**: `iOS/Enigmate/Models/Riddle.swift`  
**Type**: `struct`  
**Protocols**: `Identifiable`, `Encodable`, `Decodable`, `Equatable`

#### Properties

```swift
struct Riddle {
    let id: Int
    let title: String
    let date: Date
    let question: String
    let answer: String
    let image: String
    let duration: Int?        // Duration in minutes (optional)
    let difficulty: Int?      // 1-4: Easy to Very Hard (optional)
    let hint1: String?
    let hint2: String?
    let hint3: String?
}
```

#### Methods

##### `getDifficultyString() -> String`
Returns human-readable difficulty level.

```swift
let riddle = Riddle(/* ... */, difficulty: 3, /* ... */)
print(riddle.getDifficultyString()) // "Hard"

// Mapping:
// 1 -> "Easy"
// 2 -> "Medium" 
// 3 -> "Hard"
// 4 -> "Very Hard"
// nil -> "Unknown"
```

##### `getImageName() -> String`
Generates the image filename for storage lookup.

```swift
let riddle = Riddle(id: 5, /* ... */)
print(riddle.getImageName()) // "riddle-5.png"
```

#### Usage Example

```swift
// Create a riddle
let riddle = Riddle(
    id: 1,
    title: "The Road to Truthshire",
    date: Date(),
    question: "You're traveling through a country...",
    answer: "Ask: 'Which of these roads leads to your home region?'",
    image: "riddle-1.png",
    duration: 15,
    difficulty: 2,
    hint1: "Think about logic puzzles",
    hint2: "Consider what each person would say",
    hint3: "Both types of people will point the same way"
)

// Use the riddle
print("Difficulty: \(riddle.getDifficultyString())")
print("Image file: \(riddle.getImageName())")
```

### SupabaseManager

**File**: `iOS/Enigmate/Models/SupabaseManager.swift`  
**Type**: `ObservableObject`  
**Description**: Simple wrapper for environment integration (legacy/simplified approach).

```swift
class SupabaseManager: ObservableObject {
    @Published var supabaseService: SupabaseService?
    
    func initialize() async {
        do {
            supabaseService = try await SupabaseService.create()
        } catch {
            print("Failed to initialize Supabase: \(error)")
        }
    }
}
```

---

## iOS UI Components

### Shared Components

#### MainButton

**File**: `iOS/Enigmate/Views/SharedViews.swift`  
**Description**: Reusable button component with customizable styles and sizes.

##### Parameters

```swift
MainButton(
    title: String,                    // Button text
    iconName: String? = nil,          // SF Symbol or custom icon
    backgroundColor: Color = .accent, // Background color
    foregroundColor: Color = .black,  // Text/icon color
    size: ButtonSize = .medium,       // Button size variant
    action: () -> Void               // Action closure
)
```

##### Button Sizes

```swift
enum ButtonSize {
    case medium  // Default: .body font, 60pt height, 16pt corners
    case small   // Capsule: .caption font, 48pt height, 22pt corners
    case large   // Compact: .title font, 72pt height, 200pt max width
}
```

##### Usage Examples

```swift
// Basic button
MainButton(title: "Sign In") {
    performSignIn()
}

// Button with icon
MainButton(
    title: "Continue with Email",
    iconName: "envelope.fill",
    backgroundColor: .white,
    foregroundColor: .black
) {
    showEmailAuth()
}

// Small button
MainButton(
    title: "Cancel",
    size: .small
) {
    dismiss()
}

// Large prominent button
MainButton(
    title: "Continue",
    backgroundColor: .blue,
    size: .large
) {
    proceedToNextStep()
}
```

#### MainButtonStyle

**Description**: Custom button style with inner shadows and animations.

```swift
// Direct usage
Button("Custom Button") {
    // action
}
.buttonStyle(MainButtonStyle(
    backgroundColor: .blue,
    foregroundColor: .white,
    size: .medium
))
```

#### Background Gradient

**Description**: Shared background gradient used across views.

```swift
// Usage in any view
var body: some View {
    ZStack {
        backgroundGradient  // Shared gradient background
        
        // Your content here
        VStack {
            Text("Hello World")
        }
    }
}
```

### Authentication Views

#### AuthView

**File**: `iOS/Enigmate/Views/Auth/AuthView.swift`  
**Description**: Main authentication screen with OAuth and email options.

##### Features
- LinkedIn OAuth integration
- Email authentication option
- Error message display
- Responsive layout with brand identity

##### Usage

```swift
struct ContentView: View {
    @Environment(\.supabase) private var supabase
    @State private var session: Session?
    
    var body: some View {
        if session == nil {
            AuthView()  // Show auth when not logged in
        } else {
            MainAppView()  // Show main app when logged in
        }
    }
}
```

##### OAuth Integration

The view automatically handles OAuth flows:

```swift
// LinkedIn sign-in
MainButton(
    title: "Continue with LinkedIn",
    iconName: "LinkedInIcon",
    backgroundColor: Color.linkedIn,
    foregroundColor: .white
) {
    signInWithLinkedIn()  // Triggers OAuth flow
}
```

#### EmailAuthView

**File**: `iOS/Enigmate/Views/Auth/EmailAuthView.swift`  
**Description**: Email authentication form with sign-in and sign-up modes.

##### Features
- Email/password input validation
- Toggle between sign-in and sign-up modes
- Loading states and error handling
- Form validation and user feedback

##### Usage

```swift
.sheet(isPresented: $showEmailAuth) {
    EmailAuthView()
}
```

#### PasswordResetView

**File**: `iOS/Enigmate/Views/Auth/PasswordResetView.swift`  
**Description**: Password reset interface for authenticated users.

##### Usage

```swift
.sheet(isPresented: $showPasswordReset) {
    PasswordResetView()
}
```

### Riddle Views

#### RiddleView

**File**: `iOS/Enigmate/Views/Riddle/RiddleView.swift`  
**Description**: Main riddle display view (currently minimal implementation).

##### Current Implementation

```swift
struct RiddleView: View {
    @Environment(\.supabase) private var supabase
    @State private var riddle: Riddle?
    @State private var image: Image?
    @State private var loading = true
    
    var body: some View {
        ZStack {
            backgroundGradient
            
            // Content loading logic
        }
        .task { await load() }
    }
}
```

#### RiddleIntroView

**File**: `iOS/Enigmate/Views/Riddle/RiddleIntroView.swift`  
**Description**: Introduction/landing view for riddle presentation.

### Core Views

#### ContentView

**File**: `iOS/Enigmate/Views/ContentView.swift`  
**Description**: Root content view that manages app state and navigation.

##### Features
- Authentication state management
- Service initialization handling
- Deep link handling for OAuth callbacks
- Loading state management

##### Implementation

```swift
struct ContentView: View {
    @Environment(\.supabase) private var supabase
    @Environment(\.showPasswordReset) private var showPasswordReset
    @State private var session: Session? = nil

    var body: some View {
        ZStack {
            backgroundGradient
            
            Group {
                if let supabase = supabase {
                    if session == nil {
                        AuthView()        // Show auth flow
                    } else {
                        RiddleIntroView() // Show main app
                    }
                } else {
                    ProgressView("Loading...")  // Service initializing
                }
            }
        }
        .task {
            // Listen to auth state changes
            for await authSession in await supabase.authStateStream() {
                session = authSession
            }
        }
        .sheet(isPresented: showPasswordReset) {
            PasswordResetView()
        }
    }
}
```

---

## iOS Utilities

### Fonts

**File**: `iOS/Enigmate/Utilities/Fonts.swift`  
**Description**: Custom font system using SF Compact Rounded.

#### Font Extension

```swift
extension Font {
    // Main method for SF Compact Rounded
    static func sfCompactRounded(
        fontStyle: Font.TextStyle = .body,
        fontWeight: Weight = .regular,
        fontSize: CGFloat? = nil
    ) -> Font
    
    // Legacy compatibility method
    static func from(
        _ fontName: String,
        fontStyle: Font.TextStyle = .body,
        fontWeight: Weight = .regular,
        fontSize: CGFloat? = nil
    ) -> Font
}
```

#### Usage Examples

```swift
// Using text style
Text("Hello World")
    .font(.sfCompactRounded(fontStyle: .title, fontWeight: .bold))

// Using custom size
Text("Custom Size")
    .font(.sfCompactRounded(fontWeight: .medium, fontSize: 24))

// Different weights
Text("Ultra Light").font(.sfCompactRounded(fontWeight: .ultraLight))
Text("Regular").font(.sfCompactRounded(fontWeight: .regular))
Text("Bold").font(.sfCompactRounded(fontWeight: .bold))
Text("Black").font(.sfCompactRounded(fontWeight: .black))
```

#### Available Weights

```swift
enum SFCompactRounded: String {
    case ultralight = "SFCompactRounded-Ultralight"
    case thin = "SFCompactRounded-Thin"
    case light = "SFCompactRounded-Light"
    case regular = "SFCompactRounded-Regular"
    case medium = "SFCompactRounded-Medium"
    case semibold = "SFCompactRounded-Semibold"
    case bold = "SFCompactRounded-Bold"
    case heavy = "SFCompactRounded-Heavy"
    case black = "SFCompactRounded-Black"
}
```

### Shared Functions

**File**: `iOS/Enigmate/Utilities/SharedFunctions.swift`  
**Description**: Common utility functions.

#### Functions

##### `dismissKeyboard()`
Dismisses the currently active keyboard.

```swift
// Usage in any view
Button("Done") {
    dismissKeyboard()
}
```

##### `formattedDate(from: Date, locale: Locale = .current) -> String`
Formats a date into readable string format.

```swift
let today = Date()
let formatted = formattedDate(from: today)
print(formatted) // "Monday, 30 June"

// With custom locale
let frenchFormatted = formattedDate(from: today, locale: Locale(identifier: "fr_FR"))
print(frenchFormatted) // "lundi, 30 juin"
```

### Environment Integration

**File**: `iOS/Enigmate/Services/SupabaseEnvironment.swift`  
**Description**: SwiftUI environment integration for SupabaseService.

#### Environment Keys

```swift
// SupabaseService access
@Environment(\.supabase) private var supabase

// Password reset sheet state
@Environment(\.showPasswordReset) private var showPasswordReset
```

#### Setup in App

```swift
@main
struct EnigmateApp: App {
    @State private var supabaseService: SupabaseService?
    @State private var showPasswordReset = false
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.supabase, supabaseService)
                .environment(\.showPasswordReset, $showPasswordReset)
                .task {
                    // Initialize service
                    supabaseService = try await SupabaseService.create()
                }
        }
    }
}
```

---

## Database Schema

### Tables

#### `riddles`

```sql
CREATE TABLE "public"."riddles" (
    "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    "title" text NOT NULL,
    "question" text NOT NULL,
    "answer" text NOT NULL,
    "image_path" text NOT NULL,
    "release_date" date NOT NULL,
    PRIMARY KEY ("id")
);
```

**Description**: Stores daily riddles with questions, answers, and metadata.

##### Columns
- `id`: Auto-generated unique identifier
- `title`: Riddle title/name
- `question`: The riddle question text
- `answer`: The solution/answer text
- `image_path`: Path to associated image in storage
- `release_date`: Date when riddle becomes available (YYYY-MM-DD)

##### Row Level Security
- **Policy**: "Read today's riddle"
- **Rule**: `release_date <= CURRENT_DATE`
- **Effect**: Users can only read riddles released today or earlier

#### `chats`

```sql
CREATE TABLE "public"."chats" (
    "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" uuid NOT NULL,
    "riddle_id" bigint NOT NULL,
    "messages" jsonb DEFAULT '[]'::jsonb,
    "updated_at" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("user_id") REFERENCES auth.users(id),
    FOREIGN KEY ("riddle_id") REFERENCES riddles(id)
);
```

**Description**: Stores chat/conversation data between users and riddles.

##### Columns
- `id`: Auto-generated unique identifier
- `user_id`: Reference to authenticated user
- `riddle_id`: Reference to the riddle being discussed
- `messages`: JSON array of chat messages
- `updated_at`: Timestamp of last update

##### Row Level Security
- **Policy**: "User owns chat"
- **Rule**: `user_id = auth.uid()`
- **Effect**: Users can only access their own chat records

#### `scores`

```sql
CREATE TABLE "public"."scores" (
    "user_id" uuid NOT NULL,
    "riddle_id" bigint NOT NULL,
    "score" integer,
    "duration" integer,
    "msg_count" integer,
    "created_at" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("user_id", "riddle_id"),
    FOREIGN KEY ("user_id") REFERENCES auth.users(id),
    FOREIGN KEY ("riddle_id") REFERENCES riddles(id)
);
```

**Description**: Tracks user performance and scores for each riddle.

##### Columns
- `user_id`: Reference to authenticated user (part of composite primary key)
- `riddle_id`: Reference to the riddle (part of composite primary key)
- `score`: User's score for this riddle
- `duration`: Time taken to solve (in minutes)
- `msg_count`: Number of messages/attempts
- `created_at`: Timestamp when score was recorded

##### Row Level Security
- **Policy**: "User owns score"
- **Rule**: `user_id = auth.uid()`
- **Effect**: Users can only access their own score records

### Storage Buckets

#### `riddle-images`

**Description**: Stores image files associated with riddles.

**Configuration**:
- **Public**: `false` (requires authentication)
- **File size limit**: 50MB (configured in config.toml)
- **Allowed types**: Images (PNG, JPEG, etc.)

**Usage**:
```swift
// Download image data
let imageData = try await supabaseService.downloadPuzzleImageData(id: "1.png")
```

**Sample Files**:
- `1.png`: Image for riddle ID 1
- `2.png`: Image for riddle ID 2  
- `5.png`: Image for riddle ID 5

---

## Authentication System

### Authentication Flow

#### OAuth Flow (LinkedIn/Twitter)

1. **Initiate OAuth**:
   ```swift
   try await supabaseService.signInWithLinkedIn()
   ```

2. **User Redirected**: App opens web browser for OAuth provider

3. **Callback Handling**: App receives deep link callback
   ```swift
   .onOpenURL { url in
       if url.scheme == "enigmate" {
           let callbackType = try await supabaseService.handleAuthCallback(url)
       }
   }
   ```

4. **Session Created**: SupabaseService automatically updates session state

5. **UI Updates**: All registered listeners receive session update

#### Email/Password Flow

1. **Sign Up**:
   ```swift
   try await supabaseService.signUp(
       email: "user@example.com",
       password: "password123"
   )
   ```

2. **Sign In**:
   ```swift
   try await supabaseService.signIn(
       email: "user@example.com", 
       password: "password123"
   )
   ```

3. **Session Management**: Automatic token refresh and state management

### Deep Link Configuration

#### URL Schemes

- **OAuth Callback**: `enigmate://login-callback`
- **Password Reset**: `enigmate://password-reset`

#### Implementation

```swift
// In Info.plist
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>enigmate</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>enigmate</string>
        </array>
    </dict>
</array>
```

### Session Management

#### Reactive Authentication State

```swift
// Listen to all auth changes
for await session in supabaseService.authStateStream() {
    if let session = session {
        // User is logged in
        print("Logged in as: \(session.user.email)")
        showMainApp()
    } else {
        // User is logged out
        print("User logged out")
        showAuthScreen()
    }
}
```

#### Session Properties

```swift
// Access current session
if let session = await supabaseService.currentSession() {
    let user = session.user
    print("User ID: \(user.id)")
    print("Email: \(user.email)")
    print("Created: \(session.createdAt)")
    print("Expires: \(session.expiresAt)")
}
```

---

## Configuration

### Backend Configuration

**File**: `backend/supabase/config.toml`

#### Key Settings

```toml
# Project identification
project_id = "backend"

# API Configuration
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
max_rows = 1000

# Database Configuration  
[db]
port = 54322
major_version = 17

# Authentication Configuration
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600
enable_signup = true
minimum_password_length = 6

# Storage Configuration
[storage]
enabled = true
file_size_limit = "50MiB"

# Edge Functions Configuration
[functions.riddle_today]
enabled = true
verify_jwt = true
entrypoint = "./functions/riddle_today/index.ts"
```

### iOS Configuration

#### Secrets Management

**File**: `iOS/Enigmate/Services/Secrets.swift`

```swift
struct Secrets {
    static let supabaseUrl: URL = URL(string: "YOUR_SUPABASE_URL")!
    static let supabaseAnon: String = "YOUR_SUPABASE_ANON_KEY"
}
```

#### App Configuration

**File**: `iOS/Enigmate/EnigmateApp.swift`

##### Deep Link Handling

```swift
@main
struct EnigmateApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    // Handle auth callbacks
                    if url.scheme == "enigmate" {
                        // Process OAuth or password reset callbacks
                    }
                }
        }
    }
}
```

##### Service Initialization

```swift
.task {
    do {
        supabaseService = try await SupabaseService.create()
    } catch {
        logger.error("Failed to initialize Supabase: \(error.localizedDescription)")
    }
}
```

### Environment Variables

#### Development

```bash
# Supabase Configuration
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Optional: OpenAI for Supabase Studio AI features
OPENAI_API_KEY="your-openai-api-key"
```

#### Production

```bash
# Supabase Production URLs
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-production-anon-key"
```

---

## Error Handling

### Common Error Patterns

#### Authentication Errors

```swift
do {
    try await supabaseService.signIn(email: email, password: password)
} catch {
    switch error {
    case let authError as AuthError:
        // Handle specific auth errors
        handleAuthError(authError)
    default:
        // Handle generic errors
        showError("Authentication failed: \(error.localizedDescription)")
    }
}
```

#### Database Errors

```swift
do {
    let riddle = try await supabaseService.todaysRiddle()
} catch {
    // Log error for debugging
    logger.error("Failed to fetch riddle: \(error)")
    
    // Show user-friendly message
    showError("Unable to load today's riddle. Please try again.")
}
```

#### Network Errors

```swift
do {
    let imageData = try await supabaseService.downloadPuzzleImageData(id: imageId)
} catch {
    // Handle image download failures gracefully
    showPlaceholderImage()
    logger.warning("Image download failed: \(error)")
}
```

### Best Practices

1. **Always use async/await with try-catch blocks**
2. **Log errors for debugging while showing user-friendly messages**
3. **Implement fallbacks for non-critical failures**
4. **Use loading states during async operations**
5. **Validate input before making API calls**

---

## Testing

### Unit Test Examples

#### Service Testing

```swift
func testAuthenticationFlow() async throws {
    let service = try await SupabaseService.create()
    
    // Test current session when not logged in
    let initialSession = await service.currentSession()
    XCTAssertNil(initialSession)
    
    // Test sign up
    try await service.signUp(email: "test@example.com", password: "password123")
    
    // Test session after sign up
    let postSignUpSession = await service.currentSession()
    XCTAssertNotNil(postSignUpSession)
    XCTAssertEqual(postSignUpSession?.user.email, "test@example.com")
}
```

#### Model Testing

```swift
func testRiddleModel() {
    let riddle = Riddle(
        id: 1,
        title: "Test Riddle",
        date: Date(),
        question: "What is the answer?",
        answer: "42",
        image: "test.png",
        duration: 15,
        difficulty: 2,
        hint1: "Think deeply",
        hint2: nil,
        hint3: nil
    )
    
    XCTAssertEqual(riddle.getDifficultyString(), "Medium")
    XCTAssertEqual(riddle.getImageName(), "riddle-1.png")
}
```

### Integration Testing

#### API Testing

```bash
# Test riddle endpoint
curl -X POST http://127.0.0.1:54321/functions/v1/riddle_today \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

#### Database Testing

```sql
-- Test riddle query
SELECT id, question, image_path 
FROM riddles 
WHERE release_date = CURRENT_DATE;

-- Test user permissions
SELECT * FROM scores WHERE user_id = auth.uid();
```

---

This comprehensive documentation covers all public APIs, functions, and components in the Enigmate application. Each section includes practical examples, usage patterns, and best practices for implementation.