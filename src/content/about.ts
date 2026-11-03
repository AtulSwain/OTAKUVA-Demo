/**
 * "About me" on /about (2026-11-03, owner). The section is hidden whenever
 * `paragraphs` is empty, so nothing placeholder ever shows.
 *   name        — how you want to be named on the page
 *   role        — e.g. "Founder & developer"
 *   photo       — optional; an image in /public (e.g. "/brand/about/me.jpg")
 *   paragraphs  — your story, one string per paragraph
 *   links       — optional, e.g. { label: 'Instagram', href: 'https://…' }
 */
export const ABOUT_ME: {
  name: string;
  role: string;
  photo: string | null;
  paragraphs: string[];
  links: { label: string; href: string }[];
} = {
  name: 'Atul Swain',
  role: 'Founder & software engineer',
  photo: '/brand/about/me.jpg',
  paragraphs: [
    'Hi, I’m Atul — a software engineer, and an anime fan long before that. OTAKUVA is one of my dreams: a single place where fans can keep track of everything they watch, say honestly how each episode made them feel, and find their next favourite show alongside people who love anime just as much.',
    'I’ve wanted to build it for a long time, and now I am — designing it, writing the code and looking after it myself. Every feature here started as something I wished existed while watching anime, from rating episodes one by one to getting told the moment a show I was hyped for finally premieres.',
    'OTAKUVA is still growing, and it’s made for you as much as for me. If something is broken, missing, or could be better, I’d really like to hear about it — write to support and it comes straight to me.',
  ],
  links: [],
};
