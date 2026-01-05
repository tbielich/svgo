# svgo

Optimize SVGs from `src` into `dist` using the project's `svgo.mjs` and `svgo.config.js`.

## Setup

```bash
npm install
```

## Optimize SVGs

```bash
npm run optimize:svgs
```

This also renames the optimized files in `dist` to slug-style names.

Set output dimensions:

```bash
npm run optimize:svgs -- --size 48
```

Or set width/height separately:

```bash
npm run optimize:svgs -- --width 48 --height 48
```

Configure canvas size and inner padding (default: 64 and 2):

```bash
npm run optimize:svgs -- --canvas 64 --padding 2
```

## Rename SVGs

```bash
npm run rename:svgs
```

Optional custom folder:

```bash
npm run rename:svgs -- path/to/folder
```

Ignored files:

Add glob patterns to `.svgo-ignore` to skip specific SVGs.
