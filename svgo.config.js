// svgo.config.js
module.exports = {
  plugins: [
    'preset-default',
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
