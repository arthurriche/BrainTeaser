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