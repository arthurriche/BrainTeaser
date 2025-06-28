//
//  Riddle.swift
//  Enigmate
//
//  Created by Clément Maubon on 26/06/2025.
//

import Foundation

struct Riddle: Identifiable, Decodable, Equatable {
    let id: UUID
    let date: Date
    let imageUrl: String
    let prompt: String
}