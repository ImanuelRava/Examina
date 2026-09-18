/**
 * Seeds one demo exam so the platform can be tried immediately.
 * Run: bun run scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.exam.count()
  if (existing > 0) {
    console.log(`Skipped: ${existing} exam(s) already exist.`)
    return
  }

  const exam = await prisma.exam.create({
    data: {
      title: 'General Knowledge - Demo Exam',
      description:
        'A quick 5-question demo so you can try the full flow: take the exam and get your instant report card.',
      questions: {
        create: [
          {
            order: 1,
            text: 'What is the capital of France?',
            optionsJson: JSON.stringify([
              { key: 'A', text: 'Berlin' },
              { key: 'B', text: 'Madrid' },
              { key: 'C', text: 'Paris' },
              { key: 'D', text: 'Rome' },
            ]),
            correctAnswer: 'C',
            explanation: 'Paris has been the capital of France since the 10th century.',
          },
          {
            order: 2,
            text: 'Which planet is known as the Red Planet?',
            optionsJson: JSON.stringify([
              { key: 'A', text: 'Venus' },
              { key: 'B', text: 'Mars' },
              { key: 'C', text: 'Jupiter' },
              { key: 'D', text: 'Saturn' },
            ]),
            correctAnswer: 'B',
            explanation: 'Iron oxide on its surface gives Mars its reddish appearance.',
          },
          {
            order: 3,
            text: 'How many continents are there on Earth?',
            optionsJson: JSON.stringify([
              { key: 'A', text: '5' },
              { key: 'B', text: '6' },
              { key: 'C', text: '7' },
              { key: 'D', text: '8' },
            ]),
            correctAnswer: 'C',
            explanation: 'Africa, Antarctica, Asia, Europe, North America, Oceania, South America.',
          },
          {
            order: 4,
            text: 'Who wrote the play "Romeo and Juliet"?',
            optionsJson: JSON.stringify([
              { key: 'A', text: 'Charles Dickens' },
              { key: 'B', text: 'William Shakespeare' },
              { key: 'C', text: 'Mark Twain' },
              { key: 'D', text: 'Jane Austen' },
            ]),
            correctAnswer: 'B',
            explanation: 'It was written by William Shakespeare in the early 1590s.',
          },
          {
            order: 5,
            text: 'What is the largest ocean on Earth?',
            optionsJson: JSON.stringify([
              { key: 'A', text: 'Atlantic Ocean' },
              { key: 'B', text: 'Indian Ocean' },
              { key: 'C', text: 'Arctic Ocean' },
              { key: 'D', text: 'Pacific Ocean' },
            ]),
            correctAnswer: 'D',
            explanation: 'The Pacific covers about one third of the Earth\u2019s surface.',
          },
        ],
      },
    },
  })

  console.log(`Seeded demo exam: ${exam.title} (${exam.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
