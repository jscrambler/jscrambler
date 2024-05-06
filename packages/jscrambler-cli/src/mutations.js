import cleanupInputFields from './cleanup-input-fields';

const createApplicationDefaultFragments = `
  _id,
  createdAt,
  name
`;

export function createApplication(
  data,
  fragments = createApplicationDefaultFragments
) {
  return {
    query: `
      mutation createApplication ($data: ApplicationCreate!) {
        createApplication(data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      data
    }
  };
}

const duplicateApplicationDefaultFragments = `
  _id
`;

export function duplicateApplication(
  id,
  fragments = duplicateApplicationDefaultFragments
) {
  return {
    query: `
      mutation duplicateApplication ($_id: String!) {
        duplicateApplication (_id: $_id) {
          ${fragments}
        }
      }
    `,
    params: {
      _id: id
    }
  };
}

const removeApplicationDefaultFragments = `
  _id
`;

export function removeApplication(
  id,
  fragments = removeApplicationDefaultFragments
) {
  return {
    query: `
      mutation removeApplication ($_id: String!) {
        removeApplication (_id: $_id) {
          ${fragments}
        }
      }
    `,
    params: {
      _id: id
    }
  };
}

const removeProtectionDefaultFragments = `
  _id
`;

export function removeProtection(
  id,
  appId,
  fragments = removeProtectionDefaultFragments
) {
  return {
    query: `
      mutation removeProtection ($_id: String!, $applicationId: String!) {
        removeProtection (_id: $_id, applicationId: $applicationId) {
          ${fragments}
        }
      }
    `,
    params: {
      _id: id,
      applicationId: appId
    }
  };
}

const cancelProtectionDefaultFragments = `
  _id
`;

export function cancelProtection(
  id,
  appId,
  fragments = cancelProtectionDefaultFragments
) {
  return {
    query: `
      mutation cancelProtection ($_id: String!, $applicationId: String!) {
        cancelProtection (_id: $_id, applicationId: $applicationId) {
          ${fragments}
        }
      }
    `,
    params: {
      _id: id,
      applicationId: appId
    }
  };
}

const updateApplicationDefaultFragments = `
  _id,
  createdAt,
  name
`;

export function updateApplication(
  applicationData,
  fragments = updateApplicationDefaultFragments,
  applicationId = undefined,
) {
  const appId = applicationId ?? applicationData._id;
  delete applicationData._id;

  return {
    query: `
      mutation updateApplication ($applicationId: String!, $data: ApplicationUpdate!) {
        updateApplication (_id: $applicationId, data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      applicationId: appId,
      data: applicationData
    }
  };
}

const unlockApplicationDefaultFragments = `
  _id,
  createdAt,
  name
`;

export function unlockApplication(
  application,
  fragments = unlockApplicationDefaultFragments
) {
  return {
    query: `
      mutation unlockApplication ($applicationId: String!) {
        unlockApplication (_id: $applicationId) {
          ${fragments}
        }
      }
    `,
    params: {
      applicationId: application._id
    }
  };
}

const addApplicationSourceDefaultFragments = `
  _id,
  filename,
  extension
`;

export function addApplicationSource(
  applicationId,
  data,
  fragments = addApplicationSourceDefaultFragments
) {
  return {
    query: `
      mutation addSourceToApplication ($applicationId: String!, $data: ApplicationSourceCreate!) {
        addSourceToApplication(applicationId: $applicationId, data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      applicationId,
      data
    }
  };
}

const updateApplicationSourceDefaultFragments = `
  _id,
  filename,
  extension
`;

export function updateApplicationSource(
  applicationSource,
  fragments = updateApplicationSourceDefaultFragments
) {
  const sourceId = applicationSource._id;
  delete applicationSource._id;

  return {
    query: `
      mutation updateApplicationSource ($sourceId: String!, $data: ApplicationSourceUpdate!) {
        updateApplicationSource(_id: $sourceId, data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      sourceId,
      data: applicationSource
    }
  };
}

const removeSourceFromApplicationDefaultFragments = `
  _id,
  sources {
    filename
  }
`;

export function removeSourceFromApplication(
  filename,
  applicationId,
  fragments = removeSourceFromApplicationDefaultFragments
) {
  return {
    query: `
      mutation removeSource ($filename: String!, $applicationId: String!) {
        removeSource (filename: $filename, applicationId: $applicationId) {
          ${fragments}
        }
      }
    `,
    params: {
      filename,
      applicationId
    }
  };
}

const createTemplateDefaultFragments = `
  _id,
  name,
  description,
  parameters
`;

export function createTemplate(
  template,
  fragments = createTemplateDefaultFragments
) {
  return {
    query: `
      mutation createTemplate ($data: TemplateInput!) {
        createTemplate (data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      data: template
    }
  };
}

const removeTemplateDefaultFragments = `
  _id
`;

export function removeTemplate(id, fragments = removeTemplateDefaultFragments) {
  return {
    query: `
      mutation removeTemplate ($_id: String!) {
        removeTemplate (_id: $_id) {
          ${fragments}
        }
      }
    `,
    params: {
      _id: id
    }
  };
}

const updateTemplateDefaultFragments = `
  _id,
  parameters
`;

export function updateTemplate(
  template,
  fragments = updateTemplateDefaultFragments
) {
  const templateId = template._id;
  delete template._id;

  return {
    query: `
      mutation updateTemplate ($templateId: ID!, $data: TemplateInput!) {
        updateTemplate (_id: $templateId, data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      templateId,
      data: template
    }
  };
}

const createProtectionDefaultFragments = `
  _id,
  state
`;

export function createApplicationProtection(
  applicationId,
  _fragments = createProtectionDefaultFragments,
  _options,
  args,
  {mutationName = 'createApplicationProtection', mutationInputType = 'ApplicationProtectionCreate'} = {}
) {
  let fragments = _fragments;
  let options = _options;

  [options, fragments] = cleanupInputFields(args, fragments, options);

  return {
    query: `
      mutation ${mutationName} ($applicationId: String!, $data: ${mutationInputType}) {
        ${mutationName} (applicationId: $applicationId, data: $data) {
          ${fragments}
        }
      }
    `,
    params: {
      applicationId,
      data: options
    }
  };
}

const createProtectionsDefaultFragments = `
  protections {
   ${createProtectionDefaultFragments}
  }
`;

export function createApplicationProtections(
  applicationId,
  _fragments = createProtectionsDefaultFragments,
  _options,
  args
) {
  return createApplicationProtection(
    applicationId,
    _fragments,
    _options,
    args,
    {mutationName: 'createApplicationProtections', mutationInputType: 'ApplicationProtectionsCreate'}
  );
}

const applyTemplateDefaultFragments = `
  _id,
  parameters
`;

export function applyTemplate(
  templateId,
  appId,
  fragments = applyTemplateDefaultFragments
) {
  return {
    query: `
      mutation applyTemplate ($templateId: String!, $appId: String!) {
        applyTemplate (templateId: $templateId, appId: $appId) {
          ${fragments}
        }
      }
    `,
    params: {
      templateId,
      appId
    }
  };
}
