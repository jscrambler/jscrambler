import ClientModule from '../src/client';

const JscramblerClient = ClientModule && ClientModule.default ? ClientModule.default : ClientModule;

describe('JscramblerClient error handling', () => {
  test('should throw for missing accessKey when no token and not using header auth', async () => {
    const client = new JscramblerClient({ keys: {} });
    await expect(() => client.get('/test', {})).toThrow('Required *accessKey* not provided');
  });

  test('should throw for missing token when useHeaderAuth true', async () => {
    const client = new JscramblerClient({ useHeaderAuth: true, keys: {} });
    expect(() => client.get('/test', {})).toThrow(
      'Generating auth token when useHeaderAuth === true is not yet supported. You need to set the jscramblerClient token property explicitly.'
    );
  });
});
