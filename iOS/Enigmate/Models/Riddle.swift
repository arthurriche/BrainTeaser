//
//  Riddle.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation

struct Riddle: Identifiable, Encodable, Decodable, Equatable {
    let id: Int
    let title: String
    let date: Date
    let question: String
    let answer: String
    let image: String
    let duration: Int? // Duration in minutes (optional since it's NULL in DB)
    let difficulty: Int? // 1: Easy, 2: Medium, 3: Hard, 4: Very Hard (optional since it's NULL in DB)
    let hint1: String?
    let hint2: String?
    let hint3: String?
    

    func getDifficultyString() -> String {
        guard let difficulty = difficulty else { return "Unknown" }
        switch difficulty {
        case 1:
            return "Novice"
        case 2:
            return "Practiced"
        case 3:
            return "Expert"
        default:
            return "Unknown"
        }
    }

    func getImageName() -> String {
        return "riddle-\(id).png"
    }
}