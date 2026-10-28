// Practice bank for the PTE Academic speaking tasks.
// Timings follow the real test: prep = seconds before the mic opens,
// record = maximum answer length in seconds.

export const TASKS = {
  "read-aloud": {
    name: "Read Aloud",
    prep: 35,
    record: 40,
    instructions:
      "Look at the text below. You have 35 seconds to read it silently, then read it aloud as naturally and clearly as possible.",
  },
  "repeat-sentence": {
    name: "Repeat Sentence",
    prep: 0,
    record: 15,
    instructions:
      "You will hear a sentence. Repeat the sentence exactly as you hear it. You will hear the sentence only once.",
  },
  "describe-image": {
    name: "Describe Image",
    prep: 25,
    record: 40,
    instructions:
      "Look at the image below. In 25 seconds, prepare to speak. Then describe in detail what the image is showing. You have 40 seconds.",
  },
  "retell-lecture": {
    name: "Re-tell Lecture",
    prep: 10,
    record: 40,
    instructions:
      "You will hear a short lecture. After it finishes you have 10 seconds to prepare, then 40 seconds to re-tell the lecture in your own words.",
  },
  "answer-short-question": {
    name: "Answer Short Question",
    prep: 0,
    record: 10,
    instructions:
      "You will hear a question. Please give a simple and short answer. Often just one or a few words is enough.",
  },
};

