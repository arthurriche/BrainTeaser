import SwiftUI
import os.log

/// Email authentication view that handles the complete email sign-in/sign-up flow
/// with smooth transitions between different states
struct EmailAuthView: View {
    
    // MARK: - Logging
    private let logger = Logger(subsystem: "com.enigmate.app", category: "EmailAuth")
    @Environment(\.supabase) private var supabase
    @Environment(\.dismiss) private var dismiss
    
    // MARK: - State Management
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var showPassword = false
    @State private var errorMessage: String?
    @State private var validationMessage: String?
    
    // Flow state management
    @State private var authMode: AuthMode = .signIn
    @State private var isLoading = false
    
    // Validation state for visual feedback
    @State private var emailHasError = false
    @State private var passwordHasError = false
    @State private var fullNameHasError = false
    
    enum AuthMode {
        case signIn
        case signUp
    }
    
    // MARK: - Computed Properties
    
    /// Validates if the entered email has a proper format
    private var isValidEmail: Bool {
        let emailRegex = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    
    /// Returns the appropriate border color based on email validation state
    private var emailBorderColor: Color {
        return emailHasError ? Color.matchingRed.opacity(0.8) : Color.primaryText.opacity(0.8)
    }
    
    /// Validates if password meets requirements (at least 6 characters)
    private var isValidPassword: Bool {
        password.count >= 6
    }
    
    /// Validates if full name is not empty and contains only letters/spaces
    private var isValidFullName: Bool {
        !fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    /// Returns appropriate border color for password field
    private var passwordBorderColor: Color {
        return passwordHasError ? Color.matchingRed.opacity(0.8) : Color.primaryText.opacity(0.8)
    }
    
    /// Returns appropriate border color for full name field
    private var fullNameBorderColor: Color {
        return fullNameHasError ? Color.matchingRed.opacity(0.8) : Color.primaryText.opacity(0.8)
    }
    
    var body: some View {
        NavigationView {
            // Use ZStack to layer background gradient behind content
            ZStack {
                // Background gradient layer
                backgroundGradient
                
                // Content layer
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Text("Welcome to Enigmate")
                            .font(.sfCompactRounded(fontStyle: .title2, fontWeight: .bold))
                            .foregroundColor(Color.primaryText)
                        
                        Text("Enter your email to continue")
                            .font(.sfCompactRounded(fontStyle: .subheadline))
                            .foregroundColor(Color.primaryText.opacity(0.7))
                    }
                    
                    // Main content
                    VStack(spacing: 20) {
                        // Mode toggle buttons
                        HStack(spacing: 12) {
                            Button("Sign In") {
                                logger.info("User switched to Sign In mode")
                                withAnimation {
                                    authMode = .signIn
                                    clearMessages()
                                }
                            }
                            .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                            .foregroundColor(authMode == .signIn ? Color.primaryText : Color.primaryText.opacity(0.6))
                            .padding(.bottom, 4)
                            .overlay(
                                Rectangle()
                                    .frame(height: 2)
                                    .foregroundColor(authMode == .signIn ? Color.primaryText.opacity(0.5) : Color.clear)
                                    .animation(.easeInOut(duration: 0.2), value: authMode),
                                alignment: .bottom
                            )
                            
                            Button("Sign Up") {
                                logger.info("User switched to Sign Up mode")
                                withAnimation {
                                    authMode = .signUp
                                    clearMessages()
                                }
                            }
                            .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                            .foregroundColor(authMode == .signUp ? Color.primaryText : Color.primaryText.opacity(0.6))
                            .padding(.bottom, 4)
                            .overlay(
                                Rectangle()
                                    .frame(height: 2)
                                    .foregroundColor(authMode == .signUp ? Color.primaryText.opacity(0.5) : Color.clear)
                                    .animation(.easeInOut(duration: 0.2), value: authMode),
                                alignment: .bottom
                            )
                        }
                        .padding(.bottom, 8)

                        // Form fields
                        VStack(spacing: 16) {
                            // Email field (always visible)
                            emailField
                            
                            // Full name field (only for sign up)
                            if authMode == .signUp {
                                fullNameField
                                    .transition(.opacity)
                            }
                            
                            // Password field (always visible)
                            passwordField
                        }
                        .animation(.easeInOut(duration: 0.3), value: authMode)
                        
                        // Forgot password button (only shown in sign-in mode)
                        if authMode == .signIn {
                            Button("Forgot your password?") {
                                logger.info("User clicked forgot password button")
                                forgotPassword()
                                dismissKeyboard()
                            }
                            .font(.sfCompactRounded(fontStyle: .caption, fontWeight: .medium))
                            .foregroundColor(Color.primaryText.opacity(0.7))
                            .buttonStyle(.plain)
                            .disabled(isLoading)
                        }
                        
                        // Action button
                        MainButton(
                            title: isLoading ? (authMode == .signIn ? "Signing In..." : "Creating Account...") : (authMode == .signIn ? "Sign In" : "Sign Up"),
                            backgroundColor: Color.accent,
                            foregroundColor: Color.primaryText
                        ) {
                            logger.info("User clicked \(authMode == .signIn ? "Sign In" : "Sign Up") button")
                            
                            // Clear previous messages
                            clearMessages()

                            // Dismiss keyboard
                            dismissKeyboard()
                            
                            // Validate fields before proceeding
                            if validateFields() {
                                logger.info("Field validation passed for \(authMode == .signIn ? "sign in" : "sign up")")
                                if authMode == .signIn {
                                    signIn()
                                } else {
                                    signUp()
                                }
                            } else {
                                logger.warning("Field validation failed for \(authMode == .signIn ? "sign in" : "sign up")")
                            }
                        }
                        .disabled(isLoading)
                        .opacity(isLoading ? 0.6 : 1.0)
                        
                        // Error and validation messages
                        messageArea
                    }
                    .padding(.horizontal, 24)
                    
                    Spacer()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        logger.info("User cancelled authentication flow")
                        dismiss()
                    }
                    .foregroundColor(Color.primaryText)
                }
            }
            .onAppear {
                logger.info("EmailAuthView appeared")
            }
            .onDisappear {
                logger.info("EmailAuthView disappeared")
            }
        }
    }
    
    // MARK: - Form Fields
    
    private var emailField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Email")
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(Color.primaryText)
            
            TextField("", text: $email, prompt: Text("Enter your email").foregroundColor(Color.primaryText.opacity(0.5)))
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .foregroundColor(Color.primaryText)
                .font(.sfCompactRounded(fontStyle: .body))
                .foregroundStyle(Color.primaryText, Color.primaryText.opacity(0.5))
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(emailBorderColor, lineWidth: 2)
                        )
                }
        }
    }
    
    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Password")
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(Color.primaryText)
            
            HStack {
                if showPassword {
                    TextField("", text: $password, prompt: Text("Enter your password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.password)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                } else {
                    SecureField("", text: $password, prompt: Text("Enter your password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.password)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                }
                
                Button(action: { 
                    showPassword.toggle()
                    logger.debug("Password visibility toggled: \(showPassword ? "visible" : "hidden")")
                }) {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .foregroundColor(Color.primaryText.opacity(0.5))
                        .font(.sfCompactRounded(fontWeight: .medium, fontSize: 16))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(passwordBorderColor, lineWidth: 2)
                    )
            }
        }
    }
    
    private var fullNameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Full Name")
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(Color.primaryText)
            
            TextField("", text: $fullName, prompt: Text("Enter your full name").foregroundColor(Color.primaryText.opacity(0.5)))
                .textContentType(.name)
                .autocapitalization(.words)
                .foregroundColor(Color.primaryText)
                .font(.sfCompactRounded(fontStyle: .body))
                .onChange(of: fullName) { _, newValue in
                    // Filter out digits and special characters
                    let filtered = newValue.filter { $0.isLetter || $0.isWhitespace }
                    if filtered != newValue {
                        fullName = filtered
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(fullNameBorderColor, lineWidth: 2)
                        )
                }
        }
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        VStack(spacing: 12) {
            // Mode toggle buttons
            HStack(spacing: 12) {
                Button("Sign In") {
                    withAnimation {
                        authMode = .signIn
                        clearMessages()
                    }
                }
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(authMode == .signIn ? Color.primaryText : Color.primaryText.opacity(0.6))
                .padding(.bottom, 4)
                .overlay(
                    Rectangle()
                        .frame(height: 2)
                        .foregroundColor(authMode == .signIn ? Color.accent : Color.clear)
                        .animation(.easeInOut(duration: 0.2), value: authMode),
                    alignment: .bottom
                )
                
                Button("Sign Up") {
                    withAnimation {
                        authMode = .signUp
                        clearMessages()
                    }
                }
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(authMode == .signUp ? Color.primaryText : Color.primaryText.opacity(0.6))
                .padding(.bottom, 4)
                .overlay(
                    Rectangle()
                        .frame(height: 2)
                        .foregroundColor(authMode == .signUp ? Color.accent : Color.clear)
                        .animation(.easeInOut(duration: 0.2), value: authMode),
                    alignment: .bottom
                )
            }
            .padding(.bottom, 8)
            
            // Action button
            MainButton(
                title: isLoading ? (authMode == .signIn ? "Signing In..." : "Creating Account...") : (authMode == .signIn ? "Sign In" : "Sign Up"),
                backgroundColor: Color.accent,
                foregroundColor: Color.primaryText
            ) {
                // Clear previous messages
                clearMessages()
                
                
                // Validate fields before proceeding
                if validateFields() {
                    if authMode == .signIn {
                        signIn()
                    } else {
                        signUp()
                    }
                }
            }
            .disabled(isLoading)
            .opacity(isLoading ? 0.6 : 1.0)
        }
    }
    
    private var messageArea: some View {
        VStack(spacing: 8) {
            // Field validation messages
            if !fieldValidationMessages.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(fieldValidationMessages, id: \.self) { message in
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(Color.matchingRed.opacity(0.8))
                                .font(.caption)
                            Text(message)
                                .font(.sfCompactRounded(fontStyle: .caption))
                                .foregroundColor(Color.matchingRed.opacity(0.9))
                        }
                    }
                }
                .transition(.opacity)
            }
            
            // Error message
            if let errorMessage = errorMessage {
                HStack {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(Color.matchingRed.opacity(0.8))
                        .font(.caption)
                    Text(errorMessage)
                        .font(.sfCompactRounded(fontStyle: .caption))
                        .foregroundColor(Color.matchingRed.opacity(0.9))
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }
                .transition(.opacity)
            }
            
            // Validation message (email sent notification)
            if let validationMessage = validationMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color.matchingGreen.opacity(0.8))
                        .font(.caption)
                    Text(validationMessage)
                        .font(.sfCompactRounded(fontStyle: .caption))
                        .foregroundColor(Color.matchingGreen.opacity(0.9))
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }
                .transition(.opacity)
            }
        }
    }
    
    // MARK: - Validation Logic
    
    /// Validates all required fields and shows error messages if invalid
    /// Returns true if all fields are valid, false otherwise
    private func validateFields() -> Bool {
        logger.debug("Starting field validation for \(authMode == .signIn ? "sign in" : "sign up")")
        var messages: [String] = []
        
        // Reset all error states first
        emailHasError = false
        passwordHasError = false
        fullNameHasError = false
        
        // Validate email
        if email.isEmpty {
            logger.debug("Validation failed: Email is empty")
            messages.append("Email is required")
            emailHasError = true
        } else if !isValidEmail {
            logger.debug("Validation failed: Invalid email format - \(email)")
            messages.append("Please enter a valid email address")
            emailHasError = true
        } else {
            logger.debug("Email validation passed")
        }
        
        // Validate password
        if password.isEmpty {
            logger.debug("Validation failed: Password is empty")
            messages.append("Password is required")
            passwordHasError = true
        } else if !isValidPassword {
            logger.debug("Validation failed: Password too short (length: \(password.count))")
            messages.append("Password must be at least 6 characters")
            passwordHasError = true
        } else {
            logger.debug("Password validation passed")
        }
        
        // Validate full name for sign up
        if authMode == .signUp {
            if fullName.isEmpty {
                logger.debug("Validation failed: Full name is empty")
                messages.append("Full name is required")
                fullNameHasError = true
            } else if !isValidFullName {
                logger.debug("Validation failed: Invalid full name format")
                messages.append("Please enter a valid full name")
                fullNameHasError = true
            } else {
                logger.debug("Full name validation passed")
            }
        }
        
        // Show validation messages if any
        if !messages.isEmpty {
            logger.info("Field validation failed with \(messages.count) errors")
            errorMessage = messages.joined(separator: "\n")
            return false
        }
        
        logger.info("All field validations passed")
        return true
    }
    
    /// Returns validation messages for display (empty since we validate on button press)
    private var fieldValidationMessages: [String] {
        return [] // No real-time validation messages
    }
    
    // MARK: - Authentication Logic
    
    /// Handle sign-in for existing users
    private func signIn() {
        guard !email.isEmpty && !password.isEmpty else { 
            logger.error("Sign in attempted with empty credentials")
            return 
        }
        
        logger.info("Starting sign in process for email: \(email)")
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                logger.debug("Attempting to sign in with Supabase")
                try await supabase?.signIn(email: email, password: password)
                logger.info("Sign in successful for email: \(email)")
                await MainActor.run {
                    isLoading = false
                    dismiss()
                }
            } catch {
                logger.error("Sign in failed for email: \(email) - Error: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    /// Handle sign-up for new users
    private func signUp() {
        guard !email.isEmpty && !password.isEmpty && !fullName.isEmpty else { 
            logger.error("Sign up attempted with missing required fields")
            return 
        }
        
        logger.info("Starting sign up process for email: \(email), full name: \(fullName)")
        isLoading = true
        errorMessage = nil
        validationMessage = nil
        
        Task {
            do {
                logger.debug("Attempting to sign up with Supabase")
                try await supabase?.signUp(email: email, password: password, data: ["full_name": .string(fullName)])
                logger.info("Sign up successful for email: \(email)")
                await MainActor.run {
                    isLoading = false
                    validationMessage = "A verification email has been sent to \(email).\nIf you didn’t receive it, you may already have an account."
                    clearFields()
                }
            } catch {
                logger.error("Sign up failed for email: \(email) - Error: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    /// Handle forgot password functionality
    private func forgotPassword() {
        // Validate that email is entered and valid before proceeding
        guard !email.isEmpty else {
            logger.warning("Forgot password attempted with empty email")
            errorMessage = "Please enter your email address first"
            return
        }
        
        guard isValidEmail else {
            logger.warning("Forgot password attempted with invalid email: \(email)")
            errorMessage = "Please enter a valid email address"
            emailHasError = true
            return
        }
        
        logger.info("Starting forgot password process for email: \(email)")
        isLoading = true
        errorMessage = nil
        validationMessage = nil
        emailHasError = false
        
        Task {
            do {
                logger.debug("Attempting to reset password with Supabase for email: \(email)")
                try await supabase?.resetPassword(email: email)
                logger.info("Password reset initiated successfully for email: \(email)")
                await MainActor.run {
                    isLoading = false
                    validationMessage = "If an account exists for \(email), you will receive password reset instructions via email."
                }
            } catch {
                logger.error("Password reset failed for email: \(email) - Error: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = "Failed to send password reset email: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    /// Clear form fields
    private func clearFields() {
        logger.debug("Clearing form fields")
        password = ""
        fullName = ""
        showPassword = false
        errorMessage = nil
        // Don't clear validationMessage here as it might contain success messages
    }
    
    /// Clear error and validation messages
    private func clearMessages() {
        logger.debug("Clearing error and validation messages")
        errorMessage = nil
        validationMessage = nil
        // Reset visual error states
        emailHasError = false
        passwordHasError = false
        fullNameHasError = false
    }
} 

