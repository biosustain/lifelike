import {Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild, AfterViewInit, Input, NgZone } from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ActivatedRoute} from '@angular/router';

import {NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {BehaviorSubject, forkJoin, from, of, Subscription} from 'rxjs';
import {catchError, finalize, flatMap, map, mergeMap} from 'rxjs/operators';

import {TableCell, TableHeader} from 'app/shared/components/table/generic-table.component';
import {ModuleAwareComponent, ModuleProperties} from 'app/shared/modules';
import {BackgroundTask} from 'app/shared/rxjs/background-task';
import {ErrorHandler} from 'app/shared/services/error-handler.service';
import {DownloadService} from 'app/shared/services/download.service';

import {
  EnrichmentVisualisationService,
  EnrichmentWrapper,
  GoNode,
  NCBINode,
  NCBIWrapper,
} from '../../services/enrichment-visualisation.service';

import {WordCloudComponent} from './word-cloud/word-cloud.component';
import {FilesystemObject} from '../../../file-browser/models/filesystem-object';
import {FilesystemService} from '../../../file-browser/services/filesystem.service';
import {ProgressDialog} from '../../../shared/services/progress-dialog.service';
import {mapBlobToBuffer, mapBufferToJson} from '../../../shared/utils/files';
import {EnrichmentTableOrderDialogComponent} from '../table/dialog/enrichment-table-order-dialog.component';
import {EnrichmentTableEditDialogComponent} from '../table/dialog/enrichment-table-edit-dialog.component';
import {Progress} from '../../../interfaces/common-dialog.interface';

// import mockedData from './stories/assets/mocked_data.json';
import {EnrichmentTableService} from '../../services/enrichment-table.service';
import {MessageDialog} from "../../../shared/services/message-dialog.service";
import {WorkspaceManager} from "../../../shared/workspace-manager";
import {FilesystemObjectActions} from "../../../file-browser/services/filesystem-object-actions";
import {MAP_MIMETYPE} from "../../../drawing-tool/providers/map.type-provider";
import {getObjectLabel} from "../../../file-browser/utils/objects";
import {MessageType} from "../../../interfaces/message-dialog.interface";

export const ENRICHMENT_VISUALISATION_MIMETYPE = 'vnd.lifelike.document/enrichment-visualisation';

@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [ EnrichmentVisualisationService ]
})
export class EnrichmentVisualisationViewerComponent implements OnInit, OnDestroy, AfterViewInit, ModuleAwareComponent {
  @Input() titleVisible = true;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  // Inputs for Generic Table Component
  tableEntries: TableCell[][] = [];
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      {name: 'Imported', span: '1'},
      {name: 'Matched', span: '1'},
      {name: 'NCBI Gene Full Name', span: '1'},
    ],
  ];
  // Map where column name is mapped to first row of table header.
  headerMap: Map<string, TableHeader[]> = new Map([
    ['Regulon', [{name: 'Regulon Data', span: '3'}]],
    ['UniProt', [{name: 'Uniprot Function', span: '1'}]],
    ['String', [{name: 'String Annotation', span: '1'}]],
    ['GO', [{name: 'GO Annotation', span: '1'}]],
    ['Biocyc', [{name: 'Biocyc Pathways', span: '1'}]],
  ]);
  // Map where column name is mapped to second row of table header.
  secondHeaderMap: Map<string, TableHeader[]> = new Map([
    ['Default', [{name: '', span: '1'}, {name: '', span: '1'}, {name: '', span: '1'}]],
    ['Regulon', [{name: 'Regulator Family', span: '1'}, {name: 'Activated By', span: '1'},
      {name: 'Repressed By', span: '1'}]],
    ['UniProt', [{name: '', span: '1'}]],
    ['String', [{name: '', span: '1'}]],
    ['GO', [{name: '', span: '1'}]],
    ['Biocyc', [{name: '', span: '1'}]],
  ]);
  numDefaultHeader: number = this.tableHeader[0].length;

  // Enrichment Table and NCBI Matching Results
  domains: string[] = [];
  projectName: string;
  fileId: string;
  geneNames: string[];
  taxID: string;
  organism: string;
  loadTableTask: BackgroundTask<null, [FilesystemObject, EnrichmentVisualisationData]>;
  loadTableTaskSubscription: Subscription;
  object: FilesystemObject;
  data: EnrichmentVisualisationData;
  mockedData: any = {
      name: 'ChEA 2016',
      data: [
        {
          Term: 'E2F1 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '138/4172',
          'P-value': '5.945744362760266E-13',
          'Adjusted P-value': '3.835005113980372E-10',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.7641418983700863',
          'Combined Score': '49.66223593507686',
          Genes: 'OSGEPL1;TPMT;D4BWG0951E;RFESD;IPP;ORC5L;ZFAND1;NUDT6;AKR7A5;RPS6KA5;ABHD11;2810432D09RIK;CDK5RAP1;PMPCB;SLC25A40;AW209491;SEPHS2;2610019F03RIK;4732466D17RIK;B3BP;SLC30A6;CPT1A;IAH1;ENTPD5;OXSM;WDR20A;UBE2E1;TMEM80;ATAD3A;SMO;TFAM;A930041I02RIK;ASF1A;ZFP106;ENY2;ZFP748;FECH;BRI3;COX15;1200014M14RIK;MYNN;2010309E21RIK;PTTG1IP;TXNDC4;TASP1;HYI;RDH14;AP4S1;NDUFV1;SAC3D1;ZKSCAN1;ZRSR1;TRAP1;TMEM86A;TOR1A;ACBD4;CRADD;APOOL;FZD5;TGDS;ADHFE1;SLC33A1;LRRC61;MCAT;DNAJC18;CDAN1;4833426J09RIK;FBXL3;ZCCHC3;SFXN5;BC038156;FBXL6;1810049H13RIK;MOBKL2B;GBE1;ADK;PCSK7;TFB1M;MRPL35;RABEPK;TMEM186;PITPNC1;FARS2;DHTKD1;PCMTD2;THTPA;1110032A03RIK;SIP1;SPTLC1;SCRN3;5430437P03RIK;POLI;PGM2;RIOK2;HIBCH;TMED4;PEX1;COQ10A;C330002I19RIK;D730039F16RIK;PRPF18;DALRD3;GORASP1;CAT;UFC1;ATP6V1B2;MTFR1;TLCD1;ATPAF1;ZFP787;NOL7;WDR24;5730403B10RIK;PSMC3IP;GK5;EXOSC4;PSMB1;BPNT1;METTL8;SIAE;PMS1;PAIP1;RBM39;FAHD1;MDH1;ASCC1;2410018G20RIK;TNFSF5IP1;GNMT;GSTZ1;PSMC6;RPS6KB1;LYRM5;AI931714;TOMM70A;TSR2;RQCD1;NUPL2'
        },
        {
          Term: 'JARID1A 20064375 ChIP-Seq MESCs Mouse',
          Overlap: '76/2171',
          'P-value': '5.250437930189106E-8',
          'Adjusted P-value': '1.6932662324859867E-5',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.8670351604483342',
          'Combined Score': '31.295932772536702',
          Genes: 'MTMR14;ORC5L;PHF7;MRPL35;YARS2;TMEM186;FARS2;1110032A03RIK;SPTLC1;1700023B02RIK;1700034H14RIK;SCRN3;CDK5RAP1;5430437P03RIK;RIOK2;CLCC1;MRPL9;TMED4;CNTD1;FKBPL;NSUN3;ZFYVE20;LRRC40;VPS13B;PEX1;ATAD3A;SLC25A16;RNF167;DALRD3;C1D;ANKRD42;A930041I02RIK;YME1L1;NDUFB6;COX15;CNO;1200014M14RIK;GLO1;MYNN;NOL7;2010309E21RIK;WDR24;4932432K03RIK;GK5;ZFP11;NFS1;EXOSC4;ARSK;PSMB1;SMYD4;NDUFV1;ZKSCAN1;DNAJC19;TRAP1;2510006D16RIK;KLHDC4;AFAP1L1;TOR1A;TMEM30A;FAHD1;TGDS;ADHFE1;WDR42A;SLC33A1;TIMM44;ALDH6A1;LYRM2;UBOX5;SLC7A6OS;RPS6KB1;AI931714;TOMM70A;DOLPP1;TSR2;4933407N01RIK;NUPL2'
        },
        {
          Term: 'PPARA 22158963 ChIP-Seq LIVER Mouse',
          Overlap: '68/2000',
          'P-value': '9.00131100406635E-7',
          'Adjusted P-value': '1.9352818658742652E-4',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.8133333333333335',
          'Combined Score': '25.24291542302984',
          Genes: 'MOBKL2B;D4BWG0951E;GBE1;CISD1;ZDHHC5;ADK;WDR89;TM7SF3;NR3C1;GYS2;SIP1;PGM2;PRKACA;SEPHS2;HIBCH;TMED4;NUDT12;CPT1A;IAH1;ARHGEF12;OXSM;LIFR;KMO;MUT;COQ10A;GORASP1;RAB1;TLCD1;SF1;ZFP106;ZFP787;ZFP148;BRI3;EI24;HPN;PROZ;CREBL2;PTTG1IP;VWCE;ZBTB44;ADH5;SRR;DDT;AFMID;HYI;MGAT1;SMYD4;ARSG;RILP;FN3K;RWDD3;TOR1A;ACBD4;TMEM30A;CRADD;FZD5;ADHFE1;FAH;2610528J11RIK;GNMT;LASS2;SLC25A39;SBK1;LYRM5;TOMM70A;RQCD1;CHPT1;SFXN5'
        },
        {
          Term: 'ZFX 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '95/3249',
          'P-value': '3.6944029074259367E-6',
          'Adjusted P-value': '5.957224688224323E-4',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.5594541910331383',
          'Combined Score': '19.506731557683565',
          Genes: '2610528K11RIK;RFESD;IPP;ZDHHC5;TM7SF3;YARS2;THTPA;SIP1;SIPA1L1;SCRN3;FBXO3;POLI;PGM2;AW209491;FBXO8;SEPHS2;FBXO9;SCYL1;CEP68;LYPLA1;FKBPL;OXSM;POLRMT;TMEM80;ATAD3A;ITFG1;VAMP8;4933403G14RIK;SMO;GORASP1;TFAM;MTFR1;2310026E23RIK;TLN1;ASF1A;RBKS;SF1;ZFP106;0610013E23RIK;ENY2;NLRX1;FECH;TM2D2;BRI3;CNO;GLO1;NOL7;2010309E21RIK;PTTG1IP;ACAA1A;ZBTB44;MAT2B;ADH5;5730403B10RIK;3110001I20RIK;ZFP11;2700038C09RIK;RDH14;AP4S1;PMS1;SAC3D1;ZKSCAN1;PAIP1;ZRSR1;DNAJC19;GADD45GIP1;TRAP1;RBM39;TOR1A;FAHD1;FZD5;MDH1;RHBDD3;WDR42A;AI316807;IFT122;PARP16;TIMM44;NAP1L1;PAICS;MCAT;DNAJC18;LASS2;GSTZ1;CDAN1;PSMC6;SLC25A39;RPS6KB1;AGBL3;TSR2;RQCD1;FBXL3;ACO1;NUPL2;ZCCHC3'
        },
        {
          Term: 'NELFA 20434984 ChIP-Seq ESCs Mouse',
          Overlap: '65/2000',
          'P-value': '7.397028230119321E-6',
          'Adjusted P-value': '9.542166416853925E-4',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.7333333333333334',
          'Combined Score': '20.47834919682524',
          Genes: 'TPMT;RFESD;IPP;ZDHHC5;ORC5L;NUDT6;YARS2;RABEPK;LRRC1;SIP1;ABHD11;1700023B02RIK;2810432D09RIK;CDK5RAP1;POLI;CLCC1;MRPL9;PRKACA;SEPHS2;TMED4;CEP68;SLC30A6;ZFP655;NSUN3;ATAD3A;CAT;RAB1;ATP6V1B2;TFAM;MTFR1;SF1;ZFP148;LRRC56;0610013E23RIK;ZFP748;FECH;NDUFB6;PTTG1IP;ADH5;ZFP11;ATXN2;NFS1;EXOSC4;PSMB1;METTL8;PMS1;SAC3D1;GADD45GIP1;TRAP1;RBM39;TOR1A;FZD5;TGDS;WDR42A;PAICS;MPP7;CDAN1;SLC7A6OS;SLC25A39;RPS6KB1;AI931714;DMXL1;RQCD1;NAT9;A230062G08RIK'
        },
        {
          Term: 'RXR 22158963 ChIP-Seq LIVER Mouse',
          Overlap: '64/2000',
          'P-value': '1.4396084359822136E-5',
          'Adjusted P-value': '0.0015475790686808797',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.7066666666666668',
          'Combined Score': '19.026866018672493',
          Genes: 'D4BWG0951E;CISD1;ADK;PCSK7;WDR89;TM7SF3;PITPNC1;GYS2;SIP1;SCP2;NAGLU;PGM2;HIBCH;FBXO9;NUDT12;CPT1A;LYPLA1;IAH1;ARHGEF12;LIFR;KMO;COQ10A;PLSCR2;GORASP1;TFAM;ZFP148;FECH;BRI3;CNO;GLO1;EI24;HPN;PTTG1IP;ACAA1A;ZBTB44;ADH5;ATXN2;AFMID;HYI;MGAT1;ARSG;RILP;BC016495;FN3K;RWDD3;TOR1A;ACBD4;TMEM30A;FAHD1;CRADD;FZD5;LRRC61;AI316807;PARP16;FAH;GNMT;LASS2;SLC25A39;SBK1;TCN2;LYRM5;TOMM70A;CHPT1;NOTUM'
        },
        {
          Term: 'SRF 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '55/1634',
          'P-value': '1.5756659278781175E-5',
          'Adjusted P-value': '0.0014518636049734082',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.795185638514892',
          'Combined Score': '19.851607046546025',
          Genes: '1810049H13RIK;OSGEPL1;TPMT;RFESD;CISD1;ORC5L;TFB1M;NUDT6;PCMTD2;THTPA;SIP1;NAGLU;CDK5RAP1;POLI;RIOK2;AW209491;FBXO9;OXSM;ABHD14A;PEX1;WDR34;ATP6V1B2;ZFP106;LIPT1;FECH;STXBP2;MYNN;ARHGAP18;CREBL2;MAT2B;NFS1;SRR;EXOSC4;AFMID;TASP1;SMYD4;METTL8;SIAE;RILP;SAC3D1;ZKSCAN1;TRAP1;ACBD4;TGDS;SLC33A1;IFT122;TIMM44;DHRS1;PLEKHA7;2410012H22RIK;DNAJC18;AI931714;PKIG;SFXN5;FBXL6'
        },
        {
          Term: 'MYC 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '94/3413',
          'P-value': '4.829675500066335E-5',
          'Adjusted P-value': '0.0038939258719284824',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4688934466256471',
          'Combined Score': '14.598077801012048',
          Genes: '1810049H13RIK;RFESD;ADK;ORC5L;TFB1M;PHF7;NR3C1;NUDT6;YARS2;RABEPK;THTPA;1110032A03RIK;3110057O12RIK;SIP1;ABHD11;NAGLU;H2AFJ;1700034H14RIK;2810432D09RIK;CDK5RAP1;SLC25A40;POLI;PGM2;RIOK2;AW209491;FBXO8;SEPHS2;TRIM23;FBXO9;4732466D17RIK;CEP68;ZFP655;LRRC40;LIFR;ABHD14A;PEX1;WDR34;KMO;TMEM80;ATAD3A;MUT;D730039F16RIK;WBSCR18;RNF167;DALRD3;TMBIM4;NME7;YME1L1;RBKS;ZFP106;ZFP148;ENY2;NDUFB6;NOL7;ZBTB44;MAT2B;ADH5;NFS1;EXOSC4;ARSK;AFMID;PSMB1;TXNDC4;TASP1;SMYD4;SAC3D1;TRAP1;RBM39;KLHDC4;FAHD1;FZD5;RHBDD3;ADHFE1;SLC33A1;2410166I05RIK;AI316807;4632404H12RIK;TIMM44;PAICS;TNFSF5IP1;GSTZ1;ALDH6A1;UBOX5;SLC7A6OS;SLC25A39;RPS6KB1;TOMM70A;4833426J09RIK;TSR2;RQCD1;ACO1;NUPL2;A230062G08RIK;FBXL6'
        },
        {
          Term: 'TRIM28 19339689 ChIP-ChIP MESCs Mouse',
          Overlap: '84/3072',
          'P-value': '1.7784508719312757E-4',
          'Adjusted P-value': '0.012745564582174143',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4583333333333335',
          'Combined Score': '12.59212162143254',
          Genes: 'OSGEPL1;D4BWG0951E;IPP;VLDLR;YARS2;RABEPK;FARS2;1110032A03RIK;AKR7A5;KDR;CDK5RAP1;PMPCB;SLC25A40;RIOK2;CLCC1;MRPL9;HOXA7;NEO1;FBXO9;CEP68;ZFP655;LYPLA1;ARHGEF12;WDR20A;LRRC40;LIFR;OVOL1;WDR34;KMO;TMEM80;ATAD3A;ITFG1;4933403G14RIK;SLC25A16;RNF167;SMO;RAB1;ATP6V1B2;YME1L1;MTFR1;2310026E23RIK;TLN1;ASF1A;RBKS;SF1;ATPAF1;ZFP106;TM2D2;NOL7;PTTG1IP;ACAA1A;ZBTB44;ADH5;4932432K03RIK;HYI;LRRC8A;BPNT1;CD55;PMS1;SAC3D1;BC016495;RBM39;TMEM86A;KLHDC4;FZD5;TGDS;ADHFE1;2410166I05RIK;CABLES1;NAP1L1;DHRS1;ELL3;TNFSF5IP1;KLF1;LASS2;GSTZ1;LYRM2;SLC7A6OS;DOLPP1;RQCD1;ACO1;FGFR4;ZCCHC3;FBXL6'
        },
        {
          Term: 'ESRRB 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '45/1434',
          'P-value': '4.744537410263771E-4',
          'Adjusted P-value': '0.030602266296201323',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.6736401673640167',
          'Combined Score': '12.808948007699778',
          Genes: 'ZFP106;ZFP787;NLRX1;ZDHHC5;PCSK7;MAT2B;5730403B10RIK;2700038C09RIK;NFS1;SIPA1L1;ABHD11;DDT;PGM2;RDH14;AP4S1;NDUFV1;NUDT12;CEP68;FN3K;ZFP655;CPT1A;FAHD1;FZD5;MDH1;AI316807;PARP16;4632404H12RIK;TIMM44;POLRMT;PAICS;ATAD3A;COQ10A;C330002I19RIK;ALDH1A3;CDAN1;PLSCR2;LYRM5;TOMM70A;TFAM;ACO1;CHPT1;TLCD1;A230062G08RIK;SFXN5;ATPAF1'
        },
        {
          Term: 'ERG 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '57/1969',
          'P-value': '6.197295711736604E-4',
          'Adjusted P-value': '0.03633868849154645',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.54393092940579',
          'Combined Score': '11.403824858220045',
          Genes: 'OSGEPL1;IPP;NXT2;THTPA;SIPA1L1;ABHD11;NAGLU;H2AFJ;5430437P03RIK;PMPCB;SLC25A40;AW209491;FBXO8;SLC30A6;LYPLA1;TMEM80;RNF167;SMO;NME7;4930432O21RIK;ATP6V1B2;YME1L1;MTFR1;TLCD1;SF1;ATPAF1;LIPT1;LRRC56;ENY2;2700046G09RIK;TM2D2;PTTG1IP;ZBTB44;WDR24;4932438A13RIK;EXOSC4;AFMID;MYO6;RDH14;MGAT1;SMYD4;AP4S1;METTL8;ZKSCAN1;PAIP1;ZRSR1;TMEM86A;ASCC1;IFT122;CABLES1;PAICS;LYRM2;LYRM5;AGBL3;TOMM70A;ACO1;TRIM37'
        },
        {
          Term: 'MYC 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '38/1200',
          'P-value': '0.0011252708622883276',
          'Adjusted P-value': '0.06048330884799761',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.688888888888889',
          'Combined Score': '11.46710209872977',
          Genes: 'ZFP106;ENY2;RFESD;ADK;NOL7;ORC5L;NUDT6;YARS2;EXOSC4;POLI;AP4S1;AW209491;SAC3D1;RBM39;FAHD1;RHBDD3;LRRC40;PEX1;TMEM80;PAICS;MCAT;ATAD3A;TNFSF5IP1;C330002I19RIK;LASS2;GORASP1;TOMM70A;4833426J09RIK;RAB1;RQCD1;TFAM;YME1L1;FBXL3;TLCD1;NUPL2;ZCCHC3;A230062G08RIK;SF1'
        },
        {
          Term: 'PPARG 23326641 ChIP-Seq C3H10T1-2 Mouse',
          Overlap: '29/838',
          'P-value': '0.001184004519106533',
          'Adjusted P-value': '0.05874483960182413',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.8456642800318217',
          'Combined Score': '12.43766013337948',
          Genes: 'ZFP106;CISD1;NOL7;ACAA1A;NR3C1;YARS2;PCMTD2;1700034H14RIK;BPNT1;MRPL9;TRIM23;FBXO9;TMED4;TRAP1;KLHDC4;ACBD4;TMEM30A;ASCC1;WDR42A;ZFYVE20;WDR34;POLRMT;MCAT;NSMCE4A;TMBIM4;RPS6KB1;C1D;RQCD1;SF1'
        },
        {
          Term: 'GATA4 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '55/2039',
          'P-value': '0.003721089153827281',
          'Adjusted P-value': '0.17143589315847116',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4386136995259113',
          'Combined Score': '8.047229370330717',
          Genes: '1810049H13RIK;RFESD;GBE1;CISD1;ADK;NR3C1;MRPL35;YARS2;PITPNC1;THTPA;SIPA1L1;SCRN3;CDK5RAP1;MRPL9;FBXO8;NEO1;B3BP;CPT1A;OXSM;COQ10A;VAMP8;PRPF18;PLSCR2;COL4A4;UFC1;ATP6V1B2;ZFP650;NLRX1;FECH;MYNN;CREBL2;ADH5;ZFP11;ATXN2;TASP1;AP4S1;BPNT1;METTL8;RILP;SAC3D1;ZKSCAN1;ZRSR1;CRADD;FZD5;RHBDD3;SLC33A1;LRRC61;PLEKHA7;PSMC6;TOMM70A;4833426J09RIK;RQCD1;FGFR4;SFXN5;FBXL6'
        },
        {
          Term: 'TAF7L 23326641 ChIP-Seq C3H10T1-2 Mouse',
          Overlap: '29/912',
          'P-value': '0.0040525234318865505',
          'Adjusted P-value': '0.17425850757112166',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.6959064327485383',
          'Combined Score': '9.3417573185024',
          Genes: 'COX15;GBE1;NOL7;GYS2;2700038C09RIK;ATXN2;SIPA1L1;PGM2;MGAT1;PRKACA;DNAJC19;ZFP655;RBM39;ACBD4;CRADD;ENTPD5;OXSM;ADHFE1;PARP16;FAH;2610036D13RIK;ALDH6A1;SLC25A39;TOMM70A;4833426J09RIK;CAT;RQCD1;PKIG;SF1'
        },
        {
          Term: 'MYC 19030024 ChIP-ChIP MESCs Mouse',
          Overlap: '93/3868',
          'P-value': '0.005105209287089083',
          'Adjusted P-value': '0.20580374938577864',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.282316442605998',
          'Combined Score': '6.767417116159038',
          Genes: 'ZDHHC5;ADK;ORC5L;TFB1M;PHF7;TM7SF3;NXT2;NUDT6;YARS2;RABEPK;TMEM186;THTPA;1110032A03RIK;ABHD11;H2AFJ;1700034H14RIK;2810432D09RIK;CDK5RAP1;5430437P03RIK;SLC25A40;POLI;RIOK2;MRPL9;AW209491;FBXO8;SEPHS2;HIBCH;TRIM23;CEP68;SLC30A6;ZFP655;LRRC40;PEX1;WDR34;TMEM80;ATAD3A;D730039F16RIK;RNF167;DALRD3;TMBIM4;UFC1;ANKRD42;YME1L1;MTFR1;TLCD1;ZFP106;UNC119B;0610013E23RIK;ENY2;1200014M14RIK;MYNN;2010309E21RIK;MAT2B;ADH5;5730403B10RIK;PSMC3IP;ATXN2;NFS1;AFMID;PSMB1;MGAT1;AP4S1;BPNT1;METTL8;NDUFV1;ZKSCAN1;CCDC16;TRAP1;RBM39;KLHDC4;ACBD4;FAHD1;CRADD;FZD5;RHBDD3;TGDS;ADHFE1;WDR42A;2410166I05RIK;AI316807;TIMM44;NAP1L1;PAICS;SLC7A6OS;SLC25A39;LYRM5;TOMM70A;TSR2;RQCD1;FBXL3;TRIM37;SFXN5;BC038156'
        },
        {
          Term: 'TBP 23326641 ChIP-Seq C3H10T1-2 Mouse',
          Overlap: '32/1057',
          'P-value': '0.0053588759930145394',
          'Adjusted P-value': '0.20332205973496342',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.6146326080100915',
          'Combined Score': '8.442915568234609',
          Genes: 'ZFP787;LRRC56;D4BWG0951E;CISD1;MYNN;MAT2B;NR3C1;RABEPK;SIP1;RPS6KA5;SIPA1L1;H2AFJ;SCRN3;PSMB1;RIOK2;MGAT1;BPNT1;PRKACA;HOXA7;RBM39;CPT1A;ACBD4;FKBPL;ASCC1;ADHFE1;2410166I05RIK;TMEM80;COQ10A;D730039F16RIK;LASS2;DALRD3;TLCD1'
        },
        {
          Term: 'YY1 23942234 ChIP-Seq MYOBLASTS AND MYOTUBES Mouse',
          Overlap: '41/1466',
          'P-value': '0.006708443469209241',
          'Adjusted P-value': '0.24038589097999777',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.491587085038654',
          'Combined Score': '7.464480996638938',
          Genes: 'ZFP106;UNC119B;INTU;MYNN;ADK;ARHGAP18;MRPL35;YARS2;GPHN;FARS2;MIPOL1;GYS2;THTPA;GK5;ATXN2;SCP2;1700034H14RIK;PSMB1;5430437P03RIK;MRPL9;AW209491;GPR155;SCYL1;GADD45GIP1;RBM39;2510006D16RIK;TOR1A;TMEM30A;FAHD1;CRADD;RHBDD3;TGDS;WDR20A;TIMM44;PEX1;WDR34;ITFG1;PSMC6;UFC1;RAB1;YME1L1'
        },
        {
          Term: 'ZFP42 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '41/1480',
          'P-value': '0.007835166617888066',
          'Adjusted P-value': '0.2659832878177791',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4774774774774777',
          'Combined Score': '7.16448499602902',
          Genes: 'D4BWG0951E;ZBTB44;NR3C1;RABEPK;1110032A03RIK;NAGLU;H2AFJ;1700034H14RIK;AFMID;HOXA7;SEPHS2;HIBCH;FBXO9;CCDC16;RBM39;CNTD1;FAHD1;CRADD;RHBDD3;TGDS;ADHFE1;2410018G20RIK;2410166I05RIK;ZFYVE20;4632404H12RIK;ABHD14A;WDR34;KMO;TMEM80;ITFG1;LYRM2;DALRD3;NME7;LYRM5;UFC1;TSR2;YME1L1;MTFR1;ZCCHC3;RBKS;ATPAF1'
        },
        {
          Term: 'PDX1 19855005 ChIP-ChIP MIN6 Mouse',
          Overlap: '22/669',
          'P-value': '0.00803939405996906',
          'Adjusted P-value': '0.25927045843400215',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.753861484803189',
          'Combined Score': '8.459578229377302',
          Genes: 'CPT1A;ZFP148;0610013E23RIK;ENY2;FKBPL;2410166I05RIK;MYNN;ADK;IFT122;PAICS;ALDH6A1;ABHD11;NME7;ARSK;AFMID;RQCD1;POLI;RDH14;RIOK2;MTFR1;SFXN5;FBXL6'
        },
        {
          Term: 'MYCN 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '57/2261',
          'P-value': '0.01238879814922982',
          'Adjusted P-value': '0.38051308601205874',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3445378151260505',
          'Combined Score': '5.903815246685606',
          Genes: 'ZDHHC5;ADK;TFB1M;PHF7;PITPNC1;LRRC1;1110032A03RIK;1700023B02RIK;SLC25A40;RIOK2;MRPL9;PRKACA;FBXO8;SEPHS2;TRIM23;CEP68;SLC30A6;ZFP655;LYPLA1;NSUN3;LRRC40;WDR34;SLC25A16;RNF167;RAB1;MTFR1;RBKS;ZFP148;COX15;NOL7;CREBL2;ZBTB44;MAT2B;ADH5;5730403B10RIK;GK5;ATXN2;NFS1;EXOSC4;MGAT1;SMYD4;LRRC8A;GADD45GIP1;2510006D16RIK;KLHDC4;RHBDD3;SLC33A1;AI316807;4632404H12RIK;TIMM44;DHRS1;PAICS;ALDH6A1;SLC7A6OS;SLC25A39;RQCD1;NAT9'
        },
        {
          Term: 'CREM 20920259 ChIP-Seq GC1-SPG Mouse',
          Overlap: '128/5776',
          'P-value': '0.014577043210720474',
          'Adjusted P-value': '0.4273724032233957',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1819021237303786',
          'Combined Score': '4.997445461080956',
          Genes: 'OSGEPL1;IPP;CISD1;ZDHHC5;ORC5L;WDR89;NUDT6;YARS2;RPS6KA5;ABHD11;SLC25A40;PRKACA;FBXO8;SEPHS2;FBXO9;FKBPL;ENTPD5;WDR20A;ZFYVE20;UBE2E1;LIFR;OVOL1;TMEM80;SMO;ANKRD42;TFAM;ASF1A;SF1;ZFP106;ENY2;ZFP748;FECH;ABHD3;CNO;STXBP2;MYNN;PTTG1IP;ADH5;4932438A13RIK;ATXN2;MYO6;TASP1;RAB11FIP2;NDUFV1;ZRSR1;TRAP1;TMEM86A;KLHDC4;AFAP1L1;ACBD4;SLC33A1;LRRC61;AI316807;IFT122;TIMM44;PAICS;CDAN1;SLC7A6OS;DMXL1;FBXL3;PKIG;NAT9;ZCCHC3;MOBKL2B;ADK;TFB1M;RABEPK;GPHN;LRRC1;MED14;SPTLC1;H2AFJ;1700034H14RIK;SCRN3;RIOK2;NEO1;SCYL1;CEP68;ZFP655;LYPLA1;ARHGEF12;NSUN3;VPS13B;WDR34;2210016F16RIK;COQ10A;ITFG1;SLC25A16;NSMCE4A;GORASP1;C1D;UFC1;RAB1;ATP6V1B2;MTFR1;ATPAF1;ZFP787;NDUFB6;TM2D2;1110003E01RIK;NOL7;ZBTB44;5730403B10RIK;MIPOL1;PSMC3IP;GK5;ZFP11;MGAT1;SIAE;CD55;PAIP1;RBM39;TMEM30A;MDH1;CABLES1;NAP1L1;GSTZ1;SLC25A39;SBK1;RPS6KB1;AGBL3;TOMM70A;DOLPP1;RQCD1;TRIM37;CHPT1;NUPL2;1700001L05RIK'
        },
        {
          Term: 'GATA1 22383799 ChIP-Seq G1ME Mouse',
          Overlap: '51/2000',
          'P-value': '0.01460924646057298',
          'Adjusted P-value': '0.409694085524764',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3599999999999999',
          'Combined Score': '5.7474968588570015',
          Genes: 'MOBKL2B;RFESD;ZDHHC5;TM7SF3;C330018D20RIK;YARS2;PITPNC1;THTPA;SIPA1L1;NAGLU;CLCC1;FBXO9;ZFP775;OVOL1;WDR34;2210016F16RIK;KMO;COQ10A;2610036D13RIK;VAMP8;PLSCR2;TFAM;MTFR1;ASF1A;FECH;NDUFB6;MYNN;A930005H10RIK;PTTG1IP;DDT;MGAT1;LRRC8A;CD55;SAC3D1;ZKSCAN1;ZRSR1;FN3K;TRAP1;AFAP1L1;ACBD4;FAHD1;RHBDD3;PARP16;DHRS1;LASS2;LYRM2;CDAN1;TCN2;PKIG;ALDH8A1;1700001L05RIK'
        },
        {
          Term: 'SPI1 22790984 ChIP-Seq ERYTHROLEUKEMIA Mouse',
          Overlap: '50/1962',
          'P-value': '0.01573171244561298',
          'Adjusted P-value': '0.4227897719758488',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3591573224600748',
          'Combined Score': '5.643325454149536',
          Genes: '1810049H13RIK;MOBKL2B;MTMR14;IPP;ZDHHC5;WDR89;C330018D20RIK;YARS2;PITPNC1;3110057O12RIK;MED14;ABHD11;SCP2;1700034H14RIK;POLI;CLCC1;HIBCH;LYPLA1;CNTD1;NSUN3;UBE2E1;WDR34;KMO;ITFG1;SLC25A16;PRPF18;NME7;UFC1;TFAM;TLN1;SF1;ZFP148;ENY2;ZFP748;EXOSC4;ARSK;TASP1;MGAT1;NDUFV1;KLHDC4;RWDD3;TMEM30A;CRADD;FZD5;SLC33A1;LYRM2;SLC25A39;LYRM5;TOMM70A;FBXL6'
        },
        {
          Term: 'MYC 19079543 ChIP-ChIP MESCs Mouse',
          Overlap: '39/1458',
          'P-value': '0.01593518591357433',
          'Adjusted P-value': '0.4111277965702177',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4266117969821674',
          'Combined Score': '5.905068162898141',
          Genes: 'ORC5L;TM7SF3;WDR24;H2AFJ;1700034H14RIK;ARSK;2810432D09RIK;TASP1;BPNT1;AW209491;GADD45GIP1;B3BP;SLC30A6;ZFP655;2510006D16RIK;TMEM86A;KLHDC4;ACBD4;CRADD;RHBDD3;WDR42A;ZFYVE20;CABLES1;LIFR;WDR34;DHRS1;TMEM80;PAICS;ATAD3A;TNFSF5IP1;4933403G14RIK;CACNB4;SLC7A6OS;SLC25A39;TSR2;RQCD1;FBXL3;TRIM37;TLCD1'
        },
        {
          Term: 'EKLF 21900194 ChIP-Seq ERYTHROCYTE Mouse',
          Overlap: '34/1239',
          'P-value': '0.01692594112008821',
          'Adjusted P-value': '0.4198935393252652',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4635458703255313',
          'Combined Score': '5.969668748682724',
          Genes: 'FECH;EI24;STXBP2;ADK;ORC5L;C330018D20RIK;YARS2;PCMTD2;ABHD11;1700034H14RIK;2810432D09RIK;PMPCB;RIOK2;FN3K;ACBD4;ARHGEF12;FZD5;MDH1;UBE2E1;PARP16;TIMM44;NAP1L1;ATAD3A;NSMCE4A;DALRD3;SLC25A39;TMBIM4;TOMM70A;CAT;UFC1;RQCD1;FBXL3;SF1;FBXL6'
        },
        {
          Term: 'THAP11 20581084 ChIP-Seq MESCs Mouse',
          Overlap: '25/864',
          'P-value': '0.021602560542240464',
          'Adjusted P-value': '0.5160611685090777',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.5432098765432098',
          'Combined Score': '5.9181225736041885',
          Genes: 'ENY2;ZFP748;MYNN;CREBL2;5730403B10RIK;ARSK;PSMB1;TXNDC4;RDH14;METTL8;NDUFV1;TRIM23;TMED4;TRAP1;CNTD1;KLHDC4;MDH1;RHBDD3;TRPC2;COQ10A;DNAJC18;GSTZ1;RAB1;TLN1;SFXN5'
        },
        {
          Term: 'HOXB4 20404135 ChIP-ChIP EML Mouse',
          Overlap: '46/1824',
          'P-value': '0.02378824973918778',
          'Adjusted P-value': '0.5479793243491471',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.345029239766082',
          'Combined Score': '5.028477260765831',
          Genes: 'ZFP106;ZFP148;4732435N03RIK;TM2D2;CNO;1200014M14RIK;GLO1;MYNN;ORC5L;ARHGAP18;2010309E21RIK;MAT2B;YARS2;RABEPK;PITPNC1;FARS2;4932432K03RIK;RPS6KA5;ABHD11;1700034H14RIK;MYO6;PSMB1;TASP1;PGM2;AP4S1;LRRC8A;FBXO8;HIBCH;FBXO9;GADD45GIP1;ASCC1;ENTPD5;2410018G20RIK;2410166I05RIK;AI316807;4632404H12RIK;ATAD3A;LASS2;PRPF18;PLSCR2;4930432O21RIK;SYBL1;4933407N01RIK;PKIG;ASF1A;SF1'
        },
        {
          Term: 'CNOT3 19339689 ChIP-ChIP MESCs Mouse',
          Overlap: '40/1547',
          'P-value': '0.02407537331685835',
          'Adjusted P-value': '0.5354695099784013',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.379013143719026',
          'Combined Score': '5.138983239828119',
          Genes: 'ZFP106;TM2D2;D4BWG0951E;1110003E01RIK;ZDHHC5;NOL7;CREBL2;VLDLR;ZBTB44;YARS2;RABEPK;H2AFJ;1700034H14RIK;PMPCB;SMYD4;FBXO8;SEPHS2;PAIP1;CEP68;DNAJC19;ZFP655;RBM39;KLHDC4;TOR1A;TMEM30A;WDR20A;LRRC40;CABLES1;OVOL1;TMEM80;ITFG1;LYRM2;UBOX5;DALRD3;SMO;TMBIM4;DOLPP1;ATP6V1B2;ZCCHC3;RBKS'
        },
        {
          Term: 'HCFC1 20581084 ChIP-Seq MESCs Mouse',
          Overlap: '11/306',
          'P-value': '0.030236902687549725',
          'Adjusted P-value': '0.6500934077823192',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.9172113289760349',
          'Combined Score': '6.707732240517745',
          Genes: 'RNF167;RBM39;CNTD1;ENY2;KLHDC4;RPS6KB1;ARSK;NSUN3;FBXO8;POLRMT;TRIM23'
        },
        {
          Term: 'FOXO1 23066095 ChIP-Seq LIVER Mouse',
          Overlap: '12/347',
          'P-value': '0.03142612168807783',
          'Adjusted P-value': '0.6538660802842',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.8443804034582134',
          'Combined Score': '6.381769832413125',
          Genes: 'UNC119B;KLF12;NSMCE4A;SCP2;NAGLU;NPY;VPS13B;LIFR;ACAA1A;2610528J11RIK;KALRN;GNMT'
        },
        {
          Term: 'FOXO3 22982991 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '49/2000',
          'P-value': '0.03144010434025968',
          'Adjusted P-value': '0.6337146031083591',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3066666666666669',
          'Combined Score': '4.5206367638156895',
          Genes: 'OSGEPL1;IPP;PHF7;PCMTD2;MED14;RPS6KA5;SIPA1L1;SPTLC1;NAGLU;PGM2;AW209491;TMED4;CEP68;ZFP655;LYPLA1;NSUN3;ZFYVE20;LRRC40;VPS13B;2210016F16RIK;ITFG1;YME1L1;ENY2;INTU;NDUFB6;COX15;NOL7;CREBL2;PTTG1IP;ADH5;GK5;ZFP11;NFS1;MYO6;PSMB1;METTL8;DNAJC19;GADD45GIP1;RBM39;KLHDC4;RWDD3;RHBDD3;ASCC1;PAICS;LYRM2;LYRM5;DMXL1;TOMM70A;ACO1'
        },
        {
          Term: 'PPARG 19300518 ChIP-PET 3T3-L1 Mouse',
          Overlap: '10/272',
          'P-value': '0.03314425030050567',
          'Adjusted P-value': '0.6478194376917017',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.9607843137254903',
          'Combined Score': '6.680168671226536',
          Genes: 'AKR7A5;ACBD4;SLC9A6;D4BWG0951E;COX15;DOLPP1;PGM2;CHPT1;FAH;NDUFV1'
        },
        {
          Term: 'ESR1 17901129 ChIP-ChIP LIVER Mouse',
          Overlap: '14/444',
          'P-value': '0.04139546392267325',
          'Adjusted P-value': '0.7852963008860073',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.6816816816816815',
          'Combined Score': '5.3554565282096736',
          Genes: 'CPT1A;MOBKL2B;RWDD3;ARHGEF12;CRADD;EI24;PROZ;FAH;POLRMT;KMO;GNMT;PLSCR2;SEPHS2;NUDT12'
        },
        {
          Term: 'TCFAP2C 20176728 ChIP-ChIP TROPHOBLAST STEM CELLS Mouse',
          Overlap: '62/2667',
          'P-value': '0.04192495650095703',
          'Adjusted P-value': '0.7726170555176367',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2398450193725785',
          'Combined Score': '3.9326321919099096',
          Genes: 'OSGEPL1;PCSK7;TFB1M;YARS2;RABEPK;PITPNC1;LRRC1;RPS6KA5;ABHD11;KDR;NEO1;CEP68;B3BP;SLC30A6;CPT1A;ARHGEF12;LIFR;WDR34;TMEM80;ATAD3A;ALDH1A3;UFC1;RAB1;TFAM;A930041I02RIK;ZFP787;0610013E23RIK;CNO;GLO1;STXBP2;PTTG1IP;4932432K03RIK;TMEM166;EXOSC4;NPY;AFMID;TXNDC4;MGAT1;BPNT1;ZKSCAN1;GADD45GIP1;RBM39;ACBD4;RHBDD3;2410166I05RIK;LRRC61;CABLES1;TIMM44;FAH;PAICS;PLEKHA7;TNFSF5IP1;GNMT;LASS2;LYRM2;SLC25A39;RPS6KB1;TOMM70A;FBXL3;FGFR4;A230062G08RIK;SFXN5'
        },
        {
          Term: 'TBX5 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '54/2296',
          'P-value': '0.04699693708615145',
          'Adjusted P-value': '0.8420284561268802',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2543554006968642',
          'Combined Score': '3.8354084501712165',
          Genes: '1810049H13RIK;OSGEPL1;RFESD;PCSK7;PHF7;C330018D20RIK;NR3C1;YARS2;PITPNC1;FARS2;SIPA1L1;SPTLC1;SCRN3;SCYL1;CPT1A;LYPLA1;WDR20A;UBE2E1;WDR34;ITFG1;C330002I19RIK;D730039F16RIK;SLC25A16;ALDH1A3;PRPF18;TMBIM4;TMEM77;ATP6V1B2;ZFP787;NLRX1;NDUFB6;BRI3;STXBP2;KALRN;WDR24;ADH5;GK5;ZFP11;EXOSC4;AFMID;LRRC8A;ARSG;METTL8;SIAE;GPR155;PAIP1;FN3K;TRAP1;ACBD4;TIMM44;LASS2;SLC7A6OS;AI931714;AQP11'
        },
        {
          Term: 'NKX2-5 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '37/1507',
          'P-value': '0.055908838630780944',
          'Adjusted P-value': '0.9746270518068569',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.309444813094448',
          'Combined Score': '3.7764817858820035',
          Genes: 'LIPT1;1810049H13RIK;ZFP148;LRRC56;GBE1;1110003E01RIK;MYNN;ORC5L;ARHGAP18;CREBL2;ACAA1A;PITPNC1;PCMTD2;THTPA;ATXN2;CDK5RAP1;TXNDC4;TASP1;LRRC8A;METTL8;NEO1;RILP;PMS1;TRAP1;SLC33A1;2410166I05RIK;PEX1;COQ10A;PLEKHA7;C330002I19RIK;SLC25A16;PLSCR2;COL4A4;CHPT1;ASF1A;SFXN5;FBXL6'
        },
        {
          Term: 'SREBP2 21459322 ChIP-Seq LIVER Mouse',
          Overlap: '28/1095',
          'P-value': '0.060020779094687796',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3637747336377475',
          'Combined Score': '3.83638623255514',
          Genes: 'ENY2;USP34;NFS1;LRRC8A;2610019F03RIK;NDUFV1;RILP;SAC3D1;SCYL1;CEP68;CPT1A;LYPLA1;ZFP775;RHBDD3;TIMM44;OVOL1;COQ10A;MPP7;VAMP8;SMO;DOLPP1;C1D;RAB1;RQCD1;TLCD1;NOTUM;2310068J16RIK;SF1'
        },
        {
          Term: 'SREBP1 19666523 ChIP-Seq LIVER Mouse',
          Overlap: '20/738',
          'P-value': '0.06450401430054142',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4453477868112017',
          'Combined Score': '3.9617384930794866',
          Genes: 'ZFP106;ENY2;ARHGEF12;TMEM30A;ZFP748;MDH1;CNO;ZDHHC5;ZFYVE20;POLRMT;GPHN;ABHD11;TCN2;TMBIM4;1700034H14RIK;4833426J09RIK;MTFR1;BPNT1;NOTUM;SCYL1'
        },
        {
          Term: 'GFI1B 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '44/1871',
          'P-value': '0.06926399755668303',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2542312488865135',
          'Combined Score': '3.3485842447617813',
          Genes: 'ZFP148;2700046G09RIK;TM2D2;GBE1;IPP;ADK;NOL7;PCSK7;ACAA1A;ADH5;GK5;ATXN2;SIPA1L1;NAGLU;MYO6;RDH14;RIOK2;MGAT1;SMYD4;BPNT1;ARSG;MRPL9;HIBCH;BC016495;ZFP655;ACBD4;FAHD1;RHBDD3;LRRC61;LRRC40;PEX1;TMEM80;KLF1;LASS2;RNF167;LYRM2;SBK1;TMBIM4;PLSCR2;AGBL3;RAB1;ATP6V1B2;2310068J16RIK;ATPAF1'
        },
        {
          Term: 'NR0B1 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '40/1691',
          'P-value': '0.07550321567331243',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2615809185886064',
          'Combined Score': '3.259395269935305',
          Genes: 'ZFP106;ZFP148;NDUFB6;D4BWG0951E;ABHD3;MYNN;PTTG1IP;TMEM166;2700038C09RIK;ABHD11;AFMID;CDK5RAP1;TXNDC4;SLC25A40;PGM2;SEPHS2;CD55;4732466D17RIK;TRAP1;ZFP655;CPT1A;LYPLA1;FAHD1;ENTPD5;PARP16;LIFR;WDR34;KMO;PAICS;ELL3;UBOX5;DALRD3;SLC25A39;TCN2;TMEM77;LYRM5;ACO1;CHPT1;FBXL6;ATPAF1'
        },
        {
          Term: 'EOMES 20176728 ChIP-ChIP TSCs Mouse',
          Overlap: '41/1744',
          'P-value': '0.078023640592731',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.253822629969419',
          'Combined Score': '3.1981798153314602',
          Genes: 'ZFP148;MOBKL2B;MYNN;ORC5L;ARHGAP18;CREBL2;ZFAND1;PHF7;RABEPK;5730403B10RIK;LRRC1;SIP1;ESM1;AFMID;MGAT1;LRRC8A;METTL8;CD55;GADD45GIP1;B3BP;SLC30A6;RBM39;CRADD;ASCC1;2410166I05RIK;CABLES1;NAP1L1;PEX1;DHRS1;TMEM80;PAICS;TNFSF5IP1;2610036D13RIK;LASS2;RNF167;SLC25A39;TMBIM4;RQCD1;FBXL3;PKIG;FGFR4'
        },
        {
          Term: 'LXR 22158963 ChIP-Seq LIVER Mouse',
          Overlap: '46/2000',
          'P-value': '0.08502325044631551',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2266666666666668',
          'Combined Score': '3.0235254442859',
          Genes: '9030420J04RIK;FECH;BRI3;CNO;EI24;CISD1;ADK;ORC5L;PROZ;ARHGAP18;WDR89;NR3C1;TMEM186;DHTKD1;GYS2;ATXN2;SCP2;NAGLU;FBXO3;HYI;FBXO8;SEPHS2;RILP;CPT1A;KLF12;RWDD3;IAH1;TOR1A;FAHD1;CRADD;FZD5;MDH1;UBE2E1;AI316807;CABLES1;PARP16;LIFR;FAH;GNMT;SLC25A39;SMO;GORASP1;CAT;ACO1;NAT9;ALDH8A1'
        },
        {
          Term: 'VDR 23849224 ChIP-Seq CD4+ Human',
          Overlap: '50/2231',
          'P-value': '0.10402423723820828',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1952786493351262',
          'Combined Score': '2.7050725912151745',
          Genes: 'ADK;TM7SF3;MRPL35;RABEPK;RPS6KA5;SPTLC1;SCP2;H2AFJ;CDK5RAP1;PMPCB;SLC25A40;PGM2;FBXO8;KLF12;NSUN3;ZFYVE20;VPS13B;WDR34;SLC25A16;PRPF18;ATP6V1B2;YME1L1;LIPT1;FECH;NDUFB6;CNO;NOL7;CREBL2;WDR24;BPNT1;PMS1;ZKSCAN1;RBM39;RWDD3;ACBD4;CRADD;MDH1;SLC33A1;IFT122;NAP1L1;DHRS1;PAICS;ELL3;CDAN1;PSMC6;SLC7A6OS;SLC25A39;TOMM70A;FBXL3;NUPL2'
        },
        {
          Term: 'ELF1 17652178 ChIP-ChIP JURKAT Human',
          Overlap: '5/133',
          'P-value': '0.10540692884239275',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '2.0050125313283207',
          'Combined Score': '4.511131642091093',
          Genes: 'RNF167;TMBIM4;C1D;UFC1;SF1'
        },
        {
          Term: 'PRDM5 23873026 ChIP-Seq MEFs Mouse',
          Overlap: '25/1029',
          'P-value': '0.11219065080122037',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2957563977972142',
          'Combined Score': '2.8345391843961036',
          Genes: 'ENY2;TPMT;NDUFB6;TM2D2;GLO1;ZFAND1;NXT2;MED14;RIOK2;ZKSCAN1;TRIM23;LYPLA1;TOR1A;PEX1;MUT;TMLHE;SMO;SLC9A6;DOLPP1;ASB9;TSR2;ATP6V1B2;ACO1;TLN1;ASF1A'
        },
        {
          Term: 'CEBPB 24764292 ChIP-Seq MC3T3 Mouse',
          Overlap: '45/2000',
          'P-value': '0.11364909718997537',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2',
          'Combined Score': '2.6095676069881204',
          Genes: 'ZFP148;TM2D2;CNO;HPN;ADK;A930005H10RIK;SAT2;TM7SF3;TMEM186;PSMC3IP;PSMB1;2810432D09RIK;SMYD4;AP4S1;MRPL9;SEPHS2;PMS1;ZRSR1;FN3K;TRAP1;2510006D16RIK;TMEM86A;RWDD3;TOR1A;FAHD1;CRADD;RHBDD3;OXSM;IFT122;WDR34;MCAT;VAMP8;SLC25A16;RNF167;LYRM2;CDAN1;SLC25A39;SBK1;AGBL3;4930432O21RIK;NAT9;2310068J16RIK;RBKS;SF1;FBXL6'
        },
        {
          Term: 'NEUROD2 26341353 ChIP-Seq CORTEX Mouse',
          Overlap: '45/2000',
          'P-value': '0.11364909718997537',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2',
          'Combined Score': '2.6095676069881204',
          Genes: 'ZFP148;GLO1;IPP;NOL7;PROZ;VWCE;TFB1M;TM7SF3;KALRN;YARS2;PITPNC1;ATXN2;NAGLU;DDT;2810432D09RIK;LRRC8A;NDUFV1;RILP;CD55;PMS1;TRAP1;CPT1A;IAH1;ANXA13;CABLES1;NAP1L1;PEX1;KMO;ELL3;ITFG1;2610036D13RIK;DNAJC18;ALDH1A3;SLC25A39;TCN2;TMBIM4;RPS6KB1;DMXL1;TOMM70A;TSR2;ATP6V1B2;NOTUM;ASF1A;SF1;FBXL6'
        },
        {
          Term: 'STAT3 1855785 ChIP-Seq MESCs Mouse',
          Overlap: '15/572',
          'P-value': '0.12141305325714352',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3986013986013988',
          'Combined Score': '2.9490306061897344',
          Genes: 'TRAP1;ARHGEF12;ADHFE1;PARP16;ACAA1A;FAH;2610528J11RIK;DALRD3;SBK1;SCP2;ARSK;TFAM;RIOK2;ACO1;FBXL6'
        },
        {
          Term: 'HOXA2 22223247 ChIP-Seq E11.5 EMBRYO Mouse',
          Overlap: '2/38',
          'P-value': '0.1590885970005225',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '2.807017543859649',
          'Combined Score': '5.160123559601762',
          Genes: 'MYNN;ARHGAP18'
        },
        {
          Term: 'POU5F1 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '14/555',
          'P-value': '0.16189903774356496',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3453453453453454',
          'Combined Score': '2.449581075387796',
          Genes: 'TRAP1;SLC30A6;TIMM44;ZBTB44;PHF7;PAICS;5730403B10RIK;SLC25A39;TMBIM4;RPS6KB1;RIOK2;FBXO8;TLN1;ASF1A'
        },
        {
          Term: 'TAL1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '45/2067',
          'P-value': '0.1623173065703874',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1611030478955007',
          'Combined Score': '2.1111200893283213',
          Genes: 'LIPT1;ZFP148;ENY2;NDUFB6;TM2D2;CNO;GLO1;IPP;PCSK7;ZBTB44;WDR24;DHTKD1;AKR7A5;ATXN2;ABHD11;9230114K14RIK;HYI;RDH14;RIOK2;MGAT1;AW209491;SEPHS2;HIBCH;ZRSR1;CEP68;SLC30A6;ZFP655;CPT1A;RHBDD3;PARP16;TMEM80;D730039F16RIK;LASS2;VAMP8;LYRM2;PSMC6;SLC25A39;SMO;NME7;PLSCR2;LYRM5;DMXL1;C1D;RQCD1;ATPAF1'
        },
        {
          Term: 'YY1 21170310 ChIP-Seq MESCs Mouse',
          Overlap: '12/464',
          'P-value': '0.16445081658862415',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3793103448275863',
          'Combined Score': '2.4898534355662374',
          Genes: 'GK5;NFS1;NSMCE4A;INTU;1700034H14RIK;MYNN;UFC1;AW209491;NR3C1;FGFR4;YARS2;FARS2'
        },
        {
          Term: 'PADI4 21655091 ChIP-ChIP MCF-7 Human',
          Overlap: '24/1037',
          'P-value': '0.1690026314657464',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2343297974927678',
          'Combined Score': '2.1944421133294405',
          Genes: 'DNAJC19;ENY2;TMEM30A;NDUFB6;CISD1;ZDHHC5;VPS13B;NAP1L1;TMEM80;ALDH6A1;NFS1;TOMM70A;ARSK;C1D;ANKRD42;RQCD1;TFAM;RIOK2;MTFR1;TRIM37;SIAE;NDUFV1;HIBCH;SF1'
        },
        {
          Term: 'PPARD 23208498 ChIP-Seq MDA-MB-231 Human',
          Overlap: '13/516',
          'P-value': '0.17400929399332143',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3436692506459949',
          'Combined Score': '2.3496026229159237',
          Genes: 'DNAJC19;CPT1A;ENY2;STXBP2;ANXA13;VLDLR;MRPL35;TMEM186;MPP7;SLC7A6OS;H2AFJ;CAT;SCYL1'
        },
        {
          Term: 'E2F1 21310950 ChIP-Seq MCF-7 Human',
          Overlap: '26/1145',
          'P-value': '0.1810595790274124',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2110625909752548',
          'Combined Score': '2.069620147215723',
          Genes: 'ABHD3;LRRC1;PSMC3IP;RPS6KA5;SIPA1L1;MYO6;POLI;RIOK2;ARSG;SAC3D1;FBXO9;CEP68;FZD5;FKBPL;ZFYVE20;UBE2E1;PEX1;DHRS1;ATAD3A;ELL3;KLF1;ALDH6A1;SLC7A6OS;YME1L1;NUPL2;SFXN5'
        },
        {
          Term: 'KLF4 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '52/2444',
          'P-value': '0.18215693129675617',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1347517730496455',
          'Combined Score': '1.9323537061736653',
          Genes: 'LRRC1;1110032A03RIK;RPS6KA5;1700034H14RIK;CDK5RAP1;RIOK2;PRKACA;2610019F03RIK;SLC30A6;ZFP655;WDR20A;ATAD3A;ITFG1;SLC25A16;RNF167;TMEM77;RAB1;ANKRD42;ATP6V1B2;YME1L1;MTFR1;ZFP106;STXBP2;1110003E01RIK;MYNN;ZBTB44;ADH5;5730403B10RIK;GK5;ATXN2;SRR;AFMID;SMYD4;LRRC8A;METTL8;GPR155;2510006D16RIK;ACBD4;2410018G20RIK;LRRC61;PAICS;GNMT;LASS2;ALDH6A1;SLC7A6OS;SLC25A39;TOMM70A;4833426J09RIK;FBXL3;ACO1;FGFR4;FBXL6'
        },
        {
          Term: 'ASXL1 24218140 ChIP-Seq BMDM Mouse',
          Overlap: '19/807',
          'P-value': '0.1835897467295178',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.255679471292854',
          'Combined Score': '2.128441557243746',
          Genes: 'GADD45GIP1;ZFP787;LYPLA1;NLRX1;2700046G09RIK;TOR1A;FECH;COX15;PCSK7;ZBTB44;WDR34;ITFG1;TMBIM4;RAB11FIP2;PMS1;SAC3D1;HIBCH;SF1;SCYL1'
        },
        {
          Term: 'GABP 17652178 ChIP-ChIP JURKAT Human',
          Overlap: '23/1001',
          'P-value': '0.1840145854668619',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2254412254412255',
          'Combined Score': '2.0743536932657607',
          Genes: 'LIPT1;SLC30A6;KLHDC4;TMEM30A;OSGEPL1;MDH1;SLC33A1;VPS13B;WDR24;RNF167;PRPF18;EXOSC4;DALRD3;NME7;SCRN3;TOMM70A;PSMB1;ANKRD42;YME1L1;PMPCB;TASP1;FBXO8;ZKSCAN1'
        },
        {
          Term: 'KDM5B 21448134 ChIP-Seq MESCs Mouse',
          Overlap: '77/3724',
          'P-value': '0.18492188879642016',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1027568922305764',
          'Combined Score': '1.8612570850783705',
          Genes: 'CISD1;ORC5L;SAT2;TM7SF3;MRPL35;YARS2;RABEPK;PITPNC1;SIP1;MED14;FBXO3;PMPCB;RIOK2;CLCC1;MRPL9;PRKACA;HOXA7;NEO1;TRIM23;FBXO9;CEP68;ZFP655;CNTD1;ZFYVE20;LRRC40;LIFR;MUT;COQ10A;RAB1;ATP6V1B2;TFAM;YME1L1;MTFR1;TLN1;ASF1A;SF1;ATPAF1;ZFP106;ZFP148;GLO1;EI24;MYNN;NOL7;ZBTB44;MAT2B;ADH5;PSMC3IP;GK5;ATXN2;SRR;PSMB1;TASP1;MGAT1;SMYD4;BPNT1;ARSG;ZKSCAN1;DNAJC19;TRAP1;RBM39;KLHDC4;APOOL;MDH1;NAP1L1;PAICS;ELL3;GSTZ1;PSMC6;SLC7A6OS;SBK1;RPS6KB1;DMXL1;TOMM70A;RQCD1;AQP11;FBXL3;TRIM37'
        },
        {
          Term: 'MYBL2 22936984 ChIP-ChIP MESCs Mouse',
          Overlap: '48/2250',
          'P-value': '0.1890130122566404',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1377777777777778',
          'Combined Score': '1.8954688493495997',
          Genes: '2700046G09RIK;ZDHHC5;MYNN;2010309E21RIK;CREBL2;MAT2B;TFB1M;TM7SF3;NXT2;RABEPK;PITPNC1;PSMC3IP;SIP1;NFS1;SCP2;NAGLU;AFMID;SLC25A40;MGAT1;CLCC1;AW209491;FBXO8;HOXA7;SIAE;SAC3D1;TRIM23;CEP68;CCDC16;SLC30A6;RBM39;CPT1A;CNTD1;KLHDC4;TMEM30A;FZD5;WDR42A;LRRC40;LIFR;TIMM44;WDR34;ATAD3A;TNFSF5IP1;2410012H22RIK;D730039F16RIK;RAB1;TSR2;TLCD1;ZFP650'
        },
        {
          Term: 'NFI 21473784 ChIP-Seq ESCs Mouse',
          Overlap: '43/2000',
          'P-value': '0.19087353264532486',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1466666666666667',
          'Combined Score': '1.8990453527609459',
          Genes: 'INTU;D4BWG0951E;LRRC19;BRI3;ORC5L;A930005H10RIK;CREBL2;ZBTB44;MAT2B;LRRC1;ABHD11;SCRN3;FBXO3;TASP1;PGM2;RIOK2;HOXA7;METTL8;CD55;FBXO9;ZRSR1;DNAJC19;TRAP1;LYPLA1;KLF12;HSD3B2;SLC33A1;VPS13B;LIFR;DHRS1;PAICS;PLEKHA7;VAMP8;CDAN1;PRPF18;DALRD3;PLSCR2;AGBL3;RQCD1;ACO1;TLCD1;SFXN5;RBKS'
        },
        {
          Term: 'FOXP3 21729870 ChIP-Seq TREG Human',
          Overlap: '31/1404',
          'P-value': '0.194849232219506',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.177587844254511',
          'Combined Score': '1.925979290208361',
          Genes: 'ENY2;OSGEPL1;NDUFB6;GLO1;NXT2;NUDT6;WDR24;LRRC1;FARS2;PCMTD2;SPTLC1;SCP2;ARSK;RIOK2;LRRC8A;BPNT1;FBXO8;TRIM23;IAH1;ACBD4;CRADD;MDH1;FKBPL;RHBDD3;ZFYVE20;ATAD3A;UBOX5;PRPF18;NME7;TSR2;SFXN5'
        },
        {
          Term: 'PRDM16 22522345 ChIP-ChIP PALATE MESENCHYMAL Mouse',
          Overlap: '4/122',
          'P-value': '0.19627996011248997',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.748633879781421',
          'Combined Score': '2.8471488891415935',
          Genes: 'CACNB4;TOMM70A;KDR;NR3C1'
        },
        {
          Term: 'IRF8 22096565 ChIP-ChIP GC-B Mouse',
          Overlap: '18/772',
          'P-value': '0.20248551894437136',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2435233160621761',
          'Combined Score': '1.986014805859181',
          Genes: 'CCDC16;COX15;ENTPD5;OXSM;MAT2B;KMO;ELL3;FARS2;CLDN10;TMBIM4;H2AFJ;ARSK;4930432O21RIK;UFC1;METTL7A;FBXO8;A230062G08RIK;SF1'
        },
        {
          Term: 'TCF7L2 21901280 ChIP-Seq H4IIE Rat',
          Overlap: '23/1023',
          'P-value': '0.21216910114054377',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1990876507005541',
          'Combined Score': '1.8590315299344735',
          Genes: 'CPT1A;ENY2;FAHD1;FECH;BRI3;CNO;ENTPD5;MTMR14;ADK;CREBL2;TM7SF3;ADH5;GYS2;DEFB29;PSMC6;TMLHE;PSMB1;CDK5RAP1;TASP1;RAB11FIP2;SEPHS2;TRIM23;FBXO9'
        },
        {
          Term: 'POU5F1 18692474 ChIP-Seq MESCs Mouse',
          Overlap: '86/4232',
          'P-value': '0.2149124419461112',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0838059231253938',
          'Combined Score': '1.6663782473664006',
          Genes: '2610528K11RIK;D4BWG0951E;ADK;TFB1M;TM7SF3;YARS2;PITPNC1;1110032A03RIK;SIP1;RPS6KA5;ABHD11;H2AFJ;1700034H14RIK;2810432D09RIK;CDK5RAP1;PMPCB;SLC25A40;CLCC1;SCYL1;CEP68;B3BP;ZFP655;CPT1A;LYPLA1;CNTD1;KLF12;ARHGEF12;ZFYVE20;UBE2E1;LRRC40;WDR34;COQ10A;4933403G14RIK;CACNB4;DALRD3;TMEM77;RAB1;MTFR1;TLN1;ZFP650;ZFP148;ENY2;INTU;ZFP748;EI24;MYNN;NOL7;PROZ;ARHGAP18;2010309E21RIK;CREBL2;PTTG1IP;ZBTB44;MAT2B;GK5;2700038C09RIK;ATXN2;NFS1;EXOSC4;TXNDC4;GPR155;NDUFV1;SAC3D1;ZKSCAN1;BC016495;2510006D16RIK;KLHDC4;ACBD4;FZD5;2410018G20RIK;SLC33A1;LRRC61;AI316807;PARP16;FAH;PAICS;PLEKHA7;SBK1;DMXL1;ASB9;RQCD1;CLEC2H;FBXL3;FGFR4;ZCCHC3;FBXL6'
        },
        {
          Term: 'GABP 19822575 ChIP-Seq HepG2 Human',
          Overlap: '55/2639',
          'P-value': '0.21755653078700174',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1115321460149048',
          'Combined Score': '1.6954161481533194',
          Genes: 'RFESD;MTMR14;IPP;TFB1M;RABEPK;TMEM186;LRRC1;PCMTD2;THTPA;SPTLC1;SCRN3;CDK5RAP1;POLI;HIBCH;TRIM23;SLC30A6;ZFYVE20;VPS13B;POLRMT;ATAD3A;ITFG1;PRPF18;NSMCE4A;DALRD3;UFC1;TFAM;YME1L1;TLN1;COX15;NOL7;PTTG1IP;MAT2B;MIPOL1;PSMC3IP;ATXN2;EXOSC4;TASP1;RDH14;MGAT1;PMS1;ZKSCAN1;KLHDC4;TOR1A;TGDS;ASCC1;WDR42A;SLC33A1;PAICS;MCAT;UBOX5;TOMM70A;DOLPP1;TRIM37;NAT9;FBXL6'
        },
        {
          Term: 'E2F4 21247883 ChIP-Seq LYMPHOBLASTOID Human',
          Overlap: '62/2998',
          'P-value': '0.2180338348139494',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1029575272403824',
          'Combined Score': '1.679920149528875',
          Genes: 'CISD1;ZDHHC5;ADK;PCSK7;WDR89;TM7SF3;YARS2;GPHN;DHTKD1;ZC3H12C;RPS6KA5;H2AFJ;CLCC1;SEPHS2;ARHGEF12;LRRC40;TMEM80;ATAD3A;COQ10A;ITFG1;SLC25A16;RNF167;NSMCE4A;TMBIM4;TMEM77;TFAM;YME1L1;TLCD1;SF1;ATPAF1;LRRC56;COX15;EI24;ZBTB44;WDR24;ATXN2;SRR;SMYD4;RAB11FIP2;SIAE;NDUFV1;CD55;SAC3D1;KLHDC4;RWDD3;FAHD1;TGDS;ASCC1;WDR42A;PARP16;NAP1L1;DHRS1;FAH;ELL3;LASS2;GSTZ1;CDAN1;SLC7A6OS;SBK1;AQP11;FBXL3;CHPT1'
        },
        {
          Term: 'PPARG 20887899 ChIP-Seq 3T3-L1 Mouse',
          Overlap: '73/3565',
          'P-value': '0.21881989378273667',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0920991117344554',
          'Combined Score': '1.6594514699584122',
          Genes: 'D4BWG0951E;RFESD;MTMR14;WDR89;YARS2;TMEM186;3110057O12RIK;SIP1;ESM1;SIPA1L1;ABHD11;SCP2;1700034H14RIK;KDR;GYK;PMPCB;PGM2;RIOK2;MRPL9;HOXA7;ZFP655;CPT1A;LYPLA1;FKBPL;ENTPD5;VPS13B;PEX1;COQ10A;VAMP8;ALDH1A3;SMO;TMBIM4;PLSCR2;COL4A4;CAT;4930432O21RIK;YME1L1;UNC119B;ENY2;2700046G09RIK;CNO;EI24;1110003E01RIK;MYNN;CREBL2;ACAA1A;KALRN;ADH5;5730403B10RIK;MIPOL1;ATXN2;RDH14;MGAT1;NDUFV1;DNAJC19;TMEM86A;RWDD3;CRADD;APOOL;MDH1;ADHFE1;SLC33A1;AI316807;PARP16;PAICS;MPP7;TCN2;TOMM70A;DOLPP1;RQCD1;ACO1;PKIG;1700001L05RIK'
        },
        {
          Term: 'NANOG 21062744 ChIP-ChIP HESCs Human',
          Overlap: '19/840',
          'P-value': '0.23154568881475465',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2063492063492063',
          'Combined Score': '1.7648624276646483',
          Genes: 'FECH;TGDS;WDR20A;VLDLR;ZBTB44;MAT2B;COQ10A;4933403G14RIK;SBK1;TOMM70A;UFC1;RAB1;PMPCB;FBXL3;MGAT1;MTFR1;NOTUM;METTL8;SIAE'
        },
        {
          Term: 'CDX2 20551321 ChIP-Seq CACO-2 Human',
          Overlap: '12/504',
          'P-value': '0.2389888249527117',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2698412698412698',
          'Combined Score': '1.8175726802080354',
          Genes: 'SLC25A16;ABHD11;ARHGEF12;FZD5;ASCC1;NSUN3;CDK5RAP1;FBXO3;PKIG;NR3C1;FGFR4;ZKSCAN1'
        },
        {
          Term: 'CIITA 25753668 ChIP-Seq RAJI Human',
          Overlap: '11/459',
          'P-value': '0.24511301010462472',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2781408859840233',
          'Combined Score': '1.7971119825243773',
          Genes: 'RBM39;TOR1A;CRADD;DOLPP1;UFC1;PARP16;AP4S1;WDR34;NR3C1;ZCCHC3;FARS2'
        },
        {
          Term: 'SPI1 20176806 ChIP-Seq THIOMACROPHAGE Mouse',
          Overlap: '35/1654',
          'P-value': '0.2500221793701257',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.128577186618299',
          'Combined Score': '1.5644400698140837',
          Genes: 'UNC119B;3110048L19RIK;1110003E01RIK;IPP;ZDHHC5;NOL7;C330018D20RIK;FARS2;ZC3H12C;NFS1;SIPA1L1;EXOSC4;NAGLU;H2AFJ;2810432D09RIK;KDR;PRKACA;METTL8;TRIM23;BC016495;ACBD4;FKBPL;RHBDD3;ANXA13;IFT122;WDR34;DEFB29;SLC7A6OS;UFC1;RAB1;TSR2;CHPT1;RBKS;SF1;FBXL6'
        },
        {
          Term: 'EST1 17652178 ChIP-ChIP JURKAT Human',
          Overlap: '22/1001',
          'P-value': '0.25050182853661385',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1721611721611722',
          'Combined Score': '1.6226098859328921',
          Genes: 'CCDC16;ENY2;OSGEPL1;CRADD;MDH1;FKBPL;ZDHHC5;TNFSF5IP1;THTPA;RNF167;TMBIM4;NME7;C1D;UFC1;ANKRD42;TXNDC4;YME1L1;RIOK2;SYBL1;FBXO8;TRIM23;SF1'
        },
        {
          Term: 'HIF1A 21447827 ChIP-Seq MCF-7 Human',
          Overlap: '8/321',
          'P-value': '0.2561800604730816',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3291796469366564',
          'Combined Score': '1.8101761601956254',
          Genes: 'KLHDC4;OXSM;GBE1;C1D;UBE2E1;TRIM37;WDR89;SCYL1'
        },
        {
          Term: 'NFE2L2 20460467 ChIP-Seq MEFs Mouse',
          Overlap: '23/1055',
          'P-value': '0.2565141691979094',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1627172195892574',
          'Combined Score': '1.581959766610563',
          Genes: 'ZRSR1;CEP68;CPT1A;ZFP148;KLF12;APOOL;FKBPL;ENTPD5;GBE1;ADK;ARHGAP18;LIFR;PTTG1IP;MAT2B;2700038C09RIK;CAT;FBXL3;CHPT1;ALDH8A1;ASF1A;RBKS;PAIP1;SCYL1'
        },
        {
          Term: 'NRF2 20460467 ChIP-Seq MEFs Mouse',
          Overlap: '23/1055',
          'P-value': '0.2565141691979094',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1627172195892574',
          'Combined Score': '1.581959766610563',
          Genes: 'ZRSR1;CEP68;CPT1A;ZFP148;KLF12;APOOL;FKBPL;ENTPD5;GBE1;ADK;ARHGAP18;LIFR;PTTG1IP;MAT2B;2700038C09RIK;CAT;FBXL3;CHPT1;ALDH8A1;ASF1A;RBKS;PAIP1;SCYL1'
        },
        {
          Term: 'SIN3B 21632747 ChIP-Seq MESCs Mouse',
          Overlap: '86/4302',
          'P-value': '0.26732939225660834',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0661707732837442',
          'Combined Score': '1.4065710631138506',
          Genes: 'RFESD;ADK;YARS2;PITPNC1;FARS2;DHTKD1;THTPA;ESM1;SIPA1L1;SPTLC1;ABHD11;SCP2;1700034H14RIK;5430437P03RIK;PMPCB;POLI;RIOK2;MRPL9;PRKACA;AW209491;FBXO8;HOXA7;TMED4;KLF12;FKBPL;NSUN3;UBE2E1;LRRC40;LIFR;WDR34;2210016F16RIK;MUT;ITFG1;4933403G14RIK;PRPF18;C1D;UFC1;TFAM;2310068J16RIK;SF1;LIPT1;ZFP787;ZFP148;LRRC56;ENY2;2700046G09RIK;INTU;CNO;GLO1;EI24;STXBP2;1110003E01RIK;NOL7;PTTG1IP;WDR24;ADH5;GK5;EXOSC4;DDT;MGAT1;LRRC8A;SIAE;NDUFV1;CD55;ZRSR1;GADD45GIP1;KLHDC4;AFAP1L1;ASCC1;LRRC61;IFT122;TIMM44;NAP1L1;1810044D09RIK;DNAJC18;SLC25A39;SBK1;TCN2;LYRM5;AGBL3;TOMM70A;TSR2;RQCD1;AQP11;PKIG;SFXN5'
        },
        {
          Term: 'FLI1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '42/2030',
          'P-value': '0.2717126467640961',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.103448275862069',
          'Combined Score': '1.4378043772010938',
          Genes: 'ENY2;OSGEPL1;NDUFB6;ABHD3;STXBP2;MYNN;PTTG1IP;WDR24;PCMTD2;THTPA;EXOSC4;NAGLU;SCRN3;AFMID;5430437P03RIK;RIOK2;METTL8;ZKSCAN1;PAIP1;ZRSR1;ZFP655;TMEM86A;FAHD1;FKBPL;LRRC61;PARP16;PAICS;MUT;SLC25A16;RNF167;LYRM2;DALRD3;TMBIM4;NME7;PLSCR2;LYRM5;4930432O21RIK;C1D;RAB1;RQCD1;PKIG;ALDH8A1'
        },
        {
          Term: 'TCFCP2L1 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '41/1987',
          'P-value': '0.2807986231291022',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1004864955544373',
          'Combined Score': '1.3977471677741193',
          Genes: 'ENY2;TPMT;FECH;1200014M14RIK;ORC5L;MAT2B;NUDT6;YARS2;GPHN;3110001I20RIK;POLI;LRRC8A;SEPHS2;HIBCH;BC016495;4732466D17RIK;ZRSR1;B3BP;TRAP1;ZFP655;CPT1A;IAH1;AFAP1L1;TOR1A;ARHGEF12;RHBDD3;ENTPD5;ADHFE1;LRRC61;TMEM80;ELL3;ITFG1;GSTZ1;RNF167;SLC25A39;SBK1;RAB1;FBXL3;CHPT1;2310026E23RIK;ZCCHC3'
        },
        {
          Term: 'HNF4A 19761587 ChIP-ChIP CACO-2 Human',
          Overlap: '24/1126',
          'P-value': '0.286821768651912',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1367673179396094',
          'Combined Score': '1.4197021911558678',
          Genes: 'DNAJC19;LIPT1;FZD5;FKBPL;ZDHHC5;ARHGAP18;SAT2;TIMM44;NUDT6;LRRC1;VAMP8;WBSCR18;ATXN2;SLC9A6;DMXL1;TOMM70A;PSMB1;C1D;ASB9;CDK5RAP1;RQCD1;PMPCB;PKIG;TRIM23'
        },
        {
          Term: 'KDM6A 18722178 ChIP-ChIP U937 AND SAOS2 Human',
          Overlap: '11/479',
          'P-value': '0.28912608096293524',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2247738343771748',
          'Combined Score': '1.5198125669236378',
          Genes: 'WBSCR18;LIPT1;SLC7A6OS;MDH1;TOMM70A;WDR42A;MYNN;VLDLR;MRPL9;NXT2;MUT'
        },
        {
          Term: 'CEBPA 20513432 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '41/2000',
          'P-value': '0.2954779664777963',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0933333333333335',
          'Combined Score': '1.3329493692309025',
          Genes: 'ZFP148;ENY2;NLRX1;ABHD3;IPP;NOL7;ARHGAP18;PCSK7;ACAA1A;ZBTB44;WDR89;PHF7;NR3C1;WDR24;PSMC3IP;SIP1;ZFP11;NAGLU;NPY;AP4S1;RBM39;LYPLA1;WDR20A;ANXA13;ZFYVE20;NAP1L1;POLRMT;MCAT;MPP7;2610036D13RIK;VAMP8;LYRM2;CACNB4;TCN2;RPS6KB1;PLSCR2;AGBL3;TOMM70A;UFC1;RAB1;SF1'
        },
        {
          Term: 'SMC1 22415368 ChIP-Seq MEFs Mouse',
          Overlap: '41/2000',
          'P-value': '0.2954779664777963',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0933333333333335',
          'Combined Score': '1.3329493692309025',
          Genes: 'CNO;RFESD;1110003E01RIK;NOL7;ARHGAP18;CREBL2;NR3C1;PITPNC1;FARS2;PSMC3IP;ZC3H12C;ATXN2;RPS6KA5;SIPA1L1;NAGLU;DDT;2810432D09RIK;MRPL9;HOXA7;NDUFV1;TMED4;ZRSR1;GADD45GIP1;KLHDC4;IAH1;ACBD4;ARHGEF12;FAHD1;CRADD;FZD5;FKBPL;ADHFE1;CABLES1;2210016F16RIK;DHRS1;PSMC6;SLC25A39;RAB1;TLCD1;NOTUM;FBXL6'
        },
        {
          Term: 'HOXC9 25013753 ChIP-Seq NEUROBLASTOMA BE2-C Human',
          Overlap: '41/2014',
          'P-value': '0.31160316432990887',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0857332009268454',
          'Combined Score': '1.265991849250522',
          Genes: 'INTU;GLO1;NOL7;ARHGAP18;MRPL35;TMEM186;SIP1;SCP2;H2AFJ;PSMB1;CDK5RAP1;TASP1;RDH14;MGAT1;CLCC1;MRPL9;SEPHS2;NDUFV1;ZKSCAN1;TMED4;CEP68;DNAJC19;SLC30A6;KLF12;FAHD1;FKBPL;TGDS;NSUN3;ZFYVE20;UBE2E1;TIMM44;WDR34;ATAD3A;MUT;UBOX5;PRPF18;PSMC6;NME7;CAT;YME1L1;ZCCHC3'
        },
        {
          Term: 'FLI1 27457419 Chip-Seq LIVER Mouse',
          Overlap: '9/393',
          'P-value': '0.3183797474552143',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2213740458015268',
          'Combined Score': '1.3978753395707895',
          Genes: 'LIPT1;LYPLA1;OSGEPL1;FZD5;ADHFE1;COL4A4;RQCD1;PMS1;HIBCH'
        },
        {
          Term: 'CHD1 19587682 ChIP-ChIP MESCs Mouse',
          Overlap: '18/843',
          'P-value': '0.31916638373439704',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1387900355871887',
          'Combined Score': '1.3005468846322583',
          Genes: 'ZFP106;LIPT1;RFESD;EI24;ZDHHC5;MYNN;MCAT;YARS2;MUT;KLF1;SIP1;SLC25A39;UFC1;SLC25A40;RIOK2;BPNT1;TRIM37;FBXO9'
        },
        {
          Term: 'IRF4 20064451 ChIP-Seq CD4+T Mouse',
          Overlap: '21/1000',
          'P-value': '0.32746970943625675',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.12',
          'Combined Score': '1.2503228846699261',
          Genes: 'SLC30A6;KLF12;IAH1;AFAP1L1;ADK;FAH;NR3C1;YARS2;PLEKHA7;MIPOL1;CLDN10;PRPF18;C1D;ANKRD42;RDH14;RIOK2;ACO1;ALDH8A1;NDUFV1;NEO1;SFXN5'
        },
        {
          Term: 'CBP 20019798 ChIP-Seq JUKART Human',
          Overlap: '21/1000',
          'P-value': '0.32746970943625675',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.12',
          'Combined Score': '1.2503228846699261',
          Genes: 'SLC30A6;KLF12;IAH1;AFAP1L1;ADK;FAH;NR3C1;YARS2;PLEKHA7;MIPOL1;CLDN10;PRPF18;C1D;ANKRD42;RDH14;RIOK2;ACO1;ALDH8A1;NDUFV1;NEO1;SFXN5'
        },
        {
          Term: 'ASH2L 23239880 ChIP-Seq MESCs Mouse',
          Overlap: '66/3336',
          'P-value': '0.33547942918156576',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.05515587529976',
          'Combined Score': '1.1524355896417597',
          Genes: 'IPP;ZDHHC5;ADK;WDR89;TFB1M;MRPL35;TMEM186;GPHN;PITPNC1;LRRC1;SIP1;FBXO3;SLC25A40;POLI;RIOK2;FBXO8;NUDT12;ZFP655;KLF12;IAH1;ARHGEF12;NSUN3;VPS13B;LIFR;TMEM80;2610036D13RIK;VAMP8;PRPF18;TMBIM4;UFC1;TLCD1;TLN1;ZFP148;INTU;3110048L19RIK;9030420J04RIK;NDUFB6;HPN;NOL7;ARHGAP18;CREBL2;MAT2B;ADH5;5730403B10RIK;ZFP11;EXOSC4;ARSK;ARSG;NDUFV1;CD55;PMS1;ZKSCAN1;DNAJC19;TRAP1;RBM39;CRADD;MDH1;SLC33A1;IFT122;FAH;MPP7;GSTZ1;UBOX5;CHPT1;NUPL2;ZCCHC3'
        },
        {
          Term: 'SALL4 18804426 ChIP-ChIP XEN Mouse',
          Overlap: '21/1005',
          'P-value': '0.33573862200685134',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1144278606965174',
          'Combined Score': '1.2163114550601417',
          Genes: 'B3BP;LYPLA1;LRRC56;2610528K11RIK;FAHD1;CNO;1110003E01RIK;LRRC61;PARP16;PAICS;PCMTD2;VAMP8;ALDH6A1;TMEM77;MYO6;CAT;ANKRD42;AQP11;2310026E23RIK;TLN1;FGFR4'
        },
        {
          Term: 'SALL4 22934838 ChIP-ChIP CD34+ Human',
          Overlap: '29/1418',
          'P-value': '0.3401486138970356',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0907381288199343',
          'Combined Score': '1.1762221742576524',
          Genes: 'NDUFB6;TM2D2;IPP;ARHGAP18;TFB1M;PHF7;NR3C1;FARS2;PCMTD2;ESM1;MYO6;TXNDC4;RIOK2;CPT1A;KLF12;RWDD3;CRADD;MDH1;TGDS;SLC33A1;ZFYVE20;IFT122;VPS13B;PARP16;PEX1;LRRC44;DNAJC18;WBSCR18;DMXL1'
        },
        {
          Term: 'ERG 20517297 ChIP-Seq VCAP Human',
          Overlap: '22/1062',
          'P-value': '0.3454228895177411',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1048336472065288',
          'Combined Score': '1.1744225290229806',
          Genes: 'LYPLA1;ENY2;AFAP1L1;TOR1A;GBE1;VPS13B;ZBTB44;MAT2B;OVOL1;DHRS1;GPHN;UBOX5;PSMC6;ARSK;ANKRD42;MGAT1;ACO1;MTFR1;TLCD1;SEPHS2;SF1;PAIP1'
        },
        {
          Term: 'BCL3 23251550 ChIP-Seq MUSCLE Mouse',
          Overlap: '18/858',
          'P-value': '0.3460612896050687',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.118881118881119',
          'Combined Score': '1.187288819048413',
          Genes: 'ZFP787;RBM39;FAHD1;TPMT;GBE1;MTMR14;LRRC61;ACAA1A;COQ10A;SRR;CDAN1;DALRD3;NME7;CDK5RAP1;UFC1;LRRC8A;CLCC1;HOXA7'
        },
        {
          Term: 'HNF4A 19822575 ChIP-Seq HepG2 Human',
          Overlap: '117/6083',
          'P-value': '0.38841912450494975',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.02580963340457',
          'Combined Score': '0.970077708460774',
          Genes: 'OSGEPL1;IPP;ZDHHC5;ORC5L;SAT2;NR3C1;SCP2;NAGLU;CDK5RAP1;SEPHS2;TRIM23;SLC30A6;CPT1A;ENTPD5;ANXA13;ZFYVE20;LIFR;POLRMT;CACNB4;SMO;TMEM77;COL4A4;YME1L1;TLN1;GLO1;HPN;PROZ;ARHGAP18;CREBL2;PTTG1IP;KALRN;ATXN2;TASP1;SMYD4;AP4S1;ARSG;ZKSCAN1;FN3K;TRAP1;AFAP1L1;CRADD;FZD5;WDR42A;SLC33A1;LRRC61;IFT122;LASS2;ALDH6A1;UBOX5;DMXL1;ACO1;PKIG;NAT9;FGFR4;ZCCHC3;SFXN5;MOBKL2B;GBE1;USP34;ADK;VLDLR;TFB1M;RABEPK;TMEM186;GPHN;PITPNC1;LRRC1;FARS2;THTPA;SIPA1L1;SCRN3;GAL3ST2;NEO1;HIBCH;SCYL1;CEP68;KLF12;ARHGEF12;LRRC40;VPS13B;PEX1;WDR34;SLC25A16;PRPF18;NSMCE4A;NME7;CAT;UFC1;MTFR1;RBKS;NDUFB6;NOL7;VWCE;MIPOL1;PSMC3IP;GK5;EXOSC4;MGAT1;LRRC8A;BPNT1;METTL7A;METTL8;PMS1;RBM39;RWDD3;CABLES1;DHRS1;FAH;PLEKHA7;TOMM70A;DOLPP1;ASB9;RQCD1;AQP11;TRIM37;CHPT1;ALDH8A1'
        },
        {
          Term: 'TP53 22573176 ChIP-Seq HFKS Human',
          Overlap: '27/1348',
          'P-value': '0.3891229128662436',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0682492581602374',
          'Combined Score': '1.0082777596489663',
          Genes: 'EI24;USP34;ADK;TM7SF3;NR3C1;PCMTD2;RPS6KA5;SIPA1L1;MYO6;AP4S1;ARSG;METTL7A;HOXA7;GPR155;NEO1;RILP;SAC3D1;PAIP1;GADD45GIP1;ARHGEF12;TGDS;ASCC1;TRPC2;TCN2;TRIM37;TLN1;PKIG'
        },
        {
          Term: 'WT1 20215353 ChIP-ChIP NEPHRON PROGENITOR Mouse',
          Overlap: '33/1663',
          'P-value': '0.39258557195759547',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.05832832230908',
          'Combined Score': '0.9895377727723869',
          Genes: 'ZFP148;MOBKL2B;BRI3;1110003E01RIK;ARHGAP18;VLDLR;MAT2B;RABEPK;5730403B10RIK;GPHN;PITPNC1;TMEM166;ATXN2;FBXO3;MGAT1;AP4S1;PRKACA;SIAE;NEO1;FN3K;TRAP1;RBM39;TMEM86A;FAHD1;UBE2E1;OVOL1;WDR34;VAMP8;SLC25A39;SMO;ATP6V1B2;AQP11;ZCCHC3'
        },
        {
          Term: 'CCND1 20090754 ChIP-ChIP RETINA Mouse',
          Overlap: '42/2137',
          'P-value': '0.3968557378702381',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0481984089845577',
          'Combined Score': '0.9687265684743005',
          Genes: 'LRRC56;NDUFB6;ZDHHC5;MYNN;ACAA1A;MAT2B;TFB1M;PITPNC1;PCMTD2;SIP1;2700038C09RIK;ABHD11;DDT;1700034H14RIK;ARSK;AFMID;PMPCB;PGM2;MGAT1;FBXO8;TRIM23;FBXO9;ACBD4;FAHD1;RHBDD3;SLC33A1;IFT122;TMEM80;PAICS;MUT;RNF167;ALDH6A1;SBK1;TOMM70A;DOLPP1;4833426J09RIK;RAB1;RQCD1;TLCD1;TLN1;SFXN5;SF1'
        },
        {
          Term: 'STAT5 23275557 ChIP-Seq MAMMARY-EPITHELIUM Mouse',
          Overlap: '24/1197',
          'P-value': '0.39688739984836746',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0693400167084377',
          'Combined Score': '0.9881799604192706',
          Genes: 'FN3K;MOBKL2B;NLRX1;ADHFE1;VPS13B;PARP16;TIMM44;2210016F16RIK;YARS2;TMEM186;D730039F16RIK;PSMC6;ABHD11;TCN2;PLSCR2;CDK5RAP1;ATP6V1B2;POLI;RIOK2;CLCC1;TLN1;GPR155;NDUFV1;HIBCH'
        },
        {
          Term: 'SOX2 18692474 ChIP-Seq MEFs Mouse',
          Overlap: '39/1991',
          'P-value': '0.4110331204012908',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.044701155198393',
          'Combined Score': '0.9288244521620277',
          Genes: 'ZFP148;2610528K11RIK;D4BWG0951E;EI24;PROZ;2010309E21RIK;ZFAND1;TM7SF3;YARS2;PITPNC1;ATXN2;ABHD11;1700034H14RIK;PMPCB;RIOK2;NDUFV1;FBXO9;CPT1A;LYPLA1;KLF12;ACBD4;ARHGEF12;FZD5;UBE2E1;LRRC40;ABHD14A;WDR34;FAH;RNF167;PRPF18;CACNB4;DALRD3;TMEM77;DOLPP1;RAB1;RQCD1;AQP11;FBXL3;MTFR1'
        },
        {
          Term: 'GATA1 26923725 Chip-Seq HPCs Mouse',
          Overlap: '5/226',
          'P-value': '0.41813077929724135',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1799410029498525',
          'Combined Score': '1.028862567856714',
          Genes: 'PRPF18;SMO;1700034H14RIK;ATP6V1B2;CD55'
        },
        {
          Term: 'SOX17 20123909 ChIP-Seq XEN Mouse',
          Overlap: '38/1947',
          'P-value': '0.4220132525815954',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0409176510871427',
          'Combined Score': '0.8980189782917344',
          Genes: '2610528K11RIK;OSGEPL1;GLO1;EI24;MYNN;ADK;ZBTB44;TFB1M;MRPL35;RABEPK;LRRC1;PCMTD2;SIPA1L1;1700034H14RIK;PMPCB;SMYD4;ZKSCAN1;TMED4;NUDT12;TOR1A;CRADD;2410166I05RIK;PARP16;LIFR;OVOL1;WDR34;PAICS;PRPF18;SLC9A6;NME7;PLSCR2;UFC1;RAB1;ATP6V1B2;2310026E23RIK;PKIG;A230062G08RIK;ATPAF1'
        },
        {
          Term: 'CEBPB 21427703 ChIP-Seq 3T3-L1 Mouse',
          Overlap: '39/2000',
          'P-value': '0.4225565099762086',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.04',
          'Combined Score': '0.8958893732940879',
          Genes: 'CNO;EI24;MYNN;ADK;ACAA1A;MAT2B;WDR89;TFB1M;TM7SF3;NXT2;RABEPK;ABHD11;9230114K14RIK;H2AFJ;1700034H14RIK;TASP1;PGM2;RIOK2;MGAT1;RAB11FIP2;CEP68;RWDD3;IAH1;FKBPL;SLC33A1;LRRC61;LIFR;FAH;MPP7;LASS2;VAMP8;UBOX5;PSMC6;RPS6KB1;LYRM5;RAB1;CHPT1;TLN1;PKIG'
        },
        {
          Term: 'POU3F1 26484290 ChIP-Seq ESCss Mouse',
          Overlap: '39/2000',
          'P-value': '0.4225565099762086',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.04',
          'Combined Score': '0.8958893732940879',
          Genes: 'INTU;3110048L19RIK;9030420J04RIK;GLO1;MYNN;ARHGAP18;CREBL2;ZFAND1;NR3C1;NUDT6;ZC3H12C;NPY;2810432D09RIK;SLC25A40;RDH14;AP4S1;SIAE;NEO1;DNAJC19;KLF12;ZFP775;ARHGEF12;FZD5;RHBDD3;AI316807;CABLES1;PARP16;LIFR;WDR34;KMO;KLF1;NSMCE4A;NME7;UFC1;RAB1;FBXL3;ACO1;TLN1;ZCCHC3'
        },
        {
          Term: 'RARB 24833708 ChIP-Seq LIVER Mouse',
          Overlap: '39/2000',
          'P-value': '0.4225565099762086',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.04',
          'Combined Score': '0.8958893732940879',
          Genes: 'GBE1;PROZ;ARHGAP18;VWCE;WDR89;TFB1M;NUDT6;TMEM186;THTPA;PSMC3IP;ZC3H12C;ZFP11;ATXN2;RPS6KA5;DDT;HYI;ARSG;PMS1;CEP68;RBM39;LYPLA1;IAH1;ACBD4;FZD5;HSD3B2;NSUN3;VPS13B;PEX1;ELL3;2610036D13RIK;VAMP8;ALDH1A3;DEFB29;TOMM70A;C1D;ATP6V1B2;NOTUM;NUPL2;SF1'
        },
        {
          Term: 'ETS1 22383799 ChIP-Seq G1ME Mouse',
          Overlap: '39/2000',
          'P-value': '0.4225565099762086',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.04',
          'Combined Score': '0.8958893732940879',
          Genes: 'LRRC19;GBE1;HPN;TM7SF3;C330018D20RIK;RABEPK;GPHN;FARS2;RPS6KA5;SIPA1L1;ABHD11;NAGLU;1700034H14RIK;PGM2;MGAT1;ARSG;CLCC1;CD55;FBXO9;NUDT12;TRAP1;CPT1A;LYPLA1;ACBD4;OXSM;ADHFE1;ANXA13;NAP1L1;POLRMT;COQ10A;KLF1;VAMP8;GSTZ1;ALDH6A1;UFC1;RAB1;RQCD1;TLN1;ASF1A'
        },
        {
          Term: 'E4F1 26484288 ChIP-Seq MOUSE EMBRYONIC FIBROBLAST Mouse',
          Overlap: '1/30',
          'P-value': '0.43348698236521066',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.777777777777778',
          'Combined Score': '1.4860329108594144',
          Genes: 'A930005H10RIK'
        },
        {
          Term: 'NANOG 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '11/542',
          'P-value': '0.437712791965348',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.082410824108241',
          'Combined Score': '0.8942794989166579',
          Genes: 'ZFP106;WBSCR18;TRAP1;ZFP148;TOR1A;CRADD;H2AFJ;4833426J09RIK;GYK;CHPT1;COQ10A'
        },
        {
          Term: 'RARG 19884340 ChIP-ChIP MEFs Mouse',
          Overlap: '8/390',
          'P-value': '0.4486076871559501',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0940170940170941',
          'Combined Score': '0.8769712368272856',
          Genes: 'LASS2;CNTD1;ATXN2;PLSCR2;PTTG1IP;NUDT6;RILP;PITPNC1'
        },
        {
          Term: 'SOX2 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '10/497',
          'P-value': '0.45539902740934046',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0731052984574112',
          'Combined Score': '0.8440845188884161',
          Genes: '2700038C09RIK;TOR1A;DALRD3;LYRM5;1700034H14RIK;RQCD1;AQP11;ZBTB44;FAH;TMED4'
        },
        {
          Term: 'ETS1 20019798 ChIP-Seq JURKAT Human',
          Overlap: '31/1607',
          'P-value': '0.4615786499832749',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0288321924911845',
          'Combined Score': '0.79539306629749',
          Genes: 'NOL7;WDR89;WDR24;SPTLC1;EXOSC4;ARSK;CDK5RAP1;TXNDC4;RDH14;RIOK2;MRPL9;NDUFV1;FBXO9;DNAJC19;SLC30A6;RBM39;TOR1A;CRADD;TGDS;WDR42A;SLC33A1;ZFYVE20;WDR34;POLRMT;ATAD3A;GSTZ1;PRPF18;SLC7A6OS;C1D;RQCD1;YME1L1'
        },
        {
          Term: 'KLF4 19030024 ChIP-ChIP MESCs Mouse',
          Overlap: '29/1502',
          'P-value': '0.46268840265710526',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0297381269418553',
          'Combined Score': '0.7936206653719347',
          Genes: 'ZDHHC5;MYNN;ORC5L;ADH5;LRRC1;TMEM166;1700034H14RIK;NPY;RIOK2;CD55;ZFP655;RBM39;FZD5;WDR42A;2410166I05RIK;ABHD14A;PAICS;ATAD3A;MUT;LASS2;RNF167;SLC25A39;TCN2;LYRM5;UFC1;RQCD1;AQP11;TLCD1;SF1'
        },
        {
          Term: 'SIN3A 21632747 ChIP-Seq MESCs Mouse',
          Overlap: '23/1186',
          'P-value': '0.46448152681990723',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0342889263631254',
          'Combined Score': '0.7931273886761757',
          Genes: 'ZRSR1;FZD5;FKBPL;GLO1;MYNN;LRRC61;IFT122;WDR34;FARS2;KLF1;SLC25A16;SIP1;PSMC6;9230114K14RIK;LYRM5;DOLPP1;AFMID;ATP6V1B2;TFAM;AP4S1;PRKACA;NDUFV1;TRIM23'
        },
        {
          Term: 'TP53 22127205 ChIP-Seq IMR90 Human',
          Overlap: '19/975',
          'P-value': '0.4649127665037002',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0393162393162394',
          'Combined Score': '0.7960180134453724',
          Genes: 'CEP68;AFAP1L1;ARHGEF12;TMEM30A;TGDS;GBE1;EI24;TRPC2;DHRS1;TMEM80;GPHN;TCN2;RDH14;AP4S1;ARSG;TLN1;RILP;SAC3D1;PAIP1'
        },
        {
          Term: 'VDR 23401126 ChIP-Seq LCL-AND-THP1 Human',
          Overlap: '5/239',
          'P-value': '0.4657310443942076',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1157601115760112',
          'Combined Score': '0.8526047078701257',
          Genes: 'MOBKL2B;CRADD;PSMB1;ARSG;GPHN'
        },
        {
          Term: 'MEIS1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '28/1452',
          'P-value': '0.46700884079725785',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0284664830119377',
          'Combined Score': '0.7830816724544878',
          Genes: 'UNC119B;TM2D2;IPP;ZDHHC5;CREBL2;PTTG1IP;3110057O12RIK;PGM2;HOXA7;SIAE;NDUFV1;HIBCH;BC016495;TMED4;PAIP1;ZFP655;CPT1A;RWDD3;TOR1A;PARP16;PEX1;D730039F16RIK;LASS2;C1D;RAB1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'RBPJ 22232070 ChIP-Seq NCS Mouse',
          Overlap: '1/34',
          'P-value': '0.4748585763488426',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.5686274509803921',
          'Combined Score': '1.168216867892549',
          Genes: 'LIPT1'
        },
        {
          Term: 'NACC1 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '15/769',
          'P-value': '0.4750989095950406',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0403120936280885',
          'Combined Score': '0.774233826682032',
          Genes: 'ZFP148;ACBD4;LRRC40;LIFR;PEX1;ZBTB44;TM7SF3;NR3C1;PAICS;ADH5;4933403G14RIK;TMEM77;PMPCB;TLCD1;METTL7A'
        },
        {
          Term: 'ELF5 23300383 ChIP-Seq T47D Human',
          Overlap: '21/1087',
          'P-value': '0.47594727146509996',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.030358785648574',
          'Combined Score': '0.7649880310340139',
          Genes: 'SLC30A6;CPT1A;STXBP2;SLC33A1;NSUN3;CISD1;ZDHHC5;ZFYVE20;VPS13B;LIFR;DHRS1;MCAT;WDR24;YARS2;ZC3H12C;TMBIM4;ANKRD42;NDUFV1;ASF1A;CD55;ZKSCAN1'
        },
        {
          Term: 'TTF2 22483619 ChIP-Seq HELA Human',
          Overlap: '29/1512',
          'P-value': '0.477470120589366',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0229276895943562',
          'Combined Score': '0.7562030749677027',
          Genes: 'LIPT1;LRRC56;HPN;IPP;WDR24;TMEM186;ATXN2;EXOSC4;MYO6;SEPHS2;SLC30A6;RBM39;KLF12;TOR1A;CRADD;TGDS;OXSM;LRRC61;CABLES1;PARP16;ABHD14A;LYRM2;DALRD3;DOLPP1;TFAM;FBXL3;CHPT1;NUPL2;ZCCHC3'
        },
        {
          Term: 'EWS-ERG 20517297 ChIP-Seq CADO-ES1 Human',
          Overlap: '20/1038',
          'P-value': '0.4829286139099735',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0276172125883107',
          'Combined Score': '0.7479886279157346',
          Genes: 'ENY2;NLRX1;TM2D2;TGDS;GLO1;ARHGAP18;VPS13B;VLDLR;MAT2B;PHF7;MRPL35;ESM1;EXOSC4;NSMCE4A;AGBL3;DOLPP1;ATP6V1B2;SMYD4;MTFR1;ARSG'
        },
        {
          Term: 'SFPI1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '45/2369',
          'P-value': '0.4868731054889806',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0130856901646266',
          'Combined Score': '0.7291702019719561',
          Genes: 'ZFP148;2700046G09RIK;TM2D2;STXBP2;MYNN;ADK;ARHGAP18;VLDLR;PCSK7;YARS2;ADH5;FARS2;3110057O12RIK;GK5;MYO6;HYI;PGM2;RDH14;RIOK2;MGAT1;ARSG;MRPL9;PRKACA;AW209491;METTL8;SIAE;HIBCH;FN3K;SLC30A6;FKBPL;ASCC1;LRRC40;IFT122;VPS13B;CABLES1;LASS2;SLC25A16;LYRM2;NME7;TOMM70A;4930432O21RIK;ATP6V1B2;TRIM37;TLCD1;ATPAF1'
        },
        {
          Term: 'ESET 19884257 ChIP-Seq ESCs Mouse',
          Overlap: '38/2000',
          'P-value': '0.4910706597838668',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0133333333333334',
          'Combined Score': '0.7206494816161491',
          Genes: '3110048L19RIK;CNO;RFESD;ADK;PTTG1IP;ZBTB44;TFB1M;NR3C1;YARS2;LRRC1;GK5;SIP1;AKR7A5;SIPA1L1;SPTLC1;SCP2;SLC25A40;2610019F03RIK;NEO1;ZKSCAN1;HIBCH;SCYL1;ZRSR1;ZFP655;RHBDD3;UBE2E1;VPS13B;WDR34;2210016F16RIK;ITFG1;VAMP8;SLC25A16;CAT;RAB1;ACO1;TLN1;NUPL2;ATPAF1'
        },
        {
          Term: 'SPI1 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '38/2000',
          'P-value': '0.4910706597838668',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0133333333333334',
          'Combined Score': '0.7206494816161491',
          Genes: 'ZFP148;MOBKL2B;INTU;ABHD3;STXBP2;1110003E01RIK;PROZ;ACAA1A;YARS2;TMEM186;5730403B10RIK;PSMC3IP;3110057O12RIK;ZC3H12C;SPTLC1;AFMID;HYI;HOXA7;RILP;PMS1;SAC3D1;TMED4;ZRSR1;CEP68;CPT1A;CABLES1;OVOL1;MCAT;ELL3;D730039F16RIK;VAMP8;ALDH1A3;DEFB29;TOMM70A;ATP6V1B2;NOTUM;SF1;FBXL6'
        },
        {
          Term: 'CHD7 19251738 ChIP-ChIP MESCs Mouse',
          Overlap: '3/141',
          'P-value': '0.494564760078469',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.1347517730496455',
          'Combined Score': '0.7989528235677338',
          Genes: 'RBM39;NFS1;HOXA7'
        },
        {
          Term: 'HOXD13 18407260 ChIP-ChIP DEVELOPING-LIMBS Mouse',
          Overlap: '4/196',
          'P-value': '0.5026393734437643',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0884353741496597',
          'Combined Score': '0.7487154475308965',
          Genes: 'FBXL3;NAP1L1;HOXA7;FBXO9'
        },
        {
          Term: 'REST 19997604 ChIP-ChIP NEURONS Mouse',
          Overlap: '40/2118',
          'P-value': '0.5057862468500987',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0072395341517155',
          'Combined Score': '0.6865759002847786',
          Genes: 'ACAA1A;NR3C1;NXT2;MRPL35;GPHN;FARS2;ATXN2;RPS6KA5;5430437P03RIK;AP4S1;CLCC1;FBXO8;RAB11FIP2;NEO1;RILP;TMED4;PAIP1;CEP68;2510006D16RIK;TMEM30A;ASCC1;WDR42A;NSUN3;UBE2E1;LRRC40;OVOL1;POLRMT;SLC25A16;TMEM77;NME7;ASB9;ATP6V1B2;RQCD1;A930041I02RIK;MTFR1;CHPT1;PKIG;NUPL2;SF1;ATPAF1'
        },
        {
          Term: 'SOX2 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '15/785',
          'P-value': '0.5074694231933461',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.019108280254777',
          'Combined Score': '0.6912803258564265',
          Genes: 'CPT1A;ZFP148;D4BWG0951E;LRRC40;PLEKHA7;4933403G14RIK;2700038C09RIK;ABHD11;DALRD3;TMBIM4;LYRM5;CDK5RAP1;PMPCB;SLC25A40;TMED4'
        },
        {
          Term: 'GATA1 22025678 ChIP-Seq K562 Human',
          Overlap: '1/38',
          'P-value': '0.5132163235243554',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.4035087719298245',
          'Combined Score': '0.9362215289985026',
          Genes: 'MYNN'
        },
        {
          Term: 'TEAD4 22529382 ChIP-Seq TROPHECTODERM Mouse',
          Overlap: '43/2293',
          'P-value': '0.5241493135162437',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.000145369966565',
          'Combined Score': '0.6460725916929563',
          Genes: 'ZFP787;MOBKL2B;INTU;ZFP748;MYNN;ADK;CREBL2;PTTG1IP;PHF7;YARS2;5730403B10RIK;LRRC1;FARS2;GK5;NFS1;RPS6KA5;SPTLC1;SCRN3;TASP1;PGM2;AP4S1;PMS1;FBXO9;PAIP1;RWDD3;AFAP1L1;ENTPD5;ADHFE1;ZFYVE20;ITFG1;PLEKHA7;SLC25A16;PRPF18;CACNB4;SBK1;RPS6KB1;NME7;COL4A4;RQCD1;TRIM37;NUPL2;FGFR4;ZCCHC3'
        },
        {
          Term: 'SOX2 20726797 ChIP-Seq SW620 Human',
          Overlap: '48/2564',
          'P-value': '0.5283407695879857',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9984399375975039',
          'Combined Score': '0.6370184651561688',
          Genes: 'MOBKL2B;BRI3;GBE1;ARHGAP18;SAT2;VLDLR;TFB1M;TM7SF3;NR3C1;KALRN;PITPNC1;LRRC1;PCMTD2;SIP1;SRR;SIPA1L1;H2AFJ;SCRN3;MYO6;FBXO3;RIOK2;METTL7A;CLCC1;HOXA7;SIAE;CD55;KLF12;TGDS;ANXA13;CABLES1;TIMM44;OVOL1;ELL3;COQ10A;DNAJC18;ALDH1A3;SLC7A6OS;SBK1;TMBIM4;NME7;ASB9;ATP6V1B2;TFAM;TLCD1;NOTUM;PKIG;ASF1A;RBKS'
        },
        {
          Term: 'EZH2 22144423 ChIP-Seq EOC Human',
          Overlap: '1/40',
          'P-value': '0.5313340788388288',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.3333333333333335',
          'Combined Score': '0.8431524069556007',
          Genes: 'KALRN'
        },
        {
          Term: 'SOX2 18692474 ChIP-Seq MESCs Mouse',
          Overlap: '62/3319',
          'P-value': '0.5348698906733576',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9962840212915538',
          'Combined Score': '0.6234065507809315',
          Genes: '2610528K11RIK;D4BWG0951E;ZFAND1;TFB1M;TM7SF3;YARS2;PITPNC1;SIPA1L1;ABHD11;H2AFJ;1700034H14RIK;PMPCB;SLC25A40;RIOK2;CLCC1;FBXO9;TMED4;SCYL1;CEP68;B3BP;CPT1A;LYPLA1;KLF12;ARHGEF12;UBE2E1;LRRC40;ABHD14A;WDR34;COQ10A;4933403G14RIK;RNF167;PRPF18;CACNB4;DALRD3;TMEM77;RAB1;MTFR1;ZFP148;ZFP748;EI24;PROZ;2010309E21RIK;ACAA1A;ZBTB44;MAT2B;ATXN2;EXOSC4;TXNDC4;NDUFV1;ZKSCAN1;ACBD4;FZD5;AI316807;PARP16;FAH;PLEKHA7;DOLPP1;RQCD1;AQP11;CLEC2H;FBXL3;A230062G08RIK'
        },
        {
          Term: 'POU5F1 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '14/753',
          'P-value': '0.5514410566555847',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9915891987605135',
          'Combined Score': '0.5902140443906853',
          Genes: 'ZFP655;RFESD;EI24;PEX1;PLEKHA7;PITPNC1;LRRC1;4933403G14RIK;CDK5RAP1;PMPCB;SLC25A40;MTFR1;RBKS;BC016495'
        },
        {
          Term: 'BCL11B 21912641 ChIP-Seq STHDH STRIUM Mouse',
          Overlap: '1/43',
          'P-value': '0.5572574033760553',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.2403100775193798',
          'Combined Score': '0.7252440573624275',
          Genes: 'CISD1'
        },
        {
          Term: 'PU 27001747 Chip-Seq BMDM Mouse',
          Overlap: '37/2000',
          'P-value': '0.5603799340512007',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9866666666666667',
          'Combined Score': '0.5714184013472494',
          Genes: 'LIPT1;1810049H13RIK;OSGEPL1;ARHGAP18;PTTG1IP;MAT2B;WDR89;NR3C1;5730403B10RIK;PITPNC1;ESM1;RIOK2;MGAT1;BPNT1;HIBCH;ZRSR1;CEP68;LYPLA1;CRADD;FZD5;RHBDD3;TGDS;ASCC1;ADHFE1;CABLES1;DHRS1;POLRMT;KMO;COQ10A;MPP7;SLC25A16;RNF167;RAB1;RQCD1;TFAM;TLCD1;ASF1A'
        },
        {
          Term: 'TET1 21451524 ChIP-Seq MESCs Mouse',
          Overlap: '34/1839',
          'P-value': '0.5611620108571748',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9860431393873481',
          'Combined Score': '0.5696821105762631',
          Genes: 'NLRX1;3110048L19RIK;STXBP2;1110003E01RIK;ZDHHC5;ACAA1A;ZBTB44;4932438A13RIK;GYS2;PSMC3IP;ZC3H12C;EXOSC4;SCP2;AFMID;BPNT1;PRKACA;ZRSR1;CPT1A;RHBDD3;IFT122;ABHD14A;WDR34;2210016F16RIK;CDAN1;SLC7A6OS;SLC25A39;SBK1;SMO;C1D;ANKRD42;TFAM;TLCD1;TLN1;SF1'
        },
        {
          Term: 'CEBPB 23403033 ChIP-Seq LIVER Mouse',
          Overlap: '7/382',
          'P-value': '0.5774299733459315',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9773123909249564',
          'Combined Score': '0.5367087909944958',
          Genes: 'FN3K;RBM39;ALDH6A1;LRRC61;RQCD1;RIOK2;MUT'
        },
        {
          Term: 'KLF5 18264089 ChIP-ChIP MESCs Mouse',
          Overlap: '2/103',
          'P-value': '0.5781984945618369',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.035598705501618',
          'Combined Score': '0.567340378580355',
          Genes: '4932432K03RIK;DNAJC19'
        },
        {
          Term: 'KLF2 18264089 ChIP-ChIP MESCs Mouse',
          Overlap: '2/103',
          'P-value': '0.5781984945618369',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.035598705501618',
          'Combined Score': '0.567340378580355',
          Genes: '4932432K03RIK;DNAJC19'
        },
        {
          Term: 'XRN2 22483619 ChIP-Seq HELA Human',
          Overlap: '28/1529',
          'P-value': '0.5807081543031576',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9766732068890343',
          'Combined Score': '0.5308286899914065',
          Genes: 'NDUFB6;CNO;ORC5L;CREBL2;WDR89;MRPL35;WDR24;GPHN;ABHD11;AFMID;SLC25A40;BPNT1;SEPHS2;RILP;CD55;NUDT12;SLC30A6;RBM39;MDH1;CABLES1;TIMM44;LYRM2;SLC7A6OS;DALRD3;SLC25A39;DOLPP1;C1D;SF1'
        },
        {
          Term: 'KLF4 18264089 ChIP-ChIP MESCs Mouse',
          Overlap: '2/104',
          'P-value': '0.5834650190755822',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.0256410256410258',
          'Combined Score': '0.5525854145876836',
          Genes: '4932432K03RIK;DNAJC19'
        },
        {
          Term: 'MYBL1 21750041 ChIP-ChIP SPERMATOCYTES Mouse',
          Overlap: '3/161',
          'P-value': '0.5840524074961085',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9937888198757765',
          'Combined Score': '0.5344244087622374',
          Genes: 'CNTD1;LRRC61;A930041I02RIK'
        },
        {
          Term: 'CTNNB1 20460455 ChIP-Seq HCT116 Human',
          Overlap: '18/988',
          'P-value': '0.5844660358230392',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.97165991902834',
          'Combined Score': '0.5218363800928335',
          Genes: 'KLHDC4;FECH;COX15;ASCC1;ANXA13;ZFYVE20;ADK;LRRC40;ZBTB44;ITFG1;MPP7;GPHN;PITPNC1;FARS2;PSMC3IP;SLC7A6OS;UFC1;ARSG'
        },
        {
          Term: 'AR 22383394 ChIP-Seq PROSTATE CANCER Human',
          Overlap: '34/1857',
          'P-value': '0.5849068879923502',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9764853706695387',
          'Combined Score': '0.5236916531547112',
          Genes: 'RFESD;GBE1;ORC5L;NR3C1;KALRN;PITPNC1;LRRC1;MIPOL1;PCMTD2;ZC3H12C;ATXN2;ABHD11;NPY;ARSK;MYO6;RIOK2;METTL8;CD55;PMS1;NUDT12;RWDD3;ARHGEF12;OXSM;NSUN3;CABLES1;LIFR;MUT;ITFG1;ALDH1A3;SBK1;NME7;AGBL3;ACO1;ALDH8A1'
        },
        {
          Term: 'CEBPB 20176806 ChIP-Seq THIOMACROPHAGE Mouse',
          Overlap: '29/1588',
          'P-value': '0.5874802107950905',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9739714525608733',
          'Combined Score': '0.5180678018888649',
          Genes: 'ENY2;COX15;ABHD3;IPP;ZDHHC5;NOL7;PCSK7;ACAA1A;NR3C1;MRPL35;WDR24;EXOSC4;NAGLU;NPY;KDR;ZRSR1;ACBD4;NAP1L1;POLRMT;D730039F16RIK;4933403G14RIK;TCN2;AGBL3;RAB1;ANKRD42;CHPT1;RBKS;SF1;FBXL6'
        },
        {
          Term: 'CTNNB1 24651522 ChIP-Seq LGR5+ INTESTINAL STEM Human',
          Overlap: '3/162',
          'P-value': '0.5882560851019145',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9876543209876543',
          'Combined Score': '0.5240423772973076',
          Genes: 'PCMTD2;NOTUM;PKIG'
        },
        {
          Term: 'SALL1 21062744 ChIP-ChIP HESCs Human',
          Overlap: '2/105',
          'P-value': '0.5886829821754102',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '1.015873015873016',
          'Combined Score': '0.5382780656057455',
          Genes: 'ACBD4;A930041I02RIK'
        },
        {
          Term: 'MEF2A 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '19/1048',
          'P-value': '0.5937922567565249',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9669211195928753',
          'Combined Score': '0.5039841924142228',
          Genes: 'TRAP1;KLHDC4;GBE1;WDR42A;SLC33A1;ADK;LRRC61;LIFR;PEX1;KALRN;4933403G14RIK;SLC25A16;ATXN2;EXOSC4;COL4A4;4833426J09RIK;UFC1;RIOK2;METTL8'
        },
        {
          Term: 'SOX9 26525672 Chip-Seq HEART Mouse',
          Overlap: '31/1702',
          'P-value': '0.5950070055142642',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9714061887974933',
          'Combined Score': '0.50433670459852',
          Genes: 'ZFP148;MOBKL2B;INTU;CISD1;ZDHHC5;ADK;A930005H10RIK;ARHGAP18;MAT2B;TFB1M;GPHN;PITPNC1;RPS6KA5;SIPA1L1;HYI;RIOK2;LRRC8A;RAB11FIP2;METTL8;NUDT12;KLF12;RWDD3;CRADD;RHBDD3;ADHFE1;NSUN3;MUT;D730039F16RIK;COL4A4;DOLPP1;C1D'
        },
        {
          Term: 'EGR1 23403033 ChIP-Seq LIVER Mouse',
          Overlap: '17/944',
          'P-value': '0.6032317344894566',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96045197740113',
          'Combined Score': '0.48546415302567697',
          Genes: 'IAH1;LRRC61;AI316807;ZBTB44;FAH;TM7SF3;ATAD3A;CLDN10;MED14;NME7;PLSCR2;LYRM5;ATP6V1B2;FBXO3;RIOK2;SIAE;NUDT12'
        },
        {
          Term: 'TP53 16413492 ChIP-PET HCT116 Human',
          Overlap: '8/449',
          'P-value': '0.6076843030382495',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9502598366740905',
          'Combined Score': '0.47332420636398903',
          Genes: 'KLHDC4;SIPA1L1;SPTLC1;TMEM30A;USP34;NEO1;GPHN;MIPOL1'
        },
        {
          Term: 'TAL1 20566737 ChIP-Seq PRIMARY FETAL LIVER ERYTHROID Mouse',
          Overlap: '34/1875',
          'P-value': '0.608210125543011',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9671111111111113',
          'Combined Score': '0.4808813535860281',
          Genes: 'FECH;CNO;ADK;TM7SF3;TMEM186;PITPNC1;FARS2;RPS6KA5;SIPA1L1;KDR;FBXO3;ARSG;MRPL9;PRKACA;GPR155;ZRSR1;CEP68;CPT1A;KLF12;RWDD3;ARHGEF12;FAHD1;CRADD;PARP16;WDR34;KLF1;LASS2;CLDN10;UBOX5;PRPF18;AI931714;CAT;AQP11;ASF1A'
        },
        {
          Term: 'RUNX1 17652178 ChIP-ChIP JURKAT Human',
          Overlap: '18/1003',
          'P-value': '0.6103601548238361',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9571286141575275',
          'Combined Score': '0.47254021452324746',
          Genes: 'CEP68;SLC30A6;MOBKL2B;KLF12;ARHGEF12;NDUFB6;ZFYVE20;ARHGAP18;VWCE;MAT2B;LRRC1;CLDN10;POLI;RIOK2;PRKACA;FBXO8;TLN1;SF1'
        },
        {
          Term: 'PCGF2 27294783 Chip-Seq NPCs Mouse',
          Overlap: '8/451',
          'P-value': '0.6126776973019515',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9460458240946046',
          'Combined Score': '0.4634832324922791',
          Genes: 'OSGEPL1;FZD5;COL4A4;RQCD1;GAL3ST2;CD55;PMS1;HIBCH'
        },
        {
          Term: 'TET1 21490601 ChIP-Seq MESCs Mouse',
          Overlap: '36/1994',
          'P-value': '0.6210369032015591',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.962888665997994',
          'Combined Score': '0.4586862411576509',
          Genes: 'LRRC56;ENY2;9030420J04RIK;BRI3;COX15;CISD1;PTTG1IP;PCSK7;GPHN;SIP1;AKR7A5;ATXN2;SIPA1L1;EXOSC4;ABHD11;HYI;SMYD4;CD55;PAIP1;FAHD1;IFT122;PAICS;D730039F16RIK;VAMP8;SLC25A16;CDAN1;CACNB4;SLC7A6OS;NSMCE4A;SMO;LYRM5;GORASP1;FBXL3;ACO1;NAT9;ATPAF1'
        },
        {
          Term: 'PCGF2 27294783 Chip-Seq ESCs Mouse',
          Overlap: '9/512',
          'P-value': '0.6247411680838911',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9375',
          'Combined Score': '0.4410167307069957',
          Genes: 'LIPT1;LYPLA1;OSGEPL1;FZD5;ADHFE1;COL4A4;RQCD1;PMS1;HIBCH'
        },
        {
          Term: 'CREB1 15753290 ChIP-ChIP HEK293T Human',
          Overlap: '17/957',
          'P-value': '0.6258562826886372',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9474050853361199',
          'Combined Score': '0.44398672230481323',
          Genes: 'MDH1;NDUFB6;MYNN;ADK;ORC5L;TIMM44;MUT;NFS1;RPS6KA5;TOMM70A;PSMB1;C1D;RQCD1;FBXO8;TLN1;NDUFV1;PMS1'
        },
        {
          Term: 'PU.1 20176806 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '36/2000',
          'P-value': '0.6284085685237375',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96',
          'Combined Score': '0.4459821477432588',
          Genes: 'UNC119B;ENY2;GLO1;IPP;ARHGAP18;NR3C1;WDR24;FARS2;NAGLU;H2AFJ;DDT;2810432D09RIK;HIBCH;CEP68;RBM39;LYPLA1;CRADD;FKBPL;RHBDD3;ZFYVE20;IFT122;NAP1L1;WDR34;PAICS;2610036D13RIK;DNAJC18;KLF1;VAMP8;4933403G14RIK;LYRM2;DEFB29;PLSCR2;UFC1;RAB1;TRIM37;SF1'
        },
        {
          Term: 'LUZP1 20508642 ChIP-Seq ESCs Mouse',
          Overlap: '36/2000',
          'P-value': '0.6284085685237375',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96',
          'Combined Score': '0.4459821477432588',
          Genes: 'CISD1;ARHGAP18;PTTG1IP;MAT2B;WDR89;GPHN;PITPNC1;SRR;SIPA1L1;NAGLU;DDT;MGAT1;SMYD4;AP4S1;ARSG;ZRSR1;CEP68;IAH1;CRADD;MDH1;RHBDD3;ASCC1;NAP1L1;POLRMT;COQ10A;SLC25A16;GSTZ1;TMBIM4;RPS6KB1;C1D;RAB1;TFAM;TRIM37;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'CHD1 26751641 Chip-Seq LNCaP Human',
          Overlap: '36/2000',
          'P-value': '0.6284085685237375',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96',
          'Combined Score': '0.4459821477432588',
          Genes: 'ZFP106;COX15;GBE1;EI24;HPN;ADK;ORC5L;PTTG1IP;ZFAND1;MRPL35;GPHN;THTPA;ATXN2;SCP2;H2AFJ;MYO6;KDR;SLC25A40;BPNT1;CLCC1;TRAP1;CPT1A;RWDD3;ARHGEF12;NAP1L1;PEX1;ATAD3A;SLC25A16;TMBIM4;ANKRD42;TRIM37;CHPT1;ZCCHC3;ASF1A;SFXN5;ATPAF1'
        },
        {
          Term: 'FOXA1 26769127 Chip-Seq PDAC-Cell line Human',
          Overlap: '36/2000',
          'P-value': '0.6284085685237375',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96',
          'Combined Score': '0.4459821477432588',
          Genes: 'RFESD;USP34;ZDHHC5;ADK;CREBL2;PTTG1IP;VWCE;ZBTB44;TM7SF3;YARS2;GPHN;LRRC1;MIPOL1;DHTKD1;ZC3H12C;SCP2;MYO6;HYI;CEP68;RBM39;RWDD3;ARHGEF12;PARP16;KMO;PLEKHA7;GNMT;SLC25A39;TCN2;TMBIM4;RPS6KB1;LYRM5;DMXL1;UFC1;TFAM;FBXL3;TLCD1'
        },
        {
          Term: 'RACK7 27058665 Chip-Seq MCF-7 Human',
          Overlap: '36/2000',
          'P-value': '0.6284085685237375',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.96',
          'Combined Score': '0.4459821477432588',
          Genes: 'EI24;HPN;IPP;CISD1;PTTG1IP;VWCE;MAT2B;WDR89;GPHN;PITPNC1;ATXN2;RPS6KA5;ABHD11;HYI;CLCC1;MRPL9;PRKACA;GAL3ST2;RILP;SAC3D1;SCYL1;CPT1A;ARHGEF12;ASCC1;CABLES1;OVOL1;TMEM80;PLEKHA7;KLF1;LASS2;SLC25A39;TCN2;UFC1;TLCD1;SFXN5;ATPAF1'
        },
        {
          Term: 'POU5F1 18347094 ChIP-ChIP MESCs Mouse',
          Overlap: '38/2109',
          'P-value': '0.6284382062324293',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.960960960960961',
          'Combined Score': '0.44638325547124197',
          Genes: 'D4BWG0951E;MYNN;PTTG1IP;MAT2B;YARS2;PITPNC1;FARS2;ATXN2;SIPA1L1;ABHD11;PSMB1;PMPCB;SLC25A40;HOXA7;BC016495;SCYL1;B3BP;KLF12;ACBD4;RHBDD3;NSUN3;LRRC40;NAP1L1;FAH;KMO;MCAT;COQ10A;PLEKHA7;4933403G14RIK;CACNB4;DALRD3;DMXL1;ASB9;RQCD1;MTFR1;2310026E23RIK;TLN1;ASF1A'
        },
        {
          Term: 'CTCF 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '28/1568',
          'P-value': '0.6351130668446261',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9523809523809523',
          'Combined Score': '0.4323354646827242',
          Genes: 'MOBKL2B;4732435N03RIK;COX15;2010309E21RIK;PCSK7;YARS2;THTPA;1110032A03RIK;PSMC3IP;AKR7A5;2700038C09RIK;DDT;1700034H14RIK;2810432D09RIK;PMPCB;NDUFV1;FBXO9;TMED4;GADD45GIP1;CPT1A;DEFB29;PRPF18;PSMC6;RAB1;ANKRD42;A930041I02RIK;TLCD1;ASF1A'
        },
        {
          Term: 'MYC 20876797 ChIP-ChIP MEDULLOBLASTOMA Human',
          Overlap: '25/1406',
          'P-value': '0.6388141969792961',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9483167377904221',
          'Combined Score': '0.4249802166308615',
          Genes: 'FECH;GBE1;USP34;ARHGAP18;MRPL35;GPHN;FARS2;ARSK;PSMB1;KDR;POLI;HOXA7;RAB11FIP2;FBXO9;TGDS;NSUN3;NAP1L1;FAH;MUT;AGBL3;GORASP1;TOMM70A;ACO1;TLCD1;SFXN5'
        },
        {
          Term: 'CREB1 23762244 ChIP-Seq HIPPOCAMPUS Rat',
          Overlap: '43/2393',
          'P-value': '0.6418731127579119',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9583507452291405',
          'Combined Score': '0.42489883172001996',
          Genes: 'ZFP787;ENY2;CNO;1110003E01RIK;ZDHHC5;MYNN;ORC5L;TFB1M;GPHN;1110032A03RIK;RPS6KA5;SPTLC1;TASP1;LRRC8A;PRKACA;FBXO8;NDUFV1;FBXO9;SCYL1;ZFP655;RBM39;TMEM86A;KLHDC4;ACBD4;TMEM30A;FAHD1;APOOL;MDH1;FKBPL;RHBDD3;IFT122;TIMM44;DHRS1;SLC25A16;GSTZ1;39509;DOLPP1;C1D;RAB1;RQCD1;TLN1;NUPL2;SF1'
        },
        {
          Term: 'TAL1 26923725 Chip-Seq HEMANGIOBLAST Mouse',
          Overlap: '25/1413',
          'P-value': '0.6486827617444031',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9436187780136825',
          'Combined Score': '0.40840905181082027',
          Genes: 'NDUFB6;NOL7;ARHGAP18;SAT2;NR3C1;LRRC1;MIPOL1;ZFP11;1700034H14RIK;NEO1;CD55;SCYL1;ZRSR1;KLF12;RWDD3;TMEM30A;UBE2E1;LIFR;PLEKHA7;DNAJC18;PRPF18;SLC7A6OS;SMO;CAT;ALDH8A1'
        },
        {
          Term: 'NR3C1 23031785 ChIP-Seq PC12 Mouse',
          Overlap: '16/918',
          'P-value': '0.6540156249642982',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9295570079883807',
          'Combined Score': '0.394712248821602',
          Genes: 'LYPLA1;RWDD3;CRADD;APOOL;MDH1;ADK;PLEKHA7;FARS2;ZC3H12C;SIPA1L1;SPTLC1;SBK1;NME7;ASB9;FBXO8;FGFR4'
        },
        {
          Term: 'LYL1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '13/752',
          'P-value': '0.6571541006770847',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.921985815602837',
          'Combined Score': '0.38708351544313896',
          Genes: 'ZRSR1;CEP68;FAHD1;MTMR14;PTTG1IP;KMO;VAMP8;UBOX5;NAGLU;PMPCB;MGAT1;SEPHS2;2610019F03RIK'
        },
        {
          Term: 'AR 21909140 ChIP-Seq LNCAP Human',
          Overlap: '5/298',
          'P-value': '0.6600430002245511',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.894854586129754',
          'Combined Score': '0.37176760109939627',
          Genes: 'PSMC6;SLC33A1;ADK;ORC5L;LIFR'
        },
        {
          Term: 'KLF4 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '30/1700',
          'P-value': '0.6640773162221164',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9411764705882353',
          'Combined Score': '0.3852768905324949',
          Genes: 'D4BWG0951E;STXBP2;ZBTB44;ADH5;1110032A03RIK;2700038C09RIK;ABHD11;H2AFJ;AFMID;TXNDC4;SLC25A40;PGM2;HOXA7;CD55;ZFP655;CPT1A;ACBD4;FAHD1;RHBDD3;LRRC61;PARP16;WDR34;DALRD3;SLC25A39;TMBIM4;TMEM77;MTFR1;TLCD1;TLN1;RBKS'
        },
        {
          Term: 'CEBPA 23403033 ChIP-Seq LIVER Mouse',
          Overlap: '10/589',
          'P-value': '0.6695920948216072',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9054895302773063',
          'Combined Score': '0.36317968597490285',
          Genes: 'RBM39;ABHD11;LYRM5;SLC33A1;LRRC61;RQCD1;RIOK2;ACAA1A;FBXO9;TMED4'
        },
        {
          Term: 'FLI1 21571218 ChIP-Seq MEGAKARYOCYTES Human',
          Overlap: '106/5834',
          'P-value': '0.6698842286698912',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9690321106159296',
          'Combined Score': '0.3882430780765887',
          Genes: 'OSGEPL1;TPMT;ZDHHC5;ORC5L;TM7SF3;ZC3H12C;RPS6KA5;SCP2;CDK5RAP1;SLC25A40;FBXO8;SEPHS2;NUDT12;SLC30A6;CPT1A;OXSM;ZFYVE20;OVOL1;POLRMT;ATAD3A;CACNB4;ANKRD42;YME1L1;TLN1;ASF1A;LIPT1;ENY2;BRI3;CNO;GLO1;STXBP2;HPN;MYNN;ARHGAP18;PTTG1IP;ADH5;ATXN2;TASP1;NDUFV1;ZKSCAN1;KLHDC4;AFAP1L1;TOR1A;CRADD;TGDS;SLC33A1;LRRC61;IFT122;MCAT;UBOX5;PKIG;FGFR4;ZCCHC3;GBE1;MTMR14;ADK;TFB1M;NXT2;LRRC1;FARS2;DHTKD1;THTPA;ESM1;MED14;SPTLC1;SCRN3;POLI;PGM2;GAL3ST2;HIBCH;TMED4;LYPLA1;NSUN3;TRPC2;VPS13B;PEX1;MUT;ITFG1;CLDN10;RNF167;PRPF18;TMBIM4;NME7;MTFR1;ATPAF1;NDUFB6;TM2D2;NOL7;WDR24;EXOSC4;PSMB1;MGAT1;LRRC8A;CD55;PMS1;RBM39;RWDD3;TMEM30A;MDH1;CABLES1;FAH;MPP7;GSTZ1;PSMC6;RPS6KB1;LYRM5'
        },
        {
          Term: 'DCP1A 22483619 ChIP-Seq HELA Human',
          Overlap: '13/759',
          'P-value': '0.6700392405402318',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9134826526130874',
          'Combined Score': '0.36577581058878644',
          Genes: 'RBM39;LRRC56;ENY2;MDH1;TGDS;MYNN;GPHN;FARS2;EXOSC4;TMBIM4;RPS6KB1;AFMID;MRPL9'
        },
        {
          Term: 'CIITA 18437201 ChIP-ChIP Raji B and iDC Human',
          Overlap: '1/59',
          'P-value': '0.6731937560587998',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.903954802259887',
          'Combined Score': '0.3577148851752647',
          Genes: 'GORASP1'
        },
        {
          Term: 'SMAD 19615063 ChIP-ChIP OVARY Human',
          Overlap: '2/124',
          'P-value': '0.6786478797428488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8602150537634409',
          'Combined Score': '0.33346483653400144',
          Genes: 'KLF12;GPHN'
        },
        {
          Term: 'TAF15 26573619 Chip-Seq HEK293 Human',
          Overlap: '4/247',
          'P-value': '0.6834789952157894',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.863697705802969',
          'Combined Score': '0.328688241406557',
          Genes: 'ANKRD42;CHPT1;MAT2B;NR3C1'
        },
        {
          Term: 'TAL1 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '1/61',
          'P-value': '0.6853699278987574',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8743169398907105',
          'Combined Score': '0.33031391979131297',
          Genes: '1700123L14RIK'
        },
        {
          Term: 'FOXP2 21765815 ChIP-ChIP NEURO2A Mouse',
          Overlap: '20/1164',
          'P-value': '0.6893810888823078',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9163802978235969',
          'Combined Score': '0.3408577837762566',
          Genes: 'ZFP148;MOBKL2B;FAHD1;FECH;SLC33A1;MYNN;2010309E21RIK;PTTG1IP;MAT2B;GPHN;PITPNC1;DNAJC18;4933403G14RIK;DOLPP1;4833426J09RIK;HYI;CLCC1;PKIG;SIAE;SF1'
        },
        {
          Term: 'FUS 26573619 Chip-Seq HEK293 Human',
          Overlap: '9/543',
          'P-value': '0.6927092174730003',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8839779005524862',
          'Combined Score': '0.32454803752914196',
          Genes: 'KLF12;NFS1;FZD5;NSUN3;ASB9;MAT2B;ALDH8A1;MUT;FBXO9'
        },
        {
          Term: 'GATA1 19941827 ChIP-Seq MEL Mouse',
          Overlap: '32/1834',
          'P-value': '0.6928868791845595',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9305707015630681',
          'Combined Score': '0.3414157136086643',
          Genes: '2610528K11RIK;INTU;FECH;1200014M14RIK;ZDHHC5;ADK;RABEPK;PITPNC1;AFMID;KDR;ARSG;BC016495;ZRSR1;CEP68;ZFP655;CPT1A;A530050D06RIK;FAHD1;CRADD;FAH;KLF1;LASS2;VAMP8;4933403G14RIK;RNF167;SBK1;COL4A4;MTFR1;TLCD1;NAT9;ALDH8A1;SFXN5'
        },
        {
          Term: 'CEBPB 20176806 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '35/2000',
          'P-value': '0.6931478712387799',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9333333333333335',
          'Combined Score': '0.3420777958670159',
          Genes: 'NLRX1;GLO1;IPP;NOL7;PCSK7;ACAA1A;PHF7;NR3C1;WDR24;RABEPK;PSMC3IP;ZC3H12C;ZFP11;NPY;AP4S1;TMED4;ZRSR1;RBM39;ACBD4;CRADD;WDR20A;WDR34;POLRMT;MPP7;4933403G14RIK;TCN2;RPS6KB1;AGBL3;GORASP1;UFC1;RAB1;ANKRD42;NUPL2;SF1;FBXL6'
        },
        {
          Term: 'GATA2 21186366 ChIP-Seq BM-HSCs Mouse',
          Overlap: '35/2000',
          'P-value': '0.6931478712387799',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9333333333333335',
          'Combined Score': '0.3420777958670159',
          Genes: 'CISD1;NOL7;ARHGAP18;PTTG1IP;MAT2B;WDR89;GPHN;PITPNC1;MIPOL1;SIPA1L1;DDT;RDH14;MGAT1;AP4S1;ARSG;ZRSR1;CEP68;CRADD;MDH1;RHBDD3;ASCC1;UBE2E1;VPS13B;NAP1L1;POLRMT;COQ10A;SLC25A16;TMBIM4;C1D;RAB1;TFAM;TRIM37;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'CBP 21632823 ChIP-Seq H3396 Human',
          Overlap: '35/2000',
          'P-value': '0.6931478712387799',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9333333333333335',
          'Combined Score': '0.3420777958670159',
          Genes: 'LRRC56;COX15;EI24;CISD1;ADK;CREBL2;VWCE;WDR89;YARS2;DHTKD1;GYS2;ZC3H12C;ATXN2;FBXO3;RAB11FIP2;SCYL1;CPT1A;TMEM86A;ARHGEF12;CRADD;ASCC1;TRPC2;OVOL1;TMEM80;MPP7;PLEKHA7;SLC25A16;ALDH6A1;PRPF18;NSMCE4A;CAT;ANKRD42;TFAM;YME1L1;AQP11'
        },
        {
          Term: 'FLI1 26923725 Chip-Seq HEMOGENIC-ENDOTHELIUM Mouse',
          Overlap: '35/2000',
          'P-value': '0.6931478712387799',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9333333333333335',
          'Combined Score': '0.3420777958670159',
          Genes: 'ZFP148;GBE1;STXBP2;IPP;PHF7;RABEPK;PCMTD2;3110057O12RIK;ZC3H12C;ZFP11;ATXN2;SCP2;FBXO3;AP4S1;BPNT1;NDUFV1;PMS1;ZRSR1;RBM39;CNTD1;KLHDC4;NSUN3;VPS13B;LIFR;TIMM44;NAP1L1;ITFG1;ALDH1A3;PRPF18;SLC25A39;TOMM70A;C1D;ATP6V1B2;NOTUM;FBXL6'
        },
        {
          Term: 'SCL 19346495 ChIP-Seq HPC-7 Human',
          Overlap: '4/252',
          'P-value': '0.69847658705116',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8465608465608465',
          'Combined Score': '0.3037914241209468',
          Genes: 'CEP68;VAMP8;AFAP1L1;4732435N03RIK'
        },
        {
          Term: 'BMI1 19503595 ChIP-Seq MEFsC Mouse',
          Overlap: '11/661',
          'P-value': '0.6988013093256821',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8875441250630358',
          'Combined Score': '0.3180858979335422',
          Genes: 'ZFP106;CPT1A;ESM1;EXOSC4;H2AFJ;DDT;WDR42A;CAT;FAH;SEPHS2;RILP'
        },
        {
          Term: 'SOX9 22984422 ChIP-ChIP TESTIS Rat',
          Overlap: '1/64',
          'P-value': '0.7027910167814929',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8333333333333334',
          'Combined Score': '0.29391308732668103',
          Genes: 'FKBPL'
        },
        {
          Term: 'NANOG 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '21/1232',
          'P-value': '0.7062713387873704',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9090909090909091',
          'Combined Score': '0.3161416206961097',
          Genes: 'CCDC16;TRAP1;CNTD1;ZFP148;D4BWG0951E;EI24;VLDLR;ZBTB44;NR3C1;KMO;YARS2;4933403G14RIK;WBSCR18;ABHD11;LYRM5;TXNDC4;PMPCB;SLC25A40;AQP11;TLCD1;TRIM23'
        },
        {
          Term: 'SMAD1 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '10/610',
          'P-value': '0.7110806902595562',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8743169398907105',
          'Combined Score': '0.2981152937339048',
          Genes: 'THTPA;SLC25A16;ASCC1;WDR20A;ZFYVE20;ORC5L;SAT2;LIFR;MRPL9;SCYL1'
        },
        {
          Term: 'TBX3 20139965 ChIP-Seq MESCs Mouse',
          Overlap: '18/1068',
          'P-value': '0.713342609213147',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.898876404494382',
          'Combined Score': '0.3036345673250005',
          Genes: 'MOBKL2B;FAHD1;4732435N03RIK;GBE1;ADK;IFT122;LIFR;CREBL2;ZBTB44;OVOL1;FARS2;DNAJC18;SLC25A16;ARSK;SLC25A40;FBXO8;NUPL2;PMS1'
        },
        {
          Term: 'KDM5A 27292631 Chip-Seq BREAST Human',
          Overlap: '17/1012',
          'P-value': '0.7142279769816017',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8959156785243743',
          'Combined Score': '0.3015231739625406',
          Genes: 'OSGEPL1;ADK;MAT2B;WDR89;NXT2;ATAD3A;KLF1;GK5;GSTZ1;CDAN1;DMXL1;UFC1;ANKRD42;MGAT1;MRPL9;NDUFV1;ATPAF1'
        },
        {
          Term: 'TBX3 20139965 ChIP-Seq ESCs Mouse',
          Overlap: '18/1070',
          'P-value': '0.7162398552539043',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8971962616822431',
          'Combined Score': '0.2994304371569659',
          Genes: 'MOBKL2B;FAHD1;4732435N03RIK;GBE1;ADK;IFT122;LIFR;CREBL2;ZBTB44;OVOL1;FARS2;DNAJC18;SLC25A16;ARSK;SLC25A40;FBXO8;NUPL2;PMS1'
        },
        {
          Term: 'FOXA2 19822575 ChIP-Seq HepG2 Human',
          Overlap: '52/2968',
          'P-value': '0.7250776515033603',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9344115004492364',
          'Combined Score': '0.3003913614686539',
          Genes: 'MOBKL2B;GBE1;MTMR14;USP34;ADK;PITPNC1;LRRC1;FARS2;RPS6KA5;NAGLU;SCRN3;CDK5RAP1;SEPHS2;CEP68;CPT1A;KLF12;UBE2E1;VPS13B;LIFR;PRPF18;CACNB4;NME7;COL4A4;RBKS;GLO1;EI24;ARHGAP18;CREBL2;KALRN;MIPOL1;PSMB1;TASP1;AP4S1;ARSG;PMS1;ZKSCAN1;FN3K;TRAP1;RBM39;TMEM30A;CRADD;FZD5;WDR42A;CABLES1;LASS2;ALDH6A1;CDAN1;SBK1;TOMM70A;CHPT1;PKIG;SFXN5'
        },
        {
          Term: 'RUNX1 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '1/69',
          'P-value': '0.7297142790408898',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7729468599033816',
          'Combined Score': '0.24355727152095696',
          Genes: 'LIFR'
        },
        {
          Term: 'TP53 23651856 ChIP-Seq MEFs Mouse',
          Overlap: '56/3193',
          'P-value': '0.7297654386562642',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9353794759369455',
          'Combined Score': '0.2946745731188125',
          Genes: '1810049H13RIK;MOBKL2B;ADK;ORC5L;LRRC1;FARS2;1110032A03RIK;RPS6KA5;H2AFJ;CDK5RAP1;SEPHS2;NEO1;TMED4;KLF12;ARHGEF12;NSUN3;ABHD14A;WDR34;ALDH1A3;PRPF18;TMBIM4;RAB1;YME1L1;RBKS;ATPAF1;LRRC56;ENY2;NDUFB6;EI24;1110003E01RIK;VWCE;KALRN;5730403B10RIK;ATXN2;SRR;9230114K14RIK;AFMID;SMYD4;AP4S1;LRRC8A;GPR155;SAC3D1;RWDD3;AFAP1L1;ACBD4;FAHD1;ASCC1;SLC33A1;TIMM44;MPP7;DNAJC18;GSTZ1;TCN2;RPS6KB1;FBXL3;ALDH8A1'
        },
        {
          Term: 'P53 22127205 ChIP-Seq FIBROBLAST Human',
          Overlap: '11/679',
          'P-value': '0.731184376204668',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8640157093765343',
          'Combined Score': '0.2705143556571426',
          Genes: 'KLF12;AFAP1L1;PRPF18;TMEM30A;INTU;GBE1;TRPC2;RDH14;PARP16;MAT2B;ZKSCAN1'
        },
        {
          Term: 'EWS 26573619 Chip-Seq HEK293 Human',
          Overlap: '14/854',
          'P-value': '0.7341656884774093',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8743169398907105',
          'Combined Score': '0.27018189483818417',
          Genes: 'RWDD3;GBE1;MTMR14;LRRC40;ARHGAP18;NAP1L1;MAT2B;FAH;GK5;NFS1;CACNB4;DMXL1;FBXO3;NUDT12'
        },
        {
          Term: 'PKCTHETA 26484144 Chip-Seq BREAST Human',
          Overlap: '8/506',
          'P-value': '0.7357980575126016',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8432147562582345',
          'Combined Score': '0.2586979299343452',
          Genes: 'RBM39;PARP16;RIOK2;TRIM37;WDR89;PRKACA;CD55;TMED4'
        },
        {
          Term: 'IRF8 22096565 ChIP-ChIP GC-B Human',
          Overlap: '3/203',
          'P-value': '0.7363359564478319',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7881773399014779',
          'Combined Score': '0.24123649405762898',
          Genes: 'KLF12;GORASP1;TLCD1'
        },
        {
          Term: 'NANOG 18692474 ChIP-Seq MEFs Mouse',
          Overlap: '34/1989',
          'P-value': '0.741536475242364',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9116809116809118',
          'Combined Score': '0.27262078856546035',
          Genes: 'ZFP148;2610528K11RIK;TM2D2;D4BWG0951E;GBE1;EI24;ADK;ZFAND1;TM7SF3;YARS2;PITPNC1;2700038C09RIK;ATXN2;RPS6KA5;ABHD11;1700034H14RIK;TXNDC4;PMPCB;BPNT1;NDUFV1;ZKSCAN1;FBXO9;SCYL1;LYPLA1;KLF12;ACBD4;FZD5;UBE2E1;D730039F16RIK;4933403G14RIK;TMEM77;RAB1;AQP11;FBXL6'
        },
        {
          Term: 'TFAP2C 20629094 ChIP-Seq MCF-7 Human',
          Overlap: '20/1203',
          'P-value': '0.7430649127873139',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.886672208367969',
          'Combined Score': '0.2633167058206524',
          Genes: 'BRI3;ASCC1;UBE2E1;CABLES1;PTTG1IP;NR3C1;KMO;KALRN;PLEKHA7;NME7;TASP1;LRRC8A;CHPT1;ARSG;NUPL2;FGFR4;GAL3ST2;CD55;ZKSCAN1;HIBCH'
        },
        {
          Term: 'GLI1 17442700 ChIP-ChIP MESCs Mouse',
          Overlap: '1/73',
          'P-value': '0.7494903045406256',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.730593607305936',
          'Combined Score': '0.21067535885023228',
          Genes: 'MUT'
        },
        {
          Term: 'MYB 21317192 ChIP-Seq ERMYB Mouse',
          Overlap: '15/923',
          'P-value': '0.7512615506915293',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.866738894907909',
          'Combined Score': '0.2478885529398687',
          Genes: 'ZFP106;KLHDC4;GBE1;ABHD14A;ZBTB44;VAMP8;SIPA1L1;ABHD11;SLC25A39;TMEM77;1700034H14RIK;RAB1;AQP11;METTL8;FBXO9'
        },
        {
          Term: 'TRP63 18441228 ChIP-ChIP KERATINOCYTES Mouse',
          Overlap: '2/143',
          'P-value': '0.7519317757904765',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.745920745920746',
          'Combined Score': '0.21266922728638987',
          Genes: 'SMO;MYO6'
        },
        {
          Term: 'RXRA 24833708 ChIP-Seq LIVER Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP148;NLRX1;ARHGAP18;VWCE;TFB1M;NUDT6;YARS2;5730403B10RIK;4932438A13RIK;ZC3H12C;ZFP11;SIPA1L1;NAGLU;2810432D09RIK;SLC25A40;HYI;MGAT1;BPNT1;TRAP1;IAH1;LIFR;NAP1L1;COQ10A;GNMT;DEFB29;SLC25A39;RPS6KB1;AGBL3;DMXL1;TOMM70A;ATP6V1B2;PKIG;FGFR4;ZCCHC3'
        },
        {
          Term: 'RARA 24833708 ChIP-Seq LIVER Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP106;NLRX1;VWCE;YARS2;TMEM186;5730403B10RIK;PITPNC1;THTPA;PSMC3IP;ZC3H12C;EXOSC4;FBXO3;POLI;LRRC8A;PRKACA;PMS1;SAC3D1;TRAP1;RBM39;FZD5;MDH1;ADHFE1;NSUN3;LIFR;NAP1L1;PEX1;DEFB29;SLC25A39;RPS6KB1;TOMM70A;C1D;ATP6V1B2;NOTUM;FBXL6'
        },
        {
          Term: 'PU.1 20513432 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ENY2;ABHD3;IPP;NOL7;PROZ;PCSK7;PHF7;NR3C1;WDR24;FARS2;SCP2;NAGLU;PRKACA;NDUFV1;CEP68;LYPLA1;MDH1;FKBPL;RHBDD3;NSUN3;IFT122;NAP1L1;2210016F16RIK;MCAT;MPP7;LYRM2;TCN2;C1D;UFC1;RAB1;TFAM;TRIM37;ASF1A;SF1'
        },
        {
          Term: 'CEBPB 20513432 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP148;COX15;GLO1;IPP;NOL7;ARHGAP18;PCSK7;WDR89;NR3C1;WDR24;5730403B10RIK;FARS2;PSMC3IP;ZC3H12C;SIP1;NAGLU;TMED4;ZRSR1;CEP68;RBM39;CPT1A;ACBD4;WDR20A;TIMM44;NAP1L1;2210016F16RIK;MCAT;2610036D13RIK;CACNB4;RPS6KB1;PLSCR2;UFC1;RAB1;SF1'
        },
        {
          Term: 'GATA3 21867929 ChIP-Seq CD8 Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'OSGEPL1;LRRC19;MYNN;PROZ;NR3C1;4932438A13RIK;RPS6KA5;H2AFJ;1700034H14RIK;FBXO3;5430437P03RIK;PMPCB;RDH14;RIOK2;AP4S1;PRKACA;SEPHS2;SCYL1;ZRSR1;CEP68;FN3K;SLC30A6;LYPLA1;RHBDD3;TGDS;NSUN3;TIMM44;NAP1L1;D730039F16RIK;PSMC6;RPS6KB1;TOMM70A;TSR2;ALDH8A1'
        },
        {
          Term: 'FLI1 21867929 ChIP-Seq CD8 Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ENY2;LRRC19;ABHD3;1110003E01RIK;ZDHHC5;A930005H10RIK;ZFAND1;4932438A13RIK;SPTLC1;PRKACA;2610019F03RIK;NDUFV1;FBXO9;TMED4;SLC30A6;ZFP775;RWDD3;FKBPL;ZFYVE20;PARP16;TIMM44;NAP1L1;WDR34;PAICS;MPP7;PLEKHA7;D730039F16RIK;SLC25A16;SLC9A6;C1D;CHPT1;ALDH8A1;1700001L05RIK;SF1'
        },
        {
          Term: 'FLI1 21867929 ChIP-Seq TH2 Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'CISD1;ARHGAP18;PTTG1IP;MAT2B;GPHN;PITPNC1;FARS2;MIPOL1;RPS6KA5;SIPA1L1;DDT;RDH14;ARSG;AW209491;ZRSR1;CEP68;KLF12;CRADD;MDH1;RHBDD3;ASCC1;NSUN3;UBE2E1;LIFR;NAP1L1;POLRMT;SLC25A16;C1D;RAB1;TFAM;TRIM37;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'TBX20 22080862 ChIP-Seq HEART Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP106;ZFP148;D4BWG0951E;CNO;MTMR14;CISD1;CREBL2;PTTG1IP;MAT2B;NR3C1;3110057O12RIK;ZC3H12C;SIPA1L1;SPTLC1;NAGLU;PSMB1;CDK5RAP1;RDH14;GPR155;2610019F03RIK;CPT1A;TMEM86A;AFAP1L1;ARHGEF12;MDH1;ASCC1;AI316807;IFT122;PARP16;LIFR;MCAT;MPP7;PRPF18;SMO'
        },
        {
          Term: 'TBX20 22328084 ChIP-Seq HEART Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP106;ZFP148;D4BWG0951E;CNO;MTMR14;CISD1;CREBL2;PTTG1IP;MAT2B;NR3C1;3110057O12RIK;ZC3H12C;SIPA1L1;SPTLC1;NAGLU;PSMB1;CDK5RAP1;RDH14;GPR155;2610019F03RIK;CPT1A;TMEM86A;AFAP1L1;ARHGEF12;MDH1;ASCC1;AI316807;IFT122;PARP16;LIFR;MCAT;MPP7;PRPF18;SMO'
        },
        {
          Term: 'GATA2 22383799 ChIP-Seq G1ME Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'FECH;BRI3;ABHD3;HPN;ZDHHC5;ADK;PTTG1IP;WDR89;C330018D20RIK;TMEM186;4932438A13RIK;SIPA1L1;NAGLU;DDT;PRKACA;GPR155;FBXO9;CEP68;FN3K;TRAP1;SLC30A6;2510006D16RIK;FAHD1;WDR34;2210016F16RIK;KMO;COQ10A;LASS2;VAMP8;TCN2;TOMM70A;TSR2;TLCD1;PKIG'
        },
        {
          Term: 'SA1 22415368 ChIP-Seq MEFs Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'TPMT;D4BWG0951E;CNO;RFESD;NOL7;CREBL2;C330018D20RIK;NR3C1;YARS2;5730403B10RIK;PITPNC1;GYS2;SIPA1L1;EXOSC4;NAGLU;AFMID;2810432D09RIK;PMPCB;MGAT1;MRPL9;HOXA7;TMED4;ZRSR1;ZFP655;KLHDC4;IAH1;ACBD4;ARHGEF12;FZD5;ADHFE1;CABLES1;MCAT;TLCD1;NOTUM'
        },
        {
          Term: 'TOP2B 26459242 ChIP-Seq MCF-7 Human',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'LIPT1;GBE1;GLO1;NOL7;ORC5L;ARHGAP18;MAT2B;PHF7;KALRN;ADH5;NPY;CDK5RAP1;FBXO8;NEO1;DNAJC19;CPT1A;KLF12;TMEM30A;MDH1;HSD3B2;TRPC2;ZFYVE20;MUT;MPP7;PLEKHA7;PRPF18;SMO;PLSCR2;AGBL3;C1D;ACO1;FGFR4;ALDH8A1;ASF1A'
        },
        {
          Term: 'MYB 26560356 Chip-Seq TH2 Human',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'NDUFB6;USP34;CREBL2;PTTG1IP;PCSK7;ZBTB44;TFB1M;TM7SF3;LRRC1;DHTKD1;ESM1;MED14;RPS6KA5;NPY;FBXO3;POLI;MGAT1;SMYD4;GPR155;CD55;SAC3D1;CEP68;SLC30A6;CPT1A;LYPLA1;KLHDC4;ASCC1;SLC33A1;NAP1L1;FAH;KMO;NME7;TOMM70A;SF1'
        },
        {
          Term: 'MAF 26560356 Chip-Seq TH2 Human',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'NLRX1;OSGEPL1;USP34;ZDHHC5;CREBL2;PCSK7;ZBTB44;WDR89;WDR24;ATXN2;NFS1;H2AFJ;DDT;HYI;SMYD4;MRPL9;SEPHS2;CEP68;GADD45GIP1;CPT1A;TMEM86A;KLF12;IAH1;TOR1A;ABHD14A;NAP1L1;ATAD3A;KLF1;LASS2;ANKRD42;PKIG;NAT9;ASF1A;SF1'
        },
        {
          Term: 'FLI1 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP148;2700046G09RIK;IPP;CISD1;NOL7;WDR89;DHTKD1;PCMTD2;KDR;HYI;RDH14;SMYD4;BPNT1;NDUFV1;BC016495;RBM39;TOR1A;1700123L14RIK;NSUN3;IFT122;WDR34;ITFG1;MPP7;GNMT;VAMP8;DMXL1;TOMM70A;DOLPP1;CAT;C1D;RAB1;TLN1;ALDH8A1;SF1'
        },
        {
          Term: 'KAP1 27257070 Chip-Seq ESCs Mouse',
          Overlap: '34/2000',
          'P-value': '0.7528361114881791',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9066666666666667',
          'Combined Score': '0.2574096682158911',
          Genes: 'ZFP787;GLO1;MYNN;CREBL2;ZBTB44;MAT2B;GPHN;3110057O12RIK;GK5;NFS1;SIPA1L1;2810432D09RIK;SLC25A40;TASP1;LRRC8A;BPNT1;ARSG;SEPHS2;CD55;PMS1;FBXO9;TMED4;ZRSR1;CPT1A;LYPLA1;CRADD;FZD5;WDR34;2210016F16RIK;POLRMT;4933403G14RIK;NSMCE4A;ACO1;ZCCHC3'
        },
        {
          Term: 'NANOG 18347094 ChIP-ChIP MESCs Mouse',
          Overlap: '32/1908',
          'P-value': '0.7730271411642234',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8944793850454229',
          'Combined Score': '0.2302757742949502',
          Genes: 'ZFP106;ZFP148;TM2D2;D4BWG0951E;GBE1;ADK;ACAA1A;MAT2B;YARS2;PITPNC1;ATXN2;ABHD11;NPY;PSMB1;SLC25A40;HOXA7;RAB11FIP2;B3BP;KLF12;FAHD1;FKBPL;ELL3;COQ10A;MPP7;PLEKHA7;4933403G14RIK;DALRD3;SBK1;DMXL1;AQP11;CHPT1;NAT9'
        },
        {
          Term: 'NANOG 18700969 ChIP-ChIP MESCs Mouse',
          Overlap: '5/344',
          'P-value': '0.7757328003616341',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7751937984496124',
          'Combined Score': '0.19685825389518796',
          Genes: 'CRADD;FZD5;D4BWG0951E;BPNT1;VLDLR'
        },
        {
          Term: 'NUCKS1 24931609 ChIP-Seq HEPATOCYTES Mouse',
          Overlap: '9/588',
          'P-value': '0.7767179392135161',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8163265306122449',
          'Combined Score': '0.20626776090998303',
          Genes: 'FZD5;FECH;MYO6;CABLES1;PRKACA;FBXO8;TLN1;NR3C1;FGFR4'
        },
        {
          Term: 'SMARCA4 20176728 ChIP-ChIP TSCs Mouse',
          Overlap: '18/1118',
          'P-value': '0.7803937738479448',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8586762075134169',
          'Combined Score': '0.21291447449291134',
          Genes: 'ASCC1;GLO1;NUDT6;UBIE;5730403B10RIK;PLEKHA7;LRRC1;LASS2;NFS1;RPS6KA5;SIPA1L1;SMO;TMBIM4;NPY;AFMID;TXNDC4;RQCD1;METTL8'
        },
        {
          Term: 'CEBPB 26923725 Chip-Seq HEMANGIOBLAST Mouse',
          Overlap: '10/652',
          'P-value': '0.7836198714450539',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8179959100204499',
          'Combined Score': '0.1994529521995926',
          Genes: 'KLF12;DMXL1;WDR20A;ADK;CABLES1;PARP16;CLCC1;PRKACA;PKIG;GPHN'
        },
        {
          Term: 'STAT1 20625510 ChIP-Seq HELA Human',
          Overlap: '10/656',
          'P-value': '0.7897892027361398',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8130081300813008',
          'Combined Score': '0.19186113911107835',
          Genes: 'SLC25A16;SPTLC1;MDH1;IFT122;LIFR;ACO1;ZFAND1;PKIG;MCAT;TMEM186'
        },
        {
          Term: 'GATA2 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '28/1708',
          'P-value': '0.7987519785207009',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8743169398907105',
          'Combined Score': '0.1964632098555091',
          Genes: 'GLO1;ARHGAP18;PTTG1IP;NR3C1;RABEPK;SIPA1L1;NAGLU;PMPCB;METTL8;SEPHS2;2610019F03RIK;TMED4;ZRSR1;CEP68;ZFP655;CRADD;WDR20A;NSUN3;TRPC2;PARP16;KMO;2610528J11RIK;LASS2;VAMP8;UBOX5;CDAN1;PLSCR2;PKIG'
        },
        {
          Term: 'OCT4 18692474 ChIP-Seq MEFs Mouse',
          Overlap: '33/1992',
          'P-value': '0.7990016239168929',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8835341365461848',
          'Combined Score': '0.1982582577183875',
          Genes: 'ZFP148;D4BWG0951E;EI24;ADK;PROZ;2010309E21RIK;SIP1;2700038C09RIK;ATXN2;NFS1;1700034H14RIK;CDK5RAP1;NDUFV1;SAC3D1;CPT1A;LYPLA1;KLF12;ACBD4;FZD5;SLC33A1;UBE2E1;LRRC40;FAH;PAICS;CACNB4;TMEM77;RAB1;RQCD1;FBXL3;MTFR1;TLN1;FGFR4;FBXL6'
        },
        {
          Term: 'CREB1 20920259 ChIP-Seq GC1-SPG Mouse',
          Overlap: '52/3057',
          'P-value': '0.7990878587942224',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9072075019081888',
          'Combined Score': '0.2034724705701472',
          Genes: 'OSGEPL1;ZDHHC5;ORC5L;RABEPK;SPTLC1;FBXO3;RIOK2;PRKACA;TMED4;CPT1A;FKBPL;VPS13B;PEX1;SLC25A16;DALRD3;SMO;C1D;RAB1;SF1;ZFP787;ENY2;ZFP748;NDUFB6;CNO;GLO1;MYNN;5730403B10RIK;4932438A13RIK;GK5;PSMB1;TASP1;SMYD4;GPR155;NDUFV1;TRAP1;TMEM86A;KLHDC4;ACBD4;TMEM30A;FZD5;MDH1;IFT122;TIMM44;FAH;ALDH6A1;SLC7A6OS;SLC25A39;LYRM5;DOLPP1;RQCD1;NUPL2;FBXL6'
        },
        {
          Term: 'OLIG2 26023283 ChIP-Seq AINV15 Mouse',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'LIPT1;MOBKL2B;ZFP748;D4BWG0951E;GBE1;TFB1M;PITPNC1;NFS1;PMPCB;HYI;GPR155;GADD45GIP1;RBM39;CRADD;FZD5;FKBPL;ADHFE1;UBE2E1;CABLES1;PARP16;NAP1L1;PAICS;PLEKHA7;GSTZ1;PRPF18;NSMCE4A;SBK1;DOLPP1;RAB1;TFAM;ACO1;NOTUM;ZCCHC3'
        },
        {
          Term: 'GATA1 19941827 ChIP-Seq MEL86 Mouse',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'ZFP106;FECH;WDR89;TMEM186;5730403B10RIK;PITPNC1;ZC3H12C;TASP1;BPNT1;ARSG;2610019F03RIK;BC016495;ZRSR1;CEP68;KLHDC4;TOR1A;ARHGEF12;CRADD;MDH1;HSD3B2;ANXA13;VPS13B;NAP1L1;2210016F16RIK;2610036D13RIK;LASS2;4933403G14RIK;ALDH1A3;PRPF18;NME7;TLCD1;ALDH8A1;SFXN5'
        },
        {
          Term: 'PU.1 20513432 ChIP-Seq Bcells Mouse',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'ENY2;NLRX1;ABHD3;STXBP2;NOL7;ARHGAP18;PHF7;NR3C1;4932438A13RIK;PSMC3IP;SIPA1L1;EXOSC4;NAGLU;SAC3D1;CEP68;LYPLA1;CRADD;MDH1;RHBDD3;NSUN3;CABLES1;NAP1L1;MCAT;DNAJC18;VAMP8;DEFB29;C1D;UFC1;RAB1;NAT9;ASF1A;SF1;FBXL6'
        },
        {
          Term: 'TAL1 21186366 ChIP-Seq BM-HSCs Mouse',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'ENY2;CISD1;ADK;ARHGAP18;PTTG1IP;MAT2B;GPHN;PITPNC1;MIPOL1;RPS6KA5;SIPA1L1;DDT;RDH14;MGAT1;AP4S1;ARSG;AW209491;ZRSR1;CEP68;CRADD;ASCC1;VPS13B;NAP1L1;POLRMT;SLC25A16;TMBIM4;C1D;RAB1;TFAM;TRIM37;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'KLF6 26769127 Chip-Seq PDAC-Cell line Human',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'LRRC56;COX15;CNO;RFESD;IPP;CISD1;ADK;ZBTB44;TM7SF3;PITPNC1;ZC3H12C;RPS6KA5;FBXO3;HYI;CLCC1;GAL3ST2;RBM39;CPT1A;KLF12;RWDD3;ARHGEF12;CABLES1;ATAD3A;ELL3;PLEKHA7;LASS2;ALDH1A3;NSMCE4A;SLC25A39;TCN2;TFAM;TRIM37;SF1'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq SUP-B15 Human',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'MOBKL2B;ABHD3;HPN;IPP;ARHGAP18;SAT2;VWCE;TM7SF3;NR3C1;PITPNC1;ZC3H12C;ATXN2;MGAT1;PRKACA;RILP;CD55;SCYL1;CEP68;CPT1A;KLHDC4;KLF12;ADHFE1;CABLES1;MCAT;ATAD3A;LASS2;SMO;CAT;CHPT1;TLCD1;NOTUM;ASF1A;SFXN5'
        },
        {
          Term: 'IRF8 27001747 Chip-Seq BMDM Mouse',
          Overlap: '33/2000',
          'P-value': '0.80610862611154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8800000000000001',
          'Combined Score': '0.1896723608611681',
          Genes: 'MOBKL2B;RFESD;MTMR14;HPN;1110003E01RIK;MAT2B;C330018D20RIK;NR3C1;GPHN;LRRC1;FARS2;MIPOL1;1110032A03RIK;ESM1;MYO6;MGAT1;ARSG;GPR155;2610019F03RIK;HIBCH;DNAJC19;TMEM86A;CRADD;FZD5;VPS13B;NAP1L1;CDAN1;4930432O21RIK;ANKRD42;YME1L1;TLN1;PKIG;SFXN5'
        },
        {
          Term: 'KLF1 20508144 ChIP-Seq FETAL-LIVER-ERYTHROID Mouse',
          Overlap: '18/1144',
          'P-value': '0.8107302514397748',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8391608391608393',
          'Combined Score': '0.176072637042688',
          Genes: 'FN3K;1810049H13RIK;2700046G09RIK;INTU;COX15;CNO;ASCC1;PARP16;C330018D20RIK;KALRN;RABEPK;PITPNC1;KLF1;CACNB4;CAT;MTFR1;AW209491;TRIM23'
        },
        {
          Term: 'SMARCD1 25818293 ChIP-Seq ESCs Mouse',
          Overlap: '35/2119',
          'P-value': '0.8110456336617438',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8809186723297152',
          'Combined Score': '0.18449164152148376',
          Genes: 'ZFP148;ZDHHC5;ADK;VLDLR;4932438A13RIK;PITPNC1;FARS2;SRR;RPS6KA5;SIPA1L1;1700034H14RIK;MYO6;SLC25A40;AP4S1;ARSG;FBXO8;RBM39;CPT1A;LYPLA1;KLF12;CRADD;ENTPD5;WDR34;POLRMT;MCAT;MPP7;LASS2;UBOX5;CACNB4;DMXL1;ASB9;ATP6V1B2;YME1L1;TLCD1;SF1'
        },
        {
          Term: 'GATA2 26923725 Chip-Seq HEMANGIOBLAST Mouse',
          Overlap: '1/88',
          'P-value': '0.811626186384968',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6060606060606061',
          'Combined Score': '0.12649418570561108',
          Genes: 'ALDH8A1'
        },
        {
          Term: 'VDR 21846776 ChIP-Seq THP-1 Human',
          Overlap: '12/794',
          'P-value': '0.8155351067961619',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8060453400503779',
          'Combined Score': '0.16436135692480727',
          Genes: 'CPT1A;DALRD3;CRADD;ZDHHC5;HYI;LRRC8A;TLCD1;WDR89;PRKACA;MCAT;NDUFV1;GPHN'
        },
        {
          Term: 'SETDB1 19884257 ChIP-Seq MESCs Mouse',
          Overlap: '39/2353',
          'P-value': '0.8175228048234615',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8839779005524862',
          'Combined Score': '0.1781007565005912',
          Genes: 'ZFP787;3110048L19RIK;NDUFB6;1200014M14RIK;ARHGAP18;2010309E21RIK;CREBL2;PTTG1IP;NR3C1;5730403B10RIK;3110001I20RIK;GYS2;ZFP11;SLC25A40;AP4S1;LRRC8A;2610019F03RIK;RILP;SCYL1;ZRSR1;ZFP655;ACBD4;FAHD1;RHBDD3;WDR20A;SLC33A1;AI316807;VPS13B;FAH;POLRMT;KLF1;4933403G14RIK;LYRM2;4833426J09RIK;RAB1;A930041I02RIK;NOTUM;NUPL2;ZCCHC3'
        },
        {
          Term: 'ZFP322A 24550733 ChIP-Seq MESCs Mouse',
          Overlap: '1/90',
          'P-value': '0.8186547258621788',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5925925925925927',
          'Combined Score': '0.11857354913352297',
          Genes: 'SMO'
        },
        {
          Term: 'ELK1 19687146 ChIP-ChIP HELA Human',
          Overlap: '14/916',
          'P-value': '0.819051716581543',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8151382823871907',
          'Combined Score': '0.16270816393529908',
          Genes: 'OSGEPL1;CRADD;NSUN3;VPS13B;TFB1M;KMO;PRPF18;C1D;UFC1;ANKRD42;FBXO3;MGAT1;SF1;NUDT12'
        },
        {
          Term: 'MYC 22102868 ChIP-Seq BL Human',
          Overlap: '12/797',
          'P-value': '0.8193629099635305',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8030112923462986',
          'Combined Score': '0.1599824781059229',
          Genes: 'LYPLA1;KLHDC4;KLF12;DALRD3;SLC25A39;TGDS;MYNN;ADK;NAP1L1;ZCCHC3;PITPNC1;SCYL1'
        },
        {
          Term: 'RUNX1 26923725 Chip-Seq HPCs Mouse',
          Overlap: '13/859',
          'P-value': '0.822077314083526',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.807140085370586',
          'Combined Score': '0.15813555729741424',
          Genes: 'TRAP1;LIFR;PTTG1IP;WDR34;GPHN;VAMP8;ALDH1A3;1700034H14RIK;C1D;RAB1;ATP6V1B2;SMYD4;TLN1'
        },
        {
          Term: 'SETDB1 19884255 ChIP-Seq MESCs Mouse',
          Overlap: '33/2020',
          'P-value': '0.8231262723078757',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8712871287128714',
          'Combined Score': '0.16959225889869547',
          Genes: 'ZFP106;2610528K11RIK;1110003E01RIK;ZDHHC5;ADK;PROZ;ZBTB44;TM7SF3;NR3C1;TMEM186;GPHN;THTPA;SIP1;EXOSC4;H2AFJ;AFMID;2810432D09RIK;SEPHS2;SAC3D1;PAIP1;B3BP;TGDS;LRRC61;OVOL1;MCAT;COQ10A;GSTZ1;WBSCR18;RNF167;PSMC6;CAT;ANKRD42;ZCCHC3'
        },
        {
          Term: 'CEBPD 21427703 ChIP-Seq 3T3-L1 Mouse',
          Overlap: '28/1735',
          'P-value': '0.8236011205518665',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8607108549471661',
          'Combined Score': '0.1670372460857132',
          Genes: 'MOBKL2B;INTU;9030420J04RIK;GBE1;ORC5L;ARHGAP18;VLDLR;MAT2B;NR3C1;NXT2;NUDT6;ATXN2;ABHD11;H2AFJ;CDK5RAP1;TASP1;GPR155;NEO1;RBM39;CPT1A;LRRC61;PARP16;VAMP8;PSMC6;CAT;ATP6V1B2;MTFR1;SFXN5'
        },
        {
          Term: 'POU5F1 26923725 Chip-Seq MESODERM Mouse',
          Overlap: '8/559',
          'P-value': '0.8263765288233337',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7632677400119261',
          'Combined Score': '0.1455587936891549',
          Genes: 'SLC7A6OS;ARHGEF12;9030420J04RIK;DMXL1;ADK;ATP6V1B2;ARHGAP18;CLCC1'
        },
        {
          Term: 'TEAD4 26923725 Chip-Seq HEMANGIOBLAST Mouse',
          Overlap: '8/559',
          'P-value': '0.8263765288233337',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7632677400119261',
          'Combined Score': '0.1455587936891549',
          Genes: 'SLC7A6OS;ARHGEF12;9030420J04RIK;DMXL1;ADK;ATP6V1B2;ARHGAP18;CLCC1'
        },
        {
          Term: 'FOXP2 23625967 ChIP-Seq PFSK-1 AND SK-N-MC Human',
          Overlap: '13/863',
          'P-value': '0.8268737790045175',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8033989957512554',
          'Combined Score': '0.1527287366416656',
          Genes: 'ARHGEF12;CNO;RFESD;MTMR14;CREBL2;NR3C1;MUT;DHTKD1;SLC25A16;ALDH1A3;METTL8;CD55;TRIM23'
        },
        {
          Term: 'LMO2 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '28/1741',
          'P-value': '0.8288180672161862',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8577445912310933',
          'Combined Score': '0.16104549989144354',
          Genes: 'LIPT1;2700046G09RIK;MTMR14;GLO1;ARHGAP18;PTTG1IP;SIPA1L1;NAGLU;MGAT1;SEPHS2;2610019F03RIK;FBXO9;ZRSR1;CEP68;ZFP655;CPT1A;CRADD;PARP16;KMO;2610528J11RIK;ELL3;LASS2;VAMP8;UBOX5;NME7;PLSCR2;RQCD1;PKIG'
        },
        {
          Term: 'MYCN 21190229 ChIP-Seq SHEP-21N Human',
          Overlap: '5/373',
          'P-value': '0.8315782440003251',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7149240393208222',
          'Combined Score': '0.13185335832441172',
          Genes: 'LIPT1;CLDN10;CACNB4;CHPT1;ELL3'
        },
        {
          Term: 'PPARG 20176806 ChIP-Seq 3T3-L1 Mouse',
          Overlap: '29/1807',
          'P-value': '0.8360258306217323',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.855930640103302',
          'Combined Score': '0.15329355577360637',
          Genes: 'ZFP148;D4BWG0951E;GLO1;ARHGAP18;CREBL2;VLDLR;NR3C1;4932438A13RIK;ZFP11;SIPA1L1;AP4S1;LRRC8A;FBXO8;CPT1A;KLF12;FZD5;MDH1;LRRC61;IFT122;CABLES1;POLRMT;MPP7;2610036D13RIK;4933403G14RIK;LYRM2;SMO;DOLPP1;CAT;SFXN5'
        },
        {
          Term: 'FOXP1 21924763 ChIP-Seq HESCs Human',
          Overlap: '63/3724',
          'P-value': '0.836622421316879',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.9022556390977443',
          'Combined Score': '0.16094654419033877',
          Genes: 'TPMT;MTMR14;ZDHHC5;ADK;PCSK7;TM7SF3;YARS2;RABEPK;PITPNC1;LRRC1;DHTKD1;THTPA;SPTLC1;ABHD11;SLC25A40;PRKACA;FBXO9;CPT1A;LYPLA1;KLF12;ARHGEF12;FKBPL;OXSM;NSUN3;ZFYVE20;ABHD14A;OVOL1;WDR34;VAMP8;SLC25A16;DALRD3;SMO;TLCD1;ASF1A;LRRC56;TM2D2;BRI3;GLO1;CREBL2;MAT2B;SRR;MYO6;AP4S1;LRRC8A;METTL8;NDUFV1;RILP;RWDD3;ACBD4;TMEM30A;ASCC1;ADHFE1;SLC33A1;PARP16;TIMM44;NAP1L1;LASS2;SLC25A39;SBK1;ACO1;TRIM37;NOTUM;FBXL6'
        },
        {
          Term: 'CEBPD 23245923 ChIP-Seq MEFs Mouse',
          Overlap: '7/504',
          'P-value': '0.8371273698682369',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7407407407407407',
          'Combined Score': '0.13168818207030983',
          Genes: 'ZC3H12C;PRPF18;1700123L14RIK;TRIM37;METTL8;FARS2;NUDT12'
        },
        {
          Term: 'EOMES 21245162 ChIP-Seq HESCs Human',
          Overlap: '14/932',
          'P-value': '0.8373559778991465',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8011444921316166',
          'Combined Score': '0.14220795162337924',
          Genes: 'KLHDC4;KLF12;CISD1;ZDHHC5;SAT2;COQ10A;PLEKHA7;PITPNC1;DHTKD1;ALDH1A3;SRR;NAGLU;TLCD1;NEO1'
        },
        {
          Term: 'NOTCH1 21737748 ChIP-Seq TLL Human',
          Overlap: '3/245',
          'P-value': '0.8409949632181906',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6530612244897959',
          'Combined Score': '0.11309035628808865',
          Genes: 'RFESD;TASP1;NR3C1'
        },
        {
          Term: 'DACH1 20351289 ChIP-Seq MDA-MB-231 Human',
          Overlap: '27/1698',
          'P-value': '0.8411204564916999',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8480565371024734',
          'Combined Score': '0.14673108058708556',
          Genes: 'ABHD3;USP34;MYNN;NOL7;WDR89;YARS2;PCMTD2;PSMC3IP;NFS1;EXOSC4;CDK5RAP1;LRRC8A;TMED4;RBM39;CNTD1;ARHGEF12;OXSM;WDR42A;IFT122;TMEM80;DALRD3;TFAM;YME1L1;AQP11;TRIM37;RBKS;FBXL6'
        },
        {
          Term: 'JUN 21703547 ChIP-Seq K562 Human',
          Overlap: '25/1585',
          'P-value': '0.8434048934462177',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8412197686645636',
          'Combined Score': '0.1432665704645827',
          Genes: 'TPMT;BRI3;ABHD3;GLO1;STXBP2;ADK;VLDLR;KALRN;ESM1;RPS6KA5;NPY;MYO6;SLC25A40;AP4S1;NDUFV1;FBXO9;NUDT12;SCYL1;CPT1A;TMEM30A;TGDS;UBE2E1;SBK1;C1D;ALDH8A1'
        },
        {
          Term: 'NR1I2 20693526 ChIP-Seq LIVER Mouse',
          Overlap: '14/939',
          'P-value': '0.8449134910692745',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7951721689740859',
          'Combined Score': '0.13400323636105485',
          Genes: 'ZFP148;A530050D06RIK;CRADD;ADK;PROZ;LIFR;PITPNC1;FARS2;WBSCR18;SIPA1L1;SCP2;SMO;GORASP1;A930041I02RIK'
        },
        {
          Term: 'SALL4 18804426 ChIP-ChIP MESCs Mouse',
          Overlap: '16/1062',
          'P-value': '0.8483721978720242',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8035153797865662',
          'Combined Score': '0.13212671590147132',
          Genes: 'B3BP;LYPLA1;D4BWG0951E;CREBL2;4632404H12RIK;ZFAND1;4933403G14RIK;ATXN2;CACNB4;TMEM77;GYK;PMPCB;FBXL3;MTFR1;TLN1;NEO1'
        },
        {
          Term: 'IRF8 21731497 ChIP-ChIP J774 Mouse',
          Overlap: '4/319',
          'P-value': '0.8517838353787974',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6687565308254964',
          'Combined Score': '0.10728359368886771',
          Genes: 'MYO6;ANKRD42;MGAT1;TLN1'
        },
        {
          Term: 'THRA 23701648 ChIP-Seq CEREBELLUM Mouse',
          Overlap: '2/179',
          'P-value': '0.8519391285791539',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.595903165735568',
          'Combined Score': '0.09548764247883326',
          Genes: 'STXBP2;ZFYVE20'
        },
        {
          Term: 'CRX 20693478 ChIP-Seq RETINA Mouse',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'LIPT1;OSGEPL1;CISD1;ARHGAP18;MAT2B;AP4S1;BPNT1;GAL3ST2;CD55;PMS1;HIBCH;ZRSR1;LYPLA1;IAH1;CRADD;FZD5;MDH1;RHBDD3;ASCC1;ADHFE1;NAP1L1;KMO;SLC25A16;NME7;COL4A4;UFC1;RAB1;RQCD1;TFAM;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'SOX6 21985497 ChIP-Seq MYOTUBES Mouse',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'LIPT1;OSGEPL1;ARHGAP18;PTTG1IP;SIPA1L1;MGAT1;BPNT1;GAL3ST2;CD55;PMS1;HIBCH;ZRSR1;LYPLA1;CRADD;FZD5;MDH1;RHBDD3;ASCC1;ADHFE1;WDR20A;KMO;TCN2;NME7;COL4A4;C1D;UFC1;RAB1;RQCD1;TFAM;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'TCF7 22412390 ChIP-Seq EML Mouse',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'ZFP787;NLRX1;INTU;HPN;NR3C1;RABEPK;PITPNC1;SIPA1L1;MGAT1;HOXA7;PAIP1;ZFP655;RBM39;CPT1A;TOR1A;RHBDD3;PARP16;NAP1L1;PAICS;COQ10A;KLF1;VAMP8;GSTZ1;ALDH1A3;DALRD3;SLC25A39;SBK1;SMO;GORASP1;FBXL3;TLCD1;SF1'
        },
        {
          Term: 'NCOR 22465074 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'ZFP106;OSGEPL1;CNO;CISD1;ZDHHC5;MYNN;ARHGAP18;MAT2B;YARS2;RABEPK;PITPNC1;RPS6KA5;NAGLU;H2AFJ;MYO6;KDR;RIOK2;AP4S1;ARSG;ZRSR1;CPT1A;TOR1A;CRADD;ENTPD5;4933403G14RIK;SLC25A39;TCN2;TMBIM4;RAB1;RQCD1;CHPT1;ASF1A'
        },
        {
          Term: 'CTCF 26484167 Chip-Seq Bcells Mouse',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'TPMT;STXBP2;RABEPK;MIPOL1;3110057O12RIK;AKR7A5;SRR;EXOSC4;NAGLU;DDT;1700034H14RIK;AFMID;2810432D09RIK;CDK5RAP1;CLCC1;PRKACA;HOXA7;SIAE;TMED4;ZRSR1;IAH1;ACBD4;IFT122;2210016F16RIK;DHRS1;MCAT;ATAD3A;PRPF18;PSMC6;TLCD1;NOTUM;FBXL6'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq SIL-ALL Human',
          Overlap: '32/2000',
          'P-value': '0.8520960680381592',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8533333333333334',
          'Combined Score': '0.13658112221521845',
          Genes: 'IPP;ZDHHC5;ZBTB44;MAT2B;WDR24;GPHN;ATXN2;NAGLU;CLCC1;GAL3ST2;SEPHS2;NEO1;RILP;SAC3D1;SCYL1;CEP68;CPT1A;KLF12;ARHGEF12;ABHD14A;NAP1L1;POLRMT;MCAT;ATAD3A;LASS2;DALRD3;DOLPP1;CHPT1;TLCD1;NOTUM;ZCCHC3;SF1'
        },
        {
          Term: 'ZFP281 18358816 ChIP-ChIP MESCs Mouse',
          Overlap: '8/578',
          'P-value': '0.8522933933774981',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7381776239907728',
          'Combined Score': '0.11797883497580205',
          Genes: 'FZD5;RHBDD3;WDR42A;CDK5RAP1;ABHD14A;NR3C1;ADH5;TRIM23'
        },
        {
          Term: 'NR3C1 21868756 ChIP-Seq MCF10A Human',
          Overlap: '17/1132',
          'P-value': '0.8582438291072352',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.800942285041225',
          'Combined Score': '0.12243767372833743',
          Genes: 'KLF12;INTU;TGDS;UBE2E1;NR3C1;PAICS;LRRC1;VAMP8;GK5;CLDN10;ABHD11;C1D;KDR;UFC1;RQCD1;RAB11FIP2;NEO1'
        },
        {
          Term: 'CEBPB 26923725 Chip-Seq MESODERM Mouse',
          Overlap: '16/1079',
          'P-value': '0.864467047692446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7908557306147668',
          'Combined Score': '0.11518188289626598',
          Genes: 'KLF12;IAH1;INTU;UBE2E1;MAT2B;YARS2;ITFG1;GPHN;GYS2;SLC25A16;FBXL3;RIOK2;CLCC1;PKIG;2610019F03RIK;SF1'
        },
        {
          Term: 'ELF1 20517297 ChIP-Seq JURKAT Human',
          Overlap: '15/1020',
          'P-value': '0.8655446195030723',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7843137254901961',
          'Combined Score': '0.11325204098340148',
          Genes: 'LRRC56;IAH1;ZFYVE20;SAT2;VWCE;PEX1;WDR34;UBOX5;SCP2;NAGLU;MGAT1;LRRC8A;METTL7A;SEPHS2;TRIM23'
        },
        {
          Term: 'SMAD3 22036565 ChIP-Seq ESCs Mouse',
          Overlap: '15/1020',
          'P-value': '0.8655446195030723',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7843137254901961',
          'Combined Score': '0.11325204098340148',
          Genes: 'CEP68;CPT1A;CRADD;FZD5;EI24;LIFR;COQ10A;PITPNC1;THTPA;ABHD11;DALRD3;NME7;SLC25A40;FBXL3;2610019F03RIK'
        },
        {
          Term: 'NFE2L2 22581777 ChIP-Seq LYMPHOBLASTOID Human',
          Overlap: '7/527',
          'P-value': '0.8679939490960316',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7084123972169514',
          'Combined Score': '0.10029032238180836',
          Genes: 'MTMR14;POLI;ACO1;PKIG;NR3C1;SFXN5;PMS1'
        },
        {
          Term: 'NANOG 18692474 ChIP-Seq MESCs Mouse',
          Overlap: '50/3052',
          'P-value': '0.8696368765448628',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8737439930100481',
          'Combined Score': '0.1220441570501716',
          Genes: '2610528K11RIK;D4BWG0951E;GBE1;ADK;ZFAND1;TFB1M;TM7SF3;YARS2;PITPNC1;RPS6KA5;ABHD11;1700034H14RIK;PMPCB;SLC25A40;CLCC1;FBXO9;SCYL1;B3BP;LYPLA1;KLF12;UBE2E1;COQ10A;D730039F16RIK;4933403G14RIK;TMEM77;RAB1;ZFP148;TM2D2;EI24;ZBTB44;2700038C09RIK;ATXN2;NPY;TXNDC4;BPNT1;NDUFV1;ZKSCAN1;BC016495;ACBD4;FZD5;PARP16;PLEKHA7;SBK1;DMXL1;AQP11;CLEC2H;CHPT1;NUPL2;A230062G08RIK;FBXL6'
        },
        {
          Term: 'FOXA1 27197147 Chip-Seq ENDOMETRIOID-ADENOCARCINOMA Human',
          Overlap: '8/594',
          'P-value': '0.8716437932111358',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7182940516273849',
          'Combined Score': '0.09867523774886386',
          Genes: 'CLDN10;KLF12;SIPA1L1;FZD5;MTMR14;NPY;CD55;ZKSCAN1'
        },
        {
          Term: 'ESR1 22446102 ChIP-Seq UTERUS Mouse',
          Overlap: '30/1916',
          'P-value': '0.8741624121868613',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8350730688935282',
          'Combined Score': '0.11230822070097146',
          Genes: 'GBE1;ARHGAP18;CREBL2;VLDLR;NR3C1;KALRN;GPHN;SIPA1L1;SPTLC1;NAGLU;MYO6;KDR;ARSG;METTL7A;SCYL1;TMEM86A;A530050D06RIK;SLC33A1;LRRC61;IFT122;VPS13B;PARP16;LIFR;2610528J11RIK;PLEKHA7;CLDN10;COL4A4;4833426J09RIK;TFAM;PKIG'
        },
        {
          Term: 'CDX2 19796622 ChIP-Seq MESCs Mouse',
          Overlap: '4/334',
          'P-value': '0.8752436656430854',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6387225548902197',
          'Combined Score': '0.08511166873984845',
          Genes: 'MOBKL2B;ARHGAP18;ZBTB44;HOXA7'
        },
        {
          Term: 'NR1H3 23393188 ChIP-Seq ATHEROSCLEROTIC-FOAM Human',
          Overlap: '8/599',
          'P-value': '0.8772501764204264',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7122982749026155',
          'Combined Score': '0.09328476414477012',
          Genes: 'AFAP1L1;NDUFB6;GLO1;HYI;PGM2;VLDLR;HIBCH;TMED4'
        },
        {
          Term: 'HSF1 23293686 ChIP-Seq STHDH STRIATAL Mouse',
          Overlap: '17/1156',
          'P-value': '0.8789471106628787',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7843137254901961',
          'Combined Score': '0.10120043372672687',
          Genes: 'FAHD1;ASCC1;MYNN;LRRC61;ZFAND1;TM7SF3;TMEM80;PSMC3IP;AKR7A5;TMBIM4;TMEM77;AFMID;TXNDC4;SMYD4;FGFR4;ZKSCAN1;SF1'
        },
        {
          Term: 'PPARD 23176727 ChIP-Seq KERATINOCYTES Mouse',
          Overlap: '2/194',
          'P-value': '0.8815398941652415',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5498281786941581',
          'Combined Score': '0.06932509747488501',
          Genes: 'ARSK;ABHD14A'
        },
        {
          Term: 'CLOCK 20551151 ChIP-Seq 293T Human',
          Overlap: '5/407',
          'P-value': '0.8820876384674237',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6552006552006552',
          'Combined Score': '0.0822040062701428',
          Genes: 'TMEM86A;DALRD3;BRI3;NAP1L1;SF1'
        },
        {
          Term: 'CRX 20693478 ChIP-Seq ADULT RETINA Mouse',
          Overlap: '9/668',
          'P-value': '0.8829173239412744',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.718562874251497',
          'Combined Score': '0.08947811758017092',
          Genes: 'AFAP1L1;TCN2;MDH1;RPS6KB1;WDR42A;UFC1;2010309E21RIK;MRPL9;DNAJC18'
        },
        {
          Term: 'ER 23166858 ChIP-Seq MCF-7 Human',
          Overlap: '13/920',
          'P-value': '0.8851009967202579',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7536231884057971',
          'Combined Score': '0.09198236282138306',
          Genes: 'KLHDC4;BRI3;ZFYVE20;ORC5L;PEX1;WDR89;GPHN;MIPOL1;SIPA1L1;RPS6KB1;PMPCB;AQP11;TRIM37'
        },
        {
          Term: 'SRY 22984422 ChIP-ChIP TESTIS Rat',
          Overlap: '2/197',
          'P-value': '0.8867632100558224',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5414551607445008',
          'Combined Score': '0.06507061294363624',
          Genes: 'FKBPL;UFC1'
        },
        {
          Term: 'SMAD2 18955504 ChIP-ChIP HaCaT Human',
          Overlap: '30/1936',
          'P-value': '0.8869946691765008',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8264462809917356',
          'Combined Score': '0.0991043856513988',
          Genes: 'MOBKL2B;TM2D2;ZDHHC5;ADK;VWCE;WDR89;YARS2;MIPOL1;ABHD11;H2AFJ;LRRC8A;HOXA7;CD55;HIBCH;SLC33A1;NSUN3;LRRC61;IFT122;VPS13B;OVOL1;TMEM80;DNAJC18;GSTZ1;WBSCR18;NME7;YME1L1;TLCD1;TLN1;NUPL2;RBKS'
        },
        {
          Term: 'SMAD3 18955504 ChIP-ChIP HaCaT Human',
          Overlap: '30/1936',
          'P-value': '0.8869946691765008',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8264462809917356',
          'Combined Score': '0.0991043856513988',
          Genes: 'MOBKL2B;TM2D2;ZDHHC5;ADK;VWCE;WDR89;YARS2;MIPOL1;ABHD11;H2AFJ;LRRC8A;HOXA7;CD55;HIBCH;SLC33A1;NSUN3;LRRC61;IFT122;VPS13B;OVOL1;TMEM80;DNAJC18;GSTZ1;WBSCR18;NME7;YME1L1;TLCD1;TLN1;NUPL2;RBKS'
        },
        {
          Term: 'SOX2 19030024 ChIP-ChIP MESCs Mouse',
          Overlap: '12/863',
          'P-value': '0.8892916570862429',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7415990730011588',
          'Combined Score': '0.0870118370778103',
          Genes: 'ABHD11;FZD5;1700023B02RIK;LYRM5;C1D;MYNN;2010309E21RIK;MAT2B;FAH;YARS2;RILP;TNFSF5IP1'
        },
        {
          Term: 'SOX9 26525672 Chip-Seq Limbbuds Mouse',
          Overlap: '18/1230',
          'P-value': '0.8895937069507279',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7804878048780488',
          'Combined Score': '0.09130960353721307',
          Genes: 'CEP68;CRADD;RHBDD3;ASCC1;ADHFE1;ARHGAP18;NAP1L1;MAT2B;WDR89;GPHN;PITPNC1;SIPA1L1;COL4A4;C1D;TFAM;ALDH8A1;ASF1A;PMS1'
        },
        {
          Term: 'WT1 19549856 ChIP-ChIP CCG9911 Human',
          Overlap: '2/199',
          'P-value': '0.8901262142751365',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5360134003350084',
          'Combined Score': '0.062387678401762736',
          Genes: 'MAT2B;NAT9'
        },
        {
          Term: 'KLF5 25053715 ChIP-Seq YYC3 Human',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'BRI3;PTTG1IP;MAT2B;TFB1M;NR3C1;KALRN;WDR24;FARS2;PCMTD2;SRR;ABHD11;NAGLU;NPY;RIOK2;MGAT1;CD55;NUDT12;RBM39;CPT1A;KLF12;CRADD;FZD5;WDR34;MCAT;SLC25A16;ALDH6A1;SMO;NME7;COL4A4;FBXL3;ALDH8A1'
        },
        {
          Term: 'RUNX2 24764292 ChIP-Seq MC3T3 Mouse',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'COX15;GBE1;CREBL2;WDR89;RABEPK;ADH5;PITPNC1;GK5;AFMID;2810432D09RIK;CDK5RAP1;POLI;RDH14;SMYD4;GPR155;TRAP1;RBM39;TMEM86A;ACBD4;MDH1;FKBPL;LIFR;COQ10A;NSMCE4A;SLC25A39;NME7;PLSCR2;RAB1;AQP11;NOTUM;TLN1'
        },
        {
          Term: 'ETS1 21867929 ChIP-Seq TH2 Mouse',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'NLRX1;GLO1;ZDHHC5;NR3C1;ZC3H12C;SIPA1L1;PRKACA;2610019F03RIK;NDUFV1;SAC3D1;SCYL1;CEP68;RBM39;CPT1A;KLF12;FAHD1;FZD5;MDH1;OXSM;TIMM44;2610528J11RIK;SMO;CAT;UFC1;RAB1;ANKRD42;FBXL3;TLCD1;TLN1;NAT9;SF1'
        },
        {
          Term: 'SOX11 22085726 ChIP-Seq ESNs Mouse',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: '1810049H13RIK;ZFP787;ZFP148;2700046G09RIK;ZDHHC5;VLDLR;VWCE;C330018D20RIK;5730403B10RIK;GK5;RPS6KA5;SCP2;NAGLU;DDT;1700034H14RIK;MYO6;AP4S1;DNAJC19;ZFP655;RBM39;TMEM86A;ADHFE1;2610528J11RIK;ELL3;VAMP8;ALDH1A3;SBK1;CHPT1;TLN1;ZCCHC3;SF1'
        },
        {
          Term: 'ELF3 26769127 Chip-Seq PDAC-Cell line Human',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'ABHD3;EI24;USP34;WDR89;THTPA;GK5;ZC3H12C;ATXN2;RPS6KA5;BPNT1;SEPHS2;NEO1;CD55;SCYL1;CPT1A;KLF12;RWDD3;ARHGEF12;FAHD1;UBE2E1;LIFR;KMO;ATAD3A;ELL3;LASS2;SLC25A16;TCN2;GORASP1;UFC1;TFAM;ATPAF1'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq HPB-ALL Human',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'IPP;CISD1;ZDHHC5;ADK;CREBL2;VWCE;GPHN;ZC3H12C;ATXN2;SIPA1L1;NAGLU;CLCC1;MRPL9;SEPHS2;SCYL1;CEP68;CPT1A;KLHDC4;KLF12;ARHGEF12;NAP1L1;OVOL1;ATAD3A;LASS2;NSMCE4A;SLC25A39;SBK1;ANKRD42;FBXL3;TLCD1;NOTUM'
        },
        {
          Term: 'UTX 26944678 Chip-Seq JUKART Human',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'USP34;IPP;ZDHHC5;MYNN;PROZ;PTTG1IP;MAT2B;WDR89;TM7SF3;RABEPK;LRRC1;RPS6KA5;ARSG;HOXA7;PAIP1;CEP68;CPT1A;KLF12;ARHGEF12;ABHD14A;ATAD3A;GSTZ1;RNF167;SLC25A39;SBK1;TMBIM4;PLSCR2;UFC1;TFAM;TLCD1;PKIG'
        },
        {
          Term: 'SOX2 27498859 Chip-Seq STOMACH Mouse',
          Overlap: '31/2000',
          'P-value': '0.8904581130871835',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8266666666666667',
          'Combined Score': '0.09590921763424133',
          Genes: 'ZFP787;TPMT;D4BWG0951E;CNO;RFESD;GLO1;ARHGAP18;TFB1M;5730403B10RIK;PITPNC1;PCMTD2;GK5;RPS6KA5;MYO6;POLI;NDUFV1;SAC3D1;TMED4;CPT1A;IAH1;FZD5;OXSM;ANXA13;IFT122;OVOL1;MPP7;4933403G14RIK;SMO;TOMM70A;ASF1A;SF1'
        },
        {
          Term: 'BACH1 22875853 ChIP-PCR HELA AND SCP4 Human',
          Overlap: '20/1352',
          'P-value': '0.890939423018282',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7889546351084813',
          'Combined Score': '0.09110756722397961',
          Genes: 'KLHDC4;MOBKL2B;TPMT;WDR42A;KALRN;PAICS;PITPNC1;KLF1;ALDH1A3;UBOX5;DMXL1;KDR;TXNDC4;TFAM;AP4S1;MTFR1;BPNT1;ASF1A;FBXO9;SF1'
        },
        {
          Term: 'VDR 24787735 ChIP-Seq THP-1 Human',
          Overlap: '11/805',
          'P-value': '0.8931247759770564',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7287784679089027',
          'Combined Score': '0.08237308769612109',
          Genes: 'CRADD;ASCC1;LRRC61;ARHGAP18;RIOK2;ACO1;LRRC8A;VLDLR;NR3C1;ALDH8A1;PITPNC1'
        },
        {
          Term: 'FOXM1 25889361 ChIP-Seq OE33 AND U2OS Human',
          Overlap: '13/932',
          'P-value': '0.8951007654792201',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7439198855507869',
          'Combined Score': '0.08244044285679619',
          Genes: 'RBM39;FAHD1;MTMR14;ZDHHC5;PEX1;NUDT6;GPHN;ABHD11;AFMID;CAT;SLC25A40;SAC3D1;SF1'
        },
        {
          Term: 'TFEB 21752829 ChIP-Seq HELA Human',
          Overlap: '11/808',
          'P-value': '0.8957073447752486',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7260726072607261',
          'Combined Score': '0.07997075765332005',
          Genes: 'TMEM30A;FAHD1;OSGEPL1;NAGLU;RFESD;GBE1;ARSK;SLC33A1;SMYD4;TIMM44;YARS2'
        },
        {
          Term: 'RUNX1 20887958 ChIP-Seq HPC-7 Mouse',
          Overlap: '16/1120',
          'P-value': '0.8978446299545016',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7619047619047619',
          'Combined Score': '0.08210151887031901',
          Genes: 'CEP68;CRADD;MTMR14;PARP16;PTTG1IP;4932438A13RIK;LASS2;VAMP8;CDAN1;TCN2;NAGLU;TMBIM4;PKIG;GAL3ST2;SEPHS2;FBXO9'
        },
        {
          Term: 'RXR 22108803 ChIP-Seq LS180 Human',
          Overlap: '7/555',
          'P-value': '0.8989284391204333',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6726726726726727',
          'Combined Score': '0.07167451651514849',
          Genes: 'CEP68;SLC30A6;ATXN2;INTU;CRADD;EI24;PAICS'
        },
        {
          Term: 'PAX6 23342162 ChIP-ChIP BETA-FORBRAIN-LENS Mouse',
          Overlap: '14/1001',
          'P-value': '0.9006333729394539',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.745920745920746',
          'Combined Score': '0.0780658390389734',
          Genes: 'TM2D2;GBE1;TM7SF3;MUT;3110057O12RIK;CLDN10;2700038C09RIK;GORASP1;2810432D09RIK;4930432O21RIK;C1D;5430437P03RIK;TASP1;RDH14'
        },
        {
          Term: 'CDKN2AIP 20523734 ChIP-Seq CORTICAL Neurons',
          Overlap: '1/123',
          'P-value': '0.9032213013302803',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4336043360433605',
          'Combined Score': '0.04413558032966306',
          Genes: 'FAH'
        },
        {
          Term: 'SUZ12 27294783 Chip-Seq NPCs Mouse',
          Overlap: '12/880',
          'P-value': '0.9032265052653917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7272727272727273',
          'Combined Score': '0.07402321499895122',
          Genes: 'LIPT1;LYPLA1;OSGEPL1;FZD5;NME7;ADHFE1;COL4A4;RQCD1;GAL3ST2;CD55;PMS1;HIBCH'
        },
        {
          Term: 'AHR 22903824 ChIP-Seq MCF-7 Human',
          Overlap: '9/690',
          'P-value': '0.9035087529318293',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6956521739130435',
          'Combined Score': '0.07058746517688158',
          Genes: 'ALDH1A3;KLHDC4;KLF12;ADK;CABLES1;NR3C1;PLEKHA7;ZKSCAN1;PITPNC1'
        },
        {
          Term: 'STAT3 24763339 ChIP-Seq IMN-ESCs Mouse',
          Overlap: '27/1788',
          'P-value': '0.9035199709852906',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8053691275167786',
          'Combined Score': '0.08171038805684268',
          Genes: '9030420J04RIK;GBE1;1110003E01RIK;PCSK7;ZBTB44;PITPNC1;SLC25A40;METTL8;NUDT12;ZRSR1;SLC30A6;KLF12;AFAP1L1;1700123L14RIK;CRADD;FZD5;HSD3B2;PARP16;LIFR;OVOL1;WDR34;ALDH1A3;NME7;ATP6V1B2;AQP11;FBXL3;CHPT1'
        },
        {
          Term: 'WDR5 24793694 ChIP-Seq LNCAP Human',
          Overlap: '10/757',
          'P-value': '0.9059524717997288',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7045354469396742',
          'Combined Score': '0.06958586257852717',
          Genes: 'CLDN10;NSMCE4A;DOLPP1;TRPC2;PARP16;TMEM80;NEO1;SFXN5;ZKSCAN1;PAIP1'
        },
        {
          Term: 'SPI1 22096565 ChIP-ChIP GC-B Mouse',
          Overlap: '25/1676',
          'P-value': '0.9071759783029796',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7955449482895783',
          'Combined Score': '0.07750105433742766',
          Genes: 'SCP2;ARSK;METTL7A;NDUFV1;HIBCH;BC016495;CPT1A;CRADD;MDH1;IFT122;ABHD14A;WDR34;FAH;KMO;CLDN10;ALDH6A1;TMEM77;NME7;DMXL1;4930432O21RIK;UFC1;RAB1;ANKRD42;TLN1;SF1'
        },
        {
          Term: 'STAT3 19079543 ChIP-ChIP MESCs Mouse',
          Overlap: '13/948',
          'P-value': '0.9073230405680642',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7313642756680732',
          'Combined Score': '0.07113009677617656',
          Genes: 'ZFP787;TMEM86A;4732435N03RIK;GLO1;ORC5L;CABLES1;PLEKHA7;DNAJC18;ZFP11;SCP2;HOXA7;RILP;NUDT12'
        },
        {
          Term: 'HTT 18923047 ChIP-ChIP STHdh Human',
          Overlap: '7/566',
          'P-value': '0.9092847242576699',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6595995288574794',
          'Combined Score': '0.06272594025050636',
          Genes: 'GYS2;GSTZ1;ZFP655;MOBKL2B;RWDD3;ZFYVE20;ARHGAP18'
        },
        {
          Term: 'EP300 21415370 ChIP-Seq HL-1 Mouse',
          Overlap: '14/1014',
          'P-value': '0.9099618137489154',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7363576594345825',
          'Combined Score': '0.06947729155607328',
          Genes: 'D630023B12RIK;TRAP1;KLHDC4;ANXA13;ADK;IFT122;LIFR;VLDLR;MUT;4933403G14RIK;SIPA1L1;TASP1;PGM2;RDH14'
        },
        {
          Term: 'POU5F1 18700969 ChIP-ChIP MESCs Mouse',
          Overlap: '7/567',
          'P-value': '0.9101796547344012',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6584362139917695',
          'Combined Score': '0.06196758924872333',
          Genes: 'SRR;SBK1;FZD5;GLO1;PTTG1IP;ZFAND1;TLN1'
        },
        {
          Term: 'TP53 18474530 ChIP-ChIP U2OS Human',
          Overlap: '11/827',
          'P-value': '0.9108982551035311',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7093913744457879',
          'Combined Score': '0.06620329227767127',
          Genes: 'GSTZ1;TMEM30A;PSMB1;LIFR;VWCE;FAH;TM7SF3;NR3C1;KALRN;ITFG1;MPP7'
        },
        {
          Term: 'ETS2 20176728 ChIP-ChIP TROPHOBLAST STEM CELLS Mouse',
          Overlap: '2/215',
          'P-value': '0.9138744363644556',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.49612403100775193',
          'Combined Score': '0.04468196967306969',
          Genes: 'AFMID;SFXN5'
        },
        {
          Term: 'ESR1 20079471 ChIP-ChIP T-47D Human',
          Overlap: '2/216',
          'P-value': '0.9151865427536879',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.49382716049382713',
          'Combined Score': '0.0437665988265213',
          Genes: 'LASS2;CD55'
        },
        {
          Term: 'GATA2 21666600 ChIP-Seq HMVEC Human',
          Overlap: '11/837',
          'P-value': '0.9181230384672173',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.700915969733174',
          'Combined Score': '0.059874953635968564',
          Genes: 'AFAP1L1;INTU;PLSCR2;RFESD;HPN;LRRC8A;VLDLR;PKIG;DHRS1;NR3C1;HIBCH'
        },
        {
          Term: 'PPARG 20176806 ChIP-Seq THIOMACROPHAGE Mouse',
          Overlap: '11/837',
          'P-value': '0.9181230384672173',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.700915969733174',
          'Combined Score': '0.059874953635968564',
          Genes: 'CPT1A;CRADD;NPY;IPP;ARHGAP18;MGAT1;AP4S1;CHPT1;METTL8;GPR155;5730403B10RIK'
        },
        {
          Term: 'SMARCA4 23332759 ChIP-Seq OLIGODENDROCYTES Mouse',
          Overlap: '39/2522',
          'P-value': '0.9191417126588418',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8247422680412372',
          'Combined Score': '0.06953811579687383',
          Genes: 'MOBKL2B;GBE1;ARHGAP18;WDR89;NR3C1;LRRC1;FARS2;SIP1;FBXO3;PMPCB;PGM2;RIOK2;RAB11FIP2;ZKSCAN1;HIBCH;NUDT12;TMEM86A;KLF12;ARHGEF12;CRADD;TGDS;ASCC1;WDR20A;LRRC40;VPS13B;CABLES1;LIFR;FAH;ITFG1;VAMP8;PRPF18;NME7;CAT;C1D;AQP11;TRIM37;PKIG;ASF1A;RBKS'
        },
        {
          Term: 'POU3F2 20337985 ChIP-ChIP 501MEL Human',
          Overlap: '25/1702',
          'P-value': '0.9209778551393214',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7833920877399139',
          'Combined Score': '0.06448827840302253',
          Genes: 'ZFP106;OSGEPL1;INTU;ABHD3;RFESD;MAT2B;TFB1M;NR3C1;NUDT6;FARS2;MIPOL1;GYS2;TMEM166;ESM1;MYO6;FBXO8;RAB11FIP2;NEO1;KLF12;PEX1;PSMC6;PLSCR2;LYRM5;TFAM;ALDH8A1'
        },
        {
          Term: 'E2F1 18555785 Chip-Seq ESCs Mouse',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'ZFP106;A930005H10RIK;4932438A13RIK;FBXO3;TASP1;BPNT1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH;LYPLA1;RWDD3;FZD5;LRRC40;WDR34;KMO;2610036D13RIK;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;MTFR1;PKIG'
        },
        {
          Term: 'CTCF 18555785 Chip-Seq ESCs Mouse',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'ZFP106;LIPT1;ADH5;PCMTD2;CDK5RAP1;TASP1;BPNT1;CD55;PMS1;HIBCH;RBM39;LYPLA1;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;LASS2;UBOX5;DEFB29;CDAN1;PRPF18;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG;ZCCHC3'
        },
        {
          Term: 'CTCF 21964334 Chip-Seq Bcells Human',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'UNC119B;FECH;COX15;RFESD;PTTG1IP;TM7SF3;YARS2;PITPNC1;GYS2;POLI;PRKACA;RILP;HIBCH;TRIM23;RWDD3;AFAP1L1;ACBD4;ARHGEF12;CRADD;CABLES1;TIMM44;DHRS1;ELL3;PRPF18;NSMCE4A;TFAM;YME1L1;TLCD1;FGFR4;ASF1A'
        },
        {
          Term: 'KAP1 22055183 ChIP-Seq ESCs Mouse',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'ZFP787;ZFP148;OSGEPL1;NDUFB6;GLO1;ORC5L;MAT2B;C330018D20RIK;5730403B10RIK;GYS2;GK5;ZFP11;SCP2;2610019F03RIK;CD55;ZKSCAN1;TMED4;ZRSR1;ZFP655;1700123L14RIK;ADHFE1;AI316807;2210016F16RIK;POLRMT;ELL3;LYRM2;SMO;RQCD1;ACO1;ZCCHC3'
        },
        {
          Term: 'EBF1 22473956 ChIP-Seq LYMPHODE Mouse',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'ZFP106;LIPT1;OSGEPL1;4932438A13RIK;DHTKD1;SCRN3;CDK5RAP1;TASP1;LRRC8A;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH;DNAJC19;LYPLA1;FZD5;ADHFE1;WDR34;KMO;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;RQCD1;YME1L1;MTFR1'
        },
        {
          Term: 'TCF12/HEB 22897851 ChIP-Seq JUKARTE6-1 Human',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'INTU;CNO;RFESD;IPP;NOL7;ARHGAP18;TMEM186;LRRC1;THTPA;ESM1;ATXN2;SIPA1L1;SPTLC1;NAGLU;CDK5RAP1;TASP1;PGM2;RIOK2;MGAT1;LRRC8A;METTL7A;CLCC1;RILP;CD55;SCYL1;KLF12;PEX1;ALDH6A1;LYRM5;ALDH8A1'
        },
        {
          Term: 'GATA4 25053715 ChIP-Seq YYC3 Human',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'OSGEPL1;RFESD;GBE1;GLO1;ZDHHC5;PTTG1IP;LRRC1;GYS2;RPS6KA5;SIPA1L1;NAGLU;H2AFJ;FBXO3;TASP1;MRPL9;CD55;TMED4;NUDT12;RBM39;MDH1;ADHFE1;ANXA13;PARP16;ATAD3A;PLEKHA7;LASS2;NME7;FBXL3;MTFR1;CHPT1'
        },
        {
          Term: 'GATA3 26560356 Chip-Seq TH2 Human',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'UNC119B;NDUFB6;GLO1;ORC5L;PROZ;PTTG1IP;ZBTB44;NR3C1;ADH5;PSMC3IP;ESM1;PMPCB;PGM2;SMYD4;CLCC1;GPR155;SLC30A6;KLHDC4;ARHGEF12;FAHD1;ASCC1;ENTPD5;LRRC61;OVOL1;DHRS1;FAH;PSMC6;NME7;PLSCR2;PKIG'
        },
        {
          Term: 'TAL1 26923725 Chip-Seq HPCs Mouse',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'ENY2;FECH;RFESD;MTMR14;MAT2B;TMEM186;PMPCB;FBXO8;CD55;ZKSCAN1;KLF12;TMEM30A;CRADD;APOOL;OXSM;AI316807;IFT122;VPS13B;LIFR;NAP1L1;WDR34;FAH;PLEKHA7;DNAJC18;ALDH1A3;LYRM2;PRPF18;SLC7A6OS;SMO;DMXL1'
        },
        {
          Term: 'E2A 27217539 Chip-Seq RAMOS-Cell line Human',
          Overlap: '30/2000',
          'P-value': '0.9213518285028176',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8',
          'Combined Score': '0.0655306468898762',
          Genes: 'OSGEPL1;BRI3;CISD1;ARHGAP18;TM7SF3;YARS2;LRRC1;PSMC3IP;NAGLU;CDK5RAP1;PGM2;MGAT1;METTL7A;CLCC1;SEPHS2;RILP;CEP68;RBM39;KLHDC4;IAH1;ACBD4;PARP16;MCAT;ELL3;PRPF18;DMXL1;TRIM37;TLCD1;NOTUM;ZCCHC3'
        },
        {
          Term: 'NOTCH1 17114293 ChIP-ChIP T-ALL Human',
          Overlap: '1/134',
          'P-value': '0.9215179826690975',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.39800995024875624',
          'Combined Score': '0.032530542288729536',
          Genes: 'MDH1'
        },
        {
          Term: 'ESR1 21235772 ChIP-Seq MCF-7 Human',
          Overlap: '2/228',
          'P-value': '0.9295360827137459',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4678362573099415',
          'Combined Score': '0.0341846330229108',
          Genes: 'ZFP106;GPHN'
        },
        {
          Term: 'RELA 24523406 ChIP-Seq FIBROSARCOMA Human',
          Overlap: '16/1182',
          'P-value': '0.9354283358525859',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7219402143260011',
          'Combined Score': '0.04819004454114741',
          Genes: 'TPMT;FECH;PTTG1IP;WDR89;NR3C1;NXT2;FARS2;UBOX5;TCN2;TMBIM4;ASB9;TLCD1;PRKACA;NEO1;CD55;RBKS'
        },
        {
          Term: 'YAP1 20516196 ChIP-Seq MESCs Mouse',
          Overlap: '35/2329',
          'P-value': '0.9354933081124146',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8014884786031201',
          'Combined Score': '0.05344428292213939',
          Genes: 'INTU;9030420J04RIK;MTMR14;1200014M14RIK;GLO1;PTTG1IP;5730403B10RIK;GPHN;PITPNC1;ESM1;SPTLC1;NPY;AFMID;SMYD4;ARSG;PRKACA;PMS1;FBXO9;NUDT12;SCYL1;DNAJC19;KLF12;CRADD;APOOL;WDR42A;ZFYVE20;ITFG1;ALDH1A3;RPS6KB1;NME7;DMXL1;ATP6V1B2;ACO1;TRIM37;SFXN5'
        },
        {
          Term: 'OLIG2 23332759 ChIP-Seq OLIGODENDROCYTES Mouse',
          Overlap: '30/2040',
          'P-value': '0.9381588547969951',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7843137254901961',
          'Combined Score': '0.050067442761238264',
          Genes: 'GBE1;ARHGAP18;VLDLR;MAT2B;TM7SF3;NR3C1;KALRN;LRRC1;SIPA1L1;NPY;SCRN3;CDK5RAP1;RIOK2;FBXO8;CD55;NUDT12;KLF12;RWDD3;ARHGEF12;CRADD;TGDS;OXSM;LRRC40;VPS13B;CABLES1;LIFR;FAH;PAICS;PRPF18;RBKS'
        },
        {
          Term: 'PAX3-FKHR 20663909 ChIP-Seq RHABDOMYOSARCOMA Human',
          Overlap: '14/1063',
          'P-value': '0.9388641426195073',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.702414550015679',
          'Combined Score': '0.04431146596571281',
          Genes: 'INTU;GBE1;NSUN3;LRRC61;CABLES1;VLDLR;GPHN;ALDH1A3;SIPA1L1;NSMCE4A;KDR;FGFR4;CD55;NUDT12'
        },
        {
          Term: 'AR 20517297 ChIP-Seq VCAP Human',
          Overlap: '30/2047',
          'P-value': '0.9407706912339644',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7816316560820713',
          'Combined Score': '0.04772318932929206',
          Genes: 'ENY2;MOBKL2B;GBE1;MTMR14;VLDLR;ZBTB44;TM7SF3;LRRC1;RPS6KA5;H2AFJ;PGM2;HOXA7;GPR155;HIBCH;TMED4;DNAJC19;AFAP1L1;FZD5;HSD3B2;SLC33A1;LIFR;PEX1;DHRS1;PAICS;SLC9A6;DOLPP1;ANKRD42;MTFR1;NUPL2;ASF1A'
        },
        {
          Term: 'TCF4 18268006 ChIP-ChIP LS174T Human',
          Overlap: '5/470',
          'P-value': '0.9421437624390963',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5673758865248227',
          'Combined Score': '0.03381412879198397',
          Genes: 'OXSM;COL4A4;ZFYVE20;GAL3ST2;MRPL35'
        },
        {
          Term: 'MYC 18940864 ChIP-ChIP HL60 Human',
          Overlap: '9/746',
          'P-value': '0.9426544245997996',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6434316353887399',
          'Combined Score': '0.03799819454283303',
          Genes: 'DNAJC19;TMEM86A;INTU;OXSM;GBE1;POLI;AQP11;VLDLR;ATPAF1'
        },
        {
          Term: 'PIAS1 25552417 ChIP-Seq VCAP Human',
          Overlap: '9/749',
          'P-value': '0.9442910319807327',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6408544726301736',
          'Combined Score': '0.036734331915944766',
          Genes: 'GYS2;LIPT1;KLF12;GBE1;LIFR;ACO1;MAT2B;NR3C1;MUT'
        },
        {
          Term: 'RCOR2 21632747 ChIP-Seq MESCs Mouse',
          Overlap: '4/401',
          'P-value': '0.9449223370544796',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5320033250207814',
          'Combined Score': '0.030139338521289152',
          Genes: 'KLF12;SMO;NSUN3;POLRMT'
        },
        {
          Term: 'FOXA1 25329375 ChIP-Seq VCAP Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'LIPT1;ABHD3;GBE1;IPP;NOL7;CREBL2;KALRN;WDR24;GPHN;DHTKD1;H2AFJ;AFMID;PGM2;CLCC1;TRAP1;AFAP1L1;MDH1;UBE2E1;LRRC40;VPS13B;TMEM80;PAICS;KLF1;SLC25A39;DMXL1;ANKRD42;AQP11;ZCCHC3;ASF1A'
        },
        {
          Term: 'TCF21 26020271 ChIP-Seq SMOOTH MUSCLE Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ZFP106;CNO;RFESD;ARHGAP18;SAT2;CREBL2;VWCE;ZBTB44;WDR89;YARS2;PSMC3IP;NAGLU;MGAT1;NDUFV1;CPT1A;CNTD1;KLHDC4;KLF12;RWDD3;ZFYVE20;PARP16;ATAD3A;MPP7;COL4A4;DMXL1;ACO1;TLCD1;NOTUM;FGFR4'
        },
        {
          Term: 'RAC3 21632823 ChIP-Seq H3396 Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ENY2;PTTG1IP;PHF7;NUDT6;MRPL35;RABEPK;NFS1;RPS6KA5;SPTLC1;EXOSC4;METTL7A;PRKACA;SEPHS2;SAC3D1;SCYL1;CEP68;SLC30A6;CPT1A;IAH1;ANXA13;TRPC2;ZFYVE20;POLRMT;GNMT;ANKRD42;YME1L1;FGFR4;SFXN5;FBXL6'
        },
        {
          Term: 'GATA3 21878914 ChIP-Seq MCF-7 Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ZFP106;ABHD3;IPP;NOL7;ORC5L;ARHGAP18;GYS2;PSMC3IP;RPS6KA5;SIPA1L1;H2AFJ;TASP1;CLCC1;TMED4;SCYL1;DNAJC19;AFAP1L1;ENTPD5;LIFR;NAP1L1;PEX1;PAICS;MCAT;SMO;DMXL1;AQP11;CHPT1;TLN1;NUPL2'
        },
        {
          Term: 'SMC3 22415368 ChIP-Seq MEFs Mouse',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ENY2;9030420J04RIK;RFESD;STXBP2;NOL7;NUDT6;PITPNC1;1110032A03RIK;PSMC3IP;SIPA1L1;NAGLU;AFMID;2810432D09RIK;RDH14;SIAE;NDUFV1;ZRSR1;CPT1A;KLHDC4;IAH1;ACBD4;FZD5;ASCC1;ZFYVE20;2210016F16RIK;DHRS1;SLC25A39;NOTUM;NAT9'
        },
        {
          Term: 'FOXA1 26743006 Chip-Seq LNCaP-abl Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'EI24;IPP;CISD1;ORC5L;VWCE;WDR89;TM7SF3;YARS2;LRRC1;ZC3H12C;ATXN2;SCP2;HYI;PGM2;CD55;HIBCH;RBM39;ARHGEF12;KMO;MCAT;MPP7;SLC25A16;DMXL1;ANKRD42;RQCD1;TFAM;FBXL3;SF1;ATPAF1'
        },
        {
          Term: 'MYCN 27167114 Chip-Seq NEUROBLASTOMA Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ABHD3;CISD1;ZDHHC5;PROZ;VWCE;TM7SF3;GPHN;NPY;HYI;AP4S1;CLCC1;CD55;FN3K;DNAJC19;CPT1A;KLF12;FZD5;ASCC1;OXSM;LRRC40;FAH;TMEM80;ATAD3A;COQ10A;DNAJC18;KLF1;LASS2;SLC25A39;YME1L1'
        },
        {
          Term: 'BCL6 27268052 Chip-Seq Bcells Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'NLRX1;TM2D2;ABHD3;CNO;RFESD;PROZ;CREBL2;TMEM186;MIPOL1;THTPA;NFS1;SPTLC1;EXOSC4;ABHD11;SCP2;H2AFJ;PGM2;HOXA7;SEPHS2;ZKSCAN1;GADD45GIP1;LYPLA1;IAH1;VPS13B;ABHD14A;AGBL3;DOLPP1;TSR2;ZCCHC3'
        },
        {
          Term: 'FOXA1 27270436 Chip-Seq PROSTATE Human',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'LIPT1;ABHD3;GBE1;IPP;NOL7;CREBL2;KALRN;WDR24;GPHN;DHTKD1;H2AFJ;AFMID;PGM2;CLCC1;TRAP1;AFAP1L1;MDH1;UBE2E1;LRRC40;VPS13B;TMEM80;PAICS;KLF1;SLC25A39;DMXL1;ANKRD42;AQP11;ZCCHC3;ASF1A'
        },
        {
          Term: 'RARB 27405468 Chip-Seq BRAIN Mouse',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'ZFP148;1110003E01RIK;PTTG1IP;VLDLR;NR3C1;NUDT6;KALRN;WDR24;RABEPK;GPHN;PITPNC1;NAGLU;DDT;POLI;GPR155;NEO1;LYPLA1;IAH1;ACBD4;MDH1;RHBDD3;AI316807;CABLES1;COQ10A;SBK1;DMXL1;TLN1;SFXN5;ATPAF1'
        },
        {
          Term: 'RUNX1 27457419 Chip-Seq LIVER Mouse',
          Overlap: '29/2000',
          'P-value': '0.9453454618457888',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7733333333333334',
          'Combined Score': '0.04346508415570804',
          Genes: 'LIPT1;OSGEPL1;DHTKD1;PCMTD2;FBXO3;TASP1;BPNT1;GAL3ST2;GPR155;CD55;PMS1;HIBCH;LYPLA1;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;D730039F16RIK;PRPF18;CACNB4;NME7;COL4A4;DOLPP1;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'RUNX 20019798 ChIP-Seq JUKART Human',
          Overlap: '7/616',
          'P-value': '0.9456661895946359',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6060606060606061',
          'Combined Score': '0.03385796201439679',
          Genes: 'KLF12;RPS6KA5;ARHGEF12;ZFYVE20;TM7SF3;NR3C1;SEPHS2'
        },
        {
          Term: 'Nerf2 26677805 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '18/1331',
          'P-value': '0.9462801834635932',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7212622088655146',
          'Combined Score': '0.039825630119324905',
          Genes: 'MOBKL2B;CRADD;FKBPL;GBE1;ADK;AI316807;PARP16;NAP1L1;NR3C1;GPHN;ZC3H12C;CAT;ATP6V1B2;SMYD4;CHPT1;SEPHS2;FBXO9;BC016495'
        },
        {
          Term: 'SMAD4 19686287 ChIP-ChIP HaCaT Human',
          Overlap: '4/405',
          'P-value': '0.9476620736028318',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5267489711934157',
          'Combined Score': '0.02831660390148457',
          Genes: 'MOBKL2B;MYO6;RAB11FIP2;CD55'
        },
        {
          Term: 'GATA1 21571218 ChIP-Seq MEGAKARYOCYTES Human',
          Overlap: '39/2601',
          'P-value': '0.9477626193796034',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7996924259900039',
          'Combined Score': '0.042904465947218834',
          Genes: 'UNC119B;LIPT1;OSGEPL1;FECH;ABHD3;CNO;STXBP2;ARHGAP18;VWCE;NR3C1;KALRN;PITPNC1;GYS2;ZC3H12C;SPTLC1;HYI;PGM2;METTL7A;GPR155;NDUFV1;RILP;CD55;SLC30A6;RBM39;ARHGEF12;CRADD;VPS13B;DHRS1;KLF1;CLDN10;PRPF18;PSMC6;NME7;DMXL1;CAT;C1D;CHPT1;PKIG;SFXN5'
        },
        {
          Term: 'KLF4 25985364 ChIP-Seq ATHEROSCLEROSIS LESION Mouse',
          Overlap: '16/1211',
          'P-value': '0.9485357858779881',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7046518029176989',
          'Combined Score': '0.037230814530139045',
          Genes: 'DNAJC19;UBE2E1;TIMM44;MAT2B;PSMC3IP;ATXN2;1700034H14RIK;DOLPP1;KDR;RAB1;RDH14;ARSG;CLCC1;AW209491;2310068J16RIK;SF1'
        },
        {
          Term: 'VDR 20736230 ChIP-Seq LYMPHOBLASTOID Human',
          Overlap: '5/483',
          'P-value': '0.9504147785437227',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5521048999309869',
          'Combined Score': '0.02807827780821568',
          Genes: 'GADD45GIP1;UBE2E1;KALRN;RILP;DHTKD1'
        },
        {
          Term: 'GATA3 20176728 ChIP-ChIP TSCs Mouse',
          Overlap: '10/834',
          'P-value': '0.953273468643884',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.639488409272582',
          'Combined Score': '0.03060173361268628',
          Genes: '4933403G14RIK;CNTD1;FECH;FBXO3;CREBL2;PRKACA;NXT2;PLEKHA7;TNFSF5IP1;LRRC1'
        },
        {
          Term: 'PPARD 21283829 ChIP-Seq MYOFIBROBLAST Human',
          Overlap: '53/3447',
          'P-value': '0.955779181122321',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8200367469296974',
          'Combined Score': '0.037088929258585736',
          Genes: 'MOBKL2B;GBE1;ORC5L;SAT2;NR3C1;MRPL35;ZC3H12C;MED14;SPTLC1;SCP2;H2AFJ;RIOK2;NEO1;NUDT12;KLF12;ZFYVE20;LRRC40;LIFR;WDR34;COQ10A;CLDN10;ALDH1A3;CACNB4;NSMCE4A;CAT;ASF1A;RBKS;LRRC56;ENY2;INTU;GLO1;STXBP2;CREBL2;MAT2B;ADH5;NPY;MYO6;RDH14;LRRC8A;BPNT1;GPR155;DNAJC19;RWDD3;CRADD;LRRC61;IFT122;PAICS;PLEKHA7;LYRM2;TCN2;ACO1;TRIM37;ZCCHC3'
        },
        {
          Term: 'NFE2 27457419 Chip-Seq LIVER Mouse',
          Overlap: '12/972',
          'P-value': '0.9557802457675464',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6584362139917695',
          'Combined Score': '0.02977926636939923',
          Genes: 'LIPT1;LYPLA1;OSGEPL1;FZD5;NME7;ADHFE1;COL4A4;RQCD1;GAL3ST2;CD55;PMS1;HIBCH'
        },
        {
          Term: 'RAD21 21589869 ChIP-Seq MESCs Mouse',
          Overlap: '29/2036',
          'P-value': '0.9566964689964155',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7596594629993452',
          'Combined Score': '0.0336294461428019',
          Genes: 'ZFP787;CNO;GLO1;HPN;CISD1;ADK;CREBL2;ZBTB44;YARS2;5730403B10RIK;THTPA;MED14;NAGLU;AFMID;2810432D09RIK;PMPCB;POLI;SIAE;NEO1;TMED4;ACBD4;LASS2;AGBL3;CAT;TLCD1;NOTUM;TLN1;NUPL2;NAT9'
        },
        {
          Term: 'POU5F1 16518401 ChIP-PET MESCs Mouse',
          Overlap: '21/1550',
          'P-value': '0.9578048701322023',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7225806451612903',
          'Combined Score': '0.031151323319542942',
          Genes: 'ZFP106;CPT1A;CRADD;FZD5;4732435N03RIK;BRI3;ASCC1;GLO1;IPP;ZFYVE20;SAT2;LIFR;SIPA1L1;EXOSC4;CDK5RAP1;ATP6V1B2;PGM2;2610019F03RIK;SFXN5;RBKS;FBXO9'
        },
        {
          Term: 'TCF3 18347094 ChIP-ChIP MESCs Mouse',
          Overlap: '32/2221',
          'P-value': '0.957901451321325',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7684226324478464',
          'Combined Score': '0.03305014595436358',
          Genes: 'MOBKL2B;TM2D2;D4BWG0951E;CREBL2;ZFAND1;ACAA1A;PITPNC1;THTPA;2700038C09RIK;ATXN2;SIPA1L1;ABHD11;NPY;SLC25A40;HOXA7;RAB11FIP2;SEPHS2;B3BP;KLF12;ACBD4;TGDS;ABHD14A;NAP1L1;KMO;2610528J11RIK;COQ10A;PLEKHA7;4933403G14RIK;SBK1;TMEM77;DMXL1;AQP11'
        },
        {
          Term: 'GF1B 26923725 Chip-Seq HPCs Mouse',
          Overlap: '23/1676',
          'P-value': '0.9584768150572658',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7319013524264122',
          'Combined Score': '0.031039867240009785',
          Genes: 'TRAP1;SLC30A6;KLF12;TMEM30A;9030420J04RIK;ADK;NOL7;PLEKHA7;GPHN;CDAN1;PRPF18;1700034H14RIK;DMXL1;KDR;ATP6V1B2;RQCD1;YME1L1;RIOK2;TLN1;ALDH8A1;2310068J16RIK;NEO1;CD55'
        },
        {
          Term: 'IRF1 21803131 ChIP-Seq MONOCYTES Human',
          Overlap: '3/345',
          'P-value': '0.9585424490620404',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.463768115942029',
          'Combined Score': '0.01963660545193057',
          Genes: 'UBOX5;MTMR14;FGFR4'
        },
        {
          Term: 'ESR2 21235772 ChIP-Seq MCF-7 Human',
          Overlap: '4/424',
          'P-value': '0.9590507455783943',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5031446540880503',
          'Combined Score': '0.02103712724592001',
          Genes: 'IFT122;CHPT1;CD55;PITPNC1'
        },
        {
          Term: 'WT1 25993318 ChIP-Seq PODOCYTE Human',
          Overlap: '53/3464',
          'P-value': '0.9596344047043075',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8160123171670516',
          'Combined Score': '0.033622070220201354',
          Genes: 'ADK;ZFAND1;NR3C1;RABEPK;GPHN;PITPNC1;LRRC1;FARS2;DHTKD1;ZC3H12C;SIPA1L1;SCP2;SLC25A40;FBXO8;NUDT12;KLF12;ARHGEF12;VPS13B;OVOL1;D130020L05RIK;ALDH1A3;CACNB4;SMO;C1D;ATP6V1B2;ZFP106;2700046G09RIK;BRI3;MAT2B;KALRN;4932438A13RIK;NPY;MYO6;MGAT1;AP4S1;CD55;FN3K;RBM39;FAHD1;CRADD;ASCC1;IFT122;CABLES1;PARP16;NAP1L1;2610528J11RIK;PLEKHA7;SLC25A39;DOLPP1;ACO1;PKIG;FGFR4;ZCCHC3'
        },
        {
          Term: 'RNF2 27304074 Chip-Seq NSC Mouse',
          Overlap: '13/1052',
          'P-value': '0.9611904187202314',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6590621039290241',
          'Combined Score': '0.02608748601874674',
          Genes: 'ZFP655;FAHD1;9030420J04RIK;UBE2E1;LIFR;MAT2B;MCAT;ASB9;TSR2;YME1L1;FBXO8;HOXA7;RAB11FIP2'
        },
        {
          Term: 'FOXM1 23109430 ChIP-Seq U2OS Human',
          Overlap: '2/267',
          'P-value': '0.9619147964229205',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.3995006242197254',
          'Combined Score': '0.015512370115698448',
          Genes: 'KLHDC4;MTMR14'
        },
        {
          Term: 'PBX1 22567123 ChIP-ChIP OVCAR3 Human',
          Overlap: '33/2299',
          'P-value': '0.9624758533176738',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7655502392344498',
          'Combined Score': '0.029279464571904664',
          Genes: 'ZFP106;MYNN;TM7SF3;ESM1;RPS6KA5;NAGLU;H2AFJ;ARSK;SMYD4;ARSG;MRPL9;PRKACA;FBXO8;RAB11FIP2;SEPHS2;DNAJC19;LYPLA1;CNTD1;FAHD1;ADHFE1;WDR42A;NSUN3;ABHD14A;OVOL1;FAH;CACNB4;TCN2;SLC9A6;RQCD1;MTFR1;TLN1;SFXN5;ATPAF1'
        },
        {
          Term: 'STAT3 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '28/1997',
          'P-value': '0.9625385405415462',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7477883491904523',
          'Combined Score': '0.028551435206722185',
          Genes: 'INTU;3110048L19RIK;IPP;ZFAND1;4932438A13RIK;PITPNC1;AKR7A5;ESM1;MED14;AFMID;HYI;POLI;2610019F03RIK;HIBCH;NUDT12;DNAJC19;KLF12;ARHGEF12;CRADD;OXSM;LIFR;PAICS;ELL3;SLC25A16;C1D;TFAM;NUPL2;SFXN5'
        },
        {
          Term: 'HOXB7 26014856 ChIP-Seq BT474 Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'CNO;ADK;ORC5L;VWCE;PSMC3IP;RPS6KA5;ABHD11;MYO6;CDK5RAP1;POLI;CD55;CEP68;KLHDC4;IAH1;APOOL;ANXA13;IFT122;VPS13B;TIMM44;WDR34;GSTZ1;CDAN1;SMO;TSR2;AQP11;CHPT1;PKIG;NUPL2'
        },
        {
          Term: 'SMAD1 18555785 Chip-Seq ESCs Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'LIPT1;OSGEPL1;ZDHHC5;CDK5RAP1;FBXO3;TASP1;BPNT1;GAL3ST2;GPR155;CD55;PMS1;LYPLA1;RWDD3;FZD5;ADHFE1;WDR34;KMO;ELL3;2610036D13RIK;UBOX5;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1'
        },
        {
          Term: 'STAT3 18555785 Chip-Seq ESCs Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'ZFP106;LIPT1;OSGEPL1;A930005H10RIK;TASP1;BPNT1;METTL8;GPR155;CD55;PMS1;HIBCH;LYPLA1;RWDD3;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;UBOX5;CDAN1;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'ESRRB 18555785 Chip-Seq ESCs Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'ZFP106;LIPT1;OSGEPL1;4932438A13RIK;CDK5RAP1;FBXO3;TASP1;BPNT1;GAL3ST2;CD55;PMS1;HIBCH;LYPLA1;FZD5;WDR34;KMO;2610036D13RIK;UBOX5;DEFB29;CDAN1;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'SOX2 21211035 ChIP-Seq LN229 Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'HPN;IPP;ADK;NOL7;PROZ;ZFAND1;MAT2B;KALRN;WDR24;RABEPK;ADH5;TMEM186;GPHN;LRRC1;DHTKD1;ESM1;EXOSC4;H2AFJ;MGAT1;FBXO9;ENTPD5;SMO;SLC9A6;PLSCR2;MTFR1;CHPT1;NUPL2;ZCCHC3'
        },
        {
          Term: 'OCT4 21477851 ChIP-Seq ESCs Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'LIPT1;OSGEPL1;ARHGAP18;PTTG1IP;MAT2B;PITPNC1;GAL3ST2;CD55;PMS1;HIBCH;CEP68;LYPLA1;CRADD;FZD5;MDH1;ASCC1;ADHFE1;NAP1L1;POLRMT;KMO;SLC25A16;NME7;COL4A4;RQCD1;TFAM;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'AR 21915096 ChIP-Seq LNCaP-1F5 Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'LIPT1;MOBKL2B;FECH;CNO;RFESD;ORC5L;KALRN;TMEM186;PITPNC1;GK5;ABHD11;NAGLU;MYO6;KDR;METTL7A;GPR155;CD55;TRAP1;CPT1A;CNTD1;LASS2;CLDN10;ALDH1A3;ASB9;CHPT1;ASF1A;SFXN5;ATPAF1'
        },
        {
          Term: 'SOX3 22085726 ChIP-Seq NPCs Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: '1810049H13RIK;MOBKL2B;9030420J04RIK;GLO1;ZBTB44;NUDT6;GPHN;PITPNC1;LRRC1;THTPA;DDT;HYI;PGM2;MGAT1;HOXA7;RAB11FIP2;GPR155;TMED4;FN3K;2510006D16RIK;TMEM30A;UBE2E1;LIFR;DEFB29;RPS6KB1;CHPT1;NOTUM;ALDH8A1'
        },
        {
          Term: 'RUNX1 22412390 ChIP-Seq EML Mouse',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: '1110003E01RIK;ORC5L;PTTG1IP;C330018D20RIK;RABEPK;5730403B10RIK;EXOSC4;NAGLU;POLI;ARSG;FBXO9;ZRSR1;TRAP1;RBM39;ENTPD5;PARP16;COQ10A;KLF1;LASS2;VAMP8;DALRD3;SLC25A39;PLSCR2;ANKRD42;NOTUM;TLN1;PKIG;SFXN5'
        },
        {
          Term: 'UBF1/2 26484160 Chip-Seq FIBROBLAST Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'INTU;GBE1;ADK;NOL7;NR3C1;MIPOL1;GK5;PGM2;RDH14;RIOK2;RAB11FIP2;NEO1;KLF12;RWDD3;ARHGEF12;CRADD;LRRC40;DHRS1;MUT;PLEKHA7;CLDN10;LYRM2;PRPF18;SMO;NME7;TOMM70A;C1D;NOTUM'
        },
        {
          Term: 'UBF1/2 26484160 Chip-Seq HMECs Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'UNC119B;OSGEPL1;STXBP2;IPP;ZDHHC5;MYNN;PTTG1IP;GPHN;GK5;ZC3H12C;ATXN2;HYI;METTL7A;CLCC1;CD55;SAC3D1;PAIP1;CEP68;CRADD;FZD5;SLC33A1;CABLES1;TMEM80;PLEKHA7;DALRD3;TCN2;TFAM;SF1'
        },
        {
          Term: 'GATA3 27048872 Chip-Seq THYMUS Human',
          Overlap: '28/2000',
          'P-value': '0.9632969429827276',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7466666666666667',
          'Combined Score': '0.027920526821775444',
          Genes: 'OSGEPL1;ABHD3;RFESD;STXBP2;MYNN;CREBL2;PTTG1IP;NR3C1;TMEM186;PITPNC1;NFS1;RDH14;MGAT1;ARSG;CLCC1;HOXA7;GAL3ST2;NDUFV1;TMED4;KLHDC4;ARHGEF12;TRPC2;OVOL1;DOLPP1;AQP11;MTFR1;PKIG;ZCCHC3'
        },
        {
          Term: 'STAT6 20620947 ChIP-Seq CD4 POS T Human',
          Overlap: '5/508',
          'P-value': '0.9633772824354956',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5249343832020997',
          'Combined Score': '0.01958538880790427',
          Genes: 'KLF12;ADHFE1;MGAT1;TLCD1;MAT2B'
        },
        {
          Term: 'ELK1 22589737 ChIP-Seq MCF10A Human',
          Overlap: '11/928',
          'P-value': '0.9639549997638762',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.632183908045977',
          'Combined Score': '0.02320789242784025',
          Genes: 'RNF167;KLHDC4;UBOX5;KLF12;PRPF18;OSGEPL1;PSMB1;UFC1;ANKRD42;FBXO3;LRRC1'
        },
        {
          Term: 'PRDM14 21183938 ChIP-Seq MESCs Mouse',
          Overlap: '27/1944',
          'P-value': '0.9645466777937316',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7407407407407407',
          'Combined Score': '0.026738557008237133',
          Genes: '2700046G09RIK;INTU;1110003E01RIK;YARS2;PITPNC1;MED14;RPS6KA5;ABHD11;KDR;PMPCB;RDH14;AP4S1;BPNT1;PMS1;CEP68;PARP16;LIFR;OVOL1;DNAJC18;4933403G14RIK;LYRM2;PRPF18;SBK1;LYRM5;RAB1;AQP11;FGFR4'
        },
        {
          Term: 'SPI1 23547873 ChIP-Seq NB4 Human',
          Overlap: '48/3198',
          'P-value': '0.9648561804843149',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8005003126954346',
          'Combined Score': '0.02863887891342813',
          Genes: 'OSGEPL1;NDUFB6;MTMR14;IPP;CISD1;ZDHHC5;MYNN;NOL7;ARHGAP18;PCSK7;WDR89;NR3C1;PSMC3IP;MED14;SPTLC1;EXOSC4;SCP2;RIOK2;MGAT1;ARSG;METTL7A;NDUFV1;CD55;CEP68;SLC30A6;KLF12;RWDD3;CRADD;TGDS;UBE2E1;IFT122;VPS13B;WDR34;COQ10A;VAMP8;SLC25A16;RNF167;LYRM2;SLC7A6OS;TMBIM4;CAT;C1D;UFC1;ANKRD42;TFAM;CHPT1;TLN1;SF1'
        },
        {
          Term: 'DMRT1 23473982 ChIP-Seq TESTES Mouse',
          Overlap: '29/2072',
          'P-value': '0.9659766096661521',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7464607464607464',
          'Combined Score': '0.025839230401744524',
          Genes: 'ZFP787;MOBKL2B;INTU;BRI3;NOL7;NR3C1;5730403B10RIK;PITPNC1;GK5;ATXN2;SIPA1L1;SPTLC1;ABHD11;MGAT1;PRKACA;RBM39;AFAP1L1;ARHGEF12;CRADD;NSUN3;2610528J11RIK;TMEM80;COQ10A;GSTZ1;ALDH1A3;UBOX5;SLC25A39;SMO;RPS6KB1'
        },
        {
          Term: 'RCOR3 21632747 ChIP-Seq MESCs Mouse',
          Overlap: '42/2851',
          'P-value': '0.9660090907389665',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7856892318484742',
          'Combined Score': '0.027170731816457305',
          Genes: 'UNC119B;ZFP787;INTU;D4BWG0951E;GLO1;1110003E01RIK;KALRN;GPHN;PITPNC1;THTPA;ESM1;ATXN2;NAGLU;1700034H14RIK;AFMID;TASP1;RIOK2;2610019F03RIK;RILP;ZRSR1;CPT1A;KLF12;RWDD3;ACBD4;FZD5;WDR20A;LRRC61;VPS13B;LIFR;NAP1L1;OVOL1;DNAJC18;LASS2;GSTZ1;PRPF18;SBK1;TLCD1;NOTUM;NUPL2;FGFR4;ZCCHC3;RBKS'
        },
        {
          Term: 'RBPJ 21746931 ChIP-Seq IB4-LCL Human',
          Overlap: '28/2013',
          'P-value': '0.9664325613260809',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7418446762709058',
          'Combined Score': '0.02532936580050633',
          Genes: 'RFESD;EI24;SAT2;CREBL2;KALRN;TMEM186;THTPA;PSMC3IP;NFS1;ABHD11;PSMB1;CLCC1;MRPL9;GPR155;TMED4;TMEM86A;IAH1;ZFYVE20;UBE2E1;VPS13B;POLRMT;UBOX5;SLC7A6OS;AGBL3;DOLPP1;TRIM37;TLN1;ZCCHC3'
        },
        {
          Term: 'TP63 19390658 ChIP-ChIP HaCaT Human',
          Overlap: '1/179',
          'P-value': '0.966738988103974',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.297951582867784',
          'Combined Score': '0.010078730486177063',
          Genes: 'PHF7'
        },
        {
          Term: 'EGR1 19032775 ChIP-ChIP M12 Human',
          Overlap: '2/276',
          'P-value': '0.9670375615076855',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.3864734299516908',
          'Combined Score': '0.012953793602083718',
          Genes: 'ADK;FAH'
        },
        {
          Term: 'SOX9 25088423 ChIP-ChIP EMBRYONIC GONADS Mouse',
          Overlap: '26/1903',
          'P-value': '0.9693012673790814',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7286740234717114',
          'Combined Score': '0.022719917577905317',
          Genes: 'HPN;PTTG1IP;VLDLR;WDR24;PSMC3IP;3110057O12RIK;KDR;POLI;MGAT1;AP4S1;2510006D16RIK;TOR1A;ACBD4;FZD5;ZFYVE20;LRRC40;TMEM80;PAICS;ELL3;SLC25A16;CLDN10;SLC25A39;PLSCR2;AGBL3;RQCD1;AQP11'
        },
        {
          Term: 'TFAP2A 17053090 ChIP-ChIP MCF-7 Human',
          Overlap: '26/1904',
          'P-value': '0.9695209138830236',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7282913165266107',
          'Combined Score': '0.02254297059999465',
          Genes: 'ZFP106;ABHD3;EI24;PTTG1IP;PCSK7;YARS2;ATXN2;NAGLU;DDT;SMYD4;SEPHS2;SCYL1;KLHDC4;TGDS;CABLES1;PARP16;DHRS1;PLEKHA7;KLF1;ALDH6A1;UBOX5;PSMC6;ASB9;SYBL1;TLCD1;PKIG'
        },
        {
          Term: 'RUNX1 21571218 ChIP-Seq MEGAKARYOCYTES Human',
          Overlap: '80/5071',
          'P-value': '0.9708267841854125',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.8413856570038782',
          'Combined Score': '0.024911086635888573',
          Genes: 'RFESD;MTMR14;USP34;ZDHHC5;ADK;TFB1M;PHF7;NR3C1;TMEM186;GPHN;PITPNC1;FARS2;DHTKD1;ZC3H12C;RPS6KA5;NAGLU;SLC25A40;POLI;PGM2;CLCC1;PRKACA;FBXO8;SEPHS2;CEP68;CPT1A;LYPLA1;KLF12;ARHGEF12;ENTPD5;ZFYVE20;UBE2E1;VPS13B;OVOL1;POLRMT;ATAD3A;MUT;COQ10A;TMBIM4;NME7;CAT;TLN1;ASF1A;UNC119B;ENY2;NLRX1;FECH;TM2D2;ABHD3;CNO;EI24;STXBP2;NOL7;ARHGAP18;PTTG1IP;WDR24;ATXN2;MGAT1;METTL8;CD55;PMS1;SAC3D1;ZKSCAN1;TRAP1;KLHDC4;TOR1A;ACBD4;CRADD;APOOL;FZD5;MDH1;TIMM44;FAH;PAICS;ELL3;MPP7;SLC7A6OS;LYRM5;DMXL1;PKIG;SFXN5'
        },
        {
          Term: 'GBX2 23144817 ChIP-Seq PC3 Human',
          Overlap: '2/286',
          'P-value': '0.971952741591502',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.372960372960373',
          'Combined Score': '0.010610012294827451',
          Genes: 'ADK;GPHN'
        },
        {
          Term: 'ARNT 22903824 ChIP-Seq MCF-7 Human',
          Overlap: '12/1029',
          'P-value': '0.9739338622275644',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6219630709426628',
          'Combined Score': '0.016427214555337286',
          Genes: 'ALDH1A3;KLHDC4;KLF12;GBE1;ADK;CABLES1;TRIM37;ARSG;NR3C1;PLEKHA7;ZKSCAN1;PITPNC1'
        },
        {
          Term: 'DNAJC2 21179169 ChIP-ChIP NT2 Human',
          Overlap: '10/899',
          'P-value': '0.9753904558350157',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5932517612161662',
          'Combined Score': '0.014782303671880501',
          Genes: 'PCMTD2;GK5;GADD45GIP1;SMO;POLI;VLDLR;VWCE;FGFR4;NDUFV1;PLEKHA7'
        },
        {
          Term: 'GF1 26923725 Chip-Seq HPCs Mouse',
          Overlap: '18/1432',
          'P-value': '0.9760327000628478',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.670391061452514',
          'Combined Score': '0.016263143441927988',
          Genes: 'TMEM30A;CRADD;FECH;NOL7;NUDT6;KALRN;PLEKHA7;DNAJC18;ZFP11;PRPF18;SLC7A6OS;SMO;1700034H14RIK;DMXL1;ATP6V1B2;2310068J16RIK;NEO1;CD55'
        },
        {
          Term: 'FOXO1 25302145 ChIP-Seq T-LYMPHOCYTE Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'ZFP148;NR3C1;4932438A13RIK;PITPNC1;SIPA1L1;EXOSC4;ABHD11;GYK;TASP1;MGAT1;BPNT1;METTL8;2610019F03RIK;CD55;RBM39;LYPLA1;CRADD;VPS13B;WDR34;PLEKHA7;GNMT;4933403G14RIK;PRPF18;NSMCE4A;SBK1;FBXL3;ASF1A'
        },
        {
          Term: 'GATA6 25053715 ChIP-Seq YYC3 Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'OSGEPL1;PTTG1IP;VWCE;GPHN;MYO6;SIAE;SEPHS2;CD55;ZKSCAN1;FBXO9;RBM39;LYPLA1;ARHGEF12;CRADD;FZD5;MDH1;NAP1L1;DHRS1;PLEKHA7;LASS2;NME7;CAT;UFC1;AQP11;CHPT1;TLCD1;SF1'
        },
        {
          Term: 'KLF5 20875108 ChIP-Seq MESCs Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'GBE1;CISD1;PROZ;WDR89;PHF7;NR3C1;GPHN;DHTKD1;ESM1;ATXN2;MYO6;FBXO3;ARSG;NEO1;KLHDC4;AFAP1L1;TGDS;COQ10A;CACNB4;TSR2;TFAM;AQP11;ACO1;TRIM37;CHPT1;ALDH8A1;ASF1A'
        },
        {
          Term: 'SOX2 18555785 Chip-Seq ESCs Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'CDK5RAP1;FBXO3;TASP1;PGM2;BPNT1;METTL8;GPR155;CD55;PMS1;HIBCH;LYPLA1;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;LYRM2;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'ZFX 18555785 Chip-Seq ESCs Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'ZFP106;OSGEPL1;CDK5RAP1;FBXO3;TASP1;BPNT1;GPR155;CD55;PMS1;HIBCH;DNAJC19;LYPLA1;FZD5;ADHFE1;WDR34;KMO;ELL3;2610036D13RIK;CDAN1;PRPF18;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'OCT4 20526341 ChIP-Seq ESCs Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'INTU;HPN;PTTG1IP;VWCE;WDR89;PITPNC1;MED14;NFS1;SIPA1L1;SCP2;NAGLU;PSMB1;TASP1;PRKACA;GPR155;FBXO9;OXSM;TRPC2;VPS13B;PEX1;FAH;SLC25A16;TMBIM4;RPS6KB1;AGBL3;GORASP1;DOLPP1'
        },
        {
          Term: 'CTCF 21964334 ChIP-Seq BJAB-B Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'NLRX1;RFESD;NR3C1;YARS2;PITPNC1;PSMC3IP;H2AFJ;RILP;CD55;RWDD3;AFAP1L1;ACBD4;ARHGEF12;UBE2E1;CABLES1;NAP1L1;DHRS1;ELL3;GNMT;LASS2;PRPF18;NSMCE4A;TCN2;AGBL3;TFAM;YME1L1;NOTUM'
        },
        {
          Term: 'SOX2 22085726 ChIP-Seq NPCs Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'ZFP748;GLO1;ORC5L;VWCE;YARS2;ADH5;SIP1;NAGLU;FBXO3;HYI;RDH14;IAH1;ENTPD5;NSUN3;2210016F16RIK;TMEM80;ELL3;2610036D13RIK;RNF167;CACNB4;SLC25A39;RPS6KB1;UFC1;YME1L1;AQP11;NOTUM;ASF1A'
        },
        {
          Term: 'P53 22387025 ChIP-Seq ESCs Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'ZFP106;LIPT1;OSGEPL1;4932438A13RIK;KDR;TASP1;BPNT1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH;DNAJC19;LYPLA1;RWDD3;FZD5;ADHFE1;KMO;CDAN1;PRPF18;CACNB4;NME7;COL4A4;UFC1;RQCD1;YME1L1'
        },
        {
          Term: 'EBF1 22473956 ChIP-Seq BONE MARROW Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'LIPT1;OSGEPL1;INTU;NDUFB6;A930005H10RIK;4932438A13RIK;SCRN3;TASP1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH;DNAJC19;LYPLA1;FZD5;ADHFE1;WDR34;KMO;CDAN1;PRPF18;CACNB4;NME7;COL4A4;RQCD1;YME1L1'
        },
        {
          Term: 'GATA3 24758297 ChIP-Seq MCF-7 Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'BRI3;RFESD;PTTG1IP;TMEM186;LRRC1;ABHD11;H2AFJ;MYO6;CD55;TMED4;TMEM86A;KLHDC4;TMEM30A;CRADD;MDH1;IFT122;DHRS1;KMO;MPP7;VAMP8;ALDH1A3;PSMC6;RPS6KB1;DMXL1;MTFR1;TRIM37;CHPT1'
        },
        {
          Term: 'P63 26484246 Chip-Seq KERATINOCYTES Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'NLRX1;GBE1;ZDHHC5;MAT2B;TFB1M;TM7SF3;ADH5;CDK5RAP1;RDH14;MGAT1;METTL7A;HOXA7;METTL8;SIAE;GAL3ST2;ARHGEF12;NAP1L1;OVOL1;TMEM80;ITFG1;MPP7;ALDH1A3;SMO;C1D;TFAM;ZCCHC3;RBKS'
        },
        {
          Term: 'BRD4 27068464 Chip-Seq AML-cells Mouse',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'OSGEPL1;FECH;BRI3;ZDHHC5;MAT2B;WDR89;C330018D20RIK;PITPNC1;EXOSC4;H2AFJ;HIBCH;ZRSR1;CPT1A;LYPLA1;ACBD4;MDH1;LRRC61;WDR34;COQ10A;SLC25A39;TCN2;AGBL3;RQCD1;NOTUM;ALDH8A1;ASF1A;FBXL6'
        },
        {
          Term: 'SMRT 27268052 Chip-Seq Bcells Human',
          Overlap: '27/2000',
          'P-value': '0.9762201392723477',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.72',
          'Combined Score': '0.0173283591377158',
          Genes: 'NOL7;PROZ;ARHGAP18;CREBL2;NR3C1;KALRN;MIPOL1;ATXN2;RPS6KA5;SIPA1L1;SPTLC1;ABHD11;H2AFJ;NPY;GPR155;NEO1;RILP;FBXO9;GADD45GIP1;TRAP1;LYPLA1;IAH1;UBE2E1;PARP16;DMXL1;TSR2;ZCCHC3'
        },
        {
          Term: 'ZFP281 18757296 ChIP-ChIP E14 Mouse',
          Overlap: '27/2004',
          'P-value': '0.9769068522846343',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.718562874251497',
          'Combined Score': '0.016788482897620804',
          Genes: '9630013D21RIK;STXBP2;ADH5;PITPNC1;PCMTD2;2700038C09RIK;ATXN2;AFMID;MGAT1;AP4S1;PRKACA;NEO1;WDR42A;TIMM44;FAH;2610528J11RIK;PAICS;GNMT;VAMP8;SBK1;SLC9A6;GORASP1;RAB1;AQP11;TLN1;ZCCHC3;SF1'
        },
        {
          Term: 'EZH2 27294783 Chip-Seq NPCs Mouse',
          Overlap: '17/1374',
          'P-value': '0.9773436247427949',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6598738476467735',
          'Combined Score': '0.01512231221074653',
          Genes: 'LIPT1;LYPLA1;OSGEPL1;CRADD;FZD5;ADHFE1;ARHGAP18;NME7;COL4A4;RQCD1;TFAM;GAL3ST2;ALDH8A1;ASF1A;CD55;PMS1;HIBCH'
        },
        {
          Term: 'POU5F1 16153702 ChIP-ChIP HESCs Human',
          Overlap: '6/622',
          'P-value': '0.9774208420454815',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5144694533762059',
          'Combined Score': '0.011749438151149226',
          Genes: 'CPT1A;TMEM30A;H2AFJ;KDR;CABLES1;HOXA7'
        },
        {
          Term: 'LMO2 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '4/473',
          'P-value': '0.9787094146235245',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4510218463706836',
          'Combined Score': '0.00970621522868286',
          Genes: 'TOR1A;TOMM70A;RQCD1;DHTKD1'
        },
        {
          Term: 'SOX9 24532713 ChIP-Seq HFSC Mouse',
          Overlap: '17/1384',
          'P-value': '0.9792212541238676',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6551059730250482',
          'Combined Score': '0.01375569370357689',
          Genes: 'KLHDC4;APOOL;FZD5;MDH1;OXSM;SLC33A1;ARHGAP18;VLDLR;MPP7;RPS6KA5;CACNB4;AFMID;RAB1;RAB11FIP2;SEPHS2;SFXN5;RBKS'
        },
        {
          Term: 'TP53 20018659 ChIP-ChIP R1E Mouse',
          Overlap: '13/1122',
          'P-value': '0.979630453744538',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6179441473559121',
          'Combined Score': '0.012717208025440083',
          Genes: 'FECH;CNO;EI24;SLC33A1;OVOL1;PITPNC1;GSTZ1;SBK1;H2AFJ;NPY;RAB1;FBXL3;SAC3D1'
        },
        {
          Term: 'PHC1 16625203 ChIP-ChIP MESCs Mouse',
          Overlap: '10/922',
          'P-value': '0.9805839494236224',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5784526391901663',
          'Combined Score': '0.011341731318482992',
          Genes: '9630013D21RIK;ENY2;SMO;NPY;CABLES1;OVOL1;4933407N01RIK;POLRMT;PAICS;GPHN'
        },
        {
          Term: 'MEIS1 26923725 Chip-Seq HEMOGENIC-ENDOTHELIUM Mouse',
          Overlap: '14/1196',
          'P-value': '0.980943118566473',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6243032329988851',
          'Combined Score': '0.012012096274130775',
          Genes: 'ZFP106;BRI3;ASCC1;GBE1;CREBL2;MAT2B;4932438A13RIK;4933403G14RIK;PRPF18;1700034H14RIK;RIOK2;AP4S1;ACO1;FBXO8'
        },
        {
          Term: 'SMAD3 21741376 ChIP-Seq HESCs Human',
          Overlap: '18/1460',
          'P-value': '0.9811101263592419',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6575342465753424',
          'Combined Score': '0.012539550530437113',
          Genes: 'TMEM86A;MDH1;CISD1;ARHGAP18;LIFR;VLDLR;MAT2B;NR3C1;KMO;PLEKHA7;ZC3H12C;SIPA1L1;C1D;ATP6V1B2;FBXL3;AP4S1;PMS1;ATPAF1'
        },
        {
          Term: 'E2F4 17652178 ChIP-ChIP JURKAT Human',
          Overlap: '11/1002',
          'P-value': '0.982615888221917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5854956753160346',
          'Combined Score': '0.010267831689379043',
          Genes: 'KLF12;MDH1;SLC9A6;ZDHHC5;ZFYVE20;UFC1;VPS13B;TIMM44;FBXO8;MUT;LRRC1'
        },
        {
          Term: 'SOX2 16153702 ChIP-ChIP HESCs Human',
          Overlap: '15/1278',
          'P-value': '0.983482246280203',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6259780907668232',
          'Combined Score': '0.010426098833595403',
          Genes: 'CPT1A;STXBP2;NSUN3;MYNN;CABLES1;MAT2B;TNFSF5IP1;UBOX5;ABHD11;NME7;H2AFJ;PSMB1;KDR;RQCD1;ZCCHC3'
        },
        {
          Term: 'NFIB 24661679 ChIP-Seq LUNG Mouse',
          Overlap: '5/573',
          'P-value': '0.9839227652326905',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4653868528214078',
          'Combined Score': '0.0075429322292578285',
          Genes: 'ATXN2;PRPF18;TGDS;DMXL1;ITFG1'
        },
        {
          Term: 'BCAT 22108803 ChIP-Seq LS180 Human',
          Overlap: '6/650',
          'P-value': '0.9839617091436476',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4923076923076924',
          'Combined Score': '0.007959776570552768',
          Genes: 'KLHDC4;GBE1;TRPC2;AQP11;WDR34;HIBCH'
        },
        {
          Term: 'RNF2 16625203 ChIP-ChIP MESCs Mouse',
          Overlap: '14/1219',
          'P-value': '0.9846649882536389',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6125239267158874',
          'Combined Score': '0.009465827838669035',
          Genes: '9630013D21RIK;CRADD;SLC33A1;NSUN3;MYNN;UBE2E1;OVOL1;PHF7;GPHN;SMO;NPY;A930041I02RIK;AQP11;4933407N01RIK'
        },
        {
          Term: 'FOXM1 26100407 CHIP-SEQ Hek293 flp-in Human',
          Overlap: '25/1934',
          'P-value': '0.9848069738667765',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6894174422612892',
          'Combined Score': '0.010554720876459466',
          Genes: 'HPN;ADK;CREBL2;NR3C1;PITPNC1;NAGLU;MYO6;BPNT1;SEPHS2;NEO1;ARHGEF12;CRADD;MDH1;TGDS;ASCC1;NSUN3;CABLES1;PARP16;ATAD3A;CDAN1;NSMCE4A;SMO;SLC9A6;TMBIM4;ATPAF1'
        },
        {
          Term: 'MYC 19915707 ChIP-ChIP AK7 Human',
          Overlap: '42/2979',
          'P-value': '0.9848789534704506',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7519301779120511',
          'Combined Score': '0.0114568106532824',
          Genes: '0610013E23RIK;2610528K11RIK;TM2D2;IPP;MYNN;ARHGAP18;PTTG1IP;C330018D20RIK;PITPNC1;3110001I20RIK;SIPA1L1;SPTLC1;DDT;AFMID;2810432D09RIK;FBXO3;TASP1;POLI;RIOK2;GAL3ST2;CD55;SAC3D1;HIBCH;BC016495;TRAP1;LYPLA1;KLHDC4;RHBDD3;SLC33A1;IFT122;POLRMT;ELL3;PLEKHA7;PRPF18;PSMC6;NME7;DOLPP1;UFC1;YME1L1;2310026E23RIK;ASF1A;SFXN5'
        },
        {
          Term: 'FOXA1 21572438 ChIP-Seq LNCaP Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'ZFP106;MOBKL2B;FECH;GBE1;IPP;CREBL2;MAT2B;WDR24;FARS2;MIPOL1;PSMC3IP;METTL7A;CLCC1;AFAP1L1;MDH1;HSD3B2;ENTPD5;VPS13B;TMEM80;PAICS;KLF1;AGBL3;TFAM;NUPL2;FGFR4;ASF1A'
        },
        {
          Term: 'P300 18555785 Chip-Seq ESCs Mouse',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'ZFP106;OSGEPL1;PCMTD2;FBXO3;TASP1;BPNT1;METTL8;GPR155;CD55;PMS1;HIBCH;LYPLA1;FZD5;KMO;ELL3;UBOX5;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;MTFR1'
        },
        {
          Term: 'P63 20808887 ChIP-Seq KERATINOCYTES Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'NLRX1;OSGEPL1;ABHD3;RFESD;IPP;ADK;SAT2;CREBL2;TFB1M;GPHN;ATXN2;HYI;CLCC1;RAB11FIP2;LYPLA1;CRADD;HSD3B2;ENTPD5;ANXA13;UBE2E1;FAH;MPP7;TCN2;RQCD1;NUPL2;ALDH8A1'
        },
        {
          Term: 'LDB1 21186366 ChIP-Seq BM-HSCs Mouse',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'ZFP106;9030420J04RIK;MYNN;PROZ;PTTG1IP;NXT2;5730403B10RIK;DHTKD1;3110057O12RIK;RPS6KA5;MRPL9;PRKACA;NDUFV1;ZKSCAN1;TRIM23;NUDT12;CNTD1;AFAP1L1;NAP1L1;ELL3;D730039F16RIK;SMO;DMXL1;UFC1;RAB1;FGFR4'
        },
        {
          Term: 'NCOR 22424771 ChIP-Seq 293T Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'GLO1;HPN;CISD1;YARS2;GPHN;LRRC1;GK5;ZC3H12C;NAGLU;RDH14;AP4S1;RAB11FIP2;NDUFV1;ZKSCAN1;TRIM23;CEP68;FN3K;RWDD3;ARHGEF12;CRADD;TGDS;FAH;ALDH1A3;UFC1;ALDH8A1;SFXN5'
        },
        {
          Term: 'SMRT 22465074 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'MOBKL2B;FECH;GBE1;MTMR14;1110003E01RIK;ARHGAP18;PITPNC1;PSMC3IP;ARSG;AW209491;RAB11FIP2;MDH1;RHBDD3;OXSM;NSUN3;VPS13B;VAMP8;PSMC6;TCN2;TMBIM4;LYRM5;DMXL1;CAT;CHPT1;TLN1;SF1'
        },
        {
          Term: 'GATA3 22897851 ChIP-Seq JUKARTE6-1 Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'NDUFB6;IPP;MYNN;NR3C1;THTPA;ATXN2;SIPA1L1;SMYD4;LRRC8A;CLCC1;RILP;TRIM23;SCYL1;TRAP1;KLF12;AFAP1L1;TMEM30A;LIFR;PEX1;KMO;LYRM2;CACNB4;TOMM70A;C1D;ANKRD42;ASF1A'
        },
        {
          Term: 'GATA3 26560356 Chip-Seq TH1 Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'COX15;HPN;PROZ;GYS2;MED14;RPS6KA5;RIOK2;MGAT1;MRPL9;METTL8;SEPHS2;RILP;ARHGEF12;TMEM30A;CRADD;MDH1;ENTPD5;VPS13B;WDR34;KMO;ATAD3A;RPS6KB1;DMXL1;FBXL3;ACO1;TRIM37'
        },
        {
          Term: 'CREB1 26743006 Chip-Seq LNCaP Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'UNC119B;IPP;PROZ;MAT2B;WDR24;THTPA;ATXN2;MYO6;CLCC1;MRPL9;PRKACA;CD55;SAC3D1;SCYL1;ARHGEF12;CABLES1;ATAD3A;KLF1;LASS2;SLC25A16;RPS6KB1;UFC1;FBXL3;NOTUM;ZCCHC3;SFXN5'
        },
        {
          Term: 'BCOR 27268052 Chip-Seq Bcells Human',
          Overlap: '26/2000',
          'P-value': '0.9851604858895917',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6933333333333334',
          'Combined Score': '0.010365833396203032',
          Genes: 'ZFP106;LRRC56;RFESD;EI24;PROZ;SAT2;CREBL2;NFS1;ABHD11;H2AFJ;SEPHS2;ZKSCAN1;PAIP1;GADD45GIP1;LYPLA1;IAH1;VPS13B;ABHD14A;WDR34;POLRMT;DNAJC18;DOLPP1;TSR2;TLN1;ZCCHC3;SF1'
        },
        {
          Term: 'ZFP57 27257070 Chip-Seq ESCs Mouse',
          Overlap: '12/1088',
          'P-value': '0.9853879375569546',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5882352941176471',
          'Combined Score': '0.008658747124257854',
          Genes: '4933403G14RIK;GK5;CDAN1;GBE1;MAT2B;AW209491;FBXO8;POLRMT;GPR155;CD55;4932438A13RIK;GPHN'
        },
        {
          Term: 'NANOG 16153702 ChIP-ChIP HESCs Human',
          Overlap: '21/1686',
          'P-value': '0.9856279736527698',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.66429418742586',
          'Combined Score': '0.009616524766635704',
          Genes: 'CPT1A;MOBKL2B;MDH1;STXBP2;NSUN3;CABLES1;SAT2;VLDLR;PEX1;MAT2B;ESM1;NFS1;ABHD11;NME7;H2AFJ;DMXL1;PSMB1;KDR;RQCD1;PKIG;ZCCHC3'
        },
        {
          Term: 'ZNF274 21170338 ChIP-Seq K562 Hela',
          Overlap: '2/327',
          'P-value': '0.9856718790050767',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.32619775739041795',
          'Combined Score': '0.004707607641749987',
          Genes: 'THTPA;SPTLC1'
        },
        {
          Term: 'EBNA2 21746931 ChIP-Seq IB4-LCL Human',
          Overlap: '18/1492',
          'P-value': '0.985713601760358',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6434316353887399',
          'Combined Score': '0.009258615325668906',
          Genes: 'IAH1;RFESD;UBE2E1;SAT2;KALRN;TMEM186;THTPA;UBOX5;NFS1;ABHD11;SLC7A6OS;H2AFJ;DOLPP1;MRPL9;GPR155;ZCCHC3;ZKSCAN1;TMED4'
        },
        {
          Term: 'LMO2 26923725 Chip-Seq HEMANGIOBLAST Mouse',
          Overlap: '23/1822',
          'P-value': '0.9865283864266539',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6732528357116723',
          'Combined Score': '0.009131448753862906',
          Genes: 'KLF12;TMEM30A;NOL7;SAT2;LIFR;MRPL35;PLEKHA7;LRRC1;ZFP11;LYRM2;SIPA1L1;PRPF18;SLC7A6OS;SMO;DMXL1;CAT;ATP6V1B2;PGM2;ALDH8A1;NEO1;CD55;RBKS;SCYL1'
        },
        {
          Term: 'MECOM 23826213 ChIP-Seq KASUMI Mouse',
          Overlap: '25/1951',
          'P-value': '0.9867258174494182',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.683410216982744',
          'Combined Score': '0.009132459942883009',
          Genes: 'ZFP148;NLRX1;1110003E01RIK;C330018D20RIK;RABEPK;RPS6KA5;SIPA1L1;EXOSC4;PSMB1;GYK;POLI;SEPHS2;RBM39;ACBD4;ENTPD5;VPS13B;PARP16;KLF1;VAMP8;PRPF18;TCN2;SLC9A6;2310009A05RIK;TLN1;PKIG'
        },
        {
          Term: 'TCF3 18692474 ChIP-Seq MEFs Mouse',
          Overlap: '7/745',
          'P-value': '0.9874019863604445',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5011185682326622',
          'Combined Score': '0.006353201980136522',
          Genes: 'ZFP148;ABHD11;FZD5;D4BWG0951E;TMEM77;UBE2E1;AQP11'
        },
        {
          Term: 'MYCN 19997598 ChIP-ChIP NEUROBLASTOMA Human',
          Overlap: '1/234',
          'P-value': '0.9883821415904253',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.22792022792022795',
          'Combined Score': '0.002663446844277143',
          Genes: 'GORASP1'
        },
        {
          Term: 'AR 25329375 ChIP-Seq VCAP Human',
          Overlap: '24/1906',
          'P-value': '0.9885830868052898',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.671563483735572',
          'Combined Score': '0.007711285781584576',
          Genes: 'KLF12;RWDD3;CRADD;GBE1;ZFYVE20;ADK;UBE2E1;ARHGAP18;LIFR;PTTG1IP;OVOL1;NR3C1;KALRN;PAICS;RABEPK;MIPOL1;ZC3H12C;LYRM2;NPY;TASP1;RDH14;SMYD4;ACO1;NEO1'
        },
        {
          Term: 'TCF3 18467660 ChIP-ChIP MESCs Mouse',
          Overlap: '16/1388',
          'P-value': '0.9889707533095645',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6147934678194044',
          'Combined Score': '0.006818379114804839',
          Genes: 'B3BP;1810049H13RIK;LYPLA1;FZD5;D4BWG0951E;YARS2;4933403G14RIK;ATXN2;SBK1;NAGLU;FBXL3;MRPL9;PRKACA;NEO1;SAC3D1;SF1'
        },
        {
          Term: 'PPAR 26484153 Chip-Seq NCI-H1993 Human',
          Overlap: '13/1185',
          'P-value': '0.9890063202357368',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5850914205344586',
          'Combined Score': '0.006467926369727438',
          Genes: 'ASCC1;STXBP2;ARHGAP18;CABLES1;PTTG1IP;WDR89;NR3C1;MPP7;PLEKHA7;CAT;TFAM;ACO1;NUDT12'
        },
        {
          Term: 'PRDM14 20953172 ChIP-Seq ESCs Human',
          Overlap: '21/1723',
          'P-value': '0.9895179245654622',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6500290191526408',
          'Combined Score': '0.006849615352871869',
          Genes: 'TRAP1;KLF12;INTU;ADK;PEX1;MUT;LRRC1;THTPA;ESM1;SIPA1L1;SPTLC1;PRPF18;NPY;C1D;KDR;TASP1;ACO1;LRRC8A;METTL7A;CLCC1;ALDH8A1'
        },
        {
          Term: 'CTBP2 25329375 ChIP-Seq LNCAP Human',
          Overlap: '11/1053',
          'P-value': '0.9897847475096218',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5571383349161128',
          'Combined Score': '0.005720577335760412',
          Genes: 'ATXN2;RWDD3;INTU;SMO;GBE1;LRRC40;CABLES1;ACO1;MTFR1;GPHN;NUDT12'
        },
        {
          Term: 'CBX2 27304074 Chip-Seq ESCs Mouse',
          Overlap: '8/840',
          'P-value': '0.9901443469394716',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.507936507936508',
          'Combined Score': '0.005030878218489151',
          Genes: 'ABHD3;GBE1;ASB9;TASP1;CABLES1;HOXA7;RAB11FIP2;KALRN'
        },
        {
          Term: 'PPARG 20176806 ChIP-Seq MACROPHAGES Mouse',
          Overlap: '16/1408',
          'P-value': '0.9908756292218776',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6060606060606061',
          'Combined Score': '0.00555530473249486',
          Genes: 'CPT1A;INTU;CRADD;FZD5;GLO1;IPP;ARHGAP18;WDR89;PHF7;5730403B10RIK;2610036D13RIK;NPY;MGAT1;AP4S1;METTL8;GPR155'
        },
        {
          Term: 'FOXO3 23340844 ChIP-Seq DLD1 Human',
          Overlap: '6/695',
          'P-value': '0.9908970964273307',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.460431654676259',
          'Combined Score': '0.004210457857570131',
          Genes: 'RPS6KA5;NSMCE4A;TFAM;TASP1;TRIM23;LRRC1'
        },
        {
          Term: 'JUND 26020271 ChIP-Seq SMOOTH MUSCLE Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'NLRX1;TPMT;GBE1;EI24;PTTG1IP;VWCE;TFB1M;NXT2;DHTKD1;ZC3H12C;LRRC8A;MRPL9;METTL8;ARHGEF12;CABLES1;PARP16;TIMM44;MPP7;NME7;DMXL1;RQCD1;AQP11;FBXL3;NUPL2;SFXN5'
        },
        {
          Term: 'NCOR1 26117541 ChIP-Seq K562 Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'USP34;ADK;ARHGAP18;PTTG1IP;PITPNC1;KDR;PGM2;LRRC8A;METTL7A;CD55;RBM39;CPT1A;IAH1;FAHD1;CRADD;ASCC1;SLC33A1;LRRC61;PARP16;KMO;KLF1;AGBL3;CHPT1;NOTUM;ASF1A'
        },
        {
          Term: 'OCT4 18555785 Chip-Seq ESCs Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'ZFP106;CDK5RAP1;FBXO3;TASP1;BPNT1;GAL3ST2;GPR155;CD55;PMS1;HIBCH;RBM39;LYPLA1;FZD5;ADHFE1;KMO;2610036D13RIK;CDAN1;PRPF18;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'NMYC 18555785 Chip-Seq ESCs Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'LIPT1;OSGEPL1;PCMTD2;CDK5RAP1;FBXO3;TASP1;BPNT1;CD55;PMS1;HIBCH;LYPLA1;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;CDAN1;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'SOX2 19829295 ChIP-Seq ESCs Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'EI24;PCSK7;MAT2B;WDR89;NUDT6;MED14;ARSK;POLI;RIOK2;SIAE;GPR155;CD55;LYPLA1;TMEM30A;VPS13B;PARP16;LIFR;PEX1;DNAJC18;NSMCE4A;SMO;SLC9A6;TMBIM4;FBXL3;TRIM37'
        },
        {
          Term: 'NANOG 19829295 ChIP-Seq ESCs Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'EI24;PCSK7;MAT2B;WDR89;NUDT6;MED14;ARSK;POLI;RIOK2;SIAE;GPR155;CD55;LYPLA1;TMEM30A;VPS13B;PARP16;LIFR;PEX1;DNAJC18;NSMCE4A;SMO;SLC9A6;TMBIM4;FBXL3;TRIM37'
        },
        {
          Term: 'TAF2 19829295 ChIP-Seq ESCs Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'PROZ;SAT2;VWCE;WDR89;NUDT6;WDR24;GPHN;GK5;ZC3H12C;MYO6;SLC25A40;METTL7A;CD55;GADD45GIP1;TRPC2;VPS13B;CLDN10;TMBIM4;AGBL3;GORASP1;RQCD1;MTFR1;PKIG;NAT9;ZCCHC3'
        },
        {
          Term: 'JARID1B-DAIN 22020125 ChIP-Seq ESCs Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'MTMR14;GLO1;EI24;PTTG1IP;VLDLR;ACAA1A;WDR89;MRPL35;RABEPK;PITPNC1;ZFP11;ABHD11;PSMB1;TASP1;AP4S1;MRPL9;FKBPL;NSUN3;IFT122;KLF1;VAMP8;AGBL3;DOLPP1;TLN1;ATPAF1'
        },
        {
          Term: 'SOX3 22085726 ChIP-Seq MUSCLE Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: '1810049H13RIK;ZFP787;NLRX1;3110048L19RIK;CISD1;PITPNC1;FARS2;GK5;ZC3H12C;KDR;PMPCB;PGM2;MGAT1;ARSG;CPT1A;IAH1;AFAP1L1;FZD5;ANXA13;WDR34;SLC25A16;LYRM2;PRPF18;1700001L05RIK;ASF1A'
        },
        {
          Term: 'CEBPB 22108803 ChIP-Seq LS180 Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'NDUFB6;ABHD3;GBE1;STXBP2;CREBL2;RPS6KA5;SCP2;NPY;CDK5RAP1;PGM2;CLCC1;HIBCH;CEP68;IAH1;MDH1;PARP16;WDR34;KLF1;NSMCE4A;AGBL3;COL4A4;TOMM70A;CAT;TRIM37;CHPT1'
        },
        {
          Term: 'UBF1/2 26484160 Chip-Seq HMEC-DERIVED Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'IPP;VWCE;MAT2B;ATXN2;H2AFJ;MGAT1;CLCC1;PRKACA;GAL3ST2;RILP;CPT1A;KLF12;UBE2E1;CABLES1;ABHD14A;TMEM80;PAICS;ATAD3A;PLEKHA7;KLF1;LASS2;SLC25A16;PRPF18;AQP11;SF1'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq JURKAT Human',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'COX15;ABHD3;VWCE;ZBTB44;WDR89;GPHN;DHTKD1;ATXN2;NAGLU;FBXO3;MGAT1;CLCC1;SEPHS2;CPT1A;KLF12;ARHGEF12;CRADD;ASCC1;ADHFE1;NAP1L1;LASS2;ALDH1A3;FBXL3;CHPT1;NOTUM'
        },
        {
          Term: 'LMO2 26923725 Chip-Seq HEMOGENIC-ENDOTHELIUM Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'NOL7;VLDLR;ZBTB44;KALRN;DHTKD1;PSMC3IP;ZC3H12C;ZFP11;SMYD4;NEO1;TRAP1;KLHDC4;TMEM30A;CRADD;ASCC1;CABLES1;LIFR;TIMM44;FAH;DNAJC18;PRPF18;SLC7A6OS;DMXL1;ATP6V1B2;RQCD1'
        },
        {
          Term: 'PU1 27457419 Chip-Seq LIVER Mouse',
          Overlap: '25/2000',
          'P-value': '0.9910960368814148',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6666666666666667',
          'Combined Score': '0.0059625601896982254',
          Genes: 'LIPT1;OSGEPL1;SCRN3;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH;LYPLA1;RWDD3;FZD5;ADHFE1;WDR34;KMO;2610036D13RIK;CDAN1;PRPF18;CACNB4;NME7;COL4A4;UFC1;RQCD1;YME1L1;PKIG'
        },
        {
          Term: 'MITF 21258399 ChIP-Seq MELANOMA Human',
          Overlap: '85/5578',
          'P-value': '0.9912557678839834',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.812716624835664',
          'Combined Score': '0.00713783594005754',
          Genes: 'MOBKL2B;OSGEPL1;GBE1;MTMR14;ADK;TFB1M;NUDT6;MRPL35;TMEM186;GPHN;PITPNC1;LRRC1;FARS2;PCMTD2;ZC3H12C;RPS6KA5;NAGLU;SLC25A40;CLCC1;SEPHS2;HIBCH;CEP68;CPT1A;KLF12;ANXA13;VPS13B;WDR34;TMEM80;ATAD3A;COQ10A;SLC25A16;TMBIM4;CAT;ANKRD42;ATP6V1B2;TLCD1;LIPT1;FECH;BRI3;CNO;EI24;PROZ;ARHGAP18;CREBL2;PTTG1IP;VWCE;ATXN2;NPY;MGAT1;LRRC8A;ARSG;ZKSCAN1;PAIP1;FN3K;TRAP1;RBM39;TMEM86A;KLHDC4;RWDD3;AFAP1L1;FAHD1;CRADD;ADHFE1;SLC33A1;CABLES1;PARP16;TIMM44;FAH;PAICS;PLEKHA7;LASS2;LYRM2;SLC7A6OS;SLC25A39;SBK1;TCN2;TOMM70A;ASB9;TRIM37;CHPT1;NOTUM;NUPL2;NAT9;FGFR4;ZCCHC3'
        },
        {
          Term: 'ETV2 25802403 ChIP-Seq MESCs Mouse',
          Overlap: '10/1000',
          'P-value': '0.9916184195346051',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '0.004489015159593308',
          Genes: 'RWDD3;IAH1;INTU;FECH;TFAM;AQP11;ACO1;PHF7;NUDT6;TRIM23'
        },
        {
          Term: 'GRHL2 25758223 ChIP-Seq PLACENTA Mouse',
          Overlap: '10/1000',
          'P-value': '0.9916184195346051',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '0.004489015159593308',
          Genes: 'SLC30A6;KLHDC4;AGBL3;ZFYVE20;ANKRD42;CABLES1;METTL8;ALDH8A1;PAICS;LRRC1'
        },
        {
          Term: 'AUTS2 25519132 ChIP-Seq 293T-REX Human',
          Overlap: '10/1000',
          'P-value': '0.9916184195346051',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '0.004489015159593308',
          Genes: 'RWDD3;ARHGEF12;FKBPL;MTMR14;TLCD1;VWCE;PHF7;TMEM186;GPHN;RBKS'
        },
        {
          Term: 'CTBP1 25329375 ChIP-Seq LNCAP Human',
          Overlap: '12/1145',
          'P-value': '0.9918799694664929',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5589519650655022',
          'Combined Score': '0.004557234607430681',
          Genes: 'RWDD3;ABHD3;ARSK;TRPC2;ZDHHC5;RIOK2;ACO1;WDR89;YARS2;NEO1;ITFG1;NUDT12'
        },
        {
          Term: 'ZIC3 20872845 ChIP-ChIP MESCs Mouse',
          Overlap: '2/365',
          'P-value': '0.9924027765270038',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.29223744292237447',
          'Combined Score': '0.002228669772623346',
          Genes: 'AQP11;LRRC1'
        },
        {
          Term: 'REST 21632747 ChIP-Seq MESCs Mouse',
          Overlap: '30/2339',
          'P-value': '0.9925356971591052',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6840530141085934',
          'Combined Score': '0.005125130504761494',
          Genes: 'ZFP787;CNO;1110003E01RIK;CISD1;MAT2B;GPHN;SIPA1L1;1700034H14RIK;PSMB1;RIOK2;NEO1;CEP68;RWDD3;ARHGEF12;1700123L14RIK;CRADD;UBE2E1;LRRC61;WDR34;DNAJC18;RNF167;CACNB4;SBK1;NME7;C1D;ANKRD42;ATP6V1B2;AQP11;FGFR4;SFXN5'
        },
        {
          Term: 'ELK4 26923725 Chip-Seq MESODERM Mouse',
          Overlap: '3/466',
          'P-value': '0.9931491402035563',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.34334763948497854',
          'Combined Score': '0.0023603209168131965',
          Genes: 'NFS1;DOLPP1;SMYD4'
        },
        {
          Term: 'CTNNB1 20615089 ChIP-ChIP FETAL BRAIN Human',
          Overlap: '5/637',
          'P-value': '0.9931553456823634',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4186289900575615',
          'Combined Score': '0.0028752219381717264',
          Genes: 'ALDH6A1;GORASP1;TLN1;WDR24;TMEM186'
        },
        {
          Term: 'ISL1 27105846 Chip-Seq CPCs Mouse',
          Overlap: '18/1576',
          'P-value': '0.9933745543316594',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6091370558375635',
          'Combined Score': '0.00404923331724588',
          Genes: '2700046G09RIK;1700123L14RIK;MTMR14;ARHGAP18;PLEKHA7;GSTZ1;SIPA1L1;SLC25A39;SBK1;SLC9A6;TOMM70A;AFMID;KDR;TSR2;TFAM;FBXO8;NEO1;CD55'
        },
        {
          Term: 'STAT3 23295773 ChIP-Seq U87 Human',
          Overlap: '43/3165',
          'P-value': '0.9936692382422894',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7245918904686677',
          'Combined Score': '0.0046018004997380796',
          Genes: 'GBE1;MTMR14;USP34;ADK;ARHGAP18;CREBL2;MAT2B;WDR89;NR3C1;GPHN;PITPNC1;LRRC1;MIPOL1;GYS2;RPS6KA5;PSMB1;POLI;ARSG;RAB11FIP2;NEO1;HIBCH;TMED4;NUDT12;RBM39;CPT1A;OXSM;UBE2E1;IFT122;VPS13B;PEX1;MCAT;ITFG1;PLEKHA7;PRPF18;CACNB4;SMO;TOMM70A;C1D;ACO1;TRIM37;TLN1;PKIG;ZCCHC3'
        },
        {
          Term: 'CUX1 19635798 ChIP-ChIP MULTIPLE HUMAN CANCER TYPES Human',
          Overlap: '41/3052',
          'P-value': '0.9940779069864829',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.7164700742682394',
          'Combined Score': '0.00425561597245211',
          Genes: 'ZFP106;LIPT1;OSGEPL1;FECH;BRI3;ZDHHC5;MYNN;ADK;ARHGAP18;NXT2;NUDT6;MIPOL1;SCP2;DDT;NPY;PSMB1;TXNDC4;PMPCB;MGAT1;MRPL9;PMS1;HIBCH;CRADD;MDH1;HSD3B2;SLC33A1;TIMM44;NAP1L1;KMO;PAICS;MUT;GNMT;SMO;SLC9A6;RPS6KB1;PLSCR2;TOMM70A;DOLPP1;TFAM;AQP11;SF1'
        },
        {
          Term: 'ZNF217 24962896 ChIP-Seq MCF-7 Human',
          Overlap: '17/1522',
          'P-value': '0.9941677252898997',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5957074025405169',
          'Combined Score': '0.0034845004063967077',
          Genes: 'CPT1A;KLHDC4;GBE1;ADK;VPS13B;WDR89;NR3C1;KALRN;MPP7;PLEKHA7;PITPNC1;MIPOL1;PRPF18;C1D;ARSG;CD55;NUDT12'
        },
        {
          Term: 'SPI1 23127762 ChIP-Seq K562 Human',
          Overlap: '15/1389',
          'P-value': '0.9943682756571085',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5759539236861051',
          'Combined Score': '0.0032527817389413813',
          Genes: 'SLC30A6;ARHGEF12;CRADD;USP34;ADK;UBE2E1;KALRN;ITFG1;PLEKHA7;FARS2;ARSG;PKIG;METTL8;SIAE;SFXN5'
        },
        {
          Term: 'ELK3 25401928 ChIP-Seq HUVEC Human',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'GADD45GIP1;CPT1A;LRRC56;ARHGEF12;BRI3;HPN;IPP;PTTG1IP;VWCE;MAT2B;TMEM80;YARS2;ATAD3A;PLEKHA7;PSMC6;NSMCE4A;NAGLU;UFC1;ANKRD42;LRRC8A;MRPL9;PRKACA;ZCCHC3;SCYL1'
        },
        {
          Term: 'NANOG 18555785 Chip-Seq ESCs Mouse',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'DNAJC19;LYPLA1;FZD5;NDUFB6;LRRC40;KMO;4932438A13RIK;CDAN1;PRPF18;CACNB4;NME7;COL4A4;UFC1;RQCD1;FBXO3;TASP1;ACO1;BPNT1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH'
        },
        {
          Term: 'KLF4 18555785 Chip-Seq ESCs Mouse',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'ZFP106;LIPT1;LYPLA1;FZD5;WDR34;KMO;2610036D13RIK;CDAN1;CACNB4;NME7;COL4A4;CAT;CDK5RAP1;UFC1;RQCD1;FBXO3;TASP1;BPNT1;PKIG;METTL8;GPR155;CD55;PMS1;HIBCH'
        },
        {
          Term: 'CMYC 18555785 Chip-Seq ESCs Mouse',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'ZFP106;LYPLA1;FZD5;ADHFE1;KMO;2610036D13RIK;LYRM2;CDAN1;PRPF18;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;FBXO3;TASP1;BPNT1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH'
        },
        {
          Term: 'SUZ12 18555785 Chip-Seq ESCs Mouse',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'ZFP106;DNAJC19;LIPT1;LYPLA1;FZD5;A930005H10RIK;KMO;2610036D13RIK;CDAN1;CACNB4;NME7;COL4A4;CAT;UFC1;RQCD1;FBXO3;YME1L1;TASP1;BPNT1;METTL8;GPR155;CD55;PMS1;HIBCH'
        },
        {
          Term: 'PHF8 20622854 ChIP-Seq HELA Human',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'CEP68;ZFP106;KLHDC4;IAH1;CNO;SAT2;CREBL2;WDR34;TMEM80;ATAD3A;ZC3H12C;ALDH6A1;NSMCE4A;SCP2;NAGLU;TLN1;RAB11FIP2;SEPHS2;ZCCHC3;RILP;SFXN5;SF1;PAIP1;SCYL1'
        },
        {
          Term: 'CDX2 21402776 ChIP-Seq INTESTINAL-VILLUS Mouse',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'ZRSR1;CEP68;LIPT1;LYPLA1;OSGEPL1;CRADD;FZD5;ADHFE1;ARHGAP18;KMO;SLC25A16;NME7;DDT;COL4A4;RQCD1;TFAM;BPNT1;CHPT1;GAL3ST2;ALDH8A1;ASF1A;CD55;PMS1;HIBCH'
        },
        {
          Term: 'SA1 27219007 Chip-Seq ERYTHROID Human',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'CPT1A;KLF12;RWDD3;ARHGEF12;FZD5;COX15;STXBP2;HPN;TRPC2;CABLES1;SAT2;VWCE;ATAD3A;GPHN;DHTKD1;KLF1;LASS2;NSMCE4A;DALRD3;H2AFJ;CDK5RAP1;AQP11;RILP;SAC3D1'
        },
        {
          Term: 'P300 27268052 Chip-Seq Bcells Human',
          Overlap: '24/2000',
          'P-value': '0.994872199592455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64',
          'Combined Score': '0.0032902353239374926',
          Genes: 'LYPLA1;IAH1;NDUFB6;ABHD3;EI24;PROZ;VPS13B;SAT2;CREBL2;VLDLR;MIPOL1;ATXN2;NFS1;SPTLC1;EXOSC4;ABHD11;SCP2;NPY;AFMID;YME1L1;FBXL3;TLN1;SFXN5;SF1'
        },
        {
          Term: 'YY1 22570637 ChIP-Seq MALME-3M Human',
          Overlap: '10/1049',
          'P-value': '0.9951844453228624',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5084207181442645',
          'Combined Score': '0.0024542417891646362',
          Genes: 'TRAP1;UBOX5;IAH1;TOR1A;ASB9;MGAT1;SAT2;SEPHS2;ZCCHC3;ZKSCAN1'
        },
        {
          Term: 'SOX11 23321250 ChIP-ChIP Z138-A519-JVM2 Human',
          Overlap: '11/1134',
          'P-value': '0.9957992754601321',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5173427395649618',
          'Combined Score': '0.0021777917023390685',
          Genes: 'CEP68;FN3K;CACNB4;BRI3;MYNN;VPS13B;SMYD4;HOXA7;TLN1;RILP;COQ10A'
        },
        {
          Term: 'TCF3 18692474 ChIP-Seq MESCs Mouse',
          Overlap: '14/1351',
          'P-value': '0.9959324160299946',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5526770293609672',
          'Combined Score': '0.00225264474826486',
          Genes: 'B3BP;ZFP148;FZD5;D4BWG0951E;UBE2E1;4933403G14RIK;RPS6KA5;ABHD11;TMEM77;DMXL1;TXNDC4;SLC25A40;AQP11;CLEC2H'
        },
        {
          Term: 'SCL 21571218 ChIP-Seq MEGAKARYOCYTES Human',
          Overlap: '20/1784',
          'P-value': '0.9967177942031603',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5979073243647235',
          'Combined Score': '0.001965682540891081',
          Genes: 'RWDD3;ARHGEF12;FECH;CNO;STXBP2;TRPC2;PTTG1IP;KALRN;MPP7;PITPNC1;THTPA;ZC3H12C;CLDN10;MED14;EXOSC4;ABHD11;NME7;PKIG;RILP;ATPAF1'
        },
        {
          Term: 'RNF2 18974828 ChIP-Seq MESCs Mouse',
          Overlap: '13/1302',
          'P-value': '0.9967806232470846',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5325140809011777',
          'Combined Score': '0.0017171289806890255',
          Genes: '4732435N03RIK;CABLES1;VLDLR;OVOL1;TMEM166;ALDH1A3;CACNB4;SMO;NPY;KDR;CLCC1;HOXA7;SCYL1'
        },
        {
          Term: 'EZH2 18974828 ChIP-Seq MESCs Mouse',
          Overlap: '13/1302',
          'P-value': '0.9967806232470846',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5325140809011777',
          'Combined Score': '0.0017171289806890255',
          Genes: '4732435N03RIK;CABLES1;VLDLR;OVOL1;TMEM166;ALDH1A3;CACNB4;SMO;NPY;KDR;CLCC1;HOXA7;SCYL1'
        },
        {
          Term: 'RCOR1 19997604 ChIP-ChIP NEURONS Mouse',
          Overlap: '29/2378',
          'P-value': '0.9968092170616004',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6504065040650407',
          'Combined Score': '0.0020786239615057725',
          Genes: 'LRRC19;BRI3;GBE1;PCSK7;TFB1M;GPHN;LRRC1;4932432K03RIK;AKR7A5;PMPCB;LRRC8A;CLCC1;FBXO8;NEO1;TRIM23;CCDC16;KLF12;TMEM30A;CABLES1;LIFR;MUT;SLC25A16;TMEM77;NME7;AGBL3;4930432O21RIK;AQP11;PKIG;A230062G08RIK'
        },
        {
          Term: 'E2F1 17053090 ChIP-ChIP MCF-7 Human',
          Overlap: '19/1726',
          'P-value': '0.9970086998074251',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5870992661259173',
          'Combined Score': '0.0017588220436240774',
          Genes: 'CRADD;CABLES1;DHRS1;FAH;TM7SF3;NXT2;ELL3;ZC3H12C;ALDH6A1;PSMC6;NAGLU;SLC9A6;DDT;POLI;SYBL1;TRIM37;TLCD1;NAT9;SEPHS2'
        },
        {
          Term: 'BCL6 25482012 ChIP-Seq CML-JURL-MK1 Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'CPT1A;IAH1;NDUFB6;MTMR14;ANXA13;ZFYVE20;CREBL2;PHF7;WDR34;PLEKHA7;LRRC1;DNAJC18;PRPF18;KDR;FBXO3;HYI;PGM2;NUPL2;GPR155;ZCCHC3;RILP;SFXN5;TRIM23'
        },
        {
          Term: 'FOXA1 25552417 ChIP-Seq VCAP Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'CEP68;DNAJC19;LIPT1;ARHGEF12;RFESD;MTMR14;HPN;PARP16;PTTG1IP;MCAT;MRPL35;RPS6KA5;CDAN1;EXOSC4;AFMID;FBXL3;MGAT1;BPNT1;TLCD1;NEO1;CD55;ZKSCAN1;HIBCH'
        },
        {
          Term: 'MEIS1 26253404 ChIP-Seq OPTIC CUPS Mouse',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'TMEM86A;TMEM30A;ZFP748;FZD5;NDUFB6;GLO1;IPP;MYNN;LIFR;TIMM44;ZBTB44;NR3C1;ITFG1;LRRC1;PCMTD2;ALDH1A3;CACNB4;MYO6;C1D;KDR;GPR155;ASF1A;HIBCH'
        },
        {
          Term: 'STAT1 17558387 ChIP-Seq HELA Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'LIPT1;ZFP787;CPT1A;KLHDC4;KLF12;ZFP775;2700046G09RIK;INTU;GBE1;ORC5L;VWCE;TFB1M;PHF7;SLC25A16;ESM1;TCN2;SCRN3;C1D;UFC1;RAB1;RIOK2;HIBCH;NUDT12'
        },
        {
          Term: 'TCFCP2L1 18555785 Chip-Seq ESCs Mouse',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'RWDD3;FZD5;A930005H10RIK;LRRC40;KMO;4932438A13RIK;LYRM2;CDAN1;PRPF18;CACNB4;NME7;COL4A4;UFC1;RQCD1;YME1L1;TASP1;BPNT1;METTL8;GAL3ST2;GPR155;CD55;PMS1;HIBCH'
        },
        {
          Term: 'MYC 19829295 ChIP-Seq ESCs Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'DNAJC19;SLC30A6;MOBKL2B;NLRX1;ADHFE1;HPN;TRPC2;VPS13B;ABHD14A;NAP1L1;MCAT;WDR24;LRRC1;GYS2;CDAN1;EXOSC4;DDT;AFMID;RQCD1;CLCC1;PRKACA;ZCCHC3;RILP'
        },
        {
          Term: 'P300 19829295 ChIP-Seq ESCs Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'RWDD3;TMEM30A;INTU;CRADD;FZD5;FECH;GBE1;ADK;ARHGAP18;CABLES1;MUT;PLEKHA7;FARS2;MIPOL1;ZC3H12C;MED14;LYRM2;NPY;DMXL1;C1D;POLI;RIOK2;NUDT12'
        },
        {
          Term: 'CTCF 20526341 ChIP-Seq ESCs Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'GADD45GIP1;CPT1A;TMEM86A;ACBD4;NDUFB6;HSD3B2;EI24;IFT122;CABLES1;SAT2;ABHD14A;VWCE;FAH;KMO;COQ10A;MPP7;GPHN;LYRM2;NSMCE4A;TFAM;SMYD4;PKIG;NUDT12'
        },
        {
          Term: 'ERA 21632823 ChIP-Seq H3396 Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'ZFP106;DNAJC19;CPT1A;LYPLA1;LRRC56;FAHD1;STXBP2;ANXA13;ORC5L;VPS13B;ZFAND1;WDR24;DHTKD1;KLF1;ATXN2;SLC9A6;DMXL1;C1D;TRIM37;ARSG;NAT9;ZCCHC3;PAIP1'
        },
        {
          Term: 'FOXA1 21915096 ChIP-Seq LNCaP-1F5 Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'LIPT1;ENY2;RFESD;MTMR14;GLO1;LIFR;OVOL1;FAH;ADH5;ZC3H12C;CLDN10;MED14;RPS6KA5;H2AFJ;MYO6;KDR;POLI;MTFR1;RAB11FIP2;NEO1;RILP;CD55;ZKSCAN1'
        },
        {
          Term: 'MAF 26560356 Chip-Seq TH1 Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'GADD45GIP1;KLF12;ARHGEF12;EI24;USP34;VWCE;FAH;NXT2;TMEM80;ATAD3A;PITPNC1;KLF1;LASS2;GSTZ1;RNF167;NFS1;RPS6KA5;TCN2;CAT;UFC1;TLCD1;CLCC1;ZCCHC3'
        },
        {
          Term: 'KLF4 26769127 Chip-Seq PDAC-Cell line Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'CPT1A;RWDD3;ARHGEF12;IPP;CISD1;WDR89;ATAD3A;PLEKHA7;LASS2;VAMP8;ATXN2;NSMCE4A;NAGLU;ANKRD42;HYI;TRIM37;CHPT1;CLCC1;RAB11FIP2;GAL3ST2;CD55;SAC3D1;SF1'
        },
        {
          Term: 'CJUN 26792858 Chip-Seq BT549 Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'MOBKL2B;ARHGEF12;CRADD;ASCC1;ADK;ARHGAP18;PTTG1IP;TFB1M;FAH;NR3C1;ADH5;PLEKHA7;PRPF18;NAGLU;NME7;PLSCR2;ASB9;TFAM;TASP1;PKIG;ALDH8A1;SFXN5;CD55'
        },
        {
          Term: 'CEBPB 26923725 Chip-Seq HEMOGENIC-ENDOTHELIUM Mouse',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'ZFP775;IAH1;2700046G09RIK;FECH;GBE1;ANXA13;ADK;PROZ;LIFR;CREBL2;MAT2B;NR3C1;PAICS;GPHN;THTPA;4933403G14RIK;AGBL3;DMXL1;KDR;CLCC1;PKIG;ALDH8A1;SF1'
        },
        {
          Term: 'CEBPB 26923725 Chip-Seq MACROPHAGESS Mouse',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'ZRSR1;TRAP1;CPT1A;INTU;ABHD3;1110003E01RIK;NOL7;PROZ;MCAT;MPP7;GNMT;KLF1;THTPA;ZC3H12C;DEFB29;EXOSC4;DMXL1;AFMID;C1D;ATP6V1B2;FBXO3;NOTUM;SF1'
        },
        {
          Term: 'P300 27058665 Chip-Seq ZR-75-30cells Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'CPT1A;KLF12;RWDD3;EI24;IPP;CISD1;ZBTB44;TMEM80;YARS2;ATAD3A;DHTKD1;LASS2;SLC25A16;GSTZ1;ATXN2;H2AFJ;UFC1;HYI;BPNT1;CLCC1;CD55;SAC3D1;SF1'
        },
        {
          Term: 'OCT1 27270436 Chip-Seq PROSTATE Human',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'CNO;EI24;VPS13B;LIFR;OVOL1;LRRC1;THTPA;PSMC3IP;ATXN2;RPS6KA5;PRPF18;DOLPP1;ASB9;ANKRD42;HYI;MGAT1;METTL7A;ZCCHC3;RILP;ASF1A;FBXO9;SF1;NUDT12'
        },
        {
          Term: 'PBX 27287812 Chip-Seq EMBYONIC-LIMB Mouse',
          Overlap: '23/2000',
          'P-value': '0.9971706308179061',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133333333333334',
          'Combined Score': '0.0017378060400635767',
          Genes: 'KLHDC4;APOOL;FKBPL;FECH;GLO1;1110003E01RIK;PROZ;SAT2;LIFR;2610528J11RIK;KALRN;WDR24;PLEKHA7;VAMP8;ATXN2;RPS6KA5;H2AFJ;DOLPP1;CDK5RAP1;ACO1;PRKACA;FBXO8;SEPHS2'
        },
        {
          Term: 'SPI1 20517297 ChIP-Seq HL60 Human',
          Overlap: '12/1249',
          'P-value': '0.9973951991529051',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5124099279423538',
          'Combined Score': '0.0013364671864389836',
          Genes: 'ENY2;SMO;GORASP1;DOLPP1;TRPC2;ZFYVE20;PGM2;VWCE;FBXO8;HOXA7;NUPL2;POLRMT'
        },
        {
          Term: 'GATA2 19941826 ChIP-Seq K562 Human',
          Overlap: '29/2410',
          'P-value': '0.9975834608541042',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6417704011065007',
          'Combined Score': '0.001552740182205432',
          Genes: 'INTU;FECH;CNO;EI24;MYNN;PTTG1IP;PCSK7;VWCE;MRPL35;PITPNC1;FARS2;CDK5RAP1;SIAE;RILP;TRAP1;ARHGEF12;FAHD1;MDH1;FKBPL;UBE2E1;IFT122;PLEKHA7;KLF1;LASS2;NME7;CAT;C1D;CHPT1;TLN1'
        },
        {
          Term: 'ERG 21242973 ChIP-ChIP JURKAT Human',
          Overlap: '1/321',
          'P-value': '0.9978109168449978',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.16614745586708204',
          'Combined Score': '3.6410927518847335E-4',
          Genes: 'ELL3'
        },
        {
          Term: 'GATA1 19941826 ChIP-Seq K562 Human',
          Overlap: '8/967',
          'P-value': '0.9979250210833968',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.44122716304722515',
          'Combined Score': '9.164882368128185E-4',
          Genes: 'FKBPL;CNO;CHPT1;PTTG1IP;PCSK7;VWCE;PLEKHA7;KLF1'
        },
        {
          Term: 'SRY 25088423 ChIP-ChIP EMBRYONIC GONADS Mouse',
          Overlap: '39/3083',
          'P-value': '0.998229141993038',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6746675316250406',
          'Combined Score': '0.0011957995087559792',
          Genes: 'UNC119B;NDUFB6;TFB1M;NR3C1;WDR24;RABEPK;ADH5;GPHN;LRRC1;PCMTD2;3110057O12RIK;SIP1;ZFP11;MED14;KDR;GYK;POLI;LRRC8A;PRKACA;METTL8;2610019F03RIK;RILP;FN3K;TOR1A;FZD5;ASCC1;ADHFE1;NSUN3;TRPC2;PAICS;MCAT;ELL3;CLDN10;LYRM2;PSMC6;COL4A4;AQP11;FGFR4;RBKS'
        },
        {
          Term: 'NANOG 16518401 ChIP-PET MESCs Mouse',
          Overlap: '46/3520',
          'P-value': '0.99825697245271',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6969696969696969',
          'Combined Score': '0.0012158973608498626',
          Genes: 'ZFP148;MOBKL2B;2700046G09RIK;4732435N03RIK;GLO1;ADK;ORC5L;PTTG1IP;ZFAND1;5730403B10RIK;LRRC1;4932432K03RIK;RPS6KA5;SIPA1L1;SCRN3;MYO6;TXNDC4;GYK;FBXO3;POLI;MRPL9;2610019F03RIK;PMS1;TRAP1;ZFP655;LYPLA1;ACBD4;CRADD;FZD5;ASCC1;4632404H12RIK;OVOL1;2610528J11RIK;PLEKHA7;2410012H22RIK;GNMT;D730039F16RIK;LASS2;4933403G14RIK;PRPF18;TCN2;C1D;RAB1;FBXL3;ACO1;NUPL2'
        },
        {
          Term: 'VDR 24763502 ChIP-Seq THP-1 Human',
          Overlap: '12/1288',
          'P-value': '0.9983325124382346',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.49689440993788825',
          'Combined Score': '8.292568281124782E-4',
          Genes: 'DALRD3;CRADD;DOLPP1;LRRC61;HYI;CABLES1;MGAT1;LRRC8A;TLCD1;WDR89;PRKACA;ASF1A'
        },
        {
          Term: 'JUN 26020271 ChIP-Seq SMOOTH MUSCLE Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'NLRX1;GBE1;EI24;CABLES1;PARP16;VWCE;TFB1M;NXT2;MPP7;ZC3H12C;ATXN2;PLSCR2;H2AFJ;RQCD1;AQP11;FBXL3;ACO1;LRRC8A;MRPL9;METTL8;NUPL2;SFXN5'
        },
        {
          Term: 'MNX1 26342078 ChIP-Seq MIN6-4N Mouse',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'LIPT1;1810049H13RIK;LYPLA1;3110048L19RIK;RFESD;ZDHHC5;ARHGAP18;NAP1L1;PTTG1IP;PEX1;OVOL1;TFB1M;TOMM70A;TRIM37;CHPT1;ARSG;GAL3ST2;2610019F03RIK;NDUFV1;ASF1A;HIBCH;PAIP1'
        },
        {
          Term: 'NANOG 20526341 ChIP-Seq ESCs Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'GADD45GIP1;IAH1;RFESD;EI24;SAT2;PTTG1IP;PCSK7;MAT2B;FAH;KLF1;MED14;NFS1;NAGLU;SMO;RPS6KB1;AGBL3;FBXO3;RDH14;PRKACA;HOXA7;SEPHS2;RBKS'
        },
        {
          Term: 'SMC4 20622854 ChIP-Seq HELA Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'ZFP106;CPT1A;AFAP1L1;TOR1A;CNO;MTMR14;LIFR;CREBL2;ABHD14A;VWCE;PHF7;WDR24;RABEPK;TMEM186;SRR;NAGLU;GORASP1;CLCC1;NEO1;RILP;SF1;PAIP1'
        },
        {
          Term: 'FOXH1 21741376 ChIP-Seq EPCs Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'DNAJC19;TMEM86A;AFAP1L1;FAHD1;ABHD3;EI24;ARHGAP18;VPS13B;OVOL1;WDR34;KMO;KALRN;LYRM2;SIPA1L1;SCP2;SLC9A6;TMBIM4;FGFR4;SEPHS2;GPR155;NDUFV1;ASF1A'
        },
        {
          Term: 'GATA3 21867929 ChIP-Seq TH1 Mouse',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: '2510006D16RIK;LYPLA1;1700123L14RIK;APOOL;ABHD3;RFESD;ANXA13;ORC5L;ZBTB44;ELL3;COQ10A;ITFG1;SLC25A16;CACNB4;GORASP1;TOMM70A;SLC25A40;POLI;CLCC1;RAB11FIP2;ASF1A;SFXN5'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq DND41 Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'CPT1A;KLF12;RWDD3;ADHFE1;PARP16;PTTG1IP;VWCE;MPP7;PLEKHA7;GPHN;LASS2;ATXN2;NSMCE4A;SBK1;TCN2;CAT;TFAM;HYI;MGAT1;TLCD1;PRKACA;CD55'
        },
        {
          Term: 'MYC 27129775 Chip-Seq CORNEA Mouse',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'ZFP655;FECH;D4BWG0951E;ENTPD5;ORC5L;VWCE;MAT2B;TFB1M;WDR34;NR3C1;COQ10A;PITPNC1;AKR7A5;LYRM2;SLC25A39;NAGLU;SMO;9230114K14RIK;PMPCB;CHPT1;1700001L05RIK;FBXL6'
        },
        {
          Term: 'ATF3 27146783 Chip-Seq COLON Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'NLRX1;OSGEPL1;RFESD;OXSM;ANXA13;MYNN;TIMM44;PLEKHA7;PITPNC1;LASS2;SLC25A16;RPS6KA5;ABHD11;SLC25A39;TCN2;ANKRD42;FBXL3;NOTUM;HOXA7;NUPL2;RILP;ASF1A'
        },
        {
          Term: 'SA1 27219007 Chip-Seq Bcells Human',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'RWDD3;ACBD4;CNO;ENTPD5;IPP;LRRC40;FAH;POLRMT;TMEM80;ATAD3A;GPHN;DHTKD1;ALDH1A3;CDAN1;PRPF18;NSMCE4A;NAGLU;HYI;AQP11;PRKACA;GAL3ST2;SAC3D1'
        },
        {
          Term: 'ZFP281 27345836 Chip-Seq ESCs Mouse',
          Overlap: '22/2000',
          'P-value': '0.9985067722332589',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5866666666666667',
          'Combined Score': '8.76681662207038E-4',
          Genes: 'UNC119B;TRAP1;FZD5;BRI3;HPN;ANXA13;CISD1;TIMM44;MAT2B;NR3C1;PITPNC1;SRR;SPTLC1;NSMCE4A;SLC9A6;RAB1;AP4S1;ARSG;TLCD1;1700001L05RIK;CD55;PAIP1'
        },
        {
          Term: 'SOX2 21211035 ChIP-Seq LN229 Gbm',
          Overlap: '44/3420',
          'P-value': '0.9985551110903527',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.686159844054581',
          'Combined Score': '9.921416889143563E-4',
          Genes: 'ENY2;INTU;TPMT;GBE1;HPN;ADK;MAT2B;NR3C1;KALRN;GYS2;RPS6KA5;AFMID;SLC25A40;TASP1;RIOK2;MGAT1;FBXO8;GAL3ST2;NEO1;PMS1;TRIM23;NUDT12;SCYL1;KLF12;RWDD3;ACBD4;ARHGEF12;TMEM30A;HSD3B2;NSUN3;LRRC40;VPS13B;LRRC44;MUT;CACNB4;SMO;NME7;PLSCR2;C1D;ASB9;FBXL3;ACO1;PKIG;SFXN5'
        },
        {
          Term: 'STAT4 19710469 ChIP-ChIP TH1  Mouse',
          Overlap: '21/1939',
          'P-value': '0.9986040047582045',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5776173285198556',
          'Combined Score': '8.069143976567831E-4',
          Genes: '4732466D17RIK;ENY2;TOR1A;ACBD4;TMEM30A;2410018G20RIK;ANXA13;KMO;FARS2;3110057O12RIK;ESM1;PRPF18;ABHD11;C1D;UFC1;POLI;RIOK2;MGAT1;SEPHS2;NDUFV1;RBKS'
        },
        {
          Term: 'EWS-FLI1 20517297 ChIP-Seq SK-N-MC Human',
          Overlap: '3/574',
          'P-value': '0.9987611813723167',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.2787456445993032',
          'Combined Score': '3.455293652391332E-4',
          Genes: 'ANXA13;VPS13B;MIPOL1'
        },
        {
          Term: 'SMAD3 21741376 ChIP-Seq EPCs Human',
          Overlap: '16/1613',
          'P-value': '0.9988839094528656',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5290349245711924',
          'Combined Score': '5.907806221118635E-4',
          Genes: 'RBM39;RWDD3;ARHGAP18;CABLES1;LIFR;CREBL2;VLDLR;ZBTB44;NR3C1;KALRN;PLEKHA7;ESM1;LYRM2;SMO;C1D;NEO1'
        },
        {
          Term: 'EZH2 23942234 ChIP-Seq MYOBLASTS AND MYOTUBES Mouse',
          Overlap: '7/935',
          'P-value': '0.9988959919991792',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.39928698752228164',
          'Combined Score': '4.4105954030182145E-4',
          Genes: 'SMO;LIFR;AP4S1;NOTUM;PRKACA;OVOL1;2610019F03RIK'
        },
        {
          Term: 'SMAD4 21799915 ChIP-Seq A2780 Human',
          Overlap: '28/2464',
          'P-value': '0.9991856820436767',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6060606060606061',
          'Combined Score': '4.937270868456902E-4',
          Genes: 'ZFP106;ADK;MAT2B;KALRN;GPHN;PITPNC1;LRRC1;MED14;SRR;SPTLC1;NPY;MYO6;KDR;LRRC8A;GPR155;CD55;FBXO9;RBM39;MDH1;NSUN3;ANXA13;LIFR;MUT;PLEKHA7;PRPF18;CACNB4;LYRM5;ANKRD42'
        },
        {
          Term: 'FOXM1 26456572 ChIP-Seq MCF-7 Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'TMEM30A;MDH1;BRI3;OXSM;UBE2E1;VPS13B;CABLES1;WDR89;NR3C1;MPP7;PITPNC1;SLC9A6;NME7;MYO6;C1D;KDR;FBXL3;MTFR1;TRIM37;CD55;NUDT12'
        },
        {
          Term: 'KLF4 19829295 ChIP-Seq ESCs Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'KLHDC4;AFAP1L1;ARHGEF12;BRI3;CNO;TRPC2;VLDLR;ZBTB44;OVOL1;KALRN;MPP7;PLEKHA7;KLF1;GK5;ATXN2;RPS6KA5;NAGLU;RQCD1;AQP11;NUDT12;SCYL1'
        },
        {
          Term: 'NFYB 21822215 ChIP-Seq K562 Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'RWDD3;HSD3B2;ASCC1;IPP;ADK;LRRC40;KMO;ATAD3A;MPP7;PLEKHA7;ZC3H12C;ATXN2;PRPF18;NSMCE4A;SCP2;NME7;HYI;CLCC1;RAB11FIP2;CD55;ATPAF1'
        },
        {
          Term: 'RUNX1 22897851 ChIP-Seq JUKARTE6-1 Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'ZFP106;GADD45GIP1;TRAP1;CPT1A;KLF12;CREBL2;PTTG1IP;VWCE;TFB1M;WDR34;THTPA;SIPA1L1;SPTLC1;H2AFJ;TSR2;TASP1;SMYD4;LRRC8A;METTL7A;GPR155;PAIP1'
        },
        {
          Term: 'CSB 26484114 Chip-Seq FIBROBLAST Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CEP68;MDH1;TPMT;NDUFB6;ADHFE1;IPP;MYNN;ARHGAP18;LIFR;CREBL2;MRPL35;YARS2;PITPNC1;SIP1;CDAN1;SPTLC1;PSMC6;H2AFJ;PKIG;FGFR4;SFXN5'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq K562 Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CPT1A;FKBPL;CISD1;ADK;NAP1L1;PTTG1IP;NR3C1;WDR24;ATAD3A;GPHN;PCMTD2;ZC3H12C;SLC25A39;SBK1;SMO;MGAT1;CHPT1;PKIG;NEO1;SFXN5;SCYL1'
        },
        {
          Term: 'KDM2B 26808549 Chip-Seq REH Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'KLF12;TPMT;GBE1;ADK;LRRC40;CABLES1;TFB1M;MUT;5730403B10RIK;ALDH1A3;ESM1;SMO;AGBL3;TOMM70A;C1D;TFAM;FBXL3;RIOK2;ACO1;SF1;BC016495'
        },
        {
          Term: 'CTCF 27219007 Chip-Seq Bcells Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CPT1A;KLF12;RWDD3;ACBD4;ADK;SAT2;PCSK7;VWCE;ZBTB44;TMEM80;PLEKHA7;GPHN;DHTKD1;KLF1;LASS2;SLC25A16;PRPF18;TCN2;AQP11;MRPL9;SF1'
        },
        {
          Term: 'CTCF 27219007 Chip-Seq ERYTHROID Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CPT1A;KLF12;ARHGEF12;EI24;ABHD14A;PTTG1IP;TMEM80;ATAD3A;PLEKHA7;KLF1;LASS2;PSMC3IP;ATXN2;CDAN1;SLC25A39;HYI;FBXL3;CLCC1;HOXA7;SAC3D1;ATPAF1'
        },
        {
          Term: 'RING1B 27294783 Chip-Seq NPCs Mouse',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CEP68;CPT1A;CNTD1;ACBD4;FAHD1;FZD5;WDR20A;CISD1;CABLES1;LIFR;VLDLR;NR3C1;GPHN;SRR;SLC25A39;AFMID;C1D;RQCD1;BPNT1;HOXA7;PMS1'
        },
        {
          Term: 'RUNX1 27514584 Chip-Seq MCF-7 Human',
          Overlap: '21/2000',
          'P-value': '0.9992472213950446',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.56',
          'Combined Score': '4.217147676243623E-4',
          Genes: 'CPT1A;KLHDC4;ENTPD5;POLRMT;ELL3;PITPNC1;GK5;PRPF18;SBK1;CAT;TFAM;YME1L1;MGAT1;MTFR1;TRIM37;PRKACA;GAL3ST2;SFXN5;CD55;SAC3D1;ZKSCAN1'
        },
        {
          Term: 'TCF4 23295773 ChIP-Seq U87 Human',
          Overlap: '49/3812',
          'P-value': '0.9992578715920818',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6855543896467297',
          'Combined Score': '5.08958267292097E-4',
          Genes: 'MOBKL2B;GBE1;USP34;TFB1M;TM7SF3;NR3C1;GPHN;LRRC1;ZC3H12C;SIPA1L1;SPTLC1;H2AFJ;SLC25A40;NEO1;HIBCH;CPT1A;KLF12;OXSM;VPS13B;CACNB4;COL4A4;CAT;C1D;RBKS;ZFP106;LIPT1;KALRN;GK5;ATXN2;ARSK;PSMB1;TASP1;SMYD4;ARSG;GPR155;FN3K;DNAJC19;MDH1;TGDS;SLC33A1;CABLES1;PARP16;MPP7;PLEKHA7;CDAN1;RPS6KB1;DMXL1;TRIM37;FGFR4'
        },
        {
          Term: 'BMI1 23680149 ChIP-Seq NPCS Mouse',
          Overlap: '8/1056',
          'P-value': '0.9993501179697324',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4040404040404041',
          'Combined Score': '2.6266395762856385E-4',
          Genes: 'ABHD3;NPY;WDR20A;ARSG;NOTUM;HOXA7;OVOL1;2610019F03RIK'
        },
        {
          Term: 'TCF3/E2A 22897851 ChIP-Seq JUKARTE6-1 Human',
          Overlap: '20/1946',
          'P-value': '0.9993574153306616',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5481329222336416',
          'Combined Score': '3.5233502725809976E-4',
          Genes: 'INTU;CRADD;GBE1;MTMR14;NOL7;PEX1;MAT2B;NR3C1;GPHN;LRRC1;ESM1;SPTLC1;NPY;C1D;FBXO3;TASP1;METTL7A;ALDH8A1;GPR155;SAC3D1'
        },
        {
          Term: 'ERA 27197147 Chip-Seq ENDOMETRIOID-ADENOCARCINOMA Human',
          Overlap: '8/1073',
          'P-value': '0.99948206472517',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.3976390183286735',
          'Combined Score': '2.0600462737922266E-4',
          Genes: 'GADD45GIP1;GBE1;STXBP2;NSUN3;C1D;MGAT1;NAT9;ZKSCAN1'
        },
        {
          Term: 'EED 16625203 ChIP-ChIP MESCs Mouse',
          Overlap: '5/830',
          'P-value': '0.9995713674934893',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.32128514056224905',
          'Combined Score': '1.3774277772923832E-4',
          Genes: 'D4BWG0951E;ABHD3;FBXL3;OVOL1;4933407N01RIK'
        },
        {
          Term: 'CDX2 22108803 ChIP-Seq LS180 Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'SLC30A6;LRRC19;IPP;NOL7;UBE2E1;LRRC40;CABLES1;NR3C1;PAICS;YARS2;MUT;PSMC3IP;SRR;GORASP1;FBXO3;PGM2;AQP11;RIOK2;HIBCH;NUDT12'
        },
        {
          Term: 'CEBPA 26348894 ChIP-Seq LIVER Mouse',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'FN3K;SLC30A6;CPT1A;TMEM86A;RWDD3;ARHGEF12;GBE1;NOL7;CABLES1;GK5;ZC3H12C;LYRM2;DMXL1;TFAM;AQP11;RDH14;RIOK2;AP4S1;CLCC1;METTL8'
        },
        {
          Term: 'PHF8 20622853 ChIP-Seq HELA Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'RWDD3;HSD3B2;ASCC1;IPP;ADK;LRRC40;ZBTB44;KMO;MRPL35;ATAD3A;MPP7;PLEKHA7;SCP2;NME7;HYI;CLCC1;MRPL9;RAB11FIP2;CD55;ATPAF1'
        },
        {
          Term: 'E2F1 20622854 ChIP-Seq HELA Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'ZFP106;LYPLA1;ABHD3;SAT2;CREBL2;POLRMT;DNAJC18;NFS1;SCP2;NAGLU;DOLPP1;CLCC1;PRKACA;SEPHS2;ZCCHC3;RILP;SFXN5;SAC3D1;SF1;PAIP1'
        },
        {
          Term: 'EBNA1 20929547 Chip-Seq RAJI-cells Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'CPT1A;MOBKL2B;TOR1A;MTMR14;CISD1;ORC5L;DHRS1;TMEM80;KALRN;LRRC1;VAMP8;CDAN1;SLC25A39;GORASP1;MYO6;TFAM;HYI;TLCD1;HOXA7;RILP'
        },
        {
          Term: 'TCF4 22108803 ChIP-Seq LS180 Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'INTU;BRI3;LIFR;VWCE;TFB1M;WDR34;NR3C1;LRRC1;MIPOL1;LYRM2;SBK1;GORASP1;MYO6;PSMB1;PGM2;AQP11;ALDH8A1;NDUFV1;HIBCH;TMED4'
        },
        {
          Term: 'CBX2 22325352 ChIP-Seq 293T-Rex Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'SLC30A6;RWDD3;MDH1;HSD3B2;IPP;LRRC40;KMO;MRPL35;ATAD3A;LASS2;CACNB4;SCP2;NME7;COL4A4;HYI;RDH14;CLCC1;SFXN5;CD55;ATPAF1'
        },
        {
          Term: 'MYB 26560356 Chip-Seq TH1 Human',
          Overlap: '20/2000',
          'P-value': '0.9996375813650747',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5333333333333333',
          'Combined Score': '1.9332497302965602E-4',
          Genes: 'CEP68;CPT1A;MDH1;ABHD3;RFESD;SLC33A1;IPP;PCSK7;TM7SF3;GPHN;RNF167;RPS6KA5;EXOSC4;NAGLU;TMBIM4;NME7;CAT;FBXL3;MRPL9;SF1'
        },
        {
          Term: 'GATA2 21571218 ChIP-Seq MEGAKARYOCYTES Human',
          Overlap: '8/1111',
          'P-value': '0.9996895915747894',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.384038403840384',
          'Combined Score': '1.1922726168722486E-4',
          Genes: 'CLDN10;BRI3;ENTPD5;CHPT1;DHRS1;TMEM80;ZCCHC3;GPHN'
        },
        {
          Term: 'BRD4 25478319 ChIP-Seq HGPS Human',
          Overlap: '24/2326',
          'P-value': '0.9997799546182715',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5503009458297508',
          'Combined Score': '1.2110450642303602E-4',
          Genes: 'CRADD;TPMT;BRI3;GBE1;MYNN;ADK;UBE2E1;ARHGAP18;CABLES1;NR3C1;YARS2;GK5;ESM1;SIPA1L1;PRPF18;NSMCE4A;SCP2;H2AFJ;AGBL3;C1D;KDR;HYI;PGM2;LRRC8A'
        },
        {
          Term: 'ATF3 23680149 ChIP-Seq GBM1-GSC Human',
          Overlap: '22/2189',
          'P-value': '0.9997843411442571',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5360134003350084',
          'Combined Score': '1.1560850302597799E-4',
          Genes: 'DNAJC19;TM2D2;OXSM;GLO1;SLC33A1;MYNN;TIMM44;VLDLR;TMEM80;ALDH6A1;ESM1;EXOSC4;ATP6V1B2;POLI;MGAT1;AP4S1;LRRC8A;TLCD1;TLN1;ZCCHC3;CD55;RBKS'
        },
        {
          Term: 'SUZ12 18555785 ChIP-Seq MESCs Mouse',
          Overlap: '7/1058',
          'P-value': '0.9997982213406899',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.35286704473850034',
          'Combined Score': '7.120822359363857E-5',
          Genes: 'AFAP1L1;CACNB4;SMO;4732435N03RIK;VLDLR;HOXA7;OVOL1'
        },
        {
          Term: 'EZH2 27304074 Chip-Seq ESCs Mouse',
          Overlap: '5/885',
          'P-value': '0.9998121120221719',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.30131826741996237',
          'Combined Score': '5.661939916698922E-5',
          Genes: 'SLC30A6;UBE2E1;CABLES1;HOXA7;KALRN'
        },
        {
          Term: 'CDX2 21074721 ChIP-Seq CACO-2 Mouse',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'RWDD3;HSD3B2;ASCC1;TRPC2;IPP;LRRC40;KMO;ATAD3A;MPP7;PLEKHA7;PRPF18;SCP2;NME7;TFAM;YME1L1;HYI;CLCC1;CD55;ATPAF1'
        },
        {
          Term: 'HNFA 21074721 ChIP-Seq CACO-2 Human',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'RWDD3;HSD3B2;ASCC1;TRPC2;IPP;ADK;LRRC40;KMO;ATAD3A;MPP7;PLEKHA7;PRPF18;NSMCE4A;SCP2;NME7;HYI;CLCC1;RAB11FIP2;CD55'
        },
        {
          Term: 'P53 21459846 ChIP-Seq SAOS-2 Human',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'RWDD3;TMEM30A;TM2D2;RFESD;ENTPD5;EI24;PROZ;ARHGAP18;VPS13B;PARP16;SAT2;TFB1M;WDR34;NR3C1;NUDT6;ADH5;H2AFJ;NUPL2;FBXO9'
        },
        {
          Term: 'LXR 22292898 ChIP-Seq THP-1 Human',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'FKBPL;FECH;BRI3;TRPC2;CABLES1;VWCE;OVOL1;GNMT;LASS2;EXOSC4;DALRD3;NAGLU;GORASP1;HYI;LRRC8A;NOTUM;ALDH8A1;SAC3D1;TMED4'
        },
        {
          Term: 'TBL1 22424771 ChIP-Seq 293T Human',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'RWDD3;ARHGEF12;HSD3B2;TRPC2;ADK;LRRC40;ATAD3A;MPP7;PLEKHA7;ATXN2;PRPF18;NSMCE4A;SBK1;SCP2;NME7;HYI;CLCC1;RAB11FIP2;CD55'
        },
        {
          Term: 'SPI1 26923725 Chip-Seq HPCs Mouse',
          Overlap: '19/2000',
          'P-value': '0.9998329163849488',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5066666666666667',
          'Combined Score': '8.466277137055784E-5',
          Genes: 'CPT1A;FZD5;NSUN3;LIFR;VWCE;ACAA1A;YARS2;GNMT;RPS6KA5;NME7;DMXL1;GORASP1;PMPCB;NOTUM;2610019F03RIK;RILP;HIBCH;SF1;FBXL6'
        },
        {
          Term: 'DROSHA 22980978 ChIP-Seq HELA Human',
          Overlap: '1/456',
          'P-value': '0.9998355171009436',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.11695906432748537',
          'Combined Score': '1.9239348286773767E-5',
          Genes: 'TRIM37'
        },
        {
          Term: 'SMAD2/3 21741376 ChIP-Seq ESCs Human',
          Overlap: '18/2000',
          'P-value': '0.9999254620619481',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.48',
          'Combined Score': '3.5779543748185764E-5',
          Genes: 'GADD45GIP1;IAH1;RFESD;VPS13B;SAT2;CREBL2;PTTG1IP;WDR34;POLRMT;YARS2;NFS1;NAGLU;PKIG;SEPHS2;GPR155;ZCCHC3;SF1;PAIP1'
        },
        {
          Term: 'P68 20966046 ChIP-Seq HELA Human',
          Overlap: '18/2000',
          'P-value': '0.9999254620619481',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.48',
          'Combined Score': '3.5779543748185764E-5',
          Genes: 'ZFP106;CPT1A;IAH1;TOR1A;VPS13B;SAT2;CREBL2;VWCE;WDR34;POLRMT;TMEM80;EXOSC4;SLC7A6OS;NSMCE4A;ACO1;SEPHS2;RILP;SF1'
        },
        {
          Term: 'SMAD2/3 21741376 ChIP-Seq EPCs Human',
          Overlap: '18/2000',
          'P-value': '0.9999254620619481',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.48',
          'Combined Score': '3.5779543748185764E-5',
          Genes: 'ARHGEF12;INTU;TRPC2;ARHGAP18;CABLES1;LIFR;CREBL2;ZBTB44;NR3C1;YARS2;PLEKHA7;ESM1;LYRM2;SMO;C1D;TSR2;METTL7A;CD55'
        },
        {
          Term: 'CREB1 26743006 Chip-Seq LNCaP-abl Human',
          Overlap: '18/2000',
          'P-value': '0.9999254620619481',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.48',
          'Combined Score': '3.5779543748185764E-5',
          Genes: 'UNC119B;CPT1A;IPP;WDR89;NXT2;ATAD3A;ELL3;PITPNC1;LRRC1;LASS2;SLC25A16;ZC3H12C;TMBIM4;H2AFJ;UFC1;HYI;FBXL3;PRKACA'
        },
        {
          Term: 'SUZ12 18692474 ChIP-Seq MEFs Mouse',
          Overlap: '7/1135',
          'P-value': '0.9999312557937783',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.328928046989721',
          'Combined Score': '2.2612674748461175E-5',
          Genes: 'ALDH1A3;CACNB4;KDR;CABLES1;VLDLR;HOXA7;OVOL1'
        },
        {
          Term: 'AR 19668381 ChIP-Seq PC3 Human',
          Overlap: '40/3519',
          'P-value': '0.9999331359349284',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.60623283129677',
          'Combined Score': '4.0536546714628104E-5',
          Genes: 'CNO;KALRN;GPHN;PITPNC1;LRRC1;FARS2;DHTKD1;PCMTD2;GYS2;SCP2;KDR;TASP1;RDH14;ARSG;NEO1;PMS1;ZKSCAN1;FBXO9;NUDT12;TRAP1;SLC30A6;CPT1A;KLF12;CRADD;HSD3B2;ASCC1;CABLES1;LRRC44;MUT;MPP7;PLEKHA7;CLDN10;SBK1;DMXL1;TOMM70A;DOLPP1;C1D;ACO1;TLN1;ATPAF1'
        },
        {
          Term: 'TP63 23658742 ChIP-Seq EP156T Human',
          Overlap: '42/3652',
          'P-value': '0.9999350577493676',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6133625410733844',
          'Combined Score': '3.983443735389703E-5',
          Genes: 'INTU;LRRC19;ADK;ARHGAP18;VWCE;MAT2B;NR3C1;YARS2;GPHN;PITPNC1;GYS2;PSMC3IP;GK5;ZC3H12C;EXOSC4;MYO6;KDR;CDK5RAP1;PGM2;RIOK2;MGAT1;LRRC8A;NEO1;NUDT12;CEP68;RBM39;KLHDC4;RWDD3;ARHGEF12;CRADD;ASCC1;NSUN3;ANXA13;FAH;KMO;ITFG1;CLDN10;ALDH1A3;CDAN1;C1D;TFAM;SFXN5'
        },
        {
          Term: 'TP63 22573176 ChIP-Seq HFKS Human',
          Overlap: '51/4229',
          'P-value': '0.9999368325398083',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.64317805627808',
          'Combined Score': '4.0629207501585725E-5',
          Genes: 'MTMR14;PHF7;PITPNC1;NAGLU;CDK5RAP1;POLI;SEPHS2;CPT1A;ANXA13;ABHD14A;PEX1;OVOL1;POLRMT;CLDN10;CACNB4;NSMCE4A;SLC9A6;NME7;TFAM;RBKS;SF1;ATPAF1;LRRC56;INTU;MYNN;PTTG1IP;MAT2B;WDR24;MIPOL1;PSMC3IP;MGAT1;SMYD4;LRRC8A;NDUFV1;ZKSCAN1;RBM39;KLHDC4;CRADD;TIMM44;FAH;MCAT;MPP7;PLEKHA7;DNAJC18;GSTZ1;UBOX5;SLC25A39;DOLPP1;ZCCHC3;SFXN5;FBXL6'
        },
        {
          Term: 'EP300 20729851 ChIP-Seq FORBRAIN MIDBRAIN LIMB HEART Mouse',
          Overlap: '19/2093',
          'P-value': '0.9999399319545872',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4841535276317885',
          'Combined Score': '2.9083029573673438E-5',
          Genes: 'CPT1A;MOBKL2B;AFAP1L1;ARHGEF12;FECH;D4BWG0951E;GBE1;GLO1;USP34;C330018D20RIK;KALRN;PITPNC1;3110001I20RIK;ALDH1A3;ATXN2;NAGLU;PMPCB;HOXA7;ZCCHC3'
        },
        {
          Term: 'TDRD3 21172665 ChIP-Seq MCF-7 Human',
          Overlap: '2/655',
          'P-value': '0.9999497441979636',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.1628498727735369',
          'Combined Score': '8.184356625191495E-6',
          Genes: 'VPS13B;TRIM37'
        },
        {
          Term: 'RUNX2 22187159 ChIP-Seq PCA Human',
          Overlap: '38/3423',
          'P-value': '0.9999510348745594',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.59207323011004',
          'Combined Score': '2.899164977804447E-5',
          Genes: 'MOBKL2B;GBE1;ZBTB44;MAT2B;NR3C1;LRRC1;GYS2;ESM1;SRR;SCRN3;KDR;FBXO3;PGM2;RDH14;METTL7A;NEO1;HIBCH;FBXO9;GADD45GIP1;TRAP1;KLHDC4;ARHGEF12;OXSM;ZFYVE20;UBE2E1;LRRC40;VPS13B;LIFR;NAP1L1;POLRMT;GSTZ1;NSMCE4A;SLC9A6;DMXL1;CAT;ACO1;PKIG;ALDH8A1'
        },
        {
          Term: 'TAL1 22897851 ChIP-Seq JUKARTE6-1 Human',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'RFESD;NOL7;PEX1;THTPA;ATXN2;SIPA1L1;SPTLC1;NAGLU;RQCD1;TASP1;PGM2;RIOK2;LRRC8A;ARSG;METTL7A;CLCC1;FBXO9'
        },
        {
          Term: 'GATA6 21074721 ChIP-Seq CACO-2 Human',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'RWDD3;HSD3B2;IPP;LRRC40;KMO;ATAD3A;MPP7;LASS2;PRPF18;SCP2;NME7;TFAM;HYI;BPNT1;CLCC1;CD55;ATPAF1'
        },
        {
          Term: 'DPY 21335234 ChIP-Seq ESCs Mouse',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'ZRSR1;LIPT1;LYPLA1;OSGEPL1;D4BWG0951E;GLO1;TRPC2;PARP16;OVOL1;NR3C1;RABEPK;KLF1;GSTZ1;SLC25A40;MGAT1;HOXA7;NDUFV1'
        },
        {
          Term: 'SMAD4 21741376 ChIP-Seq ESCs Human',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'GADD45GIP1;HSD3B2;VPS13B;PTTG1IP;WDR89;OVOL1;WDR34;KMO;ALDH6A1;ATXN2;NAGLU;MYO6;MGAT1;ZCCHC3;ZKSCAN1;SF1;SCYL1'
        },
        {
          Term: 'PCGF4 22325352 ChIP-Seq 293T-Rex Human',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'RWDD3;HSD3B2;OXSM;IPP;LRRC40;MRPL35;ATAD3A;CACNB4;SCP2;NME7;COL4A4;C1D;HYI;RDH14;SFXN5;CD55;ATPAF1'
        },
        {
          Term: 'RING1B 27294783 Chip-Seq ESCs Mouse',
          Overlap: '17/2000',
          'P-value': '0.9999668612769919',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.45333333333333337',
          'Combined Score': '1.5023136688848381E-5',
          Genes: 'ACBD4;CRADD;FZD5;UBE2E1;VWCE;NR3C1;WDR24;GPHN;PITPNC1;MIPOL1;KLF1;4933403G14RIK;RQCD1;HOXA7;GPR155;PMS1;NUDT12'
        },
        {
          Term: 'JARID2 20064375 ChIP-Seq MESCs Mouse',
          Overlap: '6/1117',
          'P-value': '0.9999743046099172',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.28648164726947184',
          'Combined Score': '7.361352254963701E-6',
          Genes: 'CACNB4;KDR;CABLES1;FBXL3;HOXA7;OVOL1'
        },
        {
          Term: 'EGR1 20690147 ChIP-Seq ERYTHROLEUKEMIA Human',
          Overlap: '81/6207',
          'P-value': '0.9999785715340417',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.6959884001933302',
          'Combined Score': '1.4914123534891551E-5',
          Genes: 'USP34;ADK;ORC5L;GPHN;LRRC1;FARS2;GYS2;THTPA;RPS6KA5;SCP2;KDR;POLI;PGM2;PRKACA;TMED4;NUDT12;SCYL1;SLC30A6;CPT1A;KLF12;ARHGEF12;FKBPL;ZFYVE20;UBE2E1;VPS13B;LIFR;OVOL1;WDR34;POLRMT;MUT;ITFG1;PRPF18;CACNB4;SMO;ANKRD42;TFAM;TLCD1;RBKS;SF1;LRRC56;NDUFB6;PROZ;CREBL2;PTTG1IP;VWCE;MAT2B;ATXN2;EXOSC4;TASP1;HYI;SIAE;GPR155;RILP;TRAP1;RBM39;KLHDC4;RWDD3;TOR1A;ADHFE1;LRRC61;CABLES1;TIMM44;NAP1L1;FAH;ELL3;PLEKHA7;GNMT;DNAJC18;KLF1;SLC25A39;SBK1;DMXL1;FBXL3;ACO1;TRIM37;NOTUM;PKIG;NAT9;FGFR4;SFXN5;FBXL6'
        },
        {
          Term: 'FOXH1 21741376 ChIP-Seq ESCs Human',
          Overlap: '16/2000',
          'P-value': '0.9999842933469065',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4266666666666667',
          'Combined Score': '6.701557949542286E-6',
          Genes: 'CPT1A;LRRC56;KLF12;CNO;PTTG1IP;VLDLR;WDR89;WDR34;TMEM80;SLC25A16;GK5;ALDH6A1;SLC9A6;ASB9;RQCD1;GPR155'
        },
        {
          Term: 'RBPJ 21746931 ChIP-Seq IB4 Human',
          Overlap: '16/2000',
          'P-value': '0.9999842933469065',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4266666666666667',
          'Combined Score': '6.701557949542286E-6',
          Genes: 'SLC30A6;RWDD3;HSD3B2;IPP;LRRC40;KMO;MRPL35;ATAD3A;LASS2;SCP2;NME7;C1D;HYI;CLCC1;CD55;ATPAF1'
        },
        {
          Term: 'NFYA 21822215 ChIP-Seq K562 Human',
          Overlap: '16/2000',
          'P-value': '0.9999842933469065',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4266666666666667',
          'Combined Score': '6.701557949542286E-6',
          Genes: 'RWDD3;CRADD;HSD3B2;TRPC2;IPP;ADK;LRRC40;ATAD3A;MPP7;PRPF18;SCP2;NME7;HYI;CLCC1;RAB11FIP2;CD55'
        },
        {
          Term: 'JARID2 20075857 ChIP-Seq MESCs Mouse',
          Overlap: '7/1258',
          'P-value': '0.999985477369099',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.296767355590885',
          'Combined Score': '4.309874064131073E-6',
          Genes: 'ALDH1A3;CACNB4;FBXL3;LIFR;HOXA7;OVOL1;ATPAF1'
        },
        {
          Term: 'SUZ12 16625203 ChIP-ChIP MESCs Mouse',
          Overlap: '7/1270',
          'P-value': '0.9999871696600913',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.29396325459317585',
          'Combined Score': '3.7716726730803742E-6',
          Genes: '9630013D21RIK;SMO;ABHD3;NPY;OVOL1;4933407N01RIK;GPHN'
        },
        {
          Term: 'RNF2 27304074 Chip-Seq ESCs Mouse',
          Overlap: '9/1467',
          'P-value': '0.9999890095149596',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.32719836400818',
          'Combined Score': '3.5960884862849822E-6',
          Genes: 'ALDH1A3;SMO;NPY;NSUN3;CABLES1;VLDLR;NOTUM;NR3C1;KALRN'
        },
        {
          Term: 'REST 18959480 ChIP-ChIP MESCs Mouse',
          Overlap: '27/2868',
          'P-value': '0.9999892750492465',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.5020920502092051',
          'Combined Score': '5.3849413888815035E-6',
          Genes: '2610528K11RIK;BRI3;CNO;1110003E01RIK;ORC5L;MAT2B;WDR24;AKR7A5;CDK5RAP1;TASP1;NEO1;TMED4;CEP68;LYPLA1;1700123L14RIK;CRADD;NSUN3;UBE2E1;4632404H12RIK;WDR34;2610036D13RIK;DNAJC18;DALRD3;SBK1;ATP6V1B2;ACO1;FBXL6'
        },
        {
          Term: 'OCT4 19829295 ChIP-Seq ESCs Human',
          Overlap: '15/2000',
          'P-value': '0.9999911786765187',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4',
          'Combined Score': '3.528544955779123E-6',
          Genes: 'SLC30A6;CPT1A;KLHDC4;FECH;CNO;ZFYVE20;UBE2E1;OVOL1;MCAT;PLEKHA7;ATXN2;CDK5RAP1;FGFR4;SEPHS2;NUDT12'
        },
        {
          Term: 'GATA6 21074721 ChIP-Seq CACO-2 Mouse',
          Overlap: '15/2000',
          'P-value': '0.9999911786765187',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4',
          'Combined Score': '3.528544955779123E-6',
          Genes: 'RWDD3;HSD3B2;IPP;LRRC40;KMO;ATAD3A;MPP7;LASS2;ZC3H12C;SCP2;NME7;HYI;CLCC1;MRPL9;CD55'
        },
        {
          Term: 'SMAD3 21741376 ChIP-Seq ESCs Human',
          Overlap: '15/2000',
          'P-value': '0.9999911786765187',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4',
          'Combined Score': '3.528544955779123E-6',
          Genes: 'INTU;HPN;UBE2E1;VPS13B;PTTG1IP;WDR34;KMO;FARS2;RPS6KA5;PRPF18;NPY;GORASP1;AQP11;ACO1;CD55'
        },
        {
          Term: 'SMAD4 21741376 ChIP-Seq EPCs Human',
          Overlap: '14/2000',
          'P-value': '0.9999937197838924',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.37333333333333335',
          'Combined Score': '2.3446213758767067E-6',
          Genes: 'RWDD3;CRADD;ANXA13;ARHGAP18;CABLES1;LIFR;CREBL2;ZBTB44;TFB1M;WDR34;ALDH6A1;LYRM2;TSR2;METTL7A'
        },
        {
          Term: 'SMAD4 21741376 ChIP-Seq HESCs Human',
          Overlap: '23/2738',
          'P-value': '0.9999938283941985',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4480155831507183',
          'Combined Score': '2.7649841043487804E-6',
          Genes: 'TMEM86A;INTU;MDH1;CISD1;ARHGAP18;LIFR;MAT2B;TFB1M;FAH;NR3C1;KMO;PLEKHA7;PITPNC1;LRRC1;SIPA1L1;PLSCR2;C1D;ATP6V1B2;FBXL3;ARSG;FGFR4;PMS1;ATPAF1'
        },
        {
          Term: 'SUZ12 20075857 ChIP-Seq MESCs Mouse',
          Overlap: '35/4356',
          'P-value': '0.9999939620194852',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.428527701254974',
          'Combined Score': '2.587449721720686E-6',
          Genes: 'TPMT;ABHD3;MYNN;VLDLR;VWCE;NR3C1;LRRC1;ZC3H12C;NAGLU;NPY;KDR;HYI;HOXA7;GPR155;2610019F03RIK;FBXO9;PAIP1;AFAP1L1;FAHD1;ADHFE1;UBE2E1;CABLES1;OVOL1;TMEM80;ALDH1A3;UBOX5;CACNB4;SMO;COL4A4;AQP11;FBXL3;CHPT1;NOTUM;FGFR4;SFXN5'
        },
        {
          Term: 'TRIM28 17542650 ChIP-ChIP NTERA2 Human',
          Overlap: '11/3568',
          'P-value': '0.9999942099609097',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.16442451420029894',
          'Combined Score': '9.520271207617972E-7',
          Genes: 'LASS2;FN3K;ESM1;KLF12;RWDD3;CRADD;SMO;TGDS;MGAT1;LIFR;PMS1'
        },
        {
          Term: 'MTF2 20144788 ChIP-Seq MESCs Mouse',
          Overlap: '24/2981',
          'P-value': '0.9999943635796165',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.4293861120429386',
          'Combined Score': '2.4202074549861775E-6',
          Genes: '2610528K11RIK;AFAP1L1;INTU;ABHD3;ADHFE1;HPN;MYNN;UBE2E1;CABLES1;VLDLR;OVOL1;NR3C1;CLDN10;ALDH1A3;CACNB4;SMO;TMBIM4;NPY;COL4A4;KDR;CHPT1;NOTUM;HOXA7;FGFR4'
        },
        {
          Term: 'ETV1 20927104 ChIP-Seq GIST48 Human',
          Overlap: '13/2000',
          'P-value': '0.999994592177819',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.3466666666666667',
          'Combined Score': '1.874716758467055E-6',
          Genes: 'RWDD3;HSD3B2;IPP;LRRC40;ATAD3A;CACNB4;SCP2;NME7;HYI;RDH14;CLCC1;SFXN5;CD55'
        },
        {
          Term: 'SUZ12 18974828 ChIP-Seq MESCs Mouse',
          Overlap: '12/1934',
          'P-value': '0.9999947302004305',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.3309203722854188',
          'Combined Score': '1.7438886303830139E-6',
          Genes: 'TMEM166;ALDH1A3;CACNB4;SMO;4732435N03RIK;NPY;COL4A4;KDR;CABLES1;VLDLR;HOXA7;OVOL1'
        },
        {
          Term: 'STAT3 20064451 ChIP-Seq CD4+T Mouse',
          Overlap: '14/2204',
          'P-value': '0.9999947814292175',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.338777979431337',
          'Combined Score': '1.7679414782846344E-6',
          Genes: 'RBM39;0610013E23RIK;2610528K11RIK;TMEM30A;9030420J04RIK;RP23-195K8.6;WDR89;NR3C1;4932438A13RIK;4933403G14RIK;ZC3H12C;RPS6KA5;SEPHS2;2610019F03RIK'
        },
        {
          Term: 'SUZ12 27294783 Chip-Seq ESCs Mouse',
          Overlap: '12/2000',
          'P-value': '0.999994869366455',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.32',
          'Combined Score': '1.641806946163005E-6',
          Genes: 'ALDH1A3;INTU;COL4A4;KDR;UBE2E1;VLDLR;NOTUM;HOXA7;OVOL1;NR3C1;FGFR4;PAIP1'
        },
        {
          Term: 'SUZ12 18692474 ChIP-Seq MESCs Mouse',
          Overlap: '11/1909',
          'P-value': '0.9999949258720081',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.30731622140736864',
          'Combined Score': '1.5593657976187516E-6',
          Genes: 'ALDH1A3;CACNB4;4732435N03RIK;COX15;ABHD3;NPY;KDR;CABLES1;VLDLR;HOXA7;OVOL1'
        },
        {
          Term: 'EZH2 27294783 Chip-Seq ESCs Mouse',
          Overlap: '11/2000',
          'P-value': '0.9999949503948452',
          'Adjusted P-value': '1.0',
          'Old P-value': '0',
          'Old Adjusted P-value': '0',
          'Odds Ratio': '0.29333333333333333',
          'Combined Score': '1.481221251867393E-6',
          Genes: 'ALDH1A3;RWDD3;SBK1;INTU;HPN;TASP1;CABLES1;VLDLR;HOXA7;2610528J11RIK;SCYL1'
        }
      ]
    };
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  columnOrder: string[] = [];
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  legend: Map<string, string> = new Map<string, string>();
  filtersPanelOpened = false;
  clickableWords = false;
  @ViewChild(WordCloudComponent, {static: false})
  private wordCloudComponent: WordCloudComponent;


  scrollTopAmount: number;

  loadingData: boolean;

  cloudData: string[] = [];

  selectedRow = 0;

  constructor(protected readonly messageDialog: MessageDialog,
              protected readonly ngZone: NgZone,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly filesystemObjectActions: FilesystemObjectActions,
              protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly enrichmentService: EnrichmentVisualisationService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly downloadService: DownloadService,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog) {
    this.projectName = this.route.snapshot.params.project_name || '';
    this.fileId = this.route.snapshot.params.file_id || '';

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    this.paramsSubscription = this.route.params.subscribe(params => {
      this.locator = params.hash_id;
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.queryParamsSubscription.unsubscribe();
    this.paramsSubscription.unsubscribe();
    this.loadTableTaskSubscription.unsubscribe();
  }

  shouldConfirmUnload() {
    return this.unsavedChanges$.getValue();
  }

  setCloudData() {
    console.log(this.data, this.selectedRow);
    this.cloudData = this.mockedData.data[this.selectedRow].Genes.split(';');
  }

  // events
  public chartClick({event, active}: { event: MouseEvent, active: {}[] }): void {
    console.log('active', active[0]);
    if (active[0]) {
      this.selectedRow = (active[0] as any)._index;
      this.setCloudData();
    }
  }

  ngOnInit() {
    this.loadTableTask = new BackgroundTask(() => this.filesystemService.get(this.fileId, {
      loadContent: true,
    }).pipe(
      this.errorHandler.create({label: 'Load enrichment table'}),
      mergeMap((object: FilesystemObject) => {
        return object.contentValue$.pipe(
          mapBlobToBuffer(),
          mapBufferToJson<EnrichmentVisualisationData>(),
          map((data: EnrichmentVisualisationData) => [object, data] as [FilesystemObject, EnrichmentVisualisationData]),
        );
      }),
    ));
    this.loadTableTaskSubscription = this.loadTableTask.results$.subscribe((result) => {
      const [object, data] = result.result;
      // parse the file content to get gene list and organism tax id and name
      this.object = object;
      this.data = data;
      this.emitModuleProperties();
      const resultArray = data.data.split('/');
      this.importGenes = resultArray[0]
        .split(',')
        .filter((gene) => gene !== '');
      this.taxID = resultArray[1];
      if (this.taxID === '562' || this.taxID === '83333') {
        this.taxID = '511145';
      } else if (this.taxID === '4932') {
        this.taxID = '559292';
      }
      this.organism = resultArray[2];
      // parse for column order/domain input
      if (resultArray.length > 3) {
        if (resultArray[3] !== '') {
          this.domains = resultArray[3].split(',');
          this.columnOrder = resultArray[3].split(',');
          if (this.columnOrder.includes('Regulon')) {
            const index = this.columnOrder.indexOf('Regulon');
            this.columnOrder.splice(index + 1, 0, 'Regulon 3');
            this.columnOrder.splice(index + 1, 0, 'Regulon 2');
          }
        }
      } else {
        // Default view for existing Visualisations
        this.domains = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
        this.columnOrder = ['Regulon', 'Regulon 2', 'Regulon 3', 'UniProt', 'String', 'GO', 'Biocyc'];
      }
      this.initializeHeaders();
      this.removeDuplicates(this.importGenes);
      this.matchNCBINodes();
      this.enrichWithGOTerms();
      this.setCloudData();
    });
    this.loadTableTask.update();

  }



  scrollTop() {
    this.scrollTopAmount = 0;
  }

  onTableScroll(e) {
    this.scrollTopAmount = e.target.scrollTop;
  }

  // Start of Download for CSV section.

  /**
   * Function to that returns all data without changing current table view.
   */
  loadAllEntries(): Promise<TableCell[][]> {
    return this.worksheetViewerService
      .matchNCBINodes(this.importGenes, this.taxID)
      .pipe(
        flatMap(matched => forkJoin(
          [matched.map((wrapper) => wrapper.s)],
          [matched.map((wrapper) => wrapper.x)],
          [matched.map((wrapper) => wrapper.link)],
          [matched.map((wrapper) => wrapper.neo4jID)],
          this.worksheetViewerService.getNCBIEnrichmentDomains(
            matched.map((wrapper) => wrapper.neo4jID), this.taxID),
        )),
        map(([synonyms, ncbiNodes, ncbiLinks, ncbiIds, domains]) => {
          const tableEntries = domains.map((wrapper) =>
            this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds),
          );
          for (let i = 0; i < ncbiNodes.length; i++) {
            tableEntries[i].unshift({
              text: ncbiNodes[i].full_name,
              singleLink: {
                link: ncbiLinks[i],
                linkText: 'NCBI Link',
              },
            });
            tableEntries[i].unshift({text: ncbiNodes[i].name});
            tableEntries[i].unshift({text: synonyms[i].name});
          }
          const geneNames = synonyms.map((node) => node.name);
          const unmatchedGenes = this.importGenes.filter(
            (gene) => !geneNames.includes(gene),
          );
          unmatchedGenes.forEach((gene) => {
            const cell: TableCell[] = [];
            cell.push({text: gene, highlight: true});
            cell.push({text: 'No match found.', highlight: true});
            const colNum = Math.max.apply(
              null,
              this.tableHeader.map((x) =>
                x.reduce((a, b) => a + parseInt(b.span, 10), 0),
              ),
            );
            for (let i = 0; i < colNum - 2; i++) {
              cell.push({text: '', highlight: true});
            }
            tableEntries.push(cell);
          });
          return tableEntries;
        }),
      ).toPromise();
  }

  /**
   * Convert an array representing a row for CSV formatting.
   * @param row array that represents a row in a table
   * @returns string that represents row in CSV format.
   */
  processRowCSV(row: string | any[]): string {
    let finalVal = '';
    for (let j = 0; j < row.length; j++) {
      let innerValue = row[j] === null ? '' : row[j].toString();
      if (row[j] instanceof Date) {
        innerValue = row[j].toLocaleString();
      }
      let result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = '"' + result + '"';
      }
      if (j > 0) {
        finalVal += ',';
      }
      finalVal += result;
    }
    return finalVal + '\n';
  }

  /**
   * Load all data, convert to CSV format and provide download.
   */
  downloadAsCSV() {
    // TODO: Implement this as an export format in the filesystem API
    this.downloadService.requestDownload(
      this.object.filename,
      () => from(this.loadAllEntries()).pipe(
        mergeMap(entries => {
          const stringEntries = this.convertEntriesToString(entries);
          let csvFile = '';
          stringEntries.forEach(entry => csvFile += this.processRowCSV(entry));
          return of(csvFile);
        }),
      ),
      'application/csv',
      '.csv',
    );
  }

  /**
   * Convert entire table to string.
   * @param entries table entries in TableCell format
   * @returns 2d string array that represents table.
   */
  convertEntriesToString(entries: TableCell[][]): string[][] {
    const result = [];
    this.tableHeader.forEach(row => {
      const rowString = [];
      row.forEach(header => {
        rowString.push(header.name);
        if (header.span !== '1') {
          for (let i = 1; i < parseInt(header.span, 10); i++) {
            rowString.push('');
          }
        }
      });
      result.push(rowString);
    });
    entries.forEach(row => {
      const rowString = [];
      row.forEach(entry => {
        let entryString = entry.text;
        if (typeof entry.singleLink !== 'undefined') {
          entryString += '\n' + entry.singleLink.link;
        }
        if (typeof entry.multiLink !== 'undefined') {
          entry.multiLink.forEach(link => entryString += '\n' + link.link);
        }
        rowString.push(entryString);
      });
      result.push(rowString);
    });
    return result;
  }

  // End of Download for CSV section.

  // Start of changing enrichment params section.

  /**
   * Opens EnrichmentTableOrderDialog that gives new column order.
   */
  openOrderDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
    dialogRef.componentInstance.domains = [...this.domains];
    return dialogRef.result.then((result) => {
      if (this.domains !== result) {
        this.reorderEntries(result);
      }
    }, () => {
    });
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
    const contentValue = new Blob([JSON.stringify(this.graphCanvas.getGraph())], {
      type: MAP_MIMETYPE,
    });

    // Push to backend to save
    this.filesystemService.save([this.locator], {
      contentValue,
    })
      .pipe(this.errorHandler.create({label: 'Update map'}))
      .subscribe(() => {
        this.unsavedChanges$.next(false);
        this.emitModuleProperties();
        this.snackBar.open('Visualisation saved.', null, {
          duration: 2000,
        });
      });
  }

  /**
   * Change current table entries to follow new column order.
   * @param order new column order.
   */
  reorderEntries(order: string[]) {
    const newEntries = [];
    this.tableEntries.forEach(row => {
      const newRow = [];
      for (let i = 0; i < this.numDefaultHeader; i++) {
        newRow[i] = row[i];
      }
      const newOrder = [...order];
      const newDomains = [...this.domains];

      // Regulon column has three sub columns that need to be updated.
      if (newOrder.includes('Regulon')) {
        newOrder.splice(newOrder.indexOf('Regulon') + 1, 0, 'Regulon 1');
        newOrder.splice(newOrder.indexOf('Regulon') + 2, 0, 'Regulon 2');
        newDomains.splice(newDomains.indexOf('Regulon') + 1, 0, 'Regulon 1');
        newDomains.splice(newDomains.indexOf('Regulon') + 2, 0, 'Regulon 2');
      }

      newOrder.forEach(domain =>
        newRow[newOrder.indexOf(domain) + this.numDefaultHeader] =
          row[newDomains.indexOf(domain) + this.numDefaultHeader]);
      newEntries.push(newRow);
    });
    this.tableEntries = newEntries;
    this.domains = order;
    this.columnOrder = [...order];
    if (this.columnOrder.includes('Regulon')) {
      const index = this.columnOrder.indexOf('Regulon');
      this.columnOrder.splice(index + 1, 0, 'Regulon 3');
      this.columnOrder.splice(index + 1, 0, 'Regulon 2');
    }
    this.initializeHeaders();
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentTableEditDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.object = this.object;
    dialogRef.componentInstance.data = this.data;
    return dialogRef.result.then((result: EnrichmentVisualisationData) => {
      const contentValue = new Blob([JSON.stringify(result)], {
        type: ENRICHMENT_VISUALISATION_MIMETYPE,
      });

      const progressDialogRef = this.progressDialog.display({
        title: `Saving Parameters`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Updating enrichment table parameters...',
        })),
      });

      // Push to backend to save
      this.filesystemService.save([this.object.hashId], {
        contentValue,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Edit enrichment table'}),
        )
        .subscribe(() => {
          this.emitModuleProperties();
          this.snackBar.open('Enrichment table updated.', null, {
            duration: 2000,
          });
          this.tableEntries = [];
          this.loadTableTask.update();
        });
    }, () => {
    });
  }

  // End of changing enrichment params section.

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.object ? this.object.filename : 'Enrichment Visualisation',
      fontAwesomeIcon: 'chart-bar',
    });
  }

  /**
   * Change the table headers based on column order and domain input.
   */
  initializeHeaders() {
    this.tableHeader = [
      [
        {name: 'Imported', span: '1'},
        {name: 'Matched', span: '1'},
        {name: 'NCBI Gene Full Name', span: '1'},
      ],
    ];
    if (this.domains.includes('Regulon')) {
      this.tableHeader[1] = this.secondHeaderMap.get('Default');
    }
    this.domains.forEach((domain) => {
      this.tableHeader[0] = this.tableHeader[0].concat(this.headerMap.get(domain));
      if (this.domains.includes('Regulon')) {
        this.tableHeader[1] = this.tableHeader[1].concat(this.secondHeaderMap.get(domain));
      }
    });
  }

  /**
   *  Match list of inputted gene names to NCBI nodes with name stored in Neo4j.
   */
  matchNCBINodes() {
    this.loadingData = true;
    this.worksheetViewerService
      .matchNCBINodes(this.importGenes, this.taxID)
      .pipe(
        catchError((error) => {
          this.snackBar.open(`Unable to load entries.`, 'Close', {
            duration: 5000,
          });
          this.loadingData = false;
          return error;
        }),
        this.errorHandler.create({label: 'Match NCBI nodes'}),
      )
      .subscribe((result: NCBIWrapper[]) => {
        this.getDomains(result, this.importGenes);
      });
  }

  /**
   *  Match list of inputted gene names to NCBI nodes with name stored in Neo4j.
   */
  enrichWithGOTerms() {
    this.loadingData = true;
    this.enrichmentService
      .enrichWithGOTerms(this.importGenes, this.taxID)
      .pipe(
        catchError((error) => {
          this.snackBar.open(`Unable to load entries.`, 'Close', {
            duration: 5000,
          });
          this.loadingData = false;
          return error;
        }),
        this.errorHandler.create({label: 'Match NCBI nodes'}),
      )
      .subscribe((result: NCBIWrapper[]) => {
          console.log(result);
      });
  }

  /**
   * Remove any duplicates from the import gene list and populate duplicate list
   * @param arr string of gene names
   */
  removeDuplicates(arr: string[]) {
    const duplicateArray: string[] = [];
    const uniqueArray: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr.indexOf(arr[i]) !== i) {
        duplicateArray.push(arr[i]);
      } else {
        uniqueArray.push(arr[i]);
      }
    }
    this.importGenes = uniqueArray;
    this.duplicateGenes = duplicateArray.join(', ');
  }

  /**
   * Using node ids of matched NCBI nodes, get data from enrichment domains and add
   * data to table entries.
   * @param result result from matching to NCBI nodes
   * @param currentGenes list of gene names used to process unmatched genes.
   */
  getDomains(result: NCBIWrapper[], currentGenes: string[]) {
    const synonyms = result.map((wrapper) => wrapper.s.name);
    const ncbiNodes = result.map((wrapper) => wrapper.x);
    const ncbiIds = result.map((wrapper) => wrapper.neo4jID);
    const ncbiLinks = result.map((wrapper) => wrapper.link);
    this.worksheetViewerService
      .getNCBIEnrichmentDomains(ncbiIds, this.taxID)
      .pipe(
        catchError((error) => {
          this.snackBar.open(`Unable to load entries.`, 'Close', {
            duration: 5000,
          });
          this.loadingData = false;
          return error;
        }),
        this.errorHandler.create({label: 'Get domains for enrichment table'}),
      )
      .subscribe((domainResult: EnrichmentWrapper[]) => {
        let newEntries = domainResult.map((wrapper) =>
          this.processEnrichmentNodeArray(wrapper, ncbiNodes, ncbiIds),
        );
        // Add ncbi and imported gene name columns to relevant columns (left of domains)
        for (let i = 0; i < ncbiNodes.length; i++) {
          newEntries[i].unshift({
            text: ncbiNodes[i].full_name,
            singleLink: {
              link: ncbiLinks[i],
              linkText: 'NCBI Link',
            },
          });
          newEntries[i].unshift({text: ncbiNodes[i].name});
          newEntries[i].unshift({text: synonyms[i]});
        }
        newEntries = newEntries.concat(this.processUnmatchedNodes(synonyms, currentGenes));
        this.tableEntries = this.tableEntries.concat(newEntries);
        this.loadingData = false;
      });
  }

  /**
   * Process matched genes to add all unmatched gene names to bottom of table.
   * @param synonyms matched gene names
   * @param currentGenes initial list of gene names
   */
  processUnmatchedNodes(synonyms: string[], currentGenes: string[]): TableCell[][] {
    this.geneNames = synonyms;
    const unmatchedGenes = currentGenes.filter(
      (gene) => !this.geneNames.includes(gene),
    );
    const result = [];
    unmatchedGenes.forEach((gene) => {
      const cell: TableCell[] = [];
      cell.push({text: gene, highlight: true});
      cell.push({text: 'No match found.', highlight: true});
      const colNum = Math.max.apply(
        null,
        this.tableHeader.map((x) =>
          x.reduce((a, b) => a + parseInt(b.span, 10), 0),
        ),
      );
      for (let i = 0; i < colNum - 2; i++) {
        cell.push({text: '', highlight: true});
      }
      result.push(cell);
    });
    return result;
  }

  /**
   * Process wrapper to convert domain data into string array that represents domain columns.
   * Uses this.domains property (domain input) to determine whether to display in table.
   * Uses this.columnOrder to determine which column/index to place in.
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param wrapper data returned from get domains request
   * @param ncbiNodes matched ncbi data
   * @param ncbiIds matched ncbi ids
   * @returns table entries
   */
  processEnrichmentNodeArray(wrapper: EnrichmentWrapper, ncbiNodes: NCBINode[], ncbiIds: number[]): TableCell[] {
    const result: TableCell[] = [];
    if (this.domains.includes('Regulon')) {
      if (wrapper.regulon.result !== null) {
        result[this.columnOrder.indexOf('Regulon')] = (
          wrapper.regulon.result.regulator_family
            ? {
              text: wrapper.regulon.result.regulator_family,
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
        result[this.columnOrder.indexOf('Regulon 2')] = (
          wrapper.regulon.result.activated_by
            ? {
              text: wrapper.regulon.result.activated_by.join('; '),
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
        result[this.columnOrder.indexOf('Regulon 3')] = (
          wrapper.regulon.result.repressed_by
            ? {
              text: wrapper.regulon.result.repressed_by.join('; '),
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
            : {
              text: '',
              singleLink: {
                link: wrapper.regulon.link,
                linkText: 'Regulon Link',
              },
            }
        );
      } else {
        for (let i = 0; i < 3; i++) {
          result[this.columnOrder.indexOf('Regulon') + i] = ({text: ''});
        }
      }
    }
    if (this.domains.includes('UniProt')) {
      result[this.columnOrder.indexOf('UniProt')] = (
        wrapper.uniprot.result
          ? {
            text: wrapper.uniprot.result.function,
            singleLink: {
              link: wrapper.uniprot.link,
              linkText: 'Uniprot Link',
            },
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('String')) {
      result[this.columnOrder.indexOf('String')] = (
        wrapper.string.result
          ? {
            text:
              wrapper.string.result.annotation !== 'annotation not available'
                ? wrapper.string.result.annotation
                : '',
            singleLink: wrapper.string.result.id
              ? {
                link: wrapper.string.link + wrapper.string.result.id,
                linkText: 'String Link',
              }
              : wrapper.biocyc.result.biocyc_id
                ? {
                  link: wrapper.string.link + wrapper.biocyc.result.biocyc_id,
                  linkText: 'String Link',
                }
                : null,
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('GO')) {
      result[this.columnOrder.indexOf('GO')] = (
        wrapper.go.result
          ? {
            text: this.processGoWrapper(wrapper.go.result),
            singleLink: wrapper.uniprot.result
              ? {
                link: wrapper.go.link + wrapper.uniprot.result.id,
                linkText: 'GO Link',
              }
              : {
                link:
                  'http://amigo.geneontology.org/amigo/search/annotation?q=' +
                  ncbiNodes[ncbiIds.indexOf(wrapper.node_id)].name,
                linkText: 'GO Link',
              },
          }
          : {text: ''}
      );
    }
    if (this.domains.includes('Biocyc')) {
      result[this.columnOrder.indexOf('Biocyc')] = (
        wrapper.biocyc.result
          ? wrapper.biocyc.result.pathways
          ? {
            text: wrapper.biocyc.result.pathways.join('; '),
            singleLink: {
              link: wrapper.biocyc.link,
              linkText: 'Biocyc Link',
            },
          }
          : {
            text: '',
            singleLink: {
              link: wrapper.biocyc.link,
              linkText: 'Biocyc Link',
            },
          }
          : {text: ''}
      );
    }
    return result;
  }

  processGoWrapper(nodeArray: GoNode[]): string {
    if (nodeArray.length > 5) {
      return (
        nodeArray
          .map((node) => node.name)
          .slice(0, 5)
          .join('; ') + '...'
      );
    } else {
      return nodeArray
        .map((node) => node.name)
        .slice(0, 5)
        .join('; ');
    }
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    this.object.addDataTransferData(dataTransfer);
  }

  openCloneDialog() {
    const newTarget: FilesystemObject = cloneDeep(this.map);
    newTarget.public = false;
    return this.filesystemObjectActions.openCloneDialog(newTarget).then(clone => {
      this.workspaceManager.navigate(clone.getCommands(), {
        newTab: true,
      });
      this.snackBar.open(`Copied ${getObjectLabel(this.map)} to ${getObjectLabel(clone)}.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }

  openVersionHistoryDialog() {
    return this.filesystemObjectActions.openVersionHistoryDialog(this.map);
  }

  openExportDialog() {
    if (this.unsavedChanges$.getValue()) {
      this.messageDialog.display({
        title: 'Save Required',
        message: 'Please save your changes before exporting.',
        type: MessageType.Error,
      });
    } else {
      return this.filesystemObjectActions.openExportDialog(this.map);
    }
  }

  openShareDialog() {
    return this.filesystemObjectActions.openShareDialog(this.map);
  }

  goToReturnUrl() {
    if (this.shouldConfirmUnload()) {
      if (confirm('Leave editor? Changes you made may not be saved.')) {
        this.workspaceManager.navigateByUrl(this.returnUrl);
      }
    } else {
      this.workspaceManager.navigateByUrl(this.returnUrl);
    }
  }
}

export interface EnrichmentVisualisationData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
