'use strict';

const moduleExports = require('use-sync-external-store/with-selector');

exports.useSyncExternalStoreWithSelector =
  moduleExports.useSyncExternalStoreWithSelector ||
  moduleExports.default ||
  moduleExports;
