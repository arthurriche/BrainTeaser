//
//  RiddleTimer.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation
import Combine

/// A reusable timer class for managing riddle countdown functionality
@MainActor
// Replace with @Observable
class RiddleTimer: ObservableObject {
    
    // MARK: - Published Properties
    @Published var timeRemaining: TimeInterval = 0
    @Published var totalDuration: TimeInterval = 0
    @Published var isActive = false
    @Published var isFinished = false
    
    // MARK: - Private Properties
    private var timer: Timer?
    
    // MARK: - Computed Properties
    
    /// Returns the percentage of time remaining (0.0 to 1.0)
    var timePercentage: Double {
        guard totalDuration > 0 else { return 1.0 }
        return timeRemaining / totalDuration
    }
    
    /// Returns true if time remaining is at or below 10%
    var isLowTime: Bool {
        return timePercentage <= 0.1
    }
    
    /// Returns formatted time string (MM:SS)
    var formattedTime: String {
        let minutes = Int(timeRemaining) / 60
        let seconds = Int(timeRemaining) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    // MARK: - Public Methods
    
    /// Starts the timer with the specified duration in minutes
    /// - Parameter durationInMinutes: The total duration in minutes
    func start(durationInMinutes: Int) {
        stop() // Stop any existing timer
        
        totalDuration = TimeInterval(durationInMinutes * 60)
        timeRemaining = totalDuration
        isActive = true
        isFinished = false
        
        startTimer()
    }
    
    /// Pauses the timer
    func pause() {
        timer?.invalidate()
        timer = nil
        isActive = false
    }
    
    /// Resumes the timer if it was paused
    func resume() {
        guard !isFinished && timeRemaining > 0 else { return }
        isActive = true
        startTimer()
    }
    
    /// Stops the timer completely and resets state
    func stop() {
        timer?.invalidate()
        timer = nil
        isActive = false
        timeRemaining = 0
        totalDuration = 0
        isFinished = false
    }
    
    /// Adds additional time to the current timer
    /// - Parameter additionalMinutes: Additional minutes to add
    func addTime(additionalMinutes: Int) {
        let additionalTime = TimeInterval(additionalMinutes * 60)
        timeRemaining += additionalTime
        totalDuration += additionalTime
    }
    
    // MARK: - Private Methods
    
    /// Starts the internal timer
    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tick()
            }
        }
    }
    
    /// Called every second to update the timer
    private func tick() {
        guard isActive && timeRemaining > 0 else {
            finishTimer()
            return
        }
        
        timeRemaining -= 1
    }
    
    /// Handles timer completion
    private func finishTimer() {
        timer?.invalidate()
        timer = nil
        isActive = false
        isFinished = true
        timeRemaining = 0
    }
    
    // MARK: - Lifecycle
    
    deinit {
        timer?.invalidate()
    }
}