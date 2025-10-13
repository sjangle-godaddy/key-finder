# Property Value Finder

A smart tool to extract property values from various data formats including JSON, URLs, query strings, and key-value pairs.

## Features

- 🔍 Extract values from JSON objects (supports dot notation paths)
- 🌐 Parse URL query parameters
- 📝 Handle key-value pairs in multiple formats
- 🎨 Modern, responsive UI built with Next.js and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm (installed automatically via `npm install -g pnpm`)

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to GitHub Pages

This project is configured to automatically deploy to GitHub Pages when you push to the `main` branch.

### Setup Steps

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - The workflow will automatically trigger and deploy your site

3. **Access Your Site:**
   - Once deployed, your site will be available at:
     `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### Manual Deployment

If you prefer to deploy manually:

```bash
# Build the static site
pnpm build

# The static files will be in the 'out' directory
# You can then deploy these files to any static hosting service
```

## Usage

1. Enter the property key you want to find (e.g., `eid`, `user.id`)
2. Paste your data (JSON, URL, query string, or key-value pairs)
3. Click **Search** or press **Cmd/Ctrl+Enter**
4. The extracted value will be displayed

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [React 19](https://react.dev/) - UI library
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - Headless UI components
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## License

MIT

