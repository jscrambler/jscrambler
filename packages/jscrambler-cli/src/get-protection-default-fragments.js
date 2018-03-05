import * as introspection from './introspection';

async function getIntrospection(client, typeName) {
  let _introspection;
  try {
    _introspection = await introspection.type(
      client,
      typeName
    );
  } catch(e) {}
  return _introspection;
}

function fragmentToQL (fragment) {
  const iterate = (i) => {
    return Object
      .keys(i)
      .map((key) => {
        var result;
        const value = i[key];
        if (typeof value === 'object') {
          result = `${key} { ${iterate(value)} }`;
        } else {
          result = key;
        }
        return result;
      })
      .join(',');
  };
  return iterate(fragment);
}

function getAvaliableFragments(a , b) {
  const fragment = {};
  Object.keys(b).forEach(field => {
    const _field = a.find(f => f.name === field);
    if (_field) {
      if (
        typeof b[field] === 'object' &&
        _field.type.ofType.kind === 'OBJECT'
      ) {
        fragment[field] = b[field];
      } else {
        fragment[field] = 1;
      }
    }
  });
  return fragment;
}

const protectionFields = {
  _id: 1,
  state: 1,
  bail: 1,
  growthWarning: 1,
  errorMessage: 1,
  size: 1,
  transformedSize: 1
};

const deprecationFields = {
  type: 1,
  entity: 1
}

const sourceFields = {
  filename: 1,
}

const errorMessageFields = {
  message: 1,
  line: 1,
  column: 1,
  fatal: 1
};

export default async function(client) {
  const appProtection = await getIntrospection(client, 'ApplicationProtection');
  const deprecation = await getIntrospection(client, 'Deprecation');
  const source = await getIntrospection(client, 'ApplicationSource');
  const errorMessage = await getIntrospection(client, 'ErrorMessages');

  const fragments = {
    application: {
      name: 1
    },
    applicationProtection: {}
  };
  fragments.applicationProtection =
    appProtection &&
    getAvaliableFragments(appProtection.fields, protectionFields);

  fragments.applicationProtection.deprecations =
    deprecation &&
    getAvaliableFragments(deprecation.fields, deprecationFields);

  fragments.applicationProtection.sources =
    source &&
    getAvaliableFragments(source.fields, sourceFields);

  fragments.applicationProtection.sources.errorMessages =
    errorMessage &&
    getAvaliableFragments(errorMessage.fields, errorMessageFields);

  return {
    application: fragmentToQL(fragments.application),
    applicationProtection: fragmentToQL(fragments.applicationProtection)
  };
}
