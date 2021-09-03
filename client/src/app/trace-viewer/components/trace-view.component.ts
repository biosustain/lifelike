import { Component, EventEmitter, isDevMode, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import * as CryptoJS from 'crypto-js';

import { cubehelix } from 'd3';

import { combineLatest, Subscription } from 'rxjs';

import visNetwork from 'vis-network';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { SankeyLayoutService } from 'app/sankey-viewer/components/sankey/sankey-layout.service';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { UserError } from 'app/shared/exceptions';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { uuidv4 } from 'app/shared/utils';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';

import { getTraceDetailsGraph } from './traceDetails';
import { TruncatePipe } from '../../shared/pipes';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './trace-view.component.html',
  styleUrls: ['./trace-view.component.scss'],
  providers: [
    CustomisedSankeyLayoutService, {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyLayoutService
    },
    TruncatePipe
  ]
})
export class TraceViewComponent implements OnDestroy, ModuleAwareComponent {
  loadTask: BackgroundTask<string, any>;
  sankeyDataSub: Subscription;

  modulePropertiesChange = new EventEmitter<ModuleProperties>();

  data;
  title: string;
  error: any;

  sankeyData: SankeyData;
  networkTraces;

  sourceFileURL: string;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private sankeyLayout: CustomisedSankeyLayoutService,
    protected readonly truncatePipe: TruncatePipe
  ) {
    const projectName = this.route.snapshot.params.project_name;
    const traceHash = this.route.snapshot.params.trace_hash;
    const fileId = this.route.snapshot.params.file_id;

    this.sourceFileURL = `/projects/${projectName}/sankey/${fileId}`;

    this.loadTask = new BackgroundTask((id) => {
      return combineLatest(
        this.filesystemService.getContent(id).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        )
      );
    });

    this.sankeyDataSub = this.loadTask.results$.subscribe(({result: [fileContent]}) => {
      const {links, graph, nodes, ...data} = fileContent;
      this.networkTraces = graph.trace_networks;
      this.sankeyData = {
        ...data,
        graph,
        links,
        nodes
      } as SankeyData;

      const traceData = this.getMatchingTrace(this.networkTraces, traceHash);
      if (traceData !== undefined) {
        const parsedTraceData = this.parseTraceDetails(traceData);
        this.data = getTraceDetailsGraph(parsedTraceData);
        const {startNode: {title: startLabel}, endNode: {title: endLabel}} = this.data;
        this.title = `${startLabel} → ${endLabel}`;
      }
      this.emitModuleProperties();
    });

    this.loadTask.update(fileId);
  }

  ngOnDestroy() {
    this.sankeyDataSub.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.title,
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    });
  }

  parseTraceDetails(trace) {
    const {
      sankeyData: {
        nodes: mainNodes
      },
      sankeyLayout: {
        nodeLabel
      },
      truncatePipe: {
        transform: truncate
      }
    } = this;

    const edges = (trace.detail_edges || trace.edges).map(([from, to, d]) => ({
      from,
      to,
      id: uuidv4(),
      arrows: 'to',
      label: d.type,
      ...(d || {})
    }));
    const nodeIds = [...edges.reduce((nodesSet, {from, to}) => {
      nodesSet.add(from);
      nodesSet.add(to);
      return nodesSet;
    }, new Set())];
    const nodes: Array<visNetwork.Node> = nodeIds.map(nodeId => {
      const node = mainNodes.find(({id}) => id === nodeId);
      if (node) {
        const color = cubehelix(node._color);
        color.s = 0;
        const label = nodeLabel(node);
        const labelShort = truncate(label, 20);
        if (isDevMode() && !label) {
          console.error(`Node ${node.id} has no label property.`, node);
        }
        const {_sourceLinks, _targetLinks, sourceLinks, targetLinks, ...otherProperties} = node;
        return {
          ...otherProperties,
          color: '' + color,
          databaseLabel: node.type,
          label: labelShort,
          fullLabel: label,
          labelShort,
          title: label
        };
      } else {
        console.error(`Details nodes should never be implicitly define, yet ${nodeId} has not been found.`);
        return {
          id: nodeId,
          label: nodeId,
          databaseLabel: 'Implicitly defined',
          color: 'red'
        };
      }
    });

    return {
      ...trace,
      nodes,
      edges
    };
  }

  /**
   * Finds and returns a network trace whose hash matches the given hash string.
   * @param networkTraces list of network trace data
   * @param traceHash hash string representing a unique node trace
   * @returns the network trace matching the input hash, or undefined if no match
   */
  getMatchingTrace(networkTraces: any[], traceHash: string) {
    for (const networkTrace of networkTraces) {
      for (const trace of networkTrace.traces) {
        const hash = CryptoJS.MD5(JSON.stringify({
          ...networkTrace,
          traces: [],
          source: trace.source,
          target: trace.target
        })).toString();
        if (hash === traceHash) {
          return trace;
        }
      }
    }
    this.error = new UserError(
      'Could Not Find Trace in Source',
      'This trace could not be found in the source file. Please find the trace in the source, and try again',
      [],
      '',
      undefined,
      undefined
    );
    return undefined;
  }
}
