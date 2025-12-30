// svgo.config.js
const { detachNodeFromParent } = require('svgo/lib/xast.js');

const WHITE_FILL_RE = /^(#fff|#ffffff|white)$/i;
const FULL_RECT_PATH_RE =
  /^M0(?:[ ,]+0)?(?:h|H)-?\d*\.?\d+(?:v|V)-?\d*\.?\d+(?:H|h)0z$/i;

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
    const clipPathUsers = [];

    const maybeStripClipPath = (node) => {
      const clipPath = node.attributes?.['clip-path'];
      if (!clipPath) return;
      const match = clipPath.match(/^url\(#([^)]+)\)$/);
      if (!match) return;
      if (removableIds.has(match[1])) {
        delete node.attributes['clip-path'];
      } else {
        clipPathUsers.push(node);
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
        exit: () => {
          for (const node of clipPathUsers) {
            maybeStripClipPath(node);
          }
        },
      },
    };
  },
};

module.exports = {
  plugins: [
    'preset-default',
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
