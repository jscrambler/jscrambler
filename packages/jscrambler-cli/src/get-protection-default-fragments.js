import * as introspection from './introspection';

export default async function(client) {
  const appProtection = await introspection.type(
    client,
    'ApplicationProtection'
  );

  let deprecations = 'deprecations';
  let warnings = '';

  const isNewFormat =
    appProtection.fields.find(f => f.name === 'deprecations').type.ofType
      .kind === 'OBJECT' 
      || appProtection.fields.find(f => f.name === 'growthWarning')

  if (isNewFormat) {
    deprecations = `deprecations {
    type
    entity
  }`;
    warnings = `growthWarning`;
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
      ${warnings}
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
