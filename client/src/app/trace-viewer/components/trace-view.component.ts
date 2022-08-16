import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import visNetwork from 'vis-network';
import { combineLatest, defer, of, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap, shareReplay } from 'rxjs/operators';
import { truncate } from 'lodash-es';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { UserError } from 'app/shared/exceptions';
import { ModuleAwareComponent} from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { uuidv4 } from 'app/shared/utils';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { TruncatePipe } from 'app/shared/pipes';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import Graph from 'app/shared/providers/graph-type/interfaces';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { AppURL } from 'app/shared/utils/url';
import { Source } from 'app/drawing-tool/services/interfaces';

import { getTraceDetailsGraph } from './traceDetails';
import { TraceNode } from './interfaces';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './trace-view.component.html',
  styleUrls: ['./trace-view.component.scss'],
  providers: [
    TruncatePipe,
    WarningControllerService,
    ModuleContext
  ]
})
export class TraceViewComponent implements ModuleAwareComponent, OnDestroy {
  destroyed = new Subject();

  loadTask = new BackgroundTask((id: string) =>
    combineLatest([
      this.filesystemService.get(id),
      this.filesystemService.getContent(id).pipe(
        mapBlobToBuffer(),
        mapBufferToJson(),
        switchMap(({graph: {trace_networks}, nodes}: Graph.File) =>
          this.route.params.pipe(
            map(({hash_id, network_trace_idx, trace_idx}) => {
              const traceData = this.getMatchingTrace(trace_networks, network_trace_idx, trace_idx);
              const parsedTraceData = this.parseTraceDetails(traceData, nodes);
              return getTraceDetailsGraph(parsedTraceData);
            })
          )
        )
      )
    ]).pipe(
      takeUntil(this.destroyed),
      tap(() => this.cdr.detectChanges()),
      shareReplay({refCount: true, bufferSize: 1})
    )
  );

  data$ = this.loadTask.results$.pipe(
    map(({result: [, fileContent]}) => fileContent)
  );

  title$ = this.data$.pipe(
    map(({startNode, endNode}) => `${startNode.title} → ${endNode.title}`)
  );

  header$ = combineLatest([
    this.title$,
    this.loadTask.results$.pipe(
      map(({result: [object]}) => object)
    )
  ]).pipe(
    map(([title, object]) => ({title, object}))
  );

  modulePropertiesChange = this.title$.pipe(
    map(title => ({
      title,
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    }))
  );

  sourceFileURL: AppURL;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    protected readonly warningController: WarningControllerService,
    protected readonly moduleContext: ModuleContext,
    protected readonly cdr: ChangeDetectorRef
  ) {
    moduleContext.register(this);

    this.route.params.subscribe(({hash_id, network_trace_idx, trace_idx}) => {
      this.loadTask.update(hash_id);
      this.sourceFileURL = new AppURL(`/projects/xxx/sankey/${hash_id}`, {search: {network_trace_idx, trace_idx}});
    });
  }

  sourceData$ = defer(() => of([{
      domain: 'Source File',
      url: this.sourceFileURL.toString()
    }]));


  ngOnDestroy() {
    this.destroyed.next();
  }

  parseTraceDetails(trace: Graph.Trace, mainNodes) {
    const edges: visNetwork.Edge[] = trace.detail_edges.map(
      ([from, to, d]) => ({
        from,
        to,
        id: uuidv4(),
        arrows: 'to',
        label: d.type,
        color: 'black',
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
        const labelShort = truncate(label, {length: 20});
        this.warningController.assert(label, `Node ${node.id} has no label property.`);
        return {
          ...node,
          label: labelShort,
          fullLabel: label,
          labelShort,
          title: label
        } as TraceNode;
      } else {
        this.warningController.warn(`Details nodes should never be implicitly define, yet ${nodeId} has not been found.`);
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
   * @returns the network trace matching the input hash, or undefined if no match
   */
  getMatchingTrace(networkTraces: Graph.TraceNetwork[], networkTraceIdx: number, traceIdx: number) {
    const trace = networkTraces[networkTraceIdx]?.traces[traceIdx];
    if (trace) {
      return trace;
    }
    throw new UserError({
      title: 'Could Not Find Trace in Source',
      message: 'This trace could not be found in the source file. Please find the trace in the source, and try again'
    });
  }
}
