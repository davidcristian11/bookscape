import { faker } from "@faker-js/faker";

const genres = [
  "Fantasy",
  "Sci-Fi",
  "Mystery",
  "Romance",
  "Thriller",
  "Dystopian",
  "Classic",
  "Adventure",
  "Historical Fiction",
  "Horror",
];

const statuses = ["to-read", "reading", "finished"];

const titlePrefixes = [
  "The Silent",
  "Shadow of",
  "Beyond",
  "Whispers of",
  "Return to",
  "The Lost",
  "Echoes of",
  "Rise of",
  "The Hidden",
  "Dreams of",
];

const titleSuffixes = [
  "Empire",
  "Forest",
  "Stars",
  "Library",
  "River",
  "Labyrinth",
  "City",
  "Chronicle",
  "Flame",
  "Kingdom",
];

function buildFakeTitle() {
  const prefix = faker.helpers.arrayElement(titlePrefixes);
  const suffix = faker.helpers.arrayElement(titleSuffixes);
  return `${prefix} ${suffix}`;
}

function buildFakeBook() {
  return {
    title: buildFakeTitle(),
    author: faker.person.fullName(),
    genre: faker.helpers.arrayElement(genres),
    year: faker.number.int({ min: 1950, max: new Date().getFullYear() }),
    status: faker.helpers.arrayElement(statuses),
    rating: faker.number.int({ min: 1, max: 5 }),
    cover_url: null,
  };
}

export function buildFakeBooks(count = 5) {
  return Array.from({ length: count }, () => buildFakeBook());
}