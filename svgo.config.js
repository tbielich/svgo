// svgo.config.js
const { detachNodeFromParent } = require('svgo/lib/xast.js');

const WHITE_FILL_RE = /^(#fff|#ffffff|white)$/i;
const FULL_RECT_PATH_RE =
  /^M0(?:[ ,]+0)?(?:h|H)-?\d*\.?\d+(?:v|V)-?\d*\.?\d+(?:H|h)0z$/i;
const CANVAS_SIZE = Number.parseFloat(process.env.SVGO_CANVAS_SIZE) || 64;
const CANVAS_PADDING = Number.parseFloat(process.env.SVGO_CANVAS_PADDING) || 2;
const CANVAS_INNER = CANVAS_SIZE - CANVAS_PADDING * 2;

const isWhiteFill = (node) => WHITE_FILL_RE.test(node.attributes?.fill || '');

const isFullWhiteRectPath = (node) => {
  if (node.name !== 'path' || !node.attributes?.d || !isWhiteFill(node)) {
    return false;
  }
  return FULL_RECT_PATH_RE.test(node.attributes.d);
};

const isFullWhiteRect = (node) => {
  if (node.name === 'path') return isFullWhiteRectPath(node);
  return false;
};

const removeFullWhiteClipPaths = {
  name: 'removeFullWhiteClipPaths',
  fn: () => {
    const removableIds = new Set();

    const maybeStripClipPath = (node) => {
      const clipPath = node.attributes?.['clip-path'];
      if (!clipPath) return;
      const match = clipPath.match(/^url\(#([^)]+)\)$/);
      if (!match) return;
      if (removableIds.has(match[1])) {
        delete node.attributes['clip-path'];
      }
    };

    return {
      element: {
        enter: (node, parentNode) => {
          if (node.name === 'clipPath' && node.attributes?.id) {
            const children = node.children?.filter((child) => child.type === 'element') || [];
            if (children.length === 1 && isFullWhiteRect(children[0])) {
              removableIds.add(node.attributes.id);
              detachNodeFromParent(node, parentNode);
              return;
            }
          }
          if (node.attributes?.['clip-path']) {
            maybeStripClipPath(node);
          }
        },
      },
      root: {
        exit: (node) => {
          const walk = (current) => {
            if (!current || current.type !== 'element') return;
            if (current.attributes?.['clip-path']) {
              maybeStripClipPath(current);
            }
            if (current.children) {
              for (const child of current.children) walk(child);
            }
          };
          if (node && node.children) {
            for (const child of node.children) {
              walk(child);
            }
          }
        },
      },
    };
  },
};

const SHAPE_ELEMENTS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);

const scaleToCanvas = {
  name: 'scaleToCanvas',
  fn: () => {
    const parseNumber = (value) => {
      if (!value) return null;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const parseViewBox = (viewBox) => {
      if (!viewBox) return null;
      const parts = viewBox
        .trim()
        .split(/[ ,]+/)
        .map((part) => Number.parseFloat(part));
      if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
        return null;
      }
      const [minX, minY, width, height] = parts;
      if (width <= 0 || height <= 0) return null;
      return { minX, minY, width, height };
    };

    const applyTransformToShapes = (node, transform) => {
      if (!node || node.type !== 'element') return;

      if (SHAPE_ELEMENTS.has(node.name)) {
        node.attributes = node.attributes || {};
        if (node.attributes.transform) {
          node.attributes.transform = `${transform} ${node.attributes.transform}`;
        } else {
          node.attributes.transform = transform;
        }
      }

      if (node.children) {
        for (const child of node.children) {
          applyTransformToShapes(child, transform);
        }
      }
    };

    return {
      element: {
        enter: (node) => {
          if (node.name !== 'svg') return;

          let viewBox = parseViewBox(node.attributes?.viewBox);
          if (!viewBox) {
            const width = parseNumber(node.attributes?.width);
            const height = parseNumber(node.attributes?.height);
            if (!width || !height) return;
            viewBox = { minX: 0, minY: 0, width, height };
          }

          const scale = Math.min(
            CANVAS_INNER / viewBox.width,
            CANVAS_INNER / viewBox.height
          );
          const scaledWidth = viewBox.width * scale;
          const scaledHeight = viewBox.height * scale;
          const offsetX = CANVAS_PADDING + (CANVAS_INNER - scaledWidth) / 2;
          const offsetY = CANVAS_PADDING + (CANVAS_INNER - scaledHeight) / 2;
          const transform = `translate(${offsetX} ${offsetY}) scale(${scale}) translate(${-viewBox.minX} ${-viewBox.minY})`;

          if (node.children) {
            for (const child of node.children) {
              applyTransformToShapes(child, transform);
            }
          }

          node.attributes.viewBox = `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`;
          delete node.attributes.width;
          delete node.attributes.height;
        },
      },
    };
  },
};

module.exports = {
  plugins: [
    scaleToCanvas,
    'preset-default',
    'moveElemsAttrsToGroup',
    removeFullWhiteClipPaths,
    {
      name: 'removeUselessDefs',
      enabled: true,
    },
    {
      name: 'cleanupIds',
      params: {
        force: true,
      },
    },
    {
      name: 'removeAttrs',
      params: {
        attrs: 'data.*',
      },
    },
    {
      name: 'removeDimensions',
      enabled: true,
    },
    {
      name: 'addClassesToSVGElement',
      params: {
        classNames: ['icon'],
      },
    },
  ],
};
