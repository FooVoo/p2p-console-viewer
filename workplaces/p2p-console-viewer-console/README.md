# p2p-console-viewer-console

A SvelteKit-based web console application for viewing remote console logs via peer-to-peer connections.

## Overview

`p2p-console-viewer-console` is a modern web application built with Svelte 5 and SvelteKit that provides a user interface for viewing console output from remote applications connected via P2P.  It uses the `p2p-console-viewer-lib` library for establishing WebRTC connections.

## Version

Current version: **0.0.1**

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5
- **Styling**: Tailwind CSS 4.x
- **Build Tool**: Vite
- **Language**: TypeScript
- **Deployment**: Vercel (via @sveltejs/adapter-vercel)
- **Linting**: ESLint 9 with Prettier integration

## Features

- Real-time console log viewing from remote peers
- P2P connection management using WebRTC
- Modern, responsive UI built with Tailwind CSS
- Type-safe development with TypeScript
- Hot module replacement for fast development

## Installation

```bash
# Install dependencies
npm install
```

## Usage

### Development

Start the development server:

```bash
npm run dev

# Or open in browser automatically
npm run dev -- --open
```

The application will be available at `http://localhost:5173` (or another port if 5173 is occupied).

### Building

Create a production build:

```bash
npm run build
```

### Preview

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
workplaces/p2p-console-viewer-console/
├── src/                    # Source files
│   ├── routes/            # SvelteKit routes
│   ├── lib/              # Shared components and utilities
│   └── app.html          # HTML template
├── static/                # Static assets
├── . prettierrc           # Prettier configuration
├── eslint.config.js      # ESLint configuration
├── svelte.config.js      # Svelte configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── package.json
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run prepare` - Sync SvelteKit types
- `npm run check` - Run type checking
- `npm run check:watch` - Run type checking in watch mode
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint and format check

## Development

### Prerequisites

- Node.js (v16 or higher recommended)
- npm, pnpm, or yarn

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

### Code Quality

The project uses several tools to maintain code quality:

- **ESLint**: JavaScript/TypeScript linting with Svelte support
- **Prettier**: Code formatting with Svelte and Tailwind plugins
- **TypeScript**: Type checking with strict mode enabled
- **svelte-check**:  Svelte-specific type checking

Run checks before committing:

```bash
npm run lint
npm run check
```

## Dependencies

### Core
- `p2p-console-viewer-lib@0.0.3` - Local P2P connection library
- `@sveltejs/kit@^2.47.1` - SvelteKit framework
- `svelte@^5.41.0` - Svelte 5 reactive framework

### Styling
- `tailwindcss@^4.1.14` - Utility-first CSS framework
- `@tailwindcss/vite@^4.1.14` - Vite plugin for Tailwind

### Development Tools
- `vite` - Build tool and dev server
- `typescript@^5.9.3` - TypeScript compiler
- `eslint@^9.38.0` - Linting
- `prettier@^3.6.2` - Code formatting

## Deployment

This project is configured for Vercel deployment using `@sveltejs/adapter-vercel`.

To deploy:

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Vercel will automatically build and deploy your application

For other deployment targets, you may need to install a different [adapter](https://svelte.dev/docs/kit/adapters).

## Configuration

### Tailwind CSS
Tailwind is configured via `@tailwindcss/vite` plugin in `vite.config.ts`. Custom configuration can be added as needed.

### TypeScript
TypeScript configuration is in `tsconfig.json` with strict type checking enabled.

### ESLint
ESLint is configured with:
- Svelte-specific rules
- TypeScript support
- Prettier compatibility

## Contributing

1. Follow the existing code style
2. Run `npm run format` before committing
3. Ensure `npm run lint` and `npm run check` pass
4. Test your changes with `npm run build`

## License

Private project - see package.json

## Notes

- This is a private application not intended for public distribution
- Uses a local tarball of `p2p-console-viewer-lib` for development
- Built with Svelte 5's new reactive system and runes
