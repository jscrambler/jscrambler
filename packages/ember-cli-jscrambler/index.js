module.exports = {
  name: 'ember-cli-jscrambler',

  included(app) {
    this._super.included.apply(this);

    const defaults = require('lodash.defaultsdeep');

    const defaultOptions = {
      enabled: app.env === 'production',

      jscrambler: {}
    };

    this._options = defaults(
      app.options['ember-cli-jscrambler'] || {},
      defaultOptions
    );
  },

  postprocessTree(type, tree) {
    if (this._options.enabled === true && type === 'all') {
      return require('./jscrambler-plugin')(tree, this._options);
    }
    return tree;
  }
};
