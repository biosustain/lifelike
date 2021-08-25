import { representativePositiveNumber } from '../utils';

export const fixedValue = value => ({nodes}) => {
  nodes.forEach(n => {
    n._fixedValue = value;
  });
  return {
    nodes,
    _sets: {
      node: {
        _fixedValue: true
      }
    }
  };
};

export const noneNodeValue = ({nodes}) => {
  nodes.forEach(n => {
    delete n._fixedValue;
    delete n._value;
  });
  return {
    _sets: {
      node: {
        _fixedValue: false,
        _value: false
      }
    }
  };
};
export const byProperty = property => ({nodes}) => {
  nodes.forEach(n => {
    n._fixedValue = representativePositiveNumber(n[property]);
  });
  return {
    _sets: {
      node: {
        _fixedValue: true
      }
    }
  };
};
