import { uniq, flatMap } from 'lodash-es';

import { SankeyNode, SankeyTraceLink } from 'app/sankey/model/sankey-document';

import { Base } from './interfaces';
import { SankeyLinkInterface } from '../../interfaces';

export const getTraces = ({nodes = [], links = []}: { nodes: SankeyNode<SankeyTraceLink>[], links: SankeyTraceLink[] }) => uniq(
  flatMap(
    nodes,
    ({sourceLinks, targetLinks}) => [...sourceLinks, ...targetLinks]
  )
    .concat(links)
    .map(({trace}) => trace)
);