export const QUESTIONS = [
  // Read Aloud
  {
    id: "ra-1",
    task: "read-aloud",
    text: "The rapid growth of urban populations has placed enormous pressure on public transport systems. City planners are increasingly turning to data from mobile phones and smart cards to understand how people move, allowing them to design routes that reduce congestion and travel time.",
  },
  {
    id: "ra-2",
    task: "read-aloud",
    text: "Photosynthesis is the process by which green plants convert light energy into chemical energy. Using carbon dioxide from the air and water from the soil, plants produce glucose and release oxygen as a by-product, sustaining almost all life on Earth.",
  },
  {
    id: "ra-3",
    task: "read-aloud",
    text: "Many universities now offer flexible study options, including part-time and online degrees. These programs allow students to balance their education with work and family commitments, although some critics argue that remote learning reduces opportunities for collaboration.",
  },
  {
    id: "ra-4",
    task: "read-aloud",
    text: "Archaeologists working in the region have uncovered pottery fragments dating back more than four thousand years. The discovery suggests that the settlement was a significant centre of trade, connecting coastal communities with farming villages further inland.",
  },

  // Repeat Sentence
  { id: "rs-1", task: "repeat-sentence", text: "The library will be closed for renovations during the summer break." },
  { id: "rs-2", task: "repeat-sentence", text: "Students must submit their assignments through the online portal before midnight." },
  { id: "rs-3", task: "repeat-sentence", text: "The professor recommended reading the first three chapters before the seminar." },
  { id: "rs-4", task: "repeat-sentence", text: "Climate scientists have recorded a steady rise in ocean temperatures." },
  { id: "rs-5", task: "repeat-sentence", text: "Please collect your student identification card from the administration office." },

  // Describe Image
  {
    id: "di-1",
    task: "describe-image",
    image: "bar",
    title: "Annual rainfall by city (mm)",
    data: [
      ["London", 690],
      ["Sydney", 1210],
      ["Cairo", 25],
      ["Mumbai", 2200],
      ["Tokyo", 1530],
    ],
    keyPoints:
      "Bar chart titled 'Annual rainfall by city (mm)'. Mumbai has the highest rainfall at about 2200 mm. Tokyo is second at about 1530 mm, then Sydney at about 1210 mm and London at about 690 mm. Cairo has by far the lowest at about 25 mm. Conclusion: rainfall varies enormously between cities, with the tropical/monsoon city Mumbai receiving nearly 90 times more than desert city Cairo.",
  },
  {
    id: "di-2",
    task: "describe-image",
    image: "line",
    title: "Smartphone ownership among adults (%)",
    data: [
      ["2012", 35],
      ["2014", 52],
      ["2016", 68],
      ["2018", 77],
      ["2020", 85],
      ["2022", 89],
    ],
    keyPoints:
      "Line graph titled 'Smartphone ownership among adults (%)' from 2012 to 2022. Ownership rose steadily from 35% in 2012 to 89% in 2022. The fastest growth was between 2012 and 2016 (35% to 68%). Growth slowed after 2018, levelling off near 85-89%. Conclusion: smartphone ownership more than doubled over the decade and is approaching saturation.",
  },
  {
    id: "di-3",
    task: "describe-image",
    image: "pie",
    title: "Household energy use by category",
    data: [
      ["Heating", 42],
      ["Water heating", 18],
      ["Appliances", 22],
      ["Lighting", 8],
      ["Cooking", 10],
    ],
    keyPoints:
      "Pie chart titled 'Household energy use by category'. Heating is the largest share at 42%. Appliances are 22% and water heating 18%. Cooking is 10% and lighting is the smallest at 8%. Conclusion: heating-related uses (space and water heating) together account for 60% of household energy, so they are the main opportunity for savings.",
  },

  // Re-tell Lecture
  {
    id: "rl-1",
    task: "retell-lecture",
    title: "Sleep and memory",
    text: "Today I want to talk about the relationship between sleep and memory. For a long time, people thought sleep was simply a period of rest for the brain. However, research over the last few decades has shown that sleep plays an active role in consolidating memories. During deep sleep, the brain replays experiences from the day, strengthening the connections between neurons. In one well-known study, students who slept after learning a list of words remembered significantly more the following day than students who stayed awake. Interestingly, the type of memory matters too. Deep sleep seems especially important for facts, while dream sleep, or REM sleep, appears to help with skills and emotional memories. So the practical message for students is clear: staying up all night before an exam may actually hurt your performance.",
  },
  {
    id: "rl-2",
    task: "retell-lecture",
    title: "Urban heat islands",
    text: "Let's look at a phenomenon called the urban heat island effect. Cities are often several degrees warmer than the surrounding countryside, especially at night. There are a few reasons for this. First, materials like concrete and asphalt absorb heat during the day and release it slowly after sunset. Second, cities have fewer trees and less vegetation, which normally cool the air through evaporation. Third, cars, air conditioners and factories all produce waste heat. This extra warmth is not just uncomfortable. It increases energy demand for cooling, worsens air pollution, and during heatwaves it can be dangerous for elderly people. Fortunately, there are solutions. Planting trees, creating green roofs, and using lighter coloured materials that reflect sunlight can all reduce temperatures significantly.",
  },
  {
    id: "rl-3",
    task: "retell-lecture",
    title: "The invention of the printing press",
    text: "The printing press, developed by Johannes Gutenberg around 1440, is often described as one of the most important inventions in human history. Before it, books were copied by hand, usually by monks, which made them extremely expensive and rare. Gutenberg's key innovation was movable metal type, which allowed pages to be composed quickly and printed in large numbers. Within fifty years, millions of books had been printed across Europe. The consequences were enormous. Literacy rates rose, scientific ideas could be shared and checked by scholars in different countries, and religious and political debates reached a much wider audience. Some historians argue that without the printing press, neither the scientific revolution nor the Reformation would have happened in the way they did.",
  },

  // Answer Short Question
  { id: "asq-1", task: "answer-short-question", text: "What do we call a doctor who treats children?", answers: ["paediatrician", "pediatrician"] },
  { id: "asq-2", task: "answer-short-question", text: "How many days are there in a leap year?", answers: ["366", "three hundred and sixty six", "three hundred sixty six"] },
  { id: "asq-3", task: "answer-short-question", text: "What instrument is used to measure temperature?", answers: ["thermometer"] },
  { id: "asq-4", task: "answer-short-question", text: "Which planet is known as the Red Planet?", answers: ["mars"] },
  { id: "asq-5", task: "answer-short-question", text: "What is the frozen form of water called?", answers: ["ice"] },
  { id: "asq-6", task: "answer-short-question", text: "If today is Monday, what day was it yesterday?", answers: ["sunday"] },
];

export function getQuestion(id) {
  return QUESTIONS.find((q) => q.id === id);
}
