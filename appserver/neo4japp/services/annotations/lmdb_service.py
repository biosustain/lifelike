from .lmdb_connector import LMDBConnector


class LMDBService(LMDBConnector):
    def __init__(self, dirpath: str, **kwargs) -> None:
        super().__init__(dirpath, **kwargs)
