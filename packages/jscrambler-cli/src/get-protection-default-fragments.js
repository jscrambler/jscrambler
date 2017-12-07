export default {
  '5.1': {
    application: `
      name
    `,
    applicationProtection: `
      _id,
      state,
      bail,
      deprecations,
      errorMessage,
      sources {
        filename,
        errorMessages {
          message,
          line,
          column,
          fatal
        }
      }
    `
  },
  '5.2': {
    application: `
      name
    `,
    applicationProtection: `
      _id,
      state,
      bail,
      deprecations {
        type,
        entity
      },
      errorMessage,
      sources {
        filename,
        errorMessages {
          message,
          line,
          column,
          fatal
        }
      }
    `
  }
};
