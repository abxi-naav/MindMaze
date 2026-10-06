/**
 * MINDMAZE - 20 Official Quiz Questions
 * TANTRA 2026 | Presented by ENIGMA
 * 
 * Note: Each option is defined clearly. Shuffling algorithm will randomize
 * option order dynamically, while matching the correct answer by value.
 */

const MINDMAZE_QUESTIONS = [
  {
    id: 1,
    category: "Logical Puzzles",
    question: "A person walks 5 km north, then 3 km east, then 5 km south. How far are they from the starting point?",
    options: ["3 km", "5 km", "8 km", "13 km"],
    answer: "3 km"
  },
  {
    id: 2,
    category: "Technology",
    question: "Which technology allows smartphones to determine their position using signals from multiple satellites?",
    options: ["LiDAR", "GPS", "NFC", "RFID"],
    answer: "GPS"
  },
  {
    id: 3,
    category: "Logical Puzzles",
    question: "If all Bloops are Razzies and no Razzies are Lazzies, which statement must be true?",
    options: ["Some Bloops are Lazzies", "No Bloops are Lazzies", "All Lazzies are Bloops", "All Razzies are Bloops"],
    answer: "No Bloops are Lazzies"
  },
  {
    id: 4,
    category: "Technology",
    question: "Which HTTP status code means \"Too Many Requests\"?",
    options: ["401", "403", "404", "429"],
    answer: "429"
  },
  {
    id: 5,
    category: "Logical Puzzles",
    question: "A farmer has chickens and cows. There are 35 heads and 94 legs in total. How many cows are there?",
    options: ["10", "12", "17", "19"],
    answer: "12"
  },
  {
    id: 6,
    category: "General Knowledge",
    question: "Which country has the largest number of time zones when its overseas territories are included?",
    options: ["Russia", "United States", "France", "China"],
    answer: "France"
  },
  {
    id: 7,
    category: "Technology",
    question: "Which technology enables devices to communicate over very short distances by bringing them close together?",
    options: ["NFC", "GPS", "Li-Fi", "DSL"],
    answer: "NFC"
  },
  {
    id: 8,
    category: "Logical Puzzles",
    question: "What comes next?\n\n2, 6, 12, 20, 30, ?",
    options: ["36", "40", "42", "44"],
    answer: "42"
  },
  {
    id: 9,
    category: "Technology",
    question: "Which AI technique is primarily used to allow computers to learn patterns from data without being explicitly programmed for every rule?",
    options: ["Machine Learning", "Compilation", "Encryption", "Virtualization"],
    answer: "Machine Learning"
  },
  {
    id: 10,
    category: "Technology",
    question: "In 5G technology, what does mmWave refer to?",
    options: ["Millimetre-wave frequency bands", "Multi-mode wireless encoding", "Mobile memory wave technology", "Maximum wireless bandwidth"],
    answer: "Millimetre-wave frequency bands"
  },
  {
    id: 11,
    category: "General Knowledge",
    question: "Which is the deepest known point in Earth's oceans?",
    options: ["Puerto Rico Trench", "Tonga Trench", "Challenger Deep", "Java Trench"],
    answer: "Challenger Deep"
  },
  {
    id: 12,
    category: "Technology",
    question: "Which data structure is primarily used to implement BFS?",
    options: ["Stack", "Heap", "Linked List", "Queue"],
    answer: "Queue"
  },
  {
    id: 13,
    category: "Logical Puzzles",
    question: "12 balls look identical. One ball is either heavier OR lighter than the others. You have a balance scale and can use it exactly 3 times.\n\nWhat is the maximum number of balls you can always identify as the odd ball and determine whether it is heavier or lighter?",
    options: ["8", "10", "12", "14"],
    answer: "12"
  },
  {
    id: 14,
    category: "General Knowledge",
    question: "Which country was formerly known as Abyssinia?",
    options: ["Ethiopia", "Eritrea", "Somalia", "Sudan"],
    answer: "Ethiopia"
  },
  {
    id: 15,
    category: "General Knowledge",
    question: "What is the name of the boundary around a black hole beyond which nothing, including light, can escape?",
    options: ["Singularity", "Accretion disk", "Event horizon", "Photon sphere"],
    answer: "Event horizon"
  },
  {
    id: 16,
    category: "Technology",
    question: "Which layer of the OSI model is responsible for routing packets?",
    options: ["Transport", "Session", "Network", "Data Link"],
    answer: "Network"
  },
  {
    id: 17,
    category: "Technology",
    question: "Which attack attempts to overwhelm a server with a huge number of requests?",
    options: ["Phishing", "SQL Injection", "DDoS", "Brute-force attack"],
    answer: "DDoS"
  },
  {
    id: 18,
    category: "General Knowledge",
    question: "Which country is known as the \"Land of the Rising Sun\"?",
    options: ["China", "Japan", "South Korea", "Thailand"],
    answer: "Japan"
  },
  {
    id: 19,
    category: "Technology",
    question: "Which material is commonly used as the semiconductor material in solar photovoltaic cells?",
    options: ["Silicon", "Copper", "Aluminium", "Iron"],
    answer: "Silicon"
  },
  {
    id: 20,
    category: "General Knowledge",
    question: "In a galvanic cell, which electrode is negatively charged?",
    options: ["Cathode", "Anode", "Salt bridge", "Both electrodes"],
    answer: "Anode"
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MINDMAZE_QUESTIONS;
}
