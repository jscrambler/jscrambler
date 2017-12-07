const getApplicationDefaultFragments = `
  _id,
  name,
  createdAt,
  sources {
    _id,
    filename,
    extension
  }
`;
/**
 * Return one application by id.
 * The options params argument can be used to filter protections by version and limit the number of protections returned.
 * @param {String} id the application id
 * @param {fragment} fragments GraphQL fragment
 * @param {Array} params {{String}protectionsVersion, {Integer} protectionsNumber}
 */
export function getApplication(
  applicationId,
  fragments = getApplicationDefaultFragments,
  params
) {
  return {
    query: `
      query getApplication ($applicationId: String!, $protectionsVersion: String, $protectionsLimit: Int) {
        application(_id: $applicationId, protectionsVersion: $protectionsVersion, protectionsLimit: $protectionsLimit) {
          ${fragments}
        }
      }
    `,
    params: JSON.stringify({
      applicationId,
      ...params
    })
  };
}

const getApplicationSourceDefaultFragments = `
  _id,
  filename,
  extension
`;

export function getApplicationSource(
  sourceId,
  fragments = getApplicationSourceDefaultFragments,
  limits
) {
  return {
    query: `
      query getApplicationSource ($sourceId: String!, $contentLimit: Int, $transformedLimit: Int) {
        applicationSource(_id: $sourceId, contentLimit: $contentLimit, transformedLimit: $transformedLimit) {
          ${fragments}
        }
      }
    `,
    params: JSON.stringify({
      sourceId,
      ...limits
    })
  };
}

const getApplicationProtectionsDefaultFragments = `
  _id,
  sources,
  parameters,
  finishedAt,
  randomizationSeed
`;

export function getApplicationProtections(
  applicationId,
  params,
  fragments = getApplicationProtectionsDefaultFragments
) {
  return {
    query: `
      query getApplicationProtections ($applicationId: String!, $sort: String, $order: String, $limit: Int, $page: Int) {
        applicationProtections(_id: $applicationId, sort: $sort, order: $order, limit: $limit, page: $page) {
          ${fragments}
        }
      }
    `,
    params: JSON.stringify({
      applicationId,
      ...params
    })
  };
}

const getApplicationProtectionsCountDefaultFragments = `
  count
`;

export function getApplicationProtectionsCount(
  applicationId,
  fragments = getApplicationProtectionsCountDefaultFragments
) {
  return {
    query: `
      query getApplicationProtectionsCount ($applicationId: String!) {
        applicationProtectionsCount(_id: $applicationId) {
          ${fragments}
        }
      }
    `,
    params: JSON.stringify({
      applicationId
    })
  };
}

const getTemplatesDefaultFragments = `
  _id,
  parameters
`;

export function getTemplates(fragments = getTemplatesDefaultFragments) {
  return {
    query: `
      query getTemplates {
        templates {
          ${fragments}
        }
      }
    `,
    params: '{}'
  };
}

const getApplicationsDefaultFragments = `
  _id,
  name,
  protections,
  parameters
`;
/**
 * Return all applications.
 * The options params argument can be used to filter protections by version and limit the number of protections returned.
 * @param {fragment} fragments GraphQL fragment
 * @param {Array} params {{String}protectionsVersion, {Integer} protectionsNumber}
 */
export function getApplications(
  fragments = getApplicationsDefaultFragments,
  params
) {
  return {
    query: `
      query getApplications($protectionsVersion:String, $protectionsLimit: Int) {
        applications(protectionsVersion: $protectionsVersion, protectionsLimit: $protectionsLimit) {
          ${fragments}
        }
      }
    `,
    params: JSON.stringify({
      ...params
    })
  };
}

const getProtectionDefaultFragments = {
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
};

export function getProtection(
  applicationId,
  protectionId,
  fragments = getProtectionDefaultFragments
) {
  return {
    query: `
      query getProtection ($applicationId: String!, $protectionId: String!) {
        application (_id: $applicationId) {
          ${fragments.application}
        }
        applicationProtection (_id: $protectionId) {
          ${fragments.applicationProtection}
        }
      }
    `,
    params: JSON.stringify({
      applicationId,
      protectionId
    })
  };
}
