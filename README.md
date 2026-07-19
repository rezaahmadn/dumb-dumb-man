# Dumb Dumb Man

A two-player strategy game built with Phaser 4, React 19, and TypeScript. Features three distinct game modes with different mechanics, AI opponents, and real-time online multiplayer over an authoritative socket.io server.

> **Note**: This project exists to test ECC (Extended Claude Code) workflows — PRD generation, planning, implementation, code review, and PR automation — end-to-end on a real codebase.

## Game Modes

### Pebble Trap (Classic Mode)
- **Players**: 2 (human vs human or human vs AI)
- **Board**: 5-vertex well board (center + cardinal directions)
- **Goal**: Trap your opponent by blocking all their moves
- **Pieces**: 2 pebbles per player
- **Movement**: Slide any distance along connecting lines
- **Win condition**: Opponent has no legal moves

### Three-in-a-Row (New Mode)
- **Players**: 2 (human vs human or human vs AI)  
- **Board**: 3×3 grid (9 vertices)
- **Goal**: Align 3 pebbles in any line (horizontal, vertical, or diagonal)
- **Pieces**: 3 pebbles per player
- **Phases**: Placement (drop pieces) then Movement (slide one step at a time)
- **Movement**: Single-step hops along adjacent vertices (no sliding)
- **Win condition**: Complete a line of 3 aligned pebbles

### Dumb Dumb Man (Clash Mode)
- **Players**: 2 (human vs human, human vs AI, or online)
- **Board**: Traditional Sixteen Soldiers board — a 5×5 Alquerque grid with triangular wings top and bottom
- **Goal**: Eliminate all of your opponent's pebbles
- **Pieces**: 16 pebbles per player, pre-placed with the centre row empty
- **Movement**: Draughts-style — step along lines or jump to capture, with chained captures; a side flying (moving any distance) once reduced to 3 or fewer pebbles
- **Win condition**: Opponent has no pebbles left

## Features

- **Multi-mode engine**: Extensible architecture supporting multiple game types
- **Online multiplayer**: Real-time 2-player play in every mode over an authoritative socket.io server — create/join rooms by code, server-validated moves, and rejoin after a disconnect
- **Smart AI**: Exact retrograde solver (small boards) plus a greedy capture-preferring AI for the 16v16 clash mode
- **Hotseat, AI & online modes**: Play locally against a friend, challenge the computer, or match up online
- **Fast development**: Hot-reloading with Vite + React
- **Fully typed**: 100% TypeScript

## Try It Out

