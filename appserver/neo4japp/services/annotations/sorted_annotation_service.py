from typing import Dict, Tuple, Union, TypedDict, List

from neo4japp.models import Files
from neo4japp.services.annotations import ManualAnnotationService
from numpy import log
from pandas import DataFrame
from scipy.stats import mannwhitneyu


# region Types
class AnnotationMeta(TypedDict):
    id: str


class Annotation(TypedDict):
    meta: AnnotationMeta


class SortedAnnotationResult(TypedDict):
    annotation: Annotation
    value: Union[int, float]


SortedAnnotationResults = Dict[str, SortedAnnotationResult]
FileAnnotationTable = List[Tuple[str, str]]
AnnotationLookupTable = Dict[str, Annotation]


# endregion


class SortedAnnotation:
    id: str

    def __init__(
            self,
            annotation_service: ManualAnnotationService,
    ) -> None:
        self.annotation_service = annotation_service

    def get_annotations_per_file(self, files) -> Tuple[FileAnnotationTable, AnnotationLookupTable]:
        files_annotations: FileAnnotationTable = []
        key_map: AnnotationLookupTable = {}
        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                key_map[key] = annotation
                files_annotations.append((file.hash_id, key))
        return files_annotations, key_map

    def get_annotations(self, project_id: List[Files]) -> SortedAnnotationResults:
        raise NotImplemented


class SumLogCountSA(SortedAnnotation):
    id = 'sum_log_count'

    def get_annotations(self, files):
        files_annotations, key_map = self.get_annotations_per_file(files)
        df = DataFrame(
                files_annotations,
                columns=['file_id', 'key']
        )
        gdf = df.groupby(["key", "file_id"])
        distinct_annotations = dict()
        for key, value in log(gdf.size()).sum(level="key").items():
            distinct_annotations[key] = {
                'annotation': key_map[key],
                'value': float(value)
            }
        return distinct_annotations


class FrequencySA(SortedAnnotation):
    id = 'frequency'

    def get_annotations(self, files):
        distinct_annotations = dict()

        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                if key in distinct_annotations:
                    distinct_annotations[key]['value'] += 1
                else:
                    distinct_annotations[key] = {
                        'annotation': annotation,
                        'value': 1
                    }

        return distinct_annotations


class MannWhitneyUSA(SortedAnnotation):
    id = 'mwu'

    def get_annotations(self, files):
        files_annotations, key_map = self.get_annotations_per_file(files)

        df = DataFrame(
                files_annotations,
                columns=['file_id', 'key']
        ) \
            .groupby(["key", "file_id"]) \
            .size() \
            .reset_index()

        distinct_annotations = dict()
        for key in df['key'].unique():
            df['mask'] = df['key'] == key
            distinct_annotations[key] = {
                'annotation': key_map[key],
                'value': -log(
                        mannwhitneyu(
                                df[df['mask']][0],
                                df[0] * (~df['mask']),
                                alternative='greater'
                        ).pvalue
                )
            }

        return distinct_annotations


class FrequencyEnrichmentSA(SortedAnnotation):
    id = 'frequency'

    def get_annotations(self, files):
        distinct_annotations = dict()

        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            filtered_annotations = filter(
                    lambda d: d['enrichmentDomain'] != 'Imported',
                    annotations
            )
            for annotation in filtered_annotations:
                key = annotation['meta']['id']
                if key in distinct_annotations:
                    distinct_annotations[key]['value'] += 1
                else:
                    distinct_annotations[key] = {
                        'annotation': annotation,
                        'value': 1
                    }

        return distinct_annotations


class MannWhitneyPerRowUSA(SortedAnnotation):
    id = 'mwu'

    def get_annotations(self, files):
        distinct_annotations = dict()
        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            filtered_annotations = filter(
                    lambda d: d['enrichmentDomain'] != 'Imported',
                    annotations
            )
            df = DataFrame(filtered_annotations)
            df['id'] = df['meta'].map(lambda d: d['id'])
            df['enrichmentDomain'] = df['enrichmentDomain'].map(
                    lambda d: (d['domain'], d['subDomain']))
            take_first_annotation = {
                'meta': 'first',
                'keyword': 'first',
                'primaryName': 'first'
            }
            df = df.groupby(['id', 'enrichmentGene', 'enrichmentDomain']).aggregate(
                    dict(uuid='count', **take_first_annotation)).reset_index()
            df = df.groupby(['id', 'enrichmentGene']).aggregate(
                    dict(uuid='max', **take_first_annotation)).rename(
                    columns=dict(uuid=0)).reset_index()

            gen = df.groupby(['id']).aggregate(take_first_annotation).iterrows()
            for (key, annotation) in gen:
                df['mask'] = df['id'] == key
                distinct_annotations[key] = {
                    'annotation': annotation,
                    'value': -log(
                            mannwhitneyu(
                                    df[df['mask']][0],
                                    df[0] * (~df['mask']),
                                    alternative='greater'
                            ).pvalue
                    )
                }

        return distinct_annotations


class CountPerRowUSA(SortedAnnotation):
    id = 'count_per_row'

    def get_annotations(self, files):
        distinct_annotations = dict()
        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            filtered_annotations = filter(
                    lambda d: d['enrichmentDomain'] != 'Imported',
                    annotations
            )
            for annotation in filtered_annotations:
                annotation_id = annotation['meta']['id']
                distinct_annotation = distinct_annotations.get(annotation_id, {
                    'annotation': annotation,
                    'value': set()
                })
                distinct_annotation['value'].add(annotation['enrichmentGene'])
                distinct_annotations[annotation_id] = distinct_annotation

        for distinct_annotation in distinct_annotations.values():
            distinct_annotation['value'] = len(distinct_annotation['value'])

        return distinct_annotations


sorted_annotations_dict = {
    SumLogCountSA.id: SumLogCountSA,
    FrequencySA.id: FrequencySA,
    MannWhitneyUSA.id: MannWhitneyUSA,
    CountPerRowUSA.id: CountPerRowUSA
}

default_sorted_annotation = FrequencySA

sorted_annotations_per_file_type_dict = {
    'vnd.***ARANGO_DB_NAME***.document/enrichment-table': {
        FrequencyEnrichmentSA.id: FrequencyEnrichmentSA,
        CountPerRowUSA.id: CountPerRowUSA,
        MannWhitneyPerRowUSA.id: MannWhitneyPerRowUSA,
        'default_sorted_annotation': FrequencySA
    }
}
