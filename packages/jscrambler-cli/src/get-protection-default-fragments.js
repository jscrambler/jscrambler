import * as introspection from './introspection';

export default async function(client) {
  const appProtection = await introspection.type(
    client,
    'ApplicationProtection'
  );

  let deprecations = 'deprecations';

  const isNewFormat =
    appProtection.fields.find(f => f.name === 'deprecations').type.ofType
      .kind === 'OBJECT';

  if (isNewFormat) {
    deprecations = `deprecations {
    type
    entity
  }`;
  }

  return {
    application: `
      name
    `,
    applicationProtection: `
      _id
      state
      bail
      ${deprecations}
      errorMessage
      sources {
        filename
        errorMessages {
          message
          line
          column
          fatal
        }
      }
    `
  };
}
