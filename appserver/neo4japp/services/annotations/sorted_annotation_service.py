from typing import Dict, Tuple, Union, TypedDict, List

import numpy as np
from neo4japp.models import Files
from neo4japp.services.annotations import ManualAnnotationService
from pandas import DataFrame, MultiIndex
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
        for key, value in np.log(gdf.size()).sum(level="key").items():
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

    @staticmethod
    # https://stackoverflow.com/questions/11144513/cartesian-product-of-x-and-y-array-points-into
    # -single-array-of-2d-points/11146645#11146645
    def cartesian_product(*arrays):
        la = len(arrays)
        dtype = np.result_type(*arrays)
        arr = np.empty([len(a) for a in arrays] + [la], dtype=dtype)
        for i, a in enumerate(np.ix_(*arrays)):
            arr[..., i] = a
        return arr.reshape(-1, la)

    def get_annotations(self, files):
        files_annotations, key_map = self.get_annotations_per_file(files)

        df = DataFrame(
                files_annotations,
                columns=['file_id', 'key']
        ) \
            .groupby(['file_id', 'key']) \
            .size() \
            .reset_index()

        # Calc before exploding the array
        unique_keys = df['key'].unique()

        v = self.cartesian_product(df.key, df.file_id)
        idx = MultiIndex.from_arrays([v[:, 0], v[:, 1]])

        df.set_index(['file_id', 'key']).reindex(idx)

        distinct_annotations = dict()
        for key in unique_keys:
            df['mask'] = df['key'] == key
            distinct_annotations[key] = {
                'annotation': key_map[key],
                'value': -np.log(
                        mannwhitneyu(
                                df[df['mask']][0],
                                df[~df['mask']][0],
                                alternative='greater'
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
