
# Tor Landa

Tor Landa is a modern, playful, and interactive web application for tracking and sharing weekly quality messages. Built with Next.js, TypeScript, and Notion as a backend, it features a beautiful UI, smooth animations, and a unique approach to weekly reflections.

## Features

- **Weekly Quality Tracker:** Displays a single quality message per week, fetched from a Notion database.
- **Notion Integration:** Uses Notion as a headless CMS for easy content management.
- **Animated UI:** Surrealist-inspired cards, progress bar, and fun loading/waiting states.
- **Navigation:** Browse previous and next weeks, with keyboard support and smooth transitions.
- **Responsive Design:** Works great on desktop and mobile.

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Framer Motion](https://www.framer.com/motion/) (animations)
- [Notion API](https://developers.notion.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## Getting Started

1. **Clone the repository:**
	```bash
	git clone https://github.com/mtmarctoni/tor-landa.git
	cd tor-landa
	```

2. **Install dependencies:**
	```bash
	pnpm install
	# or yarn install / npm install
	```

3. **Configure environment variables:**
	- Copy `.env.local.example` to `.env.local` and fill in your Notion API key and database ID.

4. **Run the development server:**
	```bash
	pnpm dev
	# or yarn dev / npm run dev
	```

5. **Open the app:**
	Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Notion Setup

1. Create a Notion database with columns: `Week` (number), `Year` (number), `Message` (title/text).
2. Share the database with your Notion integration and copy the database ID.
3. Add your Notion API key and database ID to `.env.local`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for improvements, bug fixes, or new features.

## License

MIT License. See [LICENSE](LICENSE) for details.
