import { isArray, isMatch } from 'lodash-es';

import { findEntriesValue } from '../utils';
import { InternalURIType } from '../constants';
import { AppURL, HttpURL } from '.';

export const ***ARANGO_DB_NAME***Url = Object.freeze(new HttpURL().toAbsolute());

export const isInternalUri = (uri: AppURL): uri is HttpURL =>
  (uri as HttpURL).isRelative || (uri as HttpURL).origin === ***ARANGO_DB_NAME***Url.origin;

/**This is mapping between indexed path segments and uri types
 * Examples:
 * - to identify "http://host.abc/projects/:project_name/enrichment-table/:file_id" as enrichment table
 *   it's sufficient to say that first path segment equals 'projects' and 3rd one 'enrichment-table'.
 *   This can be expressed at least in two ways:
 *    + ['projects', ,'enrichment-table'] - ussing sparse array notation
 *    + {0: 'projects', 3: 'enrichment-table'} - ussing object
 */
const internalURITypeMapping: Map<object, InternalURIType> = new Map([
  [['search', 'content'], InternalURIType.Search],
  [['search', 'graph'], InternalURIType.KgSearch],
  [{pathSegments: ['folders'], fragment: 'project'}, InternalURIType.Project],
  [['folders'], InternalURIType.Directory],
  [{pathSegments: {...['projects', , 'folders']}, fragment: 'project'}, InternalURIType.Project],
  [['projects', , 'folders'], InternalURIType.Directory],
  [['projects', , 'bioc'], InternalURIType.BioC],
  [['projects', , 'enrichment-table'], InternalURIType.EnrichmentTable],
  [['projects', , 'maps'], InternalURIType.Map],
  [['projects', , 'sankey'], InternalURIType.Graph],
  [['projects', , 'sankey-many-to-many'], InternalURIType.Graph],
  [['projects', , 'files'], InternalURIType.Pdf],
]);

export const findURLMapping = <R>(uriTypeMapping: Map<object, R>) => (uri: AppURL) => findEntriesValue(
  uriTypeMapping,
  // Current version of lodash has problem with sparse arrays (https://github.com/lodash/lodash/issues/5554)
  expected =>
    isMatch(
      uri,
      isArray(expected) ?
        {pathSegments: expected} :
        expected,
    )
);

const internalURITypeMapper = findURLMapping(internalURITypeMapping);

export const getInternalURIType = (uri: AppURL) => {
  if (isInternalUri(uri)) {
    return internalURITypeMapper(uri);
  }
};
