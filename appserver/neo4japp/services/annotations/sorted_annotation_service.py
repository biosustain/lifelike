from typing import Dict, Tuple

from numpy import log
from pandas import DataFrame
from sqlalchemy import and_
from scipy.stats import mannwhitneyu

from neo4japp.models import Files
from neo4japp.services.annotations import ManualAnnotationService


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

    def get_annotations(self, project_id) -> Dict[Tuple[str, str, str], float]:
        files_annotations = self.annotation_service.get_files_annotations_in_project(project_id)
        df = DataFrame(
            [
                (file_id, SortedAnnotation.meta_to_id_tuple(annotation))
                for (file_id, annotations) in files_annotations.items()
                for annotation in annotations
            ],
            columns=['file_id', 'annotation']
        )
        gdf = df.groupby(["annotation", "file_id"])
        return log(gdf.size()).sum(level="annotation").to_dict()


class FrequencySA(SortedAnnotation):
    id = 'frequency'

    def get_annotations(self, project_id) -> Dict[Tuple[str, str, str], float]:
        distinct_annotations: Dict[Tuple[str, str, str], float] = {}
        for annotation in map(
                SortedAnnotation.meta_to_id_tuple,
                self.annotation_service.get_combined_annotations_in_project(project_id)
        ):
            if annotation in distinct_annotations:
                distinct_annotations[annotation] += 1
            else:
                distinct_annotations[annotation] = 1

        return distinct_annotations


class MannWhitneyUSA(SortedAnnotation):
    id = 'mwu'

    def get_annotations(self, project_id) -> Dict[Tuple[str, str, str], float]:
        files_annotations = self.annotation_service.get_files_annotations_in_project(project_id)
        df = DataFrame(
                [
                    (file_id, SortedAnnotation.meta_to_id_tuple(annotation))
                    for (file_id, annotations) in files_annotations.items()
                    for annotation in annotations
                ],
                columns=['file_id', 'annotation']
            )\
            .groupby(["annotation", "file_id"])\
            .size()
        distinct_annotations = {}
        for annotation, group in df.groupby('annotation'):
            distinct_annotations[annotation] = -log(
                mannwhitneyu(
                    group,
                    df[df.index.get_level_values('annotation') != annotation]
                ).pvalue
            )
        return distinct_annotations


sorted_annotations_dict = {
    SumLogCountSA.id: SumLogCountSA,
    FrequencySA.id: FrequencySA,
    MannWhitneyUSA.id: MannWhitneyUSA
}

default_sorted_annotation = FrequencySA
