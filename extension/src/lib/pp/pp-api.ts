import * as pq from './pp-query';
import * as ps from './pp-style';

export const createApi = () => ({
  element: pq.element,
  selector: pq.selector,
  applyStyle: ps.applyStyle,
  propMatches: pq.propMatches,
  propContains: pq.propContains,
  propExists: pq.propExists
});

export const pp = createApi();

export const pageModificationFunctions = [
  'pp.applyStyle',
  'pp.propMatches',
  'pp.propContains',
  'pp.propExists'
];
