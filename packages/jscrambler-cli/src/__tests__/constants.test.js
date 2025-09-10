import {
  HTTP_STATUS_CODES,
  JSCRAMBLER_ERROR_CODES,
  CLIENT_IDS,
  CLIENT_PACKAGES
} from '../constants';

describe('constants', () => {
  describe('HTTP_STATUS_CODES', () => {
    it('should contain correct HTTP status codes', () => {
      expect(HTTP_STATUS_CODES.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS_CODES.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS_CODES.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).toBe(503);
      expect(HTTP_STATUS_CODES.GATEWAY_TIMEOUT).toBe(504);
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(HTTP_STATUS_CODES)).toBe(true);
      
      const attemptModification = () => {
        HTTP_STATUS_CODES.UNAUTHORIZED = 500;
      };
      
      expect(attemptModification).toThrow();
    });

    it('should not allow adding new properties', () => {
      const attemptAddition = () => {
        HTTP_STATUS_CODES.NEW_CODE = 999;
      };
      
      expect(attemptAddition).toThrow();
    });
  });

  describe('JSCRAMBLER_ERROR_CODES', () => {
    it('should contain correct error codes', () => {
      expect(JSCRAMBLER_ERROR_CODES.INVALID_SIGNATURE).toBe('254');
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(JSCRAMBLER_ERROR_CODES)).toBe(true);
      
      const attemptModification = () => {
        JSCRAMBLER_ERROR_CODES.INVALID_SIGNATURE = '999';
      };
      
      expect(attemptModification).toThrow();
    });
  });

  describe('CLIENT_IDS', () => {
    it('should contain correct client IDs', () => {
      expect(CLIENT_IDS.CLI).toBe(0);
      expect(CLIENT_IDS.APP).toBe(1);
      expect(CLIENT_IDS.WEBPACK).toBe(2);
      expect(CLIENT_IDS.GULP).toBe(3);
      expect(CLIENT_IDS.GRUNT).toBe(4);
      expect(CLIENT_IDS.EMBER).toBe(5);
      expect(CLIENT_IDS.METRO).toBe(6);
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(CLIENT_IDS)).toBe(true);
      
      const attemptModification = () => {
        CLIENT_IDS.CLI = 999;
      };
      
      expect(attemptModification).toThrow();
    });

    it('should contain all expected client types', () => {
      const expectedClients = ['CLI', 'APP', 'WEBPACK', 'GULP', 'GRUNT', 'EMBER', 'METRO'];
      const actualClients = Object.keys(CLIENT_IDS);
      
      expect(actualClients).toEqual(expect.arrayContaining(expectedClients));
      expect(actualClients.length).toBe(expectedClients.length);
    });
  });

  describe('CLIENT_PACKAGES', () => {
    it('should map client IDs to correct package names', () => {
      expect(CLIENT_PACKAGES[CLIENT_IDS.CLI]).toBe('jscrambler');
      expect(CLIENT_PACKAGES[CLIENT_IDS.APP]).toBe('app');
      expect(CLIENT_PACKAGES[CLIENT_IDS.WEBPACK]).toBe('jscrambler-webpack-plugin');
      expect(CLIENT_PACKAGES[CLIENT_IDS.GULP]).toBe('gulp-jscrambler');
      expect(CLIENT_PACKAGES[CLIENT_IDS.GRUNT]).toBe('grunt-jscrambler');
      expect(CLIENT_PACKAGES[CLIENT_IDS.EMBER]).toBe('ember-cli-jscrambler');
      expect(CLIENT_PACKAGES[CLIENT_IDS.METRO]).toBe('jscrambler-metro-plugin');
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(CLIENT_PACKAGES)).toBe(true);
      
      const attemptModification = () => {
        CLIENT_PACKAGES[CLIENT_IDS.CLI] = 'modified-package';
      };
      
      expect(attemptModification).toThrow();
    });

    it('should have entries for all client IDs', () => {
      const clientIdValues = Object.values(CLIENT_IDS);
      
      clientIdValues.forEach(id => {
        expect(CLIENT_PACKAGES[id]).toBeDefined();
        expect(typeof CLIENT_PACKAGES[id]).toBe('string');
        expect(CLIENT_PACKAGES[id].length).toBeGreaterThan(0);
      });
    });

    it('should use numeric keys corresponding to CLIENT_IDS values', () => {
      expect(CLIENT_PACKAGES[0]).toBe('jscrambler');
      expect(CLIENT_PACKAGES[1]).toBe('app');
      expect(CLIENT_PACKAGES[2]).toBe('jscrambler-webpack-plugin');
      expect(CLIENT_PACKAGES[3]).toBe('gulp-jscrambler');
      expect(CLIENT_PACKAGES[4]).toBe('grunt-jscrambler');
      expect(CLIENT_PACKAGES[5]).toBe('ember-cli-jscrambler');
      expect(CLIENT_PACKAGES[6]).toBe('jscrambler-metro-plugin');
    });
  });

  describe('constants integrity', () => {
    it('should not allow deletion of properties', () => {
      const attemptDeletion = () => {
        delete HTTP_STATUS_CODES.UNAUTHORIZED;
      };
      
      expect(attemptDeletion).toThrow();
    });

    it('should maintain referential integrity between CLIENT_IDS and CLIENT_PACKAGES', () => {
      Object.entries(CLIENT_IDS).forEach(([key, value]) => {
        expect(CLIENT_PACKAGES[value]).toBeDefined();
        expect(CLIENT_PACKAGES[value]).not.toBe('');
        expect(CLIENT_PACKAGES[value]).not.toBeNull();
      });
    });
  });
});