**Play online**: [dumb-dumb-man.netlify.app](https://dumb-dumb-man.netlify.app)

---

## Development

This project is built on a Phaser + React + TypeScript template.

### Versions

This template has been updated for:

- [Phaser 4](https://github.com/phaserjs/phaser)
- [React 19.0.0](https://github.com/facebook/react)
- [Vite 6.3.1](https://github.com/vitejs/vite)
- [TypeScript 5.7.2](https://github.com/microsoft/TypeScript)

## Requirements

[Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io) 10+ are required. This is a pnpm workspace — run every command from the repo root.

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies for every workspace package |
| `pnpm dev` | Launch the web dev server (`apps/web`) |
| `pnpm build` | Build `apps/web` for production into `apps/web/dist` |
| `pnpm test` | Run every package's tests (`pnpm -r test`) |
| `pnpm typecheck` | Typecheck every package (`pnpm -r typecheck`) |

To run a command against one package only, use a filter: `pnpm --filter @pebble/engine test`.

To exercise online multiplayer locally, run the server alongside the web app with `pnpm --filter @pebble/server dev` (listens on `:3001`), and point the web app at it with `VITE_SERVER_URL=http://localhost:3001` in `apps/web/.env.local`.

## Writing Code

After cloning the repo, run `pnpm install` from the repo root. Then start the local development server with `pnpm dev`.

The local development server runs on `http://localhost:8080` by default (Vite picks the next free port if it is taken). Please see the Vite documentation if you wish to change this, or add SSL support.

Once the server is running you can edit any file under `apps/web/src` or `packages/engine/src`. Vite recompiles and reloads the browser — the engine package is consumed as TypeScript source, so no build step sits between the two.

## Project Structure

A pnpm monorepo. The split exists so that game rules are shared with the authoritative multiplayer server: `packages/engine` is pure TypeScript with no phaser, react or DOM dependency, which is what makes it importable from Node — `apps/server` imports it as the single source of game rules.

| Path                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| `packages/engine`             | **Pure game logic.** Rules, board maths, AI, mode definitions. Zero runtime deps. |
| `packages/engine/src/rules.ts`| `initialState` / `legalMoves` / `applyMove` — the single source of truth for legality. |
| `packages/engine/src/ai.ts`   | Retrograde solver (small boards: well, morris).                             |
| `packages/engine/src/aiGreedy.ts` | Greedy capture-preferring AI (used by the 16v16 clash mode).            |
| `packages/engine/src/modes/`  | Board geometry + `MODES` registry. Exposed as `@pebble/engine/modes`.       |
| `packages/protocol`           | Shared socket.io event/payload types for the client and server.             |
| `apps/server`                 | **Authoritative socket.io server.** Rooms, matchmaking, and move validation, importing `@pebble/engine` for the rules. |
| `apps/web`                    | The Phaser 4 + React client.                                               |
| `apps/web/index.html`         | A basic HTML page to contain the game.                                     |
| `apps/web/src/main.tsx`       | The main **React** entry point. This bootstraps the React application.      |
| `apps/web/src/PhaserGame.tsx` | The React component that initializes the Phaser Game and acts as a bridge between React and Phaser. |
| `apps/web/src/App.tsx`        | The main React component.                                                  |
| `apps/web/src/game/EventBus.ts` | A simple event bus to communicate between React and Phaser.              |
| `apps/web/src/game/main.ts`   | The main **game** entry point. This contains the game configuration and starts the game. |
| `apps/web/src/game/scenes/`   | The folder where Phaser Scenes are located.                                |
| `apps/web/public/style.css`   | Some simple CSS rules to help with page layout.                            |
| `apps/web/public/assets`      | Contains the static assets used by the game.                               |

### The engine boundary

`packages/engine` compiles with `lib: ["ES2020"]` and **no `DOM`** (see `packages/engine/tsconfig.json`). That is deliberate: it means a browser-only global such as `window` or `document` fails typecheck at the package boundary instead of at server runtime. Keep it that way — it is the property that lets a Node server import these rules unchanged.

## React Bridge

The `PhaserGame.tsx` component is the bridge between React and Phaser. It initializes the Phaser game and passes events between the two.

To communicate between React and Phaser, you can use the **EventBus.js** file. This is a simple event bus that allows you to emit and listen for events from both React and Phaser.

```js
// In React
import { EventBus } from './EventBus';

// Emit an event
EventBus.emit('event-name', data);

// In Phaser
// Listen for an event
EventBus.on('event-name', (data) => {
    // Do something with the data
});
```

In addition to this, the `PhaserGame` component exposes the Phaser game instance along with the most recently active Phaser Scene using React forwardRef.

Once exposed, you can access them like any regular react reference.

## Phaser Scene Handling

In Phaser, the Scene is the lifeblood of your game. It is where you sprites, game logic and all of the Phaser systems live. You can also have multiple scenes running at the same time. This template provides a way to obtain the current active scene from React.

You can get the current Phaser Scene from the component event `"current-active-scene"`. In order to do this, you need to emit the event `"current-scene-ready"` from the Phaser Scene class. This event should be emitted when the scene is ready to be used. You can see this done in all of the Scenes in our template.

**Important**: When you add a new Scene to your game, make sure you expose to React by emitting the `"current-scene-ready"` event via the `EventBus`, like this:


```ts
class MyScene extends Phaser.Scene
{
    constructor ()
    {
        super('MyScene');
    }

    create ()
    {
        // Your Game Objects and logic here

        // At the end of create method:
        EventBus.emit('current-scene-ready', this);
    }
}
```

You don't have to emit this event if you don't need to access the specific scene from React. Also, you don't have to emit it at the end of `create`, you can emit it at any point. For example, should your Scene be waiting for a network request or API call to complete, it could emit the event once that data is ready.

### React Component Example

Here's an example of how to access Phaser data for use in a React Component:

```ts
import { useRef } from 'react';
import { IRefPhaserGame } from "./game/PhaserGame";

// In a parent component
const ReactComponent = () => {

    const phaserRef = useRef<IRefPhaserGame>(); // you can access to this ref from phaserRef.current

    const onCurrentActiveScene = (scene: Phaser.Scene) => {
    
        // This is invoked

    }

    return (
        ...
        <PhaserGame ref={phaserRef} currentActiveScene={onCurrentActiveScene} />
        ...
    );

}
```

In the code above, you can get a reference to the current Phaser Game instance and the current Scene by creating a reference with `useRef()` and assign to PhaserGame component.

From this state reference, the game instance is available via `phaserRef.current.game` and the most recently active Scene via `phaserRef.current.scene`.

The `onCurrentActiveScene` callback will also be invoked whenever the the Phaser Scene changes, as long as you emit the event via the EventBus, as outlined above.

## Handling Assets

Vite supports loading assets via JavaScript module `import` statements.

This template provides support for both embedding assets and also loading them from a static folder. To embed an asset, you can import it at the top of the JavaScript file you are using it in:

```js
import logoImg from './assets/logo.png'
```

To load static files such as audio files, videos, etc place them into the `public/assets` folder. Then you can use this path in the Loader calls within Phaser:

```js
preload ()
{
    //  This is an example of an imported bundled image.
    //  Remember to import it at the top of this file
    this.load.image('logo', logoImg);

    //  This is an example of loading a static image
    //  from the public/assets folder:
    this.load.image('background', 'assets/bg.png');
}
```

When you issue the `pnpm build` command, all static assets are automatically copied to the `apps/web/dist/assets` folder.

## Deploying to Production

After you run the `pnpm build` command, your code will be built into a single bundle and saved to the `apps/web/dist` folder, along with any other assets your project imported, or stored in the public assets folder.

In order to deploy your game, you will need to upload *all* of the contents of the `apps/web/dist` folder to a public facing web server. The Netlify workflow in `.github/workflows/deploy-netlify.yml` does this on every push to `main`.

## Customizing the Template

### Vite

If you want to customize your build, such as adding plugin (i.e. for loading CSS or fonts), you can modify the `apps/web/vite/config.*.mjs` file for cross-project changes, or you can modify and/or create new configuration files and target them in specific scripts inside of `apps/web/package.json`. Please see the [Vite documentation](https://vitejs.dev/) for more information.

## About log.js

If you inspect our node scripts you will see there is a file called `log.js`. This file makes a single silent API call to a domain called `gryzor.co`. This domain is owned by Phaser Studio Inc. The domain name is a homage to one of our favorite retro games.

We send the following 3 pieces of data to this API: The name of the template being used (vue, react, etc). If the build was 'dev' or 'prod' and finally the version of Phaser being used.

At no point is any personal data collected or sent. We don't know about your project files, device, browser or anything else. Feel free to inspect the `log.js` file to confirm this.

Why do we do this? Because being open source means we have no visible metrics about which of our templates are being used. We work hard to maintain a large and diverse set of templates for Phaser developers and this is our small anonymous way to determine if that work is actually paying off, or not. In short, it helps us ensure we're building the tools for you.

However, if you don't want to send any data, you can use these commands instead:

Dev:

```bash
npm run dev-nolog
```

Build:

```bash
npm run build-nolog
```

Or, to disable the log entirely, simply delete the file `log.js` and remove the call to it in the `scripts` section of `package.json`:

Before:

```json
"scripts": {
    "dev": "node log.js dev & dev-template-script",
    "build": "node log.js build & build-template-script"
},
```

After:

```json
"scripts": {
    "dev": "dev-template-script",
    "build": "build-template-script"
},
```

Either of these will stop `log.js` from running. If you do decide to do this, please could you at least join our Discord and tell us which template you're using! Or send us a quick email. Either will be super-helpful, thank you.

## Join the Phaser Community!

We love to see what developers like you create with Phaser! It really motivates us to keep improving. So please join our community and show-off your work 😄

**Visit:** The [Phaser website](https://phaser.io) and follow on [Phaser Twitter](https://twitter.com/phaser_)<br />
**Play:** Some of the amazing games [#madewithphaser](https://twitter.com/search?q=%23madewithphaser&src=typed_query&f=live)<br />
**Learn:** [API Docs](https://newdocs.phaser.io), [Support Forum](https://phaser.discourse.group/) and [StackOverflow](https://stackoverflow.com/questions/tagged/phaser-framework)<br />
**Discord:** Join us on [Discord](https://discord.gg/phaser)<br />
**Code:** 2000+ [Examples](https://labs.phaser.io)<br />
**Read:** The [Phaser World](https://phaser.io/community/newsletter) Newsletter<br />

Created by [Phaser Studio](mailto:support@phaser.io). Powered by coffee, anime, pixels and love.

The Phaser logo and characters are &copy; 2011 - 2025 Phaser Studio Inc.

All rights reserved.
