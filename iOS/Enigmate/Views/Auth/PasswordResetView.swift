import SwiftUI
import os.log

/// Password reset view that handles updating user's password after clicking reset link
/// Follows the same layout and styling as EmailAuthView for consistency
struct PasswordResetView: View {
    
    // MARK: - Logging
    private let logger = Logger(subsystem: "com.enigmate.app", category: "PasswordReset")
    @Environment(\.supabase) private var supabase
    @Environment(\.dismiss) private var dismiss
    
    // MARK: - State Management
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false
    @State private var errorMessage: String?
    @State private var validationMessage: String?
    @State private var isLoading = false
    
    // Validation state for visual feedback
    @State private var newPasswordHasError = false
    @State private var confirmPasswordHasError = false
    
    // MARK: - Computed Properties
    
    /// Validates if password meets requirements (at least 6 characters)
    private var isValidPassword: Bool {
        newPassword.count >= 6
    }
    
    /// Validates if passwords match
    private var passwordsMatch: Bool {
        newPassword == confirmPassword && !confirmPassword.isEmpty
    }
    
    /// Returns appropriate border color for new password field
    private var newPasswordBorderColor: Color {
        return newPasswordHasError ? Color.matchingRed.opacity(0.8) : Color.primaryText.opacity(0.8)
    }
    
    /// Returns appropriate border color for confirm password field
    private var confirmPasswordBorderColor: Color {
        return confirmPasswordHasError ? Color.matchingRed.opacity(0.8) : Color.primaryText.opacity(0.8)
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
                        Text("Reset Your Password")
                            .font(.sfCompactRounded(fontStyle: .title2, fontWeight: .bold))
                            .foregroundColor(Color.primaryText)
                        
                        Text("Enter your new password below")
                            .font(.sfCompactRounded(fontStyle: .subheadline))
                            .foregroundColor(Color.primaryText.opacity(0.7))
                    }
                    
                    // Main content
                    VStack(spacing: 20) {
                        // Form fields
                        VStack(spacing: 16) {
                            // New password field
                            newPasswordField
                            
                            // Confirm password field
                            confirmPasswordField
                        }
                        
                        // Reset password button
                        AuthButton(
                            title: isLoading ? "Updating Password..." : "Update Password",
                            backgroundColor: Color.accent,
                            foregroundColor: Color.primaryText
                        ) {
                            logger.info("User clicked Update Password button")
                            
                            // Clear previous messages
                            clearMessages()
                            
                            // Dismiss keyboard
                            dismissKeyboard()
                            
                            // Validate fields before proceeding
                            if validateFields() {
                                logger.info("Field validation passed for password reset")
                                updatePassword()
                            } else {
                                logger.warning("Field validation failed for password reset")
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
                        logger.info("User cancelled password reset flow")
                        dismiss()
                    }
                    .foregroundColor(Color.primaryText)
                }
            }
            .onAppear {
                logger.info("PasswordResetView appeared")
            }
            .onDisappear {
                logger.info("PasswordResetView disappeared")
            }
        }
    }
    
    // MARK: - Form Fields
    
    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("New Password")
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(Color.primaryText)
            
            HStack {
                if showNewPassword {
                    TextField("", text: $newPassword, prompt: Text("Enter your new password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.newPassword)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                } else {
                    SecureField("", text: $newPassword, prompt: Text("Enter your new password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.newPassword)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                }
                
                Button(action: { 
                    showNewPassword.toggle()
                    logger.debug("New password visibility toggled: \(showNewPassword ? "visible" : "hidden")")
                }) {
                    Image(systemName: showNewPassword ? "eye.slash" : "eye")
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
                            .stroke(newPasswordBorderColor, lineWidth: 2)
                    )
            }
        }
    }
    
    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Confirm New Password")
                .font(.sfCompactRounded(fontStyle: .subheadline, fontWeight: .medium))
                .foregroundColor(Color.primaryText)
            
            HStack {
                if showConfirmPassword {
                    TextField("", text: $confirmPassword, prompt: Text("Confirm your new password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.newPassword)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                } else {
                    SecureField("", text: $confirmPassword, prompt: Text("Confirm your new password").foregroundColor(Color.primaryText.opacity(0.5)))
                        .textContentType(.newPassword)
                        .foregroundColor(Color.primaryText)
                        .font(.sfCompactRounded(fontStyle: .body))
                }
                
                Button(action: { 
                    showConfirmPassword.toggle()
                    logger.debug("Confirm password visibility toggled: \(showConfirmPassword ? "visible" : "hidden")")
                }) {
                    Image(systemName: showConfirmPassword ? "eye.slash" : "eye")
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
                            .stroke(confirmPasswordBorderColor, lineWidth: 2)
                    )
            }
        }
    }
    
    private var messageArea: some View {
        VStack(spacing: 8) {
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
            
            // Validation message (success notification)
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
        logger.debug("Starting field validation for password reset")
        var messages: [String] = []
        
        // Reset all error states first
        newPasswordHasError = false
        confirmPasswordHasError = false
        
        // Validate new password
        if newPassword.isEmpty {
            logger.debug("Validation failed: New password is empty")
            messages.append("New password is required")
            newPasswordHasError = true
        } else if !isValidPassword {
            logger.debug("Validation failed: New password too short (length: \(newPassword.count))")
            messages.append("Password must be at least 6 characters")
            newPasswordHasError = true
        } else {
            logger.debug("New password validation passed")
        }
        
        // Validate confirm password
        if confirmPassword.isEmpty {
            logger.debug("Validation failed: Confirm password is empty")
            messages.append("Please confirm your password")
            confirmPasswordHasError = true
        } else if !passwordsMatch {
            logger.debug("Validation failed: Passwords do not match")
            messages.append("Passwords do not match")
            confirmPasswordHasError = true
            newPasswordHasError = true
        } else {
            logger.debug("Confirm password validation passed")
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
    
    // MARK: - Password Update Logic
    
    /// Handle password update
    private func updatePassword() {
        guard !newPassword.isEmpty && passwordsMatch else { 
            logger.error("Password update attempted with invalid data")
            return 
        }
        
        logger.info("Starting password update process")
        isLoading = true
        errorMessage = nil
        validationMessage = nil
        
        Task {
            do {
                logger.debug("Attempting to update password with Supabase")
                try await supabase?.updatePassword(newPassword: newPassword)
                logger.info("Password update successful")
                await MainActor.run {
                    isLoading = false
                    validationMessage = "Your password has been updated successfully!"
                    clearFields()
                    
                    // Automatically dismiss after showing success message
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        dismiss()
                    }
                }
                dismiss()
            } catch {
                logger.error("Password update failed - Error: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = "Failed to update password: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    /// Clear form fields
    private func clearFields() {
        logger.debug("Clearing form fields")
        newPassword = ""
        confirmPassword = ""
        showNewPassword = false
        showConfirmPassword = false
        errorMessage = nil
        // Don't clear validationMessage here as it might contain success messages
    }
    
    /// Clear error and validation messages
    private func clearMessages() {
        logger.debug("Clearing error and validation messages")
        errorMessage = nil
        validationMessage = nil
        // Reset visual error states
        newPasswordHasError = false
        confirmPasswordHasError = false
    }
} 