import { Component, EventEmitter, isDevMode, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import * as CryptoJS from 'crypto-js';

import visNetwork from 'vis-network';

import { combineLatest, Subscription, Observable } from 'rxjs';


import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { UserError } from 'app/shared/exceptions';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { uuidv4 } from 'app/shared/utils';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';

import { getTraceDetailsGraph } from './traceDetails';
import { TruncatePipe } from '../../shared/pipes';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { TraceNode } from './interfaces';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './trace-view.component.html',
  styleUrls: ['./trace-view.component.scss'],
  providers: [
    TruncatePipe
  ]
})
export class TraceViewComponent implements OnDestroy, ModuleAwareComponent {
  loadTask: BackgroundTask<string, [FilesystemObject, GraphFile]>;
  sankeyDataSub: Subscription;

  modulePropertiesChange = new EventEmitter<ModuleProperties>();

  data;
  title: string;
  error: any;
  object: FilesystemObject;

  sankeyData: GraphFile;
  networkTraces: Array<GraphTraceNetwork>;

  sourceFileURL: string;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    protected readonly truncatePipe: TruncatePipe
  ) {
    const projectName = this.route.snapshot.params.project_name;
    const traceHash = this.route.snapshot.params.trace_hash;
    const fileId = this.route.snapshot.params.file_id;

    this.sourceFileURL = `/projects/${projectName}/sankey/${fileId}`;

    this.loadTask = new BackgroundTask((id) => {
      return combineLatest(
        this.filesystemService.get(id),
        this.filesystemService.getContent(id).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        ) as Observable<GraphFile>
      );
    });

    this.sankeyDataSub = this.loadTask.results$.subscribe(({result: [object, fileContent]}) => {
      const {links, graph, nodes, ...data} = fileContent;
      this.object = object;
      this.networkTraces = graph.trace_networks;
      this.sankeyData = {
        ...data,
        graph,
        links,
        nodes
      } as GraphFile;

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

  parseTraceDetails(trace: GraphTrace) {
    const {
      sankeyData: {
        nodes: mainNodes
      },
      truncatePipe: {
        transform: truncate
      }
    } = this;

    const edges: visNetwork.Edge[] = trace.detail_edges.map(
      ([from, to, d]) => ({
        from,
        to,
        id: uuidv4(),
        arrows: 'to',
        label: d.type,
        ...(d || {})
      })
    );
    const nodeIds: Array<visNetwork.IdType> = [...edges.reduce(
      (nodesSet, {from, to}) => {
        nodesSet.add(from);
        nodesSet.add(to);
        return nodesSet;
      },
      new Set<visNetwork.IdType>()
    )];
    const nodes = nodeIds.map(nodeId => {
      const node = mainNodes.find(({id}) => id === nodeId);
      if (node) {
        const label = node.label;
        const labelShort = truncate(label, 20);
        if (isDevMode() && !label) {
          console.error(`Node ${node.id} has no label property.`, node);
        }
        return {
          ...node,
          label: labelShort,
          fullLabel: label,
          labelShort,
          title: label
        } as TraceNode;
      } else {
        console.error(`Details nodes should never be implicitly define, yet ${nodeId} has not been found.`);
        return {
          id: nodeId,
          label: nodeId,
          type: 'Implicitly defined',
          color: 'red'
        } as TraceNode;
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
  getMatchingTrace(networkTraces: GraphTraceNetwork[], traceHash: string) {
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
