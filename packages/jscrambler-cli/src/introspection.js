import cloneDeep from 'lodash.clonedeep';

const typeCache = {};

export async function type(client, name) {
  const {jscramblerVersion} = client.options;

  if (!typeCache[jscramblerVersion]) {
    typeCache[jscramblerVersion] = {};
  }

  if (typeCache[jscramblerVersion][name]) {
    return typeCache[jscramblerVersion][name];
  }

  const query = {
    query: `
query getType($name: String!) {
  __type(name: $name) {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  inputFields {
    name
    type {
      name
      kind
    }
  }
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
      }
    }
  }
}`,
    params: JSON.stringify({
      name
    })
  };

  const res = await client.get('/application', query);
  const __type = res.data.__type;

  typeCache[jscramblerVersion][__type.name] = __type;

  return __type;
}

export async function mutation(client, name) {
  const rootMutation = await type(client, 'RootMutation');

  const mutationType = rootMutation.fields.find(f => f.name === name);

  return mutationType;
}

export async function query(client, name) {
  const rootQuery = await type(client, 'RootQuery');

  const queryType = rootQuery.fields.find(f => f.name === name );

  return queryType;
}

export async function intoObjectType(client, obj, name) {
  const resultType = (await type(client, name));
  const fields = resultType.fields ?? resultType.inputFields;

  const finalObj = {};
  const keys = Object.keys(obj);

  await Promise.all(
    keys.map(async k => {
      const field = fields.find(f => f.name === k);

      if (field && field.type) {
        finalObj[k] = cloneDeep(obj[k]);

        if (field.type.kind === 'OBJECT' && !!field.type.name) {
          finalObj[k] = await intoObjectType(
            client,
            finalObj[k],
            field.type.name
          );
          return;
        }

        if (
          (field.type.kind === 'NON_NULL' || field.type.kind === 'LIST') &&
          field.type.ofType.kind === 'OBJECT'
        ) {
          finalObj[k] = await intoObjectType(
            client,
            finalObj[k],
            field.type.ofType.name
          );
          return;
        }

        if (field.type.name === 'String' && typeof finalObj[k] !== 'string') {
          finalObj[k] = JSON.stringify(finalObj[k]);
        }
      }
    })
  );

  return finalObj;
}
