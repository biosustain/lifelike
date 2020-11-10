import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable({
  providedIn: 'root'
})
export class ShortestPathService extends AbstractService {
  readonly kgAPI = '/api/knowledge-graph';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  // 3-hydroxyisobutyric Acid to pykF Using ChEBI
  threeHydroxyisobutyricAcidToPykfChebi(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/three-hydroxisobuteric-acid-to-pykf-chebi`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // 3-hydroxyisobutyric Acid to pykF using BioCyc
  threeHydroxyisobutyricAcidToPykfBiocyc(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/three-hydroxisobuteric-acid-to-pykf-biocyc`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // icd to rhsE
  icdToRhse(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/icd-to-rhse`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // SIRT5 to NFE2L2 Using Literature Data
  sirt5ToNfe2l2Literature(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/sirt5-to-nfe2l2-literature`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // CTNNB1 to Diarrhea Using Literature Data
  ctnnb1ToDiarrheaLiterature(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/ctnnb1-to-diarrhea-literature`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // Two pathways using BioCyc
  twoPathwaysBiocyc(): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-queries/two-pathways-biocyc`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}
