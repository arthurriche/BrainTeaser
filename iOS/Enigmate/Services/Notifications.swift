//
//  Notifications.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation
import UserNotifications

func scheduleNotification() {
    let center = UNUserNotificationCenter.current()

    // Request permission (you should do this earlier in the app lifecycle, once)
    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
        if granted {
            let content = UNMutableNotificationContent()
            content.title = "Come back!"
            content.body = "You left the app. Tap to return."
            content.sound = .default

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 10, repeats: false)
            let request = UNNotificationRequest(identifier: "appLeftNotification", content: content, trigger: trigger)

            center.add(request)
        }
    }
}
