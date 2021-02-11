from typing import Dict, Tuple

from neo4japp.services.annotations import ManualAnnotationService
from numpy import log
from pandas import DataFrame
from scipy.stats import mannwhitneyu


class SortedAnnotation:
    id: str

    def __init__(
            self,
            annotation_service: ManualAnnotationService,
    ) -> None:
        self.annotation_service = annotation_service

    @staticmethod
    def meta_to_id_tuple(annotation):
        meta = annotation['meta']
        return (
            meta['id'],
            meta['type'],
            annotation['keyword'].strip(),
            annotation['primaryName'].strip(),
        )

    def get_annotations(self, project_id) -> Dict[Tuple[str, str, str], float]:
        raise NotImplemented


class SumLogCountSA(SortedAnnotation):
    id = 'sum_log_count'

    def get_annotations(self, files) -> Dict[Tuple[str, str, str], float]:
        files_annotations = [];
        key_map = {}
        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                key_map[key] = annotation
                files_annotations.append((file.hash_id, key))
        df = DataFrame(
            files_annotations,
            columns=['file_id', 'key']
        )
        gdf = df.groupby(["key", "file_id"])
        distinct_annotations = {}
        for key, count in log(gdf.size()).sum(level="key").items():
            distinct_annotations[key] = {
                'annotation': key_map[key],
                'count': count
            }
        return distinct_annotations


class FrequencySA(SortedAnnotation):
    id = 'frequency'

    def get_annotations(self, files) -> Dict[Tuple[str, str, str], float]:
        distinct_annotations: Dict[Tuple[str, str, str], float] = {}

        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                if key in distinct_annotations:
                    distinct_annotations[key]['count'] += 1
                else:
                    distinct_annotations[key] = {
                        'annotation': annotation,
                        'count': 1
                    }

        return distinct_annotations


class MannWhitneyUSA(SortedAnnotation):
    id = 'mwu'

    def get_annotations(self, files) -> Dict[Tuple[str, str, str], float]:
        files_annotations = [];
        key_map = {}
        for file in files:
            annotations = self.annotation_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                key_map[key] = annotation
                files_annotations.append((file.hash_id, key))

        df = DataFrame(
            files_annotations,
            columns=['file_id', 'key']
        ) \
            .groupby(["key", "file_id"]) \
            .size()
        distinct_annotations = {}
        for key, group in df.groupby('key'):
            distinct_annotations[key] = {
                'annotation': key_map[key],
                'count': -log(
                    mannwhitneyu(
                        group,
                        df[df.index.get_level_values('key') != key]
                    ).pvalue
                )
            }

        return distinct_annotations


sorted_annotations_dict = {
    SumLogCountSA.id: SumLogCountSA,
    FrequencySA.id: FrequencySA,
    MannWhitneyUSA.id: MannWhitneyUSA
}

default_sorted_annotation = FrequencySA
