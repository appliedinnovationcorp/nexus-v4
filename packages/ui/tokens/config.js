const StyleDictionary = require('style-dictionary');

// Custom transforms
StyleDictionary.registerTransform({
  name: 'size/px',
  type: 'value',
  matcher: (token) => {
    return token.attributes.category === 'size' || token.type === 'dimension';
  },
  transformer: (token) => {
    return parseFloat(token.original.value) + 'px';
  }
});

StyleDictionary.registerTransform({
  name: 'color/css',
  type: 'value',
  matcher: (token) => {
    return token.attributes.category === 'color' || token.type === 'color';
  },
  transformer: (token) => {
    return token.original.value;
  }
});

// Custom formats
StyleDictionary.registerFormat({
  name: 'css/variables',
  formatter: function(dictionary) {
    return `:root {\n${dictionary.allTokens.map(token => 
      `  --${token.name}: ${token.value};`
    ).join('\n')}\n}`;
  }
});

StyleDictionary.registerFormat({
  name: 'typescript/es6-declarations',
  formatter: function(dictionary) {
    return `export const tokens = {\n${dictionary.allTokens.map(token => 
      `  '${token.name}': '${token.value}'`
    ).join(',\n')}\n} as const;\n\nexport type TokenName = keyof typeof tokens;`;
  }
});

StyleDictionary.registerFormat({
  name: 'json/nested',
  formatter: function(dictionary) {
    return JSON.stringify(dictionary.tokens, null, 2);
  }
});

module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      transforms: ['attribute/cti', 'name/cti/kebab', 'color/css', 'size/px'],
      buildPath: 'dist/tokens/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables'
      }]
    },
    js: {
      transformGroup: 'js',
      transforms: ['attribute/cti', 'name/cti/camel', 'color/css', 'size/px'],
      buildPath: 'tokens/',
      files: [{
        destination: 'index.js',
        format: 'javascript/es6'
      }, {
        destination: 'index.d.ts',
        format: 'typescript/es6-declarations'
      }]
    },
    json: {
      transformGroup: 'js',
      buildPath: 'dist/tokens/',
      files: [{
        destination: 'tokens.json',
        format: 'json/nested'
      }]
    }
  }
};
