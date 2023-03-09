import { flatMap, uniq } from "lodash-es";

import { SankeyNode, SankeyTraceLink } from "app/sankey/model/sankey-document";

export const getNodeLinks = ({ sourceLinks, targetLinks }) => [...sourceLinks, ...targetLinks];

export const getTraces = ({
  nodes = [],
  links = [],
}: {
  nodes: SankeyNode<SankeyTraceLink>[];
  links: SankeyTraceLink[];
}) =>
  uniq(
    flatMap(nodes, getNodeLinks)
      .concat(links)
      .map(({ trace }) => trace)
  );
