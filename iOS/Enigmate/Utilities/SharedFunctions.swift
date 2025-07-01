//
//  SharedFunctions.swift
//  Enigmate
//
//  Created by Clément Maubon on 27/04/2025.
//

import SwiftUI

// Implements behavior for keyboard dismissal
func dismissKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}

/// Formats a date into a string (e.g. "Monday, 30 June")
func formattedDate(from date: Date, locale: Locale = .current) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.dateFormat = "EEEE, d MMMM"
    return formatter.string(from: date)
}